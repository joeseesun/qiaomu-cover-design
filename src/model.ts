export interface Design {
  format: 'qiaomu-cover-design'; schema: 1; width: number; height: number; source?: string;
  canvas: Record<string, unknown>;
}
export const SIZES = [[960,1280],[1080,1080],[1920,1080],[1080,1920],[1500,600]] as const;
export function folderPath(value: string): string {
  const path = value.trim().replace(/\\/g,'/').replace(/\/+$/,'');
  if (!path || path.startsWith('/') || /^[a-z]:/i.test(path) || path.split('/').some(p => !p || p === '..' || p === '.') || /[\x00-\x1f]/.test(path)) throw new Error('invalid-folder');
  return path;
}
export function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|\x00-\x1f]/g,' ').trim().replace(/^\.+|\.+$/g,'').trim().slice(0,100) || 'Cover';
}
function checkCanvas(value: unknown, depth = 0): void {
  if (depth > 40) throw new Error('invalid-design');
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('invalid-design');
    // Persisted image objects must be self-contained raster images. Never request remote URLs.
    if (key === 'src' && (typeof item !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(item))) throw new Error('invalid-design');
    checkCanvas(item, depth + 1);
  }
}
export function parseDesign(raw: string): Design {
  if (raw.length > 40_000_000) throw new Error('invalid-design');
  const d = JSON.parse(raw) as Design;
  if (!d || d.format !== 'qiaomu-cover-design' || d.schema !== 1 || !Number.isInteger(d.width) || !Number.isInteger(d.height) || d.width < 200 || d.height < 200 || d.width > 4096 || d.height > 4096 || !d.canvas || !Array.isArray(d.canvas.objects) || d.canvas.objects.length > 500 || (d.source !== undefined && typeof d.source !== 'string')) throw new Error('invalid-design');
  checkCanvas(d.canvas);
  return d;
}
export class History {
  private entries: string[] = []; private index = -1;
  reset(value: string): void { this.entries = [value]; this.index = 0; }
  push(value: string): void {
    if (value === this.entries[this.index]) return;
    this.entries = this.entries.slice(0,this.index + 1); this.entries.push(value);
    if (this.entries.length > 40) this.entries.shift();
    this.index = this.entries.length - 1;
  }
  step(direction: -1|1): string|undefined {
    const index = this.index + direction;
    if (index < 0 || index >= this.entries.length) return;
    this.index = index; return this.entries[index];
  }
}
export class SerialWriter {
  private tail: Promise<void> = Promise.resolve();
  run(task: () => Promise<void>): Promise<void> {
    const result = this.tail.then(task); this.tail = result.catch(() => {}); return result;
  }
}
