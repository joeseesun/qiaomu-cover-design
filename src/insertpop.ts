/**
 * The "插入" popover in the top bar: one place to add anything to the cover. Stickers and icons (offline library), text styles,
 * shapes, pictures, and Unsplash photos as background. It stays open so several things can be added in a row.
 */
import { StaticCanvas, Textbox } from 'fabric';
import { Notice, setIcon } from 'obsidian';
import { faceFor, isSingleWeight, pillFor, styleText, TEXT_GROUPS, TEXT_PRESETS, type TextPreset } from './textstyles';
import type { CoverView } from './view';
import { ASSET_CATS, AssetCat, AssetItem, assetSvg, assetThumb, loadAssets, searchAssets } from './assets';
import { DECOR, drawDecor } from './decor';
import { downloadPhoto, hasSource, Photo, searchPhotos, Source, unsplashKey } from './unsplash';
import { emptyState, iconButton, textButton } from './ui';

type Tab = 'asset' | 'text' | 'shape' | 'image' | 'photo';
let lastTab: Tab = 'asset';
const STICKER_TAGS = ['火', '爱心', '火箭', '灯泡', '星', '皇冠', '奖杯', '礼物', '对勾', '警告', '钱', '书', '眼睛', '大脑', '笑'];
const LINE_TAGS = ['箭头', '对勾', '星星', '爱心', '火', '灯泡', '书', '电脑', '时间', '搜索', '设置', '用户', '位置', '链接'];
const PAGE = 90;

export function openInsertPopover(view: CoverView, anchor: HTMLElement): void {
  const doc = view.doc; const open = doc.querySelector('.qc-popover.qc-insert'); if (open) { open.dispatchEvent(new Event('qc-close')); return; }
  doc.querySelectorAll('.qc-popover').forEach(el => el.remove());
  const zh = view.zh; const pop = doc.body.createDiv('qc-popover qc-insert qc-root-scope'); const r = anchor.getBoundingClientRect(); const width = 400;
  pop.style.width = `${width}px`; pop.style.left = `${Math.max(8, Math.min(r.left, view.win.innerWidth - width - 8))}px`; pop.style.top = `${r.bottom + 6}px`; pop.style.height = `${Math.max(360, Math.min(600, view.win.innerHeight - r.bottom - 24))}px`;
  const close = (): void => { pop.remove(); doc.removeEventListener('pointerdown', outside, true); doc.removeEventListener('keydown', esc, true); };
  const outside = (e: Event): void => { if (!pop.contains(e.target as Node) && !anchor.contains(e.target as Node)) close(); };
  const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  doc.addEventListener('pointerdown', outside, true); doc.addEventListener('keydown', esc, true); pop.addEventListener('qc-close', close);

  const tabsEl = pop.createDiv('qc-insert-tabs'); const body = pop.createDiv('qc-insert-body qc-assets');
  const TABS: [Tab, string, string, string][] = [['asset', 'smile-plus', '素材', 'Assets'], ['text', 'type', '文字', 'Text'], ['shape', 'shapes', '形状', 'Shapes'], ['image', 'image-plus', '图片', 'Image'], ['photo', 'camera', '背景图', 'Photos']];
  const draw = (): void => {
    tabsEl.empty();
    for (const [id, icon, zhName, enName] of TABS) {
      const b = tabsEl.createEl('button', { cls: 'qc-insert-tab', attr: { type: 'button' } });
      setIcon(b.createSpan({ cls: 'qc-insert-tab-icon' }), icon); b.createSpan({ text: zh ? zhName : enName }); b.classList.toggle('is-active', lastTab === id);
      b.addEventListener('click', () => { lastTab = id; draw(); });
    }
    iconButton(tabsEl, 'x', view.t('close'), close, 'qc-insert-x');
    body.empty();
    if (lastTab === 'asset') assetsTab(view, body, close); else if (lastTab === 'text') textTab(view, body, close); else if (lastTab === 'shape') shapeTab(view, body, close);
    else if (lastTab === 'image') imageTab(view, body, close); else photoTab(view, body, draw);
  };
  draw();
}

function searchBox(parent: HTMLElement, placeholder: string, onSearch: (q: string) => void): HTMLInputElement {
  const box = parent.createDiv('qc-assets-search'); setIcon(box.createSpan({ cls: 'qc-assets-icon' }), 'search');
  const input = box.createEl('input', { type: 'text', cls: 'qc-assets-input', attr: { placeholder, spellcheck: 'false' } }); let composing = false;
  input.addEventListener('compositionstart', () => { composing = true; }); input.addEventListener('compositionend', () => { composing = false; onSearch(input.value); });
  input.addEventListener('input', () => { if (!composing) onSearch(input.value); });
  window.setTimeout(() => input.focus(), 30); return input;
}

/* ---------- stickers and icons ---------- */
/** After adding something the popover closes so the new element is visible and selected; hold Shift to keep adding. */
const done = (e: MouseEvent, close: () => void): void => { if (!e.shiftKey) close(); };
function assetsTab(view: CoverView, body: HTMLElement, close: () => void): void {
  const zh = view.zh; let cat: AssetCat = 'sticker'; let query = ''; let shown = PAGE;
  const input = searchBox(body, zh ? '搜索：火箭、爱心、箭头、礼物…' : 'Search: rocket, heart, arrow…', q => { query = q.trim(); shown = PAGE; render(); });
  const tabs = body.createDiv('qc-assets-tabs'); const tags = body.createDiv('qc-assets-tags'); const grid = body.createDiv('qc-assets-grid'); const foot = body.createDiv('qc-hint qc-assets-foot');
  let data: Awaited<ReturnType<typeof loadAssets>> | undefined;
  const insert = async (a: AssetItem, ev: MouseEvent): Promise<void> => { try { await view.addAssetSvg(assetSvg(a, view.palette?.ink ?? '#171717')); done(ev, close); } catch (e) { new Notice(e instanceof Error ? e.message : String(e)); } };
  const render = (): void => {
    tabs.empty(); tags.empty(); grid.empty(); foot.empty();
    for (const c of ASSET_CATS) { const b = tabs.createEl('button', { cls: 'qc-assets-tab', text: zh ? c.zh : c.en, attr: { type: 'button' } }); b.classList.toggle('is-active', c.id === cat); b.addEventListener('click', () => { cat = c.id; shown = PAGE; render(); }); }
    for (const label of cat === 'sticker' ? STICKER_TAGS : LINE_TAGS) { const b = tags.createEl('button', { cls: 'qc-assets-tag', text: label, attr: { type: 'button' } }); b.addEventListener('click', () => { input.value = label; query = label; shown = PAGE; render(); }); }
    if (!data) { emptyState(grid, { icon: 'loader-circle', title: zh ? '正在载入素材库…' : 'Loading the library…' }); return; }
    if (!data.stickers.length) { emptyState(grid, { icon: 'package-x', title: zh ? '素材库文件缺失' : 'Library file missing', hint: zh ? '需要插件目录里的 assets-pack.json.gz。重新安装插件，或把它放到插件文件夹里。' : 'assets-pack.json.gz must sit next to main.js.' }); return; }
    const hits = searchAssets(data, cat, query);
    if (!hits.length) {
      emptyState(grid, { icon: 'search-x', title: zh ? `没有找到“${query}”` : `Nothing for “${query}”`, hint: cat === 'sticker' ? (zh ? '换一个更常见的词，比如「火箭」「爱心」「箭头」「礼物」。' : 'Try a more common word.') : (zh ? '线性图标多是英文名，试试 arrow、heart、star；常用中文词也行。' : 'Try arrow, heart, star.'),
        actions: [...(cat === 'sticker' ? [{ label: zh ? '去线性图标里找' : 'Search line icons', run: () => { cat = 'line'; shown = PAGE; render(); } }] : [{ label: zh ? '去贴纸里找' : 'Search stickers', run: () => { cat = 'sticker'; shown = PAGE; render(); } }]), { label: zh ? '清除搜索' : 'Clear', run: () => { input.value = ''; query = ''; shown = PAGE; render(); }, primary: true }] });
    }
    for (const h of hits.slice(0, shown)) {
      const b = grid.createEl('button', { cls: 'qc-asset', attr: { type: 'button', title: h.zh } }); b.createEl('img', { attr: { src: assetThumb(h), alt: h.zh } });
      b.addEventListener('click', e => void insert(h, e));
    }
    if (hits.length > shown) { const more = grid.createEl('button', { cls: 'qc-assets-more', text: zh ? `显示更多（还有 ${hits.length - shown} 个）` : `Show more (${hits.length - shown})`, attr: { type: 'button' } }); more.addEventListener('click', () => { shown += PAGE; render(); }); }
    foot.setText(zh ? `${ASSET_CATS.find(c => c.id === cat)!.license} · 内置离线素材，可免费商用 · 按住 Shift 可连续添加` : `${ASSET_CATS.find(c => c.id === cat)!.license} · bundled, free to use`);
  };
  render();
  void loadAssets(view.app, view.plugin.manifest.dir ?? '').then(d => { data = d; if (body.isConnected) render(); });
}

/* ---------- text, shapes, images ---------- */
const textThumbCache = new Map<string, string>(); let textThumbQueue: Promise<unknown> = Promise.resolve();
/** The preview in the menu is the real style drawn small, so what you see is what lands on the cover. */
function textThumb(view: CoverView, p: TextPreset): Promise<string> {
  const have = (f: string): boolean => view.plugin.fonts.available(view.doc, f); const face = faceFor(p.font, have) ?? view.plugin.settings.defaultFont; const label = view.zh ? p.sample : p.sampleEn;
  const key = `${p.id}|${label}|${face}`; const hit = textThumbCache.get(key); if (hit) return Promise.resolve(hit);
  const job = textThumbQueue.then(async () => {
    await view.plugin.fonts.ensure(view.doc, face).catch(() => false);
    const W = 232, H = 68; const sc = new StaticCanvas(view.doc.createElement('canvas'), { width: W, height: H, renderOnAddRemove: false, enableRetinaScaling: false });
    sc.backgroundColor = p.dark ? '#1f2024' : '#f4f4f5';
    const size = Math.max(16, Math.min(36, Math.round(p.size * 0.3)));
    const obj = p.pill ? pillFor(p, label, size, face) : (() => { const b = new Textbox(label, { fontSize: size, fontFamily: face, fontWeight: p.weight !== 'normal' && !isSingleWeight(face) ? 'bold' : 'normal', fill: p.color ?? '#171717', textAlign: 'center', originX: 'left', originY: 'top', width: 4000 } as ConstructorParameters<typeof Textbox>[1]); b.initDimensions(); b.set({ width: Math.ceil(Math.max(1, ...b.textLines.map((_, i) => b.getLineWidth(i))) + size * 0.3) }); styleText(b, p, size); return b; })();
    obj.initDimensions(); const ox = obj.angle ? 0 : 0; const k = Math.min(1, (W - 24) / Math.max(1, obj.getScaledWidth()), (H - 14) / Math.max(1, obj.getScaledHeight()));
    obj.set({ scaleX: k, scaleY: k, left: (W - obj.getScaledWidth()) / 2 + ox, top: (H - obj.getScaledHeight()) / 2 }); sc.add(obj); sc.renderAll();
    const url = sc.toDataURL({ format: 'png', multiplier: 2, enableRetinaScaling: false }); await sc.dispose(); textThumbCache.set(key, url); return url;
  });
  textThumbQueue = job.catch(() => undefined); return job;
}
function textTab(view: CoverView, body: HTMLElement, close: () => void): void {
  const zh = view.zh;
  for (const g of TEXT_GROUPS) {
    body.createDiv({ text: zh ? g.zh : g.en, cls: 'qc-insert-sub' }); const grid = body.createDiv('qc-text-grid');
    for (const p of TEXT_PRESETS.filter(x => x.group === g.id)) {
      const card = grid.createEl('button', { cls: 'qc-text-card', attr: { type: 'button', title: zh ? p.zh : p.en } }); const thumb = card.createDiv('qc-text-thumb is-loading'); card.createSpan({ text: zh ? p.zh : p.en, cls: 'qc-text-name' });
      textThumb(view, p).then(url => { thumb.removeClass('is-loading'); thumb.createEl('img', { attr: { src: url, alt: p.zh } }); }, () => thumb.removeClass('is-loading'));
      card.addEventListener('click', e => { void view.action(() => { view.addTextStyle(p); }); done(e, close); });
    }
  }
  body.createDiv({ text: zh ? '添加后双击画布改字；右侧能改字体、颜色、描边和阴影。装了字体包，艺术字会自动用更好看的字体。' : 'Double-click to edit; fonts, colours, stroke and shadow are on the right.', cls: 'qc-hint' });
}
/** 24 × 24 outlines for the extra shapes; filled with the cover's accent colour. */
const PATH_SHAPES: [string, string, string][] = [
  ['diamond', '菱形', 'M12 1 22.5 12 12 23 1.5 12Z'], ['pentagon', '五边形', 'M12 1.5 22.5 9 18.5 21.5h-13L1.5 9Z'], ['hexagon', '六边形', 'M12 1.5 21.5 6.8v10.4L12 22.5 2.5 17.2V6.8Z'],
  ['cross', '十字', 'M9 2h6v7h7v6h-7v7H9v-7H2V9h7Z'], ['arrow', '箭头', 'M2 9h12V3l8 9-8 9v-6H2Z'], ['chevron', '折角箭头', 'M7 2l10 10L7 22l-3-3 7-7-7-7Z'],
  ['heart', '爱心', 'M12 21.5S2.5 15.8 2.5 9.2A5.2 5.2 0 0 1 12 6.5a5.2 5.2 0 0 1 9.5 2.7c0 6.600-9.500 12.300-9.500 12.300Z'], ['drop', '水滴', 'M12 2s7.500 8 7.500 13.200a7.500 7.500 0 0 1-15 0C4.500 10 12 2 12 2Z'],
  ['bubble', '对话框', 'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z'], ['cloud', '云朵', 'M7 19a4.500 4.500 0 0 1-.8-8.900A6.500 6.500 0 0 1 18.700 11 4 4 0 0 1 18 19Z'],
  ['half', '半圆', 'M1.500 18a10.500 10.500 0 0 1 21 0Z'], ['burst', '爆炸星', 'M12 1l2.300 5.200L19.800 4l-1.400 5.600L24 12l-5.600 2.400L19.800 20l-5.500-2.200L12 23l-2.300-5.200L4.200 20l1.400-5.600L0 12l5.600-2.400L4.200 4l5.500 2.200Z'],
  ['ticket', '票券', 'M2 5h20v4a3 3 0 0 0 0 6v4H2v-4a3 3 0 0 0 0-6Z'], ['ribbon', '标签', 'M3 4h18l-3 5 3 5H3Z'], ['moon', '月牙', 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z'], ['bolt', '闪电', 'M13 1 4 14h6l-1 9 10-14h-6Z'],
];
function shapeTab(view: CoverView, body: HTMLElement, close: () => void): void {
  const zh = view.zh; body.createDiv({ text: zh ? '基础形状' : 'Basic', cls: 'qc-insert-sub' });
  const sg = body.createDiv('qc-shape-grid');
  const kinds: ['rect' | 'rounded' | 'circle' | 'triangle' | 'line' | 'star', string, string][] = [['rect', 'square', 'rectangle'], ['rounded', 'rectangle-horizontal', 'rounded'], ['circle', 'circle', 'circle'], ['triangle', 'triangle', 'triangle'], ['line', 'minus', 'line'], ['star', 'star', 'star']];
  for (const [kind, icon, key] of kinds) { const b = iconButton(sg, icon, view.t(key as 'rectangle'), () => undefined, 'qc-shape-btn'); b.addEventListener('click', e => { void view.action(() => view.addShape(kind)); done(e, close); }); }
  body.createDiv({ text: zh ? '更多形状' : 'More shapes', cls: 'qc-insert-sub' });
  const more = body.createDiv('qc-shape-more');
  for (const [id, name, d] of PATH_SHAPES) {
    const b = more.createEl('button', { cls: 'qc-shape-card', attr: { type: 'button', title: name } });
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`; b.createSpan({ text: name });
    b.addEventListener('click', e => { view.addPathShape(d); done(e, close); }); b.dataset.id = id;
  }
  body.createDiv({ text: zh ? '装饰（跟随配色）' : 'Decorations (palette colours)', cls: 'qc-insert-sub' });
  const deco = body.createDiv('qc-shape-more'); const colors = view.palette ?? { ink: '#171717', accent: '#ef4444', sub: '#737373', bg2: '#e5e5e5', accentInk: '#ffffff' };
  for (const k of DECOR) {
    const art = drawDecor(k.id, colors, 'accent'); if (!art) continue;
    const b = deco.createEl('button', { cls: 'qc-shape-card', attr: { type: 'button', title: k.use } }); b.createEl('img', { attr: { src: `data:image/svg+xml;utf8,${encodeURIComponent(art.svg)}`, alt: k.zh } }); b.createSpan({ text: k.zh });
    b.addEventListener('click', e => { void view.addDecor([{ kind: k.id, at: 'canvas', x: 0.35, y: 0.3, w: 0.3 }]); done(e, close); });
  }
}
function imageTab(view: CoverView, body: HTMLElement, close: () => void): void {
  const col = body.createDiv('qc-col');
  textButton(col, view.t('imageUpload'), () => { close(); view.pickImage(); }, '', 'image-plus');
  textButton(col, view.t('imageVault'), () => { close(); view.pickVaultImage(); }, '', 'folder-open');
  body.createDiv({ text: view.t('imageHint'), cls: 'qc-hint' });
}

/* ---------- Unsplash photos ---------- */
function photoTab(view: CoverView, body: HTMLElement, redraw: () => void): void {
  const zh = view.zh; const plugin = view.plugin; const src: Source = { key: unsplashKey(view.app, plugin.settings.unsplashSecret), proxy: plugin.settings.unsplashProxy };
  if (!hasSource(src)) {
    const card = body.createDiv('qc-photo-setup'); card.createEl('strong', { text: zh ? '用 Unsplash 的免费摄影做背景' : 'Use free Unsplash photos as backgrounds' });
    card.createDiv({ text: zh ? '需要一个免费的 Access Key（unsplash.com/developers 申请，1 分钟）。密钥只保存在 Obsidian 的密钥库里。' : 'Needs a free Access Key from unsplash.com/developers. It is kept in Obsidian\'s secret storage.', cls: 'qc-hint' });
    const row = card.createDiv('qc-col');
    textButton(row, zh ? '去设置里填写密钥' : 'Enter the key in settings', () => plugin.openSettings('general'), 'qc-primary', 'key-round');
    const homeId = homeSecret(view); if (homeId) textButton(row, zh ? '使用乔木 Home 里已配置的密钥' : 'Use the key from Qiaomu Home', () => { plugin.settings.unsplashSecret = homeId; void plugin.saveSettings(); redraw(); }, '', 'link');
    return;
  }
  let query = ''; let seq = 0;
  searchBox(body, zh ? '搜索摄影：山、海、咖啡、极简…（英文效果更好）' : 'Search photos: mountain, ocean, minimal…', q => { query = q.trim(); void run(); });
  const status = body.createDiv('qc-hint'); const grid = body.createDiv('qc-photo-grid'); body.createDiv({ text: zh ? '照片来自 Unsplash，署名会写在图层名里。' : 'Photos by Unsplash; credit is kept in the layer.', cls: 'qc-hint qc-assets-foot' });
  const run = async (): Promise<void> => {
    const my = ++seq; grid.empty(); status.setText(zh ? '搜索中…' : 'Searching…');
    try {
      const photos = await searchPhotos(src, query); if (my !== seq) return; status.setText('');
      if (!photos.length) emptyState(grid, { icon: 'image-off', title: zh ? `没有找到“${query}”的照片` : 'No photos found', hint: zh ? 'Unsplash 的搜索用英文效果更好，试试 mountain、ocean、minimal。' : 'English keywords work best.', actions: [{ label: zh ? '看热门照片' : 'Popular photos', run: () => { query = ''; void run(); }, primary: true }] });
      for (const p of photos) {
        const b = grid.createEl('button', { cls: 'qc-photo', attr: { type: 'button', title: p.author } }); b.style.background = p.color; b.createEl('img', { attr: { src: p.thumb, alt: p.author, loading: 'lazy' } });
        b.addEventListener('click', () => void use(p, b));
      }
    } catch (e) {
      if (my !== seq) return; const m = e instanceof Error ? e.message : String(e); status.setText('');
      emptyState(grid, { icon: m === 'key' ? 'key-round' : m === 'limit' ? 'timer' : 'wifi-off', title: m === 'key' ? (zh ? '密钥无效' : 'Invalid key') : m === 'limit' ? (zh ? '请求次数用完了' : 'Rate limit reached') : (zh ? '连不上 Unsplash' : 'Cannot reach Unsplash'), hint: m === 'key' ? (zh ? '到设置里重新填写 Access Key。' : 'Re-enter the key in settings.') : m === 'limit' ? (zh ? '免费密钥每小时 50 次，稍后再试，或申请正式资格。' : '50 requests per hour on a free key.') : (zh ? `网络不可用（${m}）。检查网络后重试。` : m),
        actions: [{ label: zh ? '重试' : 'Retry', run: () => void run(), primary: true }, ...(m === 'key' ? [{ label: zh ? '打开设置' : 'Settings', run: () => plugin.openSettings('general') }] : [])] });
    }
  };
  const use = async (p: Photo, el: HTMLElement): Promise<void> => {
    el.addClass('is-busy');
    try { const blob = await downloadPhoto(src, p); await view.addBackgroundPhoto(blob, `Unsplash · ${p.author}`); } catch (e) { new Notice(zh ? `图片下载失败：${e instanceof Error ? e.message : String(e)}` : 'Download failed.'); } finally { el.removeClass('is-busy'); }
  };
  void run();
}
/** The secret id Qiaomu Home uses for its Unsplash key, if that plugin has one that still resolves. */
function homeSecret(view: CoverView): string {
  try {
    const home = (view.app as unknown as { plugins?: { plugins?: Record<string, { settings?: { wallpaper?: { unsplashSecret?: string } } }> } }).plugins?.plugins?.['qiaomu-home'];
    const id = home?.settings?.wallpaper?.unsplashSecret ?? ''; return id && unsplashKey(view.app, id) ? id : '';
  } catch { return ''; }
}
