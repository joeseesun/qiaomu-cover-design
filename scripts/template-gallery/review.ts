/**
 * Review sheets for polishing one template at a time: rows are the audit's copy kinds (short, medium, long, points, English),
 * columns the six canvas shapes, each laid out exactly as the app does it (bundled fonts and pairing, layoutPass, then the
 * platform-zone check). Open review.html?only=folio,brush[&out=before] and the sheets land in artifacts/template-gallery/.
 */
import { StaticCanvas } from 'fabric';
import { TEMPLATES, gradient } from '../../src/templates';
import { resolvePair, usePairing } from '../../src/typeset';
import { PLATFORMS } from '../../src/platforms';
import { clearCopyOfZones, layoutPass } from '../../src/calm';
import { audit } from '../../src/audit';
import { COPY, SHAPES } from '../../tests/fixtures/copy';
import index from '../../assets/fonts/index.json';

const FONTS: Record<string, string> = Object.fromEntries((index as { family: string; file: string }[]).map(f => [f.family, f.file]));

async function main(): Promise<void> {
  const q = new URLSearchParams(location.search);
  await Promise.all(Object.entries(FONTS).map(async ([family, file]) => { try { const f = new FontFace(family, `url(fonts/${file})`); await f.load(); document.fonts.add(f); } catch { /* falls back */ } }));
  const ids = (q.get('only') ?? '').split(',').filter(Boolean); const tag = q.get('out') ?? 'after'; const copies = (q.get('copy') ?? 'short,medium,long,points,en').split(',');
  const H = 300; const status = document.getElementById('status')!; const report: Record<string, string[]> = {};
  for (const id of ids) {
    const t = TEMPLATES.find(x => x.id === id); if (!t) continue;
    const shapes = SHAPES.map(s => PLATFORMS.find(p => p.id === s)!); const cols = shapes.map(p => Math.round(H * p.width / p.height));
    const rows = COPY.filter(c => copies.includes(c.id)); const gap = 10, head = 40, left = 70;
    const sheet = document.createElement('canvas'); sheet.width = left + cols.reduce((a, b) => a + b + gap, 0) + gap; sheet.height = head + rows.length * (H + gap) + gap;
    const g = sheet.getContext('2d')!; g.fillStyle = '#d6d3d1'; g.fillRect(0, 0, sheet.width, sheet.height);
    g.fillStyle = '#1c1917'; g.font = 'bold 22px sans-serif'; g.fillText(`${t.id} · ${t.zh}  [${tag}]`, 12, 28);
    report[id] = [];
    for (const [r, copy] of rows.entries()) {
      g.fillStyle = '#44403c'; g.font = '14px sans-serif'; g.fillText(copy.id, 10, head + r * (H + gap) + H / 2);
      let x = left;
      for (const [k, p] of shapes.entries()) {
        const avoid = (p.avoid ?? []).map(z => ({ x: z.x * p.width, y: z.y * p.height, w: z.w * p.width, h: z.h * p.height }));
        usePairing(resolvePair(t.id, f => f in FONTS));
        const el = document.createElement('canvas'); const sc = new StaticCanvas(el, { width: p.width, height: p.height, renderOnAddRemove: false, enableRetinaScaling: false });
        try {
          const res = t.build({ width: p.width, height: p.height, zh: copy.zh, title: copy.title, subtitle: copy.subtitle, ...(copy.badge ? { badge: copy.badge } : {}), ...(copy.points ? { points: copy.points } : {}) });
          layoutPass(res.objects, p.width, p.height); clearCopyOfZones(res.objects, avoid, p.width, p.height);
          for (const f of audit({ width: p.width, height: p.height, background: res.background, objects: res.objects, platformId: p.id, avoid })) if (f.hard) report[id]!.push(`${p.id}/${copy.id} ${f.rule} ${f.detail}`);
          sc.backgroundColor = res.background.kind === 'solid' ? res.background.color : gradient(p.width, p.height, res.background.from, res.background.to, res.background.angle);
          for (const o of res.objects) sc.add(o); sc.renderAll();
          g.drawImage(el, x, head + r * (H + gap), cols[k]!, H);
          // the platform's own UI, outlined, so a cover can be judged where it will actually be seen
          g.strokeStyle = 'rgba(220,38,38,0.55)'; g.setLineDash([4, 3]); for (const z of avoid) g.strokeRect(x + z.x * cols[k]! / p.width, head + r * (H + gap) + z.y * H / p.height, z.w * cols[k]! / p.width, z.h * H / p.height); g.setLineDash([]);
        } catch (e) { g.fillStyle = '#b91c1c'; g.fillText(String(e).slice(0, 40), x + 4, head + r * (H + gap) + 20); }
        finally { usePairing(undefined); void sc.dispose(); }
        x += cols[k]! + gap;
      }
    }
    await fetch(`/save/review-${id}-${tag}.png`, { method: 'POST', body: sheet.toDataURL('image/png') });
  }
  status.textContent = `Done ${tag}: ${JSON.stringify(report)}`; (window as unknown as { done: boolean; report: unknown }).done = true; (window as unknown as { report: unknown }).report = report;
}
void main();
