import { Circle, FabricObject, Gradient, Rect, Shadow, Textbox, TextboxProps, Triangle } from 'fabric';
import { Background } from './model';

export interface TemplateInput { width: number; height: number; title: string; subtitle: string; zh: boolean }
export interface TemplateResult { background: Background; objects: FabricObject[] }
export interface Template { id: string; zh: string; en: string; build(i: TemplateInput): TemplateResult }

const SANS = 'sans-serif';
const SERIF = 'serif';

interface TextOptions { qcRole?: string; fontSize: number; fill: string; fontWeight?: string; fontFamily?: string; lineHeight?: number; textAlign?: string; charSpacing?: number; stroke?: string; strokeWidth?: number; textBackgroundColor?: string; shadow?: Shadow }

/** Textbox placed by its top-left corner. CJK has no spaces, so wrap by grapheme. */
export function textbox(text: string, left: number, top: number, width: number, o: TextOptions): Textbox {
  return new Textbox(text, {
    left, top, width, originX: 'left', originY: 'top', fontFamily: SANS, fontWeight: 'normal', lineHeight: 1.25, splitByGrapheme: hasCjk(text), paintFirst: o.stroke ? 'stroke' : 'fill', ...o,
  } as Partial<TextboxProps>);
}
export function hasCjk(text: string): boolean { return /[぀-ヿ㐀-鿿豈-﫿＀-￯]/.test(text); }
function rect(left: number, top: number, width: number, height: number, fill: string, extra: Record<string, unknown> = {}): Rect {
  return new Rect({ left, top, width, height, fill, originX: 'left', originY: 'top', ...extra });
}
function gradient(w: number, h: number, from: string, to: string, angle = 180): Gradient<'linear'> {
  const rad = (angle - 90) * Math.PI / 180; const dx = Math.cos(rad), dy = Math.sin(rad);
  const half = Math.abs(w * dx) / 2 + Math.abs(h * dy) / 2;
  return new Gradient({ type: 'linear', gradientUnits: 'pixels', coords: { x1: w / 2 - dx * half, y1: h / 2 - dy * half, x2: w / 2 + dx * half, y2: h / 2 + dy * half }, colorStops: [{ offset: 0, color: from }, { offset: 1, color: to }] });
}
export { gradient };

/** Sizes follow the shorter side so one layout works on 3:4, 16:9 and 5:2. */
function metrics(i: TemplateInput): { u: number; m: number; wide: boolean; tall: boolean; w: number; h: number } {
  const w = i.width, h = i.height; const u = Math.min(w, h * 1.15) / 1000;
  return { u, m: Math.round(Math.min(w, h) * 0.08), wide: w / h > 1.45, tall: h / w > 1.2, w, h };
}
/** Largest font size whose wrapped title still fits the box. */
export function fitTitle(text: string, width: number, maxHeight: number, max: number, min = 36, lineHeight = 1.2): number {
  const cjk = hasCjk(text); const lines = text.split('\n');
  for (let size = max; size > min; size -= 4) {
    const per = Math.max(1, Math.floor(width / (size * (cjk ? 1 : 0.55))));
    const count = lines.reduce((n, line) => n + Math.max(1, Math.ceil([...line].length / per)), 0);
    if (count * size * lineHeight <= maxHeight) return size;
  }
  return min;
}

export const TEMPLATES: Template[] = [
  {
    id: 'minimal', zh: '简约白', en: 'Minimal',
    build(i) {
      const { u, m, w, h, wide } = metrics(i); const inner = w - m * 2; const titleH = h * (wide ? 0.55 : 0.5);
      const size = fitTitle(i.title, inner, titleH, 130 * u * (wide ? 1.1 : 1));
      return { background: { kind: 'solid', color: '#ffffff' }, objects: [
        rect(m, m, Math.min(inner, 180 * u), Math.max(4, 8 * u), '#171717'),
        textbox(i.title, m, h * 0.3, inner, { qcRole: 'title', fontSize: size, fill: '#171717', fontWeight: 'bold', lineHeight: 1.18 }),
        textbox(i.subtitle, m, h - m - 90 * u, inner, { qcRole: 'subtitle', fontSize: Math.max(24, 34 * u), fill: '#737373' }),
      ] };
    },
  },
  {
    id: 'editorial', zh: '杂志', en: 'Editorial',
    build(i) {
      const { u, m, w, h } = metrics(i); const inner = w - m * 2;
      const size = fitTitle(i.title, inner, h * 0.5, 124 * u);
      return { background: { kind: 'solid', color: '#f4efe4' }, objects: [
        rect(m, m, inner, Math.max(3, 4 * u), '#171717'),
        textbox('COVER STORY', m, m + 26 * u, inner, { fontSize: Math.max(18, 24 * u), fill: '#171717', charSpacing: 300, fontWeight: 'bold' }),
        textbox(i.title, m, h * 0.3, inner, { qcRole: 'title', fontSize: size, fill: '#171717', fontFamily: SERIF, fontWeight: 'bold', lineHeight: 1.16 }),
        rect(m, h - m - 110 * u, inner, Math.max(2, 3 * u), '#171717'),
        textbox(i.subtitle, m, h - m - 84 * u, inner, { qcRole: 'subtitle', fontSize: Math.max(24, 32 * u), fill: '#404040', fontFamily: SERIF }),
      ] };
    },
  },
  {
    id: 'bold', zh: '醒目黄', en: 'Loud yellow',
    build(i) {
      const { u, m, w, h } = metrics(i); const inner = w - m * 2;
      const size = fitTitle(i.title, inner, h * 0.55, 170 * u, 40, 1.1);
      return { background: { kind: 'solid', color: '#ffe04b' }, objects: [
        textbox(i.title, m, h * 0.2, inner, { qcRole: 'title', fontSize: size, fill: '#111111', fontWeight: 'bold', lineHeight: 1.1 }),
        rect(m, h - m - 150 * u, Math.min(inner, 260 * u), Math.max(8, 18 * u), '#111111'),
        textbox(i.subtitle, m, h - m - 110 * u, inner, { qcRole: 'subtitle', fontSize: Math.max(26, 38 * u), fill: '#111111', fontWeight: 'bold' }),
      ] };
    },
  },
  {
    id: 'dark', zh: '深色科技', en: 'Dark tech',
    build(i) {
      const { u, m, w, h } = metrics(i); const inner = w - m * 2;
      const size = fitTitle(i.title, inner, h * 0.5, 128 * u);
      const tag = textbox(i.zh ? '  干货  ' : '  GUIDE  ', m, m, 220 * u, { fontSize: Math.max(22, 30 * u), fill: '#0a0a0a', fontWeight: 'bold', textBackgroundColor: '#5eead4' });
      const glow = new Circle({ left: w * 0.55, top: -h * 0.2, radius: Math.max(w, h) * 0.35, fill: '#14b8a6', opacity: 0.22, originX: 'left', originY: 'top' });
      return { background: { kind: 'linear', from: '#0a0a0a', to: '#1c1c22', angle: 160 }, objects: [
        glow, tag,
        textbox(i.title, m, h * 0.28, inner, { qcRole: 'title', fontSize: size, fill: '#fafafa', fontWeight: 'bold', lineHeight: 1.15 }),
        textbox(i.subtitle, m, h - m - 90 * u, inner, { qcRole: 'subtitle', fontSize: Math.max(24, 34 * u), fill: '#a1a1aa' }),
      ] };
    },
  },
  {
    id: 'poster', zh: '大字报', en: 'Poster',
    build(i) {
      const { u, m, w, h } = metrics(i); const inner = w - m * 2;
      const size = fitTitle(i.title, inner, h * 0.7, 210 * u, 40, 1.05);
      return { background: { kind: 'solid', color: '#e11d2e' }, objects: [
        textbox(i.title, m, h * 0.5 - size * 1.05 * Math.min(3, i.title.split('\n').length) / 2, inner, { qcRole: 'title', fontSize: size, fill: '#ffffff', fontWeight: 'bold', lineHeight: 1.05, textAlign: 'center' }),
        textbox(i.subtitle, m, h - m - 70 * u, inner, { qcRole: 'subtitle', fontSize: Math.max(24, 32 * u), fill: '#ffe4e6', textAlign: 'center' }),
      ] };
    },
  },
  {
    id: 'split', zh: '左文右图', en: 'Split',
    build(i) {
      const { u, m, w, h } = metrics(i); const left = w * 0.54; const inner = left - m * 1.6;
      const size = fitTitle(i.title, inner, h * 0.6, 120 * u * 1.15);
      const panel = rect(left, 0, w - left, h, '#f97316');
      const circle = new Circle({ left: left + (w - left) * 0.18, top: h * 0.2, radius: Math.min(w - left, h) * 0.33, fill: '#fff7ed', originX: 'left', originY: 'top' });
      return { background: { kind: 'solid', color: '#fff7ed' }, objects: [
        panel, circle,
        textbox(i.title, m, h * 0.2, inner, { qcRole: 'title', fontSize: size, fill: '#1c1917', fontWeight: 'bold', lineHeight: 1.15 }),
        textbox(i.subtitle, m, h - m - 80 * u, inner, { qcRole: 'subtitle', fontSize: Math.max(22, 30 * u), fill: '#57534e' }),
      ] };
    },
  },
  {
    id: 'sticker', zh: '便签', en: 'Sticky note',
    build(i) {
      const { u, m, w, h } = metrics(i); const pad = m * 1.4; const cardW = w - m * 2; const cardH = h - m * 2;
      const size = fitTitle(i.title, cardW - pad * 2, cardH * 0.5, 120 * u);
      const card = rect(m, m, cardW, cardH, '#fffbea', { rx: 24 * u, ry: 24 * u, shadow: new Shadow({ color: 'rgba(0,0,0,0.18)', blur: 30 * u, offsetX: 0, offsetY: 14 * u }), angle: 0 });
      const tape = rect(w / 2 - 90 * u, m - 18 * u, 180 * u, 44 * u, '#fcd34d', { opacity: 0.85 });
      return { background: { kind: 'solid', color: '#fda4af' }, objects: [
        card, tape,
        textbox(i.title, m + pad, m + cardH * 0.22, cardW - pad * 2, { qcRole: 'title', fontSize: size, fill: '#292524', fontWeight: 'bold', lineHeight: 1.18 }),
        textbox(i.subtitle, m + pad, m + cardH - pad - 60 * u, cardW - pad * 2, { qcRole: 'subtitle', fontSize: Math.max(22, 30 * u), fill: '#78716c' }),
      ] };
    },
  },
  {
    id: 'gradient', zh: '渐变光感', en: 'Soft gradient',
    build(i) {
      const { u, m, w, h } = metrics(i); const inner = w - m * 2;
      const size = fitTitle(i.title, inner, h * 0.5, 128 * u);
      const tri = new Triangle({ left: w * 0.62, top: h * 0.08, width: w * 0.5, height: w * 0.5, fill: '#ffffff', opacity: 0.12, angle: 18, originX: 'left', originY: 'top' });
      return { background: { kind: 'linear', from: '#2563eb', to: '#06b6d4', angle: 135 }, objects: [
        tri,
        textbox(i.title, m, h * 0.3, inner, { qcRole: 'title', fontSize: size, fill: '#ffffff', fontWeight: 'bold', lineHeight: 1.15, shadow: new Shadow({ color: 'rgba(0,0,0,0.25)', blur: 18 * u, offsetX: 0, offsetY: 6 * u }) }),
        textbox(i.subtitle, m, h - m - 84 * u, inner, { qcRole: 'subtitle', fontSize: Math.max(24, 34 * u), fill: '#e0f2fe' }),
      ] };
    },
  },
  {
    id: 'center', zh: '居中标签', en: 'Centered',
    build(i) {
      const { u, m, w, h } = metrics(i); const inner = w - m * 3.2;
      const size = fitTitle(i.title, inner, h * 0.5, 120 * u);
      return { background: { kind: 'solid', color: '#fafafa' }, objects: [
        rect(m * 0.6, m * 0.6, w - m * 1.2, h - m * 1.2, 'rgba(0,0,0,0)', { stroke: '#171717', strokeWidth: Math.max(3, 5 * u) }),
        textbox(i.title, m * 1.6, h * 0.5 - size * 1.2 * Math.min(3, i.title.split('\n').length) / 2 - 20 * u, inner, { qcRole: 'title', fontSize: size, fill: '#171717', fontWeight: 'bold', lineHeight: 1.2, textAlign: 'center' }),
        textbox(i.subtitle, m * 1.6, h * 0.5 + h * 0.2, inner, { qcRole: 'subtitle', fontSize: Math.max(24, 32 * u), fill: '#404040', textAlign: 'center', textBackgroundColor: '#ffe04b' }),
      ] };
    },
  },
  {
    id: 'checklist', zh: '清单笔记', en: 'Checklist',
    build(i) {
      const { u, m, w, h } = metrics(i); const inner = w - m * 2;
      const size = fitTitle(i.title, inner, h * 0.3, 104 * u);
      const rows = i.subtitle.split(/[\n,，、；;]/).map(s => s.trim()).filter(Boolean).slice(0, 4);
      const items = (rows.length > 1 ? rows : ['01', '02', '03']).map((label, index) => textbox(rows.length > 1 ? `${index + 1}  ${label}` : `${label}  ${i.zh ? '要点' : 'Point'}`, m, h * 0.52 + index * 92 * u, inner, { fontSize: Math.max(24, 40 * u), fill: '#166534', fontWeight: 'bold' }));
      return { background: { kind: 'solid', color: '#ecfdf3' }, objects: [
        rect(m, m, 120 * u, Math.max(6, 12 * u), '#16a34a'),
        textbox(i.title, m, m + 50 * u, inner, { qcRole: 'title', fontSize: size, fill: '#052e16', fontWeight: 'bold', lineHeight: 1.15 }),
        ...items,
      ] };
    },
  },
];
export function templateById(id: string): Template | undefined { return TEMPLATES.find(t => t.id === id); }
