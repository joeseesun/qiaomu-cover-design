/**
 * The "add model" dialog, modelled on the Qiaomu Clipper flow: pick a source from a card gallery, then a short form (key, model, and an
 * advanced fold for the address), instead of copying the current model and editing it in place. The same form edits a saved model.
 */
import { Modal, requestUrl, setIcon } from 'obsidian';
import type CoverPlugin from './main';
import type { ChatSnap, ImageSnap } from './aiparse';
import { saveChat, saveImage } from './aiparse';
import { CHAT_SOURCES, ChatSource, GROUPS, IMAGE_SOURCES, ImageSource, chatSnapFrom, chatSourceOf, imageSnapFrom, imageSourceOf, PopularModel } from './catalog';
import { textButton } from './ui';

type Source = ChatSource | ImageSource;
export type Kind = 'chat' | 'image';
export interface Editing { id: string; snap: ChatSnap | ImageSnap }

const TINTS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899'];
const tint = (id: string): string => TINTS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length]!;
function tile(parent: HTMLElement, s: Source, big = false): HTMLElement {
  const t = parent.createDiv({ cls: `qc-brand${big ? ' is-big' : ''}` }); t.style.background = tint(s.id);
  if (s.id === 'codex') setIcon(t, 'terminal'); else if (s.id === 'custom') setIcon(t, 'plus'); else if (s.id === 'ollama') setIcon(t, 'server'); else t.setText([...s.name.replace(/[^A-Za-z一-鿿]/g, '')][0]?.toUpperCase() ?? '?');
  return t;
}

export class ModelDialog extends Modal {
  private source?: Source; private error = '';
  constructor(private plugin: CoverPlugin, private kind: Kind, private done: () => void, private editing?: Editing) { super(plugin.app); }
  private get zh(): boolean { return this.plugin.isZh(); }
  private sources(): Source[] { return this.kind === 'chat' ? CHAT_SOURCES : IMAGE_SOURCES; }
  onOpen(): void {
    this.modalEl.addClass('qc-modal-wide'); this.contentEl.addClass('qc-modal', 'qc-model-dialog');
    if (this.editing) this.source = this.kind === 'chat' ? chatSourceOf(this.editing.snap as ChatSnap) : imageSourceOf(this.editing.snap as ImageSnap);
    this.draw();
  }
  onClose(): void { this.contentEl.empty(); }
  private title(): string { const z = this.zh; return this.editing ? (z ? '编辑模型' : 'Edit model') : this.kind === 'chat' ? (z ? '添加排版模型' : 'Add a layout model') : (z ? '添加生图模型' : 'Add a picture model'); }
  private draw(): void { this.titleEl.setText(this.title()); this.contentEl.empty(); this.error = ''; if (this.source) this.form(this.source); else this.gallery(); }

  private gallery(): void {
    const z = this.zh; const el = this.contentEl; el.createDiv({ text: z ? '先选一个来源，下一步填密钥和模型。' : 'Pick a source first; the next step asks for a key and a model.', cls: 'qc-hint' });
    const search = el.createEl('input', { type: 'text', cls: 'qc-md-search', attr: { placeholder: z ? '搜索来源…' : 'Search…', spellcheck: 'false' } });
    const grid = el.createDiv('qc-md-gallery');
    const render = (): void => {
      grid.empty(); const q = search.value.trim().toLowerCase(); let n = 0;
      for (const g of GROUPS) {
        const list = this.sources().filter(s => s.group === g.id && (!q || `${s.name} ${s.sub} ${s.id}`.toLowerCase().includes(q))); if (!list.length) continue; n += list.length;
        grid.createDiv({ text: g.zh, cls: 'qc-md-group' }); const row = grid.createDiv('qc-md-cards');
        for (const s of list) { const c = row.createDiv({ cls: 'qc-md-card', attr: { role: 'button', tabindex: '0' } }); tile(c, s); const t = c.createDiv('qc-md-card-text'); t.createDiv({ text: s.name, cls: 'qc-md-card-name' }); t.createDiv({ text: s.sub, cls: 'qc-md-card-sub' }); const go = (): void => { this.source = s; this.draw(); }; c.addEventListener('click', go); c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); }
      }
      if (!n) grid.createDiv({ text: z ? '没有匹配的来源。可以选“自定义”，填一个 OpenAI 兼容的地址。' : 'No match. Use Custom with an OpenAI-compatible address.', cls: 'qc-md-empty' });
    };
    search.addEventListener('input', render); render(); window.setTimeout(() => search.focus(), 30);
    const act = el.createDiv('qc-md-actions'); textButton(act, z ? '取消' : 'Cancel', () => this.close());
  }

  private form(s: Source): void {
    const z = this.zh; const el = this.contentEl; const snap = this.editing?.snap;
    const cur = { key: '', baseUrl: s.baseUrl, model: '', bin: '' };
    if (snap) { if (this.kind === 'chat') { const c = snap as ChatSnap; cur.key = c.apiKey; cur.baseUrl = c.baseUrl || s.baseUrl; cur.model = c.protocol === 'codex' ? c.codexModel : c.model; cur.bin = c.codexBin; } else { const c = snap as ImageSnap; cur.key = c.imageKey; cur.baseUrl = c.imageBaseUrl || s.baseUrl; cur.model = c.imageModel; } }
    else cur.model = s.models[0]?.id ?? '';
    const head = el.createDiv('qc-md-head'); tile(head, s, true); head.createEl('strong', { text: s.name }); head.createSpan({ text: s.sub, cls: 'qc-hint' });
    const field = (label: string, build: (box: HTMLElement) => HTMLElement, hint?: string): HTMLElement => { const row = el.createDiv('qc-md-field'); row.createEl('label', { text: label }); const input = build(row); if (hint) row.createDiv({ text: hint, cls: 'qc-hint' }); return input; };
    const codex = s.id === 'codex';
    if (codex) el.createDiv({ text: z ? '使用本机已登录的 Codex CLI（ChatGPT 账号），不需要密钥。模型留空就用它的默认模型。' : 'Uses the Codex CLI already signed in on this machine; no key needed.', cls: 'qc-md-note' });
    let keyInput: HTMLInputElement | undefined;
    if (!codex && !s.keyless) {
      keyInput = field(z ? 'API 密钥' : 'API key', box => {
        const wrap = box.createDiv('qc-md-wrap'); const i = wrap.createEl('input', { type: 'password', attr: { placeholder: 'sk-…', autocomplete: 'off', spellcheck: 'false' } }); i.value = cur.key;
        const show = wrap.createEl('button', { cls: 'qc-md-reveal', text: z ? '显示' : 'Show', attr: { type: 'button' } }); show.addEventListener('click', () => { i.type = i.type === 'password' ? 'text' : 'password'; show.setText(i.type === 'password' ? (z ? '显示' : 'Show') : (z ? '隐藏' : 'Hide')); }); return i;
      }) as HTMLInputElement;
      if (s.keyUrl) { const a = keyInput.closest('.qc-md-field')!.createEl('a', { text: z ? '没有密钥？去获取' : 'Get a key', href: s.keyUrl, cls: 'qc-md-link' }); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
    }
    const modelInput = field(z ? '模型' : 'Model', box => { const i = box.createEl('input', { type: 'text', attr: { placeholder: s.models[0]?.id ?? (codex ? (z ? '留空用默认' : 'default') : 'model-id'), spellcheck: 'false' } }); i.value = cur.model; return i; }) as HTMLInputElement;
    const listWrap = modelInput.closest('.qc-md-field')!.createDiv('qc-md-models'); let all: PopularModel[] = [...s.models];
    const renderModels = (): void => {
      listWrap.empty(); const q = modelInput.value.trim().toLowerCase(); const hits = all.filter(m => !q || m.id.toLowerCase().includes(q) || (m.name ?? '').toLowerCase().includes(q)).slice(0, 40);
      for (const m of hits) { const b = listWrap.createEl('button', { cls: `qc-md-model${m.id === modelInput.value ? ' is-active' : ''}`, attr: { type: 'button' } }); b.createSpan({ text: m.name ?? m.id }); if (m.name) b.createSpan({ text: m.id, cls: 'qc-hint' }); b.addEventListener('click', () => { modelInput.value = m.id; renderModels(); }); }
    };
    modelInput.addEventListener('input', renderModels); renderModels();
    const status = el.createDiv('qc-md-status');
    if (!codex) {
      const fetchBtn = textButton(listWrap.parentElement!.createDiv('qc-md-fetch'), z ? '获取可用模型' : 'Load models', () => void load(), 'qc-btn-sm', 'refresh-cw');
      const load = async (): Promise<void> => {
        const base = (baseInput.value.trim() || s.baseUrl).replace(/\/+$/, ''); status.setText(z ? '正在获取…' : 'Loading…'); status.removeClass('is-error'); fetchBtn.disabled = true;
        try { const got = await this.fetchModels(s, base, keyInput?.value.trim() ?? ''); if (got.length) { all = got; status.setText(z ? `获取到 ${got.length} 个模型` : `${got.length} models`); } else { status.setText(z ? '这个服务没有返回模型列表，已显示常用模型，也可以手动输入。' : 'No list returned; showing common ones.'); } renderModels(); }
        catch (e) { status.setText(z ? `没获取到列表（${e instanceof Error ? e.message : String(e)}），已显示常用模型，也可以手动输入。` : 'Could not load the list; type a model id.'); status.addClass('is-error'); }
        finally { fetchBtn.disabled = false; }
      };
    }
    const adv = el.createEl('details', { cls: 'qc-md-adv' }); adv.createEl('summary', { text: z ? '高级：接口地址' : 'Advanced: address' });
    const baseInput = (() => { const row = adv.createDiv('qc-md-field'); row.createEl('label', { text: z ? '接口地址' : 'Base URL' }); const i = row.createEl('input', { type: 'text', attr: { placeholder: s.baseUrl || 'https://…/v1', spellcheck: 'false' } }); i.value = cur.baseUrl; row.createDiv({ text: z ? '用自建中转或代理时修改；官方服务保持默认就行。' : 'Change for a relay or proxy.', cls: 'qc-hint' }); return i; })();
    if (s.id === 'custom') adv.setAttribute('open', '');
    let binInput: HTMLInputElement | undefined;
    if (codex) { const row = adv.createDiv('qc-md-field'); row.createEl('label', { text: z ? 'Codex 可执行文件路径' : 'Codex path' }); binInput = row.createEl('input', { type: 'text', attr: { placeholder: '~/.local/bin/codex', spellcheck: 'false' } }); binInput.value = cur.bin; }
    const err = el.createDiv('qc-md-status is-error');
    const act = el.createDiv('qc-md-actions');
    if (!this.editing) textButton(act, z ? '返回' : 'Back', () => { this.source = undefined; this.draw(); }, 'qc-ghost');
    textButton(act, z ? '取消' : 'Cancel', () => this.close());
    textButton(act, this.editing ? (z ? '保存' : 'Save') : (z ? '添加' : 'Add'), () => {
      const baseUrl = baseInput.value.trim() || s.baseUrl; const key = keyInput?.value.trim() ?? ''; const model = modelInput.value.trim();
      if (!codex && !baseUrl) { err.setText(z ? '请填写接口地址（高级里）。' : 'Enter the base URL.'); adv.setAttribute('open', ''); return; }
      if (!codex && !s.keyless && !key) { err.setText(z ? '请填写 API 密钥。' : 'Enter the API key.'); keyInput?.focus(); return; }
      if (!codex && !model) { err.setText(z ? '请选择或填写模型。' : 'Choose or type a model.'); modelInput.focus(); return; }
      const cfg = this.plugin.settings.ai;
      if (this.kind === 'chat') saveChat(cfg, chatSnapFrom(s as ChatSource, { key, baseUrl: codex ? '' : baseUrl, model, codexBin: binInput?.value.trim() ?? '' }), this.editing?.id);
      else saveImage(cfg, imageSnapFrom(s as ImageSource, { key, baseUrl: (s as ImageSource).engine === 'codex' ? '' : baseUrl, model }), this.editing?.id);
      cfg.enabled = true; void this.plugin.saveSettings().then(() => { this.close(); this.done(); });
    }, 'qc-primary');
    window.setTimeout(() => (keyInput ?? modelInput).focus(), 30);
  }

  /** Model ids from the service, best effort: OpenAI-style /models, Anthropic /v1/models, Gemini models, OpenRouter's public list. */
  private async fetchModels(s: Source, base: string, key: string): Promise<PopularModel[]> {
    const imageOnly = this.kind === 'image';
    if (s.id === 'openrouter') {
      const res = await requestUrl({ url: 'https://openrouter.ai/api/v1/models' + (imageOnly ? '?output_modalities=image' : ''), throw: false }); if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
      return ((res.json as { data?: { id: string; name?: string }[] }).data ?? []).map(m => ({ id: m.id, ...(m.name ? { name: m.name } : {}) }));
    }
    if (s.id === 'gemini' && imageOnly) {
      const res = await requestUrl({ url: `${base}/models?pageSize=200`, headers: { 'x-goog-api-key': key }, throw: false }); if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
      return ((res.json as { models?: { name: string; displayName?: string }[] }).models ?? []).filter(m => /image/i.test(m.name)).map(m => ({ id: m.name.replace(/^models\//, ''), ...(m.displayName ? { name: m.displayName } : {}) }));
    }
    if (imageOnly && (s.id === 'ark')) return [];
    const anthropic = s.id === 'anthropic'; const url = anthropic ? `${base}/v1/models` : `${base}/models`;
    const res = await requestUrl({ url, headers: anthropic ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' } : key ? { Authorization: `Bearer ${key}` } : {}, throw: false });
    if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
    const list = ((res.json as { data?: { id: string; display_name?: string }[] }).data ?? []).map(m => ({ id: m.id, ...(m.display_name ? { name: m.display_name } : {}) }));
    return imageOnly ? list.filter(m => /image|flux|diffusion|dall|cogview|seedream|imagen/i.test(m.id)) : list;
  }
}
