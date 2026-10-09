/**
 * Automatic checks that run after the designer lays a cover out: text must stay readable on its background and clear of the
 * parts of a platform's UI that cover the image (avatar, duration badge, stats bar). Pure geometry and colour, no canvas.
 */
export interface Box { x: number; y: number; w: number; h: number }
export interface Zone extends Box { zh: string; en: string }

const hexRgb = (hex: string): [number, number, number] | undefined => {
  const m = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim()); if (!m) return undefined; let h = m[1]!;
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const lum = ([r, g, b]: [number, number, number]): number => {
  const f = (v: number): number => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
/** WCAG contrast ratio (1–21) between two #hex colours; undefined when either is not plain hex. */
export function contrast(a: string, b: string): number | undefined {
  const x = hexRgb(a), y = hexRgb(b); if (!x || !y) return undefined;
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p) as [number, number]; return (hi + 0.05) / (lo + 0.05);
}
/** Whichever of near-black / white reads better on `bg`. */
export function readableOn(bg: string): string { return (contrast('#111111', bg) ?? 21) >= (contrast('#ffffff', bg) ?? 1) ? '#111111' : '#ffffff'; }
/** Keeps `fg` when it already has `min` contrast on `bg`, otherwise returns a readable replacement. */
export function ensureReadable(fg: string, bg: string, min = 3): string {
  const c = contrast(fg, bg); return c === undefined || c >= min ? fg : readableOn(bg);
}
const hit = (a: Box, b: Box): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/**
 * Where a text box should sit so it clears every avoid zone: the same x, moved up for zones in the lower half and down for
 * zones in the upper half. Undefined when it already clears them or no move would keep it on the canvas.
 */
export function clearOfZones(box: Box, zones: Box[], canvasH: number, pad: number): number | undefined {
  let y = box.y; let moved = false;
  for (let pass = 0; pass < 3; pass++) {
    const blocking = zones.find(z => hit({ ...box, y }, z)); if (!blocking) break;
    const next = blocking.y + blocking.h / 2 > canvasH / 2 ? blocking.y - box.h - pad : blocking.y + blocking.h + pad; y = next; moved = true;
  }
  if (!moved || y < 0 || y + box.h > canvasH) return undefined; return y;
}
