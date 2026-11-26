/**
 * Registro e reprodução determinística de partidas (anti-trapaça).
 *
 * A simulação avança em passos fixos de 1/60 s e só muda por comandos do jogador
 * (posicionar, melhorar, vender...). O navegador registra cada comando com o número do
 * passo em que aconteceu; o servidor recria a partida com a MESMA semente e os MESMOS
 * comandos e calcula o resultado sozinho. Valores alterados pelo console (créditos,
 * vidas, dano...) não aparecem no replay — portanto não geram recompensa.
 */
import { UNITS } from '../data/units';
import type { TargetPriority, UnitId } from '../types';
import { GameEngine, STEP, type MatchConfig } from './GameEngine';

export const COMMANDS = ['place', 'upgrade', 'sell', 'setPriority', 'useAbility', 'startWave', 'setAutoStart', 'forfeit'] as const;
export type CommandName = (typeof COMMANDS)[number];

/** [passo, índice do comando em COMMANDS, ...argumentos] — formato compacto */
export type LogEntry = [number, number, ...unknown[]];

/** Limites usados pelo servidor e pelo cliente (o cliente encerra antes de estourar). */
export const MAX_LOG_ENTRIES = 40_000;
/** 3 horas de simulação */
export const MAX_SIM_STEPS = 60 * 60 * 60 * 3;

const PRIORITIES: TargetPriority[] = ['primeiro', 'ultimo', 'resistente', 'objetivo'];

/** Gerador da partida (mesmo algoritmo no cliente e no servidor). */
export function matchRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Passa a registrar os comandos de uma engine (no navegador). Retorna o log, que cresce
 * conforme o jogador age. Os métodos originais continuam sendo chamados normalmente.
 */
export function attachRecorder(engine: GameEngine): LogEntry[] {
  const log: LogEntry[] = [];
  COMMANDS.forEach((name, idx) => {
    const original = (engine[name] as (...a: unknown[]) => unknown).bind(engine);
    Object.defineProperty(engine, name, {
      configurable: false,
      writable: false,
      value: (...args: unknown[]) => {
        if (log.length < MAX_LOG_ENTRIES) log.push([engine.steps, idx, ...JSON.parse(JSON.stringify(args.filter((a) => a !== undefined)))]);
        return original(...args);
      },
    });
  });
  return log;
}

/* ---------------- Validação (servidor) ---------------- */

const isInt = (v: unknown, lo = 0, hi = 1e9): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isNum = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Confere formato, tipos e ordem do log. Retorna mensagem de erro ou null. */
export function validateLog(raw: unknown): string | null {
  if (!Array.isArray(raw)) return 'log inválido';
  if (raw.length > MAX_LOG_ENTRIES) return 'log grande demais';
  let last = 0;
  for (const e of raw) {
    if (!Array.isArray(e) || e.length < 2 || e.length > 5) return 'entrada inválida';
    const [s, c, a, b] = e as unknown[];
    if (!isInt(s, 0, MAX_SIM_STEPS) || s < last) return 'ordem de passos inválida';
    last = s;
    if (!isInt(c, 0, COMMANDS.length - 1)) return 'comando desconhecido';
    const args = e.length - 2;
    switch (COMMANDS[c]) {
      case 'place':
        if (args !== 3 || typeof a !== 'string' || !(a in UNITS) || !isNum(b, -100, 5000) || !isNum(e[4], -100, 5000)) return 'place inválido';
        break;
      case 'upgrade':
        if ((args !== 1 && args !== 2) || !isInt(a, 1) || (args === 2 && !isInt(b, 0, 3))) return 'upgrade inválido';
        break;
      case 'sell':
      case 'useAbility':
        if (args !== 1 || !isInt(a, 1)) return 'comando de unidade inválido';
        break;
      case 'setPriority':
        if (args !== 2 || !isInt(a, 1) || !PRIORITIES.includes(b as TargetPriority)) return 'prioridade inválida';
        break;
      case 'setAutoStart':
        if (args !== 1 || typeof a !== 'boolean') return 'autoStart inválido';
        break;
      case 'startWave':
      case 'forfeit':
        if (args !== 0) return 'argumentos inesperados';
        break;
    }
  }
  return null;
}

export interface ReplayResult {
  engine: GameEngine;
  steps: number;
}

/**
 * Reproduz a partida até terminar ou até `stopAt` passos (abandono). Os comandos do passo
 * k são aplicados antes do (k+1)-ésimo update, exatamente como aconteceu no navegador.
 */
export function replayMatch(config: MatchConfig, autoStart: boolean, log: LogEntry[], stopAt: number): ReplayResult {
  const engine = new GameEngine(config);
  engine.autoStart = autoStart;
  const limit = Math.min(stopAt, MAX_SIM_STEPS);
  let i = 0;
  const applyDue = () => {
    while (i < log.length && log[i][0] === engine.steps) {
      const [, c, ...args] = log[i++];
      (engine[COMMANDS[c]] as (...a: unknown[]) => unknown).apply(engine, args);
    }
  };
  while (!engine.isOver && engine.steps < limit) {
    applyDue();
    if (engine.isOver) break;
    engine.update(STEP);
  }
  if (!engine.isOver) applyDue();
  return { engine, steps: engine.steps };
}

export type { UnitId };
