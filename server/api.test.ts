import { beforeAll, describe, expect, it } from 'vitest';
import { STAGE_BY_ID } from '../src/game/data/stages';
import { EXPERT_PRESETS, runBot } from '../src/game/engine/bot';
import { GameEngine } from '../src/game/engine/GameEngine';
import { attachRecorder, matchRng } from '../src/game/engine/replay';
import { buildConfig } from '../src/game/engine/setup';
import { handle, type Route } from './api';
import { setDb } from './db';
import { pgliteDb } from './pglite';

const ORIGIN = 'http://test.local';
let raw: Awaited<ReturnType<typeof pgliteDb>>['raw'];

beforeAll(async () => {
  process.env.INSECURE_COOKIES = '1';
  const db = await pgliteDb();
  raw = db.raw;
  setDb(db);
}, 60_000);

async function call(route: Route, body: unknown, o: { cookie?: string; origin?: string | null; method?: string; ip?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (o.origin !== null) headers.origin = o.origin ?? ORIGIN;
  if (o.cookie) headers.cookie = o.cookie;
  const method = o.method ?? (body === undefined ? 'GET' : 'POST');
  const res = await handle(route, new Request(`${ORIGIN}/api/${route}`, { method, headers, body: method === 'GET' ? undefined : JSON.stringify(body) }), o.ip ?? '203.0.113.7');
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, data: (await res.json()) as any, cookie: setCookie ? setCookie.split(';')[0] : undefined };
}

let ipSeq = 1;
async function newPlayer(nick: string) {
  // cada jogador de teste vem de um IP diferente (o limite real é 5 contas novas por IP/hora)
  const r = await call('session', { nick }, { ip: `10.0.0.${ipSeq++}` });
  expect(r.status).toBe(201);
  return { cookie: r.cookie!, code: r.data.code as string };
}

/** Simula o navegador: começa a partida, joga com o bot registrando os comandos e envia o log. */
async function playMatch(cookie: string, stageId: string, o: { cheat?: boolean; elapsedSec?: number } = {}) {
  const start = await call('match', { action: 'start', stageId, units: EXPERT_PRESETS[0].order.slice(0, 5) }, { cookie });
  expect(start.status).toBe(200);
  const s = start.data;
  const eng = new GameEngine(buildConfig(STAGE_BY_ID[stageId], s.entries, s.showDamage, s.difficulty ?? 'normal', matchRng(s.seed)));
  eng.autoStart = s.autoStart;
  const log = attachRecorder(eng);
  if (o.cheat) {
    const upd = eng.update.bind(eng);
    eng.update = (dt: number) => {
      eng.credits = 999_999;
      upd(dt);
    };
  }
  const order = [...new Set(s.entries.map((e: { id: string }) => e.id))] as never[];
  runBot(eng, { order: [...order, ...order, ...order], upgrades: true, maxUnits: 28, abilities: true }, 6000);
  // finge que a partida durou o tempo real compatível (o servidor recusa simulação rápida demais)
  await raw.query(`update labdefense.matches set started_at = now() - make_interval(secs => $2) where id = $1`, [s.matchId, o.elapsedSec ?? eng.time]);
  const fin = await call('match', { action: 'finish', matchId: s.matchId, log, steps: eng.steps, claimed: { won: eng.phase === 'won', waves: eng.phase === 'won' ? eng.totalWaves : eng.wave, kills: eng.stats.kills } }, { cookie });
  return { start: s, fin, eng, log };
}

describe('sessão por nick', () => {
  it('cria jogador, registra o IP e devolve perfil inicial', async () => {
    const r = await call('session', { nick: 'Artur_01' }, { ip: '198.51.100.20' });
    expect(r.status).toBe(201);
    expect(r.cookie).toMatch(/^ld_session=/);
    expect(r.data.profile.ec).toBe(0);
    const ips = await raw.query<{ ip: string; created_ip: string }>(
      `select host(pi.ip) as ip, host(p.created_ip) as created_ip from labdefense.player_ips pi join labdefense.players p on p.id = pi.player_id where p.nick_key = 'artur_01'`,
    );
    expect(ips.rows[0]).toEqual({ ip: '198.51.100.20', created_ip: '198.51.100.20' });
    const me = await call('me', undefined, { cookie: r.cookie });
    expect(me.data.nick).toBe('Artur_01');
  });

  it('não deixa outra pessoa usar um nick existente sem o código de acesso', async () => {
    const { code } = await newPlayer('Dono');
    expect((await call('session', { nick: 'dono' })).status).toBe(409);
    expect((await call('session', { nick: 'Dono', code: 'chute' })).status).toBe(403);
    const ok = await call('session', { nick: 'Dono', code });
    expect(ok.status).toBe(200);
    expect(ok.cookie).toBeTruthy();
  });

  it('valida o nick', async () => {
    for (const nick of ['ab', 'x'.repeat(17), '<script>', 'admin', 'Seu Caralho', ' -oi- ']) expect((await call('session', { nick })).status).toBe(400);
  });

  it('bloqueia requisições de outros sites (CSRF) e sem sessão', async () => {
    expect((await call('session', { nick: 'Teste1' }, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await call('session', { nick: 'Teste2' }, { origin: null })).status).toBe(403);
    const anon = await call('me', undefined);
    expect(anon.status).toBe(200);
    expect(anon.data.nick).toBeNull();
    expect((await call('me', undefined, { cookie: 'ld_session=00000000-0000-0000-0000-000000000000.forjado' })).status).toBe(401);
  });

  it('limita criação de contas por IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await call('session', { nick: `Spam${i}x` }, { ip: '192.0.2.99' })).status);
    expect(statuses.filter((s) => s === 201).length).toBe(5);
    expect(statuses).toContain(429);
  });
});

describe('partidas verificadas pelo servidor', () => {
  it('vitória legítima é re-simulada e recompensada', async () => {
    const { cookie } = await newPlayer('Jogador1');
    const { fin, eng } = await playMatch(cookie, '1-1');
    expect(eng.phase).toBe('won');
    expect(fin.status).toBe(200);
    expect(fin.data.mismatch).toBe(false);
    expect(fin.data.summary.won).toBe(true);
    expect(fin.data.report.ec).toBeGreaterThan(0);
    expect(fin.data.profile.stages['1-1'].cleared).toBe(true);
  }, 60_000);

  it('não aceita a mesma partida duas vezes', async () => {
    const { cookie } = await newPlayer('Jogador2');
    const { start, fin, log, eng } = await playMatch(cookie, '1-1');
    expect(fin.status).toBe(200);
    const again = await call('match', { action: 'finish', matchId: start.matchId, log, steps: eng.steps }, { cookie });
    expect(again.status).toBe(409);
  }, 60_000);

  it('créditos alterados pelo console não mudam o resultado do servidor', async () => {
    const { cookie } = await newPlayer('Trapaca1');
    const { fin, eng } = await playMatch(cookie, '1-1', { cheat: true });
    expect(eng.credits).toBeGreaterThan(900_000);
    expect(fin.status).toBe(200);
    // o servidor ignora os créditos falsos: o resultado é o da re-simulação honesta
    expect(fin.data.mismatch).toBe(true);
    const ev = await raw.query(`select 1 from labdefense.events where kind = 'match_mismatch'`);
    expect(ev.rows.length).toBeGreaterThan(0);
  }, 60_000);

  it('recusa partida enviada rápido demais (bot/acelerador)', async () => {
    const { cookie } = await newPlayer('Bot1');
    const { fin } = await playMatch(cookie, '1-1', { elapsedSec: 1 });
    expect(fin.status).toBe(422);
    expect(fin.data.profile).toBeUndefined();
  }, 60_000);

  it('não deixa começar fase bloqueada nem inventar resultado', async () => {
    const { cookie } = await newPlayer('Novato1');
    expect((await call('match', { action: 'start', stageId: '11-3', units: ['rele'] }, { cookie })).status).toBe(403);
    const s = await call('match', { action: 'start', stageId: '1-1', units: ['rele', 'tesla'] }, { cookie });
    expect(s.data.entries.map((e: { id: string }) => e.id)).toEqual(['rele']); // unidade não liberada é descartada
    await raw.query(`update labdefense.matches set started_at = now() - interval '1 hour' where id = $1`, [s.data.matchId]);
    // log vazio dizendo que venceu: o replay não termina → recusado
    const forged = await call('match', { action: 'finish', matchId: s.data.matchId, log: [], steps: 1000, claimed: { won: true, waves: 12, kills: 999 } }, { cookie });
    expect(forged.status).toBe(422);
  }, 60_000);

  it('perfil não pode ser escrito diretamente', async () => {
    const { cookie } = await newPlayer('Hacker1');
    const r = await call('profile', { action: 'set', profile: { ec: 999999 } }, { cookie });
    expect(r.status).toBe(400);
    const ev = await call('profile', { action: 'evolve', unit: 'rele' }, { cookie });
    expect(ev.status).toBe(400); // sem EC suficiente
  });

  it('desafio só após vitória verificada e uma única vez por partida', async () => {
    const { cookie } = await newPlayer('Quiz1');
    const stageId = '1-1';
    const quizStage = STAGE_BY_ID[stageId];
    expect((await call('profile', { action: 'quiz', stageId, choice: 0 }, { cookie })).status).toBe(409);
    await playMatch(cookie, stageId);
    if (!quizStage.quiz) return;
    const wrong = await call('profile', { action: 'quiz', stageId, choice: 3 }, { cookie });
    expect(wrong.status).toBe(200);
    // sem nova partida, não dá para tentar de novo
    expect((await call('profile', { action: 'quiz', stageId, choice: 0 }, { cookie })).status).toBe(409);
  }, 60_000);
});
