import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { AI_DEFAULTS, type AiConfig } from '../src/aiparse';

// Exercise the shipped service's request assembly with controlled provider transports.
const bundle = await build({ entryPoints: ['src/ai.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, plugins: [{ name: 'image-provider-fixture', setup(b) {
  b.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'fixture' }));
  b.onResolve({ filter: /^\.\/codex$/ }, () => ({ path: 'codex', namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: a.path === 'obsidian'
    ? 'export const requestUrl = request => globalThis.__imageRequest(request);'
    : 'export const findCodex = () => "fixture"; export const warmCodex = () => {}; export const codexText = () => { throw Error("layout planner called"); }; export const codexImage = (options, prompt) => globalThis.__codexImage(options, prompt);' }));
} }] });
const mod = { exports: {} as { AiService: new (cfg: () => AiConfig) => { image(prompt: string, w: number, h: number, style?: string, subject?: boolean, mode?: string): Promise<{ data: ArrayBuffer; type: string }> } } };
new Function('require', 'module', 'exports', bundle.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
const { AiService } = mod.exports;
const hooks = globalThis as typeof globalThis & { __imageRequest?: (request: { body: string; url: string }) => unknown; __codexImage?: (options: unknown, prompt: string) => unknown };
const fixture = { data: new Uint8Array([1, 2, 3]).buffer, type: 'image/png' };

test('direct generation sends the user prompt to each image provider without cover rules or layout planning', async () => {
  const prompt = '一张书店海报，写上“周末读书”，纸张风格';
  for (const engine of ['api', 'ark', 'gemini', 'openrouter', 'codex'] as const) {
    const cfg: AiConfig = { ...AI_DEFAULTS, enabled: true, imageOn: true, imageEngine: engine, imageKey: 'fixture', imageModel: 'fixture-model', imageBaseUrl: 'https://fixture.invalid/v1' };
    let calls = 0;
    hooks.__imageRequest = request => {
      ++calls; const body = JSON.parse(request.body);
      assert.equal(body.prompt ?? body.contents?.[0]?.parts?.[0]?.text, prompt);
      return { status: 200, json: engine === 'gemini' ? { candidates: [{ content: { parts: [{ inlineData: { data: 'AQID', mimeType: 'image/png' } }] } }] } : { data: [{ b64_json: 'AQID' }] } };
    };
    hooks.__codexImage = (_options, text) => { ++calls; assert.ok(text.startsWith(prompt)); assert.ok(text.includes('Requested image size:')); assert.ok(!text.includes('No text')); return fixture; };
    try {
      const result = await new AiService(() => cfg).image(prompt, 1080, 1440, 'ignored cover style', false, 'direct');
      assert.equal(calls, 1, engine); assert.equal(result.type, 'image/png'); assert.equal(result.data.byteLength, 3);
    } finally { delete hooks.__imageRequest; delete hooks.__codexImage; }
  }
});
test('the cover image route retains its existing rules', async () => {
  const cfg: AiConfig = { ...AI_DEFAULTS, imageEngine: 'api', imageBaseUrl: 'https://fixture.invalid/v1' };
  hooks.__imageRequest = request => { const text = JSON.parse(request.body).prompt; assert.ok(text.includes('No text')); assert.ok(text.includes('paper style')); return { status: 200, json: { data: [{ b64_json: 'AQID' }] } }; };
  try { await new AiService(() => cfg).image('a bookstore', 1000, 1000, 'paper style'); } finally { delete hooks.__imageRequest; }
});
test('an image provider failure is surfaced without silently retrying a paid generation', async () => {
  let calls = 0;
  hooks.__imageRequest = () => { ++calls; return { status: 429, text: '{"error":{"message":"quota exceeded"}}' }; };
  try {
    await assert.rejects(new AiService(() => ({ ...AI_DEFAULTS, imageEngine: 'ark' })).image('test', 1000, 1000, '', false, 'direct'), /quota exceeded/);
    assert.equal(calls, 1);
  } finally { delete hooks.__imageRequest; }
});
