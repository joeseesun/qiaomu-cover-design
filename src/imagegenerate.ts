import { Modal, Notice } from 'obsidian';
import { directImageConfig, imageLabel, imageReady, type AiConfig } from './aiparse';
import { ModelDialog } from './modeldialog';
import { textButton } from './ui';
import type { CoverView } from './view';

/** Direct generation is an explicit, single image job, separate from the cover designer. */
export class ImageGenerateDialog extends Modal {
  private closed = false;
  private running = false;
  constructor(private view: CoverView, private done: () => void) { super(view.app); }
  onOpen(): void {
    this.closed = false;
    const v = this.view, t = v.t.bind(v);
    this.titleEl.setText(t('aiGenerateImage'));
    this.modalEl.addClass('qc-image-generate-modal');
    const el = this.contentEl; el.addClass('qc-modal', 'qc-image-generate'); el.empty();
    const uid = `qc-image-${crypto.randomUUID()}`;
    const field = (name: string, suffix: string): HTMLElement => {
      const row = el.createDiv('qc-image-field'); row.createEl('label', { text: name, attr: { for: `${uid}-${suffix}` } }); return row;
    };
    const prompt = field(t('imagePrompt'), 'prompt').createEl('textarea', { cls: 'qc-image-prompt', attr: { id: `${uid}-prompt`, rows: '5', placeholder: t('imagePromptHint') } });
    prompt.value = v.imageDraft;
    prompt.addEventListener('input', () => { v.imageDraft = prompt.value; sync(); });
    const modelRow = field(t('imageModel'), 'model');
    const model = modelRow.createEl('select', { cls: 'qc-select qc-image-model', attr: { id: `${uid}-model` } });
    const populate = (): void => {
      model.empty(); const cfg = v.plugin.settings.ai;
      const ids = new Set(cfg.images.map(p => p.id)); if (cfg.imageId) ids.add(cfg.imageId);
      for (const id of ids) {
        const c = directImageConfig(cfg, id); if (!c || !imageReady({ ...c, enabled: true })) continue;
        model.createEl('option', { value: id, text: imageLabel(c) });
      }
      const wanted = v.imageModelId || cfg.imageId;
      if (Array.from(model.options).some(o => o.value === wanted)) model.value = wanted;
      model.toggleClass('qc-hidden', !model.options.length); sync();
    };
    model.addEventListener('change', () => { v.imageModelId = model.value; sync(); });
    const add = textButton(modelRow, t('imageAddModel'), () => new ModelDialog(v.plugin, 'image', () => { if (!this.closed) { v.imageModelId = v.plugin.settings.ai.imageId; populate(); } }).open(), 'qc-btn-sm');
    const ratio = field(t('directImageRatio'), 'ratio').createEl('select', { cls: 'qc-select qc-image-ratio', attr: { id: `${uid}-ratio` } });
    for (const id of ['canvas', '1:1', '3:4', '4:3', '16:9', '9:16']) ratio.createEl('option', { value: id, text: id === 'canvas' ? t('imageCanvasRatio') : id });
    const note = el.createDiv({ cls: 'qc-hint qc-image-note' });
    const enable = textButton(el, t('settings'), () => { this.close(); v.plugin.openSettings('assistant'); }, 'qc-btn-sm qc-image-settings');
    const status = el.createDiv({ cls: 'qc-image-status', attr: { role: 'status', 'aria-live': 'polite' } });
    const footer = el.createDiv('qc-modal-footer');
    const close = textButton(footer, t('cancel'), () => this.close());
    const generate = textButton(footer, t('imageGenerateInsert'), () => void run(), 'qc-primary qc-image-submit', 'sparkles');
    const sync = (): void => {
      generate.disabled = this.running || v.directImageBusy || !prompt.value.trim() || !config();
      model.disabled = ratio.disabled = add.disabled = prompt.disabled = this.running;
      close.setText(t(this.running ? 'close' : 'cancel'));
      enable.toggleClass('qc-hidden', v.plugin.settings.ai.enabled);
      note.setText(this.running ? t('imageGenerationClose') : !v.plugin.settings.ai.enabled ? t('imageAiDisabled') : !model.options.length ? t('imageModelEmpty') : '');
    };
    const config = (): AiConfig | undefined => {
      const c = directImageConfig(v.plugin.settings.ai, model.value); return c && imageReady(c) ? c : undefined;
    };
    const run = async (): Promise<void> => {
      if (this.running || v.directImageBusy || !prompt.value.trim()) return;
      const c = config(); if (!c) return;
      const d = v.design; if (!d) return;
      const [rw, rh] = ratio.value === 'canvas' ? [d.width, d.height] : ratio.value.split(':').map(Number);
      const width = ratio.value === 'canvas' ? d.width : Math.round(1536 * rw! / Math.max(rw!, rh!));
      const height = ratio.value === 'canvas' ? d.height : Math.round(1536 * rh! / Math.max(rw!, rh!));
      c.imageSize = 'auto'; v.imageModelId = model.value;
      this.running = true; status.setText(t('imageGenerating')); sync();
      try {
        const inserted = await v.generateInsertedImage(prompt.value.trim(), c, width, height, () => !this.closed);
        if (this.closed) return;
        if (inserted) { new Notice(t('imageInserted')); this.close(); }
        else status.setText(t('imageNotInserted'));
      } catch (e) {
        if (!this.closed) status.setText(t('error', { message: e instanceof Error ? e.message : String(e) }));
      } finally { this.running = false; if (!this.closed) sync(); }
    };
    // Plain Enter and IME commit belong to the prompt. Only Cmd/Ctrl+Enter submits.
    prompt.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); void run(); }
    });
    populate();
    v.win.requestAnimationFrame(() => { if (prompt.isConnected) prompt.focus({ preventScroll: true }); });
  }
  onClose(): void { this.closed = true; this.contentEl.empty(); this.done(); }
}
