/**
 * Template audit: builds every template on every canvas shape with several kinds of copy, runs the same layout pass as the
 * app, scores it with the rubric in src/audit.ts and writes a JSON report plus one contact sheet per shape.
 *
 *   npx tsx scripts/audit-templates.ts [outDir] [--sheets] [--failures] [--only=id,id]
 *
 * --sheets draws every template with the medium copy, --failures draws only the layouts with a hard finding.
 *
 * Needs the native `canvas` package (a Fabric dependency); run `npm rebuild canvas` once if it reports a missing binary.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { setEnv } from 'fabric';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
setEnv({ document: dom.window.document, window: dom.window, isTouchSupported: false, WebGLProbe: { queryWebGL() {}, isSupported: () => false }, dispose() {}, copyPasteData: {} } as never);

const { StaticCanvas } = await import('fabric');
const { TEMPLATES, gradient } = await import('../src/templates');
const { clearCopyOfZones, layoutPass } = await import('../src/calm');
const { audit } = await import('../src/audit');
const { PLATFORMS } = await import('../src/platforms');
const { COPY, SHAPES } = await import('../tests/fixtures/copy');

const args = process.argv.slice(2); const outDir = args.find(a => !a.startsWith('--')) ?? 'artifacts/template-audit'; const sheets = args.includes('--sheets'); const failures = args.includes('--failures'); const only = args.find(a => a.startsWith('--only='))?.slice(7).split(',');
mkdirSync(outDir, { recursive: true });

interface Row { template: string; shape: string; copy: string; hard: number; soft: number; findings: ReturnType<typeof audit> }
const rows: Row[] = [];
for (const shape of SHAPES) {
  const p = PLATFORMS.find(x => x.id === shape)!; const avoid = (p.avoid ?? []).map(z => ({ x: z.x * p.width, y: z.y * p.height, w: z.w * p.width, h: z.h * p.height }));
  const tiles: { id: string; url: string; bad: boolean }[] = [];
  const failTiles: typeof tiles = [];
  for (const copy of COPY) for (const t of TEMPLATES) {
    const r = t.build({ width: p.width, height: p.height, zh: copy.zh, title: copy.title, subtitle: copy.subtitle, ...(copy.badge ? { badge: copy.badge } : {}), ...(copy.points ? { points: copy.points } : {}) });
    // The app's own passes: layout repair on every apply, then the quality pass moves text off the platform's UI.
    layoutPass(r.objects, p.width, p.height);
    clearCopyOfZones(r.objects, avoid, p.width, p.height);
    const findings = audit({ width: p.width, height: p.height, background: r.background, objects: r.objects, platformId: p.id, avoid });
    rows.push({ template: t.id, shape, copy: copy.id, hard: findings.filter(f => f.hard).length, soft: findings.filter(f => !f.hard).length, findings });
    if (only && !only.includes(t.id)) continue;
    const bad = findings.filter(f => f.hard);
    if ((sheets && copy.id === 'medium') || (failures && bad.length)) {
      const el = dom.window.document.createElement('canvas'); const sc = new StaticCanvas(el, { width: p.width, height: p.height, renderOnAddRemove: false, enableRetinaScaling: false });
      sc.backgroundColor = r.background.kind === 'solid' ? r.background.color : gradient(p.width, p.height, r.background.from, r.background.to, r.background.angle);
      for (const o of r.objects) sc.add(o); sc.renderAll();
      const tile = { id: `${t.id}/${copy.id}`, url: sc.toDataURL({ format: 'png', multiplier: 320 / p.width }), bad: !!bad.length };
      if (sheets && copy.id === 'medium') tiles.push(tile);
      if (failures && bad.length) failTiles.push({ ...tile, id: `${tile.id} ${[...new Set(bad.map(f => f.rule.slice(0, 2) + ' ' + f.role))].join(', ')}` });
      void sc.dispose();
    }
  }
  for (const [name, list] of [[`sheet-${shape}`, tiles], [`failures-${shape}`, failTiles]] as const) {
    if (!list.length) continue;
    const { createCanvas, loadImage } = await import('canvas');
    const tw = 320, th = Math.round(320 * p.height / p.width), cols = 6, label = 22, gap = 12;
    const sheet = createCanvas(cols * (tw + gap) + gap, Math.ceil(list.length / cols) * (th + label + gap) + gap); const g = sheet.getContext('2d');
    g.fillStyle = '#e7e5e4'; g.fillRect(0, 0, sheet.width, sheet.height); g.font = '14px sans-serif';
    for (const [k, tile] of list.entries()) {
      const x = gap + (k % cols) * (tw + gap), y = gap + Math.floor(k / cols) * (th + label + gap);
      g.drawImage(await loadImage(tile.url), x, y, tw, th); g.fillStyle = tile.bad ? '#b91c1c' : '#1c1917'; g.fillText(tile.id.slice(0, 44), x, y + th + 16);
    }
    writeFileSync(join(outDir, `${name}.png`), sheet.toBuffer('image/png'));
  }
}
writeFileSync(join(outDir, 'report.json'), JSON.stringify(rows.filter(r => r.findings.length), null, 1));
const byRule = new Map<string, number>(); for (const r of rows) for (const f of r.findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1);
const worst = [...new Set(rows.map(r => r.template))].map(id => ({ id, hard: rows.filter(r => r.template === id).reduce((s, r) => s + r.hard, 0) })).filter(x => x.hard).sort((a, b) => b.hard - a.hard);
console.log(`${rows.length} layouts, ${rows.filter(r => r.hard).length} with hard findings`);
console.log([...byRule].sort().map(([k, v]) => `  ${k}: ${v}`).join('\n'));
console.log('templates with hard findings:', worst.map(x => `${x.id}(${x.hard})`).join(' ') || 'none');
