import { Notice, setIcon } from 'obsidian';
import { Circle, FabricImage, FabricObject, Line, Polygon, Rect, StaticCanvas, Textbox, Triangle } from 'fabric';
import type { CoverView, QObject } from './view';
import { SHADOWS } from './view';
import { DrawerTab } from './config';
import { GROUPS, PLATFORMS, platformFor } from './platforms';
import { TEMPLATES, Template, gradient } from './templates';
import { colorControl, field, group, iconButton, numberBox, onEnter, segmented, slider, textButton } from './ui';
import { openFontPopover, renderFontBrowser } from './fontbrowser';
import { AssistantResult, AssistantInput } from './ops';
import { Background } from './model';
import { bytes } from './ui';

/* ---------- left rail and drawers ---------- */
const TABS: { id: DrawerTab; icon: string; key: 'tabTemplates' | 'tabAdd' | 'tabFonts' | 'tabAssistant' }[] = [
  { id: 'templates', icon: 'layout-template', key: 'tabTemplates' }, { id: 'add', icon: 'shapes', key: 'tabAdd' },
  { id: 'fonts', icon: 'a-large-small', key: 'tabFonts' }, { id: 'assistant', icon: 'sparkles', key: 'tabAssistant' },
];
export function renderRail(view: CoverView, el: HTMLElement): void {
  el.empty(); const current = view.plugin.settings.drawer;
  for (const tab of TABS) {
    const b = el.createEl('button', { cls: 'qc-rail-btn', attr: { type: 'button' } });
    setIcon(b.createSpan({ cls: 'qc-rail-icon' }), tab.icon); b.createSpan({ text: view.t(tab.key), cls: 'qc-rail-label' });
    b.classList.toggle('is-active', current === tab.id); b.setAttribute('aria-pressed', String(current === tab.id));
    b.addEventListener('click', () => { view.plugin.settings.drawer = current === tab.id ? '' : tab.id; void view.plugin.saveSettings(); view.refreshDrawer(); view.applyZoom(); });
  }
}
export function renderDrawer(view: CoverView, el: HTMLElement): void {
  el.empty(); const tab = view.plugin.settings.drawer; el.toggleClass('is-open', !!tab);
  if (!tab) return;
  const head = el.createDiv('qc-drawer-head'); head.createSpan({ text: view.t(TABS.find(x => x.id === tab)!.key), cls: 'qc-drawer-title' });
  iconButton(head, 'panel-left-close', view.t('close'), () => { view.plugin.settings.drawer = ''; void view.plugin.saveSettings(); view.refreshDrawer(); view.applyZoom(); });
  const body = el.createDiv('qc-drawer-body');
  if (tab === 'templates') drawerTemplates(view, body);
  else if (tab === 'add') drawerAdd(view, body);
  else if (tab === 'fonts') renderFontBrowser(view, body, { current: view.texts()[0]?.fontFamily ?? view.plugin.settings.defaultFont, onPick: f => view.setFont(f) });
  else drawerAssistant(view, body);
  view.win.requestAnimationFrame(() => view.applyZoom());
}

const previewCache = new Map<string, string>();
/** Renders a small PNG of a template at the given canvas size. */
export async function templateThumb(doc: Document, zh: boolean, width: number, height: number, t: Template, title: string, subtitle: string): Promise<string> {
  const key = `${t.id}|${width}x${height}|${title}|${subtitle}|${zh}`;
  const hit = previewCache.get(key); if (hit) return hit;
  const el = doc.createElement('canvas'); const sc = new StaticCanvas(el, { width, height, renderOnAddRemove: false, enableRetinaScaling: false });
  const r = t.build({ width, height, title, subtitle, zh });
  sc.backgroundColor = r.background.kind === 'solid' ? r.background.color : gradient(width, height, r.background.from, r.background.to, r.background.angle);
  for (const o of r.objects) sc.add(o);
  sc.renderAll();
  const url = sc.toDataURL({ format: 'png', multiplier: 260 / Math.max(width, height), enableRetinaScaling: false });
  await sc.dispose(); if (previewCache.size > 120) previewCache.clear(); previewCache.set(key, url); return url;
}
function drawerTemplates(view: CoverView, body: HTMLElement): void {
  body.createDiv({ text: view.t('templatesHint'), cls: 'qc-hint' });
  const grid = body.createDiv('qc-template-grid'); const copy = view.copyText();
  for (const t of TEMPLATES) {
    const card = grid.createEl('button', { cls: 'qc-template', attr: { type: 'button' } });
    const thumb = card.createDiv('qc-template-thumb'); thumb.style.aspectRatio = `${view.design!.width} / ${view.design!.height}`;
    card.createSpan({ text: view.zh ? t.zh : t.en, cls: 'qc-template-name' });
    card.addEventListener('click', () => void view.action(() => { view.applyTemplate(t.id); }));
    void templateThumb(view.doc, view.zh, view.design!.width, view.design!.height, t, copy.title, copy.subtitle).then(url => { if (card.isConnected) thumb.createEl('img', { attr: { src: url, alt: '' } }); }).catch(() => undefined);
  }
}
function drawerAdd(view: CoverView, body: HTMLElement): void {
  const text = group(body, view.t('text'));
  const presets: ['title' | 'subtitle' | 'body' | 'marker' | 'outline' | 'shadow' | 'tag' | 'number', string][] = [
    ['title', view.t('presetTitle')], ['subtitle', view.t('presetSubtitle')], ['body', view.t('presetBody')], ['marker', view.t('presetMarker')],
    ['outline', view.t('presetOutline')], ['shadow', view.t('presetShadow')], ['tag', view.t('presetTag')], ['number', '01'],
  ];
  const grid = text.createDiv('qc-preset-grid');
  for (const [kind, label] of presets) {
    const b = grid.createEl('button', { cls: `qc-preset qc-preset-${kind}`, attr: { type: 'button' } }); b.createSpan({ text: label });
    b.addEventListener('click', () => void view.action(() => { view.addPreset(kind); }));
  }
  const shapes = group(body, view.t('shapes')); const sg = shapes.createDiv('qc-shape-grid');
  const kinds: ['rect' | 'rounded' | 'circle' | 'triangle' | 'line' | 'star', string, string][] = [
    ['rect', 'square', 'rectangle'], ['rounded', 'rectangle-horizontal', 'rounded'], ['circle', 'circle', 'circle'], ['triangle', 'triangle', 'triangle'], ['line', 'minus', 'line'], ['star', 'star', 'star'],
  ];
  for (const [kind, icon, key] of kinds) iconButton(sg, icon, view.t(key as 'rectangle'), () => void view.action(() => view.addShape(kind)), 'qc-shape-btn');
  const images = group(body, view.t('image'));
  const row = images.createDiv('qc-col');
  textButton(row, view.t('imageUpload'), () => view.pickImage(), '', 'image-plus');
  textButton(row, view.t('imageVault'), () => view.pickVaultImage(), '', 'folder-open');
  images.createDiv({ text: view.t('imageHint'), cls: 'qc-hint' });
}

/* ---------- assistant ---------- */
interface ChatMessage { role: 'user' | 'assistant'; text: string; applied?: string[] }
const chatLog = new WeakMap<object, ChatMessage[]>();
function drawerAssistant(view: CoverView, body: HTMLElement): void {
  const plugin = view.plugin; const log = chatLog.get(view) ?? []; chatLog.set(view, log);
  const providers = plugin.assistantList();
  const head = body.createDiv('qc-chat-head');
  const sel = head.createEl('select', { cls: 'qc-select' });
  for (const p of providers) sel.createEl('option', { text: p.name, value: p.id });
  sel.value = providers.some(p => p.id === plugin.settings.assistant) ? plugin.settings.assistant : providers[0]!.id;
  sel.addEventListener('change', () => { plugin.settings.assistant = sel.value; void plugin.saveSettings(); });
  const messages = body.createDiv('qc-chat-messages');
  const draw = (): void => {
    messages.empty();
    if (!log.length) {
      const empty = messages.createDiv('qc-chat-empty');
      setIcon(empty.createDiv('qc-empty-icon'), 'sparkles');
      empty.createEl('h3', { text: view.t('chatTitle') }); empty.createEl('p', { text: view.t('chatIntro') });
      for (const prompt of [view.t('chatEx1'), view.t('chatEx2'), view.t('chatEx3'), view.t('chatEx4')]) {
        const chip = empty.createEl('button', { text: prompt, cls: 'qc-chip', attr: { type: 'button' } });
        chip.addEventListener('click', () => { input.value = prompt; input.focus(); });
      }
      return;
    }
    for (const m of log) {
      const bubble = messages.createDiv({ cls: `qc-msg qc-msg-${m.role}` });
      bubble.createDiv({ text: m.text, cls: 'qc-msg-text' });
      for (const a of m.applied ?? []) { const li = bubble.createDiv('qc-msg-applied'); setIcon(li.createSpan(), 'check'); li.createSpan({ text: a }); }
    }
    messages.scrollTop = messages.scrollHeight;
  };
  const compose = body.createDiv('qc-chat-compose');
  const input = compose.createEl('textarea', { cls: 'qc-chat-input', attr: { rows: '2', placeholder: view.t('chatPlaceholder') } });
  const send = iconButton(compose, 'arrow-up', view.t('send'), () => void submit(), 'qc-primary qc-send');
  let busy = false;
  const submit = async (): Promise<void> => {
    const prompt = input.value.trim(); if (!prompt || busy || view.restoring) return;
    busy = true; send.disabled = true; log.push({ role: 'user', text: prompt }); draw();
    try {
      const provider = providers.find(p => p.id === sel.value) ?? providers[0]!;
      const sel1 = view.selection()[0];
      const request: AssistantInput = {
        prompt, zh: view.zh, fonts: plugin.fonts.all().map(f => f.family), platform: view.platform()?.id, size: { width: view.design!.width, height: view.design!.height },
        selected: sel1 instanceof Textbox ? sel1.text : undefined,
      };
      const result: AssistantResult = await provider.run(request);
      const applied = await view.runAssistantOps(result.ops);
      log.push({ role: 'assistant', text: result.reply || (applied.length ? view.t('chatDone') : view.t('chatNothing')), applied });
      if (input.value.trim() === prompt) input.value = '';
    } catch (e) {
      log.push({ role: 'assistant', text: view.t('error', { message: e instanceof Error ? e.message : String(e) }) });
    } finally { busy = false; send.disabled = false; draw(); input.focus(); }
  };
  onEnter(input, e => { e.preventDefault(); void submit(); });
  body.createDiv({ text: providers.length > 1 ? view.t('chatModelOn') : view.t('chatOffline'), cls: 'qc-hint qc-chat-note' });
  draw();
}

/* ---------- inspector ---------- */
const ALIGN_ICONS: [import('./ops').Align, string, 'alignLeft' | 'alignCenterH' | 'alignRight' | 'alignTop' | 'alignMiddle' | 'alignBottom'][] = [
  ['left', 'align-start-vertical', 'alignLeft'], ['center', 'align-center-vertical', 'alignCenterH'], ['right', 'align-end-vertical', 'alignRight'],
  ['top', 'align-start-horizontal', 'alignTop'], ['middle', 'align-center-horizontal', 'alignMiddle'], ['bottom', 'align-end-horizontal', 'alignBottom'],
];
export function renderInspector(view: CoverView, el: HTMLElement): void {
  const top = el.scrollTop; el.empty();
  const sel = view.selection();
  if (!sel.length) renderCanvasPanel(view, el); else renderObjectPanel(view, el, sel);
  el.scrollTop = top;
}

function renderObjectPanel(view: CoverView, el: HTMLElement, sel: QObject[]): void {
  const first = sel[0]!; const texts = view.texts(); const allText = texts.length === sel.length; const single = sel.length === 1;
  const t = view.t.bind(view); const recent = view.plugin.settings.recentColors;
  const commit = (c: string): void => view.plugin.rememberColor(c);
  const header = el.createDiv('qc-obj-head');
  header.createSpan({ text: single ? layerName(view, first) : t('selected', { n: sel.length }), cls: 'qc-obj-title' });
  const actions = header.createDiv('qc-obj-actions');
  iconButton(actions, first.lockMovementX ? 'lock-keyhole' : 'lock-keyhole-open', t('locked'), () => view.toggleLock(), first.lockMovementX ? 'is-active' : '');
  iconButton(actions, 'copy-plus', t('duplicate'), () => void view.action(() => view.cloneSelection()));
  iconButton(actions, 'trash-2', t('remove'), () => view.removeSelection());

  if (allText) {
    const g = group(el, t('text'));
    if (single) {
      const box = first as Textbox; const ta = g.createEl('textarea', { cls: 'qc-textarea', attr: { rows: '3', spellcheck: 'false' } }); ta.value = box.text;
      let composing = false;
      ta.addEventListener('compositionstart', () => { composing = true; });
      ta.addEventListener('compositionend', () => { composing = false; view.update({ text: ta.value }, o => o === box); });
      ta.addEventListener('input', () => { if (!composing) view.update({ text: ta.value }, o => o === box); });
    }
    const fontRow = field(g, t('font'), 'qc-field-wide'); const fontBtn = fontRow.body.createEl('button', { cls: 'qc-font-btn', attr: { type: 'button' } });
    const family = (first as Textbox).fontFamily; const avail = view.plugin.fonts.available(view.doc, family);
    const nameSpan = fontBtn.createSpan({ text: view.plugin.fonts.find(family)?.zh && view.zh ? view.plugin.fonts.find(family)!.zh! : family, cls: 'qc-font-btn-name' }); nameSpan.style.fontFamily = `"${family.replace(/"/g, '')}", sans-serif`;
    if (!avail) fontBtn.createSpan({ text: t('fontMissing'), cls: 'qc-badge is-warn' });
    setIcon(fontBtn.createSpan({ cls: 'qc-chevron' }), 'chevron-down');
    fontBtn.addEventListener('click', () => openFontPopover(view, fontBtn, family, f => view.setFont(f)));

    const sizeRow = g.createDiv('qc-row qc-row-tight');
    numberBox(sizeRow, t('size'), (first as Textbox).fontSize * (first.scaleY || 1), v => view.update({ fontSize: v, scaleX: 1, scaleY: 1 }, o => o instanceof Textbox), { min: 8, max: 600, unit: 'px' });
    const styles = sizeRow.createDiv('qc-seg qc-seg-icons');
    const flag = (icon: string, label: string, on: boolean, props: (next: boolean) => Record<string, unknown>): void => {
      const b = styles.createEl('button', { cls: 'qc-seg-btn', attr: { type: 'button' } }); setIcon(b, icon); b.createSpan({ text: label, cls: 'qc-sr-only' }); b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
      b.addEventListener('click', () => { const next = !b.classList.contains('is-active'); b.classList.toggle('is-active', next); b.setAttribute('aria-pressed', String(next)); view.update(props(next), o => o instanceof Textbox); });
    };
    const f = first as Textbox;
    flag('bold', t('bold'), f.fontWeight === 'bold' || Number(f.fontWeight) >= 600, n => ({ fontWeight: n ? 'bold' : 'normal' }));
    flag('italic', t('italic'), f.fontStyle === 'italic', n => ({ fontStyle: n ? 'italic' : 'normal' }));
    flag('underline', t('underline'), !!f.underline, n => ({ underline: n }));
    flag('strikethrough', t('strike'), !!f.linethrough, n => ({ linethrough: n }));
    segmented<'left' | 'center' | 'right'>(g, [{ value: 'left', icon: 'align-left', label: t('left') }, { value: 'center', icon: 'align-center', label: t('center') }, { value: 'right', icon: 'align-right', label: t('right') }], (f.textAlign as 'left') ?? 'left', v => view.update({ textAlign: v }, o => o instanceof Textbox), 'qc-seg-icons');
    slider(g, t('lineHeight'), Math.round(f.lineHeight * 100) / 100, 0.8, 2.4, 0.05, v => view.update({ lineHeight: v }, o => o instanceof Textbox), v => v.toFixed(2));
    slider(g, t('letterSpacing'), f.charSpacing, -100, 800, 10, v => view.update({ charSpacing: v }, o => o instanceof Textbox), v => `${Math.round(v / 10) / 100}em`);
    colorControl(g, t('color'), typeof f.fill === 'string' ? f.fill : '#171717', c => view.update({ fill: c }, o => o instanceof Textbox), { recent, onCommit: commit });

    const fx = group(el, t('effects'), { open: !!(f.textBackgroundColor || (f.stroke && f.strokeWidth) || f.shadow) });
    colorControl(fx, t('highlight'), f.textBackgroundColor || '', c => view.update({ textBackgroundColor: c }, o => o instanceof Textbox), { recent, none: true, onCommit: commit });
    colorControl(fx, t('stroke'), (f.strokeWidth && typeof f.stroke === 'string' ? f.stroke : '') || '', c => view.update({ stroke: c || null, strokeWidth: c ? Math.max(f.strokeWidth || 0, 4) : 0, paintFirst: 'stroke' }, o => o instanceof Textbox), { recent, none: true, onCommit: commit });
    if (f.stroke) slider(fx, t('strokeWidth'), f.strokeWidth || 0, 0, 40, 1, v => view.update({ strokeWidth: v, paintFirst: 'stroke' }, o => o instanceof Textbox));
    shadowControl(view, fx, first);
  } else if (sel.every(o => o instanceof FabricImage)) {
    const g = group(el, t('image'));
    const img = first as FabricImage;
    const row = g.createDiv('qc-col');
    if (single) textButton(row, t('imageReplace'), () => pickReplacement(view, img), '', 'refresh-cw');
    const fitRow = g.createDiv('qc-row');
    textButton(fitRow, t('imageCover'), () => view.fitImage(img, 'cover'), 'qc-btn-sm', 'maximize'); textButton(fitRow, t('imageContain'), () => view.fitImage(img, 'contain'), 'qc-btn-sm', 'minimize');
    const flipRow = g.createDiv('qc-row');
    textButton(flipRow, t('flipH'), () => view.update({ flipX: !img.flipX }), 'qc-btn-sm', 'flip-horizontal'); textButton(flipRow, t('flipV'), () => view.update({ flipY: !img.flipY }), 'qc-btn-sm', 'flip-vertical');
    const radius = img.clipPath instanceof Rect ? (img.clipPath.rx || 0) * img.scaleX : 0;
    slider(g, t('cornerRadius'), Math.round(radius), 0, Math.round(Math.min(img.getScaledWidth(), img.getScaledHeight()) / 2), 1, v => view.setCorner(img, v));
    const fx = group(el, t('effects'), { open: !!img.shadow }); shadowControl(view, fx, first);
  } else if (sel.every(o => !(o instanceof Textbox) && !(o instanceof FabricImage))) {
    const g = group(el, t('shape'));
    const isLine = first instanceof Line;
    if (!isLine) colorControl(g, t('fill'), typeof first.fill === 'string' && first.fill !== 'rgba(0,0,0,0)' ? first.fill : '', c => view.update({ fill: c || 'rgba(0,0,0,0)' }), { recent, none: true, onCommit: commit });
    colorControl(g, t('stroke'), (first.strokeWidth && typeof first.stroke === 'string' ? first.stroke : '') || '', c => view.update({ stroke: c || null, strokeWidth: c ? Math.max(first.strokeWidth || 0, 6) : 0 }), { recent, none: true, onCommit: commit });
    if (first.stroke) slider(g, t('strokeWidth'), first.strokeWidth || 0, 0, 80, 1, v => view.update({ strokeWidth: v }));
    if (first instanceof Rect) slider(g, t('cornerRadius'), Math.round(first.rx || 0), 0, Math.round(Math.min(first.width, first.height) / 2), 1, v => view.update({ rx: v, ry: v }, o => o instanceof Rect));
    const fx = group(el, t('effects'), { open: !!first.shadow }); shadowControl(view, fx, first);
  }

  const arrange = group(el, t('arrange'));
  const ag = arrange.createDiv('qc-align-grid');
  for (const [to, icon, key] of ALIGN_ICONS) iconButton(ag, icon, t(key), () => view.align(to));
  const og = arrange.createDiv('qc-row');
  iconButton(og, 'bring-to-front', t('front'), () => view.order('front')); iconButton(og, 'arrow-up', t('forward'), () => view.order('forward'));
  iconButton(og, 'arrow-down', t('backward'), () => view.order('backward')); iconButton(og, 'send-to-back', t('back'), () => view.order('back'));
  const tr = group(el, t('transform'));
  const b = first.getBoundingRect(); const pos = tr.createDiv('qc-row qc-row-tight');
  numberBox(pos, 'X', b.left, v => moveTo(view, 'x', v), { unit: 'px' }); numberBox(pos, 'Y', b.top, v => moveTo(view, 'y', v), { unit: 'px' });
  const dim = tr.createDiv('qc-row qc-row-tight');
  if (single && !(first instanceof Textbox)) {
    numberBox(dim, 'W', first.getScaledWidth(), v => { first.scaleToWidth(v); first.setCoords(); view.canvas?.requestRenderAll(); view.changed(); }, { min: 1, unit: 'px' });
    numberBox(dim, 'H', first.getScaledHeight(), v => { first.scaleToHeight(v); first.setCoords(); view.canvas?.requestRenderAll(); view.changed(); }, { min: 1, unit: 'px' });
  } else if (single && first instanceof Textbox) {
    numberBox(dim, 'W', first.getScaledWidth(), v => { view.update({ width: v / (first.scaleX || 1) }, o => o === first); }, { min: 20, unit: 'px' });
  }
  numberBox(dim, t('rotation'), first.angle, v => view.update({ angle: v }), { min: -360, max: 360, unit: '°' });
  slider(tr, t('opacity'), Math.round(first.opacity * 100), 0, 100, 1, v => view.update({ opacity: v / 100 }), v => `${v}%`);
}

function moveTo(view: CoverView, axis: 'x' | 'y', value: number): void {
  const target = view.canvas?.getActiveObject(); if (!target) return;
  const b = target.getBoundingRect();
  if (axis === 'x') target.set({ left: target.left + (value - b.left) }); else target.set({ top: target.top + (value - b.top) });
  target.setCoords(); view.canvas?.requestRenderAll(); view.changed();
}
function shadowControl(view: CoverView, parent: HTMLElement, first: QObject): void {
  const current = first.qcShadow ?? (first.shadow ? 'soft' : 'none');
  const f = field(parent, view.t('shadow'), 'qc-field-wide');
  segmented(f.body, (['none', 'soft', 'hard', 'glow'] as const).map(v => ({ value: v, label: view.t(`shadow_${v}` as 'shadow_none') })), (current in SHADOWS ? current : 'none') as 'none', v => view.setShadow(v), 'qc-seg-small');
}
function pickReplacement(view: CoverView, img: FabricImage): void {
  const input = view.doc.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp';
  input.addEventListener('change', () => { const f = input.files?.[0]; if (f) void view.action(() => view.replaceImage(img, f)); }, { once: true }); input.click();
}
export function layerName(view: CoverView, o: FabricObject): string {
  if (o instanceof Textbox) return o.text.replace(/\s+/g, ' ').slice(0, 30) || view.t('text');
  if (o instanceof FabricImage) return view.t('image');
  if (o instanceof Circle) return view.t('circle'); if (o instanceof Triangle) return view.t('triangle'); if (o instanceof Line) return view.t('line'); if (o instanceof Polygon) return view.t('star');
  return view.t('rectangle');
}
function layerIcon(o: FabricObject): string {
  if (o instanceof Textbox) return 'type'; if (o instanceof FabricImage) return 'image'; if (o instanceof Circle) return 'circle'; if (o instanceof Triangle) return 'triangle';
  if (o instanceof Line) return 'minus'; if (o instanceof Polygon) return 'star'; return 'square';
}

/* ---------- canvas panel (nothing selected) ---------- */
const GRADIENTS: [string, string][] = [['#2563eb', '#06b6d4'], ['#f97316', '#e11d2e'], ['#0a0a0a', '#27272a'], ['#16a34a', '#a3e635'], ['#fb7185', '#fbbf24'], ['#111827', '#4f46e5'], ['#fef3c7', '#fda4af'], ['#e0f2fe', '#ede9fe']];
function renderCanvasPanel(view: CoverView, el: HTMLElement): void {
  const d = view.design!; const t = view.t.bind(view); const recent = view.plugin.settings.recentColors;
  const current = platformFor(d.width, d.height, d.platform);
  const pg = group(el, t('platform'));
  for (const grp of GROUPS) {
    pg.createDiv({ text: view.zh ? grp.zh : grp.en, cls: 'qc-subhead' });
    const grid = pg.createDiv('qc-plat-grid');
    for (const p of PLATFORMS.filter(x => x.group === grp.id)) {
      const b = grid.createEl('button', { cls: 'qc-plat', attr: { type: 'button' } }); setIcon(b.createSpan({ cls: 'qc-plat-icon' }), p.icon);
      const text = b.createDiv('qc-plat-text'); text.createSpan({ text: view.zh ? p.zh : p.en, cls: 'qc-plat-name' }); text.createSpan({ text: `${p.width} × ${p.height}`, cls: 'qc-plat-size' });
      b.classList.toggle('is-active', current?.id === p.id);
      b.addEventListener('click', () => view.setPlatform(p.id));
    }
  }
  if (current) {
    pg.createDiv({ text: view.zh ? current.zhHint : current.enHint, cls: 'qc-hint' });
    if (current.maxBytes) pg.createDiv({ text: t('limitNote', { size: bytes(current.maxBytes) }), cls: 'qc-hint' });
  }
  const custom = group(el, t('customSize'), { open: !current });
  const row = custom.createDiv('qc-row qc-row-tight'); let w = d.width, h = d.height; let fit = true;
  numberBox(row, t('width'), d.width, v => { w = Math.round(v); }, { min: 200, max: 4096, unit: 'px' }); numberBox(row, t('height'), d.height, v => { h = Math.round(v); }, { min: 200, max: 4096, unit: 'px' });
  const fitRow = custom.createEl('label', { cls: 'qc-check' }); const cb = fitRow.createEl('input', { type: 'checkbox' }); cb.checked = true; cb.addEventListener('change', () => { fit = cb.checked; }); fitRow.createSpan({ text: t('fitContent') });
  textButton(custom, t('resize'), () => { if (w < 200 || h < 200 || w > 4096 || h > 4096) { new Notice(t('sizeRange')); return; } view.resizeTo(w, h, fit); }, 'qc-btn-sm');

  const bg = group(el, t('background')); const spec: Background = d.bg ?? { kind: 'solid', color: '#ffffff' };
  segmented<'solid' | 'linear'>(bg, [{ value: 'solid', label: t('solid') }, { value: 'linear', label: t('gradientLabel') }], spec.kind, v => {
    if (v === 'solid') view.applyBackground({ kind: 'solid', color: spec.kind === 'solid' ? spec.color : spec.from });
    else view.applyBackground(spec.kind === 'linear' ? spec : { kind: 'linear', from: spec.color, to: '#111111', angle: 135 });
    view.refreshInspector(true);
  });
  if (spec.kind === 'solid') colorControl(bg, t('color'), spec.color, c => view.applyBackground({ kind: 'solid', color: c }), { recent, onCommit: c => view.plugin.rememberColor(c) });
  else {
    colorControl(bg, t('gradientFrom'), spec.from, c => view.applyBackground({ ...spec, from: c }), { recent, onCommit: c => view.plugin.rememberColor(c) });
    colorControl(bg, t('gradientTo'), spec.to, c => view.applyBackground({ ...spec, to: c }), { recent, onCommit: c => view.plugin.rememberColor(c) });
    slider(bg, t('angle'), spec.angle, 0, 360, 5, v => view.applyBackground({ ...spec, angle: v }), v => `${v}°`);
  }
  const presets = bg.createDiv('qc-gradient-grid');
  for (const [from, to] of GRADIENTS) {
    const b = presets.createEl('button', { cls: 'qc-gradient', attr: { type: 'button' } }); b.style.background = `linear-gradient(135deg, ${from}, ${to})`; b.createSpan({ text: `${from} → ${to}`, cls: 'qc-sr-only' });
    b.addEventListener('click', () => { view.applyBackground({ kind: 'linear', from, to, angle: 135 }); view.refreshInspector(true); });
  }

  const used = view.fontsInUse();
  if (used.length) {
    const fg = group(el, t('fontsUsed'), { open: used.some(f => !view.plugin.fonts.available(view.doc, f)) });
    for (const family of used) {
      const ok = view.plugin.fonts.available(view.doc, family); const r = fg.createDiv('qc-used');
      setIcon(r.createSpan({ cls: ok ? 'qc-ok' : 'qc-warn' }), ok ? 'check' : 'triangle-alert');
      const n = r.createSpan({ text: family, cls: 'qc-used-name' }); n.style.fontFamily = `"${family.replace(/"/g, '')}", sans-serif`;
      if (!ok) r.createSpan({ text: t('fontMissing'), cls: 'qc-badge is-warn' });
    }
    if (used.some(f => !view.plugin.fonts.available(view.doc, f))) fg.createDiv({ text: t('fontMissingHint'), cls: 'qc-hint' });
  }
}

/* ---------- layers ---------- */
export function renderLayers(view: CoverView, el: HTMLElement): void {
  const top = el.scrollTop; el.empty(); const c = view.canvas; if (!c) return;
  const objects = c.getObjects(); const active = c.getActiveObjects();
  if (!objects.length) { el.createDiv({ text: view.t('layersEmpty'), cls: 'qc-empty-note' }); return; }
  const list = el.createDiv('qc-layers'); let dragging: FabricObject | undefined;
  for (const o of [...objects].reverse()) {
    const row = list.createDiv({ cls: 'qc-layer', attr: { draggable: 'true' } }); row.classList.toggle('is-selected', active.includes(o)); row.classList.toggle('is-hidden', !o.visible);
    setIcon(row.createSpan({ cls: 'qc-layer-icon' }), layerIcon(o));
    row.createSpan({ text: layerName(view, o), cls: 'qc-layer-name' });
    const tools = row.createDiv('qc-layer-tools');
    iconButton(tools, o.visible ? 'eye' : 'eye-off', view.t('visible'), e => { e.stopPropagation(); o.set({ visible: !o.visible }); if (!o.visible) c.discardActiveObject(); c.requestRenderAll(); view.changed(); renderLayers(view, el); });
    iconButton(tools, o.lockMovementX ? 'lock-keyhole' : 'lock-keyhole-open', view.t('locked'), e => { e.stopPropagation(); c.setActiveObject(o); view.toggleLock(); renderLayers(view, el); }, o.lockMovementX ? 'is-active' : '');
    row.addEventListener('click', () => { if (!o.visible) return; c.setActiveObject(o); c.requestRenderAll(); renderLayers(view, el); });
    row.addEventListener('dragstart', e => { dragging = o; e.dataTransfer?.setData('text/plain', 'layer'); row.addClass('is-dragging'); });
    row.addEventListener('dragend', () => { dragging = undefined; row.removeClass('is-dragging'); });
    row.addEventListener('dragover', e => { if (dragging) { e.preventDefault(); row.addClass('is-over'); } });
    row.addEventListener('dragleave', () => row.removeClass('is-over'));
    row.addEventListener('drop', e => { e.preventDefault(); row.removeClass('is-over'); if (dragging && dragging !== o) { c.moveObjectTo(dragging, c.getObjects().indexOf(o)); c.requestRenderAll(); view.changed(); renderLayers(view, el); } });
  }
  el.scrollTop = top;
}
