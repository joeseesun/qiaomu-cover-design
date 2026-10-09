import { FileView, MarkdownView, Menu, Notice, setIcon, TFile, WorkspaceLeaf } from 'obsidian';
import { ActiveSelection, Canvas, StaticCanvas, Circle, FabricImage, FabricObject, Line, Path, Polygon, Rect, Shadow, Textbox, Triangle, getEnv, loadSVGFromString, setEnv, util } from 'fabric';
import { cutout, opaqueBounds } from './cutout';
import { calmLayout, decorOnText, layoutPass } from './calm';
import { faceFor, isSingleWeight, pillFor, styleText, type TextPreset } from './textstyles';
import { openInsertPopover } from './insertpop';
import { resolvePair, typeFor, usePairing, type Resolved } from './typeset';
import { Background, Design, ExportFormat, ExportPrefs, EXPORT_DEFAULTS, folderPath, History, parseDesign, renderFilename, safeName, SerialWriter, SnapshotCodec, validSize } from './model';
import { Platform, PLATFORMS, platformById, platformFor } from './platforms';
import { BadgeBox } from './badge';
import { arrangeForSubject, builtPalette, canReflow, reserveBelowTitle, rewrap, sourceOf, unwrap, templateById, templatesFor, gradient, hasCjk, textbox, textWidth, tightenCopy } from './templates';
import { decorInFront, drawDecor } from './decor';
import { expandPattern, patternById } from './playbook';
import { renderPattern } from './preview';
import { MESH_PRESETS, MeshPreset } from './mesh';
import { glow as kitGlow, grain } from './kit';
import { Anchor, decorPlacement, defaultSubjectBox, SubjectBox, TitleBox } from './compose';
import { clearOfZones, ensureReadable, thumbCheck } from './quality';
import { addSeries, pickVariants, Series } from './series';
import { imageStyleById } from './prompts';
import { Align, AssistantInput, CanvasItem, CoverApi, DecorSpec, DesignSpec, Op, runOps } from './ops';
import { Key } from './i18n';
import type CoverPlugin from './main';
import { renderDrawer, renderInspector, renderLayers } from './panels';
import { iconButton, textButton, toggleButton } from './ui';
import { ExportModal, RenameModal, SizeModal, ShortcutsModal, PickFile } from './modals';

export const VIEW = 'qiaomu-cover-design';
export interface Variant { id: string; label: string; url: string }
export interface ChatMessage { role: 'user' | 'assistant'; text: string; applied?: string[]; retry?: boolean; variants?: Variant[]; tweaks?: boolean }
export type QObject = FabricObject & { qcRole?: string; qcShadow?: string; qcKind?: string; qcPrompt?: string; qcAnchor?: string; qcWrapped?: boolean; qcHug?: boolean; qcTpl?: boolean };
export const PROPS = ['qcRole', 'qcShadow', 'qcKind', 'qcPrompt', 'qcAnchor', 'qcWrapped', 'qcSource', 'qcHug', 'qcTpl', 'qcCredit'];
type Layout = Pick<DesignSpec, 'title' | 'subtitle' | 'badge' | 'points' | 'palette'>;
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
  stage?: HTMLElement; inspectorEl?: HTMLElement; private drawerEl?: HTMLElement; private emptyHint?: HTMLElement; private baseRevision = 0; private lastDrawer: 'templates' | 'add' | 'fonts' | 'assistant' = 'assistant'; private guidesEl?: HTMLElement; private snapEl?: HTMLElement;
  private statusEl?: HTMLElement; private zoomLabel?: HTMLElement; private undoBtn?: HTMLButtonElement; private redoBtn?: HTMLButtonElement; private platformBtn?: HTMLElement;
  zoom: number | 'fit' = 'fit'; rightTab: 'design' | 'layers' | 'canvas' = 'canvas'; private tabsEl?: HTMLElement; private refreshQueued = false;
  private unsubscribeFonts?: () => void;
  /** Conversation with the designer. It lives on the view so it survives drawer redraws. */
  chat: ChatMessage[] = []; busy = false; progress = ''; private centerEl?: HTMLElement; private progressEl?: HTMLElement; onChat?: () => void; private lastPrompt = ''; currentPattern?: string; private lastSpec?: DesignSpec; palette?: import('./templates').Palette; private templateId?: string;

  constructor(leaf: WorkspaceLeaf, public plugin: CoverPlugin) { super(leaf); }
  getViewType(): string { return VIEW; }
  getDisplayText(): string { return this.file?.basename || this.plugin.t('open'); }
  getIcon(): string { return 'image'; }
  get doc(): Document { return this.contentEl.ownerDocument; }
  get win(): Window & typeof globalThis { return this.doc.defaultView as Window & typeof globalThis; }
  t(key: Key, params?: Record<string, string | number>): string { return this.plugin.t(key, params); }
  get zh(): boolean { return this.plugin.isZh(); }
  async onOpen(): Promise<void> { this.contentEl.addClass('qc-root'); this.containerEl.addClass('qc-headerless'); this.plugin.ai.warm(); }

  /* ---------- lifecycle ---------- */
  async onLoadFile(file: TFile): Promise<void> {
    const generation = ++this.generation; this.closingView = false; this.restoring = true; this.dirty = false;
    try {
      const raw = await this.app.vault.read(file); const design = parseDesign(raw);
      if (generation !== this.generation) return;
      this.expected = raw; this.design = design; this.templateId = design.template; this.codec = new SnapshotCodec(); this.history = new History();
      await this.plugin.fonts.register(this.doc);
      this.build();
      if (generation !== this.generation || !this.canvas) return;
      await this.canvas.loadFromJSON(design.canvas);
      await this.afterLoad();
      if (generation !== this.generation || !this.canvas) return;
      this.history.reset(this.snapshot()); this.restoring = false; this.baseRevision = this.revision;
      this.applyZoom(); this.refreshAll(); this.setStatus('saved'); this.updateEmptyHint();
      const brief = this.plugin.takeBrief(file.path); if (brief) void this.autoDesign(brief);
      this.unsubscribeFonts = this.plugin.fonts.onChange(() => { void this.reflowFonts(); this.refreshInspector(true); });
    } catch (e) {
      this.restoring = true; this.contentEl.empty(); this.contentEl.createEl('p', { text: this.t('invalidDesign'), cls: 'qc-invalid-note' }); this.plugin.report(e);
    }
  }
  async onUnloadFile(): Promise<void> {
    this.closingView = true; this.clearTimers(); this.unsubscribeFonts?.(); this.unsubscribeFonts = undefined;
    const untouched = !!this.file && this.plugin.scratch.has(this.file.path) && this.revision === this.baseRevision;
    this.commitHistory(); await this.flush();
    if (untouched && this.file) { this.plugin.scratch.delete(this.file.path); try { await this.app.fileManager.trashFile(this.file); } catch { /* leave the file if it cannot be removed */ } this.dirty = false; }
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
    // Saving is automatic, so it stays silent; only a failure is worth a word.
    this.statusEl?.setText(key === 'failed' ? this.t(key) : ''); this.statusEl?.setAttribute('data-state', key);
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
    iconButton(left, 'panel-left', this.t('togglePanel'), () => this.toggleDrawer());
    this.platformBtn = left.createEl('button', { cls: 'qc-platform', attr: { type: 'button' } });
    this.platformBtn.addEventListener('click', e => this.platformMenu(e));
    const mid = header.createDiv('qc-header-mid');
    const insertBtn = textButton(mid, this.zh ? '插入' : 'Insert', () => openInsertPopover(this, insertBtn), 'qc-btn-sm', 'plus');
    mid.createSpan({ cls: 'qc-sep' });
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
    const copyBtn = textButton(right, this.zh ? '复制' : 'Copy', () => void this.copyToClipboard(copyBtn), 'qc-btn-sm', 'copy');
    copyBtn.title = this.zh ? '复制图片到剪贴板，可直接粘贴到别的应用（⌘⇧C）' : 'Copy the image to the clipboard (⌘⇧C)';
    const exportGroup = right.createDiv('qc-split');
    textButton(exportGroup, this.t('export'), () => void this.action(() => this.openExport()), 'qc-primary', 'download');
    iconButton(exportGroup, 'chevron-down', this.t('exportMore'), e => this.exportMenu(e), 'qc-primary qc-split-more');

    const main = root.createDiv('qc-main');
    this.drawerEl = main.createDiv('qc-drawer');
    const center = main.createDiv('qc-center'); this.centerEl = center;
    this.stage = center.createDiv('qc-stage'); this.stage.tabIndex = 0;
    const element = this.stage.createEl('canvas');
    const win = this.win;
    setEnv({ ...getEnv(), document: this.doc, window: win });
    this.canvas = new Canvas(element, { width: design.width, height: design.height, backgroundColor: '#ffffff', preserveObjectStacking: true, selectionColor: 'rgba(13,153,255,0.10)', selectionBorderColor: '#0d99ff', selectionLineWidth: 1, uniformScaling: true });
    Object.assign(FabricObject.ownDefaults, { cornerStyle: 'circle', cornerColor: '#ffffff', cornerStrokeColor: '#0d99ff', borderColor: '#0d99ff', transparentCorners: false, cornerSize: 10, touchCornerSize: 24, padding: 3, borderScaleFactor: 1.5, originX: 'left', originY: 'top' });
    this.bindCanvas();
    const wrapper = this.canvas.wrapperEl;
    // Clicking the grey area around the artboard deselects, like every design tool. Panels on either side keep the selection because they edit it.
    this.stage.addEventListener('pointerdown', e => { if (!wrapper.contains(e.target as Node) && this.canvas?.getActiveObject()) { this.canvas.discardActiveObject(); this.canvas.requestRenderAll(); } });
    this.guidesEl = wrapper.createDiv('qc-guides'); this.snapEl = wrapper.createDiv('qc-snaplines');
    this.zoomBar(center);
    this.inspectorEl = main.createDiv('qc-inspector');
    const tabs = this.inspectorEl.createDiv('qc-tabs'); const body = this.inspectorEl.createDiv('qc-inspector-body');
    this.tabsEl = tabs;
    for (const id of ['design', 'layers', 'canvas'] as const) {
      const b = tabs.createEl('button', { cls: 'qc-tab', attr: { type: 'button', 'data-tab': id } }); b.setText(this.t(id === 'design' ? 'tabDesign' : id === 'layers' ? 'layers' : 'tabCanvas'));
      b.classList.toggle('is-active', this.rightTab === id);
      b.addEventListener('click', () => { this.rightTab = id; this.syncTabs(); this.refreshInspector(true); });
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
    m.addItem(i => i.setTitle(this.t('renameDesign')).setIcon('pencil').onClick(() => { if (this.file) new RenameModal(this.plugin, this.file).open(); }));
    m.addItem(i => i.setTitle(this.t('newCover')).setIcon('image-plus').onClick(() => this.plugin.openNew()));
    m.addItem(i => i.setTitle(this.t('openOther')).setIcon('folder-open').onClick(() => this.plugin.chooseDesign()));
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
    c.on('text:changed', e => { const t = e.target as (Textbox & QObject) | undefined; if (t) { t.splitByGrapheme = hasCjk(t.text); this.rehug(t); } this.changed(); });
    for (const ev of ['selection:created', 'selection:updated', 'selection:cleared'] as const) c.on(ev, () => this.refreshInspector(true));
    c.on('object:moving', e => { if (this.plugin.settings.guides.snap && e.target) this.snapMove(e.target); });
    c.on('mouse:up', () => this.clearSnap()); c.on('mouse:down', () => { this.snapCache = undefined; });
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
  /** Guide lines gathered once per drag. Decorative layers (grain, glows, scrims, full-bleed pictures) are not snap targets, which also keeps dragging cheap. */
  private snapCache?: { xs: number[]; ys: number[]; stickyX?: number; stickyY?: number; shownX?: number; shownY?: number };
  private snapLines(): { xs: number[]; ys: number[] } {
    const c = this.canvas!, d = this.design!; const active = c.getActiveObjects();
    const p = platformFor(d.width, d.height, d.platform); const margin = (p?.margin ?? 0.05) * Math.min(d.width, d.height);
    const xs = [0, d.width / 2, d.width, margin, d.width - margin]; const ys = [0, d.height / 2, d.height, margin, d.height - margin];
    for (const o of c.getObjects()) {
      const role = (o as QObject).qcRole; if (active.includes(o) || !o.visible || role === 'grain' || role === 'bgfx' || role === 'scrim' || role === 'ghost' || role === 'flourish') continue;
      const r = o.getBoundingRect(); if (r.width * r.height > d.width * d.height * 0.6) continue;
      xs.push(r.left, r.left + r.width / 2, r.left + r.width); ys.push(r.top, r.top + r.height / 2, r.top + r.height);
    }
    return { xs, ys };
  }
  private snapMove(target: FabricObject): void {
    const c = this.canvas!, d = this.design!; const th = 6 / c.getZoom(); this.snapCache ??= this.snapLines(); const cache = this.snapCache;
    const b = target.getBoundingRect();
    // Sticky: once on a line the object stays there until the pointer has clearly moved away, instead of flipping in and out every frame.
    const best = (edges: number[], lines: number[], sticky?: number): { delta: number; line: number } | undefined => {
      let hit: { delta: number; line: number } | undefined;
      for (const e of edges) for (const l of lines) { const dist = l - e; const reach = l === sticky ? th * 1.8 : th; if (Math.abs(dist) <= reach && (!hit || Math.abs(dist) < Math.abs(hit.delta))) hit = { delta: dist, line: l }; }
      return hit;
    };
    const sx = best([b.left, b.left + b.width / 2, b.left + b.width], cache.xs, cache.stickyX); const sy = best([b.top, b.top + b.height / 2, b.top + b.height], cache.ys, cache.stickyY);
    cache.stickyX = sx?.line; cache.stickyY = sy?.line;
    if (sx) target.set({ left: target.left + sx.delta }); if (sy) target.set({ top: target.top + sy.delta });
    if (sx || sy) target.setCoords();
    const el = this.snapEl; if (!el) return;
    if (cache.shownX === sx?.line && cache.shownY === sy?.line) return; // only touch the DOM when the visible guides change
    cache.shownX = sx?.line; cache.shownY = sy?.line; el.empty();
    if (sx) { const l = el.createDiv('qc-snap-v'); l.style.left = `${(sx.line / d.width) * 100}%`; }
    if (sy) { const l = el.createDiv('qc-snap-h'); l.style.top = `${(sy.line / d.height) * 100}%`; }
  }
  private clearSnap(): void { this.snapEl?.empty(); this.snapCache = undefined; }

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
    // Text we wrapped ourselves was measured before its face loaded: wrap it again with the real metrics.
    for (const t of texts) { rewrap(t); t.initDimensions(); t.set('dirty', true); t.setCoords(); }
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
    this.dirty = true; ++this.revision; this.setStatus('saving'); this.updateEmptyHint();
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
    renderDrawer(this, this.drawerEl!); this.refreshInspector(true); this.renderGuides(); this.updatePlatformLabel();
  }
  refreshDrawer(): void { if (this.drawerEl) { if (this.plugin.settings.drawer) this.lastDrawer = this.plugin.settings.drawer; renderDrawer(this, this.drawerEl); } this.updateEmptyHint(); }
  toggleDrawer(): void { const s = this.plugin.settings; s.drawer = s.drawer ? '' : this.lastDrawer; void this.plugin.saveSettings(); this.refreshDrawer(); this.applyZoom(); }
  private syncTabs(): void { for (const b of Array.from(this.tabsEl?.children ?? [])) b.classList.toggle('is-active', b.getAttribute('data-tab') === this.rightTab); }
  refreshInspector(force = false): void {
    const el = this.inspectorBody; if (!el || !this.canvas) return;
    const a = this.doc.activeElement; if (!force && a && el.contains(a)) return;
    // Rebuilding while the user types would drop focus and break IME composition.
    if (!force && a && el.contains(a)) return;
    // Picking something on the canvas shows its properties; clicking empty space goes back to the canvas settings. Layers stays put.
    const has = this.selection().length > 0;
    if (has && this.rightTab === 'canvas') { this.rightTab = 'design'; this.syncTabs(); } else if (!has && this.rightTab === 'design') { this.rightTab = 'canvas'; this.syncTabs(); }
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
  /**
   * New text hugs its own length and lands in the middle of the artboard, centred, so it is already a sensible thing to drag
   * from. Only text longer than the safe width wraps. It keeps hugging as the words are edited (see `rehug`).
   */
  addText(text = this.t('newText'), o: { size?: number; color?: string; font?: string; bold?: boolean; align?: 'left' | 'center' | 'right' } = {}): Textbox {
    const d = this.design!; const m = Math.round(Math.min(d.width, d.height) * 0.08); const size = o.size ?? Math.round(Math.min(d.width, d.height) * 0.09);
    const weight = o.bold === false ? 'normal' : 'bold'; const maxW = d.width - m * 2;
    const widest = Math.max(...text.split('\n').map(l => textWidth(l, size, weight)));
    const width = Math.min(maxW, Math.ceil(widest + size * 0.12));
    const count = this.canvas!.getObjects().filter(x => x instanceof Textbox).length;
    const box = textbox(text, 0, 0, width, { fontSize: size, fill: o.color ?? '#171717', fontWeight: weight, fontFamily: o.font ?? this.plugin.settings.defaultFont, textAlign: o.align ?? 'center' });
    (box as QObject).qcHug = true;
    box.set({ left: Math.round((d.width - box.width) / 2), top: Math.round((d.height - box.getScaledHeight()) / 2 + (count % 5) * d.height * 0.07) });
    this.place(box); return box;
  }
  /** Keeps a hugging text box exactly as wide as its longest line after an edit, around the same centre. */
  rehug(t: Textbox & QObject): void {
    const d = this.design; if (!d || !t.qcHug) return;
    const m = Math.round(Math.min(d.width, d.height) * 0.08); const size = t.fontSize * t.scaleY; const weight = String(t.fontWeight) === 'bold' || Number(t.fontWeight) >= 600 ? 'bold' : 'normal';
    const widest = Math.max(...t.text.split('\n').map(l => textWidth(l, t.fontSize, weight))); const width = Math.min(d.width - m * 2, Math.ceil(widest + t.fontSize * 0.12));
    const cx = t.left + t.getScaledWidth() / 2; t.set({ width, left: cx - (width * t.scaleX) / 2 }); t.initDimensions(); t.setCoords(); void size;
  }
  addPreset(kind: 'title' | 'subtitle' | 'body' | 'marker' | 'outline' | 'shadow' | 'tag' | 'number'): Textbox {
    const d = this.design!; const u = Math.min(d.width, d.height) / 1000;
    const label = { title: this.t('presetTitle'), subtitle: this.t('presetSubtitle'), body: this.t('presetBody'), marker: this.t('presetMarker'), outline: this.t('presetOutline'), shadow: this.t('presetShadow'), tag: this.t('presetTag'), number: '01' }[kind];
    const base: Record<string, unknown> = {
      title: { size: 110 * u, bold: true }, subtitle: { size: 52 * u, bold: false, color: '#525252' }, body: { size: 36 * u, bold: false, color: '#404040' },
      marker: { size: 96 * u, bold: true }, outline: { size: 130 * u, bold: true, color: '#ffffff' }, shadow: { size: 110 * u, bold: true, color: '#ffe04b' }, tag: { size: 40 * u, bold: true, color: '#ffffff' }, number: { size: 220 * u, bold: true, color: '#e11d2e' },
    }[kind];
    if (kind === 'tag' || kind === 'marker') { // real pills (word centred, padding fixed to the type size) instead of a long text box with a background
      const c = this.canvas!; const size = Math.round(base.size as number); const tag = kind === 'tag';
      const pill = new BadgeBox(label, { fontSize: size, fontWeight: 'bold', fill: tag ? '#ffffff' : '#171717', badgeBg: tag ? '#e11d2e' : '#ffe04b', radius: tag ? 0.5 : 0.14, padX: tag ? 0.7 : 0.4, fontFamily: this.plugin.settings.defaultFont } as ConstructorParameters<typeof BadgeBox>[1]);
      const count = c.getObjects().filter(x => x instanceof Textbox).length;
      pill.set({ left: Math.round((this.design!.width - pill.width) / 2), top: Math.round((this.design!.height - pill.height) / 2 + (count % 5) * this.design!.height * 0.07) });
      this.place(pill); return pill;
    }
    const box = this.addText(label, { size: Math.round(base.size as number), color: base.color as string | undefined, bold: base.bold as boolean });
    if (kind === 'outline') box.set({ stroke: '#111111', strokeWidth: Math.max(4, Math.round(10 * u)), paintFirst: 'stroke' });
    if (kind === 'shadow') { box.set({ shadow: SHADOWS.hard!('#111111') }); (box as QObject).qcShadow = 'hard'; }
    box.initDimensions(); box.setCoords(); this.canvas!.requestRenderAll(); this.changed(); this.refreshInspector(true);
    return box;
  }
  /** Adds a text style from the Insert menu, centred and offset a little so repeated adds do not stack exactly. */
  addTextStyle(p: TextPreset): Textbox {
    const d = this.design!; const u = Math.min(d.width, d.height) / 1000; const have = (f: string): boolean => this.plugin.fonts.available(this.doc, f);
    const face = faceFor(p.font, have) ?? this.plugin.settings.defaultFont; const label = this.zh ? p.sample : p.sampleEn; const size = Math.round(p.size * u);
    if (p.pill) {
      const pill = pillFor(p, label, size, face); const count = this.canvas!.getObjects().filter(x => x instanceof Textbox).length;
      pill.set({ left: Math.round((d.width - pill.width) / 2), top: Math.round((d.height - pill.height) / 2 + (count % 5) * d.height * 0.07) }); void this.plugin.fonts.ensure(this.doc, face).then(() => { pill.initDimensions(); this.canvas?.requestRenderAll(); });
      this.place(pill); return pill;
    }
    const box = this.addText(label, { size, ...(p.color ? { color: p.color } : {}), font: face, bold: p.weight !== 'normal' && !isSingleWeight(face) });
    this.rehug(box as Textbox & QObject); styleText(box, p, size); (box as QObject).qcShadow = p.shadow && p.shadow.blur === 0 ? 'hard' : undefined;
    box.setCoords(); this.canvas!.requestRenderAll(); this.changed(); this.refreshInspector(true); return box;
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
    if (type !== 'line') o.set({ left: Math.round((d.width - o.getScaledWidth()) / 2), top: Math.round((d.height - o.getScaledHeight()) / 2) });
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
  /** A mesh background: a base colour plus soft light blobs (and fine grain) sitting behind everything, locked so they never get in the way. */
  applyMesh(preset: MeshPreset, withGrain = true): void {
    const c = this.canvas, d = this.design; if (!c || !d) return;
    for (const o of c.getObjects().filter(x => (x as QObject).qcRole === 'bgfx')) c.remove(o);
    this.applyBackground({ kind: 'solid', color: preset.base }, false);
    const side = Math.min(d.width, d.height); const fx: FabricObject[] = preset.glows.map(g => kitGlow(g.x * d.width, g.y * d.height, g.r * side * 1.1, g.color, g.a));
    const gr = withGrain ? grain(d.width, d.height, 0.1, 5) : undefined; if (gr) fx.push(gr);
    fx.forEach((o, i) => { (o as QObject).qcRole = 'bgfx'; (o as QObject).qcKind = preset.id; o.set({ selectable: false, evented: false, hoverCursor: 'default' }); c.insertAt(i, o); });
    this.qualityPass(); c.requestRenderAll(); this.changed(); this.refreshInspector(true);
  }
  hasMesh(): boolean { return !!this.canvas?.getObjects().some(o => (o as QObject).qcRole === 'bgfx'); }
  applyBackground(bg: Background, record = true): void {
    const c = this.canvas, d = this.design; if (!c || !d) return;
    if (record) for (const o of c.getObjects().filter(x => (x as QObject).qcRole === 'bgfx')) c.remove(o);
    d.bg = bg; c.backgroundColor = bg.kind === 'solid' ? bg.color : gradient(d.width, d.height, bg.from, bg.to, bg.angle);
    c.requestRenderAll(); if (record) this.changed();
  }
  setBackground(spec: { color?: string; from?: string; to?: string; angle?: number }): boolean {
    if (spec.color) this.applyBackground({ kind: 'solid', color: spec.color });
    else if (spec.from && spec.to) this.applyBackground({ kind: 'linear', from: spec.from, to: spec.to, angle: spec.angle ?? 135 });
    else return false;
    this.refreshInspector(true); return true;
  }
  /**
   * Switching platform re-lays the cover out for the new shape when it came from a template: the same words, palette, picture
   * and decoration, but headline size, spacing and anchors recomputed for the new proportions. Without a template (a cover built by
   * hand) it falls back to scaling everything to fit.
   */
  setPlatform(id: string, relayout = true): boolean {
    const p = platformById(id); if (!p) return false; const d = this.design; if (!d) return false;
    const tpl = d.template ? templateById(d.template) : undefined; const shapeChanged = d.width !== p.width || d.height !== p.height;
    if (relayout && shapeChanged && tpl && this.canvas) { this.relayout(p, tpl.id); return true; }
    this.resizeTo(p.width, p.height, true, p); return true;
  }
  private relayout(p: Platform, tplId: string): void {
    const d = this.design!, c = this.canvas!; const ow = d.width, oh = d.height; const copy = this.copyText(); const spec = this.lastSpec;
    const mesh = c.getObjects().find(o => (o as QObject).qcRole === 'bgfx') as QObject | undefined; const meshId = mesh?.qcKind;
    this.resizeTo(p.width, p.height, false, p);
    const s = Math.min(p.width / ow, p.height / oh); const ox = (p.width - ow * s) / 2, oy = (p.height - oh * s) / 2;
    for (const o of c.getObjects().filter(x => !(x as QObject).qcTpl && !(x as QObject).qcRole)) { // the user's own pieces: scale to fit the new frame
      if (o instanceof Textbox) o.set({ fontSize: o.fontSize * s, width: o.width * s, strokeWidth: o.strokeWidth * s }); else o.set({ scaleX: o.scaleX * s, scaleY: o.scaleY * s });
      o.set({ left: o.left * s + ox, top: o.top * s + oy }); if (o instanceof Textbox) o.initDimensions(); o.setCoords();
    }
    this.applyTemplate(tplId, { title: copy.title, subtitle: copy.subtitle, badge: copy.badge, points: spec?.points, palette: spec?.palette }, ['image', 'subject', 'decor', '*user']);
    for (const o of c.getObjects()) { const q = o as QObject; if (q.qcRole === 'subject') this.fitSubject(o); else if (q.qcRole === 'image' && !o.clipPath) this.fitImage(o, 'cover'); }
    this.finishLayout(spec, false);
    if (meshId) { const m = MESH_PRESETS.find(x => x.id === meshId); if (m) this.applyMesh(m); }
    c.requestRenderAll(); this.changed(); this.refreshInspector(true);
    new Notice(this.t('relaidOut', { platform: this.zh ? p.zh : p.en }));
  }
  /** Titles, anchors and quality checks after any layout: shared by a fresh design and a platform re-layout. */
  private finishLayout(spec: DesignSpec | undefined, expectSubject: boolean): void {
    const c = this.canvas, d = this.design; if (!c || !d) return;
    if (spec?.titleFont && this.plugin.fonts.available(this.doc, spec.titleFont)) this.styleText('title', { font: spec.titleFont });
    if (spec?.bodyFont && this.plugin.fonts.available(this.doc, spec.bodyFont)) this.styleText('subtitle', { font: spec.bodyFont });
    const hasSubject = expectSubject || c.getObjects().some(o => (o as QObject).qcRole === 'subject');
    this.followTitle(() => {
      // Only plain text-block layouts are re-stacked; styles with stickers, rules or frames keep the arrangement they were designed with.
      if (canReflow(d.template)) { if (hasSubject) arrangeForSubject(c.getObjects(), d.width, d.height); else tightenCopy(c.getObjects(), d.width, d.height); }
      this.reanchorDecor(); this.calm(); layoutPass(c.getObjects(), d.width, d.height);
    });
  }
  private following = false;
  /**
   * Shapes drawn for the headline itself (a highlighter or brush stroke, tagged qcKind 'mark-title') move and scale with it
   * when a pass restacks the words, so they never stay behind on an empty spot.
   */
  private followTitle<T>(run: () => T): T {
    const c = this.canvas; const title = c?.getObjects().find((o): o is Textbox => o instanceof Textbox && (o as QObject).qcRole === 'title');
    const marks = c?.getObjects().filter(o => (o as QObject).qcKind === 'mark-title') ?? [];
    if (this.following || !c || !title || !marks.length) return run();
    const x0 = title.left, y0 = title.top, s0 = title.fontSize * title.scaleY;
    this.following = true; let out: T; try { out = run(); } finally { this.following = false; }
    const k = (title.fontSize * title.scaleY) / s0;
    if (k !== 1 || title.left !== x0 || title.top !== y0) for (const m of marks) {
      if (!c.getObjects().includes(m)) continue;
      m.set({ left: title.left + (m.left - x0) * k, top: title.top + (m.top - y0) * k, scaleX: m.scaleX * k, scaleY: m.scaleY * k }); m.setCoords();
    }
    return out;
  }
  /** One hero, one headline, at most one accent: thins ornaments, keeps the subject off the words, keeps decoration off the text. */
  calm(): void {
    const c = this.canvas, d = this.design; if (!c || !d) return;
    const hasSubject = c.getObjects().some(o => (o as QObject).qcRole === 'subject');
    if (hasSubject) this.followTitle(() => calmLayout(() => c.getObjects(), o => { c.remove(o); }, d.width, d.height, d.template));
    for (const o of decorOnText(c.getObjects(), d.width, d.height)) c.remove(o);
    c.requestRenderAll();
  }
  /** Puts a subject picture where the placement rules say for the current shape (right on wide canvases, lower middle on tall ones). */
  private fitSubject(img: FabricObject): void {
    const d = this.design!; const portrait = d.height > d.width * 1.1; const boxW = portrait ? d.width * 0.86 : d.width * 0.46, boxH = portrait ? d.height * 0.5 : d.height * 0.9;
    const k = Math.min(boxW / img.width, boxH / img.height); const w = img.width * k, h = img.height * k;
    img.set({ scaleX: k, scaleY: k, left: portrait ? (d.width - w) / 2 : d.width - w - d.width * 0.04, top: portrait ? d.height - h - d.height * 0.03 : (d.height - h) / 2 }); img.setCoords();
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
  /** Re-lays the design out from a template, keeping the user's own title and subtitle unless `over` supplies new copy. */
  /** `keepLayers` carries the picture, subject and decoration over, so changing the layout never throws the artwork away. */
  applyTemplate(id: string, over: Layout = {}, keepLayers: boolean | string[] = false): boolean {
    const t = templateById(id), c = this.canvas, d = this.design; if (!t || !c || !d) return false;
    const keepRoles = Array.isArray(keepLayers) ? keepLayers : keepLayers ? ['image', 'subject', 'decor'] : [];
    const kept = c.getObjects().filter(o => keepRoles.includes((o as QObject).qcRole ?? ''));
    // Things the user added themselves (no template flag, no role) can be carried over too, so a re-layout never deletes their work.
    const mine = keepRoles.includes('*user') ? c.getObjects().filter(o => !(o as QObject).qcTpl && !(o as QObject).qcRole) : [];
    const copy = this.copyText();
    const pair = this.pairing(t.id); usePairing(pair);
    let result: ReturnType<typeof t.build>;
    try { result = t.build({ width: d.width, height: d.height, title: over.title ?? copy.title, subtitle: over.subtitle ?? copy.subtitle, badge: over.badge ?? copy.badge, points: over.points, palette: over.palette, zh: this.zh }); } finally { usePairing(undefined); }
    this.missingFonts = pair.missing;
    c.discardActiveObject(); this.restoring = true;
    try {
      c.remove(...c.getObjects()); for (const o of result.objects) c.add(o);
      const scrim = c.getObjects().findIndex(o => (o as QObject).qcRole === 'scrim');
      for (const o of kept.filter(k => (k as QObject).qcRole === 'image' && !k.clipPath)) c.insertAt(Math.max(0, scrim), o);
      for (const o of kept.filter(k => !((k as QObject).qcRole === 'image' && !k.clipPath))) c.insertAt(this.belowText(), o);
      for (const o of mine) c.add(o);
    } finally { this.restoring = false; }
    this.templateId = t.id; d.template = t.id; this.palette = builtPalette(); for (const o of result.objects) (o as QObject).qcTpl = true;
    this.applyBackground(result.background, false);
    // A bundled font that is not loaded yet was measured with a fallback face: load it, then lay the template out again with real metrics.
    const faces = [pair.title, pair.body].filter((f): f is string => !!f && this.plugin.fonts.needsLoad(this.doc, f));
    if (faces.length && !this.relaying) {
      this.relaying = true;
      void Promise.all(faces.map(f => this.plugin.fonts.ensure(this.doc, f))).then(() => { if (this.canvas && this.design?.template === t.id) this.applyTemplate(id, over, keepLayers); }).finally(() => { this.relaying = false; });
    }
    void this.reflowFonts().then(() => { layoutPass(c.getObjects(), d.width, d.height); c.requestRenderAll(); this.changed(); }); this.changed(); this.refreshInspector(true); return true;
  }
  private relaying = false;
  /** Fonts the template would like to use but that are not installed yet; the drawer offers to fetch them. */
  missingFonts: string[] = [];
  pairing(templateId: string | undefined): Resolved { return resolvePair(templateId, family => this.plugin.fonts.available(this.doc, family)); }
  /** After fonts are installed: swaps generic families on template text for the paired faces and re-measures. */
  repairFonts(): void {
    const c = this.canvas; if (!c) return;
    const pair = this.pairing(this.design?.template ?? this.templateId); usePairing(pair);
    try {
      for (const o of c.getObjects()) {
        if (!(o instanceof Textbox)) continue; const q = o as Textbox & QObject; if (!q.qcRole) continue;
        const tf = typeFor(q.qcRole, o.fontFamily, String(o.fontWeight)); if (tf.fontFamily) o.set(tf);
      }
    } finally { usePairing(undefined); }
    void this.reflowFonts().then(() => { c.requestRenderAll(); this.changed(); this.refreshInspector(true); });
  }
  copyText(): { title: string; subtitle: string; badge?: string } {
    const texts = (this.canvas?.getObjects() ?? []).filter((o): o is Textbox & QObject => o instanceof Textbox);
    const title = texts.find(o => o.qcRole === 'title') ?? [...texts].sort((a, b) => b.fontSize * b.scaleY - a.fontSize * a.scaleY)[0];
    const sub = texts.find(o => o.qcRole === 'subtitle') ?? [...texts].filter(o => o !== title).sort((a, b) => b.fontSize - a.fontSize)[0];
    const badge = texts.find(o => o.qcRole === 'badge')?.text.trim();
    const flat = (t?: Textbox & QObject): string | undefined => t ? sourceOf(t) : undefined;
    return { title: flat(title) ?? this.design?.source?.replace(/^.*\//, '').replace(/\.md$/, '') ?? this.t('newText'), subtitle: flat(sub) ?? this.t('subtext'), ...(badge ? { badge } : {}) };
  }

  /* ---------- the designer ---------- */
  /** One-shot layout from a spec: sizes the canvas, picks a template that suits the picture, then generates the picture. */
  async applyDesign(input: DesignSpec): Promise<string[]> {
    const d = this.design; if (!d || !this.canvas) return [];
    const spec = expandPattern(input, family => this.plugin.fonts.available(this.doc, family));
    const notes: string[] = []; const zh = this.zh; this.lastSpec = spec; if (spec.pattern) this.currentPattern = spec.pattern;
    if (spec.platform && spec.platform !== this.platform()?.id && this.setPlatform(spec.platform, false)) notes.push(zh ? `已切换平台：${spec.platform}` : `Platform: ${spec.platform}`);
    const imageOkEarly = this.plugin.ai.imageReady(); const picture = !!spec.imagePrompt && imageOkEarly;
    let role: 'background' | 'side' | undefined = picture ? spec.imageRole ?? 'background' : undefined;
    let tpl = (spec.template ? templateById(spec.template) : undefined) ?? templatesFor(this.platform()?.id)[0]!;
    if (role === 'side' && !tpl.slot?.({ width: d.width, height: d.height, title: '', subtitle: '', zh })) role = 'background';
    if (role === 'background' && !tpl.photo) tpl = templateById('photo')!;
    // Re-theming or re-wording must not throw away a picture the user already likes: keep artwork unless this design brings new.
    const newArt = !!spec.imagePrompt || !!spec.subjectPrompt; const keep = newArt ? [] : spec.decor ? ['image', 'subject'] : ['image', 'subject', 'decor'];
    this.applyTemplate(tpl.id, spec, keep); notes.push(zh ? `已套用模板：${tpl.zh}` : `Template: ${tpl.en}`);
    this.finishLayout(spec, !!spec.subjectPrompt && imageOkEarly);
    // Vector decoration is free (the chat model drew it), so it never waits on or depends on an image model.
    if (spec.decor?.length) { notes.push(await this.addDecor(spec.decor.slice(0, spec.subjectPrompt && imageOkEarly ? 1 : 2))); this.calm(); }
    notes.push(...this.qualityPass());
    const jobs: Promise<void>[] = []; const fail = (e: unknown): string => this.t('imageFailed', { message: e instanceof Error ? e.message : String(e) });
    const imageOk = this.plugin.ai.imageReady();
    if (spec.imagePrompt && !role) notes.push(this.t('imageSkipped'));
    else if (spec.imagePrompt && role) jobs.push(this.generateImage(spec.imagePrompt, role).then(n => { notes.push(n); }, (e: unknown) => { notes.push(fail(e)); }));
    if (spec.subjectPrompt) {
      if (!imageOk) notes.push(this.t('imageSkipped'));
      else jobs.push(this.generateSubject(spec.subjectPrompt, spec.subjectAt).then(n => { notes.push(n); }, (e: unknown) => { notes.push(fail(e)); }));
    }
    if (jobs.length) this.setProgress(this.t(spec.subjectPrompt ? 'progressSubject' : 'progressImage'));
    await Promise.all(jobs);
    notes.push(...this.qualityPass(), ...this.thumbIssues());
    return notes;
  }
  /** A blank artboard says where to start instead of looking broken. Not part of the cover, so it is never exported. */
  updateEmptyHint(): void {
    const c = this.canvas; const host = this.centerEl; if (!c || !host) return;
    const empty = c.getObjects().length === 0;
    if (!empty) { this.emptyHint?.remove(); this.emptyHint = undefined; return; }
    if (this.emptyHint?.isConnected) return;
    const box = host.createDiv('qc-empty-hint'); this.emptyHint = box; setIcon(box.createSpan({ cls: 'qc-empty-hint-icon' }), 'sparkles');
    box.createDiv({ text: this.t('emptyHintTitle'), cls: 'qc-empty-hint-title' }); box.createDiv({ text: this.t('emptyHintBody'), cls: 'qc-empty-hint-body' });
  }
  /** Shows what the designer is doing, in the chat and as a floating chip over the canvas, so a 30 s picture never looks like a hang. */
  setProgress(text = ''): void {
    this.progress = text; const host = this.centerEl;
    if (host && text) {
      if (!this.progressEl?.isConnected) { this.progressEl = host.createDiv('qc-progress'); setIcon(this.progressEl.createSpan({ cls: 'qc-progress-icon' }), 'loader-circle'); this.progressEl.createSpan({ cls: 'qc-progress-text' }); }
      this.progressEl.querySelector('.qc-progress-text')!.textContent = text;
    } else { this.progressEl?.remove(); this.progressEl = undefined; }
    this.onChat?.();
  }
  /** Runs after a design: keeps text off platform UI (avatar, duration badge, stats bar) and readable on its background. Returns what it fixed. */
  qualityPass(): string[] { return this.followTitle(() => this.qualityChecks()); }
  private qualityChecks(): string[] {
    const c = this.canvas, d = this.design; if (!c || !d) return [];
    const notes: string[] = []; const pf = this.platform();
    const texts = c.getObjects().filter((o): o is Textbox & QObject => o instanceof Textbox && !o.lockMovementX);
    let moved = 0;
    if (pf?.avoid.length) {
      const zones = pf.avoid.map(z => ({ x: z.x * d.width, y: z.y * d.height, w: z.w * d.width, h: z.h * d.height, zh: z.zh, en: z.en }));
      for (const t of texts) {
        const box = { x: t.left, y: t.top, w: t.getScaledWidth(), h: t.getScaledHeight() }; const y = clearOfZones(box, zones, d.height, d.height * 0.02);
        if (y !== undefined) { t.set({ top: y }); t.setCoords(); moved++; }
      }
    }
    if (moved) notes.push(this.zh ? `已让 ${moved} 处文字避开平台遮挡区` : `Moved ${moved} text layer${moved > 1 ? 's' : ''} clear of platform UI`);
    const bg = d.bg?.kind === 'solid' ? d.bg.color : d.bg?.kind === 'linear' ? d.bg.from : undefined;
    const fullBleed = c.getObjects().some(o => (o as QObject).qcRole === 'image' && !o.clipPath);
    let fixed = 0;
    const panels = c.getObjects().filter(o => !(o instanceof Textbox) && !(o instanceof FabricImage) && !['decor', 'subject', 'image', 'scrim'].includes((o as QObject).qcRole ?? '') && o.opacity >= 0.5);
    const onPanel = (t: Textbox): boolean => panels.some(p => { const r = p.getBoundingRect(); const cx = t.left + t.getScaledWidth() / 2, cy = t.top + t.getScaledHeight() / 2; return cx > r.left && cx < r.left + r.width && cy > r.top && cy < r.top + r.height && r.width < d.width * 0.98; });
    if (bg && !fullBleed) for (const t of texts) {
      if (t.textBackgroundColor || t.stroke || typeof t.fill !== 'string' || onPanel(t)) continue;
      const next = ensureReadable(t.fill, bg); if (next !== t.fill) { t.set({ fill: next }); fixed++; }
    }
    if (fixed) notes.push(this.zh ? `已提高 ${fixed} 处文字的对比度` : `Raised contrast on ${fixed} text layer${fixed > 1 ? 's' : ''}`);
    if (moved || fixed) { c.requestRenderAll(); this.changed(); }
    return notes;
  }
  /** Index just below the first text layer: pictures and stickers sit behind the words, above the background. */
  private belowText(): number { const c = this.canvas!; const i = c.getObjects().findIndex(o => o instanceof Textbox); return i < 0 ? c.getObjects().length : i; }
  /** Where the subject will be (or is): its real box once it exists, otherwise the region the placement rules reserve for it. */
  private subjectBox(): SubjectBox {
    const sub = this.canvas!.getObjects().find(o => (o as QObject).qcRole === 'subject');
    if (sub) return { cx: sub.left + sub.getScaledWidth() / 2, cy: sub.top + sub.getScaledHeight() / 2, w: sub.getScaledWidth(), h: sub.getScaledHeight() };
    return defaultSubjectBox(this.design!.width, this.design!.height);
  }
  /** Centre and width for a piece, resolved from what it is attached to, so decoration follows the subject and the headline. */
  private decorPlace(a: Anchor, ratio: number, kind = ''): { cx: number; cy: number; width: number } {
    const d = this.design!; const title = this.canvas!.getObjects().find((o): o is Textbox & QObject => o instanceof Textbox && (o as QObject).qcRole === 'title');
    const tb: TitleBox | undefined = title ? { left: title.left, top: title.top, height: title.getScaledHeight(), fontSize: title.fontSize * title.scaleY, lastLineWidth: title.getLineWidth(Math.max(0, title.textLines.length - 1)) * title.scaleX } : undefined;
    return decorPlacement(a, ratio, kind, { width: d.width, height: d.height, subject: this.subjectBox(), title: tb });
  }
  /** A filled vector shape from an SVG path (24 × 24 box), in the palette accent so it matches the cover; fill and stroke stay editable. */
  addPathShape(d24: string, ratio = 1): void {
    const c = this.canvas, d = this.design; if (!c || !d) return;
    const o = new Path(d24, { fill: this.palette?.accent ?? '#2563eb', originX: 'center', originY: 'center' });
    const target = Math.min(d.width, d.height) * 0.26; const k = target / Math.max(o.width, o.height, 1);
    o.set({ scaleX: k * ratio, scaleY: k, left: d.width / 2, top: d.height / 2 }); o.setCoords(); c.add(o); c.setActiveObject(o); c.requestRenderAll(); this.changed(); this.refreshInspector(true);
  }
  /** Drops a sticker or icon on the canvas as an editable vector group, centred and sized to about a fifth of the cover. */
  async addAssetSvg(svg: string): Promise<void> {
    const c = this.canvas, d = this.design; if (!c || !d) return;
    const parsed = await loadSVGFromString(svg); const objects = parsed.objects.filter((o): o is FabricObject => !!o); if (!objects.length) throw new Error('empty svg');
    const group = util.groupSVGElements(objects, parsed.options) as FabricObject;
    const target = Math.min(d.width, d.height) * 0.22; const scale = target / Math.max(group.width, group.height, 1);
    group.set({ scaleX: scale, scaleY: scale, left: d.width / 2, top: d.height / 2, originX: 'center', originY: 'center' });
    c.add(group); c.setActiveObject(group); group.setCoords(); c.requestRenderAll(); this.changed(); this.refreshInspector(true);
  }
  /** A photo as the full-bleed background: replaces any earlier background picture, sits under everything else. */
  async addBackgroundPhoto(blob: Blob, credit: string): Promise<void> {
    const generation = this.generation; const url = await this.prepareImage(blob, true);
    const image = await FabricImage.fromURL(url);
    const c = this.canvas; if (generation !== this.generation || this.closingView || !c || !this.design) return;
    for (const old of c.getObjects().filter(o => (o as QObject).qcRole === 'image' && !o.clipPath)) c.remove(old);
    (image as QObject).qcRole = 'image'; (image as QObject).qcPrompt = undefined; (image as FabricObject & { qcCredit?: string }).qcCredit = credit;
    this.fitImage(image, 'cover'); c.add(image);
    const scrim = c.getObjects().findIndex(o => (o as QObject).qcRole === 'scrim'); c.moveObjectTo(image, Math.max(0, scrim < 0 ? 0 : scrim));
    image.setCoords(); c.requestRenderAll(); this.changed(); this.refreshInspector(true);
  }
  /** Adds pieces from the decoration library as editable vector groups, coloured from the current palette. */
  async addDecor(list: DecorSpec[]): Promise<string> {
    const c = this.canvas, d = this.design; if (!c || !d) return '';
    const p = this.palette ?? { ink: '#171717', accent: '#ef4444', sub: '#737373', bg2: '#e5e5e5', accentInk: '#ffffff' };
    const generation = this.generation; let added = 0;
    for (const item of list) {
      try {
        const art = drawDecor(item.kind, p, item.tone); if (!art) continue;
        const parsed = await loadSVGFromString(art.svg); const objects = parsed.objects.filter((o): o is FabricObject => !!o);
        if (!objects.length) continue;
        const group = util.groupSVGElements(objects, parsed.options) as FabricObject;
        if (generation !== this.generation || this.closingView || !this.canvas) return '';
        const anchor = { at: item.at ?? 'canvas', x: item.x, y: item.y, w: item.w } as const;
        const pos = this.decorPlace(anchor, art.ratio, item.kind); const scale = pos.width / Math.max(1, group.width);
        group.set({ scaleX: scale, scaleY: scale, left: pos.cx, top: pos.cy, originX: 'center', originY: 'center', angle: item.rotate ?? 0, opacity: item.opacity ?? 1 });
        (group as QObject).qcRole = 'decor'; (group as QObject).qcKind = item.kind; (group as QObject).qcAnchor = JSON.stringify(anchor);
        if (anchor.at === 'title') reserveBelowTitle(c.getObjects(), pos.cy + pos.width / art.ratio / 2);
        this.placeDecorLayer(group); group.setCoords(); added++;
      } catch { /* a piece that fails to import is skipped, the rest still land */ }
    }
    if (added) { c.requestRenderAll(); this.changed(); this.refreshInspector(true); }
    return added ? (this.zh ? `已添加 ${added} 个矢量装饰（可编辑）` : `Added ${added} editable vector decoration${added > 1 ? 's' : ''}`) : '';
  }
  /** Background structure goes behind the subject, small marks in front of it, and everything stays under the text. */
  private placeDecorLayer(o: FabricObject): void {
    const c = this.canvas!; const kind = (o as QObject).qcKind ?? '';
    if (decorInFront(kind)) { c.insertAt(this.belowText(), o); return; }
    const objs = c.getObjects(); const sub = objs.findIndex(x => (x as QObject).qcRole === 'subject');
    let floor = 0; objs.forEach((x, i) => { const r = (x as QObject).qcRole; if ((r === 'image' && !x.clipPath) || r === 'scrim') floor = i + 1; });
    c.insertAt(sub >= 0 ? sub : floor, o);
  }
  /** After the subject lands or moves, pieces attached to it are re-centred and re-sized on its real box, and front marks return above it. */
  private reanchorDecor(): void {
    const c = this.canvas; if (!c) return;
    for (const o of c.getObjects()) {
      const q = o as QObject; if (q.qcRole !== 'decor' || !q.qcAnchor) continue;
      let a: Anchor; try { a = JSON.parse(q.qcAnchor) as Anchor; } catch { continue; }
      const ratio = o.width / Math.max(1, o.height); const pos = this.decorPlace(a, ratio); const scale = pos.width / Math.max(1, o.width);
      o.set({ scaleX: scale, scaleY: scale, left: pos.cx, top: pos.cy, originX: 'center', originY: 'center' }); o.setCoords();
    }
    const fronts = c.getObjects().filter(o => (o as QObject).qcRole === 'decor' && decorInFront((o as QObject).qcKind ?? ''));
    for (const o of fronts) { c.remove(o); c.insertAt(this.belowText(), o); }
    const behind = c.getObjects().filter(o => (o as QObject).qcRole === 'decor' && !decorInFront((o as QObject).qcKind ?? ''));
    const sub = c.getObjects().findIndex(x => (x as QObject).qcRole === 'subject');
    if (sub >= 0) for (const o of behind) { if (c.getObjects().indexOf(o) > sub) { c.remove(o); c.insertAt(c.getObjects().findIndex(x => (x as QObject).qcRole === 'subject'), o); } }
  }
  /** Generates one subject on a flat key colour, cuts it out locally and adds it as its own transparent layer. Falls back to the full picture. */
  async generateSubject(prompt: string, at: 'left' | 'right' | 'center' | undefined, keep?: FabricObject): Promise<string> {
    const d = this.design; if (!this.canvas || !d) throw new Error('no-canvas');
    const generation = this.generation;
    const pic = await this.plugin.ai.image(prompt, d.width, d.height, imageStyleById(this.plugin.settings.imageStyle).prompt, true);
    if (generation !== this.generation || this.closingView) return this.t('imageDropped');
    const bitmap = await this.win.createImageBitmap(new Blob([pic.data], { type: pic.type }));
    let blob: Blob | undefined; let cut = false;
    try {
      const cv = this.doc.createElement('canvas'); cv.width = bitmap.width; cv.height = bitmap.height;
      const ctx = cv.getContext('2d')!; ctx.drawImage(bitmap, 0, 0);
      const px = ctx.getImageData(0, 0, cv.width, cv.height); const out = cutout(px.data, cv.width, cv.height);
      const box = out ? opaqueBounds(out.data, cv.width, cv.height) : undefined;
      if (out && box) {
        px.data.set(out.data); ctx.putImageData(px, 0, 0);
        const crop = this.doc.createElement('canvas'); crop.width = box.w; crop.height = box.h; crop.getContext('2d')!.drawImage(cv, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
        blob = await new Promise<Blob | null>(r => crop.toBlob(r, 'image/png')) ?? undefined; cut = !!blob;
      }
    } finally { bitmap.close(); }
    const url = await this.prepareImage(blob ?? new Blob([pic.data], { type: pic.type }), !cut);
    const image = await FabricImage.fromURL(url);
    const c = this.canvas; if (generation !== this.generation || this.closingView || !c) return this.t('imageDropped');
    const was = keep ?? c.getObjects().find(o => (o as QObject).qcRole === 'subject');
    const spot = was ? { cx: was.left + was.getScaledWidth() / 2, cy: was.top + was.getScaledHeight() / 2, h: was.getScaledHeight() } : undefined;
    for (const old of c.getObjects().filter(o => (o as QObject).qcRole === 'subject')) c.remove(old);
    (image as QObject).qcRole = 'subject'; (image as QObject).qcPrompt = prompt;
    for (const f of c.getObjects().filter(o => (o as QObject).qcRole === 'flourish')) c.remove(f);
    const portrait = d.height > d.width * 1.1;
    const boxW = portrait ? d.width * 0.86 : d.width * 0.46, boxH = portrait ? d.height * 0.5 : d.height * 0.9;
    const s = Math.min(boxW / image.width, boxH / image.height);
    const side = at ?? (portrait ? 'center' : 'right');
    const w = image.width * s, h = image.height * s;
    image.set({ scaleX: s, scaleY: s, left: side === 'left' ? d.width * 0.04 : side === 'right' ? d.width - w - d.width * 0.04 : (d.width - w) / 2, top: portrait ? d.height - h - d.height * 0.03 : (d.height - h) / 2 });
    if (keep && spot) { const k = spot.h / image.height; image.set({ scaleX: k, scaleY: k, left: spot.cx - (image.width * k) / 2, top: spot.cy - spot.h / 2 }); }
    c.insertAt(this.belowText(), image); image.setCoords(); this.reanchorDecor(); if (!keep) this.calm(); c.requestRenderAll(); this.changed(); this.refreshInspector(true);
    return cut ? (this.zh ? '已生成主体（透明图层，可拖动）' : 'Subject added as a transparent layer') : (this.zh ? '主体抠图失败，已作为整图放入' : 'Cut-out failed; added the full picture');
  }
  /** Asks the image model for a picture and places it behind the text (full bleed) or in the template's picture slot. */
  async generateImage(prompt: string, role: 'background' | 'side'): Promise<string> {
    const d = this.design; if (!this.canvas || !d) throw new Error('no-canvas');
    if (!this.plugin.ai.imageReady()) return this.t('imageSkipped');
    const generation = this.generation;
    const pic = await this.plugin.ai.image(prompt, d.width, d.height, imageStyleById(this.plugin.settings.imageStyle).prompt);
    if (generation !== this.generation || this.closingView) return this.t('imageDropped');
    const url = await this.prepareImage(new Blob([pic.data], { type: pic.type }), true);
    const image = await FabricImage.fromURL(url);
    const c = this.canvas; if (generation !== this.generation || this.closingView || !c) return this.t('imageDropped');
    for (const old of c.getObjects().filter(o => (o as QObject).qcRole === 'image')) c.remove(old);
    (image as QObject).qcRole = 'image'; (image as QObject).qcPrompt = prompt;
    const slot = role === 'side' ? templateById(this.templateId ?? '')?.slot?.({ width: d.width, height: d.height, title: '', subtitle: '', zh: this.zh }) : undefined;
    if (slot) {
      const s = Math.max(slot.w / image.width, slot.h / image.height);
      image.set({ scaleX: s, scaleY: s, left: slot.x + (slot.w - image.width * s) / 2, top: slot.y + (slot.h - image.height * s) / 2, clipPath: new Rect({ left: slot.x, top: slot.y, width: slot.w, height: slot.h, rx: slot.radius, ry: slot.radius, absolutePositioned: true }) });
      const firstText = c.getObjects().findIndex(o => o instanceof Textbox);
      c.insertAt(firstText < 0 ? c.getObjects().length : firstText, image);
    } else {
      this.fitImage(image, 'cover'); c.add(image);
      const scrim = c.getObjects().findIndex(o => (o as QObject).qcRole === 'scrim');
      c.moveObjectTo(image, Math.max(0, scrim < 0 ? 0 : scrim));
    }
    image.setCoords(); c.requestRenderAll(); this.changed(); this.refreshInspector(true);
    return this.zh ? '已生成配图' : 'Picture added';
  }
  private canvasItems(): CanvasItem[] {
    return (this.canvas?.getObjects() ?? []).slice(0, 14).map((o): CanvasItem => {
      const q = o as QObject;
      if (o instanceof Textbox) return { kind: 'text', role: q.qcRole, text: o.text.trim(), size: Math.round(o.fontSize * o.scaleY), color: typeof o.fill === 'string' ? o.fill : undefined };
      return { kind: o instanceof FabricImage ? 'image' : 'shape', role: q.qcRole };
    });
  }
  assistantInput(prompt: string): AssistantInput {
    const sel = this.selection()[0];
    const history = this.chat.slice(0, -1).filter(m => m.text).map(m => ({ role: m.role, text: m.text.slice(0, 400) }));
    return {
      prompt, zh: this.zh, fonts: this.plugin.fonts.all().map(f => f.family), platform: this.platform()?.id, size: { width: this.design!.width, height: this.design!.height },
      selected: sel instanceof Textbox ? sel.text : undefined, canvas: this.canvasItems(), history, imageStyle: imageStyleById(this.plugin.settings.imageStyle).prompt || undefined, pattern: this.currentPattern, noPicture: this.plugin.settings.imageStyle === 'none', series: this.plugin.settings.series,
    };
  }
  /** Sends a request to the selected assistant and applies what comes back. Shared by the chat box, retry and auto-design. */
  async ask(prompt: string, display = prompt): Promise<void> {
    if (this.busy || this.restoring || !this.canvas) return;
    const list = this.plugin.assistantList(); const extras = list.some(p => p.id !== 'ai' && p.id !== 'offline'); const provider = (extras ? list.find(p => p.id === this.plugin.settings.assistant) : list.find(p => p.id === 'ai')) ?? list[0]!;
    this.busy = true; this.lastPrompt = prompt; this.chat.push({ role: 'user', text: display }); this.setProgress(this.t('progressPlan'));
    try {
      const result = await provider.run(this.assistantInput(prompt));
      if (!this.canvas) return;
      const applied = await this.runAssistantOps(result.ops);
      const designed = result.ops.some(o => o.op === 'design');
      const message: ChatMessage = { role: 'assistant', text: result.reply || (applied.length ? this.t('chatDone') : this.t('chatNothing')), applied, retry: designed, tweaks: applied.length > 0 };
      this.chat.push(message);
      if (designed) void this.variantThumbs().then(v => { message.variants = v; this.onChat?.(); }).catch(() => undefined);
    } catch (e) {
      this.chat.push({ role: 'assistant', text: this.t('error', { message: e instanceof Error ? e.message : String(e) }) });
    } finally { this.busy = false; this.setProgress(); }
  }
  /**
   * Other layouts for the same words, rendered offline in a blink, so a first pass is a choice and not a gamble. They come from
   * different style families and follow the copy (a number, a question, a list), and use the fonts each layout really gets.
   */
  async variantThumbs(n = 4): Promise<Variant[]> {
    const d = this.design, c = this.canvas; if (!d || !c) return [];
    const copy = this.copyText(); const hasPhoto = c.getObjects().some(o => (o as QObject).qcRole === 'image' && !o.clipPath);
    const candidates = templatesFor(this.platform()?.id).filter(t => !['checklist', 'compare'].includes(t.id) && (hasPhoto || !t.photo)).map(t => t.id);
    const out: Variant[] = [];
    for (const id of pickVariants(candidates, this.templateId, { title: copy.title, subtitle: copy.subtitle, points: this.lastSpec?.points }, n)) {
      const t = templateById(id); if (!t) continue;
      const sc = new StaticCanvas(this.doc.createElement('canvas'), { width: d.width, height: d.height, enableRetinaScaling: false });
      usePairing(this.pairing(t.id));
      try {
        const r = t.build({ width: d.width, height: d.height, title: copy.title, subtitle: copy.subtitle, badge: copy.badge, points: this.lastSpec?.points, zh: this.zh });
        for (const o of r.objects) sc.add(o);
        sc.backgroundColor = r.background.kind === 'solid' ? r.background.color : gradient(d.width, d.height, r.background.from, r.background.to, r.background.angle);
        sc.renderAll(); out.push({ id: t.id, label: this.zh ? t.zh : t.en, url: sc.toDataURL({ format: 'jpeg', quality: 0.72, multiplier: Math.min(1, 280 / d.width) }) });
      } catch { /* a layout that cannot be previewed is simply not offered */ } finally { usePairing(undefined); void sc.dispose(); }
    }
    return out;
  }
  /** A/B on demand: three clearly different directions for the current words, shown in the assistant panel. */
  async showVariants(): Promise<void> {
    if (!this.canvas) return;
    this.plugin.settings.drawer = 'assistant'; void this.plugin.saveSettings(); this.refreshDrawer(); this.applyZoom();
    const message: ChatMessage = { role: 'assistant', text: this.t('abTitle') }; this.chat.push(message); this.onChat?.();
    message.variants = await this.variantThumbs(3); this.onChat?.();
  }
  /* ---------- series: one look reused across covers ---------- */
  /** Saves the current layout, colours and faces as a series (newest first; the first one is the default). */
  saveSeries(): Series | undefined {
    const d = this.design, c = this.canvas; if (!d?.template || !c) return undefined;
    const t = templateById(d.template); const texts = c.getObjects().filter((o): o is Textbox & QObject => o instanceof Textbox);
    const face = (role: string): string | undefined => { const f = texts.find(o => o.qcRole === role)?.fontFamily; return f && !['sans-serif', 'serif', 'monospace'].includes(f) ? f : undefined; };
    const palette = { ...(this.palette ?? {}) }; const titleFont = face('title'), bodyFont = face('subtitle');
    const list = this.plugin.settings.series;
    const base = t ? (this.zh ? t.zh : t.en) : d.template; const taken = new Set(list.map(x => x.name)); let n = 1; while (taken.has(`${base} ${n}`)) n++;
    const s: Series = { id: `s${Date.now().toString(36)}`, name: `${base} ${n}`, template: d.template, palette, ...(titleFont ? { titleFont } : {}), ...(bodyFont ? { bodyFont } : {}) };
    this.plugin.settings.series = addSeries(list, s); void this.plugin.saveSettings(); return s;
  }
  removeSeries(id: string): void { this.plugin.settings.series = this.plugin.settings.series.filter(s => s.id !== id); void this.plugin.saveSettings(); }
  /** Re-lays the cover in a saved look, keeping the words, picture and decoration. */
  async applySeries(id: string): Promise<void> {
    const s = this.plugin.settings.series.find(x => x.id === id); if (!s || !templateById(s.template)) return;
    await this.applyDesign({ template: s.template, palette: s.palette, ...(s.titleFont ? { titleFont: s.titleFont } : {}), ...(s.bodyFont ? { bodyFont: s.bodyFont } : {}) });
    new Notice(this.t('seriesApplied', { name: s.name }));
  }
  /** What the cover looks like as a card in a phone feed: words too small to read, or a headline too long to take in. */
  thumbIssues(): string[] {
    const c = this.canvas, d = this.design; if (!c || !d) return [];
    const texts = c.getObjects().filter((o): o is Textbox & QObject => o instanceof Textbox && ((o as QObject).qcRole === 'title' || ((o as QObject).qcRole === 'subtitle' && !(o instanceof BadgeBox))))
      .map(o => ({ role: o.qcRole as 'title' | 'subtitle', size: o.fontSize * o.scaleY, text: o.qcWrapped ? unwrap(o.text) : o.text }));
    return thumbCheck(texts, d.width, this.platform()?.id).map(x => x.kind === 'long' ? this.t('thumbLong') : this.t('thumbSmall', { role: this.t(x.role === 'title' ? 'roleTitle' : 'roleSubtitle'), px: x.px ?? 0, min: x.min ?? 0 }));
  }
  private patternCache = new Map<string, Promise<string>>();
  /** Thumbnail of a pattern at this canvas's size (cached per platform and size). */
  patternThumb(id: string): Promise<string> {
    const d = this.design; const p = patternById(id); if (!d || !p) return Promise.reject(new Error('no-pattern'));
    const key = `${d.width}x${d.height}:${id}:${this.zh}`; let hit = this.patternCache.get(key);
    if (!hit) { hit = renderPattern(p, { width: d.width, height: d.height }, this.doc, this.zh, family => this.plugin.fonts.available(this.doc, family)); this.patternCache.set(key, hit); hit.catch(() => this.patternCache.delete(key)); }
    return hit;
  }
  /** Applies a pattern with its sample words straight away. Used when no model is connected. */
  async applyPatternNow(id: string): Promise<void> {
    const p = patternById(id); if (!p || this.busy || !this.canvas) return;
    this.busy = true;
    try { const notes = await this.applyDesign({ pattern: id, title: p.sample.title, subtitle: p.sample.subtitle, badge: p.sample.badge, points: p.sample.points }); this.chat.push({ role: 'assistant', text: this.t('patternApplied', { name: this.zh ? p.zh : p.en }), applied: notes }); }
    finally { this.busy = false; this.onChat?.(); }
  }
  /** Touch edit: redraws one picture layer from its own prompt (optionally edited) and keeps its place on the canvas. */
  async regenerate(target: QObject, prompt: string): Promise<void> {
    if (this.busy || !prompt.trim()) return;
    if (!this.plugin.ai.imageReady()) { new Notice(this.t('imageSkipped')); return; }
    this.busy = true; this.setProgress(this.t(target.qcRole === 'subject' ? 'progressSubject' : 'progressImage'));
    try {
      if (target.qcRole === 'subject') new Notice(await this.generateSubject(prompt.trim(), undefined, target));
      else new Notice(await this.generateImage(prompt.trim(), target.clipPath ? 'side' : 'background'));
    } catch (e) { new Notice(this.t('imageFailed', { message: e instanceof Error ? e.message : String(e) })); } finally { this.busy = false; this.setProgress(); }
  }
  retry(): Promise<void> { return this.ask(`${this.lastPrompt}\n\n${this.t('retryHint')}`, this.t('retry')); }
  /** The note this cover was made for, when it still exists. Lets the empty chat offer a one-click cover. */
  sourceNote(): TFile | undefined { const path = this.design?.source; const f = path ? this.plugin.app.vault.getFileByPath(path) : null; return f && f.extension === 'md' ? f : undefined; }
  /** Designs from the linked note's text (frontmatter and fenced code stripped) without any copy-paste. */
  async coverFromSourceNote(): Promise<void> {
    const note = this.sourceNote(); if (!note) return;
    const raw = await this.plugin.app.vault.cachedRead(note);
    const text = raw.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/```[\s\S]*?```/g, '').trim().slice(0, 6000);
    await this.autoDesign(`${note.basename}\n\n${text}`);
  }
  private async autoDesign(brief: string): Promise<void> {
    this.plugin.settings.drawer = 'assistant'; void this.plugin.saveSettings(); this.refreshDrawer(); this.applyZoom();
    await this.ask(`${this.t('briefPrefix')}\n${brief}`, brief.length > 140 ? `${brief.slice(0, 140)}…` : brief);
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
  async runAssistantOps(ops: Op[]): Promise<string[]> {
    const done = await runOps(this, ops, this.zh);
    // Any change (a new background, a new colour) can leave words unreadable, so readability is re-checked after every run.
    if (ops.some(o => o.op !== 'design' && o.op !== 'undo' && o.op !== 'redo')) done.push(...this.qualityPass());
    return done;
  }

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
  async prepareImage(blob: Blob, compact = false): Promise<string> {
    if (blob.size > MAX_IMAGE_BYTES || !['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) throw new Error(this.t('imageLimit'));
    const bitmap = await this.win.createImageBitmap(blob);
    try {
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
      if (!compact && scale === 1 && blob.size < 6 * 1024 * 1024) return await readDataUrl(this.win, blob);
      const canvas = this.doc.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const type = !compact && blob.type === 'image/png' ? 'image/png' : 'image/webp';
      const out = await new Promise<Blob | null>(r => canvas.toBlob(r, type, 0.9));
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
    else if (mod && event.shiftKey && k === 'c') run = () => this.copyToClipboard();
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
  /** PNG on the clipboard, ready to paste into a chat, a post editor or a slide. */
  async copyToClipboard(btn?: HTMLElement): Promise<void> {
    if (!this.canvas || !this.design) return;
    try {
      const source = this.render(Math.min(2, this.exportPrefs().scale || 1));
      const blob = await new Promise<Blob>((res, rej) => source.toBlob(b => b ? res(b) : rej(new Error('export-failed')), 'image/png'));
      const Item = (this.win as unknown as { ClipboardItem: typeof ClipboardItem }).ClipboardItem;
      await this.win.navigator.clipboard.write([new Item({ 'image/png': blob })]);
      new Notice(this.zh ? '已复制图片，直接粘贴就行' : 'Image copied. Just paste it.');
      if (btn) { btn.addClass('is-done'); this.win.setTimeout(() => btn.removeClass('is-done'), 1200); }
    } catch (e) { new Notice(this.zh ? `复制失败：${e instanceof Error ? e.message : String(e)}。可以改用导出。` : 'Copy failed. Use Export instead.'); }
  }
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
