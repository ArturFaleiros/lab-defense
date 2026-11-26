import { buildWaves, DIFFICULTIES, modifiersFor } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { MAPS } from '../data/maps';
import type { SpawnGroup, StageDef, WaveDef } from '../data/stages';
import type { Difficulty, EnemyId, LoadoutEntry, MapId } from '../types';
import { rng } from './geometry';
import type { MatchConfig } from './GameEngine';

/** Prefixo dos ids de partidas do modo infinito: "E-placa", "E-nucleo"… */
export const ENDLESS_PREFIX = 'E-';

const POOL: { id: EnemyId; from: number; weight: number }[] = [
  { id: 'curto', from: 1, weight: 3 },
  { id: 'surto', from: 2, weight: 2 },
  { id: 'sobrecarga', from: 4, weight: 2 },
  { id: 'ruido', from: 6, weight: 1.5 },
  { id: 'instabilidade', from: 8, weight: 1.5 },
  { id: 'interferencia', from: 11, weight: 1.2 },
  { id: 'isolamento', from: 13, weight: 1.2 },
  // 1.1
  { id: 'franco', from: 9, weight: 1 },
  { id: 'fuga', from: 10, weight: 1 },
  { id: 'emi', from: 12, weight: 0.9 },
  { id: 'transiente', from: 14, weight: 1.1 },
  { id: 'aberto', from: 16, weight: 0.9 },
  { id: 'sobretensao', from: 18, weight: 0.8 },
  { id: 'saturado', from: 22, weight: 0.6 },
  // 1.2 — cada um exige um contrajogo diferente, e eles entram ao longo das três fases
  { id: 'ambulante', from: 7, weight: 1.3 },
  { id: 'dieletrico', from: 15, weight: 0.9 },
  { id: 'supercap', from: 17, weight: 0.85 },
  { id: 'reverso', from: 20, weight: 0.8 },
  { id: 'voltaico', from: 24, weight: 0.8 },
  { id: 'parasita', from: 27, weight: 0.7 },
  { id: 'faraday', from: 30, weight: 0.65 },
  { id: 'saturacaoprofunda', from: 34, weight: 0.5 },
];
const BOSS_CYCLE: EnemyId[] = ['arco', 'saturacao', 'cascata', 'ressonancia', 'colapso', 'apagao', 'singularidade'];

/* ====================================================================== */
/* §14 — Escalonamento de vida do modo infinito                            */
/* ====================================================================== */

/** Fase do escalonamento (usada nos indicadores da interface). */
export type EndlessPhase = 'inicial' | 'intermediaria' | 'avancada';

export interface EndlessScaling {
  /** multiplicador de vida dos inimigos comuns */
  mul: number;
  /** multiplicador de vida dos chefes (crescimento amortecido) */
  bossMul: number;
  /** multiplicador de vida das elites */
  eliteMul: number;
  phase: EndlessPhase;
  /** crescimento percentual em relação à onda anterior */
  growth: number;
}

/** Limites de cada fase (ondas). */
export const ENDLESS_PHASE_1 = 10;
export const ENDLESS_PHASE_2 = 25;
/** Teto numérico do multiplicador: mantém a curva estável e sem overflow. */
const ENDLESS_MUL_CAP = 1e12;

/**
 * Multiplicador de vida da onda `n` (n começa em 1), em três fases:
 *
 *   Inicial       n ≤ 10    1 + 0,10·(n−1)                      → 1,00 … 1,90
 *                           crescimento linear suave: dá tempo de montar a economia.
 *   Intermediária 11 ≤ n ≤ 25   M(10) · 1,085^(n−10)            → ~2,06 … ~6,45
 *                           crescimento geométrico: exige melhorias e sinergias.
 *   Avançada      n > 25    M(25) · 1,15^(n−25) · (1 + (n−25)/60)
 *                           geométrico mais forte, com um reforço linear que impede
 *                           qualquer composição estática de bastar indefinidamente.
 *
 * É a mesma função no cliente e no servidor (determinística, sem estado) e o resultado é
 * limitado a 1e12 para não haver overflow nem perda de precisão em partidas muito longas.
 */
export function endlessHpMul(n: number): number {
  const w = Math.max(1, Math.floor(n));
  let mul: number;
  if (w <= ENDLESS_PHASE_1) {
    mul = 1 + 0.1 * (w - 1);
  } else {
    const m1 = 1 + 0.1 * (ENDLESS_PHASE_1 - 1);
    if (w <= ENDLESS_PHASE_2) {
      mul = m1 * Math.pow(1.085, w - ENDLESS_PHASE_1);
    } else {
      const m2 = m1 * Math.pow(1.085, ENDLESS_PHASE_2 - ENDLESS_PHASE_1);
      const k = w - ENDLESS_PHASE_2;
      mul = m2 * Math.pow(1.15, k) * (1 + k / 60);
    }
  }
  return Math.min(ENDLESS_MUL_CAP, mul);
}

/** Escalonamento completo da onda, por categoria de inimigo (para a engine e a interface). */
export function endlessScaling(n: number): EndlessScaling {
  const mul = endlessHpMul(n);
  const prev = endlessHpMul(Math.max(1, n - 1));
  return {
    mul,
    // chefes e elites crescem amortecidos: sem isso, um chefe na onda 40 seria impossível
    bossMul: Math.min(ENDLESS_MUL_CAP, Math.pow(mul, 0.82)),
    eliteMul: Math.min(ENDLESS_MUL_CAP, Math.pow(mul, 0.92)),
    phase: n <= ENDLESS_PHASE_1 ? 'inicial' : n <= ENDLESS_PHASE_2 ? 'intermediaria' : 'avancada',
    growth: prev > 0 ? mul / prev - 1 : 0,
  };
}

/** Ondas procedurais e determinísticas do modo infinito (n começa em 1). */
export function endlessWave(n: number): WaveDef {
  const rand = rng(n * 7919 + 17);
  const scale = endlessScaling(n);
  const available = POOL.filter((p) => n >= p.from);
  const kinds = Math.min(available.length, 1 + Math.floor(n / 5) + (rand() < 0.5 ? 1 : 0));
  const groups: SpawnGroup[] = [];
  const chosen = new Set<EnemyId>();
  while (chosen.size < kinds) {
    const total = available.reduce((s, p) => s + p.weight, 0);
    let r = rand() * total;
    for (const p of available) {
      r -= p.weight;
      if (r <= 0) {
        chosen.add(p.id);
        break;
      }
    }
  }
  // orçamento em "vida-base": define QUANTOS inimigos vêm (a vida de cada um vem de `scale`)
  const budget = 300 + n * 140;
  let at = 0;
  for (const id of chosen) {
    const def = ENEMIES[id];
    const count = Math.max(2, Math.min(60, Math.round(budget / chosen.size / def.hp)));
    const gap = Math.max(0.25, Math.min(1.4, 18 / count));
    // §14: cada categoria tem seu multiplicador (comum, elite, chefe)
    const hp = def.boss ? scale.bossMul : def.behavior.elite ? scale.eliteMul : scale.mul;
    groups.push({ enemy: id, count, gap, at, path: null, hp });
    at += 2 + rand() * 3;
  }
  if (n % 10 === 0) {
    const boss = BOSS_CYCLE[(n / 10 - 1) % BOSS_CYCLE.length];
    groups.push({ enemy: boss, count: 1, gap: 1, at: 2, path: null, hp: scale.bossMul });
  }
  return { groups };
}

export function endlessStage(map: MapId): StageDef {
  return {
    id: `${ENDLESS_PREFIX}${map}`,
    mode: 'challenge',
    chapter: 0,
    name: `Modo infinito — ${MAPS[map].name}`,
    concept: 'Ondas progressivamente mais difíceis',
    briefing: 'Sobreviva ao maior número de ondas possível. Um chefe surge a cada 10 ondas.',
    map,
    startCredits: 700,
    lives: 20,
    hpScale: 1,
    waves: [],
    objectives: [{ kind: 'noSell' }, { kind: 'noSell' }],
    reward: { ec: 0, xp: 0 },
    tips: [],
  };
}

export function isEndless(stageId: string): boolean {
  return stageId.startsWith(ENDLESS_PREFIX);
}

/**
 * Configuração da partida. Fases usam a dificuldade escolhida (ondas geradas, vida e
 * velocidade dos inimigos, modificadores); o modo infinito tem ondas próprias e cápsulas.
 */
export function buildConfig(
  stage: StageDef,
  loadout: LoadoutEntry[],
  showDamage: boolean,
  difficulty: Difficulty = 'normal',
  rand?: () => number,
): MatchConfig {
  if (isEndless(stage.id)) {
    return {
      stage,
      loadout,
      waveCount: Infinity,
      getWave: (i) => endlessWave(i + 1),
      waveBonus: (n) => 40 + 8 * n,
      showDamage,
      difficulty: null,
      capsules: true,
      rand,
    };
  }
  const d = DIFFICULTIES[difficulty];
  const generated = buildWaves(stage, difficulty);
  return {
    stage,
    loadout,
    waveCount: generated.length,
    getWave: (i) => generated[i],
    showDamage,
    difficulty,
    enemyHp: d.hp,
    enemySpeed: d.speed,
    rampStart: d.rampStart,
    // §12: só o Impossível acumula resistência a controle e redução de dano por onda
    progressiveResist: difficulty === 'impossivel',
    modifiers: modifiersFor(stage, difficulty),
    blocked: stage.blocked ?? [],
    rand,
  };
}
