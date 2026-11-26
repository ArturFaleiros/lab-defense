import { MAP_H, MAP_W } from '../data/maps';
import { UNITS } from '../data/units';
import type { StageDef } from '../data/stages';
import type { Difficulty, UnitId } from '../types';
import { GameEngine } from './GameEngine';
import { buildConfig } from './setup';
import { needsBranch, placeCost, upgradeCost } from './stats';

/**
 * Jogador automático simples, usado nos testes de balanceamento.
 * Escolhe posições pela cobertura do caminho dentro do alcance e alterna entre
 * posicionar unidades (seguindo uma ordem de construção) e melhorar as existentes.
 */
export interface BotOptions {
  order: UnitId[];
  /** fração dos créditos usada em melhorias quando a ordem de construção já foi cumprida */
  upgrades: boolean;
  maxUnits: number;
  /** usa habilidades ativas assim que ficam prontas (jogador especialista) */
  abilities?: boolean;
}

export function bestSpot(eng: GameEngine, id: UnitId): { x: number; y: number } | null {
  const def = UNITS[id];
  const r = def.behavior === 'aura' || def.behavior === 'income' || def.behavior === 'rectifier' || def.behavior === 'timer' ? 0 : def.base.range;
  let best: { x: number; y: number; score: number } | null = null;
  for (let x = 30; x < MAP_W - 20; x += 22) {
    for (let y = 30; y < MAP_H - 20; y += 22) {
      if (!eng.canPlace(id, x, y).ok) continue;
      let score: number;
      if (r > 0) {
        score = eng.paths.reduce((s, p) => s + p.coverage(x, y, r, 12), 0);
      } else {
        // suporte/economia: perto das unidades já posicionadas
        score = eng.units.reduce((s, u) => s + Math.max(0, 140 - Math.hypot(u.x - x, u.y - y)), 0) + 1;
        if (def.behavior === 'income') score = -eng.paths.reduce((s, p) => s + p.coverage(x, y, 90, 16), 0) + 1000;
      }
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  return best;
}

export function botStep(eng: GameEngine, opts: BotOptions, state: { next: number }): void {
  if (eng.isOver) return;
  // posicionar
  while (state.next < opts.order.length && eng.units.length < opts.maxUnits) {
    const id = opts.order[state.next];
    const entry = eng.entryFor(id);
    if (!entry || eng.countOf(id) >= UNITS[id].limit) {
      state.next++;
      continue;
    }
    if (eng.credits < placeCost(entry)) break;
    const spot = bestSpot(eng, id);
    if (!spot) {
      state.next++;
      continue;
    }
    eng.place(id, spot.x, spot.y);
    state.next++;
  }
  if (opts.abilities) for (const u of eng.units) if (eng.abilityReady(u)) eng.useAbility(u.uid);
  if (!opts.upgrades) return;
  // melhorar a unidade de melhoria mais barata
  let cheapest: { uid: number; cost: number; branch: boolean } | null = null;
  for (const u of eng.units) {
    const c = upgradeCost(u.entry, u.level);
    if (c !== null && (!cheapest || c < cheapest.cost)) cheapest = { uid: u.uid, cost: c, branch: needsBranch(u.def, u.level) };
  }
  const reserve = state.next < opts.order.length ? placeCost(eng.entryFor(opts.order[state.next]) ?? { id: 'rele', tier: 0, trait: null }) : 0;
  if (cheapest && eng.credits - cheapest.cost >= reserve * 0.5) eng.upgrade(cheapest.uid, cheapest.branch ? 0 : undefined);
}

/** Roda uma partida inteira com o bot. Retorna o motor no estado final. */
export function runBot(eng: GameEngine, opts: BotOptions, maxTime = 3000): GameEngine {
  const state = { next: 0 };
  let t = 0;
  while (!eng.isOver && t < maxTime) {
    botStep(eng, opts, state);
    if (eng.phase === 'prep') eng.startWave();
    for (let i = 0; i < 30 && !eng.isOver; i++) eng.update(1 / 60);
    t += 0.5;
  }
  return eng;
}

/* ---------------- Jogador especialista (Patch 1.1) ---------------- */

/** Composições específicas usadas para provar que o Impossível é vencível. */
export const EXPERT_PRESETS: { name: string; order: UnitId[] }[] = [
  { name: 'magnetica', order: ['bobina', 'indutor', 'bobina', 'diodo', 'fonte', 'tesla', 'indutor', 'bobina', 'fonte', 'indutor', 'bobina', 'indutor'] },
  { name: 'descarga', order: ['bobina', 'capacitor', 'indutor', 'fonte', 'capacitor', 'tesla', 'transformador', 'indutor', 'capacitor', 'bobina'] },
  { name: 'temporizada', order: ['bobina', 'indutor', 'fonte', 'capacitor', 'ci555', 'indutor', 'tesla', 'fonte', 'capacitor', 'indutor', 'capacitor', 'indutor'] },
  { name: 'supercondutora', order: ['bobina', 'resistor', 'fonte', 'bobina', 'fonte', 'supercondutor', 'diodo', 'resistor', 'bobina', 'resistor', 'diodo', 'bobina'] },
  { name: 'magnetica-rl', order: ['bobina', 'rl', 'indutor', 'rele', 'bobina', 'indutor', 'rl', 'bobina', 'indutor', 'rele', 'rl', 'bobina', 'indutor'] },
];

/** Partida com todas as unidades na evolução máxima, usando habilidades. */
export function runExpert(stage: StageDef, preset: { order: UnitId[] }, difficulty: Difficulty): GameEngine {
  const ids = [...new Set(preset.order)].filter((u) => !stage.allowed || stage.allowed.includes(u)).slice(0, 5);
  const eng = new GameEngine(buildConfig(stage, ids.map((id) => ({ id, tier: 2, trait: null })), false, difficulty));
  // depois da ordem inicial, continua repetindo-a (respeitando limites) com o dinheiro que sobrar
  const base = preset.order.filter((u) => ids.includes(u));
  return runBot(eng, { order: [...base, ...base, ...base], upgrades: true, maxUnits: 28, abilities: true }, 6000);
}
