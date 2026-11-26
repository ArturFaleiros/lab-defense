/**
 * Regras do servidor do Lab Defense. O navegador NUNCA define progresso, recompensas
 * ou resultado: ele envia intenções (nick, ações da coleção, comandos da partida) e o
 * servidor decide, usando as mesmas funções puras do jogo.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { DIFFICULTIES } from '../src/game/data/difficulty';
import { QUIZZES } from '../src/game/data/knowledge';
import { STAGE_BY_ID, type StageDef } from '../src/game/data/stages';
import { TRAITS } from '../src/game/data/traits';
import { UNITS } from '../src/game/data/units';
import { MAX_SIM_STEPS, matchRng, replayMatch, validateLog, type LogEntry } from '../src/game/engine/replay';
import { buildConfig, endlessStage, isEndless } from '../src/game/engine/setup';
import type { CapsuleRoll } from '../src/game/progress/capsules';
import {
  answerQuiz,
  applyMatch,
  defaultProfile,
  endlessMaps,
  evolve,
  fixLoadout,
  grantCapsule,
  isDifficultyUnlocked,
  isStageUnlocked,
  loadoutEntries,
  sanitize,
  setLoadout,
  setTrait,
  type MatchSummary,
  type Profile,
  type RewardReport,
} from '../src/game/progress/profile';
import type { Difficulty, LoadoutEntry, MapId, TraitId, UnitId } from '../src/game/types';
import { getDb, type Queryer } from './db';
import { HttpError, assertSameOrigin, clientIp, errorResponse, json, readCookie, readJson, sessionCookie, validateNick } from './http';

/* ====================================================================== */
/* Infra                                                                   */
/* ====================================================================== */

interface Player {
  id: string;
  nick: string;
  nick_key: string;
  token_hash: Uint8Array;
  banned: boolean;
  ban_reason: string | null;
}

/** Banimento com o motivo registrado no banco (exibido ao jogador). */
function bannedError(kind: 'player' | 'ip', reason: string | null): HttpError {
  const msg = kind === 'ip' ? 'O acesso a partir desta conexão (IP) foi bloqueado.' : 'Este jogador foi banido.';
  return new HttpError(403, 'banned', msg, { banKind: kind, reason: reason?.trim() || null });
}

const sha256 = (s: string) => createHash('sha256').update(s).digest();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Registra evento e aplica limite de requisições (janela deslizante). */
async function limit(
  q: Queryer,
  o: { kind: string; ip: string | null; playerId?: string | null; max: number; seconds: number; by: 'ip' | 'player'; detail?: unknown },
): Promise<void> {
  const key = o.by === 'ip' ? o.ip : o.playerId;
  if (key) {
    const col = o.by === 'ip' ? 'ip' : 'player_id';
    const { rows } = await q.query<{ n: string }>(
      `select count(*)::text as n from labdefense.events where ${col} = $1 and kind = $2 and at > now() - make_interval(secs => $3)`,
      [key, o.kind, o.seconds],
    );
    if (Number(rows[0].n) >= o.max) throw new HttpError(429, 'rate_limited', 'Muitas tentativas. Aguarde um pouco e tente novamente.');
  }
  await audit(q, o.kind, o.ip, o.playerId ?? null, o.detail);
}

async function audit(q: Queryer, kind: string, ip: string | null, playerId: string | null, detail?: unknown): Promise<void> {
  await q.query('insert into labdefense.events (kind, ip, player_id, detail) values ($1, $2, $3, $4)', [kind, ip, playerId, detail === undefined ? null : JSON.stringify(detail)]);
}

async function assertIpAllowed(q: Queryer, ip: string | null): Promise<void> {
  if (!ip) return;
  const { rows } = await q.query<{ reason: string | null }>('select reason from labdefense.ip_bans where ip = $1', [ip]);
  if (rows.length) throw bannedError('ip', rows[0].reason);
}

/** Identifica o jogador pelo cookie de sessão (id + segredo; o banco guarda só o hash). */
async function authenticate(q: Queryer, req: Request): Promise<Player | null> {
  const raw = readCookie(req);
  if (!raw) return null;
  const [id, secret] = raw.split('.');
  if (!id || !secret || !UUID.test(id) || secret.length > 80) return null;
  const { rows } = await q.query<Player>('select id, nick, nick_key, token_hash, banned, ban_reason from labdefense.players where id = $1', [id]);
  const p = rows[0];
  if (!p || !sameBytes(p.token_hash, sha256(secret))) return null;
  return p;
}

async function requirePlayer(q: Queryer, req: Request, ip: string | null): Promise<Player> {
  const p = await authenticate(q, req);
  if (!p) throw new HttpError(401, 'no_session', 'Entre com um nick para jogar.');
  if (p.banned) throw bannedError('player', p.ban_reason);
  await q.query('update labdefense.players set last_seen_at = now(), last_ip = coalesce($2::inet, last_ip) where id = $1', [p.id, ip]);
  if (ip) {
    await q.query(
      `insert into labdefense.player_ips (player_id, ip) values ($1, $2)
       on conflict (player_id, ip) do update set last_seen = now(), hits = labdefense.player_ips.hits + 1`,
      [p.id, ip],
    );
  }
  return p;
}

async function loadProfileFor(q: Queryer, playerId: string, lock = false): Promise<{ profile: Profile; rev: number }> {
  const { rows } = await q.query<{ data: unknown; rev: number }>(`select data, rev from labdefense.profiles where player_id = $1${lock ? ' for update' : ''}`, [playerId]);
  if (!rows[0]) return { profile: defaultProfile(), rev: -1 };
  return { profile: sanitize(rows[0].data), rev: rows[0].rev };
}

async function saveProfileFor(q: Queryer, playerId: string, profile: Profile, rev: number): Promise<void> {
  if (rev < 0) {
    await q.query('insert into labdefense.profiles (player_id, data, rev) values ($1, $2, 0)', [playerId, JSON.stringify(profile)]);
    return;
  }
  const { rows } = await q.query('update labdefense.profiles set data = $2, rev = rev + 1, updated_at = now() where player_id = $1 and rev = $3 returning rev', [playerId, JSON.stringify(profile), rev]);
  if (!rows.length) throw new HttpError(409, 'conflict', 'O progresso mudou em outra aba. Recarregue a página.');
}

function newSecret(): string {
  return randomBytes(24).toString('base64url');
}

/* ====================================================================== */
/* Rotas                                                                   */
/* ====================================================================== */

export type Route = 'session' | 'me' | 'profile' | 'match';

const LIMITS = { session: 2_048, profile: 4_096, match: 1_500_000 };

/** Ponto de entrada de todas as rotas. `socketIp` só é usado fora da Vercel. */
export async function handle(route: Route, req: Request, socketIp?: string): Promise<Response> {
  try {
    const ip = clientIp(req, socketIp);
    const db = getDb();
    if (req.method !== 'GET') assertSameOrigin(req);
    switch (route) {
      case 'me':
        if (req.method !== 'GET') break;
        return await db.tx(async (q) => {
          await assertIpAllowed(q, ip);
          // sem sessão não é erro: o navegador só precisa saber que deve pedir um nick
          if (!readCookie(req)) return json(200, { nick: null });
          const p = await requirePlayer(q, req, ip);
          const { profile } = await loadProfileFor(q, p.id);
          return json(200, { nick: p.nick, profile });
        });
      case 'session':
        if (req.method === 'DELETE') return json(200, { ok: true }, { 'set-cookie': sessionCookie(null) });
        if (req.method !== 'POST') break;
        return await sessionRoute(req, ip);
      case 'profile':
        if (req.method !== 'POST') break;
        return await profileRoute(req, ip);
      case 'match':
        if (req.method !== 'POST') break;
        return await matchRoute(req, ip);
    }
    return json(405, { error: 'method', message: 'Método não permitido.' });
  } catch (e) {
    return errorResponse(e);
  }
}

/* ---------------- Sessão: nick → jogador ---------------- */

async function sessionRoute(req: Request, ip: string | null): Promise<Response> {
  const body = await readJson(req, LIMITS.session);
  const { nick, key } = validateNick(body.nick);
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const db = getDb();
  return db.tx(async (q) => {
    await assertIpAllowed(q, ip);
    await limit(q, { kind: 'session_attempt', ip, max: 30, seconds: 600, by: 'ip' });

    const current = await authenticate(q, req);
    if (current) {
      if (current.banned) throw bannedError('player', current.ban_reason);
      if (current.nick_key === key) {
        const { profile } = await loadProfileFor(q, current.id);
        return json(200, { nick: current.nick, profile });
      }
      throw new HttpError(409, 'other_session', `Este navegador já está conectado como ${current.nick}. Saia em Ajustes para trocar de jogador.`);
    }

    const { rows } = await q.query<Player>('select id, nick, nick_key, token_hash, banned, ban_reason from labdefense.players where nick_key = $1', [key]);
    const existing = rows[0];
    if (existing) {
      // nick já cadastrado: só entra quem tem o código de acesso (outro navegador/dispositivo)
      if (!code) throw new HttpError(409, 'nick_taken', 'Este nick já está em uso. Se for seu, informe o código de acesso.');
      if (code.length > 80 || !sameBytes(existing.token_hash, sha256(code))) {
        await audit(q, 'session_fail', ip, existing.id);
        throw new HttpError(403, 'bad_code', 'Código de acesso incorreto.');
      }
      if (existing.banned) throw bannedError('player', existing.ban_reason);
      await audit(q, 'session_login', ip, existing.id);
      await q.query('update labdefense.players set last_seen_at = now(), last_ip = $2 where id = $1', [existing.id, ip]);
      const { profile } = await loadProfileFor(q, existing.id);
      return json(200, { nick: existing.nick, profile }, { 'set-cookie': sessionCookie(`${existing.id}.${code}`) });
    }

    await limit(q, { kind: 'session_create', ip, max: 5, seconds: 3600, by: 'ip' });
    const secret = newSecret();
    const ins = await q.query<{ id: string }>(
      'insert into labdefense.players (nick, nick_key, token_hash, created_ip, last_ip) values ($1, $2, $3, $4, $4) returning id',
      [nick, key, sha256(secret), ip],
    );
    const id = ins.rows[0].id;
    if (ip) await q.query('insert into labdefense.player_ips (player_id, ip) values ($1, $2)', [id, ip]);
    const profile = defaultProfile();
    await saveProfileFor(q, id, profile, -1);
    await audit(q, 'player_created', ip, id, { nick });
    // o código é mostrado uma única vez (o banco guarda só o hash)
    return json(201, { nick, profile, code: secret }, { 'set-cookie': sessionCookie(`${id}.${secret}`) });
  });
}

/* ---------------- Coleção, ajustes e desafio ---------------- */

const unitId = (v: unknown): UnitId => {
  if (typeof v !== 'string' || !(v in UNITS)) throw new HttpError(400, 'unit', 'Unidade inválida.');
  return v as UnitId;
};

async function profileRoute(req: Request, ip: string | null): Promise<Response> {
  const body = await readJson(req, LIMITS.profile);
  const action = body.action;
  const db = getDb();
  return db.tx(async (q) => {
    await assertIpAllowed(q, ip);
    const player = await requirePlayer(q, req, ip);
    await limit(q, { kind: 'profile_action', ip, playerId: player.id, max: 90, seconds: 60, by: 'player', detail: { action } });
    const { profile, rev } = await loadProfileFor(q, player.id, true);
    let next = profile;
    const extra: Record<string, unknown> = {};

    switch (action) {
      case 'evolve': {
        const r = evolve(profile, unitId(body.unit));
        if (!r.ok) throw new HttpError(400, 'evolve', 'Não é possível evoluir esta unidade agora.');
        next = r.profile;
        extra.achievements = r.achievements;
        break;
      }
      case 'trait': {
        const t = body.trait;
        if (t !== null && (typeof t !== 'string' || !(t in TRAITS))) throw new HttpError(400, 'trait', 'Característica inválida.');
        next = setTrait(profile, unitId(body.unit), t as TraitId | null);
        break;
      }
      case 'loadout': {
        if (!Array.isArray(body.units) || body.units.length > 12) throw new HttpError(400, 'loadout', 'Equipe inválida.');
        next = setLoadout(profile, body.units.map(unitId));
        break;
      }
      case 'settings': {
        const s = body.settings as Record<string, unknown> | undefined;
        if (!s || typeof s !== 'object') throw new HttpError(400, 'settings', 'Ajustes inválidos.');
        const patch: Partial<Profile['settings']> = {};
        for (const k of ['sound', 'showDamage', 'autoStart'] as const) if (typeof s[k] === 'boolean') patch[k] = s[k] as boolean;
        if (typeof s.volume === 'number' && Number.isFinite(s.volume)) patch.volume = Math.min(1, Math.max(0, s.volume));
        next = { ...profile, settings: { ...profile.settings, ...patch } };
        break;
      }
      case 'reset': {
        next = { ...defaultProfile(), settings: profile.settings };
        await q.query("update labdefense.matches set status = 'expired' where player_id = $1 and status = 'open'", [player.id]);
        break;
      }
      case 'rotate_code': {
        const secret = newSecret();
        await q.query('update labdefense.players set token_hash = $2 where id = $1', [player.id, sha256(secret)]);
        await audit(q, 'code_rotated', ip, player.id);
        return json(200, { nick: player.nick, profile, code: secret }, { 'set-cookie': sessionCookie(`${player.id}.${secret}`) });
      }
      case 'quiz': {
        const stageId = typeof body.stageId === 'string' ? body.stageId : '';
        const stage = STAGE_BY_ID[stageId];
        const quiz = stage?.quiz ? QUIZZES[stage.quiz] : undefined;
        if (!stage || !quiz || !Number.isInteger(body.choice)) throw new HttpError(400, 'quiz', 'Desafio inválido.');
        if (profile.stages[stageId]?.quizDone) throw new HttpError(409, 'quiz_done', 'Desafio já concluído.');
        // um desafio por partida verificada desta fase, nas últimas 2 horas
        const m = await q.query<{ id: string }>(
          `select id from labdefense.matches where player_id = $1 and stage_id = $2 and status = 'verified'
             and finished_at > now() - interval '2 hours' and (result->>'won')::boolean and coalesce((result->>'quiz')::boolean, false) = false
           order by finished_at desc limit 1 for update`,
          [player.id, stageId],
        );
        if (!m.rows[0]) throw new HttpError(409, 'quiz_unavailable', 'Vença a fase para liberar o desafio.');
        await q.query(`update labdefense.matches set result = result || '{"quiz": true}'::jsonb where id = $1`, [m.rows[0].id]);
        const correct = body.choice === quiz.correct;
        const r = answerQuiz(profile, stageId, correct);
        next = r.profile;
        Object.assign(extra, { correct, ec: r.ec, achievements: r.achievements });
        break;
      }
      default:
        throw new HttpError(400, 'action', 'Ação desconhecida.');
    }
    await saveProfileFor(q, player.id, next, rev);
    return json(200, { nick: player.nick, profile: next, ...extra });
  });
}

/* ---------------- Partidas ---------------- */

interface MatchRow {
  id: string;
  stage_id: string;
  difficulty: Difficulty | null;
  seed: string;
  loadout: { entries: LoadoutEntry[]; autoStart: boolean; showDamage: boolean };
  status: string;
  elapsed: number;
}

function stageFor(id: string, profile: Profile): StageDef {
  if (isEndless(id)) {
    const map = id.slice(2) as MapId;
    if (!endlessMaps(profile).includes(map)) throw new HttpError(403, 'locked', 'Mapa ainda não liberado.');
    return endlessStage(map);
  }
  const stage = STAGE_BY_ID[id];
  if (!stage) throw new HttpError(400, 'stage', 'Fase inválida.');
  if (!isStageUnlocked(profile, stage)) throw new HttpError(403, 'locked', 'Fase ainda bloqueada.');
  return stage;
}

async function matchRoute(req: Request, ip: string | null): Promise<Response> {
  const body = await readJson(req, LIMITS.match);
  const db = getDb();
  if (body.action === 'start') return db.tx((q) => startMatch(q, req, ip, body));
  if (body.action === 'finish' || body.action === 'abandon') {
    // a verificação roda fora de uma transação longa: lê, re-simula e grava em seguida
    return finishMatch(req, ip, body, body.action === 'abandon');
  }
  throw new HttpError(400, 'action', 'Ação desconhecida.');
}

async function startMatch(q: Queryer, req: Request, ip: string | null, body: Record<string, unknown>): Promise<Response> {
  await assertIpAllowed(q, ip);
  const player = await requirePlayer(q, req, ip);
  await limit(q, { kind: 'match_start', ip, playerId: player.id, max: 40, seconds: 3600, by: 'player' });
  const { profile } = await loadProfileFor(q, player.id);
  const stageId = typeof body.stageId === 'string' ? body.stageId.slice(0, 40) : '';
  const stage = stageFor(stageId, profile);
  const endless = isEndless(stageId);
  let difficulty: Difficulty | null = null;
  if (!endless) {
    const d = body.difficulty ?? 'normal';
    if (typeof d !== 'string' || !(d in DIFFICULTIES)) throw new HttpError(400, 'difficulty', 'Dificuldade inválida.');
    if (!isDifficultyUnlocked(profile, stageId, d as Difficulty)) throw new HttpError(403, 'locked', 'Dificuldade ainda bloqueada.');
    difficulty = d as Difficulty;
  }
  if (!Array.isArray(body.units) || body.units.length > 12) throw new HttpError(400, 'units', 'Equipe inválida.');
  const wanted = [...new Set(body.units.map(unitId))];
  const allowed = fixLoadout(wanted.filter((u) => profile.units.includes(u) && (!stage.allowed || stage.allowed.includes(u)))).slice(0, 5);
  if (!allowed.length) throw new HttpError(400, 'units', 'Escolha ao menos uma unidade liberada.');
  const entries = loadoutEntries(profile, allowed);

  await q.query("update labdefense.matches set status = 'expired', finished_at = now() where player_id = $1 and status = 'open'", [player.id]);
  const seed = randomInt(1, 2 ** 32 - 1);
  const loadout = { entries, autoStart: profile.settings.autoStart, showDamage: profile.settings.showDamage };
  const { rows } = await q.query<{ id: string }>(
    'insert into labdefense.matches (player_id, stage_id, difficulty, seed, loadout, ip) values ($1, $2, $3, $4, $5, $6) returning id',
    [player.id, stageId, difficulty, seed, JSON.stringify(loadout), ip],
  );
  return json(200, { matchId: rows[0].id, seed, stageId, difficulty, ...loadout });
}

async function finishMatch(req: Request, ip: string | null, body: Record<string, unknown>, abandon: boolean): Promise<Response> {
  const db = getDb();
  const matchId = typeof body.matchId === 'string' && UUID.test(body.matchId) ? body.matchId : null;
  const steps = body.steps;
  if (!matchId || typeof steps !== 'number' || !Number.isInteger(steps) || steps < 0 || steps > MAX_SIM_STEPS) throw new HttpError(400, 'match', 'Partida inválida.');
  const logErr = validateLog(body.log);
  const log = body.log as LogEntry[];

  // 1) leitura e validações rápidas
  const { player, match } = await db.tx(async (q) => {
    await assertIpAllowed(q, ip);
    const player = await requirePlayer(q, req, ip);
    await limit(q, { kind: 'match_finish', ip, playerId: player.id, max: 60, seconds: 3600, by: 'player' });
    const { rows } = await q.query<MatchRow>(
      `select id, stage_id, difficulty, seed::text as seed, loadout, status, extract(epoch from now() - started_at)::float8 as elapsed
         from labdefense.matches where id = $1 and player_id = $2`,
      [matchId, player.id],
    );
    return { player, match: rows[0] };
  });
  if (!match) throw new HttpError(404, 'match', 'Partida não encontrada.');
  if (match.status !== 'open') throw new HttpError(409, 'match_closed', 'Esta partida já foi encerrada.');

  const reject = async (reason: string, detail?: unknown) => {
    await db.tx(async (q) => {
      await q.query("update labdefense.matches set status = 'rejected', finished_at = now(), reject_reason = $2 where id = $1 and status = 'open'", [matchId, reason]);
      await audit(q, 'match_rejected', ip, player.id, { matchId, reason, detail });
    });
    throw new HttpError(422, 'rejected', 'A partida não pôde ser validada pelo servidor e não gerou recompensas.');
  };

  if (logErr) return reject('log', logErr);
  if (log.length && log[log.length - 1][0] > steps) return reject('log_after_end');
  // velocidade máxima do jogo é 3×: a simulação não pode ter andado mais rápido que isso
  if (steps / (60 * 3) > match.elapsed + 20) return reject('too_fast', { steps, elapsed: match.elapsed });
  if (match.elapsed > 6 * 3600) return reject('expired');

  // 2) re-simulação no servidor (fonte da verdade)
  const stage = isEndless(match.stage_id) ? endlessStage(match.stage_id.slice(2) as MapId) : STAGE_BY_ID[match.stage_id];
  const cfg = buildConfig(stage, match.loadout.entries, match.loadout.showDamage, match.difficulty ?? 'normal', matchRng(Number(match.seed)));
  const { engine } = replayMatch(cfg, match.loadout.autoStart, log, abandon ? steps : steps + 3);
  if (!abandon && !engine.isOver) return reject('not_finished', { steps, replaySteps: engine.steps });

  const won = engine.phase === 'won';
  const waves = won ? engine.totalWaves : Math.max(0, engine.wave);
  const claimed = body.claimed as { won?: unknown; waves?: unknown; kills?: unknown } | undefined;
  const mismatch = !abandon && !!claimed && (claimed.won !== won || claimed.waves !== waves || claimed.kills !== engine.stats.kills);

  // 3) aplica recompensas ao perfil (transação com bloqueio da linha do perfil)
  return db.tx(async (q) => {
    const again = await q.query<{ status: string }>('select status from labdefense.matches where id = $1 for update', [matchId]);
    if (again.rows[0]?.status !== 'open') throw new HttpError(409, 'match_closed', 'Esta partida já foi encerrada.');
    const { profile: start, rev } = await loadProfileFor(q, player.id, true);
    let profile = start;
    const capsules: { roll: CapsuleRoll; ec: number; newSecret: boolean }[] = [];
    const achievements: string[] = [];
    for (const roll of engine.stats.capsules) {
      const g = grantCapsule(profile, `${matchId}:${roll.milestone}`, roll);
      if (!g.applied) continue;
      profile = g.profile;
      capsules.push({ roll, ec: g.ec, newSecret: g.newSecret });
      achievements.push(...g.achievements);
    }
    let report: RewardReport | null = null;
    let summary: MatchSummary | null = null;
    if (!abandon) {
      summary = { stageId: match.stage_id, won, waves, stats: engine.stats, difficulty: engine.config.difficulty ?? null };
      const r = applyMatch(profile, summary);
      profile = r.profile;
      report = { ...r.report, achievements: [...achievements, ...r.report.achievements] };
    }
    await saveProfileFor(q, player.id, profile, rev);
    const result = { won, waves, kills: engine.stats.kills, leaks: engine.stats.leaks, xp: report?.xp ?? 0, ec: report?.ec ?? 0, capsules: capsules.length, mismatch };
    await q.query('update labdefense.matches set status = $2, finished_at = now(), sim_steps = $3, result = $4 where id = $1', [
      matchId,
      abandon ? 'abandoned' : 'verified',
      engine.steps,
      JSON.stringify(result),
    ]);
    await audit(q, mismatch ? 'match_mismatch' : 'match_verified', ip, player.id, { matchId, claimed: claimed ?? null, result });
    return json(200, { nick: player.nick, profile, report, summary, capsules, mismatch });
  });
}
