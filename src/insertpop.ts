/** Category-specific insertion panels, anchored to the creation toolbar. */
import { StaticCanvas, Textbox } from 'fabric';
import { Notice, setIcon } from 'obsidian';
import { faceFor, isSingleWeight, pillFor, styleText, TEXT_GROUPS, TEXT_PRESETS, type TextPreset } from './textstyles';
import { PATH_SHAPES } from './shapes';
import type { CoverView } from './view';
import { ASSET_CATS, AssetCat, AssetItem, assetSvg, assetThumb, loadAssets, searchAssets } from './assets';
import { DECOR, drawDecor } from './decor';
import { downloadPhoto, hasSource, Photo, searchPhotos, Source, unsplashKey } from './unsplash';
import { emptyState, iconButton, quietName, textButton } from './ui';

type Tab = 'asset' | 'text' | 'shape' | 'image' | 'photo';
export type InsertCategory = 'text' | 'asset' | 'shape' | 'other';
let lastOther: Tab = 'image';
const STICKER_TAGS = ['火', '爱心', '火箭', '灯泡', '星', '皇冠', '奖杯', '礼物', '对勾', '警告', '钱', '书', '眼睛', '大脑', '笑'];
const LINE_TAGS = ['箭头', '对勾', '星星', '爱心', '火', '灯泡', '书', '电脑', '时间', '搜索', '设置', '用户', '位置', '链接'];
const PAGE = 90;

export function openInsertPopover(view: CoverView, anchor: HTMLElement, category: InsertCategory = 'other'): void {
  const doc = view.doc; const open = doc.querySelector('.qc-popover.qc-insert'); if (open) { const same = open.getAttribute('data-category') === category; open.dispatchEvent(new view.win.Event('qc-close')); if (same) return; }
  doc.querySelectorAll('.qc-popover').forEach(el => el.dispatchEvent(new view.win.Event('qc-close')));
  const zh = view.zh; const pop = doc.body.createDiv('qc-popover qc-insert qc-root-scope'); const r = anchor.getBoundingClientRect(); const width = Math.min(400, view.win.innerWidth - 16); const top = Math.max(8, Math.min(r.bottom + 6, view.win.innerHeight - 180));
  pop.dataset.category = category; pop.setAttribute('role', 'dialog'); const panelName = category === 'other' ? (zh ? '插入其他' : 'More inserts') : ({ text: zh ? '文字' : 'Text', asset: zh ? '素材' : 'Assets', shape: zh ? '形状' : 'Shapes' }[category]); quietName(pop, panelName);
  let tab: Tab = category === 'other' ? lastOther : category;
  pop.style.width = `${width}px`; pop.style.left = `${Math.max(8, Math.min(r.left, view.win.innerWidth - width - 8))}px`; pop.style.top = `${top}px`; pop.style.height = `${Math.max(0, Math.min(600, view.win.innerHeight - top - 8))}px`;
  const close = (): void => { pop.remove(); doc.removeEventListener('pointerdown', outside, true); doc.removeEventListener('keydown', esc, true); };
  const outside = (e: Event): void => { if (!pop.contains(e.target as Node) && !anchor.contains(e.target as Node)) close(); };
  const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  doc.addEventListener('pointerdown', outside, true); doc.addEventListener('keydown', esc, true); pop.addEventListener('qc-close', close);

  const tabsEl = pop.createDiv('qc-insert-tabs'); const body = pop.createDiv('qc-insert-body qc-assets');
  const TABS: [Tab, string, string, string][] = [['shape', 'shapes', '形状', 'Shapes'], ['image', 'image-plus', '图片', 'Image'], ['photo', 'camera', '背景图', 'Photos']];
  const draw = (): void => {
    tabsEl.empty();
    if (category !== 'other') tabsEl.createEl('strong', { cls: 'qc-insert-title', text: panelName });
    for (const [id, icon, zhName, enName] of category === 'other' ? TABS : []) {
      const b = tabsEl.createEl('button', { cls: 'qc-insert-tab', attr: { type: 'button' } });
      setIcon(b.createSpan({ cls: 'qc-insert-tab-icon' }), icon); b.createSpan({ text: zh ? zhName : enName }); b.classList.toggle('is-active', tab === id);
      b.addEventListener('click', () => { tab = lastOther = id; draw(); });
    }
    iconButton(tabsEl, 'x', view.t('close'), close, 'qc-insert-x');
    body.empty();
    if (tab === 'asset') assetsTab(view, body, close); else if (tab === 'text') textTab(view, body, close); else if (tab === 'shape') shapeTab(view, body, close);
    else if (tab === 'image') imageTab(view, body, close); else photoTab(view, body, draw);
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
  const insert = async (a: AssetItem, ev: MouseEvent): Promise<void> => { try { await view.addAssetSvg(assetSvg(a, view.palette?.ink ?? '#171717'), { asset: `${a.cat}:${a.id}`, ...(a.cat === 'line' && view.palette ? { tone: 'ink' } : {}) }); done(ev, close); } catch (e) { new Notice(e instanceof Error ? e.message : String(e)); } };
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
      const b = grid.createEl('button', { cls: 'qc-asset', attr: { type: 'button', 'aria-label': h.zh } }); b.createEl('img', { attr: { src: assetThumb(h), alt: h.zh } });
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
      const card = grid.createEl('button', { cls: 'qc-text-card', attr: { type: 'button' } }); const thumb = card.createDiv('qc-text-thumb is-loading'); card.createSpan({ text: zh ? p.zh : p.en, cls: 'qc-text-name' });
      textThumb(view, p).then(url => { thumb.removeClass('is-loading'); thumb.createEl('img', { attr: { src: url, alt: p.zh } }); }, () => thumb.removeClass('is-loading'));
      card.addEventListener('click', e => { void view.action(() => { view.addTextStyle(p); }); done(e, close); });
    }
  }
  body.createDiv({ text: zh ? '添加后双击画布改字；右侧能改字体、颜色、描边和阴影。装了字体包，艺术字会自动用更好看的字体。' : 'Double-click to edit; fonts, colours, stroke and shadow are on the right.', cls: 'qc-hint' });
}
/** 24 × 24 outlines for the extra shapes; filled with the cover's accent colour. Ids and paths live in shapes.ts so the assistant can call them too. */
function shapeTab(view: CoverView, body: HTMLElement, close: () => void): void {
  const zh = view.zh; body.createDiv({ text: zh ? '基础形状' : 'Basic', cls: 'qc-insert-sub' });
  const sg = body.createDiv('qc-shape-grid');
  const kinds: ['rect' | 'rounded' | 'circle' | 'triangle' | 'line' | 'star', string, string][] = [['rect', 'square', 'rectangle'], ['rounded', 'rectangle-horizontal', 'rounded'], ['circle', 'circle', 'circle'], ['triangle', 'triangle', 'triangle'], ['line', 'minus', 'line'], ['star', 'star', 'star']];
  for (const [kind, icon, key] of kinds) { const b = iconButton(sg, icon, view.t(key as 'rectangle'), () => undefined, 'qc-shape-btn'); b.addEventListener('click', e => { void view.action(() => { view.addShape(kind); }); done(e, close); }); }
  body.createDiv({ text: zh ? '更多形状' : 'More shapes', cls: 'qc-insert-sub' });
  const more = body.createDiv('qc-shape-more');
  for (const [id, name, d] of PATH_SHAPES) {
    const b = more.createEl('button', { cls: 'qc-shape-card', attr: { type: 'button' } });
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`; b.createSpan({ text: name });
    b.addEventListener('click', e => { view.addPathShape(d); done(e, close); }); b.dataset.id = id;
  }
  body.createDiv({ text: zh ? '装饰（跟随配色）' : 'Decorations (palette colours)', cls: 'qc-insert-sub' });
  const deco = body.createDiv('qc-shape-more'); const colors = view.palette ?? { ink: '#171717', accent: '#ef4444', sub: '#737373', bg2: '#e5e5e5', accentInk: '#ffffff' };
  for (const k of DECOR) {
    const art = drawDecor(k.id, colors, 'accent'); if (!art) continue;
    const b = deco.createEl('button', { cls: 'qc-shape-card', attr: { type: 'button', 'aria-description': k.use } }); b.createEl('img', { attr: { src: `data:image/svg+xml;utf8,${encodeURIComponent(art.svg)}`, alt: k.zh } }); b.createSpan({ text: k.zh });
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
        const b = grid.createEl('button', { cls: 'qc-photo', attr: { type: 'button', 'aria-label': p.author } }); b.style.background = p.color; b.createEl('img', { attr: { src: p.thumb, alt: p.author, loading: 'lazy' } });
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
