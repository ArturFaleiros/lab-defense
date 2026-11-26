import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import JavaScriptObfuscator from 'javascript-obfuscator';

/**
 * Lab Defense — `npm run build` gera dist/ (site) e api/*.js (funções serverless).
 * `npm run dev` + `npm run dev:api` para desenvolvimento local (API com PostgreSQL embutido).
 */

/**
 * Ofusca o código do próprio app nos builds de produção (bibliotecas de terceiros ficam de
 * fora). Dificulta ler e alterar o código — inclusive com ajuda de IA —, mas não impede:
 * a proteção real é o servidor re-simular cada partida.
 */
function obfuscateAppChunks(): Plugin {
  return {
    name: 'obfuscate-app-chunks',
    apply: 'build',
    enforce: 'post',
    renderChunk(code, chunk) {
      if (chunk.name === 'vendor' || !chunk.moduleIds.some((id) => id.includes('/src/') && !id.includes('node_modules'))) return null;
      const out = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        simplify: true,
        target: 'browser',
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        stringArray: true,
        stringArrayEncoding: ['none'],
        stringArrayThreshold: 0.6,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        splitStrings: false,
        // quebra o código se ele for "embelezado" para leitura/edição
        selfDefending: true,
        // opções que pesam no desempenho do jogo ficam desligadas
        controlFlowFlattening: false,
        deadCodeInjection: false,
        transformObjectKeys: false,
        numbersToExpressions: false,
        debugProtection: false,
        sourceMap: false,
      });
      return { code: out.getObfuscatedCode(), map: null };
    },
  };
}

/** Mesmos cabeçalhos de segurança da Vercel, para testar localmente com `vite preview`. */
function productionHeaders(): Record<string, string> {
  const cfg = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
  return Object.fromEntries(
    cfg.headers[0].headers
      .filter((h) => h.key !== 'Strict-Transport-Security')
      .map((h) => [h.key, h.value.replace('; upgrade-insecure-requests', '')]),
  );
}

export default defineConfig(({ command }) => {
  const prod = command === 'build';
  return {
    plugins: [react(), ...(prod ? [obfuscateAppChunks()] : [])],
    base: './',
    server: {
      port: 5173,
      open: false,
      proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: false } },
    },
    preview: { headers: productionHeaders(), proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: false } } },
    esbuild: prod ? { drop: ['console', 'debugger'], legalComments: 'none' } : undefined,
    build: {
      chunkSizeWarningLimit: 2000,
      sourcemap: false,
      outDir: 'dist',
      assetsInlineLimit: 4096,
      rollupOptions: {
        input: resolve('index.html'),
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) return 'vendor';
          },
        },
      },
    },
    test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
  };
});
