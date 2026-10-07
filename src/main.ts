import { App, getLanguage, MarkdownView, Notice, Platform, Plugin, TFile, normalizePath } from 'obsidian';
import { Design, folderPath, safeName } from './model';
import { Key, translate } from './i18n';
import { homeProvider, HomeProvider, notifyHomeChanged } from './integrations/qiaomu-home';
import { DEFAULTS, mergeSettings, Settings } from './config';
import { FontService } from './fonts';
import { AssistantProvider, interpret } from './ops';
import { NewCoverModal, PickFile } from './modals';
import { CoverSettings, SettingsTab } from './settings';
import { PROPS, CoverView, VIEW } from './view';
import { platformById, DEFAULT_PLATFORM } from './platforms';
import { templateById } from './templates';
import { SerialWriter } from './model';

export default class CoverPlugin extends Plugin {
  qiaomuHome?: HomeProvider;
  settings: Settings = structuredClone(DEFAULTS); fonts!: FontService;
  private writer = new SerialWriter(); private assistants = new Map<string, AssistantProvider>(); private settingsTab?: CoverSettings; private fontTimer?: number;

  t(key: Key, params?: Record<string, string | number>): string { return translate(this.lang(), key, params); }
  lang(): string { return this.settings.language === 'auto' ? getLanguage() : this.settings.language; }
  isZh(): boolean { return this.lang().toLowerCase().startsWith('zh'); }
  report(error: unknown): void { new Notice(this.t('error', { message: error instanceof Error ? error.message : String(error) })); }

  /** Other plugins (or a model integration) call this to take over natural-language design. Returns a disposer. */
  registerAssistant(provider: AssistantProvider): () => void {
    this.assistants.set(provider.id, provider);
    return () => { this.assistants.delete(provider.id); };
  }
  assistantList(): AssistantProvider[] {
    const offline: AssistantProvider = { id: 'offline', name: this.t('assistantOffline'), run: input => Promise.resolve(interpret(input)) };
    return [offline, ...this.assistants.values()];
  }
  activeCover(): CoverView | undefined { return this.app.workspace.getActiveViewOfType(CoverView) ?? undefined; }

  async onload(): Promise<void> {
    this.settings = mergeSettings(await this.loadData());
    this.fonts = new FontService(this.app, () => this.settings.fontFolder);
    this.registerView(VIEW, leaf => new CoverView(leaf, this));
    this.registerExtensions(['qcover'], VIEW);
    this.app.workspace.onLayoutReady(() => { void this.fonts.loadVault(activeDocument); });
    const touchFonts = (file: unknown): void => {
      if (!(file instanceof TFile) || !file.path.startsWith(`${normalizePath(this.settings.fontFolder)}/`)) return;
      window.clearTimeout(this.fontTimer); this.fontTimer = window.setTimeout(() => void this.fonts.loadVault(activeDocument), 400);
    };
    this.registerEvent(this.app.vault.on('create', touchFonts)); this.registerEvent(this.app.vault.on('delete', touchFonts)); this.registerEvent(this.app.vault.on('modify', touchFonts));

    this.qiaomuHome = homeProvider({
      sections: () => [{ id: 'recent-covers', title: this.t('recent'), items: this.designs().slice(0, 6).map(file => ({ id: file.path, title: file.basename, icon: 'image', open: () => this.openDesign(file) })) }],
      actions: () => [{ id: 'new-cover', label: this.t('create'), icon: 'image-plus', run: () => this.openNew() }],
      search: (query, limit) => this.designs().filter(f => f.basename.toLowerCase().includes(query.toLowerCase())).slice(0, Math.max(0, limit)).map(file => ({ id: file.path, title: file.basename, icon: 'image', open: () => this.openDesign(file) })),
    });
    const notify = (file: unknown): void => { if (file instanceof TFile && file.extension === 'qcover') notifyHomeChanged(this.app, this.manifest.id); };
    this.registerEvent(this.app.vault.on('create', notify)); this.registerEvent(this.app.vault.on('modify', notify)); this.registerEvent(this.app.vault.on('delete', notify));

    this.addCommand({ id: 'new-cover', name: this.t('create'), callback: () => this.openNew() });
    this.addCommand({ id: 'open-designer', name: this.t('open'), callback: () => this.chooseDesign() });
    this.addCommand({ id: 'cover-from-note', name: this.t('fromNote'), checkCallback: checking => {
      const note = this.app.workspace.getActiveFile(); const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
      if (!note || note.extension !== 'md') return false;
      if (!checking) new NewCoverModal(this, note, editor?.getSelection() || note.basename).open();
      return true;
    } });
    this.addCommand({ id: 'export-active', name: this.t('quickExport'), checkCallback: checking => {
      const view = this.activeCover(); if (!view?.canvas) return false;
      if (!checking) void view.action(() => view.quickExport());
      return true;
    } });
    this.addRibbonIcon('image', this.t('open'), () => this.chooseDesign());
    this.settingsTab = new CoverSettings(this.app, this); this.addSettingTab(this.settingsTab);
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (file instanceof TFile && file.extension === 'md') menu.addItem(item => item.setTitle(this.t('fromNote')).setIcon('image').onClick(() => new NewCoverModal(this, file, file.basename).open()));
    }));
    this.registerEvent(this.app.vault.on('rename', (file, old) => {
      if (!(file instanceof TFile)) return;
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) {
        const view = leaf.view as CoverView;
        if (view.design?.source === old) { view.design.source = file.path; view.changed(); }
      }
    }));
    // Hide the host status bar only while a cover tab is in front.
    this.registerEvent(this.app.workspace.on('active-leaf-change', leaf => { document.body.toggleClass('qc-cover-active', leaf?.view.getViewType() === VIEW); }));
  }
  onunload(): void { document.body.removeClass('qc-cover-active'); window.clearTimeout(this.fontTimer); }

  openNew(note?: TFile, title = ''): void { new NewCoverModal(this, note, title).open(); }
  openSettings(tab?: SettingsTab): void {
    const setting = (this.app as App & { setting?: { open(): void; openTabById(id: string): void } }).setting;
    if (tab && this.settingsTab) this.settingsTab.tab = tab;
    setting?.open(); setting?.openTabById(this.manifest.id);
  }
  chooseDesign(): void {
    const files = this.designs();
    if (!files.length) { this.openNew(); return; }
    new PickFile(this.app, files, file => { void this.openDesign(file).catch(e => this.report(e)); }, this.t('chooseDesign')).open();
  }
  designs(): TFile[] { return this.app.vault.getFiles().filter(f => f.extension === 'qcover').sort((a, b) => b.stat.mtime - a.stat.mtime); }
  async openDesign(file: TFile): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW).find(l => (l.view as CoverView).file?.path === file.path);
    if (existing) { await this.app.workspace.revealLeaf(existing); return; }
    await this.app.workspace.getLeaf('tab').openFile(file);
  }
  async ensureFolder(path: string): Promise<void> {
    const parts = folderPath(path).split('/'); let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        try { await this.app.vault.createFolder(current); } catch (e) { if (!this.app.vault.getAbstractFileByPath(current)) throw e; }
      }
    }
  }
  unique(folder: string, name: string, extension: string): string {
    const base = normalizePath(folder ? `${folder}/${safeName(name)}` : safeName(name)); let path = `${base}.${extension}`; let i = 1;
    while (this.app.vault.getAbstractFileByPath(path)) path = `${base} ${i++}.${extension}`;
    return path;
  }
  async createDesign(name: string, template: string, note?: TFile, title?: string, platformId?: string): Promise<TFile> {
    return this.createFile(name, this.initialDesign(template, title || name, this.t('subtext'), note?.path, platformId));
  }
  private async createFile(name: string, design: Design): Promise<TFile> {
    let created: TFile | undefined;
    await this.writer.run(async () => {
      const folder = folderPath(this.settings.designFolder); await this.ensureFolder(folder);
      created = await this.app.vault.create(this.unique(folder, name, 'qcover'), JSON.stringify(design, null, 2));
    });
    await this.openDesign(created!); return created!;
  }
  async duplicateDesign(name: string, design: Design): Promise<TFile> { return this.createFile(name, structuredClone(design)); }
  initialDesign(template: string, title: string, subtitle: string, source?: string, platformId?: string): Design {
    const p = platformById(platformId) ?? platformById(this.settings.defaultPlatform) ?? platformById(DEFAULT_PLATFORM)!;
    const result = (templateById(template) ?? templateById('minimal')!).build({ width: p.width, height: p.height, title, subtitle, zh: this.isZh() });
    const bg = result.background;
    return { format: 'qiaomu-cover-design', schema: 1, width: p.width, height: p.height, source, platform: p.id, bg, canvas: { version: '7.4.0', background: bg.kind === 'solid' ? bg.color : bg.from, objects: result.objects.map(o => o.toObject(PROPS)) } };
  }
  saveSettings(): Promise<void> { return this.saveData(this.settings); }
  rememberFont(family: string): void { this.settings.recentFonts = [family, ...this.settings.recentFonts.filter(f => f !== family)].slice(0, 12); void this.saveSettings(); }
  rememberColor(color: string): void {
    if (!/^#[\da-f]{6}$/i.test(color)) return;
    this.settings.recentColors = [color.toLowerCase(), ...this.settings.recentColors.filter(c => c !== color.toLowerCase())].slice(0, 8); void this.saveSettings();
  }

  /** Desktop only: writes outside the vault to a folder the user named. */
  async writeSystemFile(dir: string, filename: string, data: ArrayBuffer): Promise<string> {
    const req = (window as unknown as { require?: (id: string) => unknown }).require;
    if (!Platform.isDesktopApp || !req) throw new Error(this.t('destSystemDesktop'));
    const fs = req('fs') as typeof import('fs'); const path = req('path') as typeof import('path'); const os = req('os') as typeof import('os');
    let target = dir.trim(); if (!target) throw new Error(this.t('destSystemMissing'));
    if (target === '~' || target.startsWith('~/') || target.startsWith('~\\')) target = path.join(os.homedir(), target.slice(1));
    if (!path.isAbsolute(target)) throw new Error(this.t('destSystemMissing'));
    await fs.promises.mkdir(target, { recursive: true });
    const ext = path.extname(filename); const base = path.basename(filename, ext); let full = path.join(target, filename); let i = 1;
    while (fs.existsSync(full)) full = path.join(target, `${base} ${i++}${ext}`);
    await fs.promises.writeFile(full, Buffer.from(data));
    return full;
  }
  /** Lets the user pick a system folder through the browser directory picker and recovers its absolute path. */
  chooseSystemFolder(doc: Document): Promise<string | undefined> {
    return new Promise(resolve => {
      const input = doc.createElement('input'); input.type = 'file'; input.setAttribute('webkitdirectory', '');
      input.addEventListener('change', () => {
        const file = input.files?.[0]; if (!file) { resolve(undefined); return; }
        const req = (window as unknown as { require?: (id: string) => { webUtils?: { getPathForFile(f: File): string } } }).require;
        let full = ''; try { full = req?.('electron').webUtils?.getPathForFile(file) ?? ''; } catch { /* older Electron */ }
        full ||= (file as File & { path?: string }).path ?? '';
        const rel = (file as File & { webkitRelativePath: string }).webkitRelativePath;
        if (!full || !rel) { new Notice(this.t('pickFailed')); resolve(undefined); return; }
        resolve(full.slice(0, full.length - rel.length) + rel.split('/')[0]);
      }, { once: true });
      input.addEventListener('cancel', () => resolve(undefined), { once: true });
      input.click();
    });
  }
}
