import { ExportPrefs } from './model';
import { DEFAULT_PLATFORM } from './platforms';
import { AI_DEFAULTS, AiConfig, mergeAi } from './aiparse';

export type DrawerTab = 'templates' | 'add' | 'fonts' | 'assistant';
export interface Settings {
  designFolder: string; exportFolder: string; fontFolder: string; language: string; defaultPlatform: string;
  export: Partial<ExportPrefs>;
  guides: { safe: boolean; center: boolean; grid: boolean; snap: boolean };
  defaultFont: string; recentColors: string[]; recentFonts: string[]; favFonts: string[]; drawer: DrawerTab | ''; assistant: string;
  ai: AiConfig; imageStyle: string; fontNudgeOff: boolean; unsplashSecret: string; unsplashProxy: string;
}
export const DEFAULTS: Settings = {
  designFolder: 'Cover designs', exportFolder: 'Cover designs/Exports', fontFolder: 'Cover designs/Fonts', language: 'auto', defaultPlatform: DEFAULT_PLATFORM,
  export: {}, guides: { safe: false, center: true, grid: false, snap: true },
  defaultFont: 'sans-serif', recentColors: [], recentFonts: [], favFonts: [], drawer: 'assistant', assistant: 'ai', ai: { ...AI_DEFAULTS }, imageStyle: 'auto', fontNudgeOff: false, unsplashSecret: '', unsplashProxy: '',
};
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
  base.ai = mergeAi(r.ai);
  if (r.drawer === '' || r.drawer === 'templates' || r.drawer === 'add' || r.drawer === 'fonts' || r.drawer === 'assistant') base.drawer = r.drawer;
  return base;
}
