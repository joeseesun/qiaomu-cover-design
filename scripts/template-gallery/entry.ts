/**
 * Renders every template at several platform sizes with the real template code and the bundled fonts, then saves contact
 * sheets to artifacts/template-gallery/. Run `npm run gallery` and open the printed URL. See README.md in this folder.
 */
import { StaticCanvas } from 'fabric';
import { TEMPLATES, templatesFor, gradient } from '../../src/templates';
import { resolvePair, usePairing } from '../../src/typeset';
import { PLATFORMS } from '../../src/platforms';
import index from '../../assets/fonts/index.json';

const FONTS: Record<string, string> = Object.fromEntries((index as { family: string; file: string }[]).map(f => [f.family, f.file]));
const SAMPLE = { title: '30 天学会 AI 写作', subtitle: '从零开始的完整路线图', badge: '干货' };

async function main(): Promise<void> {
  const q = new URLSearchParams(location.search);
  await Promise.all(Object.entries(FONTS).map(async ([family, file]) => { try { const f = new FontFace(family, `url(fonts/${file})`); await f.load(); document.fonts.add(f); } catch { /* a missing font falls back */ } }));
  const sizes = (q.get('sizes') ?? 'xhs,youtube,wechat').split(',').map(id => PLATFORMS.find(p => p.id === id)).filter(p => !!p);
  const only = q.get('only')?.split(','); const list = (q.get('all') ? TEMPLATES : templatesFor('xhs')).filter(t => !only || only.includes(t.id));
  const copy = { title: q.get('t') ?? SAMPLE.title, subtitle: q.get('s') ?? SAMPLE.subtitle, badge: q.get('b') ?? SAMPLE.badge };
  const thumb = Number(q.get('w') ?? 260); const per = Number(q.get('per') ?? 12); const name = q.get('out') ?? 'gallery';
  const root = document.getElementById('root')!; const status = document.getElementById('status')!;
  const rows: { label: string; images: HTMLImageElement[] }[] = [];
  for (const t of list) {
    const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<h3>${t.id} · ${t.zh}</h3>`; root.appendChild(row); const images: HTMLImageElement[] = [];
    for (const p of sizes) {
      const sc = new StaticCanvas(document.createElement('canvas'), { width: p.width, height: p.height, renderOnAddRemove: false, enableRetinaScaling: false });
      usePairing(resolvePair(t.id, f => f in FONTS));
      try {
        const r = t.build({ width: p.width, height: p.height, title: copy.title, subtitle: copy.subtitle, zh: true, ...(copy.badge ? { badge: copy.badge } : {}) });
        sc.backgroundColor = r.background.kind === 'solid' ? r.background.color : gradient(p.width, p.height, r.background.from, r.background.to, r.background.angle);
        for (const o of r.objects) sc.add(o); sc.renderAll();
        const img = new Image(); img.src = sc.toDataURL({ format: 'png', multiplier: (thumb / Math.max(p.width, p.height)) * (p.width > p.height ? 1.4 : 1), enableRetinaScaling: false }); img.title = p.id; row.appendChild(img); images.push(img);
      } catch (e) { const pre = document.createElement('pre'); pre.textContent = `${p.id}: ${String(e)}`; row.appendChild(pre); }
      finally { usePairing(undefined); void sc.dispose(); }
    }
    rows.push({ label: `${t.id} · ${t.zh}`, images });
  }
  // Contact sheets, `per` templates each, posted back to the server which writes them under artifacts/.
  for (let k = 0; k * per < rows.length; k++) {
    const part = rows.slice(k * per, k * per + per); await Promise.all(part.flatMap(r => r.images.map(i => i.decode())));
    const W = Math.max(...part.map(r => r.images.reduce((a, i) => a + i.naturalWidth + 12, 130))); const Hs = part.map(r => Math.max(20, ...r.images.map(i => i.naturalHeight)) + 12);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = Hs.reduce((a, b) => a + b, 0); const c = cv.getContext('2d')!;
    c.fillStyle = '#8a8a8a'; c.fillRect(0, 0, W, cv.height); let y = 0;
    part.forEach((r, j) => { c.fillStyle = '#fff'; c.font = 'bold 13px sans-serif'; c.fillText(r.label, 4, y + 16); let x = 130; for (const i of r.images) { c.drawImage(i, x, y); x += i.naturalWidth + 12; } y += Hs[j]!; });
    await fetch(`/save/${name}-${k}.png`, { method: 'POST', body: cv.toDataURL('image/png') });
  }
  status.textContent = `Done: ${rows.length} templates × ${sizes.length} sizes → artifacts/template-gallery/${name}-*.png`;
  (window as unknown as { done: boolean }).done = true;
}
void main();
