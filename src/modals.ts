import { App, FuzzySuggestModal, Modal, Notice, setIcon, TFile, TFolder } from 'obsidian';
import type CoverPlugin from './main';
import type { CoverView } from './view';
import { Destination, ExportFormat, ExportPrefs, renderFilename, validSize } from './model';
import { GROUPS, PLATFORMS, platformById, platformFor } from './platforms';
import { TEMPLATES } from './templates';
import { bytes, numberBox, onEnter, segmented, slider, textButton } from './ui';
import { templateThumb } from './panels';

export class PickFile extends FuzzySuggestModal<TFile> {
  constructor(app: App, private files: TFile[], private pick: (file: TFile) => void, label: string) { super(app); this.setPlaceholder(label); }
  getItems(): TFile[] { return this.files; }
  getItemText(file: TFile): string { return file.path; }
  onChooseItem(file: TFile): void { this.pick(file); }
}
export class PickFolder extends FuzzySuggestModal<TFolder> {
  constructor(app: App, private pick: (path: string) => void, label: string) { super(app); this.setPlaceholder(label); }
  getItems(): TFolder[] { return this.app.vault.getAllFolders(true); }
  getItemText(f: TFolder): string { return f.isRoot() ? '/' : f.path; }
  onChooseItem(f: TFolder): void { this.pick(f.isRoot() ? '' : f.path); }
}

/* ---------- new cover ---------- */
export class NewCoverModal extends Modal {
  constructor(private plugin: CoverPlugin, private note?: TFile, private titleText = '') { super(plugin.app); }
  onOpen(): void {
    const t = this.plugin.t.bind(this.plugin); const zh = this.plugin.isZh();
    this.titleEl.setText(t('create')); this.modalEl.addClass('qc-modal-wide'); this.contentEl.addClass('qc-modal');
    let name = this.titleText || t('untitled'); let template = 'minimal'; let platform = this.plugin.settings.defaultPlatform;
    const form = this.contentEl.createDiv('qc-new');
    const nameRow = form.createDiv('qc-new-field'); nameRow.createEl('label', { text: this.note ? t('coverTitle') : t('name') });
    const input = nameRow.createEl('textarea', { cls: 'qc-textarea', attr: { rows: '2', spellcheck: 'false' } }); input.value = name;
    input.addEventListener('input', () => { name = input.value; });
    if (this.note) nameRow.createDiv({ text: t('fromNoteHint', { note: this.note.basename }), cls: 'qc-hint' });

    form.createEl('label', { text: t('platform') });
    const plats = form.createDiv('qc-plat-grid qc-plat-grid-wide');
    form.createEl('label', { text: t('template') });
    const grid = form.createDiv('qc-template-grid qc-template-grid-modal');
    const draw = (): void => {
      grid.empty(); const p = platformById(platform) ?? PLATFORMS[0]!;
      const subtitle = t('subtext'); const title = (name.split('\n')[0] || t('untitled')).slice(0, 40);
      for (const tpl of TEMPLATES) {
        const card = grid.createEl('button', { cls: 'qc-template', attr: { type: 'button' } }); card.classList.toggle('is-active', template === tpl.id);
        const thumb = card.createDiv('qc-template-thumb'); thumb.style.aspectRatio = `${p.width} / ${p.height}`;
        card.createSpan({ text: zh ? tpl.zh : tpl.en, cls: 'qc-template-name' });
        card.addEventListener('click', () => { template = tpl.id; for (const c of Array.from(grid.children)) c.classList.toggle('is-active', c === card); });
        void templateThumb(this.contentEl.ownerDocument, zh, p.width, p.height, tpl, title, subtitle).then(url => { if (card.isConnected) thumb.createEl('img', { attr: { src: url, alt: '' } }); }).catch(() => undefined);
      }
    };
    const drawPlatforms = (): void => {
      plats.empty();
      for (const grp of GROUPS) for (const p of PLATFORMS.filter(x => x.group === grp.id)) {
        const b = plats.createEl('button', { cls: 'qc-plat', attr: { type: 'button' } }); setIcon(b.createSpan({ cls: 'qc-plat-icon' }), p.icon);
        const text = b.createDiv('qc-plat-text'); text.createSpan({ text: zh ? p.zh : p.en, cls: 'qc-plat-name' }); text.createSpan({ text: `${p.width} × ${p.height}`, cls: 'qc-plat-size' });
        b.classList.toggle('is-active', platform === p.id);
        b.addEventListener('click', () => { platform = p.id; drawPlatforms(); draw(); });
      }
    };
    drawPlatforms(); draw();
    const footer = this.contentEl.createDiv('qc-modal-footer');
    textButton(footer, t('cancel'), () => this.close());
    const create = textButton(footer, t('createAction'), () => {
      create.disabled = true;
      void this.plugin.createDesign((name.split('\n')[0] || t('untitled')).slice(0, 60), template, this.note, name.trim() || undefined, platform).then(() => this.close()).catch(e => { this.plugin.report(e); create.disabled = false; });
    }, 'qc-primary');
    onEnter(input, e => { e.preventDefault(); create.click(); });
    window.setTimeout(() => { input.focus(); input.select(); }, 30);
  }
  onClose(): void { this.contentEl.empty(); }
}

/* ---------- custom size ---------- */
export class SizeModal extends Modal {
  constructor(private view: CoverView) { super(view.app); }
  onOpen(): void {
    const t = this.view.t.bind(this.view); const d = this.view.design!; let w = d.width, h = d.height; let fit = true;
    this.titleEl.setText(t('customSize')); this.contentEl.addClass('qc-modal');
    const row = this.contentEl.createDiv('qc-row qc-row-tight');
    numberBox(row, t('width'), w, v => { w = Math.round(v); }, { min: 200, max: 4096, unit: 'px' }); numberBox(row, t('height'), h, v => { h = Math.round(v); }, { min: 200, max: 4096, unit: 'px' });
    const label = this.contentEl.createEl('label', { cls: 'qc-check' }); const cb = label.createEl('input', { type: 'checkbox' }); cb.checked = true; cb.addEventListener('change', () => { fit = cb.checked; }); label.createSpan({ text: t('fitContent') });
    this.contentEl.createDiv({ text: t('sizeRange'), cls: 'qc-hint' });
    const footer = this.contentEl.createDiv('qc-modal-footer');
    textButton(footer, t('cancel'), () => this.close());
    textButton(footer, t('resize'), () => { if (!validSize(w, h)) { new Notice(t('sizeRange')); return; } this.view.resizeTo(w, h, fit); this.close(); }, 'qc-primary');
  }
  onClose(): void { this.contentEl.empty(); }
}

/* ---------- export ---------- */
export class ExportModal extends Modal {
  private prefs: ExportPrefs; private timer?: number; private run = 0; private busy = false;
  constructor(private view: CoverView) { super(view.app); this.prefs = view.exportPrefs(); }
  onOpen(): void {
    const view = this.view; const t = view.t.bind(view); const d = view.design!; const note = d.source ? view.app.vault.getAbstractFileByPath(d.source) : null; const hasNote = note instanceof TFile;
    const platform = platformFor(d.width, d.height, d.platform);
    this.titleEl.setText(t('export')); this.modalEl.addClass('qc-modal-wide'); this.contentEl.addClass('qc-modal');
    if (!hasNote && this.prefs.destination === 'note') this.prefs.destination = 'folder';
    const wrap = this.contentEl.createDiv('qc-export');
    const preview = wrap.createDiv('qc-export-preview'); const img = preview.createEl('img', { attr: { alt: '' } }); const info = preview.createDiv({ cls: 'qc-export-info' });
    const form = wrap.createDiv('qc-export-form');
    const update = (): void => this.schedule(img, info);
    const section = (label: string): HTMLElement => { const s = form.createDiv('qc-export-section'); s.createDiv({ text: label, cls: 'qc-export-label' }); return s; };

    const fmt = section(t('format'));
    segmented<ExportFormat>(fmt, [{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPEG' }, { value: 'webp', label: 'WebP' }], this.prefs.format, v => { this.prefs.format = v; quality.toggleClass('qc-hidden', v === 'png'); update(); });
    const quality = slider(fmt, t('quality'), Math.round(this.prefs.quality * 100), 40, 100, 1, v => { this.prefs.quality = v / 100; update(); }, v => `${v}%`);
    quality.toggleClass('qc-hidden', this.prefs.format === 'png');
    if (platform?.maxBytes) {
      const lim = fmt.createEl('label', { cls: 'qc-check' }); const cb = lim.createEl('input', { type: 'checkbox' }); cb.checked = this.prefs.fitLimit; cb.addEventListener('change', () => { this.prefs.fitLimit = cb.checked; update(); });
      lim.createSpan({ text: t('fitLimit', { size: bytes(platform.maxBytes) }) });
    }
    const size = section(t('exportSize'));
    segmented<string>(size, [{ value: '1', label: '1×' }, { value: '2', label: '2×' }, { value: '3', label: '3×' }], String(this.prefs.scale), v => { this.prefs.scale = Number(v); update(); });
    const dims = size.createDiv({ cls: 'qc-hint' });
    const showDims = (): void => dims.setText(`${d.width * this.prefs.scale} × ${d.height * this.prefs.scale} px`);
    showDims(); size.addEventListener('click', showDims);

    const name = section(t('filename'));
    const nameInput = name.createEl('input', { type: 'text', cls: 'qc-input', attr: { spellcheck: 'false' } }); nameInput.value = this.prefs.filename;
    const resolved = name.createDiv({ cls: 'qc-hint qc-mono' });
    const showName = (): void => { const ext = this.prefs.format === 'jpeg' ? 'jpg' : this.prefs.format; resolved.setText(`${renderFilename(this.prefs.filename, { name: view.file?.basename ?? 'Cover', platform: platform?.id ?? 'custom', size: `${d.width}x${d.height}`, date: '20260101', time: '120000' })}.${ext}`); };
    nameInput.addEventListener('input', () => { this.prefs.filename = nameInput.value; showName(); }); showName();
    name.createDiv({ text: t('filenameHint'), cls: 'qc-hint' });
    form.addEventListener('click', showName);

    const where = section(t('destination'));
    const opts: { value: Destination; label: string }[] = [{ value: 'folder', label: t('destFolder') }];
    if (hasNote) opts.push({ value: 'note', label: t('destNote') });
    opts.push({ value: 'system', label: t('destSystem') });
    const detail = where.createDiv('qc-dest-detail');
    const drawDest = (): void => {
      detail.empty();
      if (this.prefs.destination === 'folder') {
        const row = detail.createDiv('qc-row qc-row-tight'); const input = row.createEl('input', { type: 'text', cls: 'qc-input', attr: { spellcheck: 'false' } }); input.value = this.prefs.folder || view.plugin.settings.exportFolder;
        input.addEventListener('input', () => { this.prefs.folder = input.value.trim(); });
        textButton(row, t('choose'), () => new PickFolder(view.app, p => { this.prefs.folder = p; input.value = p; }, t('folderPick')).open(), 'qc-btn-sm', 'folder-open');
        detail.createDiv({ text: t('destFolderHint'), cls: 'qc-hint' });
      } else if (this.prefs.destination === 'note') {
        detail.createDiv({ text: t('destNoteHint', { folder: (note as TFile).parent?.path || '/' }), cls: 'qc-hint' });
      } else {
        const row = detail.createDiv('qc-row qc-row-tight'); const input = row.createEl('input', { type: 'text', cls: 'qc-input', attr: { spellcheck: 'false', placeholder: '~/Downloads' } }); input.value = this.prefs.systemDir;
        input.addEventListener('input', () => { this.prefs.systemDir = input.value.trim(); });
        textButton(row, t('choose'), () => void view.plugin.chooseSystemFolder(view.doc).then(p => { if (p) { this.prefs.systemDir = p; input.value = p; } }), 'qc-btn-sm', 'folder-open');
        detail.createDiv({ text: t('destSystemHint'), cls: 'qc-hint' });
      }
    };
    segmented<Destination>(where, opts, this.prefs.destination, v => { this.prefs.destination = v; drawDest(); });
    where.appendChild(detail); drawDest();

    const after = section(t('afterExport'));
    const check = (label: string, key: 'insert' | 'cover' | 'copy', disabled = false): void => {
      const l = after.createEl('label', { cls: 'qc-check' }); const cb = l.createEl('input', { type: 'checkbox' }); cb.checked = this.prefs[key] && !disabled; cb.disabled = disabled;
      cb.addEventListener('change', () => { this.prefs[key] = cb.checked; }); l.createSpan({ text: label });
    };
    check(t('afterInsert'), 'insert', !hasNote); check(t('afterCover'), 'cover', !hasNote); check(t('afterCopy'), 'copy');
    if (!hasNote) after.createDiv({ text: t('noSourceHint'), cls: 'qc-hint' });

    const footer = this.contentEl.createDiv('qc-modal-footer');
    textButton(footer, t('cancel'), () => this.close());
    const go = textButton(footer, t('export'), () => {
      if (this.busy) return; this.busy = true; go.disabled = true;
      void view.exportWith({ ...this.prefs, insert: this.prefs.insert && hasNote, cover: this.prefs.cover && hasNote }).then(() => this.close()).catch(e => { view.plugin.report(e); this.busy = false; go.disabled = false; });
    }, 'qc-primary', 'download');
    this.scope.register(['Mod'], 'Enter', () => { go.click(); return false; });
    update();
  }
  private schedule(img: HTMLImageElement, info: HTMLElement): void {
    const w = this.view.win; if (this.timer !== undefined) w.clearTimeout(this.timer);
    this.timer = w.setTimeout(() => void this.refresh(img, info), 280);
  }
  private async refresh(img: HTMLImageElement, info: HTMLElement): Promise<void> {
    const token = ++this.run; const view = this.view; const t = view.t.bind(view);
    try {
      const platform = view.platform(); const out = await view.encode(this.prefs, platform?.maxBytes);
      if (token !== this.run || !this.contentEl.isConnected) return;
      const url = URL.createObjectURL(out.blob); const old = img.src; img.onload = () => { if (old.startsWith('blob:')) URL.revokeObjectURL(old); }; img.src = url;
      const over = platform?.maxBytes && out.blob.size > platform.maxBytes;
      info.empty(); info.createSpan({ text: `${out.width} × ${out.height}` }); info.createSpan({ text: out.format.toUpperCase() });
      info.createSpan({ text: bytes(out.blob.size), cls: over ? 'is-warn' : '' });
      if (over) info.createDiv({ text: t('overLimit', { size: bytes(platform!.maxBytes!) }), cls: 'is-warn' });
      if (out.format !== this.prefs.format) info.createDiv({ text: t('exportConverted', { format: out.format.toUpperCase() }), cls: 'qc-hint' });
    } catch (e) { info.setText(e instanceof Error ? e.message : String(e)); }
  }
  onClose(): void {
    if (this.timer !== undefined) this.view.win.clearTimeout(this.timer); ++this.run;
    const src = this.contentEl.querySelector('img')?.src; if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
    this.contentEl.empty();
  }
}

/* ---------- shortcuts ---------- */
export class ShortcutsModal extends Modal {
  constructor(private plugin: CoverPlugin) { super(plugin.app); }
  onOpen(): void {
    const t = this.plugin.t.bind(this.plugin); this.titleEl.setText(t('shortcuts')); this.contentEl.addClass('qc-modal');
    const mod = /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';
    const rows: [string, string][] = [
      ['T', t('text')], ['R', t('rectangle')], ['O', t('circle')], ['L', t('line')], [`${mod} Z / ⇧${mod} Z`, `${t('undo')} / ${t('redo')}`], [`${mod} C / V / D`, `${t('copyObj')} / ${t('paste')} / ${t('duplicate')}`],
      [`${mod} A`, t('selectAll')], ['Delete', t('remove')], [`${mod} ] / [`, `${t('forward')} / ${t('backward')}`], [`⇧${mod} ] / [`, `${t('front')} / ${t('back')}`], [`${mod} L`, t('locked')],
      ['← ↑ → ↓', t('nudge')], [`${mod} + / − / 0 / 1`, t('zoomKeys')], [`${mod} E`, t('exportAs')], [`⇧${mod} E`, t('quickExport')], [`${mod} S`, t('save')], ['Esc', t('deselect')], ['?', t('shortcuts')],
    ];
    const table = this.contentEl.createEl('table', { cls: 'qc-shortcuts' });
    for (const [k, v] of rows) { const tr = table.createEl('tr'); tr.createEl('td').createEl('kbd', { text: k }); tr.createEl('td', { text: v }); }
  }
  onClose(): void { this.contentEl.empty(); }
}
