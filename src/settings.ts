import { App, Notice, PluginSettingTab, SecretComponent, setIcon } from 'obsidian';
import type CoverPlugin from './main';
import { folderPath } from './model';
import { GROUPS, PLATFORMS } from './platforms';
import { FONT_SITES } from './fontbrowser';
import { CodexInfo, detectCodex } from './codex';
import { ModelDialog } from './modeldialog';
import { chatLabel, imageLabel, removeChat, removeImage, switchChat, switchImage, pickChat, pickImage, aiReady, imageReady, type ChatSnap, type ImageSnap } from './aiparse';
import { FONT_PACKS } from './fontlib';
import { installPack, packMissing } from './fontpack';
import { FontLibraryModal, ShortcutsModal } from './modals';
import { bytes, textButton, iconButton } from './ui';
import { more, Row, section, statusBar } from './settingsui';

export type SettingsTab = 'general' | 'export' | 'fonts' | 'assistant' | 'about';
const TABS: { id: SettingsTab; icon: string }[] = [{ id: 'general', icon: 'sliders-horizontal' }, { id: 'export', icon: 'download' }, { id: 'fonts', icon: 'type' }, { id: 'assistant', icon: 'sparkles' }, { id: 'about', icon: 'info' }];
import { chatSourceOf, imageSourceOf } from './catalog';

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
    const ui = section(body, zh ? '界面' : 'Interface');
    new Row(ui, zh ? '顶部插入工具' : 'Top insertion tools', zh ? '仅图标更简洁；悬停查看名称。图标和文字更适合初次使用。' : 'Icons keep the toolbar compact; hover for labels. Text labels help you learn the tools.').addDropdown(d => d.addOptions(zh ? { icons: '仅图标', labels: '图标和文字' } : { icons: 'Icons only', labels: 'Icons and text' }).setValue(s.toolbarLabels ? 'labels' : 'icons').onChange(value => { s.toolbarLabels = value === 'labels'; this.save(); for (const leaf of this.app.workspace.getLeavesOfType('qiaomu-cover-design')) (leaf.view as { refreshToolbar?: () => void }).refreshToolbar?.(); }));
    const photos = section(body, zh ? '背景图素材' : 'Background photos', zh ? '在顶部“插入其他 → 背景图”里搜索 Unsplash 的免费摄影。需要你自己的免费 Access Key。' : 'Search Unsplash photos from More → Photos. Needs your own free Access Key.');
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
    const s = this.plugin.settings, t = this.t, fonts = this.plugin.fonts, doc = this.containerEl.ownerDocument, zh = this.plugin.isZh();
    const state = fonts.libraryState(), bar = statusBar(body, state.ready === state.total ? 'ok' : 'warn', zh ? `内置字库 ${state.ready}/${state.total} 款已就绪` : `Built-in library: ${state.ready}/${state.total} ready`, zh ? '内置字体在画布的字体选择器里使用，无需逐个安装。' : 'Built-in fonts are available in the canvas font picker; no individual installation needed.');
    const browse = section(body, zh ? '选择与添加字体' : 'Choose and add fonts', zh ? '在字体库中预览和选择，或导入你自己的字体。' : 'Preview the font library or import your own fonts.');
    const actions = browse.createDiv('qcs-font-actions'); textButton(actions, t('fontLibOpen'), () => new FontLibraryModal(this.plugin, doc, () => this.display()).open(), 'qc-primary', 'type');
    const picker = doc.createElement('input'); picker.type = 'file'; picker.multiple = true; picker.accept = '.ttf,.otf,.woff,.woff2';
    picker.addEventListener('change', () => void fonts.importFiles(Array.from(picker.files ?? []), doc).then(added => { new Notice(added.length ? t('fontsImported', { names: added.join(', ') }) : t('fontsNone')); this.display(); }).catch(err => this.plugin.report(err)));
    textButton(actions, t('fontImportBtn'), () => picker.click(), '', 'upload');
    const repair = textButton(bar.action, zh ? '补齐字库' : 'Complete library', () => void fonts.syncLibrary(() => this.plugin.repairOpenCovers()).catch(e => this.plugin.report(e)), 'qc-btn-sm', 'refresh-cw'); repair.toggleClass('qc-hidden', state.ready === state.total);
    const mine = section(body, zh ? '我添加的字体' : 'My added fonts', zh ? '只显示额外导入或下载到库内的字体。' : 'Only additional imported or downloaded vault fonts.');
    const list = mine.createDiv('qc-font-files'), files = fonts.files().filter(f => !fonts.hasBundled(f.family));
    if (!files.length) list.createDiv({ text: zh ? '还没有额外字体，内置字库已足够开始设计。' : 'No additional fonts yet. The built-in library is enough to start.', cls: 'qc-empty-note' });
    for (const f of files) {
      const row = list.createDiv('qc-font-file'), sample = row.createSpan({ text: '封面 Aa', cls: 'qc-font-file-sample' }); sample.style.fontFamily = `"${f.family}", sans-serif`;
      row.createSpan({ text: f.family, cls: 'qc-font-file-name' }); row.createSpan({ text: `${f.ext.toUpperCase()} · ${bytes(f.size)}`, cls: 'qc-hint' });
      iconButton(row, 'trash-2', t('remove'), () => void fonts.remove(f.family, doc).then(() => this.display()).catch(e => this.plugin.report(e)));
    }
    const extraPacks = FONT_PACKS.filter(pk => packMissing(this.plugin, pk.id) > 0);
    if (extraPacks.length) {
      const extras = more(body, zh ? '更多可选字体包' : 'Additional font packs');
      for (const pk of extraPacks) { const left = packMissing(this.plugin, pk.id); new Row(extras, zh ? pk.zh : pk.en, zh ? `${left} 款尚未安装；已有字体不会重复下载。` : `${left} additional fonts; installed ones are skipped.`).addButton(b => b.setButtonText(zh ? '添加缺少的字体' : 'Add missing fonts').onClick(() => { b.setDisabled(true); void installPack(this.plugin, doc, pk.id).then(() => this.display()).catch(e => this.plugin.report(e)); })); }
    }
    const maintenance = more(body, zh ? '存储与系统字体' : 'Storage and system fonts');
    this.folderRow(maintenance, t('fontFolder'), t('fontFolderDesc'), () => s.fontFolder, value => { s.fontFolder = value; void fonts.loadVault(doc).then(() => this.display()); });
    new Row(maintenance, t('fontsSystemStatus'), fonts.state === 'ok' ? t('fontCount', { n: fonts.system.length, v: fonts.vault.length }) : fonts.state === 'idle' ? t('fontScanning') : t('fontLimited')).addButton(b => b.setButtonText(t('fontRefresh')).onClick(() => void fonts.scanSystem(doc, true).then(() => this.display())));
    const help = more(body, zh ? '字体来源与许可' : 'Font sources and licensing'); help.createDiv({ text: t('fontLicense'), cls: 'qcs-note' });
    const links = help.createDiv('qc-links'); for (const [name, url] of FONT_SITES) links.createEl('a', { text: name, href: url, attr: { target: '_blank', rel: 'noopener' } });
    this.off = fonts.onChange(() => { if (!bar.el.isConnected) return; const state = fonts.libraryState(); bar.el.querySelector('.qcs-status-main')!.setText(zh ? `内置字库 ${state.ready}/${state.total} 款已就绪` : `Built-in library: ${state.ready}/${state.total} ready`); repair.toggleClass('qc-hidden', state.ready === state.total); repair.disabled = state.running; });
  }

  /* ---------- AI designer ---------- */
  private detect(): void {
    if (this.codex === 'checking') return; this.codex = 'checking';
    void detectCodex(this.plugin.settings.ai.codexBin).then(info => { this.codex = info; }, () => { this.codex = 'missing'; }).finally(() => { const el = this.containerEl.querySelector('.qcs-cli-status .qcs-desc'); if (el) { const info = this.codex, found = info && info !== 'missing' && info !== 'checking' ? info : undefined; el.setText(found ? this.t('aiS_codexFound', { version: found.version ?? '?', path: found.path }) : this.t('aiS_codexMissing')); } });
  }

  private assistantTab(body: HTMLElement): void {
    const t = this.t, ai = this.plugin.settings.ai, zh = this.plugin.isZh();
    const toggle = new Row(body, zh ? '启用 AI 功能' : 'Enable AI', zh ? '管理排版和生图模型；关闭后保留所有配置。' : 'Manage layout and image models. Turning this off retains all configurations.');
    toggle.addToggle(x => x.setValue(ai.enabled).onChange(value => { ai.enabled = value; this.save(); this.display(); }));
    const bar = statusBar(body, !ai.enabled ? 'off' : this.plugin.ai.ready() ? 'ok' : 'warn', !ai.enabled ? t('aiS_off') : this.plugin.ai.ready() ? (zh ? '默认排版模型已配置' : 'Default layout model configured') : (zh ? '先添加一个排版模型' : 'Add a layout model to get started'), zh ? '配置完成不代表服务已连通；生图需选择已开通的模型。' : 'Configuration is not a connectivity check; image models must be activated by the provider.');
    if (ai.enabled && this.plugin.ai.ready()) textButton(bar.action, t('aiTest'), () => this.runTest(bar.el), 'qc-btn-sm', 'plug-zap');
    if (this.testLine) bar.el.createDiv({ text: this.testLine.text, cls: `qcs-status-test is-${this.testLine.tone}` });
    this.modelList(section(body, zh ? '排版模型' : 'Layout models', zh ? '用于文案、版式和画布编辑。按服务分组，选择一个默认模型。' : 'For copy, layouts and canvas edits. Organized by service; select your default.'), 'chat');
    const images = section(body, zh ? '生图模型' : 'Image models', zh ? '用于 AI 生图与图片修改，独立于排版模型。' : 'For image generation and editing, independent of layout models.');
    this.modelList(images, 'image');
    new Row(images, t('aiS_imageToggle'), zh ? '控制封面设计师的配图能力；直接“AI 生图”仍可选择已配置的模型。' : 'Controls pictures in the cover designer. Direct AI image generation can still use configured models.').addToggle(x => x.setValue(ai.imageOn).onChange(value => { ai.imageOn = value; this.save(); }));
    if (ai.protocol === 'codex' || ai.images.some(x => x.snap.imageEngine === 'codex')) {
      const local = more(body, zh ? '本机 Codex CLI' : 'Local Codex CLI');
      if (this.codex === undefined) this.detect();
      const info = this.codex, found = info && info !== 'missing' && info !== 'checking' ? info : undefined;
      const cliRow = new Row(local, t('aiS_codexStatus'), found ? t('aiS_codexFound', { version: found.version ?? '?', path: found.path }) : info === 'checking' || info === undefined ? t('aiS_checking') : t('aiS_codexMissing')).addButton(b => b.setButtonText(t('aiS_recheck')).onClick(() => { this.codex = undefined; this.display(); })); cliRow.el.addClass('qcs-cli-status');
      new Row(local, t('aiCodexBin'), t('aiCodexBinDesc')).addText(x => x.setPlaceholder('~/.local/bin/codex').setValue(ai.codexBin).onChange(value => { ai.codexBin = value.trim(); this.save(); }));
    }
    const foot = body.createDiv('qcs-foot'), privacy = more(foot, t('aiS_privacyTitle')); privacy.createDiv({ text: t('aiS_privacy'), cls: 'qcs-note' });
    const dev = more(foot, t('assistantApi')); dev.createDiv({ text: t('assistantApiDesc'), cls: 'qcs-note' });
    for (const provider of this.plugin.assistantList()) new Row(dev, provider.name, provider.id === 'offline' ? t('assistantOfflineDesc') : t('assistantExternalDesc'));
  }

  private modelList(parent: HTMLElement, kind: 'chat' | 'image'): void {
    const ai = this.plugin.settings.ai, zh = this.plugin.isZh(), active = kind === 'chat' ? ai.chatId : ai.imageId;
    const add = (): void => new ModelDialog(this.plugin, kind, () => { this.codex = undefined; this.display(); }).open();
    const tools = parent.createDiv('qcs-model-toolbar'), search = tools.createEl('input', { cls: 'qcs-model-search', attr: { type: 'search', placeholder: zh ? '查找名称或模型 ID…' : 'Find a name or model ID…' } });
    textButton(tools, zh ? '添加模型' : 'Add model', add, 'qc-btn-sm', 'plus');
    const list = parent.createDiv('qcs-model-list');
    const profiles = kind === 'chat' ? ai.chats : ai.images;
    const items = profiles.map(profile => {
      const snap = kind === 'chat' ? profile.id === ai.chatId ? pickChat(ai) : profile.snap as ChatSnap : profile.id === ai.imageId ? pickImage(ai) : profile.snap as ImageSnap;
      const source = kind === 'chat' ? chatSourceOf(snap as ChatSnap) : imageSourceOf(snap as ImageSnap), local = source.id === 'codex';
      const base = kind === 'chat' ? (snap as ChatSnap).baseUrl : (snap as ImageSnap).imageBaseUrl || (source.id === 'custom' ? ai.baseUrl : source.baseUrl);
      let host = ''; try { host = new URL(base).host; } catch { /* incomplete configuration */ }
      const model = kind === 'chat' ? local ? (snap as ChatSnap).codexModel : (snap as ChatSnap).model : local ? ai.codexModel : (snap as ImageSnap).imageModel;
      const ready = kind === 'chat' ? aiReady({ ...ai, ...snap as ChatSnap, enabled: true }) : imageReady({ ...ai, ...snap as ImageSnap, imageOn: true, enabled: true });
      return { id: profile.id, snap, label: kind === 'chat' ? chatLabel(snap as ChatSnap) : imageLabel(snap as ImageSnap), model, service: source.name, host, local, key: `${source.id}|${base}`, ready };
    }).sort((a, b) => Number(b.id === active) - Number(a.id === active));
    const draw = (): void => {
      list.empty(); const q = search.value.trim().toLowerCase(), groups = new Map<string, typeof items>();
      for (const item of items) if (!q || `${item.label} ${item.model} ${item.service} ${item.host}`.toLowerCase().includes(q)) { const group = groups.get(item.key) ?? []; group.push(item); groups.set(item.key, group); }
      if (!groups.size) list.createDiv({ text: zh ? '没有匹配的模型。' : 'No matching models.', cls: 'qc-empty-note' });
      for (const group of groups.values()) {
        const section = list.createDiv('qcs-model-service'), header = section.createDiv('qcs-model-service-head'), first = group[0]!;
        setIcon(header.createSpan(), first.local ? 'terminal' : 'cloud'); header.createSpan({ text: first.service }); if (first.host) header.createSpan({ text: first.host, cls: 'qc-hint' });
        for (const item of group) {
          const row = section.createDiv({ cls: `qcs-model-row${item.id === active ? ' is-active' : ''}`, attr: { 'data-profile': item.id } }), info = row.createDiv('qcs-model-info');
          const title = info.createDiv('qcs-model-title'); title.createSpan({ text: item.label }); if (item.id === active) title.createSpan({ text: zh ? '默认' : 'Default', cls: 'qcs-model-default' });
          info.createDiv({ text: `${item.model || (zh ? '默认模型' : 'Default model')} · ${item.ready ? zh ? '已配置' : 'Configured' : zh ? '待配置' : 'Needs setup'}`, cls: 'qcs-model-meta' });
          const actions = row.createDiv('qcs-model-actions');
          if (item.id !== active) textButton(actions, zh ? '设为默认' : 'Set default', () => { if (kind === 'chat') switchChat(ai, item.id); else switchImage(ai, item.id); this.testLine = undefined; this.codex = undefined; this.save(); this.display(); }, 'qc-btn-sm');
          iconButton(actions, 'pencil', zh ? '编辑模型' : 'Edit model', () => new ModelDialog(this.plugin, kind, () => { this.codex = undefined; this.display(); }, { id: item.id, snap: item.snap }).open());
          if (profiles.length > 1) iconButton(actions, 'trash-2', zh ? '删除模型' : 'Delete model', () => { if (kind === 'chat') removeChat(ai, item.id); else removeImage(ai, item.id); this.save(); this.display(); });
        }
      }
    }; search.addEventListener('input', draw); draw();
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
