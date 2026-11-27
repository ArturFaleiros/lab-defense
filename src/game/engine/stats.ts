import { UNITS, type UnitDef, type UnitLevel, type UnitStats } from '../data/units';
import type { LoadoutEntry } from '../types';

const round5 = (v: number) => Math.max(5, Math.round(v / 5) * 5);

const costMul = (entry: LoadoutEntry) => (entry.trait === 'eficiencia' ? 0.88 : 1);

/** Desconto acumulado das evoluções nas melhorias em partida (ex.: Fonte Chaveada Síncrona −15%). */
function upgradeDiscount(entry: LoadoutEntry): number {
  const def = UNITS[entry.id];
  let d = 0;
  for (let t = 1; t <= entry.tier; t++) d += def.tiers[t].upgradeDiscount ?? 0;
  return d;
}

export function placeCost(entry: LoadoutEntry): number {
  return round5(UNITS[entry.id].cost * costMul(entry));
}

/** Níveis de melhoria disponíveis: os normais + os exclusivos das evoluções já obtidas. */
export function levelsFor(entry: LoadoutEntry): UnitLevel[] {
  const def = UNITS[entry.id];
  const out = [...def.levels];
  for (let t = 1; t <= entry.tier; t++) out.push(...(def.tiers[t].extraLevels ?? []));
  return out;
}

/** Custo para ir do nível `level` para `level + 1` (null se já está no máximo). */
export function upgradeCost(entry: LoadoutEntry, level: number): number | null {
  const lv = levelsFor(entry)[level];
  return lv ? round5(lv.cost * costMul(entry) * (1 - upgradeDiscount(entry))) : null;
}

export function maxLevel(entry: LoadoutEntry): number {
  return levelsFor(entry).length;
}

/** O próximo nível exige escolher um ramo? */
export function needsBranch(def: UnitDef, level: number): boolean {
  return !!def.branches && def.branchAt === level + 1;
}

const INTERVAL_BEHAVIORS = new Set(['bolt', 'pulse', 'income', 'amplifier', 'heat', 'chain', 'wave', 'timer']);
const TAU_BEHAVIORS = new Set(['beam', 'capacitor', 'super']);

/**
 * Atributos efetivos de uma unidade (sem bônus de aura, que mudam a cada passo):
 * base → níveis (com ramo) → evolução permanente → característica.
 * Os níveis exclusivos de uma evolução são aplicados antes dos multiplicadores das evoluções.
 */
export function computeStats(entry: LoadoutEntry, level: number, branch: number): UnitStats {
  const def = UNITS[entry.id];
  const s: UnitStats = { ...def.base };
  const levels = levelsFor(entry);
  for (let i = 0; i < level && i < levels.length; i++) {
    Object.assign(s, levels[i].patch);
    if (def.branches && def.branchAt === i + 1 && branch >= 0) Object.assign(s, def.branches[branch].patch);
  }
  for (let t = 1; t <= entry.tier; t++) def.tiers[t].apply(s);

  if (entry.trait === 'resposta') {
    if (INTERVAL_BEHAVIORS.has(def.behavior)) s.interval *= 0.88;
    if (TAU_BEHAVIORS.has(def.behavior)) s.tau *= 0.88;
  }
  // Circuito RL: τ = L/R é derivado (nunca definido diretamente)
  if (def.behavior === 'zone') s.tau = s.inductance / s.resistance;
  return s;
}

/** Dano por segundo em regime permanente do circuito RL: I = V/R (escala do jogo). */
export function rlSteadyDps(s: UnitStats): number {
  return s.damage / s.resistance;
}

/** Tempo de recarga de uma carga do capacitor: energia (∝ v²) a 81% → t = τ·ln(10). */
export function capacitorCycle(s: UnitStats): number {
  return s.tau * Math.log(10);
}

/** Estimativa de dano por segundo para comparação na interface (alvo único, sem bônus). */
export function dpsEstimate(entry: LoadoutEntry, s: UnitStats): number {
  const def = UNITS[entry.id];
  switch (def.behavior) {
    case 'bolt':
    case 'pulse':
      return s.interval > 0 ? (s.damage * s.targets) / s.interval : 0;
    case 'beam':
      return s.damage;
    case 'zone':
      return rlSteadyDps(s);
    case 'capacitor':
      return (s.damage * (1 + s.salvo * s.salvoMul)) / capacitorCycle(s);
    case 'amplifier':
      // no regime saturado (inclui o bônus de saturação do patch 1.2)
      return s.interval > 0 ? (s.damage * (1 + s.gain * s.gainStep) * (1 + s.satBonus) * (s.targets + 1)) / s.interval : 0;
    case 'heat':
      return (s.interval > 0 ? s.damage / s.interval : 0) + s.heatCoef * s.heatMax * s.heatMax;
    case 'chain':
      return s.interval > 0 ? s.damage / s.interval : 0;
    case 'wave':
      return s.interval > 0 ? (s.damage * 1.5) / (2 * s.interval) : 0;
    case 'super':
      return s.damage;
    case 'timer':
      return s.interval > 0 ? s.damage / s.interval : 0;
    default:
      return 0;
  }
}
