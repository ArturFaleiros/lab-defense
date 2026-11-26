/**
 * Cliente da API do Lab Defense. A sessão fica em um cookie HttpOnly (o JavaScript da
 * página não tem acesso a ele); o perfil exibido é sempre o devolvido pelo servidor.
 */
import type { LogEntry } from '../engine/replay';
import type { CapsuleRoll } from '../progress/capsules';
import type { MatchSummary, Profile, RewardReport } from '../progress/profile';
import type { Difficulty, LoadoutEntry, TraitId, UnitId } from '../types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(path: string, method: 'GET' | 'POST' | 'DELETE', body?: unknown, timeoutMs = 20_000): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'offline', 'Sem conexão com o servidor do jogo.');
  } finally {
    clearTimeout(timer);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* corpo vazio ou inválido */
  }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; message?: string };
    throw new ApiError(res.status, d.error ?? 'error', d.message ?? 'Falha na comunicação com o servidor.');
  }
  return data as T;
}

export interface PlayerResponse {
  nick: string;
  profile: Profile;
  /** código de acesso (só na criação do jogador ou ao gerar um novo) */
  code?: string;
}

export interface StartResponse {
  matchId: string;
  seed: number;
  stageId: string;
  difficulty: Difficulty | null;
  entries: LoadoutEntry[];
  autoStart: boolean;
  showDamage: boolean;
}

export interface FinishResponse extends PlayerResponse {
  report: RewardReport | null;
  summary: MatchSummary | null;
  capsules: { roll: CapsuleRoll; ec: number; newSecret: boolean }[];
  mismatch: boolean;
}

export const api = {
  me: () => req<PlayerResponse | { nick: null }>('me', 'GET'),
  enter: (nick: string, code?: string) => req<PlayerResponse>('session', 'POST', { nick, code: code || undefined }),
  logout: () => req<{ ok: true }>('session', 'DELETE'),
  evolve: (unit: UnitId) => req<PlayerResponse & { achievements: string[] }>('profile', 'POST', { action: 'evolve', unit }),
  trait: (unit: UnitId, trait: TraitId | null) => req<PlayerResponse>('profile', 'POST', { action: 'trait', unit, trait }),
  loadout: (units: UnitId[]) => req<PlayerResponse>('profile', 'POST', { action: 'loadout', units }),
  settings: (settings: Partial<Profile['settings']>) => req<PlayerResponse>('profile', 'POST', { action: 'settings', settings }),
  reset: () => req<PlayerResponse>('profile', 'POST', { action: 'reset' }),
  rotateCode: () => req<PlayerResponse>('profile', 'POST', { action: 'rotate_code' }),
  quiz: (stageId: string, choice: number) =>
    req<PlayerResponse & { correct: boolean; ec: number; achievements: string[] }>('profile', 'POST', { action: 'quiz', stageId, choice }),
  startMatch: (stageId: string, units: UnitId[], difficulty: Difficulty) => req<StartResponse>('match', 'POST', { action: 'start', stageId, units, difficulty }),
  finishMatch: (body: { matchId: string; log: LogEntry[]; steps: number; claimed?: { won: boolean; waves: number; kills: number } }, abandon = false) =>
    req<FinishResponse>('match', 'POST', { action: abandon ? 'abandon' : 'finish', ...body }, 90_000),
};
