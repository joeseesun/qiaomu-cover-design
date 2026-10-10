import { setIcon } from 'obsidian';

type Opts = DomElementInfo | string;
/** Icon-only controls carry a visually hidden label instead of aria-label, which Obsidian renders as a tooltip. */
export function iconButton(parent: HTMLElement, icon: string, label: string, onClick: (event: MouseEvent) => void, cls = ''): HTMLButtonElement {
  const b = parent.createEl('button', { cls: `qc-icon-btn ${cls}`.trim(), attr: { type: 'button' } });
  setIcon(b, icon); b.createSpan({ text: label, cls: 'qc-sr-only' });
  b.addEventListener('click', onClick); return b;
}
export function textButton(parent: HTMLElement, label: string, onClick: (event: MouseEvent) => void, cls = '', icon?: string): HTMLButtonElement {
  const b = parent.createEl('button', { cls: `qc-btn ${cls}`.trim(), attr: { type: 'button' } });
  if (icon) setIcon(b.createSpan({ cls: 'qc-btn-icon' }), icon);
  b.createSpan({ text: label }); b.addEventListener('click', onClick); return b;
}
export function group(parent: HTMLElement, title: string, o: { open?: boolean; hint?: string } = {}): HTMLElement {
  const d = parent.createEl('details', { cls: 'qc-group' }); d.open = o.open !== false;
  const s = d.createEl('summary'); s.createSpan({ text: title, cls: 'qc-group-title' });
  const chevron = s.createSpan({ cls: 'qc-chevron' }); setIcon(chevron, 'chevron-down');
  if (o.hint) d.createDiv({ text: o.hint, cls: 'qc-hint' });
  return d.createDiv('qc-group-body');
}
export function field(parent: HTMLElement, label: string, cls = ''): { wrap: HTMLElement; body: HTMLElement } {
  const wrap = parent.createDiv({ cls: `qc-field ${cls}`.trim() });
  wrap.createSpan({ text: label, cls: 'qc-label' });
  return { wrap, body: wrap.createDiv('qc-control') };
}
export function segmented<T extends string>(parent: HTMLElement, options: { value: T; label?: string; icon?: string; disabled?: boolean }[], value: T, onChange: (v: T) => void, cls = ''): HTMLElement {
  const seg = parent.createDiv({ cls: `qc-seg ${cls}`.trim(), attr: { role: 'group' } });
  for (const o of options) {
    const b = seg.createEl('button', { cls: 'qc-seg-btn', attr: { type: 'button' } });
    if (o.icon) setIcon(b, o.icon);
    if (o.label) b.createSpan({ text: o.label, cls: o.icon ? 'qc-sr-only' : '' });
    if (o.disabled) b.disabled = true;
    b.classList.toggle('is-active', o.value === value); b.setAttribute('aria-pressed', String(o.value === value));
    b.addEventListener('click', () => {
      for (const sibling of Array.from(seg.children)) { sibling.classList.remove('is-active'); sibling.setAttribute('aria-pressed', 'false'); }
      b.classList.add('is-active'); b.setAttribute('aria-pressed', 'true'); onChange(o.value);
    });
  }
  return seg;
}
export function toggleButton(parent: HTMLElement, icon: string, label: string, active: boolean, onChange: (v: boolean) => void): HTMLButtonElement {
  const b = iconButton(parent, icon, label, () => { const next = !b.classList.contains('is-active'); b.classList.toggle('is-active', next); b.setAttribute('aria-pressed', String(next)); onChange(next); }, 'qc-toggle');
  b.classList.toggle('is-active', active); b.setAttribute('aria-pressed', String(active)); return b;
}
export function slider(parent: HTMLElement, label: string, value: number, min: number, max: number, step: number, onInput: (v: number) => void, format: (v: number) => string = v => String(v)): HTMLElement {
  const { wrap, body } = field(parent, label, 'qc-slider');
  const out = wrap.createSpan({ text: format(value), cls: 'qc-value' });
  const input = body.createEl('input', { type: 'range', attr: { min: String(min), max: String(max), step: String(step) } }); input.value = String(value);
  input.addEventListener('input', () => { const v = Number(input.value); out.setText(format(v)); onInput(v); });
  return wrap;
}
/** Number box with a unit. Ignores half-typed values and IME composition. */
export function numberBox(parent: HTMLElement, label: string, value: number, onChange: (v: number) => void, o: { min?: number; max?: number; step?: number; unit?: string } = {}): HTMLInputElement {
  const { wrap, body } = field(parent, label, 'qc-num');
  const input = body.createEl('input', { type: 'number', attr: { step: String(o.step ?? 1) } }); input.value = String(Math.round(value * 100) / 100);
  if (o.min !== undefined) input.min = String(o.min); if (o.max !== undefined) input.max = String(o.max);
  if (o.unit) wrap.createSpan({ text: o.unit, cls: 'qc-unit' });
  input.addEventListener('input', () => {
    if (input.value === '' || input.value === '-') return;
    const v = Number(input.value); if (!Number.isFinite(v)) return;
    if ((o.min !== undefined && v < o.min) || (o.max !== undefined && v > o.max)) return;
    onChange(v);
  });
  return input;
}
export const PALETTE = ['#111111', '#ffffff', '#737373', '#e11d2e', '#f97316', '#ffe04b', '#16a34a', '#14b8a6', '#2563eb', '#7c3aed', '#fb7185', '#f4efe4'];
export interface ColorOptions { recent?: string[]; none?: boolean; onCommit?: (color: string) => void; doc?: Document }
/** Swatch + hex + palette. `none` adds a transparent choice (value ''). */
export function colorControl(parent: HTMLElement, label: string, value: string, onChange: (color: string) => void, o: ColorOptions = {}): HTMLElement {
  const { wrap, body } = field(parent, label, 'qc-color');
  const top = body.createDiv('qc-color-top');
  const hex = /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : '';
  const picker = top.createEl('input', { type: 'color', cls: 'qc-swatch-input' }); picker.value = hex || '#171717';
  const text = top.createEl('input', { type: 'text', cls: 'qc-hex', attr: { maxlength: '9', spellcheck: 'false', placeholder: o.none ? '—' : '#000000' } }); text.value = hex;
  const apply = (c: string, commit: boolean): void => { onChange(c); if (commit) o.onCommit?.(c); };
  picker.addEventListener('input', () => { text.value = picker.value; apply(picker.value, false); });
  picker.addEventListener('change', () => apply(picker.value, true));
  text.addEventListener('input', () => { const v = text.value.trim(); const full = /^#?[\da-f]{6}$/i.test(v) ? (v.startsWith('#') ? v : `#${v}`) : ''; if (full) { picker.value = full; apply(full.toLowerCase(), true); } });
  const win = (o.doc ?? parent.ownerDocument).defaultView as (Window & { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }) | null;
  if (win?.EyeDropper) {
    const Eye = win.EyeDropper;
    iconButton(top, 'pipette', '', () => { void new Eye().open().then(r => { picker.value = r.sRGBHex; text.value = r.sRGBHex; apply(r.sRGBHex, true); }).catch(() => undefined); }, 'qc-eyedrop');
  }
  const swatches = body.createDiv('qc-swatches');
  if (o.none) { const n = swatches.createEl('button', { cls: 'qc-swatch is-none', attr: { type: 'button' } }); n.createSpan({ text: '', cls: 'qc-sr-only' }); n.addEventListener('click', () => { text.value = ''; apply('', true); }); }
  for (const c of [...(o.recent ?? []).slice(0, 6), ...PALETTE]) {
    const s = swatches.createEl('button', { cls: 'qc-swatch', attr: { type: 'button' } }); s.style.setProperty('--c', c);
    s.createSpan({ text: c, cls: 'qc-sr-only' });
    s.addEventListener('click', () => { picker.value = c; text.value = c; apply(c, true); });
  }
  return wrap;
}
export function div(parent: HTMLElement, cls: Opts): HTMLDivElement { return parent.createDiv(cls); }
/** Enter commits unless an input method is composing. */
export function onEnter(el: HTMLElement, fn: (event: KeyboardEvent) => void, allowShift = false): void {
  el.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && (allowShift || !e.shiftKey)) fn(e); });
}
export function bytes(n: number): string { return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`; }

/** One consistent empty state: an icon, what happened, what to do next, and buttons for the likely next step. Spans a whole grid row. */
export function emptyState(parent: HTMLElement, o: { icon: string; title: string; hint?: string; actions?: { label: string; run: () => void; primary?: boolean }[] }): HTMLElement {
  const box = parent.createDiv('qc-empty'); setIcon(box.createDiv('qc-empty-glyph'), o.icon);
  box.createDiv({ text: o.title, cls: 'qc-empty-title' }); if (o.hint) box.createDiv({ text: o.hint, cls: 'qc-empty-hint' });
  if (o.actions?.length) { const row = box.createDiv('qc-empty-actions'); for (const a of o.actions) textButton(row, a.label, a.run, `qc-btn-sm${a.primary ? ' qc-primary' : ''}`); }
  return box;
}
