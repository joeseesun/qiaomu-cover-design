import { App, Notice, PluginSettingTab, setIcon, Setting } from 'obsidian';
import type CoverPlugin from './main';
import { folderPath } from './model';
import { GROUPS, PLATFORMS } from './platforms';
import { FONT_SITES } from './fontbrowser';
import { ShortcutsModal } from './modals';
import { bytes, textButton } from './ui';

export type SettingsTab = 'general' | 'export' | 'fonts' | 'assistant' | 'about';
const TABS: SettingsTab[] = ['general', 'export', 'fonts', 'assistant', 'about'];

export class CoverSettings extends PluginSettingTab {
  tab: SettingsTab = 'general'; private off?: () => void;
  constructor(app: App, private plugin: CoverPlugin) { super(app, plugin); }
  hide(): void { this.off?.(); this.off = undefined; }
  private get t(): CoverPlugin['t'] { return this.plugin.t.bind(this.plugin); }
  private save(): void { void this.plugin.saveSettings().catch(e => this.plugin.report(e)); }

  display(): void {
    const el = this.containerEl; el.empty(); el.addClass('qc-settings'); this.off?.();
    const head = el.createDiv('qc-settings-head'); const id = head.createDiv('qc-settings-identity');
    setIcon(id.createSpan(), 'image'); id.createSpan({ text: 'Qiaomu Cover Design', cls: 'qc-settings-name' }); id.createSpan({ text: `v${this.plugin.manifest.version}`, cls: 'qc-settings-version' });
    const tabs = head.createDiv('qc-settings-tabs');
    for (const tab of TABS) {
      const b = tabs.createEl('button', { cls: 'qc-settings-tab', attr: { type: 'button' } }); b.setText(this.t(`set_${tab}` as 'set_general')); b.classList.toggle('is-active', this.tab === tab);
      b.addEventListener('click', () => { this.tab = tab; this.display(); });
    }
    const body = el.createDiv('qc-settings-body');
    ({ general: () => this.general(body), export: () => this.exportTab(body), fonts: () => this.fontsTab(body), assistant: () => this.assistantTab(body), about: () => this.about(body) })[this.tab]();
  }

  private folderSetting(parent: HTMLElement, name: string, desc: string, get: () => string, set: (v: string) => void): void {
    new Setting(parent).setName(name).setDesc(desc).addText(text => text.setValue(get()).onChange(value => {
      try { set(folderPath(value)); this.save(); text.inputEl.removeClass('qc-invalid'); } catch { text.inputEl.addClass('qc-invalid'); }
    }));
  }
  private heading(parent: HTMLElement, name: string, desc?: string): void { const s = new Setting(parent).setName(name).setHeading(); if (desc) s.setDesc(desc); }

  private general(body: HTMLElement): void {
    const s = this.plugin.settings; const t = this.t;
    new Setting(body).setName(t('language')).setDesc(t('restart')).addDropdown(d => d.addOptions({ auto: t('auto'), zh: '中文', en: 'English' }).setValue(s.language).onChange(v => { s.language = v; this.save(); }));
    new Setting(body).setName(t('defaultPlatform')).setDesc(t('defaultPlatformDesc')).addDropdown(d => {
      for (const g of GROUPS) for (const p of PLATFORMS.filter(x => x.group === g.id)) d.addOption(p.id, `${this.plugin.isZh() ? p.zh : p.en} · ${p.width}×${p.height}`);
      d.setValue(s.defaultPlatform).onChange(v => { s.defaultPlatform = v; this.save(); });
    });
    this.folderSetting(body, t('designFolder'), t('designFolderDesc'), () => s.designFolder, v => { s.designFolder = v; });
    this.heading(body, t('guidesDefault'));
    new Setting(body).setName(t('centerLines')).addToggle(x => x.setValue(s.guides.center).onChange(v => { s.guides.center = v; this.save(); }));
    new Setting(body).setName(t('snap')).setDesc(t('snapDesc')).addToggle(x => x.setValue(s.guides.snap).onChange(v => { s.guides.snap = v; this.save(); }));
    new Setting(body).setName(t('safeZone')).setDesc(t('safeZoneDesc')).addToggle(x => x.setValue(s.guides.safe).onChange(v => { s.guides.safe = v; this.save(); }));
  }

  private exportTab(body: HTMLElement): void {
    const s = this.plugin.settings; const t = this.t; const e = s.export;
    this.heading(body, t('exportDefaults'), t('exportDefaultsDesc'));
    new Setting(body).setName(t('destination')).addDropdown(d => d.addOptions({ folder: t('destFolder'), note: t('destNote'), system: t('destSystem') }).setValue(e.destination ?? 'folder').onChange(v => { e.destination = v as 'folder'; this.save(); this.display(); }));
    if ((e.destination ?? 'folder') === 'system') {
      new Setting(body).setName(t('destSystem')).setDesc(t('destSystemHint')).addText(x => x.setPlaceholder('~/Downloads').setValue(e.systemDir ?? '').onChange(v => { e.systemDir = v.trim(); this.save(); }))
        .addButton(b => b.setButtonText(t('choose')).onClick(() => void this.plugin.chooseSystemFolder(this.containerEl.ownerDocument).then(p => { if (p) { e.systemDir = p; this.save(); this.display(); } })));
    } else this.folderSetting(body, t('exportFolder'), t('exportFolderDesc'), () => s.exportFolder, v => { s.exportFolder = v; });
    new Setting(body).setName(t('format')).addDropdown(d => d.addOptions({ png: 'PNG', jpeg: 'JPEG', webp: 'WebP' }).setValue(e.format ?? 'png').onChange(v => { e.format = v as 'png'; this.save(); }));
    new Setting(body).setName(t('exportSize')).addDropdown(d => d.addOptions({ '1': '1×', '2': '2×', '3': '3×' }).setValue(String(e.scale ?? 1)).onChange(v => { e.scale = Number(v); this.save(); }));
    new Setting(body).setName(t('quality')).setDesc(t('qualityDesc')).addSlider(x => x.setLimits(40, 100, 1).setValue(Math.round((e.quality ?? 0.92) * 100)).setDynamicTooltip().onChange(v => { e.quality = v / 100; this.save(); }));
    new Setting(body).setName(t('filename')).setDesc(t('filenameHint')).addText(x => x.setValue(e.filename ?? '{name}-{platform}').onChange(v => { e.filename = v.trim() || '{name}-{platform}'; this.save(); }));
    new Setting(body).setName(t('fitLimitShort')).setDesc(t('fitLimitDesc')).addToggle(x => x.setValue(e.fitLimit ?? true).onChange(v => { e.fitLimit = v; this.save(); }));
  }

  private fontsTab(body: HTMLElement): void {
    const s = this.plugin.settings; const t = this.t; const fonts = this.plugin.fonts; const doc = this.containerEl.ownerDocument;
    this.folderSetting(body, t('fontFolder'), t('fontFolderDesc'), () => s.fontFolder, v => { s.fontFolder = v; void fonts.loadVault(doc).then(() => this.display()); });
    this.heading(body, t('fontsInstalled'), t('fontsInstalledDesc'));
    const picker = doc.createElement('input'); picker.type = 'file'; picker.multiple = true; picker.accept = '.ttf,.otf,.woff,.woff2';
    picker.addEventListener('change', () => void fonts.importFiles(Array.from(picker.files ?? []), doc).then(added => { new Notice(added.length ? t('fontsImported', { names: added.join(', ') }) : t('fontsNone')); this.display(); }).catch(err => this.plugin.report(err)));
    new Setting(body).setName(t('fontImport')).setDesc(t('fontHint')).addButton(b => b.setButtonText(t('fontImportBtn')).setCta().onClick(() => picker.click()));
    const list = body.createDiv('qc-font-files');
    const files = fonts.files();
    if (!files.length) list.createDiv({ text: t('fontEmptyVault'), cls: 'qc-empty-note' });
    for (const f of files) {
      const row = list.createDiv('qc-font-file'); const sample = row.createSpan({ text: '封面 Aa', cls: 'qc-font-file-sample' }); sample.style.fontFamily = `"${f.family}", sans-serif`;
      row.createSpan({ text: f.family, cls: 'qc-font-file-name' }); row.createSpan({ text: `${f.ext.toUpperCase()} · ${bytes(f.size)}`, cls: 'qc-hint' });
      textButton(row, t('remove'), () => void fonts.remove(f.family, doc).then(() => this.display()).catch(err => this.plugin.report(err)), 'qc-btn-sm', 'trash-2');
    }
    this.heading(body, t('fontsSystem'));
    const state = fonts.state;
    new Setting(body).setName(t('fontsSystemStatus')).setDesc(state === 'ok' ? t('fontCount', { n: fonts.system.length, v: fonts.vault.length }) : state === 'idle' ? t('fontScanning') : t('fontLimited'))
      .addButton(b => b.setButtonText(t('fontRefresh')).onClick(() => void fonts.scanSystem(doc, true).then(() => this.display())));
    new Setting(body).setName(t('fontInstallGuide')).setDesc(t('fontInstallSteps'));
    this.heading(body, t('fontGet'), t('fontLicense'));
    const links = body.createDiv('qc-links');
    for (const [name, url, key] of FONT_SITES) {
      const row = links.createDiv('qc-link-row'); const a = row.createEl('a', { text: name, href: url }); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener');
      row.createSpan({ text: t(key as 'fontsGoogle'), cls: 'qc-hint' });
    }
    this.off = fonts.onChange(() => { if (this.tab === 'fonts' && this.containerEl.isConnected && !this.containerEl.contains(doc.activeElement)) this.display(); });
  }

  private assistantTab(body: HTMLElement): void {
    const t = this.t; const providers = this.plugin.assistantList();
    const card = body.createDiv('qc-card'); setIcon(card.createDiv('qc-card-icon'), 'sparkles');
    const text = card.createDiv('qc-card-text'); text.createEl('h3', { text: t('assistantSoon') }); text.createEl('p', { text: t('assistantSoonDesc') });
    this.heading(body, t('assistantProviders'));
    for (const p of providers) new Setting(body).setName(p.name).setDesc(p.id === 'offline' ? t('assistantOfflineDesc') : t('assistantExternalDesc'));
    this.heading(body, t('assistantApi'), t('assistantApiDesc'));
    body.createEl('pre', { cls: 'qc-code', text: "app.plugins.plugins['qiaomu-cover-design'].registerAssistant({\n  id: 'my-model', name: 'My model',\n  async run({ prompt, fonts, size }) {\n    return { reply: 'Done', ops: [{ op: 'platform', id: 'youtube' }, { op: 'template', id: 'dark' }] };\n  },\n});" });
  }

  private about(body: HTMLElement): void {
    const t = this.t;
    const hero = body.createDiv('qc-card'); setIcon(hero.createDiv('qc-card-icon'), 'image');
    const text = hero.createDiv('qc-card-text'); text.createEl('h3', { text: 'Qiaomu Cover Design' }); text.createEl('p', { text: t('aboutLine', { version: this.plugin.manifest.version }) });
    new Setting(body).setName(t('shortcuts')).addButton(b => b.setButtonText(t('open')).onClick(() => new ShortcutsModal(this.plugin).open()));
    new Setting(body).setName(t('feedback')).setDesc('GitHub Issues').addButton(b => b.setButtonText('GitHub').onClick(() => window.open('https://github.com/joeseesun/qiaomu-cover-design/issues')));
    this.heading(body, t('privacy'), t('privacyDesc'));
  }
}
