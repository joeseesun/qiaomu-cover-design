import { ExportPrefs } from './model';
import { DEFAULT_PLATFORM } from './platforms';
import { AI_DEFAULTS, AiConfig, mergeAi } from './aiparse';
import { mergeSeries, Series } from './series';

export type DrawerTab = 'templates' | 'add' | 'fonts' | 'assistant';
/** A chat turn saved with the design; rich payloads (variants, options, snapshots) are recomputable, so only the words persist. */
export interface SavedChat { role: 'user' | 'assistant'; text: string; applied?: string[] }
export interface Settings {
  designFolder: string; exportFolder: string; fontFolder: string; language: string; defaultPlatform: string;
  export: Partial<ExportPrefs>;
  guides: { safe: boolean; center: boolean; grid: boolean; snap: boolean };
  defaultFont: string; recentColors: string[]; recentFonts: string[]; favFonts: string[]; drawer: DrawerTab | ''; assistant: string;
  ai: AiConfig; imageStyle: string; fontNudgeOff: boolean; unsplashSecret: string; unsplashProxy: string;
  /** Saved looks the user reuses; the first one is what the assistant follows by default. */ series: Series[];
  /** Designer conversations by design file path, so reopening a cover continues where the chat left off. */ chats: Record<string, SavedChat[]>;
}
export const DEFAULTS: Settings = {
  designFolder: 'Cover designs', exportFolder: 'Cover designs/Exports', fontFolder: 'Cover designs/Fonts', language: 'auto', defaultPlatform: DEFAULT_PLATFORM,
  export: {}, guides: { safe: false, center: true, grid: false, snap: true },
  defaultFont: 'sans-serif', recentColors: [], recentFonts: [], favFonts: [], drawer: 'assistant', assistant: 'ai', ai: { ...AI_DEFAULTS }, imageStyle: 'auto', fontNudgeOff: false, unsplashSecret: '', unsplashProxy: '', series: [], chats: {},
};
/** Keeps at most 30 turns per cover and 20 covers, so data.json stays small. */
function mergeChats(raw: unknown): Record<string, SavedChat[]> {
  const out: Record<string, SavedChat[]> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [path, list] of Object.entries(raw as Record<string, unknown>).slice(0, 20)) {
    if (!Array.isArray(list)) continue;
    const msgs = list.filter((m): m is SavedChat => !!m && typeof m === 'object' && ((m as SavedChat).role === 'user' || (m as SavedChat).role === 'assistant') && typeof (m as SavedChat).text === 'string')
      .slice(-30).map(m => ({ role: m.role, text: m.text.slice(0, 2000), ...(Array.isArray(m.applied) ? { applied: m.applied.filter((a): a is string => typeof a === 'string').slice(0, 8) } : {}) }));
    if (msgs.length) out[path] = msgs;
  }
  return out;
}
/** Merges stored data over defaults, ignoring wrong types so a damaged data.json cannot break startup. */
export function mergeSettings(raw: unknown): Settings {
  const base: Settings = structuredClone(DEFAULTS);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  for (const key of ['designFolder', 'exportFolder', 'fontFolder', 'language', 'defaultPlatform', 'defaultFont', 'assistant', 'imageStyle'] as const) if (typeof r[key] === 'string' && r[key]) base[key] = r[key] as string;
  for (const key of ['recentColors', 'recentFonts', 'favFonts'] as const) if (Array.isArray(r[key])) base[key] = (r[key] as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 60);
  if (r.export && typeof r.export === 'object') base.export = r.export as Partial<ExportPrefs>;
  if (r.guides && typeof r.guides === 'object') {
    const g = r.guides as Record<string, unknown>;
    for (const key of ['safe', 'center', 'grid', 'snap'] as const) if (typeof g[key] === 'boolean') base.guides[key] = g[key] as boolean;
  }
  if (typeof r.unsplashSecret === 'string') base.unsplashSecret = r.unsplashSecret;
  if (typeof r.unsplashProxy === 'string' && /^https:\/\//.test(r.unsplashProxy)) base.unsplashProxy = r.unsplashProxy.trim();
  if (typeof r.fontNudgeOff === 'boolean') base.fontNudgeOff = r.fontNudgeOff;
  base.ai = mergeAi(r.ai); base.series = mergeSeries(r.series); base.chats = mergeChats(r.chats);
  if (r.drawer === '' || r.drawer === 'templates' || r.drawer === 'add' || r.drawer === 'fonts' || r.drawer === 'assistant') base.drawer = r.drawer;
  return base;
}
