import { App, Notice, PluginSettingTab, SecretComponent, setIcon } from 'obsidian';
import type CoverPlugin from './main';
import { folderPath } from './model';
import { GROUPS, PLATFORMS } from './platforms';
import { FONT_SITES } from './fontbrowser';
import { PROVIDER_PRESETS } from './aiparse';
import { CodexInfo, detectCodex } from './codex';
import { ModelDialog } from './modeldialog';
import { chatLabel, IMAGE_ENGINES, imageLabel, removeChat, removeImage, switchChat, switchImage } from './aiparse';
import { FONT_PACKS } from './fontlib';
import { installPack, packMissing } from './fontpack';
import { FontLibraryModal, ShortcutsModal } from './modals';
import { bytes, textButton } from './ui';
import { choiceCards, more, Row, section, statusBar } from './settingsui';

export type SettingsTab = 'general' | 'export' | 'fonts' | 'assistant' | 'about';
const TABS: { id: SettingsTab; icon: string }[] = [{ id: 'general', icon: 'sliders-horizontal' }, { id: 'export', icon: 'download' }, { id: 'fonts', icon: 'type' }, { id: 'assistant', icon: 'sparkles' }, { id: 'about', icon: 'info' }];
type Source = 'codex' | 'api' | 'off';

export class CoverSettings extends PluginSettingTab {
  tab: SettingsTab = 'general'; private off?: () => void; private codex?: CodexInfo | 'missing' | 'checking'; private testLine?: { tone: 'ok' | 'warn'; text: string };
  constructor(app: App, private plugin: CoverPlugin) { super(app, plugin); }
  hide(): void { this.off?.(); this.off = undefined; }
  private get t(): CoverPlugin['t'] { return this.plugin.t.bind(this.plugin); }
  private save(): void { void this.plugin.saveSettings().catch(e => this.plugin.report(e)); }

  display(): void {
    const el = this.containerEl; el.empty(); el.addClass('qc-settings'); this.off?.();
    const head = el.createDiv('qc-settings-head'); const id = head.createDiv('qc-settings-identity');
    setIcon(id.createSpan(), 'image'); id.createSpan({ text: 'Qiaomu Cover Design', cls: 'qc-settings-name' }); id.createSpan({ text: `v${this.plugin.manifest.version}`, cls: 'qc-settings-version' });
    const tabs = head.createDiv('qc-settings-tabs'); tabs.setAttribute('role', 'tablist');
    for (const { id: tab, icon } of TABS) {
      const b = tabs.createEl('button', { cls: 'qc-settings-tab', attr: { type: 'button', role: 'tab', 'aria-selected': String(this.tab === tab) } });
      setIcon(b.createSpan({ cls: 'qc-settings-tab-icon' }), icon); b.createSpan({ text: this.t(`set_${tab}` as 'set_general') }); b.classList.toggle('is-active', this.tab === tab);
      b.addEventListener('click', () => { this.tab = tab; this.display(); });
    }
    const body = el.createDiv('qc-settings-body');
    ({ general: () => this.general(body), export: () => this.exportTab(body), fonts: () => this.fontsTab(body), assistant: () => this.assistantTab(body), about: () => this.about(body) })[this.tab]();
  }

  private folderRow(parent: HTMLElement, name: string, desc: string, get: () => string, set: (v: string) => void): void {
    new Row(parent, name, desc).addText(text => text.setValue(get()).onChange(value => {
      try { set(folderPath(value)); this.save(); text.inputEl.removeClass('qc-invalid'); } catch { text.inputEl.addClass('qc-invalid'); }
    }));
  }

  /* ---------- general ---------- */
  private general(body: HTMLElement): void {
    const s = this.plugin.settings; const t = this.t; const zh = this.plugin.isZh();
    const basics = section(body, t('s_basics'));
    new Row(basics, t('language'), t('restart')).addDropdown(d => d.addOptions({ auto: t('auto'), zh: '中文', en: 'English' }).setValue(s.language).onChange(v => { s.language = v; this.save(); }));
    new Row(basics, t('defaultPlatform'), t('defaultPlatformDesc')).addDropdown(d => {
      for (const g of GROUPS) for (const p of PLATFORMS.filter(x => x.group === g.id)) d.addOption(p.id, `${this.plugin.isZh() ? p.zh : p.en} · ${p.width}×${p.height}`);
      d.setValue(s.defaultPlatform).onChange(v => { s.defaultPlatform = v; this.save(); });
    });
    this.folderRow(basics, t('designFolder'), t('designFolderDesc'), () => s.designFolder, v => { s.designFolder = v; });
    const photos = section(body, zh ? '背景图素材' : 'Background photos', zh ? '在顶部“插入 → 背景图”里搜索 Unsplash 的免费摄影。需要你自己的免费 Access Key。' : 'Search Unsplash photos from Insert → Photos. Needs your own free Access Key.');
    const keyRow = new Row(photos, 'Unsplash Access Key', zh ? '在 unsplash.com/developers 免费申请；只保存在 Obsidian 密钥库中。' : 'Get one free at unsplash.com/developers; stored in Obsidian\'s secret storage.');
    try { new SecretComponent(this.app, keyRow.control).setValue(s.unsplashSecret).onChange(v => { s.unsplashSecret = v; this.save(); }); } catch { keyRow.setDesc(zh ? '当前 Obsidian 版本不支持密钥库（需要 1.11.4+）。' : 'Needs Obsidian 1.11.4 or newer.'); }
    new Row(photos, zh ? 'Unsplash 代理地址（可选）' : 'Unsplash proxy (optional)', zh ? '填了就不需要密钥：由你部署的代理（见 server/unsplash-proxy.js）持有密钥，适合团队或公开分发。' : 'Set this instead of a key: your own proxy holds the key (see server/unsplash-proxy.js).').addText(x => x.setPlaceholder('https://…workers.dev').setValue(s.unsplashProxy).onChange(v => { const u = v.trim(); if (!u || /^https:\/\//.test(u)) { s.unsplashProxy = u; this.save(); x.inputEl.removeClass('qc-invalid'); } else x.inputEl.addClass('qc-invalid'); }));
    const guides = section(body, t('guidesDefault'), t('s_guidesDesc'));
    new Row(guides, t('centerLines')).addToggle(x => x.setValue(s.guides.center).onChange(v => { s.guides.center = v; this.save(); }));
    new Row(guides, t('snap'), t('snapDesc')).addToggle(x => x.setValue(s.guides.snap).onChange(v => { s.guides.snap = v; this.save(); }));
    new Row(guides, t('safeZone'), t('safeZoneDesc')).addToggle(x => x.setValue(s.guides.safe).onChange(v => { s.guides.safe = v; this.save(); }));
  }

  /* ---------- export ---------- */
  private exportTab(body: HTMLElement): void {
    const s = this.plugin.settings; const t = this.t; const e = s.export;
    const where = section(body, t('s_exportWhere'), t('exportDefaultsDesc'));
    new Row(where, t('destination')).addDropdown(d => d.addOptions({ folder: t('destFolder'), note: t('destNote'), system: t('destSystem') }).setValue(e.destination ?? 'folder').onChange(v => { e.destination = v as 'folder'; this.save(); this.display(); }));
    if ((e.destination ?? 'folder') === 'system') {
      new Row(where, t('destSystem'), t('destSystemHint')).addText(x => x.setPlaceholder('~/Downloads').setValue(e.systemDir ?? '').onChange(v => { e.systemDir = v.trim(); this.save(); }))
        .addButton(b => b.setButtonText(t('choose')).onClick(() => void this.plugin.chooseSystemFolder(this.containerEl.ownerDocument).then(p => { if (p) { e.systemDir = p; this.save(); this.display(); } })));
    } else this.folderRow(where, t('exportFolder'), t('exportFolderDesc'), () => s.exportFolder, v => { s.exportFolder = v; });
    const file = section(body, t('s_exportFile'));
    new Row(file, t('format')).addDropdown(d => d.addOptions({ png: 'PNG', jpeg: 'JPEG', webp: 'WebP' }).setValue(e.format ?? 'png').onChange(v => { e.format = v as 'png'; this.save(); }));
    new Row(file, t('exportSize')).addDropdown(d => d.addOptions({ '1': '1×', '2': '2×', '3': '3×' }).setValue(String(e.scale ?? 1)).onChange(v => { e.scale = Number(v); this.save(); }));
    new Row(file, t('quality'), t('qualityDesc')).addSlider(x => x.setLimits(40, 100, 1).setValue(Math.round((e.quality ?? 0.92) * 100)).setDynamicTooltip().onChange(v => { e.quality = v / 100; this.save(); }));
    new Row(file, t('filename'), t('filenameHint')).addText(x => x.setValue(e.filename ?? '{name}-{platform}').onChange(v => { e.filename = v.trim() || '{name}-{platform}'; this.save(); }));
    new Row(file, t('fitLimitShort'), t('fitLimitDesc')).addToggle(x => x.setValue(e.fitLimit ?? true).onChange(v => { e.fitLimit = v; this.save(); }));
  }

  /* ---------- fonts ---------- */
  private fontsTab(body: HTMLElement): void {
    const s = this.plugin.settings; const t = this.t; const fonts = this.plugin.fonts; const doc = this.containerEl.ownerDocument;
    const lib = section(body, t('s_fontGetTitle'), t('s_fontGetDesc'));
    for (const pk of FONT_PACKS) {
      const left = packMissing(this.plugin, pk.id); const zh = this.plugin.isZh();
      const row = new Row(lib, zh ? pk.zh : pk.en, pk.desc);
      if (!left) row.addButton(b => b.setButtonText(zh ? '已安装' : 'Installed').setDisabled(true));
      else row.addButton(b => b.setButtonText(zh ? `一键安装（${left} 款）` : `Install all (${left})`).setCta().onClick(() => {
        b.setDisabled(true); void installPack(this.plugin, doc, pk.id, (done, total, fam) => b.setButtonText(fam ? `${done + 1}/${total} ${fam}…` : '…')).then(() => { if (pk.id === 'designer') this.plugin.repairOpenCovers(); this.display(); });
      }));
    }
    new Row(lib, t('fontLibTitle'), t('s_fontLibRow')).addButton(b => b.setButtonText(t('fontLibOpen')).setCta().onClick(() => new FontLibraryModal(this.plugin, doc, () => this.display()).open()));
    const picker = doc.createElement('input'); picker.type = 'file'; picker.multiple = true; picker.accept = '.ttf,.otf,.woff,.woff2';
    picker.addEventListener('change', () => void fonts.importFiles(Array.from(picker.files ?? []), doc).then(added => { new Notice(added.length ? t('fontsImported', { names: added.join(', ') }) : t('fontsNone')); this.display(); }).catch(err => this.plugin.report(err)));
    new Row(lib, t('fontImport'), t('fontHint')).addButton(b => b.setButtonText(t('fontImportBtn')).onClick(() => picker.click()));
    const mine = section(body, t('fontsInstalled'), t('fontsInstalledDesc'));
    const list = mine.createDiv('qc-font-files'); const files = fonts.files();
    if (!files.length) list.createDiv({ text: t('fontEmptyVault'), cls: 'qc-empty-note' });
    for (const f of files) {
      const row = list.createDiv('qc-font-file'); const sample = row.createSpan({ text: '封面 Aa', cls: 'qc-font-file-sample' }); sample.style.fontFamily = `"${f.family}", sans-serif`;
      row.createSpan({ text: f.family, cls: 'qc-font-file-name' }); row.createSpan({ text: `${f.ext.toUpperCase()} · ${bytes(f.size)}`, cls: 'qc-hint' });
      textButton(row, t('remove'), () => void fonts.remove(f.family, doc).then(() => this.display()).catch(err => this.plugin.report(err)), 'qc-btn-sm', 'trash-2');
    }
    this.folderRow(mine, t('fontFolder'), t('fontFolderDesc'), () => s.fontFolder, v => { s.fontFolder = v; void fonts.loadVault(doc).then(() => this.display()); });
    const sys = section(body, t('fontsSystem'));
    const state = fonts.state;
    new Row(sys, t('fontsSystemStatus'), state === 'ok' ? t('fontCount', { n: fonts.system.length, v: fonts.vault.length }) : state === 'idle' ? t('fontScanning') : t('fontLimited'))
      .addButton(b => b.setButtonText(t('fontRefresh')).onClick(() => void fonts.scanSystem(doc, true).then(() => this.display())));
    const help = more(body, t('s_fontMore'));
    help.createDiv({ text: t('fontInstallSteps'), cls: 'qcs-note' }); help.createDiv({ text: t('fontLicense'), cls: 'qcs-note' });
    const links = help.createDiv('qc-links');
    for (const [name, url, key] of FONT_SITES) {
      const row = links.createDiv('qc-link-row'); const a = row.createEl('a', { text: name, href: url }); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener');
      row.createSpan({ text: t(key as 'fontsGoogle'), cls: 'qc-hint' });
    }
    this.off = fonts.onChange(() => { if (this.tab === 'fonts' && this.containerEl.isConnected && !this.containerEl.contains(doc.activeElement)) this.display(); });
  }

  /* ---------- AI designer ---------- */
  private source(): Source { const ai = this.plugin.settings.ai; return !ai.enabled ? 'off' : ai.protocol === 'codex' ? 'codex' : 'api'; }
  private pickSource(next: Source): void {
    const ai = this.plugin.settings.ai; this.testLine = undefined;
    if (next === 'off') ai.enabled = false;
    else {
      ai.enabled = true;
      if (next === 'codex') { ai.preset = 'codex'; ai.protocol = 'codex'; ai.imageEngine = 'codex'; }
      else if (ai.protocol === 'codex') { const p = PROVIDER_PRESETS.find(x => x.id === 'deepseek')!; ai.preset = p.id; ai.protocol = p.protocol; ai.baseUrl = p.baseUrl; ai.model = p.model; ai.imageEngine = 'api'; }
    }
    this.save(); this.display();
  }
  private detect(): void {
    if (this.codex === 'checking') return; this.codex = 'checking';
    void detectCodex(this.plugin.settings.ai.codexBin).then(info => { this.codex = info; }, () => { this.codex = 'missing'; }).finally(() => { if (this.tab === 'assistant' && this.containerEl.isConnected) this.display(); });
  }

  private assistantTab(body: HTMLElement): void {
    const t = this.t; const ai = this.plugin.settings.ai; const source = this.source(); const zh = this.plugin.isZh();
    if (source === 'codex' && this.codex === undefined) this.detect();

    // Is it working? Answered first, in one line.
    const ready = this.plugin.ai.ready(); const imgOn = this.plugin.ai.imageReady();
    const name = source === 'codex' ? 'Codex CLI' : ai.model || ai.preset;
    const bar = ready ? statusBar(body, 'ok', t('aiS_ok', { name }), t('aiS_okDetail', { image: imgOn ? t('aiS_imgOn') : t('aiS_imgOff') }))
      : source === 'off' ? statusBar(body, 'off', t('aiS_off'), t('aiS_offDetail'))
        : source === 'codex' ? statusBar(body, 'warn', this.codex === 'checking' || this.codex === undefined ? t('aiS_checking') : t('aiS_noCodex'), t('aiS_noCodexDetail'))
          : statusBar(body, 'warn', t('aiS_noKey'), t('aiS_noKeyDetail'));
    if (source === 'codex' || source === 'api') textButton(bar.action, t('aiTest'), () => this.runTest(bar.el), 'qc-btn-sm', 'plug-zap');
    if (this.testLine) bar.el.createDiv({ text: this.testLine.text, cls: `qcs-status-test is-${this.testLine.tone}` });

    // Saved layout models: switch between them here or from the chip above the composer.
    const saved = section(body, zh ? '排版模型' : 'Layout models', zh ? '可以存多个，随时在设计面板里切换。点“新增”会复制当前这个，改一改就是新的。' : 'Keep several and switch from the designer panel. New copies the current one.');
    this.profileChips(saved, ai.chats.map(x => ({ id: x.id, label: chatLabel(x.id === ai.chatId ? { preset: ai.preset, protocol: ai.protocol, baseUrl: ai.baseUrl, apiKey: ai.apiKey, model: ai.model, codexBin: ai.codexBin, codexModel: ai.codexModel } : x.snap) })), ai.chatId,
      id => { switchChat(ai, id); this.testLine = undefined; this.codex = undefined; this.save(); this.display(); }, () => new ModelDialog(this.plugin, 'chat', () => { this.codex = undefined; this.display(); }).open(), id => { removeChat(ai, id); this.save(); this.display(); },
      id => { const x = ai.chats.find(c => c.id === id); if (x) new ModelDialog(this.plugin, 'chat', () => { this.codex = undefined; this.display(); }, { id, snap: id === ai.chatId ? { preset: ai.preset, protocol: ai.protocol, baseUrl: ai.baseUrl, apiKey: ai.apiKey, model: ai.model, codexBin: ai.codexBin, codexModel: ai.codexModel } : x.snap }).open(); });

    // 1 — who designs
    const pick = section(body, t('aiS_pickTitle'), t('aiS_pickDesc'), 1);
    choiceCards<Source>(pick, [
      { value: 'codex', icon: 'terminal', badge: t('aiS_recommended'), title: t('aiS_codex'), desc: t('aiS_codexDesc') },
      { value: 'api', icon: 'key-round', title: t('aiS_api'), desc: t('aiS_apiDesc') },
      { value: 'off', icon: 'pencil-ruler', title: t('aiS_none'), desc: t('aiS_noneDesc') },
    ], source, v => this.pickSource(v));

    // 2 — connect
    if (source === 'codex') {
      const conn = section(body, t('aiS_connectTitle'), undefined, 2);
      const info = this.codex; const found = info && info !== 'missing' && info !== 'checking' ? info : undefined;
      new Row(conn, t('aiS_codexStatus'), found ? t('aiS_codexFound', { version: found.version ?? '?', path: found.path }) : info === 'checking' || info === undefined ? t('aiS_checking') : t('aiS_codexMissing'))
        .addButton(b => b.setButtonText(t('aiS_recheck')).onClick(() => { this.codex = undefined; this.display(); }));
      const adv = more(conn, t('s_advanced'));
      new Row(adv, t('aiCodexBin'), t('aiCodexBinDesc')).addText(x => x.setPlaceholder('~/.local/bin/codex').setValue(ai.codexBin).onChange(v => { ai.codexBin = v.trim(); this.save(); }));
      new Row(adv, t('aiCodexModel'), t('aiCodexModelDesc')).addText(x => x.setValue(ai.codexModel).onChange(v => { ai.codexModel = v.trim(); this.save(); }));
    } else if (source === 'api') {
      const conn = section(body, t('aiS_connectTitle'), undefined, 2);
      new Row(conn, t('aiProvider'), t('aiS_providerDesc')).addDropdown(d => {
        for (const p of PROVIDER_PRESETS.filter(x => x.protocol !== 'codex')) d.addOption(p.id, p.name);
        d.setValue(ai.preset).onChange(id => {
          const p = PROVIDER_PRESETS.find(x => x.id === id); if (!p) return;
          ai.preset = id; ai.protocol = p.protocol; if (p.baseUrl) ai.baseUrl = p.baseUrl; if (p.model) ai.model = p.model; if (p.imageModel) ai.imageModel = p.imageModel; this.testLine = undefined; this.save(); this.display();
        });
      });
      new Row(conn, t('aiKey'), t('aiS_keyDesc')).addText(x => { x.inputEl.type = 'password'; x.inputEl.autocomplete = 'off'; x.setPlaceholder('sk-…').setValue(ai.apiKey).onChange(v => { ai.apiKey = v.trim(); this.save(); }); });
      const adv = more(conn, t('s_advanced'));
      new Row(adv, t('aiBase'), t('aiS_baseDesc')).addText(x => x.setPlaceholder('https://api.openai.com/v1').setValue(ai.baseUrl).onChange(v => { ai.baseUrl = v.trim(); this.save(); }));
      new Row(adv, t('aiModelName'), t('aiModelNameDesc')).addText(x => x.setValue(ai.model).onChange(v => { ai.model = v.trim(); this.save(); }));
    }

    // 3 — pictures: any number of saved picture models, each with its own engine
    if (source !== 'off') {
      const pics = section(body, t('aiS_imageTitle'), t('aiS_imageDesc'), 3);
      this.profileChips(pics, ai.images.map(x => ({ id: x.id, label: imageLabel(x.id === ai.imageId ? { imageOn: ai.imageOn, imageEngine: ai.imageEngine, imageBaseUrl: ai.imageBaseUrl, imageKey: ai.imageKey, imageModel: ai.imageModel, imageSize: ai.imageSize } : x.snap) })), ai.imageId,
        id => { switchImage(ai, id); this.save(); this.display(); }, () => new ModelDialog(this.plugin, 'image', () => this.display()).open(), id => { removeImage(ai, id); this.save(); this.display(); },
        id => { const x = ai.images.find(c => c.id === id); if (x) new ModelDialog(this.plugin, 'image', () => this.display(), { id, snap: id === ai.imageId ? { imageOn: ai.imageOn, imageEngine: ai.imageEngine, imageBaseUrl: ai.imageBaseUrl, imageKey: ai.imageKey, imageModel: ai.imageModel, imageSize: ai.imageSize } : x.snap }).open(); });
      new Row(pics, t('aiS_imageToggle'), t('aiS_imageToggleDesc')).addToggle(x => x.setValue(ai.imageOn).onChange(v => { ai.imageOn = v; this.save(); this.display(); }));
      if (ai.imageOn) {
        new Row(pics, t('aiImageEngine'), zh ? '用哪家的生图服务。' : 'Which picture service to use.').addDropdown(d => {
          for (const e of IMAGE_ENGINES) d.addOption(e.id, zh ? e.zh : e.en);
          d.setValue(ai.imageEngine).onChange(v => {
            const e = IMAGE_ENGINES.find(x => x.id === v); if (!e) return;
            ai.imageEngine = e.id; ai.imageBaseUrl = e.id === 'api' ? ai.imageBaseUrl : e.baseUrl; ai.imageModel = e.model || ai.imageModel; this.save(); this.display();
          });
        });
        if (ai.imageEngine !== 'codex') {
          const e = IMAGE_ENGINES.find(x => x.id === ai.imageEngine);
          new Row(pics, t('aiKey'), zh ? `这个生图服务的密钥${e?.hint ? `（${e.hint}）` : ''}。只保存在本机。` : 'API key for this service. Stored on this machine only.').addText(x => { x.inputEl.type = 'password'; x.inputEl.autocomplete = 'off'; x.setPlaceholder('API key').setValue(ai.imageKey).onChange(v => { ai.imageKey = v.trim(); this.save(); }); });
          new Row(pics, t('aiImageModel'), zh ? '模型名可以改成该平台当前可用的任意生图模型。' : 'Any picture model the service offers.').addText(x => x.setValue(ai.imageModel).onChange(v => { ai.imageModel = v.trim(); this.save(); }));
          const adv = more(pics, t('s_advanced'));
          new Row(adv, t('aiImageBase'), zh ? '自定义中转或代理时修改；留空用默认地址。' : 'Change for a custom relay.').addText(x => x.setPlaceholder(e?.baseUrl ?? ai.baseUrl).setValue(ai.imageBaseUrl).onChange(v => { ai.imageBaseUrl = v.trim(); this.save(); }));
          if (ai.imageEngine === 'api') new Row(adv, t('aiImageSize')).addDropdown(d => d.addOptions({ auto: t('aiImageSizeAuto'), '1024x1024': '1024×1024', '1536x1024': '1536×1024', '1024x1536': '1024×1536' }).setValue(ai.imageSize).onChange(v => { ai.imageSize = v as typeof ai.imageSize; this.save(); }));
        }
      }
    }

    // Reassurance and developer notes stay folded
    const foot = body.createDiv('qcs-foot');
    const privacy = more(foot, t('aiS_privacyTitle')); privacy.createDiv({ text: t('aiS_privacy'), cls: 'qcs-note' });
    const dev = more(foot, t('assistantApi'));
    dev.createDiv({ text: t('assistantApiDesc'), cls: 'qcs-note' });
    for (const p of this.plugin.assistantList()) new Row(dev, p.name, p.id === 'offline' ? t('assistantOfflineDesc') : p.id === 'ai' ? (zh ? '内置，使用上面的设置。' : 'Built in, uses the settings above.') : t('assistantExternalDesc'));
    dev.createEl('pre', { cls: 'qc-code', text: "app.plugins.plugins['qiaomu-cover-design'].registerAssistant({\n  id: 'my-model', name: 'My model',\n  async run({ prompt, fonts, size, canvas }) {\n    return { reply: 'Done', ops: [{ op: 'design', platform: 'youtube', template: 'impact', title: 'AI IN 10 MIN', badge: 'NEW' }] };\n  },\n});" });
  }

  /** A row of saved models as pills: click to use, x to delete, plus a button to add. */
  private profileChips(parent: HTMLElement, items: { id: string; label: string }[], activeId: string, pick: (id: string) => void, add: () => void, remove: (id: string) => void, edit: (id: string) => void): void {
    const row = parent.createDiv('qcs-profiles');
    for (const it of items) {
      const chip = row.createDiv({ cls: `qcs-profile${it.id === activeId ? ' is-active' : ''}` });
      const b = chip.createEl('button', { cls: 'qcs-profile-main', text: it.label, attr: { type: 'button' } }); b.addEventListener('click', () => { if (it.id !== activeId) pick(it.id); });
      const pen = chip.createEl('button', { cls: 'qcs-profile-x', attr: { type: 'button', 'aria-label': 'Edit' } }); setIcon(pen, 'pencil'); pen.addEventListener('click', () => edit(it.id));
      if (items.length > 1) { const x = chip.createEl('button', { cls: 'qcs-profile-x', attr: { type: 'button', 'aria-label': 'Delete' } }); setIcon(x, 'x'); x.addEventListener('click', () => remove(it.id)); }
    }
    const plus = row.createEl('button', { cls: 'qcs-profile-add', attr: { type: 'button' } }); setIcon(plus.createSpan(), 'plus'); plus.createSpan({ text: this.plugin.isZh() ? '添加模型' : 'Add model' }); plus.addEventListener('click', add);
  }

  private runTest(bar: HTMLElement): void {
    const t = this.t; this.testLine = { tone: 'warn', text: t('aiTesting') }; bar.querySelector('.qcs-status-test')?.remove();
    const line = bar.createDiv({ text: t('aiTesting'), cls: 'qcs-status-test is-warn' });
    void this.plugin.ai.ping().then(reply => { this.testLine = { tone: 'ok', text: t('aiTestOk', { reply }) }; if (this.plugin.settings.assistant !== 'ai') { this.plugin.settings.assistant = 'ai'; this.save(); } })
      .catch((e: unknown) => { this.testLine = { tone: 'warn', text: t('aiTestFail', { message: this.friendly(e) }) }; })
      .finally(() => { if (line.isConnected) { line.setText(this.testLine!.text); line.className = `qcs-status-test is-${this.testLine!.tone}`; } });
  }
  /** Turns the usual failures into a sentence that says what to do next. */
  private friendly(e: unknown): string {
    const m = e instanceof Error ? e.message : String(e); const t = this.t;
    if (/codex-missing/.test(m)) return t('aiE_codex');
    if (/401|403|invalid api key|unauthorized|incorrect api key/i.test(m)) return t('aiE_key');
    if (/404/.test(m)) return t('aiE_base');
    if (/429|rate|quota/i.test(m)) return t('aiE_quota');
    if (/ENOTFOUND|ECONN|network|failed to fetch|timed out/i.test(m)) return t('aiE_net');
    return m;
  }

  /* ---------- about ---------- */
  private about(body: HTMLElement): void {
    const t = this.t; const zh = this.plugin.isZh(); const repo = 'https://github.com/joeseesun/qiaomu-cover-design';
    const link = (parent: HTMLElement, label: string, href: string, icon?: string): HTMLAnchorElement => {
      const a = parent.createEl('a', { href, cls: icon ? 'qcs-about-action' : 'qcs-about-link', attr: { target: '_blank', rel: 'noopener noreferrer' } });
      if (icon) setIcon(a.createSpan({ attr: { 'aria-hidden': 'true' } }), icon); a.createSpan({ text: label }); return a;
    };
    const hero = body.createDiv('qcs-about-hero'); const rel = hero.createDiv('qcs-about-release');
    rel.createSpan({ text: zh ? '当前版本' : 'Version', cls: 'qcs-about-label' }); rel.createSpan({ text: `Qiaomu Cover Design  v${this.plugin.manifest.version}`, cls: 'qcs-about-version' });
    const actions = hero.createDiv('qcs-about-actions');
    link(actions, zh ? '更新日志' : 'Changelog', `${repo}/releases`, 'history'); link(actions, zh ? '反馈问题' : 'Report a bug', `${repo}/issues/new`, 'bug'); link(actions, zh ? '使用说明' : 'Readme', `${repo}#readme`, 'book-open');
    const help = section(body, t('s_help'));
    new Row(help, t('shortcuts')).addButton(b => b.setButtonText(zh ? '查看' : 'View').onClick(() => new ShortcutsModal(this.plugin).open()));
    const support = body.createDiv('qcs-about-support');
    const qr = (icon: string, title: string, hint: string, src: string, alt: string): void => {
      const fig = support.createEl('figure', { cls: 'qcs-about-qr' }); const frame = fig.createDiv('qcs-about-qr-image');
      const img = frame.createEl('img', { attr: { src, alt, loading: 'lazy', width: '148', height: '148' } }); img.addEventListener('error', () => { frame.empty(); frame.createDiv({ text: zh ? '二维码暂时加载不出来，可访问 qiaomu.ai' : 'QR unavailable offline. Visit qiaomu.ai', cls: 'qcs-about-qr-fallback' }); });
      const cap = fig.createEl('figcaption'); const ttl = cap.createDiv('qcs-about-qr-title'); setIcon(ttl.createSpan({ attr: { 'aria-hidden': 'true' } }), icon); ttl.createSpan({ text: title }); cap.createDiv({ text: hint, cls: 'qcs-about-qr-hint' });
    };
    qr('newspaper', zh ? '关注公众号' : 'Follow on WeChat', zh ? '微信搜索「向阳乔木推荐看」' : 'Search 「向阳乔木推荐看」 in WeChat', 'https://radio.qiaomu.ai/assets/qiaomu_wechat_public_account_qr.jpg', zh ? '向阳乔木推荐看公众号二维码' : 'WeChat official account QR');
    qr('coffee', zh ? '请我喝杯咖啡' : 'Buy me a coffee', zh ? '微信扫码，支持持续更新' : 'Scan with WeChat to support updates', 'https://radio.qiaomu.ai/assets/qiaomu_reward_qr.png', zh ? '向阳乔木打赏二维码' : 'Reward QR');
    const foot = body.createDiv('qcs-about-footer'); const links = foot.createDiv('qcs-about-links');
    for (const [name, href] of [['qiaomu.ai', 'https://qiaomu.ai/'], [zh ? '博客' : 'Blog', 'https://blog.qiaomu.ai/'], ['X', 'https://x.com/vista8'], ['GitHub', 'https://github.com/joeseesun'], [zh ? '邮箱' : 'Email', 'mailto:vista8@gmail.com']] as const) link(links, name, href);
    foot.createEl('p', { text: t('privacyDesc'), cls: 'qcs-note' });
  }
}
