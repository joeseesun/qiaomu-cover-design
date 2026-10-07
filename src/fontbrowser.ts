import { Notice, setIcon } from 'obsidian';
import type { CoverView } from './view';
import { FontEntry } from './fonts';
import { iconButton, segmented, textButton } from './ui';

export interface FontBrowserOptions { current?: string; onPick: (family: string) => void | Promise<void>; popover?: boolean }
type Filter = 'all' | 'vault' | 'system' | 'fav' | 'recent';
const CHUNK = 60;
export const FONT_SITES: [string, string, string][] = [
  ['Google Fonts', 'https://fonts.google.com', 'fontsGoogle'],
  ['站酷字库', 'https://www.zcool.com.cn/special/zcoolfonts/', 'fontsZcool'],
  ['阿里巴巴普惠体', 'https://www.alibabafonts.com', 'fontsAlibaba'],
];

/** Searchable font list with import, favourites and recents. Shared by the left drawer and the inspector popover. */
export function renderFontBrowser(view: CoverView, host: HTMLElement, o: FontBrowserOptions): void {
  host.empty(); host.addClass('qc-fonts');
  const plugin = view.plugin; const fonts = plugin.fonts; const t = view.t.bind(view);
  const search = host.createEl('input', { type: 'text', cls: 'qc-search', attr: { placeholder: t('fontSearch'), spellcheck: 'false' } });
  let filter: Filter = 'all'; let query = '';
  segmented<Filter>(host, [
    { value: 'all', label: t('fontAll') }, { value: 'vault', label: t('fontVault') }, { value: 'system', label: t('fontSystem') }, { value: 'fav', label: t('fontFav') }, { value: 'recent', label: t('fontRecent') },
  ], filter, v => { filter = v; renderList(); }, 'qc-seg-small');
  const status = host.createDiv('qc-hint qc-font-status');
  const list = host.createDiv('qc-font-list');
  const foot = host.createDiv('qc-font-foot');
  const file = host.ownerDocument.createElement('input'); file.type = 'file'; file.multiple = true; file.accept = '.ttf,.otf,.woff,.woff2';
  file.addEventListener('change', () => void importFonts(Array.from(file.files ?? [])));
  const row = foot.createDiv('qc-row');
  textButton(row, t('fontImport'), () => file.click(), 'qc-btn-sm', 'upload');
  textButton(row, t('fontRefresh'), () => { void fonts.scanSystem(view.doc, true).then(() => void fonts.loadVault(view.doc)); }, 'qc-btn-sm', 'refresh-cw');
  foot.createDiv({ text: t('fontHint'), cls: 'qc-hint' });
  const sites = foot.createEl('details', { cls: 'qc-more' }); sites.createEl('summary', { text: t('fontGet') });
  for (const [name, url, key] of FONT_SITES) {
    const a = sites.createEl('a', { text: name, href: url, cls: 'qc-site' }); a.setAttribute('rel', 'noopener'); a.setAttribute('target', '_blank');
    sites.createSpan({ text: t(key as 'fontsGoogle'), cls: 'qc-hint' });
  }
  sites.createDiv({ text: t('fontLicense'), cls: 'qc-hint' });

  async function importFonts(files: File[]): Promise<void> {
    if (!files.length) return;
    try {
      const added = await fonts.importFiles(files, view.doc);
      new Notice(added.length ? t('fontsImported', { names: added.join(', ') }) : t('fontsNone'));
    } catch (e) { plugin.report(e); }
    file.value = '';
  }
  host.addEventListener('dragover', e => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); host.addClass('is-drop'); } });
  host.addEventListener('dragleave', () => host.removeClass('is-drop'));
  host.addEventListener('drop', e => { e.preventDefault(); host.removeClass('is-drop'); void importFonts(Array.from(e.dataTransfer?.files ?? [])); });

  let rendered = 0; let items: FontEntry[] = [];
  function matches(e: FontEntry): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    return e.family.toLowerCase().includes(q) || (e.zh ?? '').includes(query);
  }
  function visible(): FontEntry[] {
    const fav = new Set(plugin.settings.favFonts); const all = fonts.all();
    let base: FontEntry[];
    if (filter === 'vault') base = all.filter(e => e.source === 'vault');
    else if (filter === 'system') base = all.filter(e => e.source !== 'vault');
    else if (filter === 'fav') base = all.filter(e => fav.has(e.family));
    else if (filter === 'recent') base = plugin.settings.recentFonts.map(f => all.find(e => e.family === f) ?? { family: f, source: 'system' as const }).filter(Boolean);
    else base = [...all.filter(e => fav.has(e.family)), ...all.filter(e => !fav.has(e.family))];
    return base.filter(matches);
  }
  function addRows(): void {
    const fav = new Set(plugin.settings.favFonts);
    for (const e of items.slice(rendered, rendered + CHUNK)) {
      const btn = list.createDiv({ cls: 'qc-font-row', attr: { role: 'button', tabindex: '0' } });
      btn.classList.toggle('is-active', o.current === e.family);
      const sample = btn.createSpan({ text: view.zh ? '封面Aa' : 'CoverAa', cls: 'qc-font-sample' }); sample.style.fontFamily = `"${e.family.replace(/"/g, '')}", sans-serif`;
      const meta = btn.createDiv('qc-font-meta');
      meta.createSpan({ text: e.zh && view.zh ? `${e.zh}` : e.family, cls: 'qc-font-name' });
      meta.createSpan({ text: e.zh && view.zh ? e.family : (e.zh ?? ''), cls: 'qc-font-sub' });
      if (e.source === 'vault') btn.createSpan({ text: t('fontVault'), cls: 'qc-badge' });
      const star = btn.createEl('button', { cls: 'qc-star', attr: { type: 'button' } }); setIcon(star, 'star'); star.createSpan({ text: t('fontFav'), cls: 'qc-sr-only' });
      star.classList.toggle('is-on', fav.has(e.family));
      star.addEventListener('click', ev => { ev.stopPropagation(); const set = new Set(plugin.settings.favFonts); if (set.has(e.family)) set.delete(e.family); else set.add(e.family); plugin.settings.favFonts = [...set]; star.classList.toggle('is-on', set.has(e.family)); void plugin.saveSettings(); });
      const pick = (): void => { void o.onPick(e.family); if (o.popover) host.dispatchEvent(new CustomEvent('qc-close', { bubbles: true })); else renderList(); };
      btn.addEventListener('click', pick);
      btn.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
    }
    rendered = Math.min(items.length, rendered + CHUNK);
  }
  function renderList(): void {
    list.empty(); items = visible(); rendered = 0; addRows();
    if (!items.length) list.createDiv({ text: filter === 'vault' ? t('fontEmptyVault') : filter === 'fav' ? t('fontEmptyFav') : t('fontEmpty'), cls: 'qc-empty-note' });
    const s = fonts.state;
    status.setText(s === 'ok' ? t('fontCount', { n: fonts.system.length, v: fonts.vault.length }) : s === 'idle' ? t('fontScanning') : t('fontLimited'));
  }
  list.addEventListener('scroll', () => { if (list.scrollTop + list.clientHeight > list.scrollHeight - 160 && rendered < items.length) addRows(); });
  search.addEventListener('input', () => { if ((search as HTMLInputElement & { isComposing?: boolean }).isComposing) return; query = search.value.trim(); renderList(); });
  search.addEventListener('compositionend', () => { query = search.value.trim(); renderList(); });
  const off = fonts.onChange(() => { if (!host.isConnected) { off(); return; } renderList(); });
  renderList();
  void fonts.scanSystem(view.doc).then(() => { if (host.isConnected) renderList(); });
  if (o.popover) window.setTimeout(() => search.focus(), 30);
}

/** Floating font picker anchored to a button. Closes on outside click or Escape. */
export function openFontPopover(view: CoverView, anchor: HTMLElement, current: string, onPick: (family: string) => void | Promise<void>): void {
  const doc = view.doc; doc.querySelectorAll('.qc-popover').forEach(el => el.remove());
  const pop = doc.body.createDiv('qc-popover qc-root-scope');
  const r = anchor.getBoundingClientRect(); const width = 320; const win = view.win;
  pop.style.width = `${width}px`;
  pop.style.left = `${Math.max(8, Math.min(r.left, win.innerWidth - width - 8))}px`;
  const room = win.innerHeight - r.bottom - 12; const up = room < 360 && r.top > room;
  pop.style.maxHeight = `${Math.max(280, Math.min(520, (up ? r.top : room) - 12))}px`;
  if (up) pop.style.bottom = `${win.innerHeight - r.top + 6}px`; else pop.style.top = `${r.bottom + 6}px`;
  const close = (): void => { pop.remove(); doc.removeEventListener('pointerdown', outside, true); doc.removeEventListener('keydown', esc, true); };
  const outside = (e: Event): void => { if (!pop.contains(e.target as Node) && !anchor.contains(e.target as Node)) close(); };
  const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  doc.addEventListener('pointerdown', outside, true); doc.addEventListener('keydown', esc, true);
  pop.addEventListener('qc-close', close);
  renderFontBrowser(view, pop, { current, onPick, popover: true });
  const head = pop.createDiv('qc-popover-head'); iconButton(head, 'x', view.t('close'), close);
}
