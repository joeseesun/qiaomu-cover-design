import { FileView, MarkdownView, Menu, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import { ActiveSelection, Canvas, Circle, FabricImage, FabricObject, Line, Polygon, Rect, Shadow, Textbox, Triangle, getEnv, setEnv } from 'fabric';
import { Background, Design, ExportFormat, ExportPrefs, EXPORT_DEFAULTS, folderPath, History, parseDesign, renderFilename, safeName, SerialWriter, SnapshotCodec, validSize } from './model';
import { Platform, PLATFORMS, platformById, platformFor } from './platforms';
import { templateById, gradient, hasCjk, textbox } from './templates';
import { Align, CoverApi, Op, runOps } from './ops';
import { Key } from './i18n';
import type CoverPlugin from './main';
import { renderDrawer, renderInspector, renderLayers, renderRail } from './panels';
import { iconButton, textButton, toggleButton } from './ui';
import { ExportModal, SizeModal, ShortcutsModal, PickFile } from './modals';

export const VIEW = 'qiaomu-cover-design';
export type QObject = FabricObject & { qcRole?: string; qcShadow?: string };
export const PROPS = ['qcRole', 'qcShadow'];
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_SIDE = 2600;

export const SHADOWS: Record<string, (fill: string) => Shadow | null> = {
  none: () => null,
  soft: () => new Shadow({ color: 'rgba(0,0,0,0.35)', blur: 18, offsetX: 0, offsetY: 8 }),
  hard: () => new Shadow({ color: '#111111', blur: 0, offsetX: 8, offsetY: 8 }),
  glow: fill => new Shadow({ color: fill || '#ffffff', blur: 28, offsetX: 0, offsetY: 0 }),
};

export class CoverView extends FileView implements CoverApi {
  canvas?: Canvas; design?: Design;
  private expected = ''; private writer = new SerialWriter(); private history = new History(); private codec = new SnapshotCodec();
  restoring = false; private closingView = false; private dirty = false; private saveTimer?: number; private historyTimer?: number; private revision = 0;
  private task = false; private generation = 0; private observer?: ResizeObserver; private clip: Record<string, unknown>[] = [];
  stage?: HTMLElement; inspectorEl?: HTMLElement; private drawerEl?: HTMLElement; private railEl?: HTMLElement; private guidesEl?: HTMLElement; private snapEl?: HTMLElement;
  private statusEl?: HTMLElement; private zoomLabel?: HTMLElement; private undoBtn?: HTMLButtonElement; private redoBtn?: HTMLButtonElement; private platformBtn?: HTMLElement;
  zoom: number | 'fit' = 'fit'; rightTab: 'design' | 'layers' = 'design'; private refreshQueued = false;
  private unsubscribeFonts?: () => void;

  constructor(leaf: WorkspaceLeaf, public plugin: CoverPlugin) { super(leaf); }
  getViewType(): string { return VIEW; }
  getDisplayText(): string { return this.file?.basename || this.plugin.t('open'); }
  getIcon(): string { return 'image'; }
  get doc(): Document { return this.contentEl.ownerDocument; }
  get win(): Window & typeof globalThis { return this.doc.defaultView as Window & typeof globalThis; }
  t(key: Key, params?: Record<string, string | number>): string { return this.plugin.t(key, params); }
  get zh(): boolean { return this.plugin.isZh(); }
  async onOpen(): Promise<void> { this.contentEl.addClass('qc-root'); }

  /* ---------- lifecycle ---------- */
  async onLoadFile(file: TFile): Promise<void> {
    const generation = ++this.generation; this.closingView = false; this.restoring = true; this.dirty = false;
    try {
      const raw = await this.app.vault.read(file); const design = parseDesign(raw);
      if (generation !== this.generation) return;
      this.expected = raw; this.design = design; this.codec = new SnapshotCodec(); this.history = new History();
      await this.plugin.fonts.register(this.doc);
      this.build();
      if (generation !== this.generation || !this.canvas) return;
      await this.canvas.loadFromJSON(design.canvas);
      await this.afterLoad();
      if (generation !== this.generation || !this.canvas) return;
      this.history.reset(this.snapshot()); this.restoring = false;
      this.applyZoom(); this.refreshAll(); this.setStatus('saved');
      this.unsubscribeFonts = this.plugin.fonts.onChange(() => { void this.reflowFonts(); this.refreshInspector(true); });
    } catch (e) {
      this.restoring = true; this.contentEl.empty(); this.contentEl.createEl('p', { text: this.t('invalidDesign'), cls: 'qc-invalid-note' }); this.plugin.report(e);
    }
  }
  async onUnloadFile(): Promise<void> {
    this.closingView = true; this.clearTimers(); this.unsubscribeFonts?.(); this.unsubscribeFonts = undefined;
    this.commitHistory(); await this.flush();
    if (this.dirty && this.canvas && this.file && this.design && !this.restoring) {
      const folder = folderPath(this.plugin.settings.designFolder);
      await this.plugin.ensureFolder(folder);
      const recovery = await this.app.vault.create(this.plugin.unique(folder, `${this.file.basename} recovery ${Date.now()}`, 'qcover'), JSON.stringify(this.currentDesign(), null, 2));
      new Notice(this.t('recovered', { path: recovery.path }));
      this.dirty = false;
    }
    ++this.generation;
    this.observer?.disconnect(); this.observer = undefined;
    if (this.canvas) await this.canvas.dispose();
    this.canvas = undefined; this.design = undefined; this.contentEl.empty();
  }
  async onClose(): Promise<void> { if (this.canvas) await this.onUnloadFile(); }
  private clearTimers(): void {
    const w = this.win;
    if (this.saveTimer !== undefined) w?.clearTimeout(this.saveTimer); this.saveTimer = undefined;
    if (this.historyTimer !== undefined) w?.clearTimeout(this.historyTimer);
    this.historyTimer = undefined;
  }
  private setStatus(key: Key): void {
    this.statusEl?.setText(this.t(key)); this.statusEl?.setAttribute('data-state', key);
  }
  async action(fn: () => void | Promise<unknown>): Promise<void> {
    if (this.task || this.restoring || this.closingView) return;
    this.task = true;
    try { await fn(); } catch (e) { this.plugin.report(e); } finally { this.task = false; }
  }

  /* ---------- layout ---------- */
  private build(): void {
    if (this.canvas) void this.canvas.dispose();
    this.observer?.disconnect(); this.contentEl.empty();
    const design = this.design!; const root = this.contentEl;
    const header = root.createDiv('qc-header');
    const left = header.createDiv('qc-header-left');
    this.platformBtn = left.createEl('button', { cls: 'qc-platform', attr: { type: 'button' } });
    this.platformBtn.addEventListener('click', e => this.platformMenu(e));
    const mid = header.createDiv('qc-header-mid');
    this.undoBtn = iconButton(mid, 'undo-2', this.t('undo'), () => void this.action(() => this.travel(-1)));
    this.redoBtn = iconButton(mid, 'redo-2', this.t('redo'), () => void this.action(() => this.travel(1)));
    mid.createSpan({ cls: 'qc-sep' });
    const g = this.plugin.settings.guides;
    toggleButton(mid, 'shield-check', this.t('safeZone'), g.safe, v => { g.safe = v; this.guidesChanged(); });
    toggleButton(mid, 'crosshair', this.t('centerLines'), g.center, v => { g.center = v; this.guidesChanged(); });
    toggleButton(mid, 'grid', this.t('grid'), g.grid, v => { g.grid = v; this.guidesChanged(); });
    toggleButton(mid, 'magnet', this.t('snap'), g.snap, v => { g.snap = v; this.guidesChanged(); });
    const right = header.createDiv('qc-header-right');
    this.statusEl = right.createSpan({ cls: 'qc-status' });
    iconButton(right, 'more-horizontal', this.t('more'), e => this.moreMenu(e));
    const exportGroup = right.createDiv('qc-split');
    textButton(exportGroup, this.t('export'), () => void this.action(() => this.openExport()), 'qc-primary', 'download');
    iconButton(exportGroup, 'chevron-down', this.t('exportMore'), e => this.exportMenu(e), 'qc-primary qc-split-more');

    const main = root.createDiv('qc-main');
    this.railEl = main.createDiv('qc-rail'); this.drawerEl = main.createDiv('qc-drawer');
    const center = main.createDiv('qc-center');
    this.stage = center.createDiv('qc-stage'); this.stage.tabIndex = 0;
    const element = this.stage.createEl('canvas');
    const win = this.win;
    setEnv({ ...getEnv(), document: this.doc, window: win });
    this.canvas = new Canvas(element, { width: design.width, height: design.height, backgroundColor: '#ffffff', preserveObjectStacking: true, selectionColor: 'rgba(13,153,255,0.10)', selectionBorderColor: '#0d99ff', selectionLineWidth: 1, uniformScaling: true });
    Object.assign(FabricObject.ownDefaults, { cornerStyle: 'circle', cornerColor: '#ffffff', cornerStrokeColor: '#0d99ff', borderColor: '#0d99ff', transparentCorners: false, cornerSize: 10, touchCornerSize: 24, padding: 3, borderScaleFactor: 1.5, originX: 'left', originY: 'top' });
    this.bindCanvas();
    const wrapper = this.canvas.wrapperEl;
    this.guidesEl = wrapper.createDiv('qc-guides'); this.snapEl = wrapper.createDiv('qc-snaplines');
    this.zoomBar(center);
    this.inspectorEl = main.createDiv('qc-inspector');
    const tabs = this.inspectorEl.createDiv('qc-tabs'); const body = this.inspectorEl.createDiv('qc-inspector-body');
    for (const id of ['design', 'layers'] as const) {
      const b = tabs.createEl('button', { cls: 'qc-tab', attr: { type: 'button' } }); b.setText(this.t(id === 'design' ? 'tabDesign' : 'layers'));
      b.classList.toggle('is-active', this.rightTab === id);
      b.addEventListener('click', () => { this.rightTab = id; for (const s of Array.from(tabs.children)) s.classList.toggle('is-active', s === b); this.refreshInspector(true); });
    }
    this.inspectorBody = body;
    this.observer = new win.ResizeObserver(() => { if (this.zoom === 'fit') this.applyZoom(); });
    this.observer.observe(this.stage);
    this.registerStageEvents();
    this.updatePlatformLabel(); this.updateHistoryButtons();
  }
  inspectorBody?: HTMLElement;

  private zoomBar(center: HTMLElement): void {
    const bar = center.createDiv('qc-zoombar');
    iconButton(bar, 'minus', this.t('zoomOut'), () => this.zoomBy(1 / 1.2));
    this.zoomLabel = bar.createEl('button', { cls: 'qc-zoom-label', attr: { type: 'button' } });
    this.zoomLabel.addEventListener('click', () => this.zoomMenu(this.zoomLabel!));
    iconButton(bar, 'plus', this.t('zoomIn'), () => this.zoomBy(1.2));
    iconButton(bar, 'scan', this.t('zoom'), () => this.setZoom('fit'));
  }
  private zoomMenu(anchor: HTMLElement): void {
    const m = new Menu();
    for (const z of [0.25, 0.5, 0.75, 1, 1.5, 2]) m.addItem(i => i.setTitle(`${Math.round(z * 100)}%`).setChecked(this.zoom === z).onClick(() => this.setZoom(z)));
    m.addSeparator(); m.addItem(i => i.setTitle(this.t('zoom')).setIcon('scan').onClick(() => this.setZoom('fit')));
    const r = anchor.getBoundingClientRect(); m.showAtPosition({ x: r.left, y: r.top });
  }
  fitScale(): number {
    if (!this.stage || !this.design) return 1;
    const style = this.win.getComputedStyle(this.stage); const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight); const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const w = Math.max(120, this.stage.clientWidth - padX), h = Math.max(120, this.stage.clientHeight - padY);
    return Math.min(w / this.design.width, h / this.design.height, 1);
  }
  currentScale(): number { return this.zoom === 'fit' ? this.fitScale() : this.zoom; }
  applyZoom(): void {
    if (!this.canvas || !this.design) return;
    const scale = this.currentScale();
    this.canvas.setDimensions({ width: Math.round(this.design.width * scale), height: Math.round(this.design.height * scale) });
    this.canvas.setZoom(scale); this.canvas.calcOffset(); this.canvas.requestRenderAll();
    this.zoomLabel?.setText(`${Math.round(scale * 100)}%`);
  }
  setZoom(z: number | 'fit'): void { this.zoom = z === 'fit' ? 'fit' : Math.min(4, Math.max(0.1, z)); this.applyZoom(); }
  zoomBy(factor: number): void { this.setZoom(Math.round(this.currentScale() * factor * 100) / 100); }

  private updatePlatformLabel(): void {
    if (!this.platformBtn || !this.design) return;
    this.platformBtn.empty();
    const p = platformFor(this.design.width, this.design.height, this.design.platform);
    const name = p ? (this.zh ? p.zh : p.en) : this.t('custom');
    this.platformBtn.createSpan({ text: name, cls: 'qc-platform-name' });
    this.platformBtn.createSpan({ text: `${this.design.width} × ${this.design.height}`, cls: 'qc-platform-size' });
  }
  private platformMenu(e: MouseEvent): void {
    const m = new Menu(); const cur = platformFor(this.design!.width, this.design!.height, this.design!.platform);
    const groups: [string, string][] = [['social', this.t('groupSocial')], ['video', this.t('groupVideo')], ['general', this.t('groupGeneral')]];
    for (const [id, label] of groups) {
      m.addItem(i => i.setTitle(label).setIsLabel(true));
      for (const p of PLATFORMS.filter(x => x.group === id)) m.addItem(i => i.setTitle(`${this.zh ? p.zh : p.en}  ·  ${p.width}×${p.height}`).setIcon(p.icon).setChecked(cur?.id === p.id).onClick(() => { this.setPlatform(p.id); }));
    }
    m.addSeparator(); m.addItem(i => i.setTitle(this.t('customSize')).setIcon('ruler').onClick(() => new SizeModal(this).open()));
    m.showAtMouseEvent(e);
  }
  private moreMenu(e: MouseEvent): void {
    const m = new Menu();
    m.addItem(i => i.setTitle(this.t('duplicateDesign')).setIcon('copy-plus').onClick(() => void this.action(() => this.plugin.duplicateDesign(`${this.file!.basename} copy`, this.currentDesign()))));
    m.addItem(i => i.setTitle(this.t('newCover')).setIcon('image-plus').onClick(() => this.plugin.openNew()));
    m.addSeparator();
    m.addItem(i => i.setTitle(this.t('fontsManage')).setIcon('a-large-small').onClick(() => this.plugin.openSettings('fonts')));
    m.addItem(i => i.setTitle(this.t('shortcuts')).setIcon('keyboard').onClick(() => new ShortcutsModal(this.plugin).open()));
    m.addItem(i => i.setTitle(this.t('settings')).setIcon('settings').onClick(() => this.plugin.openSettings()));
    m.showAtMouseEvent(e);
  }
  private exportMenu(e: MouseEvent): void {
    const m = new Menu();
    m.addItem(i => i.setTitle(this.t('quickExport')).setIcon('zap').onClick(() => void this.action(() => this.quickExport())));
    m.addItem(i => i.setTitle(this.t('copy')).setIcon('clipboard-copy').onClick(() => void this.action(() => this.copyPng())));
    if (this.design?.source) m.addItem(i => i.setTitle(this.t('insert')).setIcon('file-input').onClick(() => void this.action(() => this.exportWith({ ...this.exportPrefs(), insert: true }))));
    m.addItem(i => i.setTitle(this.t('exportAs')).setIcon('sliders-horizontal').onClick(() => void this.action(() => this.openExport())));
    m.showAtMouseEvent(e);
  }

  /* ---------- canvas events ---------- */
  private bindCanvas(): void {
    const c = this.canvas!;
    c.on('object:modified', () => this.changed()); c.on('object:added', () => this.changed()); c.on('object:removed', () => this.changed());
    c.on('text:changed', e => { const t = e.target as Textbox | undefined; if (t) t.splitByGrapheme = hasCjk(t.text); this.changed(); });
    for (const ev of ['selection:created', 'selection:updated', 'selection:cleared'] as const) c.on(ev, () => this.refreshInspector(true));
    c.on('object:moving', e => { if (this.plugin.settings.guides.snap && e.target) this.snapMove(e.target); });
    c.on('mouse:up', () => this.clearSnap());
    c.on('text:editing:exited', () => this.refreshInspector(true));
  }
  private registerStageEvents(): void {
    const stage = this.stage!;
    this.registerDomEvent(this.contentEl, 'keydown', (e: KeyboardEvent) => this.keyboard(e));
    this.registerDomEvent(stage, 'wheel', (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); } }, { passive: false });
    this.registerDomEvent(stage, 'contextmenu', (e: MouseEvent) => { e.preventDefault(); this.contextMenu(e); });
    this.registerDomEvent(this.contentEl, 'paste', (e: ClipboardEvent) => this.onPaste(e));
    this.registerDomEvent(stage, 'dragover', (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); stage.addClass('is-drop'); } });
    this.registerDomEvent(stage, 'dragleave', () => stage.removeClass('is-drop'));
    this.registerDomEvent(stage, 'drop', (e: DragEvent) => { e.preventDefault(); stage.removeClass('is-drop'); void this.action(() => this.onDrop(e)); });
  }
  private async onDrop(e: DragEvent): Promise<void> {
    const files = Array.from(e.dataTransfer?.files ?? []);
    const images = files.filter(f => /^image\/(png|jpeg|webp)$/.test(f.type)); const fonts = files.filter(f => /\.(ttf|otf|woff2?)$/i.test(f.name));
    if (fonts.length) { const added = await this.plugin.fonts.importFiles(fonts, this.doc); if (added.length) new Notice(this.t('fontsImported', { names: added.join(', ') })); }
    for (const file of images) await this.importImage(file);
  }
  private onPaste(e: ClipboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input,textarea,select,[contenteditable="true"]') || this.canvas?.getActiveObjects().some(o => o instanceof Textbox && o.isEditing)) return;
    const image = Array.from(e.clipboardData?.files ?? []).find(f => f.type.startsWith('image/'));
    e.preventDefault();
    if (image) void this.action(() => this.importImage(image)); else void this.action(() => this.pasteObjects());
  }
  private contextMenu(e: MouseEvent): void {
    const c = this.canvas; if (!c || this.restoring) return;
    const point = c.getScenePoint(e);
    const hit = c.getObjects().slice().reverse().find(o => o.visible && o.containsPoint(point));
    if (hit && !c.getActiveObjects().includes(hit)) { c.setActiveObject(hit); c.requestRenderAll(); }
    const has = c.getActiveObjects().length > 0; const m = new Menu();
    if (has) {
      m.addItem(i => i.setTitle(this.t('copyObj')).setIcon('copy').onClick(() => void this.action(() => this.copyObjects())));
      m.addItem(i => i.setTitle(this.t('duplicate')).setIcon('copy-plus').onClick(() => void this.action(() => this.cloneSelection())));
    }
    m.addItem(i => i.setTitle(this.t('paste')).setIcon('clipboard-paste').onClick(() => void this.action(() => this.pasteObjects())));
    if (has) {
      m.addSeparator();
      m.addItem(i => i.setTitle(this.t('front')).setIcon('bring-to-front').onClick(() => this.order('front')));
      m.addItem(i => i.setTitle(this.t('forward')).setIcon('arrow-up').onClick(() => this.order('forward')));
      m.addItem(i => i.setTitle(this.t('backward')).setIcon('arrow-down').onClick(() => this.order('backward')));
      m.addItem(i => i.setTitle(this.t('back')).setIcon('send-to-back').onClick(() => this.order('back')));
      m.addSeparator();
      m.addItem(i => i.setTitle(this.t('centerH')).setIcon('align-center-vertical').onClick(() => this.align('center')));
      m.addItem(i => i.setTitle(this.t('centerV')).setIcon('align-center-horizontal').onClick(() => this.align('middle')));
      m.addSeparator();
      m.addItem(i => i.setTitle(this.t('locked')).setIcon('lock-keyhole').onClick(() => this.toggleLock()));
      m.addItem(i => i.setTitle(this.t('remove')).setIcon('trash-2').onClick(() => this.removeSelection()));
    }
    m.showAtMouseEvent(e);
  }

  /* ---------- guides and snapping ---------- */
  private guidesChanged(): void { void this.plugin.saveSettings(); this.renderGuides(); }
  renderGuides(): void {
    const el = this.guidesEl; if (!el || !this.design) return; el.empty();
    const g = this.plugin.settings.guides; const d = this.design; const p = platformFor(d.width, d.height, d.platform);
    if (g.grid) { el.createDiv('qc-guide-grid'); }
    if (g.center) { el.createDiv('qc-guide-v'); el.createDiv('qc-guide-h'); }
    if (g.safe) {
      const margin = (p?.margin ?? 0.05) * Math.min(d.width, d.height);
      const box = el.createDiv('qc-safe'); box.style.inset = `${(margin / d.height) * 100}% ${(margin / d.width) * 100}%`;
      for (const z of p?.avoid ?? []) {
        const zone = el.createDiv('qc-avoid'); zone.style.cssText = `left:${z.x * 100}%;top:${z.y * 100}%;width:${z.w * 100}%;height:${z.h * 100}%`;
        zone.createSpan({ text: this.zh ? z.zh : z.en });
      }
    }
  }
  private snapMove(target: FabricObject): void {
    const c = this.canvas!, d = this.design!; const th = 7 / c.getZoom();
    const b = target.getBoundingRect(); const active = c.getActiveObjects();
    const p = platformFor(d.width, d.height, d.platform); const margin = (p?.margin ?? 0.05) * Math.min(d.width, d.height);
    const xs = [0, d.width / 2, d.width, margin, d.width - margin]; const ys = [0, d.height / 2, d.height, margin, d.height - margin];
    for (const o of c.getObjects()) {
      if (active.includes(o) || !o.visible) continue; const r = o.getBoundingRect();
      xs.push(r.left, r.left + r.width / 2, r.left + r.width); ys.push(r.top, r.top + r.height / 2, r.top + r.height);
    }
    const best = (edges: number[], lines: number[]): { delta: number; line: number } | undefined => {
      let hit: { delta: number; line: number } | undefined;
      for (const e of edges) for (const l of lines) { const dist = l - e; if (Math.abs(dist) <= th && (!hit || Math.abs(dist) < Math.abs(hit.delta))) hit = { delta: dist, line: l }; }
      return hit;
    };
    const sx = best([b.left, b.left + b.width / 2, b.left + b.width], xs); const sy = best([b.top, b.top + b.height / 2, b.top + b.height], ys);
    if (sx) target.set({ left: target.left + sx.delta }); if (sy) target.set({ top: target.top + sy.delta });
    if (sx || sy) target.setCoords();
    const el = this.snapEl; if (!el) return; el.empty();
    if (sx) { const l = el.createDiv('qc-snap-v'); l.style.left = `${(sx.line / d.width) * 100}%`; }
    if (sy) { const l = el.createDiv('qc-snap-h'); l.style.top = `${(sy.line / d.height) * 100}%`; }
  }
  private clearSnap(): void { this.snapEl?.empty(); }

  /* ---------- persistence ---------- */
  private async afterLoad(): Promise<void> {
    const d = this.design!; const c = this.canvas!;
    const bg = d.bg ?? this.bgFromCanvas();
    this.applyBackground(bg, false);
    for (const o of c.getObjects()) if (o instanceof Textbox) o.splitByGrapheme = o.splitByGrapheme || hasCjk(o.text);
    await this.reflowFonts();
  }
  private bgFromCanvas(): Background {
    const v = this.canvas?.backgroundColor; return { kind: 'solid', color: typeof v === 'string' && /^#[\da-f]{6}$/i.test(v) ? v : '#ffffff' };
  }
  /** Loads every family used by text, then recomputes layout once real glyph metrics are available. */
  async reflowFonts(): Promise<void> {
    const c = this.canvas; if (!c) return;
    const texts = c.getObjects().filter((o): o is Textbox => o instanceof Textbox);
    await Promise.all([...new Set(texts.map(t => t.fontFamily))].map(f => this.plugin.fonts.ensure(this.doc, f)));
    for (const t of texts) { t.initDimensions(); t.set('dirty', true); t.setCoords(); }
    c.requestRenderAll();
  }
  currentDesign(): Design {
    const canvas = this.canvas!.toObject(PROPS) as Record<string, unknown>;
    const bg = this.design!.bg; if (bg) canvas.background = bg.kind === 'solid' ? bg.color : bg.from;
    return { ...this.design!, canvas };
  }
  private snapshot(): string { return this.codec.encode(this.currentDesign()); }
  changed(): void {
    if (this.restoring || !this.canvas || !this.design || this.closingView) return;
    this.dirty = true; ++this.revision; this.setStatus('saving');
    const w = this.win; if (this.historyTimer !== undefined) w.clearTimeout(this.historyTimer);
    this.historyTimer = w.setTimeout(() => { this.historyTimer = undefined; this.commitHistory(); void this.flush(); }, 450);
    if (!this.refreshQueued) { this.refreshQueued = true; w.requestAnimationFrame(() => { this.refreshQueued = false; this.refreshLayers(); }); }
  }
  private commitHistory(): void {
    if (this.historyTimer !== undefined) { this.win.clearTimeout(this.historyTimer); this.historyTimer = undefined; }
    if (this.restoring || !this.canvas || !this.design || !this.dirty) return;
    this.history.push(this.snapshot()); this.updateHistoryButtons();
  }
  private updateHistoryButtons(): void {
    if (this.undoBtn) this.undoBtn.disabled = !this.history.canStep(-1);
    if (this.redoBtn) this.redoBtn.disabled = !this.history.canStep(1);
  }
  async flush(): Promise<void> {
    this.commitHistory();
    await this.writer.run(async () => {
      if (!this.dirty || !this.file || !this.canvas || this.restoring) return;
      const file = this.file; const revision = this.revision; const raw = JSON.stringify(this.currentDesign(), null, 2); const expected = this.expected;
      try {
        await this.app.vault.process(file, old => { if (old !== expected) throw new Error(this.t('conflict')); return raw; });
        this.expected = raw;
        if (revision === this.revision) { this.dirty = false; this.setStatus('saved'); } else this.setStatus('saving');
      } catch (e) { this.setStatus('failed'); this.plugin.report(e); }
    });
  }
  async travel(direction: -1 | 1): Promise<void> {
    this.commitHistory();
    const snapshot = this.history.step(direction); if (!snapshot || !this.canvas) return;
    const d = this.codec.decode(snapshot); this.restoring = true;
    try {
      this.canvas.discardActiveObject(); await this.canvas.loadFromJSON(d.canvas); this.design = d; await this.afterLoad();
      this.applyZoom(); this.updatePlatformLabel(); this.renderGuides();
    } finally { this.restoring = false; }
    this.dirty = true; ++this.revision; this.updateHistoryButtons(); this.refreshAll(); await this.flush();
  }
  undo(): Promise<void> { return this.travel(-1); }
  redo(): Promise<void> { return this.travel(1); }

  /* ---------- panels ---------- */
  refreshAll(): void {
    if (!this.canvas) return;
    renderRail(this, this.railEl!); renderDrawer(this, this.drawerEl!); this.refreshInspector(true); this.renderGuides(); this.updatePlatformLabel();
  }
  refreshDrawer(): void { if (this.drawerEl) { renderRail(this, this.railEl!); renderDrawer(this, this.drawerEl); } }
  refreshInspector(force = false): void {
    const el = this.inspectorBody; if (!el || !this.canvas) return;
    const a = this.doc.activeElement; if (!force && a && el.contains(a)) return;
    // Rebuilding while the user types would drop focus and break IME composition.
    if (!force && a && el.contains(a)) return;
    if (this.rightTab === 'layers') renderLayers(this, el); else renderInspector(this, el);
  }
  private refreshLayers(): void { if (this.rightTab === 'layers' && this.inspectorBody) renderLayers(this, this.inspectorBody); }

  /* ---------- object helpers ---------- */
  selection(): QObject[] { return (this.canvas?.getActiveObjects() ?? []) as QObject[]; }
  texts(): Textbox[] { return this.selection().filter((o): o is Textbox & QObject => o instanceof Textbox); }
  update(props: Record<string, unknown>, only?: (o: FabricObject) => boolean): void {
    const targets = this.selection().filter(o => !only || only(o));
    for (const o of targets) {
      o.set(props);
      if (o instanceof Textbox) { if ('text' in props) o.splitByGrapheme = hasCjk(o.text); o.initDimensions(); }
      o.setCoords();
    }
    this.canvas?.requestRenderAll(); this.changed();
  }
  async setFont(family: string): Promise<void> {
    await this.plugin.fonts.ensure(this.doc, family);
    this.plugin.rememberFont(family);
    const targets = this.texts();
    if (!targets.length) { this.plugin.settings.defaultFont = family; void this.plugin.saveSettings(); }
    else this.update({ fontFamily: family }, o => o instanceof Textbox);
    this.refreshInspector(true); this.refreshDrawer();
  }
  setShadow(name: string): void {
    for (const o of this.selection()) {
      const fill = typeof o.fill === 'string' ? o.fill : '#ffffff';
      o.set({ shadow: SHADOWS[name]?.(fill) ?? null }); (o as QObject).qcShadow = name === 'none' ? undefined : name; o.setCoords();
    }
    this.canvas?.requestRenderAll(); this.changed();
  }
  private place(o: FabricObject): void {
    const c = this.canvas!; c.add(o); c.setActiveObject(o); c.requestRenderAll(); this.refreshInspector(true);
  }
  addText(text = this.t('newText'), o: { size?: number; color?: string; font?: string; bold?: boolean; align?: 'left' | 'center' | 'right' } = {}): Textbox {
    const d = this.design!; const m = Math.round(Math.min(d.width, d.height) * 0.08);
    const count = this.canvas!.getObjects().filter(x => x instanceof Textbox).length;
    const box = textbox(text, m, Math.round(d.height * 0.2) + count * Math.round(d.height * 0.06), d.width - m * 2, {
      fontSize: o.size ?? Math.round(Math.min(d.width, d.height) * 0.09), fill: o.color ?? '#171717', fontWeight: o.bold === false ? 'normal' : 'bold', fontFamily: o.font ?? this.plugin.settings.defaultFont, textAlign: o.align ?? 'left',
    });
    this.place(box); return box;
  }
  addPreset(kind: 'title' | 'subtitle' | 'body' | 'marker' | 'outline' | 'shadow' | 'tag' | 'number'): Textbox {
    const d = this.design!; const u = Math.min(d.width, d.height) / 1000;
    const label = { title: this.t('presetTitle'), subtitle: this.t('presetSubtitle'), body: this.t('presetBody'), marker: this.t('presetMarker'), outline: this.t('presetOutline'), shadow: this.t('presetShadow'), tag: this.t('presetTag'), number: '01' }[kind];
    const base: Record<string, unknown> = {
      title: { size: 110 * u, bold: true }, subtitle: { size: 52 * u, bold: false, color: '#525252' }, body: { size: 36 * u, bold: false, color: '#404040' },
      marker: { size: 96 * u, bold: true }, outline: { size: 130 * u, bold: true, color: '#ffffff' }, shadow: { size: 110 * u, bold: true, color: '#ffe04b' }, tag: { size: 40 * u, bold: true, color: '#ffffff' }, number: { size: 220 * u, bold: true, color: '#e11d2e' },
    }[kind];
    const box = this.addText(label, { size: Math.round(base.size as number), color: base.color as string | undefined, bold: base.bold as boolean });
    if (kind === 'marker') box.set({ textBackgroundColor: '#ffe04b' });
    if (kind === 'outline') box.set({ stroke: '#111111', strokeWidth: Math.max(4, Math.round(10 * u)), paintFirst: 'stroke' });
    if (kind === 'shadow') { box.set({ shadow: SHADOWS.hard!('#111111') }); (box as QObject).qcShadow = 'hard'; }
    if (kind === 'tag') box.set({ textBackgroundColor: '#e11d2e', width: Math.round(300 * u) });
    box.initDimensions(); box.setCoords(); this.canvas!.requestRenderAll(); this.changed(); this.refreshInspector(true);
    return box;
  }
  addShape(type: 'rect' | 'rounded' | 'circle' | 'triangle' | 'line' | 'star'): void {
    if (!this.canvas || !this.design) return;
    const d = this.design; const size = Math.round(Math.min(d.width, d.height) * 0.3); const left = Math.round((d.width - size) / 2), top = Math.round((d.height - size) / 2);
    const common = { left, top, fill: '#2563eb' };
    let o: FabricObject;
    switch (type) {
      case 'rect': o = new Rect({ ...common, width: size * 1.4, height: size * 0.8 }); break;
      case 'rounded': o = new Rect({ ...common, width: size * 1.4, height: size * 0.8, rx: size * 0.12, ry: size * 0.12 }); break;
      case 'circle': o = new Circle({ ...common, radius: size / 2 }); break;
      case 'triangle': o = new Triangle({ ...common, width: size, height: size * 0.9 }); break;
      case 'line': o = new Line([0, 0, size * 1.4, 0], { left, top: top + size / 2, stroke: '#171717', strokeWidth: Math.max(6, Math.round(size * 0.04)), strokeLineCap: 'round' }); break;
      default: {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < 10; i++) { const r = i % 2 ? size * 0.2 : size * 0.5; const a = (Math.PI / 5) * i - Math.PI / 2; pts.push({ x: size / 2 + r * Math.cos(a), y: size / 2 + r * Math.sin(a) }); }
        o = new Polygon(pts, { ...common });
      }
    }
    this.place(o);
  }
  removeSelection(): void {
    const c = this.canvas; if (!c) return;
    const targets = c.getActiveObjects(); if (!targets.length) return;
    c.discardActiveObject(); c.remove(...targets); c.requestRenderAll(); this.refreshInspector(true);
  }
  async cloneSelection(): Promise<void> {
    const c = this.canvas; if (!c) return; const generation = this.generation;
    const copies = await Promise.all(c.getActiveObjects().map(o => o.clone(PROPS)));
    if (generation !== this.generation || this.closingView) return;
    c.discardActiveObject();
    for (const copy of copies) { copy.set({ left: copy.left + 28, top: copy.top + 28 }); c.add(copy); }
    if (copies.length === 1) c.setActiveObject(copies[0]!); else if (copies.length > 1) c.setActiveObject(new ActiveSelection(copies, { canvas: c }));
    c.requestRenderAll(); this.refreshInspector(true);
  }
  async copyObjects(): Promise<void> {
    const c = this.canvas; if (!c) return;
    this.clip = (await Promise.all(c.getActiveObjects().map(o => o.clone(PROPS)))).map(o => o.toObject(PROPS));
    if (this.clip.length) new Notice(this.t('copiedObj'));
  }
  async pasteObjects(): Promise<void> {
    const c = this.canvas; if (!c || !this.clip.length) return;
    const { util } = await import('fabric'); const generation = this.generation;
    const copies = await util.enlivenObjects<FabricObject>(structuredClone(this.clip));
    if (generation !== this.generation || this.closingView) return;
    c.discardActiveObject();
    for (const o of copies) { o.set({ left: o.left + 28, top: o.top + 28 }); c.add(o); }
    this.clip = copies.map(o => o.toObject(PROPS));
    if (copies.length === 1) c.setActiveObject(copies[0]!); else if (copies.length > 1) c.setActiveObject(new ActiveSelection(copies, { canvas: c }));
    c.requestRenderAll(); this.refreshInspector(true);
  }
  order(where: 'front' | 'forward' | 'backward' | 'back'): void {
    const c = this.canvas; if (!c) return;
    for (const o of where === 'front' || where === 'forward' ? c.getActiveObjects() : c.getActiveObjects().reverse()) {
      if (where === 'front') c.bringObjectToFront(o); else if (where === 'forward') c.bringObjectForward(o); else if (where === 'backward') c.sendObjectBackwards(o); else c.sendObjectToBack(o);
    }
    c.requestRenderAll(); this.changed();
  }
  toggleLock(): void {
    const targets = this.selection(); if (!targets.length) return;
    const locked = !targets.every(o => o.lockMovementX);
    for (const o of targets) o.set({ lockMovementX: locked, lockMovementY: locked, lockScalingX: locked, lockScalingY: locked, lockRotation: locked, hasControls: !locked, ...(o instanceof Textbox ? { editable: !locked } : {}) });
    this.canvas?.requestRenderAll(); this.changed(); this.refreshInspector(true);
  }
  align(to: Align): boolean {
    const c = this.canvas, d = this.design; const target = c?.getActiveObject(); if (!c || !d || !target) return false;
    const b = target.getBoundingRect();
    const dx = to === 'left' ? -b.left : to === 'right' ? d.width - (b.left + b.width) : to === 'center' ? d.width / 2 - (b.left + b.width / 2) : 0;
    const dy = to === 'top' ? -b.top : to === 'bottom' ? d.height - (b.top + b.height) : to === 'middle' ? d.height / 2 - (b.top + b.height / 2) : 0;
    target.set({ left: target.left + dx, top: target.top + dy }); target.setCoords();
    c.requestRenderAll(); this.changed(); this.refreshInspector(true); return true;
  }
  move(dx: number, dy: number): void {
    for (const o of this.canvas?.getActiveObjects() ?? []) { if (o.lockMovementX) continue; o.set({ left: o.left + dx, top: o.top + dy }); o.setCoords(); }
    this.canvas?.requestRenderAll(); this.changed();
  }
  /** Scales an image so it covers or fits the whole canvas, centred. */
  fitImage(img: FabricObject, mode: 'cover' | 'contain'): void {
    const d = this.design!; const w = img.width, h = img.height;
    const s = mode === 'cover' ? Math.max(d.width / w, d.height / h) : Math.min(d.width / w, d.height / h);
    img.set({ scaleX: s, scaleY: s, left: (d.width - w * s) / 2, top: (d.height - h * s) / 2 }); img.setCoords();
    this.canvas?.requestRenderAll(); this.changed(); this.refreshInspector(true);
  }
  setCorner(img: FabricObject, radius: number): void {
    if (img instanceof Rect) { img.set({ rx: radius, ry: radius }); } else {
      img.clipPath = radius > 0 ? new Rect({ width: img.width, height: img.height, rx: radius / Math.max(img.scaleX, 0.0001), ry: radius / Math.max(img.scaleY, 0.0001), originX: 'center', originY: 'center' }) : undefined;
      img.set('dirty', true);
    }
    this.canvas?.requestRenderAll(); this.changed();
  }

  /* ---------- canvas settings ---------- */
  applyBackground(bg: Background, record = true): void {
    const c = this.canvas, d = this.design; if (!c || !d) return;
    d.bg = bg; c.backgroundColor = bg.kind === 'solid' ? bg.color : gradient(d.width, d.height, bg.from, bg.to, bg.angle);
    c.requestRenderAll(); if (record) this.changed();
  }
  setBackground(spec: { color?: string; from?: string; to?: string; angle?: number }): boolean {
    if (spec.color) this.applyBackground({ kind: 'solid', color: spec.color });
    else if (spec.from && spec.to) this.applyBackground({ kind: 'linear', from: spec.from, to: spec.to, angle: spec.angle ?? 135 });
    else return false;
    this.refreshInspector(true); return true;
  }
  setPlatform(id: string): boolean {
    const p = platformById(id); if (!p) return false;
    this.resizeTo(p.width, p.height, true, p); return true;
  }
  resizeTo(width: number, height: number, fit = true, platform?: Platform): void {
    const d = this.design, c = this.canvas; if (!d || !c || !validSize(width, height)) return;
    const ow = d.width, oh = d.height;
    if (fit && (ow !== width || oh !== height)) {
      const s = Math.min(width / ow, height / oh); const ox = (width - ow * s) / 2, oy = (height - oh * s) / 2;
      for (const o of c.getObjects()) {
        if (o instanceof Textbox) o.set({ fontSize: o.fontSize * s, width: o.width * s, strokeWidth: o.strokeWidth * s });
        else o.set({ scaleX: o.scaleX * s, scaleY: o.scaleY * s });
        o.set({ left: o.left * s + ox, top: o.top * s + oy }); if (o instanceof Textbox) o.initDimensions(); o.setCoords();
      }
    }
    d.width = width; d.height = height; d.platform = platform?.id ?? platformFor(width, height)?.id;
    if (d.bg?.kind === 'linear') this.applyBackground(d.bg, false);
    this.applyZoom(); this.updatePlatformLabel(); this.renderGuides(); this.changed(); this.refreshInspector(true); this.refreshDrawer();
  }
  /** Re-lays the design out from a template, keeping the user's own title and subtitle. */
  applyTemplate(id: string): boolean {
    const t = templateById(id), c = this.canvas, d = this.design; if (!t || !c || !d) return false;
    const copy = this.copyText();
    const result = t.build({ width: d.width, height: d.height, title: copy.title, subtitle: copy.subtitle, zh: this.zh });
    c.discardActiveObject(); this.restoring = true;
    try { c.remove(...c.getObjects()); for (const o of result.objects) c.add(o); } finally { this.restoring = false; }
    this.applyBackground(result.background, false);
    void this.reflowFonts().then(() => this.changed()); this.changed(); this.refreshInspector(true); return true;
  }
  copyText(): { title: string; subtitle: string } {
    const texts = (this.canvas?.getObjects() ?? []).filter((o): o is Textbox & QObject => o instanceof Textbox);
    const title = texts.find(o => o.qcRole === 'title') ?? [...texts].sort((a, b) => b.fontSize * b.scaleY - a.fontSize * a.scaleY)[0];
    const sub = texts.find(o => o.qcRole === 'subtitle') ?? [...texts].filter(o => o !== title).sort((a, b) => b.fontSize - a.fontSize)[0];
    return { title: title?.text ?? this.design?.source?.replace(/^.*\//, '').replace(/\.md$/, '') ?? this.t('newText'), subtitle: sub?.text ?? this.t('subtext') };
  }
  styleText(target: 'selection' | 'title' | 'subtitle', change: { text?: string; size?: number; scale?: number; color?: string; font?: string; bold?: boolean; italic?: boolean; align?: 'left' | 'center' | 'right' }): boolean {
    const c = this.canvas; if (!c) return false;
    const texts = c.getObjects().filter((o): o is Textbox & QObject => o instanceof Textbox);
    let targets: Textbox[];
    if (target === 'selection') targets = this.texts();
    else {
      const info = this.copyText();
      const hit = texts.find(o => o.qcRole === target) ?? texts.find(o => o.text === (target === 'title' ? info.title : info.subtitle));
      targets = hit ? [hit] : [];
    }
    if (!targets.length && target === 'selection') targets = texts.filter(o => o.qcRole === 'title').slice(0, 1);
    if (!targets.length) return false;
    for (const o of targets) {
      const props: Record<string, unknown> = {};
      if (change.text !== undefined) props.text = change.text;
      if (change.size) props.fontSize = change.size; if (change.scale) props.fontSize = Math.round(o.fontSize * change.scale);
      if (change.color) props.fill = change.color; if (change.bold !== undefined) props.fontWeight = change.bold ? 'bold' : 'normal';
      if (change.italic !== undefined) props.fontStyle = change.italic ? 'italic' : 'normal'; if (change.align) props.textAlign = change.align;
      o.set(props); if (change.text !== undefined) o.splitByGrapheme = hasCjk(change.text);
      if (change.font) { o.set({ fontFamily: change.font }); void this.plugin.fonts.ensure(this.doc, change.font).then(() => { o.initDimensions(); this.canvas?.requestRenderAll(); }); }
      o.initDimensions(); o.setCoords();
    }
    c.requestRenderAll(); this.changed(); this.refreshInspector(true); return true;
  }
  fontsInUse(): string[] {
    return [...new Set((this.canvas?.getObjects() ?? []).filter((o): o is Textbox => o instanceof Textbox).map(o => o.fontFamily))];
  }
  async runAssistantOps(ops: Op[]): Promise<string[]> { return runOps(this, ops, this.zh); }

  /* ---------- images ---------- */
  pickImage(): void {
    const input = this.doc.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp'; input.multiple = true;
    input.addEventListener('change', () => { for (const f of Array.from(input.files ?? [])) void this.action(() => this.importImage(f)); }, { once: true }); input.click();
  }
  pickVaultImage(onPick?: (file: TFile) => void): void {
    const files = this.app.vault.getFiles().filter(f => /^(png|jpe?g|webp)$/i.test(f.extension));
    if (!files.length) { new Notice(this.t('noImages')); return; }
    const generation = this.generation;
    new PickFile(this.app, files, file => {
      if (onPick) { onPick(file); return; }
      void this.action(async () => {
        const data = await this.app.vault.readBinary(file); if (generation !== this.generation) return;
        await this.importImage(new Blob([data], { type: mimeOf(file.extension) }));
      });
    }, this.t('imageVault')).open();
  }
  /** Reads a raster, shrinks very large photos and returns an embeddable data URL. */
  async prepareImage(blob: Blob): Promise<string> {
    if (blob.size > MAX_IMAGE_BYTES || !['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) throw new Error(this.t('imageLimit'));
    const bitmap = await this.win.createImageBitmap(blob);
    try {
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
      if (scale === 1 && blob.size < 6 * 1024 * 1024) return await readDataUrl(this.win, blob);
      const canvas = this.doc.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const type = blob.type === 'image/png' ? 'image/png' : 'image/webp';
      const out = await new Promise<Blob | null>(r => canvas.toBlob(r, type, 0.92));
      if (!out) throw new Error(this.t('imageLimit'));
      return await readDataUrl(this.win, out);
    } finally { bitmap.close(); }
  }
  async importImage(blob: Blob): Promise<void> {
    const generation = this.generation; const url = await this.prepareImage(blob);
    const image = await FabricImage.fromURL(url);
    if (generation !== this.generation || this.closingView || !this.canvas || !this.design) return;
    const d = this.design; image.scaleToWidth(Math.min(d.width * 0.7, image.width)); if (image.getScaledHeight() > d.height * 0.8) image.scaleToHeight(d.height * 0.8);
    image.set({ left: (d.width - image.getScaledWidth()) / 2, top: (d.height - image.getScaledHeight()) / 2 }); this.place(image);
  }
  async replaceImage(target: FabricImage, blob: Blob): Promise<void> {
    const url = await this.prepareImage(blob); const shown = target.getScaledWidth(); const generation = this.generation;
    await target.setSrc(url); if (generation !== this.generation) return;
    const s = shown / target.width; target.set({ scaleX: s, scaleY: s }); target.setCoords(); this.canvas?.requestRenderAll(); this.changed(); this.refreshInspector(true);
  }

  /* ---------- keyboard ---------- */
  private keyboard(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('input,textarea,select,[contenteditable="true"]') || this.canvas?.getActiveObjects().some(o => o instanceof Textbox && o.isEditing) || event.isComposing) return;
    if (this.restoring) return;
    const mod = event.metaKey || event.ctrlKey; const k = event.key.toLowerCase(); let run: (() => void | Promise<unknown>) | undefined;
    if (mod && k === 'z') run = () => this.travel(event.shiftKey ? 1 : -1);
    else if (mod && k === 'y') run = () => this.travel(1);
    else if (mod && k === 's') run = () => this.flush();
    else if (mod && k === 'd') run = () => this.cloneSelection();
    else if (mod && k === 'c') run = () => this.copyObjects();
    else if (mod && k === 'a') run = () => { const c = this.canvas!; const all = c.getObjects().filter(o => o.selectable); c.discardActiveObject(); if (all.length === 1) c.setActiveObject(all[0]!); else if (all.length) c.setActiveObject(new ActiveSelection(all, { canvas: c })); c.requestRenderAll(); };
    else if (mod && event.shiftKey && k === 'e') run = () => this.quickExport();
    else if (mod && k === 'e') run = () => this.openExport();
    else if (mod && (k === '=' || k === '+')) run = () => this.zoomBy(1.2);
    else if (mod && k === '-') run = () => this.zoomBy(1 / 1.2);
    else if (mod && k === '0') run = () => this.setZoom('fit');
    else if (mod && k === '1') run = () => this.setZoom(1);
    else if (mod && k === ']') run = () => this.order(event.shiftKey ? 'front' : 'forward');
    else if (mod && k === '[') run = () => this.order(event.shiftKey ? 'back' : 'backward');
    else if (mod && k === 'l') run = () => this.toggleLock();
    else if (!mod && event.key === 'Escape') run = () => { this.canvas?.discardActiveObject(); this.canvas?.requestRenderAll(); };
    else if (!mod && event.key === 'Delete' || event.key === 'Backspace') run = () => this.removeSelection();
    else if (!mod && !event.altKey && k === 't') run = () => { this.addText(); };
    else if (!mod && !event.altKey && k === 'r') run = () => this.addShape('rect');
    else if (!mod && !event.altKey && k === 'o') run = () => this.addShape('circle');
    else if (!mod && !event.altKey && k === 'l') run = () => this.addShape('line');
    else if (event.key === '?') run = () => { new ShortcutsModal(this.plugin).open(); };
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      const n = event.shiftKey ? 10 : 1;
      run = () => this.move(event.key === 'ArrowLeft' ? -n : event.key === 'ArrowRight' ? n : 0, event.key === 'ArrowUp' ? -n : event.key === 'ArrowDown' ? n : 0);
    }
    if (run) { event.preventDefault(); event.stopPropagation(); void this.action(run); }
  }

  /* ---------- export ---------- */
  exportPrefs(): ExportPrefs {
    return { ...EXPORT_DEFAULTS, folder: this.plugin.settings.exportFolder, ...this.plugin.settings.export, ...this.design?.export };
  }
  /** Renders the design at its native size times `scale`. */
  render(scale = 1): HTMLCanvasElement {
    if (!this.canvas || !this.design) throw new Error('no-canvas');
    const c = this.canvas; c.discardActiveObject();
    const transform = [...c.viewportTransform] as [number, number, number, number, number, number];
    c.viewportTransform = [1, 0, 0, 1, 0, 0];
    try { return c.toCanvasElement(scale, { left: 0, top: 0, width: this.design.width, height: this.design.height }); }
    finally { c.viewportTransform = transform; c.calcViewportBoundaries(); c.requestRenderAll(); }
  }
  png(): HTMLCanvasElement { return this.render(1); }
  async encode(prefs: ExportPrefs, limit?: number): Promise<{ blob: Blob; format: ExportFormat; quality: number; width: number; height: number }> {
    const source = this.render(prefs.scale);
    const mime = (f: ExportFormat): string => f === 'jpeg' ? 'image/jpeg' : f === 'webp' ? 'image/webp' : 'image/png';
    const toBlob = (f: ExportFormat, q: number): Promise<Blob> => new Promise((res, rej) => source.toBlob(b => b ? res(b) : rej(new Error('export-failed')), mime(f), q));
    let format = prefs.format; let quality = prefs.quality; let blob = await toBlob(format, quality);
    if (limit && prefs.fitLimit && blob.size > limit) {
      format = format === 'png' ? 'jpeg' : format; let lo = 0.4, hi = Math.min(quality, 0.95); quality = hi; blob = await toBlob(format, hi);
      for (let i = 0; i < 6 && blob.size > limit; i++) { quality = (lo + hi) / 2; blob = await toBlob(format, quality); if (blob.size > limit) hi = quality; else lo = quality; }
    }
    return { blob, format, quality, width: source.width, height: source.height };
  }
  platform(): Platform | undefined { return this.design ? platformFor(this.design.width, this.design.height, this.design.platform) : undefined; }
  private async pngBlob(): Promise<Blob> {
    const source = this.render(1); return new Promise((res, rej) => source.toBlob(b => b ? res(b) : rej(new Error('export-failed')), 'image/png'));
  }
  async openExport(): Promise<void> { await this.flush(); new ExportModal(this).open(); }
  async quickExport(): Promise<TFile | string> { return this.exportWith(this.exportPrefs()); }
  async exportNow(o: { format?: ExportFormat; scale?: number }): Promise<string> {
    const r = await this.exportWith({ ...this.exportPrefs(), ...(o.format ? { format: o.format } : {}), ...(o.scale ? { scale: o.scale } : {}) });
    return typeof r === 'string' ? r : r.path;
  }
  /** Writes the image where `prefs` says and runs the follow-up actions. Returns the vault file or the system path. */
  async exportWith(prefs: ExportPrefs): Promise<TFile | string> {
    const d = this.design; if (!d) throw new Error('no-canvas');
    const sourcePath = d.source; const source = sourcePath ? this.app.vault.getAbstractFileByPath(sourcePath) : null;
    const note = source instanceof TFile && source.extension === 'md' ? source : null;
    if ((prefs.insert || prefs.cover) && !note) throw new Error(this.t('sourceMissing'));
    await this.flush();
    const p = this.platform(); const now = new Date(); const pad = (n: number): string => String(n).padStart(2, '0');
    const base = renderFilename(prefs.filename, {
      name: this.file?.basename ?? 'Cover', platform: p?.id ?? 'custom', size: `${d.width}x${d.height}`,
      date: `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`, time: `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
    });
    const out = await this.encode(prefs, p?.maxBytes);
    const ext = out.format === 'jpeg' ? 'jpg' : out.format; const data = await out.blob.arrayBuffer();
    let result: TFile | string;
    if (prefs.destination === 'system') {
      result = await this.plugin.writeSystemFile(prefs.systemDir || this.plugin.settings.export.systemDir || '', `${base}.${ext}`, data);
    } else {
      const folder = prefs.destination === 'note' && note?.parent && !note.parent.isRoot() ? note.parent.path : folderPath(prefs.folder || this.plugin.settings.exportFolder);
      if (!(prefs.destination === 'note' && note)) await this.plugin.ensureFolder(folder);
      const target = prefs.destination === 'note' && note?.parent?.isRoot() ? await this.rootPath(base, ext) : this.plugin.unique(folder, base, ext);
      result = await this.app.vault.createBinary(target, data);
    }
    if (result instanceof TFile && note) {
      if (prefs.insert) await this.insertEmbed(note, result);
      if (prefs.cover) await this.app.fileManager.processFrontMatter(note, fm => { (fm as Record<string, unknown>).cover = this.app.fileManager.generateMarkdownLink(result as TFile, note.path); });
    }
    if (prefs.copy) { try { await this.copyPng(); } catch (e) { this.plugin.report(e); } }
    d.export = { ...d.export, format: prefs.format, scale: prefs.scale, quality: prefs.quality, destination: prefs.destination, folder: prefs.folder, systemDir: prefs.systemDir, filename: prefs.filename, insert: prefs.insert, cover: prefs.cover, copy: prefs.copy, fitLimit: prefs.fitLimit };
    this.plugin.settings.export = { ...this.plugin.settings.export, format: prefs.format, scale: prefs.scale, quality: prefs.quality, destination: prefs.destination, folder: prefs.folder, systemDir: prefs.systemDir, filename: prefs.filename, fitLimit: prefs.fitLimit };
    void this.plugin.saveSettings(); this.changed();
    new Notice(this.t('exportDone', { path: typeof result === 'string' ? result : result.path }) + (out.format !== prefs.format ? ` · ${this.t('exportConverted', { format: out.format.toUpperCase() })}` : ''));
    return result;
  }
  private async rootPath(base: string, ext: string): Promise<string> { return this.plugin.unique('', base, ext); }
  private async insertEmbed(note: TFile, image: TFile): Promise<void> {
    const link = this.app.fileManager.generateMarkdownLink(image, note.path); const embed = link.startsWith('!') ? link : `!${link}`;
    const view = this.app.workspace.getLeavesOfType('markdown').map(l => l.view).find((v): v is MarkdownView => v instanceof MarkdownView && v.file?.path === note.path);
    if (view) { view.editor.replaceSelection(`${embed}\n`); return; }
    await this.app.vault.process(note, text => `${text.trimEnd()}\n\n${embed}\n`);
  }
  async copyPng(): Promise<void> {
    const w = this.win; if (!w.ClipboardItem || !w.navigator.clipboard?.write) throw new Error(this.t('unsupported'));
    await w.navigator.clipboard.write([new w.ClipboardItem({ 'image/png': this.pngBlob() })]); new Notice(this.t('copied'));
  }
  safeBase(): string { return safeName(this.file?.basename ?? 'Cover'); }
}

function mimeOf(ext: string): string { const e = ext.toLowerCase(); return e === 'webp' ? 'image/webp' : e === 'png' ? 'image/png' : 'image/jpeg'; }
function readDataUrl(win: Window, blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const r = new (win as Window & typeof globalThis).FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
}
