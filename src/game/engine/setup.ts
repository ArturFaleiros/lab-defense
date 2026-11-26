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
];
const BOSS_CYCLE: EnemyId[] = ['arco', 'saturacao', 'cascata', 'ressonancia', 'colapso', 'apagao'];

/** Ondas procedurais e determinísticas do modo infinito (n começa em 1). */
export function endlessWave(n: number): WaveDef {
  const rand = rng(n * 7919 + 17);
  const hp = 1 + 0.07 * n + 0.002 * n * n;
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
  // orçamento em "vida-base": cresce com a onda
  const budget = 300 + n * 140;
  let at = 0;
  for (const id of chosen) {
    const def = ENEMIES[id];
    const count = Math.max(2, Math.round(budget / chosen.size / def.hp));
    const gap = Math.max(0.25, Math.min(1.4, 18 / count));
    groups.push({ enemy: id, count, gap, at, path: null, hp });
    at += 2 + rand() * 3;
  }
  if (n % 10 === 0) {
    const boss = BOSS_CYCLE[(n / 10 - 1) % BOSS_CYCLE.length];
    groups.push({ enemy: boss, count: 1, gap: 1, at: 2, path: null, hp: 0.7 + n * 0.03 });
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
    modifiers: modifiersFor(stage, difficulty),
    blocked: stage.blocked ?? [],
    rand,
  };
}
