import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const { id, version } = JSON.parse(readFileSync('manifest.json', 'utf8'));
if (!/^[a-z0-9-]+$/.test(id) || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid package identity');
const fontManifest = readFileSync('src/fontmanifest.ts', 'utf8').match(/BUNDLED_FONTS: BundledFont\[\] = (\[[\s\S]*\]);\s*$/);
if (!fontManifest) throw new Error('Cannot read compiled font manifest');
for (const font of JSON.parse(fontManifest[1])) {
  const bytes = readFileSync(join('assets/fonts', font.file));
  if (bytes.length !== font.bytes || createHash('sha256').update(bytes).digest('hex') !== font.sha256) throw new Error(`Font integrity mismatch: ${font.id}`);
  if (readFileSync(join('assets/fonts/licenses', `${font.id}.txt`)).length < 500) throw new Error(`Font license missing: ${font.id}`);
}
const staging = mkdtempSync(join(tmpdir(), 'qiaomu-cover-package-'));
const folder = join(staging, id);
const output = resolve('artifacts', `${id}-${version}.zip`);
try {
  mkdirSync(folder); mkdirSync(resolve('artifacts'), { recursive: true });
  for (const file of ['main.js', 'manifest.json', 'styles.css', 'LICENSE', 'THIRD_PARTY.md']) cpSync(file, join(folder, file));
  cpSync('assets/fonts', join(folder, 'fonts'), { recursive: true });
  cpSync('assets/pack.json.gz', join(folder, 'assets-pack.json.gz'));
  cpSync('assets/licenses', join(folder, 'asset-licenses'), { recursive: true });
  rmSync(output, { force: true });
  execFileSync('zip', ['-qr', output, id], { cwd: staging });
  console.log(output);
} finally { rmSync(staging, { recursive: true, force: true }); }
