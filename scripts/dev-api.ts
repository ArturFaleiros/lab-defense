/**
 * Servidor local da API (desenvolvimento e testes de ponta a ponta), com PostgreSQL embutido.
 * Uso: npx tsx scripts/dev-api.ts   (porta 3001; o Vite encaminha /api para cá)
 */
import { createServer } from 'node:http';
import { setDb } from '../server/db';
import { pgliteDb } from '../server/pglite';
import { handle, type Route } from '../server/api';

process.env.INSECURE_COOKIES = '1';
const db = await pgliteDb(process.env.PGLITE_DIR || undefined);
setDb(db);
const ROUTES: Route[] = ['session', 'me', 'profile', 'match'];

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const route = url.pathname.replace(/^\/api\//, '') as Route;
  if (!ROUTES.includes(route)) {
    res.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(url, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body });
  const out = await handle(route, request, req.socket.remoteAddress);
  const h: Record<string, string> = {};
  out.headers.forEach((v, k) => (h[k] = v));
  res.writeHead(out.status, h).end(Buffer.from(await out.arrayBuffer()));
}).listen(3001, () => console.log('API local em http://localhost:3001 (PGlite)'));
