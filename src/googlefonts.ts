/** Google Fonts through the Fontsource mirror: search about 2,000 families online, preview one, install it with a click (needs a network). */
import { requestUrl } from 'obsidian';

export interface GFont { id: string; family: string; category: string; weights: number[]; variable: boolean }
let index: Promise<GFont[]> | undefined;
const MIRRORS = ['https://cdn.jsdelivr.net', 'https://fastly.jsdelivr.net', 'https://gcore.jsdelivr.net'];
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> => Promise.race([p, new Promise<never>((_, rej) => window.setTimeout(() => rej(new Error('timeout')), ms))]);

/** The catalogue, fetched once per session. Resolves empty when offline so the picker simply shows no online section. */
export function loadGoogleIndex(): Promise<GFont[]> {
  index ??= (async () => {
    try {
      const res = await withTimeout(requestUrl({ url: 'https://api.fontsource.org/v1/fonts', throw: false }), 20_000); if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
      const raw = res.json as { id: string; family: string; subsets: string[]; weights: number[]; category: string; type: string; variable?: boolean }[];
      return raw.filter(f => f.type === 'google' && f.subsets.includes('latin')).map(f => ({ id: f.id, family: f.family, category: f.category, weights: f.weights, variable: !!f.variable }));
    } catch { index = undefined; return []; }
  })();
  return index;
}
/** The regular weight if there is one, otherwise the nearest. Titles want bold, but a family's own bold file is a separate font. */
export const pickWeight = (f: GFont): number => f.weights.includes(400) ? 400 : [...f.weights].sort((a, b) => Math.abs(a - 400) - Math.abs(b - 400))[0] ?? 400;
export const gfUrls = (f: GFont): string[] => MIRRORS.map(m => `${m}/fontsource/fonts/${f.id}@latest/latin-${pickWeight(f)}-normal.woff2`);
export async function fetchGoogleFont(f: GFont): Promise<ArrayBuffer> {
  let last: unknown;
  for (const url of gfUrls(f)) { try { const res = await withTimeout(requestUrl({ url, throw: false }), 25_000); if (res.status >= 400) throw new Error(`HTTP ${res.status}`); return res.arrayBuffer; } catch (e) { last = e; } }
  throw last instanceof Error ? last : new Error('download-failed');
}
export const lookOfCategory = (c: string): 'sans' | 'serif' | 'brush' | 'display' => c === 'serif' ? 'serif' : c === 'handwriting' ? 'brush' : c === 'display' ? 'display' : 'sans';
