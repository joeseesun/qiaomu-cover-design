// Bundles the gallery page with the browser build of Fabric. Used by `npm run gallery`.
import esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
await esbuild.build({ entryPoints: [`${here}entry.ts`], bundle: true, format: 'iife', outfile: `${here}bundle.js`, logLevel: 'warning', loader: { '.json': 'json' } });
