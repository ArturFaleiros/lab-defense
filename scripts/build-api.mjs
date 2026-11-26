// Empacota cada rota de server/routes em um único arquivo api/<rota>.js (ESM, sem imports
// relativos), para rodar nas funções Node.js da Vercel sem problemas de resolução de módulos.
import { build } from 'esbuild';
import { readdirSync, mkdirSync } from 'node:fs';

const routes = readdirSync('server/routes').filter((f) => f.endsWith('.ts'));
mkdirSync('api', { recursive: true });
await build({
  entryPoints: routes.map((f) => `server/routes/${f}`),
  outdir: 'api',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  minify: true,
  legalComments: 'none',
  external: ['pg-native'],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'info',
});
