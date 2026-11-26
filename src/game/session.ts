import { useSyncExternalStore } from 'react';
import { registerTickable, Store, unregisterTickable } from '../simulations/engine';
import { configureSound, playSfx } from './audio/sfx';
import { ACHIEVEMENTS } from './data/achievements';
import { STAGE_BY_ID, type StageDef } from './data/stages';
import { UNITS } from './data/units';
import { GameEngine } from './engine/GameEngine';
import { attachRecorder, matchRng, type LogEntry } from './engine/replay';
import { buildConfig, endlessStage, isEndless } from './engine/setup';
import { api, ApiError, type PlayerResponse } from './net/api';
import { SECRET_DUPLICATE_EC, type CapsuleRoll } from './progress/capsules';
import { defaultProfile, type MatchSummary, type Profile, type RewardReport } from './progress/profile';
import type { Difficulty, MapId, TraitId, UnitId } from './types';

/**
 * Estado da experiência do jogo (fora da árvore React, como os motores do laboratório).
 *
 * Desde a versão com servidor, o PROGRESSO É DO SERVIDOR: o navegador só exibe o perfil
 * que a API devolve. Cada partida recebe uma semente do servidor e todos os comandos do
 * jogador são registrados; ao final, o servidor re-simula a partida e concede as
 * recompensas que ele mesmo calculou.
 */

export type Screen =
  | { id: 'menu' }
  | { id: 'campaign' }
  | { id: 'modes' }
  | { id: 'loadout'; stageId: string; difficulty?: Difficulty }
  | { id: 'match' }
  | { id: 'result' }
  | { id: 'units'; unit?: UnitId }
  | { id: 'achievements' }
  | { id: 'knowledge'; tab?: 'unidades' | 'inimigos' | 'modificadores' | 'sinergias' | 'glossario' | 'formulas' }
  | { id: 'settings' };

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'warn' | 'boss' | 'ok' | 'unlock';
}

export type AuthState = 'loading' | 'anon' | 'ready' | 'offline' | 'banned';

/** Banimento informado pelo servidor (jogador ou IP), com o motivo registrado. */
export interface BanInfo {
  kind: 'player' | 'ip';
  reason: string | null;
}

export interface SessionState {
  screen: Screen;
  profile: Profile;
  engine: GameEngine | null;
  stage: StageDef | null;
  loadoutIds: UnitId[];
  report: RewardReport | null;
  summary: MatchSummary | null;
  toasts: Toast[];
  saveFailed: boolean;
  /** dificuldade da partida atual */
  difficulty: Difficulty;
  /** cápsula sendo exibida (animação de abertura) */
  capsule: CapsuleView | null;
  /* ---- servidor ---- */
  auth: AuthState;
  nick: string | null;
  /** código de acesso recém-gerado (mostrado uma única vez) */
  accessCode: string | null;
  /** operação em andamento (iniciar/verificar partida) */
  busy: 'start' | 'verify' | null;
  netError: string | null;
  ban: BanInfo | null;
}

export interface CapsuleView {
  roll: CapsuleRoll;
  ec: number;
  newSecret: boolean;
  /** a partida estava pausada antes da cápsula? (para restaurar) */
  wasPaused: boolean;
}

interface ActiveMatch {
  engine: GameEngine;
  matchId: string;
  log: LogEntry[];
  sent: boolean;
}

let toastSeq = 1;

class GameSession extends Store<SessionState> {
  /** partida em andamento (fora do estado público para não ser exposta à interface) */
  #active: ActiveMatch | null = null;

  constructor() {
    super();
    const profile = defaultProfile();
    this.snap = {
      screen: { id: 'menu' },
      profile,
      engine: null,
      stage: null,
      loadoutIds: profile.loadout,
      report: null,
      summary: null,
      toasts: [],
      saveFailed: false,
      difficulty: 'normal',
      capsule: null,
      auth: 'loading',
      nick: null,
      accessCode: null,
      busy: null,
      netError: null,
      ban: null,
    };
    if (typeof window !== 'undefined') void this.refresh();
  }

  private set(patch: Partial<SessionState>) {
    this.snap = { ...this.snap, ...patch };
    this.emit();
  }

  get state(): SessionState {
    return this.snap;
  }

  go(screen: Screen): void {
    if (this.snap.engine && screen.id !== 'match' && !this.snap.engine.isOver) this.snap.engine.setPaused(true);
    this.set({ screen });
  }

  /* ---------- conta (nick) ---------- */

  /** Carrega jogador e perfil do servidor. */
  async refresh(): Promise<void> {
    try {
      const r = await api.me();
      if (r.nick === null) this.set({ auth: 'anon', nick: null });
      else this.applyPlayer(r as PlayerResponse);
    } catch (e) {
      if (this.checkBanned(e)) return;
      if (e instanceof ApiError && e.status === 401) this.set({ auth: 'anon', nick: null });
      else this.set({ auth: 'offline', netError: (e as Error).message });
    }
  }

  /**
   * Confere no servidor se o jogador continua liberado (banimento aplicado com a página
   * aberta aparece sem precisar jogar). Não altera o perfil nem a partida em andamento.
   */
  async checkStatus(): Promise<void> {
    if (this.snap.auth !== 'ready') return;
    try {
      await api.status();
    } catch (e) {
      this.checkBanned(e);
    }
  }

  /** Se o erro for de banimento, troca para a tela de banido (com o motivo). */
  checkBanned(e: unknown): boolean {
    if (!(e instanceof ApiError) || e.code !== 'banned') return false;
    const reason = typeof e.data.reason === 'string' && e.data.reason.trim() ? e.data.reason.trim() : null;
    this.endEngine();
    this.set({ auth: 'banned', ban: { kind: e.data.banKind === 'ip' ? 'ip' : 'player', reason }, engine: null, busy: null, screen: { id: 'menu' } });
    return true;
  }

  /** Entra com um nick (novo) ou com nick + código de acesso (outro dispositivo). */
  async enter(nick: string, code?: string): Promise<void> {
    let r: PlayerResponse;
    try {
      r = await api.enter(nick, code);
    } catch (e) {
      if (this.checkBanned(e)) return;
      throw e;
    }
    this.applyPlayer(r);
    if (r.code) this.set({ accessCode: r.code });
  }

  async logout(): Promise<void> {
    await this.abandonMatch();
    await api.logout().catch(() => undefined);
    const p = defaultProfile();
    this.set({ auth: 'anon', nick: null, profile: p, loadoutIds: p.loadout, accessCode: null, screen: { id: 'menu' }, report: null, summary: null });
  }

  async rotateCode(): Promise<void> {
    const r = await api.rotateCode();
    this.applyPlayer(r);
    if (r.code) this.set({ accessCode: r.code });
  }

  dismissCode(): void {
    this.set({ accessCode: null });
  }

  private applyPlayer(r: PlayerResponse, achievements: string[] = []): void {
    configureSound(r.profile.settings.sound, r.profile.settings.volume);
    this.set({ auth: 'ready', nick: r.nick, profile: r.profile, loadoutIds: this.snap.engine ? this.snap.loadoutIds : r.profile.loadout, saveFailed: false, netError: null });
    for (const id of achievements) {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) this.toast(`Conquista: ${a.name} (+${a.ec} EC)`, 'unlock');
    }
  }

  /** Executa uma ação no servidor; em caso de falha avisa e mantém o perfil do servidor. */
  private async act<T extends PlayerResponse>(fn: () => Promise<T>, achievements?: (r: T) => string[]): Promise<T | null> {
    try {
      const r = await fn();
      this.applyPlayer(r, achievements?.(r));
      return r;
    } catch (e) {
      this.onNetError(e);
      return null;
    }
  }

  private onNetError(e: unknown): void {
    if (this.checkBanned(e)) return;
    const msg = e instanceof Error ? e.message : 'Falha na comunicação com o servidor.';
    if (e instanceof ApiError && e.status === 401) this.set({ auth: 'anon', nick: null });
    this.set({ saveFailed: true, netError: msg });
    this.toast(msg, 'warn');
  }

  /* ---------- perfil (sempre via servidor) ---------- */

  updateSettings(patch: Partial<Profile['settings']>): void {
    // aplica na hora (som/visual) e confirma no servidor
    const profile = { ...this.snap.profile, settings: { ...this.snap.profile.settings, ...patch } };
    configureSound(profile.settings.sound, profile.settings.volume);
    this.set({ profile });
    void this.act(() => api.settings(patch));
  }

  async evolveUnit(id: UnitId): Promise<boolean> {
    const r = await this.act(() => api.evolve(id), (x) => x.achievements);
    if (!r) return false;
    this.toast(`${UNITS[id].name} evoluiu: ${UNITS[id].tiers[r.profile.tiers[id] ?? 0].name}`, 'unlock');
    playSfx('upgrade');
    return true;
  }

  chooseTrait(id: UnitId, trait: TraitId | null): void {
    void this.act(() => api.trait(id, trait));
  }

  setLoadout(ids: UnitId[]): void {
    void this.act(() => api.loadout(ids));
  }

  resetProgress(): void {
    this.endEngine();
    void this.act(() => api.reset()).then((r) => {
      if (r) this.set({ loadoutIds: r.profile.loadout, report: null, summary: null, screen: { id: 'menu' } });
    });
  }

  /* ---------- partida ---------- */

  stageFor(id: string): StageDef | null {
    if (isEndless(id)) return endlessStage(id.slice(2) as MapId);
    return STAGE_BY_ID[id] ?? null;
  }

  async startMatch(stageId: string, ids: UnitId[], difficulty: Difficulty = 'normal'): Promise<void> {
    const stage = this.stageFor(stageId);
    if (!stage || this.snap.busy) return;
    await this.abandonMatch();
    this.set({ busy: 'start' });
    let start;
    try {
      // o servidor confere fase/dificuldade/unidades liberadas e sorteia a semente
      start = await api.startMatch(stageId, ids, difficulty);
    } catch (e) {
      this.set({ busy: null });
      this.onNetError(e);
      return;
    } finally {
      this.set({ busy: null });
    }
    const engine = new GameEngine(buildConfig(stage, start.entries, start.showDamage, start.difficulty ?? 'normal', matchRng(start.seed)));
    engine.autoStart = start.autoStart;
    const log = attachRecorder(engine);
    const active: ActiveMatch = { engine, matchId: start.matchId, log, sent: false };
    this.#active = active;
    engine.onEvent = (e) => {
      if (e.type === 'sfx') playSfx(e.id);
      else if (e.type === 'toast') this.toast(e.text, e.tone);
      else if (e.type === 'end') window.setTimeout(() => void this.finishMatch(active), 1100);
      else if (e.type === 'capsule') this.onCapsule(engine, e.roll);
    };
    registerTickable(engine);
    this.set({
      engine,
      stage,
      loadoutIds: start.entries.map((x) => x.id),
      difficulty: start.difficulty ?? 'normal',
      report: null,
      summary: null,
      capsule: null,
      screen: { id: 'match' },
    });
  }

  restartMatch(): void {
    const { stage, loadoutIds, difficulty } = this.snap;
    if (stage) void this.startMatch(stage.id, loadoutIds, difficulty);
  }

  /** Cápsula do modo infinito: mostra a abertura; o servidor credita ao encerrar a partida. */
  private onCapsule(engine: GameEngine, roll: CapsuleRoll): void {
    if (this.snap.engine !== engine) return;
    if (!roll.got) {
      this.toast(`Onda ${roll.milestone}: nenhuma cápsula desta vez (50% de chance).`, 'info');
      return;
    }
    const owned = this.snap.profile.units.includes('supercondutor');
    const c = roll.content;
    const newSecret = c?.kind === 'secret' && !owned;
    const ec = c?.kind === 'secret' ? (owned ? SECRET_DUPLICATE_EC : 0) : (c?.amount ?? 0);
    const wasPaused = engine.paused;
    engine.setPaused(true);
    this.set({ capsule: { roll, ec, newSecret, wasPaused } });
  }

  closeCapsule(): void {
    const c = this.snap.capsule;
    if (!c) return;
    this.set({ capsule: null });
    if (this.snap.engine && !c.wasPaused && this.snap.screen.id === 'match') this.snap.engine.setPaused(false);
  }

  /** Abandona a partida atual. Cápsulas já obtidas são confirmadas pelo servidor. */
  async abandonMatch(): Promise<void> {
    const a = this.#active;
    this.endEngine();
    if (this.snap.engine) this.set({ engine: null, screen: { id: isEndless(this.snap.stage?.id ?? '') ? 'modes' : 'campaign' } });
    if (!a || a.sent) return;
    a.sent = true;
    if (!a.engine.stats.capsules.some((c) => c.got)) {
      void api.finishMatch({ matchId: a.matchId, log: a.log, steps: a.engine.steps }, true).catch(() => undefined);
      return;
    }
    const r = await this.act(() => api.finishMatch({ matchId: a.matchId, log: a.log, steps: a.engine.steps }, true));
    if (r?.capsules.length) this.toast(`Cápsulas confirmadas pelo servidor: +${r.capsules.reduce((n, c) => n + c.ec, 0)} EC`, 'ok');
  }

  private endEngine() {
    const e = this.snap.engine;
    if (e) {
      e.onEvent = null;
      unregisterTickable(e);
    }
    this.#active = null;
  }

  private async finishMatch(a: ActiveMatch): Promise<void> {
    if (this.#active !== a || a.sent || !this.snap.stage) return;
    a.sent = true;
    const engine = a.engine;
    unregisterTickable(engine);
    const won = engine.phase === 'won';
    const waves = won ? engine.totalWaves : Math.max(0, engine.wave);
    this.set({ busy: 'verify' });
    try {
      const r = await api.finishMatch({ matchId: a.matchId, log: a.log, steps: engine.steps, claimed: { won, waves, kills: engine.stats.kills } });
      this.applyPlayer(r, r.report?.achievements);
      this.set({ summary: r.summary, report: r.report, capsule: null, screen: { id: 'result' } });
      if (r.mismatch) this.toast('O resultado registrado é o calculado pelo servidor.', 'warn');
    } catch (e) {
      this.onNetError(e);
      this.endEngine();
      this.set({ engine: null, capsule: null, screen: { id: 'campaign' } });
    } finally {
      this.set({ busy: null });
    }
  }

  /** Responde ao desafio pós-fase (índice da alternativa original). Retorna a EC ganha. */
  async submitQuiz(choice: number): Promise<number> {
    const stageId = this.snap.summary?.stageId;
    if (!stageId) return 0;
    const r = await this.act(() => api.quiz(stageId, choice), (x) => x.achievements);
    return r?.ec ?? 0;
  }

  /* ---------- avisos ---------- */

  toast(text: string, tone: Toast['tone']): void {
    const t: Toast = { id: toastSeq++, text, tone };
    this.set({ toasts: [...this.snap.toasts.slice(-3), t] });
    window.setTimeout(() => this.set({ toasts: this.snap.toasts.filter((x) => x.id !== t.id) }), tone === 'unlock' ? 5200 : 3600);
  }
}

export const session = new GameSession();

// Apenas em desenvolvimento: acesso pelo console para inspeção e testes manuais
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __emlabDefense: GameSession }).__emlabDefense = session;

export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.getSnapshot);
}

/** Assina a engine da partida (re-renderiza em ~10 Hz e após comandos). */
export function useEngineVersion(engine: GameEngine): number {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot);
}
