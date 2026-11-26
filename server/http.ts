/**
 * Utilitários HTTP e de segurança compartilhados pelas rotas /api.
 */
import { isIP } from 'node:net';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const BASE_HEADERS: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-resource-policy': 'same-origin',
};

export function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...extra } });
}

/** Resposta de erro sem detalhes internos (nada de stack trace para o cliente). */
export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return json(e.status, { error: e.code, message: e.message });
  console.error('[api] erro interno', e);
  return json(500, { error: 'internal', message: 'Erro interno. Tente novamente.' });
}

/**
 * IP do cliente. Na Vercel, `x-real-ip` e `x-forwarded-for` são definidos pelo próprio
 * proxy da plataforma (valores enviados pelo cliente são sobrescritos), então são confiáveis
 * ali. Fora da Vercel, só confiamos nesses cabeçalhos se TRUST_PROXY=1.
 */
export function clientIp(req: Request, socketIp?: string): string | null {
  const trusted = process.env.VERCEL === '1' || process.env.TRUST_PROXY === '1';
  const raw = trusted ? (req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]) : socketIp;
  const ip = raw?.trim().replace(/^::ffff:/, '') ?? '';
  return isIP(ip) ? ip : null;
}

function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Proteção contra CSRF e uso da API por outros sites: requisições que alteram estado
 * precisam vir do próprio site (cabeçalho Origin na lista permitida).
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get('origin');
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') throw new HttpError(403, 'origin', 'Origem não permitida.');
  if (!origin) throw new HttpError(403, 'origin', 'Origem ausente.');
  const allowed = allowedOrigins();
  const self = new URL(req.url).origin;
  if (origin !== self && !allowed.includes(origin)) throw new HttpError(403, 'origin', 'Origem não permitida.');
}

/** Lê JSON com limite de tamanho e Content-Type obrigatório. */
export async function readJson(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'content_type', 'Envie JSON.');
  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > maxBytes) throw new HttpError(413, 'too_large', 'Requisição grande demais.');
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'too_large', 'Requisição grande demais.');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'bad_json', 'JSON inválido.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'bad_body', 'Corpo inválido.');
  return body as Record<string, unknown>;
}

/* ---------------- Cookie de sessão ---------------- */

export const COOKIE = 'ld_session';

export function readCookie(req: Request, name = COOKIE): string | null {
  const raw = req.headers.get('cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** HttpOnly (JavaScript da página não lê), Secure, SameSite=Strict e restrito a /api. */
export function sessionCookie(value: string | null): string {
  const secure = process.env.INSECURE_COOKIES === '1' ? '' : '; Secure';
  if (value === null) return `${COOKIE}=; Path=/api; HttpOnly${secure}; SameSite=Strict; Max-Age=0`;
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/api; HttpOnly${secure}; SameSite=Strict; Max-Age=31536000`;
}

/* ---------------- Nick ---------------- */

const RESERVED = new Set(['admin', 'administrador', 'adm', 'moderador', 'mod', 'root', 'sistema', 'system', 'suporte', 'staff', 'emlab', 'labdefense', 'null', 'undefined']);
const OFFENSIVE = new Set(['porra', 'caralho', 'puta', 'puto', 'merda', 'buceta', 'viado', 'fdp', 'pqp', 'cu', 'piroca', 'pinto', 'cacete', 'arrombado', 'vagabunda', 'vadia', 'corno', 'bosta', 'nazi', 'hitler']);

/** Normaliza e valida o nick. Retorna { nick, key } ou lança HttpError(400). */
export function validateNick(raw: unknown): { nick: string; key: string } {
  if (typeof raw !== 'string') throw new HttpError(400, 'nick', 'Informe um nick.');
  const nick = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (nick.length < 3 || nick.length > 16) throw new HttpError(400, 'nick', 'O nick deve ter de 3 a 16 caracteres.');
  if (!/^[\p{L}\p{N}](?:[\p{L}\p{N} _.-]*[\p{L}\p{N}])?$/u.test(nick))
    throw new HttpError(400, 'nick', 'Use letras, números, espaço, ponto, hífen ou sublinhado (começando e terminando com letra ou número).');
  const key = nick.toLowerCase();
  const plain = key.normalize('NFD').replace(/\p{M}/gu, '');
  const tokens = plain.split(/[^a-z0-9]+/).filter(Boolean);
  const squashed = plain.replace(/[^a-z0-9]/g, '');
  if (RESERVED.has(squashed) || tokens.some((t) => RESERVED.has(t))) throw new HttpError(400, 'nick', 'Este nick é reservado.');
  if (tokens.some((t) => OFFENSIVE.has(t)) || OFFENSIVE.has(squashed)) throw new HttpError(400, 'nick', 'Escolha outro nick.');
  return { nick, key };
}
