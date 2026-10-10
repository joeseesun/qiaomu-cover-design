/**
 * Intent eval: runs every case in tests/intent/cases.ts through the real planner (routing, prompt, structured output, repair
 * round) against a live model, and reports accuracy per domain. Uses the same planTurn as the plugin; only the transport
 * differs (fetch here, Obsidian's requestUrl there).
 *
 * Model settings, in order: EVAL_BASE_URL / EVAL_API_KEY / EVAL_MODEL / EVAL_PROTOCOL (openai|anthropic), or the plugin's
 * data.json given by EVAL_DATA (default: the vault the deploy script targets). Optional: EVAL_ONLY=id1,id2  EVAL_RUNS=3.
 *   npm run eval
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planTurn, type Complete } from '../src/planner';
import { BUNDLED_FONTS } from '../src/fontmanifest';
import type { AssistantInput } from '../src/ops';
import { CASES } from '../tests/intent/cases';
import { META, NODES, PALETTE } from '../tests/fixtures/scene';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
interface Model { protocol: 'openai' | 'anthropic'; baseUrl: string; apiKey: string; model: string }
function model(): Model {
  if (process.env.EVAL_BASE_URL) return { protocol: process.env.EVAL_PROTOCOL === 'anthropic' ? 'anthropic' : 'openai', baseUrl: process.env.EVAL_BASE_URL, apiKey: process.env.EVAL_API_KEY ?? '', model: process.env.EVAL_MODEL ?? '' };
  const path = process.env.EVAL_DATA ?? resolve(root, '../qiaomu-home-dashboard-qa/.obsidian/plugins/qiaomu-cover-design/data.json');
  const ai = (JSON.parse(readFileSync(path, 'utf8')) as { ai?: { protocol?: string; baseUrl?: string; apiKey?: string; model?: string } }).ai ?? {};
  if (ai.protocol === 'codex') throw new Error('The eval needs an HTTP model; set EVAL_BASE_URL / EVAL_API_KEY / EVAL_MODEL.');
  return { protocol: ai.protocol === 'anthropic' ? 'anthropic' : 'openai', baseUrl: (ai.baseUrl ?? '').replace(/\/+$/, ''), apiKey: ai.apiKey ?? '', model: ai.model ?? '' };
}
/** Same request shapes as AiService.complete, with the same structured-output fallback. */
function transport(m: Model): Complete {
  let plain = false;
  const call = async (system: string, history: { role: 'user' | 'assistant'; text: string }[], user: string): Promise<string> => {
    const messages = [...history.map(h => ({ role: h.role, content: h.text })), { role: 'user', content: user }];
    const anthropic = m.protocol === 'anthropic';
    const body = anthropic
      ? { model: m.model, max_tokens: 4000, system, messages, ...(plain ? {} : { tools: [{ name: 'canvas_commands', description: 'Return the commands for the cover canvas.', input_schema: { type: 'object', properties: { intent: { type: 'string' }, reply: { type: 'string' }, ops: { type: 'array', items: { type: 'object' } }, designs: { type: 'array', items: { type: 'object' } }, options: { type: 'array', items: { type: 'string' } } }, required: ['reply', 'ops'] } }], tool_choice: { type: 'tool', name: 'canvas_commands' } }) }
      : { model: m.model, messages: [{ role: 'system', content: system }, ...messages], ...(plain ? {} : { response_format: { type: 'json_object' } }) };
    const res = await fetch(anthropic ? `${m.baseUrl}/v1/messages` : `${m.baseUrl}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', ...(anthropic ? { 'x-api-key': m.apiKey, 'anthropic-version': '2023-06-01' } : { authorization: `Bearer ${m.apiKey}` }) }, body: JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) { if (!plain && (res.status === 400 || res.status === 422)) { plain = true; return call(system, history, user); } throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`); }
    const json = JSON.parse(text) as { content?: { type: string; text?: string; input?: unknown }[]; choices?: { message?: { content?: string } }[] };
    if (anthropic) { const tool = json.content?.find(p => p.type === 'tool_use'); return tool ? JSON.stringify(tool.input) : json.content?.map(p => p.text ?? '').join('') ?? ''; }
    return json.choices?.[0]?.message?.content ?? '';
  };
  return call;
}

/** What a fresh install offers: the default font library, exactly as FontService.catalog() describes it. */
const fontBook = BUNDLED_FONTS.map(b => ({ family: b.family, source: 'bundled', ...(b.cjk ? { zh: b.family } : {}), mood: b.mood, cjk: b.cjk, hint: b.cjk ? b.hint : b.zh }));
function input(prompt: string, selection: string[]): AssistantInput {
  return {
    prompt, zh: true, fonts: fontBook.map(f => f.family), platform: 'xhs', size: { width: META.width, height: META.height },
    scene: { nodes: NODES, meta: { ...META, selection } }, state: { template: META.template, palette: PALETTE, titleFont: '得意黑', bodyFont: '思源黑体' },
    fontBook, chooseDesigns: true, noPicture: true, history: [],
  };
}

async function main(): Promise<void> {
  const m = model(); const complete = transport(m); const only = process.env.EVAL_ONLY?.split(',');
  const runs = Math.max(1, Number(process.env.EVAL_RUNS ?? 1)); const cases = CASES.filter(c => !only || only.includes(c.id));
  console.log(`Model ${m.model} @ ${m.baseUrl} · ${cases.length} cases × ${runs}`);
  type Row = { id: string; domain: string; prompt: string; ok: boolean; why: string; intent?: string; ops: string; ms: number; repaired?: boolean };
  const rows: Row[] = []; const queue = cases.flatMap(c => Array.from({ length: runs }, () => c));
  const worker = async (): Promise<void> => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const t0 = Date.now();
      try {
        const plan = await planTurn(complete, input(c.prompt, c.selection ?? []), false);
        const verdict = c.check({ ops: plan.ops, selection: c.selection ?? [], designs: plan.designs?.length ?? 0, specs: plan.designs ?? [], options: plan.options?.length ?? 0, fontBook });
        rows.push({ id: c.id, domain: c.domain, prompt: c.prompt, ok: verdict === true, why: verdict === true ? '' : verdict, intent: plan.intent, ops: JSON.stringify(plan.designs?.length ? { designs: plan.designs.length } : plan.ops), ms: Date.now() - t0, repaired: plan.repaired });
      } catch (e) { rows.push({ id: c.id, domain: c.domain, prompt: c.prompt, ok: false, why: `error: ${e instanceof Error ? e.message : String(e)}`, ops: '', ms: Date.now() - t0 }); }
      const r = rows[rows.length - 1]!; console.log(`${r.ok ? '✔' : '✖'} ${r.id.padEnd(18)} ${String(r.ms).padStart(6)}ms  ${r.ok ? '' : r.why}`);
    }
  };
  await Promise.all(Array.from({ length: Number(process.env.EVAL_CONCURRENCY ?? 4) }, worker));
  const domains = [...new Set(rows.map(r => r.domain))];
  const pct = (xs: Row[]): string => `${xs.filter(r => r.ok).length}/${xs.length} (${Math.round(xs.filter(r => r.ok).length / xs.length * 100)}%)`;
  const summary = [`Overall ${pct(rows)}`, ...domains.map(d => `${d.padEnd(10)} ${pct(rows.filter(r => r.domain === d))}`)];
  console.log('\n' + summary.join('\n'));
  const out = resolve(root, 'artifacts/intent-eval'); mkdirSync(out, { recursive: true });
  const md = [`# Intent eval · ${m.model} · ${new Date().toISOString().slice(0, 16)}`, '', ...summary.map(s => `- ${s}`), '', '| | case | prompt | intent | ops | note |', '|---|---|---|---|---|---|',
    ...rows.sort((a, b) => a.id.localeCompare(b.id)).map(r => `| ${r.ok ? '✔' : '✖'} | ${r.id} | ${r.prompt} | ${(r.intent ?? '').replace(/\|/g, '/')} | \`${r.ops.slice(0, 220).replace(/\|/g, '/')}\` | ${r.why.replace(/\|/g, '/')}${r.repaired ? ' (repaired)' : ''} |`)].join('\n');
  writeFileSync(resolve(out, 'report.md'), md); console.log(`\nReport: artifacts/intent-eval/report.md`);
}
void main();
