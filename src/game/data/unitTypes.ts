import type { DamageType, Rarity, UnitClass, UnitId } from '../types';

/**
 * Tipos e utilitários das definições de unidades (separados para que `units.ts` e
 * `unitsExpansion.ts` compartilhem o mesmo formato sem dependência circular).
 */

export type Behavior =
  | 'bolt'
  | 'beam'
  | 'pulse'
  | 'capacitor'
  | 'zone'
  | 'aura'
  | 'income'
  // Patch 1.1
  | 'amplifier'
  | 'heat'
  | 'wave'
  | 'rectifier'
  | 'timer'
  | 'chain'
  | 'super'
  // Patch 1.2
  /** MOSFET: cadência que sobe com a frequência de comutação e aquece */
  | 'switching'
  /** IGBT: disparos concentrados, com bônus contra blindagem */
  | 'hv'
  /** Transformador de potência: aura que cresce com as unidades conectadas */
  | 'grid'
  /** Oscilador de cristal: clock estável que sincroniza e interfere na velocidade */
  | 'crystal'
  /** Amp. operacional: ganho por estágios em vários alvos, com saturação (clipping) */
  | 'opamp'
  /** Plasma de alta frequência: descargas encadeadas com ionização e dano contínuo */
  | 'plasma';

export interface UnitStats {
  damage: number;
  /** intervalo entre ataques (s); no feixe/zona é o passo de aplicação do dano; no temporizador, o período T */
  interval: number;
  range: number;
  splash: number;
  stun: number;
  slow: number;
  slowDur: number;
  targets: number;
  /** constante de tempo (s): rampa do indutor, carga do capacitor */
  tau: number;
  /** pico liberado pelo indutor ao interromper a corrente (multiplica (I/Imax)²) */
  burst: number;
  aura: number;
  auraSpeed: number;
  auraDamage: number;
  auraRange: number;
  income: number;
  /** circuito RL: resistência e indutância (escala do jogo) */
  resistance: number;
  inductance: number;
  knockback: number;
  charges: number;
  ability: boolean;
  protect: boolean;
  /* ---------- Patch 1.1 ---------- */
  /** transistor: número máximo de estágios de ganho (saturação) */
  gain: number;
  /** transistor: bônus de dano por estágio de ganho */
  gainStep: number;
  /** resistor: aquecimento aplicado por golpe (estágios) */
  heat: number;
  /** resistor: aquecimento máximo que esta unidade consegue impor */
  heatMax: number;
  /** resistor: dano/s por estágio² (P = I²·R) */
  heatCoef: number;
  /** bobina de Tesla: saltos do arco e fração mantida a cada salto */
  chains: number;
  chainDecay: number;
  /** banco de capacitores: descargas consecutivas extras e sua fração de dano */
  salvo: number;
  salvoMul: number;
  /** fonte: créditos extras pagos ao concluir cada onda (energia de reserva) */
  waveIncome: number;
  /** retificador: créditos por 100 de dano causado pelas unidades no raio */
  conversion: number;
  /** temporizador 555: ciclo de trabalho (fração do período em nível alto) */
  duty: number;
  /** supercondutor: raio e intensidade do efeito Meissner */
  meissner: number;
  meissnerSlow: number;
  /** oscilador: anéis consecutivos necessários para a ressonância */
  resonance: number;
  /** oscilador VCO: redução do período por inimigo no alcance */
  vco: number;
  /* ---------- Patch 1.2 ---------- */
  /** transistor/amp. operacional: dano extra enquanto saturado (0,4 = +40%) */
  satBonus: number;
  /** capacitor: multiplicador do intervalo entre descargas (1 = padrão; 0,9 = 10% mais rápido) */
  recoverMul: number;
  /** MOSFET: estágios de frequência de comutação e ganho de dano por estágio */
  fsw: number;
  fswStep: number;
  /** MOSFET: aquecimento máximo tolerado antes da redução de cadência (derating) */
  thermal: number;
  /** IGBT: dano adicional contra inimigos blindados ou chefes (0,6 = +60%) */
  armorBonus: number;
  /** IGBT: blindagem ignorada por golpe */
  armorPierce: number;
  /** Transformador de potência: bônus por unidade conectada e número máximo de conexões */
  perLink: number;
  linkMax: number;
  /** Plasma: estágios de ionização por descarga, limite e dano contínuo por estágio² */
  ion: number;
  ionMax: number;
  ionCoef: number;
}

export const ZERO_STATS: UnitStats = {
  damage: 0,
  interval: 0,
  range: 0,
  splash: 0,
  stun: 0,
  slow: 0,
  slowDur: 0,
  targets: 1,
  tau: 0,
  burst: 0,
  aura: 0,
  auraSpeed: 0,
  auraDamage: 0,
  auraRange: 0,
  income: 0,
  resistance: 0,
  inductance: 0,
  knockback: 0,
  charges: 1,
  ability: false,
  protect: false,
  gain: 0,
  gainStep: 0,
  heat: 0,
  heatMax: 0,
  heatCoef: 0,
  chains: 0,
  chainDecay: 0,
  salvo: 0,
  salvoMul: 0,
  waveIncome: 0,
  conversion: 0,
  duty: 0,
  meissner: 0,
  meissnerSlow: 0,
  resonance: 0,
  vco: 0,
  satBonus: 0,
  // 1.2: multiplicadores partem de 1 (neutro), não de 0
  recoverMul: 1,
  fsw: 0,
  fswStep: 0,
  thermal: 0,
  armorBonus: 0,
  armorPierce: 0,
  perLink: 0,
  linkMax: 0,
  ion: 0,
  ionMax: 0,
  ionCoef: 0,
};

export const stats = (p: Partial<UnitStats>): UnitStats => ({ ...ZERO_STATS, ...p });

export interface UnitLevel {
  cost: number;
  title: string;
  /** justificativa técnica da melhoria */
  why: string;
  patch: Partial<UnitStats>;
}

export interface UnitBranch {
  id: string;
  name: string;
  desc: string;
  why: string;
  patch: Partial<UnitStats>;
}

export interface UnitTier {
  name: string;
  /** custo em Energia concatenada (EC, recurso permanente) */
  ec: number;
  summary: string;
  why: string;
  apply: (s: UnitStats) => void;
  /** desconto no custo das melhorias durante a partida (0,15 = −15%) */
  upgradeDiscount?: number;
  /** melhorias exclusivas desta evolução (anexadas depois dos níveis normais) */
  extraLevels?: UnitLevel[];
}

export type AbilityKind =
  | 'discharge'
  | 'overvolt'
  | 'forceBias'
  | 'resonance'
  | 'monostable'
  | 'hvDischarge'
  | 'quench'
  // Patch 1.2
  /** MOSFET: comutação máxima sem aquecimento */
  | 'maxSwitching'
  /** IGBT: potência máxima, ignorando blindagem */
  | 'maxPower'
  /** Transformador de potência: todas as conexões no máximo */
  | 'gridBoost'
  /** Oscilador de cristal: travamento de fase (phase lock) */
  | 'phaseLock'
  /** Amp. operacional: ganho de malha aberta */
  | 'openLoop'
  /** Plasma: tempestade eletromagnética (habilidade suprema) */
  | 'plasmaStorm';

export interface AbilityDef {
  kind: AbilityKind;
  name: string;
  desc: string;
  cooldown: number;
  duration: number;
}

export interface UnitTech {
  definition: string;
  principle: string;
  characteristics: string[];
  applications: string[];
  /** como o componente virou mecânica de jogo */
  mechanic: string;
  /** o que é fenômeno real e o que é adaptação lúdica */
  physicsNote: string;
  formula?: { tex: string; label: string };
}

export interface UnitDef {
  id: UnitId;
  name: string;
  short: string;
  classes: UnitClass[];
  rarity: Rarity;
  role: string;
  damageType: DamageType | null;
  behavior: Behavior;
  cost: number;
  /** máximo de unidades deste tipo por partida */
  limit: number;
  color: string;
  base: UnitStats;
  levels: UnitLevel[];
  /** nível (1-based) em que o jogador escolhe um ramo */
  branchAt?: number;
  branches?: [UnitBranch, UnitBranch];
  tiers: [UnitTier, UnitTier, UnitTier];
  ability?: AbilityDef;
  /** descrição da habilidade passiva / mecânica exclusiva */
  special: string;
  tech: UnitTech;
  unlockText: string;
  /** unidade secreta: aparece como “???” na coleção até ser descoberta */
  secret?: boolean;
}

export interface RarityDef {
  id: Rarity;
  name: string;
  color: string;
  /** ordem de exibição */
  rank: number;
}

export const RARITIES: Record<Rarity, RarityDef> = {
  comum: { id: 'comum', name: 'Comum', color: '#a3b2c4', rank: 0 },
  incomum: { id: 'incomum', name: 'Incomum', color: '#39d08a', rank: 1 },
  raro: { id: 'raro', name: 'Raro', color: '#3d9bff', rank: 2 },
  epico: { id: 'epico', name: 'Épico', color: '#a28bff', rank: 3 },
  lendario: { id: 'lendario', name: 'Lendário', color: '#f2bf4a', rank: 4 },
  mitico: { id: 'mitico', name: 'Mítico', color: '#ff5f8f', rank: 5 },
  secreto: { id: 'secreto', name: 'Secreto', color: '#5ff2e8', rank: 6 },
};

/** Raridades das quais só pode haver uma unidade por equipe. */
export const EXCLUSIVE_RARITIES: Rarity[] = ['mitico', 'secreto'];

export const CLASS_LABEL: Record<UnitClass, string> = {
  DPS: 'DPS',
  Burst: 'Burst',
  Support: 'Suporte',
  Control: 'Controle',
  Economy: 'Economia',
  Hybrid: 'Híbrida',
  Defense: 'Defesa',
};

export const DAMAGE_LABEL: Record<DamageType, string> = {
  magnetico: 'Magnético',
  comutacao: 'Comutação',
  descarga: 'Descarga',
  grampeamento: 'Grampeamento',
  termico: 'Térmico',
};
