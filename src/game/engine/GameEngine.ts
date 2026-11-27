import { Store, type Tickable } from '../../simulations/engine';
import { MODIFIERS, type ModifierId } from '../data/difficulty';
import { ENEMIES, type EnemyDef, type PhaseAction } from '../data/enemies';
import { MAPS, MAP_H, MAP_W, PATH_WIDTH, UNIT_RADIUS, type MapDef } from '../data/maps';
import type { BlockedZone, StageDef, WaveDef } from '../data/stages';
import { SYNERGIES, SYNERGY_BY_ID, type SynergyId } from '../data/synergies';
import {
  INDUCTIVE_UNITS,
  MAGNETIC_UNITS,
  SEMICONDUCTOR_UNITS,
  THERMAL_UNITS,
  TIMER_UNITS,
  TRANSISTOR_UNITS,
  UNITS,
  type UnitDef,
  type UnitStats,
} from '../data/units';
import { isCapsuleMilestone, rollCapsule, type CapsuleRoll } from '../progress/capsules';
import type { DamageType, Difficulty, EnemyId, LoadoutEntry, TargetPriority, UnitClass, UnitId } from '../types';
import { PathGeo, rng } from './geometry';
import { computeStats, dpsEstimate, needsBranch, placeCost, rlSteadyDps, upgradeCost } from './stats';

/**
 * Engine da partida — lógica pura, independente da apresentação.
 *
 * Passo fixo de 1/60 s (tempo de jogo), acumulado a partir do ticker global do EMLab.
 * A interface React é notificada em ~10 Hz (e imediatamente após comandos); o canvas lê o
 * estado diretamente a cada quadro.
 *
 * Patch 1.1: dificuldades (vida/velocidade sobre os valores-base), modificadores, zonas
 * bloqueadas, sinergias, 7 comportamentos novos de unidade, 9 inimigos novos e cápsulas.
 */

export const STEP = 1 / 60;
const CAPACITOR_FIRE_V = 0.9; // energia ∝ v² → 81%
/** Intervalo de referência entre descargas do capacitor; `stats.recoverMul` o ajusta (1.2). */
const CAPACITOR_RECOVER = 0.455; // 0,35 s × 1,3 (1.1: intervalo entre descargas +30%)
const VULN_BONUS = 0.15;
const SELL_REFUND = 0.6;
/** 1.2: bônus de dano dos componentes com bobina protegidos por diodo (flyback) */
const INDUCTIVE_PROTECT_BONUS = 0.15;
/** 1.2: redução do tempo de carregamento do capacitor alimentado por uma Fonte DC (era 0,25) */
const POWERED_CHARGE_BONUS = 0.1;

/* 1.2: MOSFET — perdas de comutação crescem com a frequência, então o próprio dispositivo
   aquece e, no limite térmico, entra em derating (redução forçada de cadência). */
const MOSFET_HEAT_BASE = 0.25;
const MOSFET_HEAT_PER_STAGE = 0.12;
const MOSFET_COOL = 1.1;
const MOSFET_DERATE = 0.45;
const MOSFET_DERATE_DUR = 2.5;

/* 1.2: plasma — ionização (dano contínuo de k·n², tipo descarga) e tempestade suprema */
const ION_TICK = 0.25;
const ION_DECAY = 1.8;
/** bônus de dano de descarga em alvos ionizados (o canal já está condutivo) */
const ION_CONDUCT_BONUS = 0.2;
const PLASMA_STORM_GAP = 0.45;

/** 1.2: tipos de dano considerados “elétricos” pela ruptura dielétrica (§4.1). */
const ELECTRIC_TYPES = new Set<DamageType>(['descarga', 'comutacao', 'grampeamento']);

/* §13.1: recuperação do chefe depois da aniquilação (ele esgotou a energia armazenada).
   É a janela em que o jogador reconstrói a defesa. */
const ANNIHILATION_RECOVERY = 8;
const ANNIHILATION_WINDOW = 14;

/* §7.5: ritmo e reserva do Auto Upgrade (uma compra por execução, saldo nunca imprevisível) */
const AUTO_UPGRADE_EVERY = 0.5;
const AUTO_UPGRADE_RESERVE = 0;
/** §7.4: comportamentos considerados “suporte econômico” na venda em massa */
const ECONOMY_BEHAVIORS = new Set(['income', 'rectifier', 'grid']);
const HEAT_TICK = 0.25;
const HEAT_DECAY = 1.5;
const CHAIN_JUMP = 110;
const SALVO_GAP = 0.18;

/* 1.2: resistência progressiva do modo Impossível (por onda concluída, com teto) */
const PROGRESSIVE_CONTROL_STEP = 0.03;
const PROGRESSIVE_CONTROL_CAP = 0.6;
const PROGRESSIVE_DR_STEP = 0.02;
const PROGRESSIVE_DR_CAP = 0.4;

export type Phase = 'prep' | 'wave' | 'won' | 'lost';

export interface Buff {
  speed: number;
  dmg: number;
  range: number;
  protected: boolean;
  noise: number;
  powered: boolean;
  boosted: boolean;
  /* 1.1 */
  /** sinergias ativas nesta unidade */
  syn: SynergyId[];
  /** penalidades multiplicativas de modificadores (1 = sem efeito) */
  pDmg: number;
  pSpeed: number;
  pRange: number;
  /** modificadores que estão afetando esta unidade agora */
  mods: ModifierId[];
  /** EMI irradiada (−alcance) e subtensão do Apagão (−dano) */
  emi: number;
  brownout: number;
  /** filtro do retificador (ruído pela metade) */
  filtered: boolean;
  /** uid do retificador que converte o dano desta unidade (−1 = nenhum) */
  rect: number;
  /** cadência extra do CI 555 em nível alto */
  timer: number;
}

export interface UnitInst {
  uid: number;
  def: UnitDef;
  entry: LoadoutEntry;
  level: number;
  branch: number;
  x: number;
  y: number;
  priority: TargetPriority;
  stats: UnitStats;
  cd: number;
  target: number;
  /** indutor/supercondutor: corrente normalizada (I/Imax); capacitor: tensão normalizada (v/V) */
  ramp: number;
  stored: number;
  pendingBurst: number;
  pendingUntil: number;
  abilityCd: number;
  abilityUntil: number;
  stunUntil: number;
  incomeT: number;
  placedAt: number;
  spent: number;
  kills: number;
  dealt: number;
  earned: number;
  buff: Buff;
  lastFire: number;
  aimX: number;
  aimY: number;
  /** uids das unidades que estão aplicando aura nesta */
  links: number[];
  /* 1.1 */
  /** transistor: estágios de ganho */
  stacks: number;
  lastTargetT: number;
  /** contador de ciclos (oscilador: semiciclos; Tesla: descargas; 555: períodos) */
  cycle: number;
  /** CI 555: tempo dentro do período e estado da saída */
  timerT: number;
  high: boolean;
  /** banco de capacitores: descargas consecutivas pendentes */
  salvoQ: { t: number; x: number; y: number; dmg: number; target: number }[];
  /** superaquecimento (Curto Franco): −cadência até este instante */
  overheatUntil: number;
  /** retificador: créditos fracionários acumulados */
  convAcc: number;
  convT: number;
  /** alvos secundários (feixes extras do indutor e do supercondutor) */
  extra: number[];
  /* ---------- Patch 1.2 ---------- */
  /** MOSFET: estágio de frequência de comutação e aquecimento próprio (perdas ∝ f) */
  fswStage: number;
  selfHeat: number;
  /** MOSFET: em derating térmico até este instante */
  deratedUntil: number;
  /** IGBT / amp. op.: recuperação após a habilidade (sem atacar) */
  recoverUntil: number;
  /** transformador de potência: conexões ativas no último passo (para a interface) */
  linked: number;
  /** plasma: descargas restantes da tempestade e instante da próxima */
  stormLeft: number;
  stormAt: number;
  /** 1.2: bloqueada contra venda acidental (Unit Manager, §7.4) */
  locked: boolean;
  /** 1.2: melhoria automática ligada e prioridade de 1 (maior) a 6 (menor) — §7.5 */
  autoUpgrade: boolean;
  autoPriority: number;
}

export interface EnemyInst {
  uid: number;
  def: EnemyDef;
  reward: number;
  hp: number;
  maxHp: number;
  shield: number;
  armor: number;
  path: number;
  d: number;
  x: number;
  y: number;
  angle: number;
  order: number;
  /**
   * 1.2: progresso real no percurso — distância percorrida / comprimento total da rota.
   * É o critério das prioridades PRIMEIRO e ÚLTIMO (nunca a ordem de criação, nem o
   * instante em que o inimigo entrou no alcance, nem a distância euclidiana).
   * Mantido sincronizado a cada passo e sempre que `d` muda (salto, recuo, spawn).
   */
  routeProgress: number;
  alive: boolean;
  slowUntil: number;
  slowAmt: number;
  zoneSlow: number;
  stunUntil: number;
  vulnUntil: number;
  rlTime: number;
  inZone: boolean;
  magTaken: number;
  tA: number;
  tB: number;
  phase: number;
  toggled: boolean;
  flash: number;
  pend: number;
  pendAt: number;
  spawnedHalf: boolean;
  /* 1.1 */
  /** velocidade-base já com a dificuldade */
  speed: number;
  bornAt: number;
  heat: number;
  heatCoef: number;
  heatT: number;
  heatTick: number;
  heatSrc: number;
  lastHit: number;
  /** oscilador: ressonância acumulada */
  res: number;
  resBy: number;
  resLast: number;
  /** circuito aberto */
  canOpen: boolean;
  open: boolean;
  openT: number;
  /** sobretensão: grampeada (sem proteção) até este instante */
  clampUntil: number;
  /** transiente */
  erMul: number;
  erT: number;
  erSeq: number;
  /** aceleração harmônica */
  boostUntil: number;
  boostAmt: number;
  tC: number;
  /** efeito Meissner deste passo */
  meissner: number;
  /* ---------- Patch 1.2 ---------- */
  /**
   * Plasma: estágios de ionização. Funcionam como o calor do resistor (dano contínuo de
   * k·n²), mas o dano é de tipo DESCARGA e o canal ionizado também conduz melhor —
   * inimigos ionizados recebem mais dano de descarga.
   */
  ion: number;
  ionCoef: number;
  ionT: number;
  ionTick: number;
  ionSrc: number;
  /** Dielétrico Rompido: dano elétrico acumulado e janela de ruptura */
  diel: number;
  dielUntil: number;
  /** Supercapacitor Instável: carga acumulada (fração da vida máxima) */
  charge: number;
  /** Semicondutor Reverso: em condução direta até este instante */
  forwardUntil: number;
  /** Saturação Profunda: medidor de saturação e janela de vulnerabilidade total */
  satFill: number;
  satUntil: number;
  /** Oscilador Parasita / Arco Voltaico: tempo do próprio ciclo de interferência */
  tD: number;
  jamUntil: number;
  /** §13: estado da aniquilação (0 = não começou, 1 = carregando, 2 = executada) */
  annih: number;
  annihAt: number;
}

export type FxKind =
  | 'bolt'
  | 'beam'
  | 'ring'
  | 'pulse'
  | 'discharge'
  | 'spark'
  | 'text'
  | 'emp'
  | 'upgrade'
  | 'place'
  | 'death'
  | 'leak'
  | 'dash'
  | 'wave'
  | 'heat'
  | 'quench';

export interface Fx {
  kind: FxKind;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  t: number;
  dur: number;
  color: string;
  text?: string;
}

export type SfxId =
  | 'place'
  | 'upgrade'
  | 'sell'
  | 'zap'
  | 'pulse'
  | 'discharge'
  | 'beam'
  | 'kill'
  | 'leak'
  | 'wave'
  | 'boss'
  | 'emp'
  | 'coin'
  | 'error'
  | 'win'
  | 'lose'
  | 'ability'
  | 'capsule';

export type GameEvent =
  | { type: 'sfx'; id: SfxId }
  | { type: 'toast'; text: string; tone: 'info' | 'warn' | 'boss' | 'ok' }
  | { type: 'end'; won: boolean }
  | { type: 'capsule'; roll: CapsuleRoll };

export interface MatchStats {
  kills: number;
  leaks: number;
  earned: number;
  spent: number;
  placed: number;
  upgrades: number;
  sold: number;
  maxUnits: number;
  stuns: number;
  fonteIncome: number;
  bosses: EnemyId[];
  classes: UnitClass[];
  unitsUsed: UnitId[];
  damageBy: Partial<Record<UnitId, number>>;
  time: number;
  abilities: number;
  /* 1.1 */
  rectified: number;
  capsules: CapsuleRoll[];
  /* 1.2 */
  /** unidades destruídas pela aniquilação do chefe final (§13.1) */
  annihilated: number;
  unitsLostToBoss: number;
  /** melhorias executadas pelo Auto Upgrade (§7.5) */
  autoUpgrades: number;
}

export interface MatchConfig {
  stage: StageDef;
  loadout: LoadoutEntry[];
  /** número de ondas (Infinity no modo infinito) */
  waveCount: number;
  getWave: (index: number) => WaveDef;
  /** bônus de conclusão de onda (n = 1, 2, …) */
  waveBonus?: (n: number) => number;
  showDamage?: boolean;
  /* 1.1 */
  difficulty?: Difficulty | null;
  /** multiplicadores da dificuldade sobre os atributos-base dos inimigos */
  enemyHp?: number;
  enemySpeed?: number;
  modifiers?: ModifierId[];
  blocked?: BlockedZone[];
  /** fração inicial da rampa de vida da fase (a última onda sempre chega a 100%) */
  rampStart?: number;
  /** modo infinito: cápsulas a cada 5 ondas */
  capsules?: boolean;
  /** 1.2: modo Impossível — resistência a controle e redução de dano crescentes por onda */
  progressiveResist?: boolean;
  /** gerador aleatório (cápsulas, modificadores); padrão: semente fixa por partida */
  rand?: () => number;
}

export interface CommandResult {
  ok: boolean;
  reason?: string;
}

/* ---------------------------------------------------------------------- */
/* 1.2 — §5/§6: efeitos e decomposição de atributos                        */
/* ---------------------------------------------------------------------- */

/** Sigla do efeito (§5). Letras, não só cores: funciona sem depender da cor. */
export type EffectCode =
  | 'ATK'
  | 'SPD'
  | 'RNG'
  | 'DOT'
  | 'STUN'
  | 'SLOW'
  | 'BURN'
  | 'SHOCK'
  | 'OVERLOAD'
  | 'RES'
  | 'VULN'
  /* siglas dos modificadores (§11) entram como código próprio */
  | string;

export interface StatSource {
  code: EffectCode;
  kind: 'buff' | 'debuff' | 'mod' | 'syn' | 'trait';
  label: string;
  /** valor aplicado, já formatado */
  value: string;
  /** descrição técnica / origem */
  detail: string;
}

export interface StatBreakdown {
  baseDamage: number;
  /** dano depois das melhorias, evolução e característica */
  leveledDamage: number;
  /** multiplicador total (buffs × debuffs × modificadores) */
  damageMul: number;
  /** dano efetivamente usado pelo combate */
  finalDamage: number;
  baseInterval: number;
  leveledInterval: number;
  speedMul: number;
  finalInterval: number;
  baseRange: number;
  leveledRange: number;
  finalRange: number;
  targets: number;
  /** DPS real, com os atributos efetivos */
  dps: number;
  sources: StatSource[];
  /** atributos efetivos completos (mesma estrutura que o combate lê) */
  effective: UnitStats;
}

const fmtPct = (v: number) => `${Math.round(v * 100)}%`;

export interface ModRegion {
  id: ModifierId;
  x: number;
  y: number;
  r: number;
  color: string;
}

interface SpawnEntry {
  t: number;
  enemy: EnemyId;
  path: number;
  hp: number;
}

const freshBuff = (): Buff => ({
  speed: 0,
  dmg: 0,
  range: 0,
  protected: false,
  noise: 0,
  powered: false,
  boosted: false,
  syn: [],
  pDmg: 1,
  pSpeed: 1,
  pRange: 1,
  mods: [],
  emi: 0,
  brownout: 0,
  filtered: false,
  rect: -1,
  timer: 0,
});

/** Comportamentos que atacam diretamente (afetados por “sobrecarga” e sincronizados pelo 555). */
const ATTACKERS = new Set(['bolt', 'pulse', 'amplifier', 'heat', 'chain', 'wave', 'switching', 'hv', 'opamp', 'plasma']);
const DIRECT_OVERLOAD = new Set(['bolt', 'pulse', 'amplifier', 'heat', 'chain', 'switching', 'hv', 'opamp', 'plasma']);
/** 1.2: comportamentos ofensivos (qualquer um que cause dano) — usado pelos modificadores. */
const OFFENSIVE = new Set([...ATTACKERS, 'beam', 'capacitor', 'super', 'zone', 'timer', 'crystal']);

/** hash determinístico em [0, 1) */
function hash01(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class GameEngine extends Store<number> implements Tickable {
  readonly config: MatchConfig;
  readonly map: MapDef;
  readonly paths: PathGeo[];
  readonly modifiers: ModifierId[];
  readonly blocked: BlockedZone[];
  /** trechos ressonantes (modificador Ressonância magnética): [início, fim] por caminho, em distância */
  readonly resonantZones: [number, number][][];

  time = 0;
  /** passos de simulação executados (base do registro/replay de comandos) */
  steps = 0;
  credits: number;
  lives: number;
  readonly maxLives: number;
  phase: Phase = 'prep';
  /** índice (0-based) da onda atual; −1 antes da primeira */
  wave = -1;
  speed: 1 | 2 | 3 = 1;
  paused = false;
  autoStart = false;
  prepTimer = 0;
  showDamage: boolean;

  units: UnitInst[] = [];
  enemies: EnemyInst[] = [];
  fx: Fx[] = [];
  stats: MatchStats;
  onEvent: ((e: GameEvent) => void) | null = null;
  /** regiões de interferência ativas (para o mapa) */
  modRegions: ModRegion[] = [];
  /** rejeição de carga do Apagão: sem geração de créditos até este instante */
  incomeHaltUntil = 0;
  /** §7.5: o Auto Upgrade ignora unidades bloqueadas? */
  autoSkipLocked = true;
  private autoT = 0;

  private queue: SpawnEntry[] = [];
  private waveTime = 0;
  private paidThrough = -1;
  private uidSeq = 1;
  private orderSeq = 0;
  private pathRR = 0;
  private acc = 0;
  private uiT = 0;
  private version = 0;
  private sfxGate: Partial<Record<SfxId, number>> = {};
  private rand: () => number;
  private capsuleChecked = new Set<number>();

  constructor(config: MatchConfig) {
    super();
    this.config = config;
    this.map = MAPS[config.stage.map];
    this.paths = this.map.paths.map((p) => new PathGeo(p));
    this.modifiers = config.modifiers ?? [];
    this.blocked = config.blocked ?? config.stage.blocked ?? [];
    this.rand = config.rand ?? rng(9173 + config.stage.id.length * 31);
    this.resonantZones = this.paths.map((p) =>
      this.modifiers.includes('ressonancia_magnetica')
        ? [
            [p.length * 0.4, p.length * 0.55],
            [p.length * 0.74, p.length * 0.86],
          ]
        : [],
    );
    this.credits = config.stage.startCredits;
    this.lives = config.stage.lives;
    this.maxLives = config.stage.lives;
    this.showDamage = config.showDamage ?? true;
    this.stats = {
      kills: 0,
      leaks: 0,
      earned: 0,
      spent: 0,
      placed: 0,
      upgrades: 0,
      sold: 0,
      maxUnits: 0,
      stuns: 0,
      fonteIncome: 0,
      bosses: [],
      classes: [],
      unitsUsed: [],
      damageBy: {},
      time: 0,
      abilities: 0,
      rectified: 0,
      capsules: [],
      annihilated: 0,
      unitsLostToBoss: 0,
      autoUpgrades: 0,
    };
    this.snap = 0;
  }

  /* ------------------------------------------------------------------ */
  /* Ciclo                                                               */
  /* ------------------------------------------------------------------ */

  tick(realDt: number): void {
    if (this.paused || this.isOver) return;
    this.acc += realDt * this.speed;
    let steps = 0;
    while (this.acc >= STEP && steps < 12) {
      this.update(STEP);
      this.acc -= STEP;
      steps++;
      if (this.isOver) break;
    }
    if (steps === 12) this.acc = 0;
    this.uiT += realDt;
    if (this.uiT >= 0.1) {
      this.uiT = 0;
      this.bump();
    }
  }

  get isOver(): boolean {
    return this.phase === 'won' || this.phase === 'lost';
  }

  get totalWaves(): number {
    return this.config.waveCount;
  }

  /** a próxima onda pode ser chamada agora? */
  get canCallWave(): boolean {
    if (this.isOver) return false;
    if (this.wave + 1 >= this.totalWaves) return false;
    return this.phase === 'prep' || this.queue.length === 0;
  }

  get aliveEnemies(): number {
    return this.enemies.length;
  }

  get boss(): EnemyInst | null {
    return this.enemies.find((e) => e.def.boss) ?? null;
  }

  /** Próxima onda (para a prévia no HUD). */
  peekWave(): WaveDef | null {
    const n = this.wave + 1;
    return n < this.totalWaves ? this.config.getWave(n) : null;
  }

  waveBonus(n: number): number {
    const base = this.config.waveBonus ? this.config.waveBonus(n) : 40 + 10 * n;
    return Math.round(base * (this.modifiers.includes('dreno_energetico') ? 0.75 : 1));
  }

  bump(): void {
    this.version++;
    this.snap = this.version;
    this.emit();
  }

  /** Avança a simulação um passo de `dt` segundos de jogo (público para testes). */
  update(dt: number): void {
    this.steps++;
    this.time += dt;
    this.stats.time = this.time;

    if (this.phase === 'prep' && this.autoStart && this.wave >= 0) {
      this.prepTimer -= dt;
      if (this.prepTimer <= 0) this.startWave();
    }

    this.spawn(dt);
    this.computeBuffs();
    this.updateEnemies(dt);
    for (const u of this.units) this.updateUnit(u, dt);
    // §7.5: a melhoria automática roda depois do combate, em ritmo fixo e determinístico
    this.runAutoUpgrade(dt);
    this.cleanup();
    this.checkWave();
  }

  /* ------------------------------------------------------------------ */
  /* Modificadores                                                       */
  /* ------------------------------------------------------------------ */

  /** O modificador está ativo agora? (permanentes: sempre, se presentes) */
  modActive(id: ModifierId): boolean {
    if (!this.modifiers.includes(id)) return false;
    const m = MODIFIERS[id];
    if (!m.period) return true;
    const t = this.time - (m.offset ?? 0);
    return t >= 0 && t % m.period < (m.duration ?? 0);
  }

  /** Segundos até o próximo início (inativo) ou fim (ativo) da janela do modificador. */
  modTimer(id: ModifierId): number | null {
    const m = MODIFIERS[id];
    if (!m.period) return null;
    const t = this.time - (m.offset ?? 0);
    if (t < 0) return -t;
    const c = t % m.period;
    const dur = m.duration ?? 0;
    return c < dur ? dur - c : m.period - c;
  }

  private modCycle(id: ModifierId): number {
    const m = MODIFIERS[id];
    return m.period ? Math.floor((this.time - (m.offset ?? 0)) / m.period) : 0;
  }

  /**
   * 1.2 — §11 (Instabilidade de frequência): desvio aplicado ao período das unidades
   * temporizadoras. Alterna entre +25% e −20% a cada janela; 1 = sem desvio.
   */
  timerDeviation(): number {
    if (!this.modActive('instabilidade_frequencia')) return 1;
    return this.modCycle('instabilidade_frequencia') % 2 === 0 ? 1.25 : 0.8;
  }

  /** Multiplicador da geração de créditos (fontes e retificadores). */
  incomeMul(): number {
    if (this.time < this.incomeHaltUntil) return 0;
    let m = 1;
    if (this.modActive('queda_rendimento')) m *= 0.6;
    if (this.modActive('dreno_energetico')) m *= 0.55;
    // 1.2 — §11: Subtensão (permanente)
    if (this.modActive('subtensao')) m *= 0.65;
    return m;
  }

  private regionFor(id: ModifierId, r: number): ModRegion {
    const c = this.modCycle(id);
    const p = this.paths[c % this.paths.length];
    const pos = { x: 0, y: 0, angle: 0 };
    p.at(p.length * (0.2 + 0.6 * hash01(c, id.length, 7)), pos);
    return { id, x: pos.x, y: pos.y, r, color: MODIFIERS[id].color };
  }

  private applyModifiers(): void {
    this.modRegions = [];
    if (!this.modifiers.length || !this.units.length) {
      if (this.modActive('interferencia_em')) this.modRegions.push(this.regionFor('interferencia_em', 190));
      if (this.modActive('interferencia_critica')) this.modRegions.push(this.regionFor('interferencia_critica', 230));
      return;
    }
    const t = this.time;
    const add = (u: UnitInst, id: ModifierId) => {
      if (!u.buff.mods.includes(id)) u.buff.mods.push(id);
    };
    if (this.modActive('instabilidade_tensao')) {
      const c = this.modCycle('instabilidade_tensao');
      for (const u of this.units) {
        if (u.buff.protected || hash01(u.uid, c, 1) >= 0.35) continue;
        u.buff.pDmg *= 0.75;
        add(u, 'instabilidade_tensao');
      }
    }
    if (this.modActive('sobrecarga_eletrica')) {
      for (const u of this.units) {
        if (!DIRECT_OVERLOAD.has(u.def.behavior)) continue;
        u.buff.pSpeed *= 1 / 1.35;
        add(u, 'sobrecarga_eletrica');
      }
    }
    for (const [id, r, amount] of [
      ['interferencia_em', 190, 0.2],
      ['interferencia_critica', 230, 0.35],
    ] as [ModifierId, number, number][]) {
      if (!this.modActive(id)) continue;
      const reg = this.regionFor(id, r);
      this.modRegions.push(reg);
      for (const u of this.units) {
        if ((u.x - reg.x) ** 2 + (u.y - reg.y) ** 2 > r * r || u.entry.trait === 'isolamento') continue;
        if (id === 'interferencia_em' && u.buff.protected) continue;
        u.buff.pRange *= 1 - (u.buff.protected ? amount / 2 : amount);
        add(u, id);
      }
    }
    if (this.modifiers.includes('oscilacao_frequencia')) {
      for (const u of this.units) {
        const ph = u.uid % 2 ? Math.PI : 0;
        u.buff.pSpeed *= 1 + 0.15 * Math.sin((2 * Math.PI * t) / 8 + ph);
        add(u, 'oscilacao_frequencia');
      }
    }
    if (this.modActive('colapso_tensao')) {
      const c = this.modCycle('colapso_tensao');
      const picked = [...this.units].sort((a, b) => hash01(a.uid, c, 2) - hash01(b.uid, c, 2)).slice(0, 2);
      for (const u of picked) {
        u.buff.pDmg *= u.buff.protected ? 0.7 : 0.4;
        add(u, 'colapso_tensao');
      }
    }
    if (this.modActive('sobrecarga_sistemica')) {
      for (const u of this.units) {
        if (!OFFENSIVE.has(u.def.behavior)) continue;
        u.buff.pSpeed *= 1 / 1.5;
        add(u, 'sobrecarga_sistemica');
      }
    }
    if (this.modActive('falha_isolamento')) {
      for (const u of this.units) {
        if (u.buff.protected) continue;
        u.buff.pDmg *= 0.7;
        add(u, 'falha_isolamento');
      }
    }

    /* ---------------- 1.2 — §11: modificadores novos ---------------- */

    // Interferência conduzida: atrasa a comutação dos semicondutores (filtro corta metade)
    if (this.modActive('emi_conduzida')) {
      for (const u of this.units) {
        if (!SEMICONDUCTOR_UNITS.includes(u.def.id)) continue;
        u.buff.pSpeed *= 1 / (u.buff.filtered ? 1.15 : 1.3);
        add(u, 'emi_conduzida');
      }
    }
    // Saturação magnética: o núcleo para de converter corrente em campo útil
    if (this.modActive('saturacao_magnetica')) {
      for (const u of this.units) {
        if (!MAGNETIC_UNITS.includes(u.def.id)) continue;
        u.buff.pDmg *= 0.6;
        add(u, 'saturacao_magnetica');
      }
    }
    // Ruído elétrico: ~40% das unidades sorteadas perdem cadência (isolamento/diodo imunes)
    if (this.modActive('ruido_eletrico')) {
      const c = this.modCycle('ruido_eletrico');
      for (const u of this.units) {
        if (u.buff.protected || u.entry.trait === 'isolamento') continue;
        if (hash01(u.uid, c, 11) >= 0.4) continue;
        u.buff.pSpeed *= 1 / (u.buff.filtered ? 1.15 : 1.3);
        add(u, 'ruido_eletrico');
      }
    }
    // Falha de comutação: zera a amplificação e corta o dano das unidades de transistor
    if (this.modActive('falha_comutacao')) {
      for (const u of this.units) {
        if (!TRANSISTOR_UNITS.includes(u.def.id)) continue;
        u.buff.pDmg *= 0.65;
        if (this.time >= u.abilityUntil) {
          u.stacks = 0;
          u.fswStage = 0;
        }
        add(u, 'falha_comutacao');
      }
    }
    // Efeito Joule: o alvo dissipa melhor o calor, então o dano contínuo rende menos
    if (this.modActive('efeito_joule')) {
      for (const u of this.units) {
        if (!THERMAL_UNITS.includes(u.def.id)) continue;
        add(u, 'efeito_joule');
      }
    }
    // Instabilidade de frequência: marca as temporizadoras (o desvio vai no período)
    if (this.modActive('instabilidade_frequencia')) {
      for (const u of this.units) {
        if (!TIMER_UNITS.includes(u.def.id)) continue;
        add(u, 'instabilidade_frequencia');
      }
    }
    // Subtensão: marca as unidades de economia (o corte vai em `incomeMul`)
    if (this.modActive('subtensao')) {
      for (const u of this.units) {
        if (u.def.behavior !== 'income' && u.def.behavior !== 'rectifier' && u.def.behavior !== 'grid') continue;
        add(u, 'subtensao');
      }
    }
  }

  /**
   * 1.2 — §11: multiplicador do dano contínuo térmico/ionizante (Efeito Joule).
   * Aplicado uma única vez, no instante em que o dano contínuo é causado.
   */
  thermalMul(): number {
    return this.modActive('efeito_joule') ? 0.6 : 1;
  }

  /* ------------------------------------------------------------------ */
  /* Comandos do jogador                                                 */
  /* ------------------------------------------------------------------ */

  entryFor(id: UnitId): LoadoutEntry | undefined {
    return this.config.loadout.find((l) => l.id === id);
  }

  countOf(id: UnitId): number {
    return this.units.reduce((n, u) => n + (u.def.id === id ? 1 : 0), 0);
  }

  blockedAt(x: number, y: number): BlockedZone | null {
    const m = UNIT_RADIUS - 4;
    for (const b of this.blocked) {
      if (x > b.x - m && x < b.x + b.w + m && y > b.y - m && y < b.y + b.h + m) return b;
    }
    return null;
  }

  canPlace(id: UnitId, x: number, y: number): CommandResult {
    const entry = this.entryFor(id);
    if (!entry) return { ok: false, reason: 'Unidade fora da equipe' };
    if (this.isOver) return { ok: false, reason: 'Partida encerrada' };
    const def = UNITS[id];
    if (this.countOf(id) >= def.limit) return { ok: false, reason: `Limite de ${def.limit} por partida` };
    if (this.credits < placeCost(entry)) return { ok: false, reason: 'Créditos insuficientes' };
    const m = UNIT_RADIUS + 2;
    if (x < m || y < m || x > MAP_W - m || y > MAP_H - m) return { ok: false, reason: 'Fora da área' };
    for (const p of this.paths) {
      if (p.distTo(x, y) < PATH_WIDTH / 2 + UNIT_RADIUS - 3) return { ok: false, reason: 'Sobre o caminho' };
    }
    if (Math.hypot(x - this.map.core.x, y - this.map.core.y) < 46) return { ok: false, reason: 'Muito perto do núcleo' };
    const zone = this.blockedAt(x, y);
    if (zone) return { ok: false, reason: `Área bloqueada: ${zone.label}` };
    for (const u of this.units) {
      if (Math.hypot(u.x - x, u.y - y) < UNIT_RADIUS * 2) return { ok: false, reason: 'Sobre outra unidade' };
    }
    return { ok: true };
  }

  place(id: UnitId, x: number, y: number): CommandResult {
    const check = this.canPlace(id, x, y);
    if (!check.ok) {
      this.sfx('error');
      return check;
    }
    const entry = this.entryFor(id)!;
    const def = UNITS[id];
    const cost = placeCost(entry);
    this.credits -= cost;
    this.stats.spent += cost;
    const stats = computeStats(entry, 0, -1);
    const u: UnitInst = {
      uid: this.uidSeq++,
      def,
      entry,
      level: 0,
      branch: -1,
      x,
      y,
      priority: 'primeiro',
      stats,
      cd: 0.2,
      target: -1,
      ramp: 0,
      stored: 0,
      pendingBurst: 0,
      pendingUntil: 0,
      abilityCd: 0,
      abilityUntil: 0,
      stunUntil: 0,
      incomeT: 0,
      placedAt: this.time,
      spent: cost,
      kills: 0,
      dealt: 0,
      earned: 0,
      buff: freshBuff(),
      lastFire: -10,
      aimX: x + 1,
      aimY: y,
      links: [],
      stacks: 0,
      lastTargetT: -10,
      cycle: 0,
      timerT: def.behavior === 'timer' ? Math.max(0, stats.interval - 1) : 0,
      high: false,
      salvoQ: [],
      overheatUntil: 0,
      convAcc: 0,
      convT: 0,
      extra: [],
      fswStage: 0,
      selfHeat: 0,
      deratedUntil: 0,
      recoverUntil: 0,
      linked: 0,
      stormLeft: 0,
      stormAt: 0,
      locked: false,
      autoUpgrade: false,
      autoPriority: 3,
    };
    this.units.push(u);
    this.stats.placed++;
    this.stats.maxUnits = Math.max(this.stats.maxUnits, this.units.length);
    for (const c of def.classes) if (!this.stats.classes.includes(c)) this.stats.classes.push(c);
    if (!this.stats.unitsUsed.includes(id)) this.stats.unitsUsed.push(id);
    this.addFx({ kind: 'place', x, y, r: 26, dur: 0.5, color: def.color });
    this.sfx('place');
    this.bump();
    return { ok: true };
  }

  unit(uid: number): UnitInst | undefined {
    return this.units.find((u) => u.uid === uid);
  }

  upgrade(uid: number, branch?: number): CommandResult {
    const u = this.unit(uid);
    if (!u || this.isOver) return { ok: false, reason: 'Unidade inexistente' };
    const cost = upgradeCost(u.entry, u.level);
    if (cost === null) return { ok: false, reason: 'Nível máximo' };
    if (needsBranch(u.def, u.level) && (branch === undefined || branch < 0 || branch > 1)) return { ok: false, reason: 'Escolha um ramo' };
    if (this.credits < cost) {
      this.sfx('error');
      return { ok: false, reason: 'Créditos insuficientes' };
    }
    this.credits -= cost;
    this.stats.spent += cost;
    u.spent += cost;
    if (needsBranch(u.def, u.level)) u.branch = branch!;
    u.level++;
    u.stats = computeStats(u.entry, u.level, u.branch);
    if (u.def.behavior === 'timer') u.timerT = Math.min(u.timerT, u.stats.interval - 0.01);
    this.stats.upgrades++;
    this.addFx({ kind: 'upgrade', x: u.x, y: u.y, r: 30, dur: 0.7, color: u.def.color });
    this.sfx('upgrade');
    this.bump();
    return { ok: true };
  }

  sellValue(u: UnitInst): number {
    return Math.round(u.spent * SELL_REFUND);
  }

  /** Comando público de venda (registrado no log do replay). */
  sell(uid: number): CommandResult {
    return this.sellInternal(uid);
  }

  /**
   * Venda efetiva. `sellMany` usa este caminho interno em vez de `sell`, porque `sell` é
   * interceptado pelo gravador do replay — se as vendas em massa chamassem o comando
   * público, cada unidade apareceria duas vezes no log (uma pela ação em massa, outra pela
   * venda individual).
   */
  private sellInternal(uid: number): CommandResult {
    const i = this.units.findIndex((u) => u.uid === uid);
    if (i < 0 || this.isOver) return { ok: false, reason: 'Unidade inexistente' };
    const u = this.units[i];
    if (u.locked) return { ok: false, reason: 'Unidade bloqueada' };
    const value = this.sellValue(u);
    this.credits += value;
    this.units.splice(i, 1);
    this.stats.sold++;
    this.addFx({ kind: 'text', x: u.x, y: u.y - 10, r: 0, dur: 0.9, color: '#39d08a', text: `+${value}` });
    this.sfx('sell');
    this.bump();
    return { ok: true };
  }

  setPriority(uid: number, p: TargetPriority): void {
    const u = this.unit(uid);
    if (!u) return;
    u.priority = p;
    if (u.def.behavior !== 'beam' && u.def.behavior !== 'amplifier') u.target = -1;
    this.bump();
  }

  /* ------------------------------------------------------------------ */
  /* 1.2 — §7: Unit Manager                                             */
  /* ------------------------------------------------------------------ */

  /** §7.4 — bloqueia a unidade contra venda (inclusive as vendas em massa). */
  setLock(uid: number, locked: boolean): void {
    const u = this.unit(uid);
    if (!u) return;
    u.locked = locked;
    this.bump();
  }

  /** §7.5 — liga/desliga a melhoria automática desta unidade. */
  setAutoUpgrade(uid: number, on: boolean): void {
    const u = this.unit(uid);
    if (!u) return;
    u.autoUpgrade = on;
    this.bump();
  }

  /** §7.3 — prioridade de melhoria automática: 1 (maior) a 6 (menor). */
  setAutoPriority(uid: number, priority: number): void {
    const u = this.unit(uid);
    if (!u) return;
    u.autoPriority = Math.max(1, Math.min(6, Math.round(priority)));
    this.bump();
  }

  /** §7.5 — ignora unidades bloqueadas na melhoria automática. */
  setAutoSkipLocked(on: boolean): void {
    this.autoSkipLocked = on;
    this.bump();
  }

  /**
   * §7.4 — venda em massa. `scope`:
   *   'selected' → as unidades de `uids`
   *   'economy'  → apenas as de suporte econômico (fonte, retificador, trafo de potência)
   *   'all'      → todas
   * Unidades BLOQUEADAS nunca são vendidas por ações em massa. Devolve quantas foram
   * vendidas e o total recebido.
   */
  sellMany(scope: 'selected' | 'economy' | 'all', uids: number[] = []): { sold: number; credits: number } {
    if (this.isOver) return { sold: 0, credits: 0 };
    const alvo = this.units.filter((u) => {
      if (u.locked) return false;
      if (scope === 'selected') return uids.includes(u.uid);
      if (scope === 'economy') return ECONOMY_BEHAVIORS.has(u.def.behavior);
      return true;
    });
    let credits = 0;
    let sold = 0;
    // ordem determinística (uid crescente): o replay no servidor reproduz igual
    for (const u of [...alvo].sort((a, b) => a.uid - b.uid)) {
      const v = this.sellValue(u);
      if (this.sellInternal(u.uid).ok) {
        credits += v;
        sold++;
      }
    }
    return { sold, credits };
  }

  /** Unidades do mesmo tipo (§7.4 — Select All Copies). */
  copiesOf(uid: number): number[] {
    const u = this.unit(uid);
    if (!u) return [];
    return this.units.filter((o) => o.def.id === u.def.id).map((o) => o.uid);
  }

  /**
   * §7.5 — Auto Upgrade. Roda em intervalos fixos de tempo de jogo e compra UMA melhoria por
   * execução, sempre a de maior prioridade entre as disponíveis.
   *
   * Ordem determinística: prioridade (1 antes de 6) → menor custo → menor uid. Como roda
   * dentro de `update`, o servidor reproduz exatamente as mesmas compras na re-simulação.
   *
   * Regras: só gasta o que há de fato (nunca entra em saldo negativo), respeita um reserva
   * mínima para o jogador não ficar sem créditos de forma imprevisível, pula unidades que
   * exigem escolha de ramo (essa decisão é do jogador) e, se configurado, pula as
   * bloqueadas. Uma compra por execução evita esvaziar o saldo de uma vez.
   */
  private runAutoUpgrade(dt: number): void {
    this.autoT += dt;
    if (this.autoT < AUTO_UPGRADE_EVERY) return;
    this.autoT = 0;
    const candidatas: { u: UnitInst; cost: number }[] = [];
    for (const u of this.units) {
      if (!u.autoUpgrade) continue;
      if (this.autoSkipLocked && u.locked) continue;
      if (needsBranch(u.def, u.level)) continue; // a escolha de ramo é do jogador
      const cost = upgradeCost(u.entry, u.level);
      if (cost === null) continue;
      candidatas.push({ u, cost });
    }
    if (!candidatas.length) return;
    candidatas.sort((a, b) => a.u.autoPriority - b.u.autoPriority || a.cost - b.cost || a.u.uid - b.u.uid);
    const escolhida = candidatas.find((c) => this.credits - c.cost >= AUTO_UPGRADE_RESERVE);
    if (!escolhida) return;
    const r = this.upgrade(escolhida.u.uid);
    if (r.ok) this.stats.autoUpgrades++;
  }

  /** A habilidade ativa pode ser usada agora? (desbloqueada, fora de recarga e unidade ativa) */
  abilityReady(u: UnitInst): boolean {
    return !!u.def.ability && u.stats.ability && u.abilityCd <= 0 && this.time >= u.stunUntil && !this.isOver;
  }

  /** Motivo para a habilidade não estar disponível (para a interface). */
  abilityBlock(u: UnitInst): string | null {
    if (!u.def.ability || !u.stats.ability) return 'Bloqueada';
    if (this.isOver) return 'Partida encerrada';
    if (this.time < u.stunUntil) return 'Unidade desativada';
    if (u.abilityCd > 0) return `Recarga ${Math.ceil(u.abilityCd)} s`;
    return null;
  }

  useAbility(uid: number): CommandResult {
    const u = this.unit(uid);
    if (!u || !u.def.ability) return { ok: false, reason: 'Sem habilidade' };
    const block = this.abilityBlock(u);
    if (block) return { ok: false, reason: block };
    const ab = u.def.ability;
    const t = this.time;
    switch (ab.kind) {
      case 'discharge': {
        // carga rápida: completa a carga atual e descarrega tudo (cargas armazenadas + atual)
        const energy = u.stored + 1;
        const range = this.rangeOf(u);
        const dmg = 1.6 * u.stats.damage * energy * this.dmgMul(u);
        for (const e of this.enemies) {
          if (e.alive && (e.x - u.x) ** 2 + (e.y - u.y) ** 2 <= (range + e.def.radius) ** 2) {
            this.hit(e, dmg, 'descarga', u);
            this.slowEnemy(e, u.stats.slow, u.stats.slowDur);
          }
        }
        u.stored = 0;
        u.ramp = 0;
        u.lastFire = t;
        this.addFx({ kind: 'discharge', x: u.x, y: u.y, r: range, dur: 0.7, color: u.def.color });
        this.addFx({ kind: 'text', x: u.x, y: u.y - 30, r: 0, dur: 1, color: u.def.color, text: `Descarga total ×${energy}` });
        break;
      }
      case 'overvolt':
        this.addFx({ kind: 'ring', x: u.x, y: u.y, r: u.stats.aura, dur: 0.8, color: u.def.color });
        break;
      case 'forceBias':
        u.stacks = u.stats.gain;
        this.addFx({ kind: 'ring', x: u.x, y: u.y, r: u.stats.aura, dur: 0.6, color: u.def.color });
        break;
      case 'resonance':
        u.cd = 0;
        this.addFx({ kind: 'wave', x: u.x, y: u.y, r: this.rangeOf(u), dur: 0.8, color: '#ffffff' });
        break;
      case 'monostable':
        this.timerTrigger(u, 2, true);
        break;
      case 'hvDischarge': {
        const [first] = this.pick(u, this.rangeOf(u), 1);
        if (!first) return { ok: false, reason: 'Nenhum alvo no alcance' };
        // 1.2: multiplicador da habilidade 2× → 5×
        this.chainFrom(u, first, 12, 5 * u.stats.damage * this.dmgMul(u), u.stats.chainDecay, 0.8);
        break;
      }
      case 'quench': {
        const e0 = u.stats.burst * u.stats.damage * u.ramp * u.ramp * this.dmgMul(u);
        for (const e of this.enemies) {
          if (e.alive && (e.x - u.x) ** 2 + (e.y - u.y) ** 2 <= (170 + e.def.radius) ** 2) this.hit(e, e0, 'magnetico', u);
        }
        this.addFx({ kind: 'quench', x: u.x, y: u.y, r: 170, dur: 1, color: u.def.color });
        this.addFx({ kind: 'text', x: u.x, y: u.y - 30, r: 0, dur: 1.2, color: u.def.color, text: `Quench: ${Math.round(e0)}` });
        u.ramp = 0;
        u.stunUntil = t + 5;
        break;
      }
      /* ---------------- 1.2 ---------------- */
      case 'maxSwitching':
        // refrigeração ideal: frequência travada no máximo e aquecimento zerado
        u.fswStage = u.stats.fsw;
        u.selfHeat = 0;
        u.deratedUntil = 0;
        this.addFx({ kind: 'ring', x: u.x, y: u.y, r: this.rangeOf(u), dur: 0.6, color: u.def.color });
        break;
      case 'maxPower':
        u.cd = 0;
        this.addFx({ kind: 'ring', x: u.x, y: u.y, r: this.rangeOf(u), dur: 0.7, color: '#ffffff' });
        break;
      case 'gridBoost':
        // o ciclo de distribuição é pago na hora
        u.incomeT = u.stats.interval;
        this.addFx({ kind: 'ring', x: u.x, y: u.y, r: u.stats.aura, dur: 0.8, color: u.def.color });
        break;
      case 'phaseLock':
        // dispara o pulso imediatamente e trava a fase
        u.timerT = this.crystalPeriod(u);
        this.addFx({ kind: 'ring', x: u.x, y: u.y, r: u.stats.aura, dur: 0.8, color: '#ffffff' });
        break;
      case 'openLoop':
        u.stacks = u.stats.gain;
        u.cd = 0;
        // ao terminar a malha aberta, 2 s de recuperação (slew rate)
        u.recoverUntil = t + ab.duration + 2;
        this.addFx({ kind: 'ring', x: u.x, y: u.y, r: u.stats.aura, dur: 0.7, color: u.def.color });
        break;
      case 'plasmaStorm': {
        const range = this.rangeOf(u);
        u.stormLeft = 3;
        u.stormAt = t;
        for (const e of this.enemies) {
          if (!e.alive || (e.x - u.x) ** 2 + (e.y - u.y) ** 2 > (range + e.def.radius) ** 2) continue;
          this.addIon(e, u.stats.ionMax, u.stats.ionMax, u.stats.ionCoef * this.dmgMul(u), u.uid);
          this.slowEnemy(e, 0.4, 4);
        }
        this.addFx({ kind: 'quench', x: u.x, y: u.y, r: range, dur: 1.2, color: u.def.color });
        this.addFx({ kind: 'text', x: u.x, y: u.y - 30, r: 0, dur: 1.2, color: u.def.color, text: 'Tempestade eletromagnética' });
        break;
      }
    }
    u.abilityCd = ab.cooldown;
    u.abilityUntil = t + ab.duration;
    this.stats.abilities++;
    this.sfx('ability');
    this.bump();
    return { ok: true };
  }

  startWave(): CommandResult {
    if (!this.canCallWave) return { ok: false, reason: 'Aguarde o fim da onda' };
    // Chamada antecipada: paga o bônus da onda atual agora, mais um extra
    if (this.phase === 'wave' && this.wave > this.paidThrough) {
      const bonus = this.waveBonus(this.wave + 1);
      const early = Math.round(bonus * 0.25);
      this.gain(bonus + early);
      this.paidThrough = this.wave;
      this.payWaveIncome();
      this.checkCapsule(this.wave + 1);
      this.toast(`Onda antecipada: +${bonus + early} créditos`, 'ok');
    }
    this.wave++;
    const def = this.config.getWave(this.wave);
    const pathCount = this.paths.length;
    for (const g of def.groups) {
      for (let i = 0; i < g.count; i++) {
        const path = g.path !== null ? Math.min(g.path, pathCount - 1) : this.pathRR++ % pathCount;
        this.queue.push({ t: this.waveTime + g.at + i * g.gap, enemy: g.enemy, path, hp: g.hp });
      }
    }
    this.queue.sort((a, b) => a.t - b.t);
    this.phase = 'wave';
    this.sfx('wave');
    if (def.groups.some((g) => ENEMIES[g.enemy].boss)) {
      const boss = def.groups.find((g) => ENEMIES[g.enemy].boss)!;
      this.toast(`Chefe se aproximando: ${ENEMIES[boss.enemy].name}`, 'boss');
      this.sfx('boss');
    }
    this.bump();
    return { ok: true };
  }

  setSpeed(s: 1 | 2 | 3): void {
    this.speed = s;
    this.bump();
  }

  setPaused(p: boolean): void {
    this.paused = p;
    this.bump();
  }

  setAutoStart(on: boolean): void {
    this.autoStart = on;
    if (on && this.phase === 'prep') this.prepTimer = 3;
    this.bump();
  }

  /* ------------------------------------------------------------------ */
  /* Ondas e inimigos                                                    */
  /* ------------------------------------------------------------------ */

  private spawn(dt: number): void {
    if (this.phase !== 'wave') return;
    this.waveTime += dt;
    while (this.queue.length && this.queue[0].t <= this.waveTime) {
      const s = this.queue.shift()!;
      this.spawnEnemy(s.enemy, s.path, 0, s.hp);
    }
  }

  /**
   * Multiplicador de vida da onda atual: a fase começa em ~35% (Impossível: 10%) do seu acréscimo de dificuldade
   * (`hpScale`) e chega a 100% na última onda — a dificuldade cresce dentro da fase.
   */
  waveHpMul(wave = this.wave): number {
    const extra = this.config.stage.hpScale - 1;
    const n = this.totalWaves;
    const prog = Number.isFinite(n) && n > 1 ? Math.max(0, wave) / (n - 1) : 1;
    const start = this.config.rampStart ?? 0.35;
    return 1 + extra * (start + (1 - start) * prog);
  }

  spawnEnemy(id: EnemyId, path: number, d: number, hpMul = 1): EnemyInst {
    const def = ENEMIES[id];
    // chefes acompanham a rampa da fase de forma amortecida (expoente 0,75)
    const ramp = this.waveHpMul();
    const mul = (def.boss ? Math.pow(ramp, 0.75) : ramp) * hpMul;
    // dificuldade: aplicada sobre os valores-base (não se acumula com a rampa da fase)
    const hp = def.hp * (this.config.enemyHp ?? 1) * mul;
    // a recompensa acompanha metade do aumento de vida da fase, para a economia não estagnar
    const rewardMul = Math.min(def.boss ? 2 : 3, 1 + (mul - 1) * 0.5);
    const e: EnemyInst = {
      uid: this.uidSeq++,
      def,
      reward: Math.round(def.reward * rewardMul),
      hp,
      maxHp: hp,
      shield: 0,
      armor: def.armor,
      path,
      d,
      x: 0,
      y: 0,
      angle: 0,
      order: this.orderSeq++,
      routeProgress: 0,
      alive: true,
      slowUntil: 0,
      slowAmt: 0,
      zoneSlow: 0,
      stunUntil: 0,
      vulnUntil: 0,
      rlTime: 0,
      inZone: false,
      magTaken: 0,
      tA: 0,
      tB: 0,
      phase: 0,
      toggled: false,
      flash: 0,
      pend: 0,
      pendAt: 0,
      spawnedHalf: false,
      speed: def.speed * (this.config.enemySpeed ?? 1),
      bornAt: this.time,
      heat: 0,
      heatCoef: 0,
      heatT: 0,
      heatTick: 0,
      heatSrc: -1,
      lastHit: this.time,
      res: 0,
      resBy: -1,
      resLast: -10,
      canOpen: !!def.behavior.openCycle,
      open: false,
      openT: 0,
      clampUntil: 0,
      erMul: 1,
      erT: 0,
      erSeq: 0,
      boostUntil: 0,
      boostAmt: 0,
      tC: 0,
      meissner: 0,
      ion: 0,
      ionCoef: 0,
      ionT: 0,
      ionTick: 0,
      ionSrc: -1,
      diel: 0,
      dielUntil: 0,
      charge: 0,
      forwardUntil: 0,
      satFill: 0,
      satUntil: 0,
      tD: 0,
      jamUntil: 0,
      annih: 0,
      annihAt: 0,
    };
    this.moveTo(e, d);
    this.enemies.push(e);
    return e;
  }

  /** Tipo de dano contra o qual a Sobretensão está protegida agora (null = nenhum). */
  immuneType(e: EnemyInst): DamageType | null {
    const c = e.def.behavior.cycleImmune;
    if (!c || this.time < e.clampUntil) return null;
    return c.types[Math.floor((this.time - e.bornAt) / c.every) % c.types.length];
  }

  inResonantZone(e: EnemyInst): boolean {
    const z = this.resonantZones[e.path];
    if (!z || !z.length) return false;
    return z.some(([a, b]) => e.d >= a && e.d <= b);
  }

  private updateEnemies(dt: number): void {
    const t = this.time;
    const supers = this.units.filter((u) => u.def.behavior === 'super' && t >= u.stunUntil);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const b = e.def.behavior;
      let factor = 1;

      if (b.pulseEvery) {
        e.tA += dt;
        if (e.tA >= b.pulseEvery) {
          e.tA = 0;
          this.emp(e.x, e.y, b.pulseRadius!, b.pulseStun!, b.pulseStun!, '#e05fd0');
        }
      }
      if (b.toggleEvery) {
        e.tA += dt;
        if (e.tA >= b.toggleEvery) {
          e.tA = 0;
          e.toggled = !e.toggled;
        }
        factor *= e.toggled ? b.fastFactor! : b.slowFactor!;
      }
      if (b.dashEvery) {
        e.tA += dt;
        if (e.tA >= b.dashEvery) {
          if (t < e.stunUntil) {
            e.tA = b.dashEvery - 0.6; // interrupção adia o salto
          } else {
            e.tA = 0;
            const fromX = e.x;
            const fromY = e.y;
            this.moveTo(e, e.d + b.dashDistance!);
            this.addFx({ kind: 'dash', x: fromX, y: fromY, x2: e.x, y2: e.y, r: 0, dur: 0.5, color: e.def.color });
            this.sfx('zap');
            this.criticalHeat(e.x, e.y, 'Arco Elétrico');
          }
        }
      }
      if (b.spawnEvery) {
        e.tB += dt;
        if (e.tB >= b.spawnEvery) {
          e.tB = 0;
          for (let i = 0; i < b.spawnCount!; i++) this.spawnEnemy(b.spawnId!, e.path, Math.max(0, e.d - 14 - i * 16), 1);
        }
        if (e.def.id === 'cascata' && !e.spawnedHalf && e.hp <= e.maxHp / 2) {
          e.spawnedHalf = true;
          for (let i = 0; i < 4; i++) this.spawnEnemy('surto', e.path, Math.max(0, e.d - 10 - i * 14), 1);
          this.toast('A Falha em Cascata liberou surtos!', 'warn');
        }
      }
      if (b.phases && e.phase < b.phases.length && e.hp / e.maxHp <= b.phases[e.phase]) {
        const actions = b.phaseActions?.[e.phase] ?? ['emp', 'shield'];
        e.phase++;
        this.phaseActions(e, actions);
      }
      // 1.1 ----------------------------------------------------------
      if (b.harmonic) {
        e.tC += dt;
        if (e.tC >= b.harmonic.every) {
          e.tC = 0;
          const h = b.harmonic;
          for (const o of this.enemies) {
            if (!o.alive || (o.x - e.x) ** 2 + (o.y - e.y) ** 2 > h.radius * h.radius) continue;
            o.boostUntil = t + h.dur;
            o.boostAmt = h.boost;
          }
          this.addFx({ kind: 'wave', x: e.x, y: e.y, r: h.radius, dur: 0.9, color: e.def.color });
          this.sfx('emp');
        }
      }
      /* ---------------- 1.2 — §4: mecânicas dos inimigos novos ---------------- */

      // Supercapacitor Instável: acumula carga (vira escudo) ao longo do percurso
      if (b.accumulate && e.charge < b.accumulate.max) {
        e.charge = Math.min(b.accumulate.max, e.charge + b.accumulate.rate * dt);
        e.shield = Math.max(e.shield, e.charge * e.maxHp);
      }
      // Arco Voltaico / Singularidade: descargas de contato desativam unidades próximas
      if (b.contact) {
        e.tD += dt;
        if (e.tD >= b.contact.every) {
          e.tD = 0;
          this.emp(e.x, e.y, b.contact.radius, b.contact.stun, b.contact.stun * 0.4, e.def.color);
          this.criticalHeat(e.x, e.y, e.def.name);
        }
      }
      // Oscilador Parasita: interferência periódica na cadência (a contínua vai em computeBuffs)
      if (b.jam?.every) {
        e.tD += dt;
        if (e.tD >= b.jam.every) {
          e.tD = 0;
          e.jamUntil = t + (b.jam.dur ?? 2);
          this.addFx({ kind: 'wave', x: e.x, y: e.y, r: b.jam.radius, dur: 0.7, color: e.def.color });
          this.sfxSoft('emp');
        }
      }
      // Saturação Profunda: o medidor escoa devagar quando não está sendo preenchido
      if (b.satMeter && t >= e.satUntil && e.satFill > 0) e.satFill = Math.max(0, e.satFill - b.satMeter.need * 0.04 * dt);

      // §13: aniquilação eletromagnética
      if (b.annihilate) this.annihilation(e, b.annihilate, dt);

      if (e.canOpen) {
        const oc = b.openCycle ?? { every: 3.2, open: 1.4 };
        e.openT += dt;
        e.open = e.openT % oc.every >= oc.every - oc.open;
      }
      if (b.regen && e.heat <= 0 && t - e.lastHit >= b.regen.delay && e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + b.regen.rate * e.maxHp * dt);
      }
      if (b.decay) e.hp = Math.max(Math.min(e.hp, e.maxHp * 0.15), e.hp - b.decay * e.maxHp * dt);
      if (b.erratic) {
        e.erT += dt;
        if (e.erT >= b.erratic.every) {
          e.erT = 0;
          e.erSeq++;
          e.erMul = b.erratic.min + (b.erratic.max - b.erratic.min) * hash01(e.uid, e.erSeq, 3);
        }
        factor *= e.erMul;
      }
      if (e.heat > 0) {
        e.heatTick += dt;
        if (e.heatTick >= HEAT_TICK) {
          e.heatTick -= HEAT_TICK;
          const src = this.unit(e.heatSrc) ?? null;
          // 1.2: o Efeito Joule reduz o dano contínuo (aplicado uma única vez, aqui)
          this.hit(e, e.heatCoef * e.heat * e.heat * HEAT_TICK * this.thermalMul(), 'termico', src, true);
        }
        e.heatT += dt;
        if (e.heatT >= HEAT_DECAY) {
          e.heatT = 0;
          e.heat = Math.max(0, e.heat - 1);
        }
        if (!e.alive) continue;
      }
      // 1.2: ionização do plasma — dano contínuo de k·n² (tipo descarga), ignora blindagem
      if (e.ion > 0) {
        e.ionTick += dt;
        if (e.ionTick >= ION_TICK) {
          e.ionTick -= ION_TICK;
          const src = this.unit(e.ionSrc) ?? null;
          this.hit(e, e.ionCoef * e.ion * e.ion * ION_TICK * this.thermalMul(), 'descarga', src, true);
        }
        e.ionT += dt;
        if (e.ionT >= ION_DECAY) {
          e.ionT = 0;
          e.ion = Math.max(0, e.ion - 1);
        }
        if (!e.alive) continue;
        // gás ionizado é mais denso de atravessar: desacelera enquanto durar
        e.zoneSlow = Math.max(e.zoneSlow, Math.min(0.3, 0.05 * e.ion));
      }

      // Efeito Meissner (supercondutor): desacelera e anula acelerações
      e.meissner = 0;
      for (const s of supers) {
        if ((s.x - e.x) ** 2 + (s.y - e.y) ** 2 <= s.stats.meissner * s.stats.meissner) e.meissner = Math.max(e.meissner, s.stats.meissnerSlow);
      }
      if (t < e.boostUntil && !e.meissner) factor *= 1 + e.boostAmt;
      // 1.2 — §11: Sobretensão periódica acelera todos os inimigos durante a janela
      if (!e.meissner && this.modActive('sobretensao_periodica')) factor *= 1.35;
      const resonant = this.inResonantZone(e);
      if (resonant && !e.meissner) factor *= 1.35;
      if (e.meissner && factor > 1) factor = 1;

      // Movimento
      const immune = !!b.controlImmune;
      let speed = e.speed * factor;
      // §13.1: durante o carregamento da aniquilação o chefe fica parado
      if (e.annih === 1) speed = 0;
      // §4: Saturação Profunda — o magnético que não fere, desacelera
      if (b.satMeter && e.satFill > 0 && t >= e.satUntil) speed *= 1 - Math.min(0.45, (e.satFill / b.satMeter.need) * 0.45);
      if (!immune) {
        if (t < e.stunUntil) speed = 0;
        else {
          let slow = Math.max(t < e.slowUntil ? e.slowAmt : 0, e.zoneSlow, e.meissner);
          if (resonant || t < e.boostUntil) slow *= 0.5;
          speed *= 1 - slow;
        }
      } else if (e.meissner) {
        speed *= 1 - e.meissner * 0.5;
      }
      e.zoneSlow = 0;
      if (!e.inZone) e.rlTime = Math.max(0, e.rlTime - dt * 2);
      e.inZone = false;
      const advanced = e.d + speed * dt;
      e.flash = Math.max(0, e.flash - dt);

      const path = this.paths[e.path];
      if (advanced >= path.length) {
        e.d = path.length;
        e.routeProgress = 1;
        e.alive = false;
        this.leak(e);
        continue;
      }
      this.moveTo(e, advanced);

      if (this.showDamage && e.pend >= 1 && t - e.pendAt >= 0.4) {
        this.addFx({ kind: 'text', x: e.x, y: e.y - e.def.radius - 4, r: 0, dur: 0.7, color: '#e4ebf3', text: String(Math.round(e.pend)) });
        e.pend = 0;
        e.pendAt = t;
      }
    }
  }

  /**
   * §13.1 — Aniquilação eletromagnética do chefe final do Impossível.
   *
   * Sequência: detecta os 25% da vida máxima → interrompe a movimentação → carrega por
   * `charge` s com efeitos de concentração de energia e aviso global → executa a explosão →
   * remove TODAS as unidades posicionadas → retoma o comportamento normal.
   *
   * Acontece uma única vez por chefe (`annih` vai de 0 a 2 e não volta). Nenhuma unidade
   * sobrevive por imunidade ou proteção convencional: a remoção é centralizada em
   * `annihilateUnits`, que também zera as referências que apontavam para elas.
   */
  private annihilation(e: EnemyInst, cfg: { at: number; charge: number }, dt: number): void {
    void dt;
    const t = this.time;
    if (e.annih === 0 && e.hp / e.maxHp <= cfg.at) {
      e.annih = 1;
      e.annihAt = t + cfg.charge;
      this.addFx({ kind: 'quench', x: e.x, y: e.y, r: 240, dur: cfg.charge, color: e.def.color });
      this.addFx({ kind: 'text', x: e.x, y: e.y - e.def.radius - 26, r: 0, dur: cfg.charge, color: '#ffffff', text: 'CARREGANDO…' });
      this.toast(`${e.def.name}: descarga eletromagnética iminente — TODAS as unidades serão destruídas!`, 'boss');
      this.sfx('boss');
      return;
    }
    if (e.annih === 1) {
      // concentração de energia: anéis convergindo durante o carregamento
      if (Math.floor(t * 6) !== Math.floor((t - STEP) * 6)) {
        const k = Math.max(0, (e.annihAt - t) / cfg.charge);
        this.addFx({ kind: 'ring', x: e.x, y: e.y, r: 60 + 220 * k, dur: 0.35, color: e.def.color });
      }
      if (t >= e.annihAt) {
        e.annih = 2;
        this.annihilateUnits(e);
      }
    }
  }

  /**
   * Remoção centralizada e segura de TODAS as unidades posicionadas (§13.1).
   * Nenhum crédito é devolvido: é uma falha catastrófica, não uma venda. Depois da remoção
   * não sobra nenhuma referência pendente (auras, retificadores, alvos e habilidades são
   * recalculados do zero no próximo passo, porque dependem apenas de `this.units`).
   */
  private annihilateUnits(e: EnemyInst): void {
    const lost = this.units.length;
    this.addFx({ kind: 'emp', x: e.x, y: e.y, r: 1400, dur: 1.1, color: '#ffffff' });
    for (const u of this.units) {
      this.addFx({ kind: 'death', x: u.x, y: u.y, r: 34, dur: 0.6, color: u.def.color });
    }
    // a lista é substituída de uma vez: nada de remoção parcial durante a iteração
    this.units = [];
    this.stats.annihilated += lost;
    this.stats.unitsLostToBoss = Math.max(this.stats.unitsLostToBoss, lost);

    /*
     * Descarga total = energia esgotada. O chefe gastou de uma vez tudo o que havia nos
     * barramentos e capacitores, então fica em recuperação: paralisado por um instante e
     * vulnerável por uma janela, antes de retomar o comportamento normal (§13.1, passo 9).
     *
     * Essa janela é o que torna a mecânica justa em vez de uma derrota garantida: é o tempo
     * de reconstruir a defesa com os créditos guardados. Sem ela, nenhuma composição
     * verificada conseguia fechar os 25% restantes — ver o relatório do patch.
     */
    e.stunUntil = Math.max(e.stunUntil, this.time + ANNIHILATION_RECOVERY);
    e.vulnUntil = Math.max(e.vulnUntil, this.time + ANNIHILATION_WINDOW);
    e.shield = 0;

    this.sfx('emp');
    this.sfx('lose');
    if (lost > 0) {
      this.toast(`Aniquilação eletromagnética: ${lost} unidade(s) destruída(s)!`, 'boss');
      this.toast(`O chefe esgotou a energia: ${ANNIHILATION_RECOVERY} s paralisado e vulnerável. Reconstrua AGORA.`, 'ok');
    }
    this.bump();
  }

  private phaseActions(e: EnemyInst, actions: PhaseAction[]): void {
    for (const a of actions) {
      switch (a) {
        case 'emp':
          this.emp(e.x, e.y, 260, 3, 0.9, '#ff3d6e');
          break;
        case 'shield':
          e.shield += e.maxHp * 0.12;
          break;
        case 'blackout':
          this.incomeHaltUntil = this.time + 8;
          this.toast('Rejeição de carga! Fontes e retificadores param por 8 s.', 'boss');
          break;
        case 'spawnFuga':
          for (let i = 0; i < 4; i++) this.spawnEnemy('fuga', e.path, Math.max(0, e.d - 12 - i * 16), 1);
          this.toast('O chefe liberou Fugas de Corrente!', 'warn');
          break;
        case 'spawnTrans':
          for (let i = 0; i < 4; i++) this.spawnEnemy('transiente', e.path, Math.max(0, e.d - 8 - i * 12), 1);
          this.toast('Transientes liberados!', 'warn');
          break;
        case 'open':
          e.canOpen = true;
          this.toast('Circuito aberto: só dano magnético atinge o chefe quando ele abre!', 'boss');
          break;
      }
    }
    if (actions.includes('emp') || actions.includes('shield')) this.toast(`${e.def.name}: mudança de fase!`, 'boss');
  }

  /** Pulso que desativa unidades: `stun` normal, `stunProtected` para unidades protegidas/isoladas. */
  private emp(x: number, y: number, radius: number, stun: number, stunProtected: number, color: string): void {
    const isFullImmunity = stunProtected === stun; // interferência: proteção dá imunidade total
    for (const u of this.units) {
      if ((u.x - x) ** 2 + (u.y - y) ** 2 > radius * radius) continue;
      const shielded = u.buff.protected || u.entry.trait === 'isolamento';
      if (shielded && isFullImmunity) continue;
      const dur = shielded ? (u.entry.trait === 'isolamento' && u.buff.protected ? stunProtected * 0.6 : stunProtected) : stun;
      u.stunUntil = Math.max(u.stunUntil, this.time + dur);
    }
    this.addFx({ kind: 'emp', x, y, r: radius, dur: 0.6, color });
    this.sfx('emp');
  }

  /** Temperatura crítica do supercondutor: calor/arco próximo provoca quench involuntário. */
  private criticalHeat(x: number, y: number, cause: string): void {
    for (const u of this.units) {
      if (u.def.behavior !== 'super' || u.buff.protected || this.time < u.stunUntil) continue;
      if ((u.x - x) ** 2 + (u.y - y) ** 2 > 70 * 70) continue;
      u.ramp = 0;
      u.stunUntil = this.time + 3;
      this.addFx({ kind: 'quench', x: u.x, y: u.y, r: 40, dur: 0.6, color: '#ff5f5f' });
      this.toast(`${cause} aqueceu o supercondutor: quench involuntário (3 s).`, 'warn');
    }
  }

  private leak(e: EnemyInst): void {
    const lost = Math.min(this.lives, e.def.leak);
    this.lives -= lost;
    this.stats.leaks += lost;
    const core = this.map.core;
    this.addFx({ kind: 'leak', x: core.x, y: core.y, r: 40, dur: 0.6, color: '#ff5f5f' });
    this.sfx('leak');
    if (this.lives <= 0) this.finish(false);
  }

  private cleanup(): void {
    if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);
    if (this.fx.length) this.fx = this.fx.filter((f) => this.time - f.t < f.dur);
  }

  /** Fonte síncrona com PFC: reserva entregue ao fim de cada onda. */
  private payWaveIncome(): void {
    const mul = this.incomeMul();
    for (const u of this.units) {
      if (u.stats.waveIncome <= 0) continue;
      const amount = Math.round(u.stats.waveIncome * mul);
      if (amount <= 0) continue;
      this.gain(amount);
      u.earned += amount;
      this.stats.fonteIncome += amount;
      this.addFx({ kind: 'text', x: u.x, y: u.y - 22, r: 0, dur: 1.2, color: '#39d08a', text: `PFC +${amount}` });
    }
  }

  /** Cápsula energética (modo infinito): uma única verificação por marco de 5 ondas. */
  private checkCapsule(n: number): void {
    if (!this.config.capsules || !isCapsuleMilestone(n) || this.capsuleChecked.has(n)) return;
    this.capsuleChecked.add(n);
    const roll = rollCapsule(n, this.rand);
    this.stats.capsules.push(roll);
    if (roll.got) this.sfx('capsule');
    this.onEvent?.({ type: 'capsule', roll });
  }

  private checkWave(): void {
    if (this.phase !== 'wave' || this.queue.length || this.enemies.length) return;
    if (this.wave > this.paidThrough) {
      const bonus = this.waveBonus(this.wave + 1);
      this.gain(bonus);
      this.paidThrough = this.wave;
      this.payWaveIncome();
      const x = Math.min(MAP_W - 90, Math.max(90, this.map.core.x));
      this.addFx({ kind: 'text', x, y: this.map.core.y - 46, r: 0, dur: 1.2, color: '#39d08a', text: `Onda concluída +${bonus}` });
      this.checkCapsule(this.wave + 1);
    }
    if (this.wave + 1 >= this.totalWaves) {
      this.finish(true);
      return;
    }
    this.phase = 'prep';
    this.prepTimer = 4;
    this.bump();
  }

  private finish(won: boolean): void {
    if (this.isOver) return;
    this.phase = won ? 'won' : 'lost';
    this.sfx(won ? 'win' : 'lose');
    this.onEvent?.({ type: 'end', won });
    this.bump();
  }

  /** Abandono/derrota forçada (não altera o progresso por si só). */
  forfeit(): void {
    this.finish(false);
  }

  /* ------------------------------------------------------------------ */
  /* Unidades                                                            */
  /* ------------------------------------------------------------------ */

  /** Transistor saturado (estágios no máximo ou polarização forçada)? */
  saturated(u: UnitInst): boolean {
    return u.def.behavior === 'amplifier' && (u.stacks >= u.stats.gain || this.time < u.abilityUntil);
  }

  private computeBuffs(): void {
    const t = this.time;
    for (const u of this.units) {
      u.buff = freshBuff();
      u.links = [];
    }
    const bestRect = new Map<number, number>();
    for (const src of this.units) {
      if (t < src.stunUntil) continue;
      const s = src.stats;
      if (s.aura <= 0) continue;
      const id = src.def.id;
      if (src.def.behavior === 'amplifier' && !this.saturated(src)) continue;
      const boost = id === 'transformador' && t < src.abilityUntil ? 0.45 : 0;
      const timerHigh = src.def.behavior === 'timer' && src.high;
      if (src.def.behavior === 'timer' && !timerHigh) continue;
      // 1.2: o cristal só concede cadência durante o nível alto do seu clock
      if (src.def.behavior === 'crystal' && !src.high) continue;
      // 1.2: o transformador de potência escala com as unidades conectadas; o amp. op.
      // dobra a aura quando está saturado (clipping)
      const gridBonus = src.def.behavior === 'grid' ? this.gridBonus(src) : 0;
      const opampMul = src.def.behavior === 'opamp' && this.clipping(src) ? 2 : 1;
      for (const dst of this.units) {
        const self = dst === src;
        if ((dst.x - src.x) ** 2 + (dst.y - src.y) ** 2 > s.aura * s.aura) continue;
        let applied = false;
        if (id === 'diodo') {
          dst.buff.protected = true;
          dst.buff.dmg += s.auraDamage;
          applied = !self;
        } else if (self) {
          continue;
        } else if (id === 'fonte') {
          if (dst.def.behavior === 'capacitor') {
            dst.buff.powered = true;
            applied = true;
          }
        } else if (id === 'retificador') {
          dst.buff.filtered = true;
          if (dst.def.behavior !== 'income' && dst.def.behavior !== 'aura' && dst.def.behavior !== 'rectifier') {
            const prev = bestRect.get(dst.uid);
            if (prev === undefined || (this.unit(prev)?.stats.conversion ?? 0) < s.conversion) bestRect.set(dst.uid, src.uid);
            applied = true;
          }
        } else if (src.def.behavior === 'timer') {
          if (ATTACKERS.has(dst.def.behavior) || dst.def.behavior === 'beam' || dst.def.behavior === 'capacitor') {
            const mono = t < src.abilityUntil ? 2 : 1;
            dst.buff.timer = Math.max(dst.buff.timer, s.auraSpeed * mono);
            applied = true;
          }
        } else if (src.def.behavior === 'crystal') {
          // clock de referência: cadência para quem ataca, enquanto o nível está alto
          if (ATTACKERS.has(dst.def.behavior) || dst.def.behavior === 'beam' || dst.def.behavior === 'capacitor') {
            const lock = t < src.abilityUntil ? 2 : 1;
            dst.buff.timer = Math.max(dst.buff.timer, s.auraSpeed * lock);
            applied = true;
          }
          // sinergia de temporização: cristal + CI 555 se reforçam
          if (dst.def.behavior === 'timer') {
            dst.buff.speed += 0.15;
            applied = true;
          }
        } else if (dst.def.behavior !== 'income' && dst.def.behavior !== 'aura' && dst.def.behavior !== 'rectifier' && dst.def.behavior !== 'timer') {
          dst.buff.speed += s.auraSpeed;
          // 1.2: grid soma o bônus por conexão; o amp. op. saturado dobra a amplificação
          dst.buff.dmg += (s.auraDamage + boost + gridBonus) * opampMul;
          dst.buff.range += s.auraRange;
          if (boost || gridBonus > 0) dst.buff.boosted = true;
          applied = true;
        }
        if (applied) dst.links.push(src.uid);
      }
    }
    for (const [uid, r] of bestRect) {
      const u = this.unit(uid);
      if (u) u.buff.rect = r;
    }
    for (const u of this.units) {
      u.buff.speed = Math.min(0.6, u.buff.speed + u.buff.timer);
      u.buff.dmg = Math.min(1.5, u.buff.dmg);
      u.buff.range = Math.min(0.3, u.buff.range);
    }
    this.computeSynergies();
    for (const e of this.enemies) {
      const b = e.def.behavior;
      if (!e.alive) continue;
      if (b.noiseRadius) {
        for (const u of this.units) {
          if (u.buff.protected || u.entry.trait === 'isolamento') continue;
          if ((u.x - e.x) ** 2 + (u.y - e.y) ** 2 <= b.noiseRadius * b.noiseRadius) {
            const n = u.buff.filtered ? b.noise! / 2 : b.noise!;
            u.buff.noise = Math.max(u.buff.noise, n);
          }
        }
      }
      if (b.rangeAura) {
        const r = b.rangeAura.radius;
        for (const u of this.units) {
          if (u.buff.protected || u.entry.trait === 'isolamento') continue;
          if ((u.x - e.x) ** 2 + (u.y - e.y) ** 2 <= r * r) u.buff.emi = Math.max(u.buff.emi, b.rangeAura.amount);
        }
      }
      if (b.brownout) {
        const r = b.brownout.radius;
        for (const u of this.units) {
          if ((u.x - e.x) ** 2 + (u.y - e.y) ** 2 <= r * r) u.buff.brownout = Math.max(u.buff.brownout, u.buff.protected ? b.brownout.amount / 2 : b.brownout.amount);
        }
      }
      // 1.2 — §4.2/§4.8: interferência na cadência (contínua ou periódica, tratada igual aqui)
      if (b.jam) {
        const active = b.jam.every ? t < e.jamUntil : true;
        if (active) {
          const r = b.jam.radius;
          for (const u of this.units) {
            if (u.buff.protected || u.entry.trait === 'isolamento') continue;
            if ((u.x - e.x) ** 2 + (u.y - e.y) ** 2 > r * r) continue;
            const amount = u.buff.filtered ? b.jam.amount / 2 : b.jam.amount;
            u.buff.noise = Math.max(u.buff.noise, amount);
          }
        }
      }
    }
    this.applyModifiers();
  }

  private computeSynergies(): void {
    const t = this.time;
    for (const syn of SYNERGIES) {
      for (const src of this.units) {
        if (!syn.source.includes(src.def.id) || t < src.stunUntil) continue;
        if (syn.id === 'sincronismo' && !src.high) continue;
        const r = syn.range === 'aura' ? src.stats.aura : syn.range;
        if (r <= 0) continue;
        for (const dst of this.units) {
          if (dst === src || !syn.target.includes(dst.def.id) || dst.buff.syn.includes(syn.id)) continue;
          // filtro LC: a fonte da sinergia precisa ser o “outro” componente do par
          if (syn.id === 'filtroLC' && src.def.id === dst.def.id) continue;
          if ((dst.x - src.x) ** 2 + (dst.y - src.y) ** 2 > r * r) continue;
          dst.buff.syn.push(syn.id);
          if (!dst.links.includes(src.uid)) dst.links.push(src.uid);
        }
      }
    }
  }

  has(u: UnitInst, s: SynergyId): boolean {
    return u.buff.syn.includes(s);
  }

  /**
   * 1.2 — §3.3: bônus por carga conectada do Transformador de Potência. Conta quantas
   * unidades estão na área (até `linkMax`) e devolve `perLink` por conexão. Durante a
   * habilidade, conta como se estivesse no máximo. O resultado é guardado em `linked` para
   * a interface mostrar a evolução da malha.
   */
  gridBonus(src: UnitInst): number {
    const r = src.stats.aura;
    let n = 0;
    for (const o of this.units) {
      if (o === src || (o.x - src.x) ** 2 + (o.y - src.y) ** 2 > r * r) continue;
      n++;
    }
    const capped = Math.min(src.stats.linkMax, n);
    src.linked = capped;
    const effective = this.time < src.abilityUntil ? src.stats.linkMax : capped;
    return src.stats.perLink * effective;
  }

  /** Fase do ciclo da característica Sobrecarga controlada: 'boost' | 'cool' | null. */
  overloadState(u: UnitInst): 'boost' | 'cool' | null {
    if (u.entry.trait !== 'sobrecarga') return null;
    const c = (this.time - u.placedAt) % 14;
    return c < 4 ? 'boost' : c < 7 ? 'cool' : null;
  }

  speedMul(u: UnitInst): number {
    const ov = this.overloadState(u) === 'cool' ? 0.8 : 1;
    const hot = this.time < u.overheatUntil ? 0.6 : 1;
    return (1 + u.buff.speed) * (1 - u.buff.noise) * ov * u.buff.pSpeed * hot;
  }

  dmgMul(u: UnitInst): number {
    // 1.2: buff de dano em componentes com bobina protegidos por diodo: 10% → 15%
    const inductive = u.buff.protected && INDUCTIVE_UNITS.includes(u.def.id) ? INDUCTIVE_PROTECT_BONUS : 0;
    const ov = this.overloadState(u) === 'boost' ? 0.4 : 0;
    const lc = u.def.behavior === 'capacitor' && this.has(u, 'filtroLC') ? 0.1 : 0;
    return (1 + u.buff.dmg + inductive + ov + lc) * u.buff.pDmg * (1 - u.buff.brownout);
  }

  rangeOf(u: UnitInst): number {
    return u.stats.range * (1 + u.buff.range) * u.buff.pRange * (1 - u.buff.emi);
  }

  /* ------------------------------------------------------------------ */
  /* 1.2 — §6: fonte única dos atributos exibidos                        */
  /* ------------------------------------------------------------------ */

  /**
   * Decomposição completa dos atributos de uma unidade.
   *
   * REGRA CENTRAL: os valores finais aqui são calculados pelas MESMAS funções que o combate
   * usa (`dmgMul`, `speedMul`, `rangeOf`) e pela mesma fórmula de DPS (`dpsEstimate`). Não
   * existe um segundo cálculo “para a interface” — por construção, o número exibido é o
   * número usado. Por isso `finalDamage` é literalmente `stats.damage × dmgMul(u)`, a
   * expressão que aparece em `actBolt`, `actPulse` e nos demais comportamentos.
   *
   * A lista de fontes é só descritiva (serve para explicar de onde vem o multiplicador);
   * ela nunca participa da conta.
   */
  breakdown(u: UnitInst): StatBreakdown {
    const def = u.def;
    const base = def.base;
    const leveled = u.stats;
    const sources: StatSource[] = [];

    // --- origem dos modificadores de dano (descritivo) ---
    if (u.buff.dmg > 0.0001) sources.push({ code: 'ATK', kind: 'buff', label: 'Auras de dano', value: `+${fmtPct(u.buff.dmg)}`, detail: this.auraSourceNames(u) });
    if (u.buff.protected && INDUCTIVE_UNITS.includes(def.id)) {
      sources.push({ code: 'ATK', kind: 'buff', label: 'Diodo de flyback', value: `+${fmtPct(INDUCTIVE_PROTECT_BONUS)}`, detail: 'Componente com bobina protegido por diodo' });
    }
    const ov = this.overloadState(u);
    if (ov === 'boost') sources.push({ code: 'OVERLOAD', kind: 'buff', label: 'Sobrecarga controlada', value: '+40%', detail: 'Característica da unidade' });
    if (ov === 'cool') sources.push({ code: 'SPD', kind: 'debuff', label: 'Resfriamento', value: '−20%', detail: 'Característica Sobrecarga controlada' });
    if (def.behavior === 'capacitor' && this.has(u, 'filtroLC')) sources.push({ code: 'ATK', kind: 'syn', label: 'Filtro LC', value: '+10%', detail: 'Indutor próximo' });
    if (u.buff.brownout > 0) sources.push({ code: 'VULN', kind: 'debuff', label: 'Subtensão', value: `−${fmtPct(u.buff.brownout)}`, detail: 'Chefe por perto' });
    if (u.buff.noise > 0) sources.push({ code: 'SPD', kind: 'debuff', label: 'Ruído / interferência', value: `−${fmtPct(u.buff.noise)}`, detail: 'Inimigo próximo' });
    if (u.buff.emi > 0) sources.push({ code: 'RNG', kind: 'debuff', label: 'EMI irradiada', value: `−${fmtPct(u.buff.emi)}`, detail: 'Inimigo próximo' });
    if (u.buff.speed > 0.0001) sources.push({ code: 'SPD', kind: 'buff', label: 'Auras de cadência', value: `+${fmtPct(u.buff.speed)}`, detail: this.auraSourceNames(u) });
    if (u.buff.range > 0.0001) sources.push({ code: 'RNG', kind: 'buff', label: 'Auras de alcance', value: `+${fmtPct(u.buff.range)}`, detail: this.auraSourceNames(u) });
    if (this.time < u.overheatUntil) sources.push({ code: 'BURN', kind: 'debuff', label: 'Superaquecida', value: '−40% de cadência', detail: 'Curto-Circuito Franco' });
    for (const m of u.buff.mods) {
      const d = MODIFIERS[m];
      sources.push({ code: d.code, kind: 'mod', label: d.name, value: d.math, detail: d.tech });
    }
    for (const s of u.buff.syn) sources.push({ code: 'ATK', kind: 'syn', label: SYNERGIES.find((x) => x.id === s)!.name, value: 'sinergia ativa', detail: SYNERGY_BY_ID[s].effect });

    // --- valores finais: exatamente os do combate ---
    const damageMul = this.dmgMul(u);
    const speedMul = this.speedMul(u);
    const range = this.rangeOf(u);

    // atributos efetivos: a mesma estrutura que o combate lê, com os modificadores aplicados
    const effective: UnitStats = {
      ...leveled,
      damage: leveled.damage * damageMul,
      interval: speedMul > 0 ? leveled.interval / speedMul : Infinity,
      tau: speedMul > 0 ? leveled.tau / speedMul : Infinity,
      range,
    };

    return {
      baseDamage: base.damage,
      leveledDamage: leveled.damage,
      damageMul,
      finalDamage: leveled.damage * damageMul,
      baseInterval: base.interval,
      leveledInterval: leveled.interval,
      speedMul,
      finalInterval: effective.interval,
      baseRange: base.range,
      leveledRange: leveled.range,
      finalRange: range,
      targets: leveled.targets,
      // DPS real: mesma fórmula do comparativo, alimentada com os atributos efetivos
      dps: dpsEstimate(u.entry, effective),
      sources,
      effective,
    };
  }

  /** Nomes das unidades que estão aplicando aura/sinergia nesta (para os tooltips). */
  private auraSourceNames(u: UnitInst): string {
    const nomes = u.links
      .map((uid) => this.unit(uid)?.def.short)
      .filter((x): x is string => !!x);
    return [...new Set(nomes)].join(', ') || '—';
  }

  private updateUnit(u: UnitInst, dt: number): void {
    const t = this.time;
    u.abilityCd = Math.max(0, u.abilityCd - dt);
    if (u.salvoQ.length) this.processSalvo(u);
    if (t < u.stunUntil) {
      if (u.def.behavior === 'beam') u.ramp *= Math.exp(-dt / 0.3);
      if (u.def.behavior === 'timer') u.high = false;
      return;
    }
    const sp = this.speedMul(u);
    switch (u.def.behavior) {
      case 'bolt':
        return this.actBolt(u, dt, sp);
      case 'pulse':
        return this.actPulse(u, dt, sp);
      case 'beam':
        return this.actBeam(u, dt, sp);
      case 'capacitor':
        return this.actCapacitor(u, dt, sp);
      case 'zone':
        return this.actZone(u, dt);
      case 'income':
        return this.actIncome(u, dt, sp);
      case 'amplifier':
        return this.actAmplifier(u, dt, sp);
      case 'heat':
        return this.actHeat(u, dt, sp);
      case 'wave':
        return this.actWave(u, dt, sp);
      case 'rectifier':
        return this.actRectifier(u, dt);
      case 'timer':
        return this.actTimer(u, dt, sp);
      case 'chain':
        return this.actChain(u, dt, sp);
      case 'super':
        return this.actSuper(u, dt, sp);
      /* ---------------- 1.2 ---------------- */
      case 'switching':
        return this.actSwitching(u, dt, sp);
      case 'hv':
        return this.actHv(u, dt, sp);
      case 'grid':
        return this.actGrid(u, dt, sp);
      case 'crystal':
        return this.actCrystal(u, dt, sp);
      case 'opamp':
        return this.actOpamp(u, dt, sp);
      case 'plasma':
        return this.actPlasma(u, dt, sp);
      case 'aura':
        return;
    }
  }

  /* ================================================================== */
  /* 1.2: comportamentos novos                                           */
  /* ================================================================== */

  /**
   * MOSFET — §3.1. A frequência de comutação sobe a cada golpe: o dano cresce (+fswStep por
   * estágio) e o intervalo encurta na mesma proporção. Em troca, as PERDAS DE COMUTAÇÃO
   * crescem com a frequência, então cada golpe aquece o próprio dispositivo; ao passar do
   * limite térmico a unidade entra em derating (cadência reduzida) até esfriar.
   */
  private actSwitching(u: UnitInst, dt: number, sp: number): void {
    const t = this.time;
    const forced = t < u.abilityUntil;
    if (forced) {
      u.fswStage = u.stats.fsw;
      u.selfHeat = 0;
    } else {
      // resfriamento contínuo e queda da frequência quando não há alvo
      u.selfHeat = Math.max(0, u.selfHeat - dt * MOSFET_COOL);
      if (t - u.lastTargetT > 1) u.fswStage = 0;
    }
    const derated = !forced && t < u.deratedUntil;
    u.cd -= dt * sp * (derated ? 1 - MOSFET_DERATE : 1);
    if (u.cd > 0) return;
    const targets = this.pick(u, this.rangeOf(u), u.stats.targets);
    if (!targets.length) {
      u.cd = 0;
      return;
    }
    const stage = u.fswStage;
    const dmg = u.stats.damage * (1 + stage * u.stats.fswStep) * this.dmgMul(u);
    for (const e of targets) {
      this.hit(e, dmg, 'comutacao', u);
      this.addFx({ kind: 'bolt', x: u.x, y: u.y, x2: e.x, y2: e.y, r: 0, dur: 0.1, color: stage >= u.stats.fsw ? '#ffffff' : u.def.color });
      u.aimX = e.x;
      u.aimY = e.y;
    }
    if (!forced) {
      u.fswStage = Math.min(u.stats.fsw, stage + 1);
      // perda de comutação ∝ f: o aquecimento por golpe cresce com o estágio
      u.selfHeat += MOSFET_HEAT_BASE + u.fswStage * MOSFET_HEAT_PER_STAGE;
      if (u.selfHeat >= u.stats.thermal) {
        u.deratedUntil = t + MOSFET_DERATE_DUR;
        u.fswStage = Math.floor(u.fswStage / 2);
        u.selfHeat = u.stats.thermal * 0.5;
        this.addFx({ kind: 'heat', x: u.x, y: u.y - 20, x2: u.x, y2: u.y, r: 0, dur: 0.5, color: '#ff7a59' });
      }
    }
    u.lastTargetT = t;
    u.lastFire = t;
    // o intervalo encurta com a frequência (até metade no estágio máximo)
    u.cd = u.stats.interval / (1 + stage * u.stats.fswStep * 0.5);
    this.sfxSoft('zap');
  }

  /**
   * IGBT — §3.2. Poucos disparos, muito pesados, em área, com bônus contra blindagem: o
   * golpe ignora uma parcela fixa da armadura (`armorPierce`) e ganha `armorBonus` contra
   * inimigos blindados ou chefes.
   */
  private actHv(u: UnitInst, dt: number, sp: number): void {
    const t = this.time;
    if (t < u.recoverUntil) return;
    u.cd -= dt * sp;
    if (u.cd > 0) return;
    const [target] = this.pick(u, this.rangeOf(u), 1);
    if (!target) {
      u.cd = 0;
      return;
    }
    const maxed = t < u.abilityUntil;
    const base = u.stats.damage * this.dmgMul(u) * (maxed ? 2 : 1);
    const r = u.stats.splash * (maxed ? 1.5 : 1);
    const pierce = maxed ? Infinity : u.stats.armorPierce;
    for (const e of this.enemies) {
      if (!e.alive || (e.x - target.x) ** 2 + (e.y - target.y) ** 2 > (r + e.def.radius) ** 2) continue;
      const heavy = e.def.boss || e.armor > 0;
      this.hit(e, base * (heavy ? 1 + u.stats.armorBonus : 1), 'comutacao', u, false, pierce);
    }
    this.stunEnemy(target, u.stats.stun);
    this.addFx({ kind: 'discharge', x: target.x, y: target.y, r, dur: 0.5, color: maxed ? '#ffffff' : u.def.color });
    this.addFx({ kind: 'bolt', x: u.x, y: u.y, x2: target.x, y2: target.y, r: 0, dur: 0.2, color: u.def.color });
    u.aimX = target.x;
    u.aimY = target.y;
    u.lastFire = t;
    u.cd = u.stats.interval;
    this.sfx('discharge');
  }

  /**
   * Transformador de Potência — §3.3. Não ataca: o bônus da aura é calculado em
   * `computeBuffs` (cresce com as unidades conectadas). Aqui só paga a distribuição de
   * energia, dobrada quando há uma fonte ou um retificador na área.
   */
  private actGrid(u: UnitInst, dt: number, sp: number): void {
    if (this.phase !== 'wave' || u.stats.income <= 0) return;
    u.incomeT += dt * sp;
    const boost = this.time < u.abilityUntil;
    if (u.incomeT < u.stats.interval && !boost) return;
    if (!boost && u.incomeT < u.stats.interval) return;
    u.incomeT = 0;
    const feeder = this.units.some(
      (o) => o !== u && (o.def.behavior === 'income' || o.def.behavior === 'rectifier') && (o.x - u.x) ** 2 + (o.y - u.y) ** 2 <= u.stats.aura * u.stats.aura,
    );
    const amount = Math.round(u.stats.income * (feeder ? 2 : 1) * this.incomeMul());
    if (amount <= 0) return;
    this.gain(amount);
    u.earned += amount;
    this.stats.fonteIncome += amount;
    u.lastFire = this.time;
    this.addFx({ kind: 'text', x: u.x, y: u.y - 22, r: 0, dur: 1, color: '#ffc14d', text: `+${amount}` });
    this.sfxSoft('coin');
  }

  /**
   * Oscilador de Cristal — §3.4. Clock estável: na borda de subida de cada período, pulsa
   * sobre os inimigos no alcance (dano + lentidão + interrupção) e sincroniza as unidades da
   * aura, que disparam imediatamente. Durante o nível alto, elas ganham cadência.
   */
  private actCrystal(u: UnitInst, dt: number, sp: number): void {
    const T = this.crystalPeriod(u);
    u.timerT += dt * sp;
    if (u.timerT >= T) {
      u.timerT -= T;
      u.cycle++;
      const locked = this.time < u.abilityUntil;
      const range = this.rangeOf(u);
      const dmg = u.stats.damage * this.dmgMul(u);
      let any = false;
      for (const e of this.enemies) {
        if (!e.alive || (e.x - u.x) ** 2 + (e.y - u.y) ** 2 > (range + e.def.radius * 0.5) ** 2) continue;
        any = true;
        this.hit(e, dmg, 'comutacao', u);
        // interferência de clock: a lentidão substitui (não acumula)
        this.slowEnemy(e, u.stats.slow, u.stats.slowDur);
        if (locked) this.stunEnemy(e, u.stats.stun);
      }
      for (const o of this.units) {
        if (o === u || (o.x - u.x) ** 2 + (o.y - u.y) ** 2 > u.stats.aura * u.stats.aura) continue;
        if (ATTACKERS.has(o.def.behavior) || o.def.behavior === 'beam' || o.def.behavior === 'capacitor') o.cd = Math.min(o.cd, 0);
      }
      this.addFx({ kind: 'ring', x: u.x, y: u.y, r: range, dur: 0.45, color: locked ? '#ffffff' : u.def.color });
      if (any) u.lastFire = this.time;
      this.sfxSoft('zap');
    }
    u.high = u.timerT / T < u.stats.duty || this.time < u.abilityUntil;
  }

  /**
   * Período efetivo do cristal. A Instabilidade de frequência (§11) desvia o período das
   * temporizadoras; o cristal sofre apenas metade do desvio (estabilidade piezoelétrica) e
   * o OCXO é imune.
   */
  crystalPeriod(u: UnitInst): number {
    const dev = this.timerDeviation();
    if (dev === 1) return u.stats.interval;
    if (u.entry.tier >= 2) return u.stats.interval; // OCXO: forno, imune
    return u.stats.interval * (1 + (dev - 1) * 0.5);
  }

  /**
   * Amp. Operacional — §3.5. Ganho por estágios aplicado a TODOS os alvos do golpe; a
   * realimentação mantém o ponto de operação (trocar de alvo não zera o ganho). Na
   * saturação (clipping) o dano recebe o bônus fixo e o golpe atinge um alvo extra.
   */
  private actOpamp(u: UnitInst, dt: number, sp: number): void {
    const t = this.time;
    if (t < u.recoverUntil) return;
    const open = t < u.abilityUntil;
    if (open) u.stacks = u.stats.gain;
    u.cd -= dt * sp;
    if (u.cd > 0) return;
    const sat = u.stacks >= u.stats.gain;
    const want = u.stats.targets + (sat ? 1 : 0) + (open ? Math.ceil(u.stats.targets * 0.5) : 0);
    const targets = this.pick(u, this.rangeOf(u), want);
    if (!targets.length) {
      u.cd = 0;
      if (t - u.lastTargetT > 2 && !open) u.stacks = 0;
      return;
    }
    const dmg = u.stats.damage * (1 + u.stacks * u.stats.gainStep) * (sat ? 1 + u.stats.satBonus : 1) * this.dmgMul(u);
    for (const e of targets) {
      this.hit(e, dmg, 'comutacao', u);
      this.addFx({ kind: 'bolt', x: u.x, y: u.y, x2: e.x, y2: e.y, r: 0, dur: 0.14, color: sat ? '#ffffff' : u.def.color });
    }
    if (!open) u.stacks = Math.min(u.stats.gain, u.stacks + 1);
    u.lastTargetT = t;
    u.aimX = targets[0].x;
    u.aimY = targets[0].y;
    u.lastFire = t;
    u.cd = u.stats.interval;
    this.sfxSoft('zap');
  }

  /** Amp. op. saturado (clipping): ganho no máximo. */
  clipping(u: UnitInst): boolean {
    return u.def.behavior === 'opamp' && u.stacks >= u.stats.gain;
  }

  /**
   * Plasma — §3.6. Descarga em área que salta entre inimigos e IONIZA cada atingido. A
   * ionização acumula estágios e causa dano contínuo de k·n² (tipo descarga), além de
   * desacelerar — o canal ionizado também conduz melhor, então aumenta o dano de descarga.
   */
  private actPlasma(u: UnitInst, dt: number, sp: number): void {
    const t = this.time;
    if (u.stormLeft > 0 && t >= u.stormAt) {
      u.stormLeft--;
      u.stormAt = t + PLASMA_STORM_GAP;
      const [first] = this.pick(u, this.rangeOf(u), 1);
      if (first) this.plasmaDischarge(u, first, 2.5, u.stats.chains * 2);
      return;
    }
    u.cd -= dt * sp;
    if (u.cd > 0) return;
    const [target] = this.pick(u, this.rangeOf(u), 1);
    if (!target) {
      u.cd = 0;
      return;
    }
    this.plasmaDischarge(u, target, 1, u.stats.chains);
    u.cd = u.stats.interval;
  }

  /** Uma descarga de plasma: área no alvo, cadeia de saltos e ionização em cada atingido. */
  private plasmaDischarge(u: UnitInst, target: EnemyInst, mul: number, jumps: number): void {
    const dmg = u.stats.damage * mul * this.dmgMul(u);
    const r = u.stats.splash;
    const hitSet = new Set<number>();
    let cur: EnemyInst | undefined = target;
    let px = u.x;
    let py = u.y;
    let d = dmg;
    for (let i = 0; i <= jumps && cur; i++) {
      hitSet.add(cur.uid);
      this.addFx({ kind: 'bolt', x: px, y: py, x2: cur.x, y2: cur.y, r: 0, dur: 0.22, color: u.def.color });
      px = cur.x;
      py = cur.y;
      // cada salto deposita energia em área
      const cx = px;
      const cy = py;
      for (const e of this.enemies) {
        if (!e.alive || (e.x - cx) ** 2 + (e.y - cy) ** 2 > (r + e.def.radius) ** 2) continue;
        const near = e.uid === cur.uid;
        this.hit(e, near ? d : d * 0.5, 'descarga', u);
        if (e.alive) {
          this.addIon(e, u.stats.ion, u.stats.ionMax, u.stats.ionCoef * this.dmgMul(u), u.uid);
          this.slowEnemy(e, u.stats.slow, u.stats.slowDur);
        }
      }
      this.addFx({ kind: 'discharge', x: cx, y: cy, r, dur: 0.4, color: u.def.color });
      d *= u.stats.chainDecay;
      let best: EnemyInst | undefined;
      let bd = CHAIN_JUMP * CHAIN_JUMP;
      for (const e of this.enemies) {
        if (!e.alive || hitSet.has(e.uid) || e.open) continue;
        const dd = (e.x - px) ** 2 + (e.y - py) ** 2;
        if (dd <= bd) {
          bd = dd;
          best = e;
        }
      }
      cur = best;
    }
    u.aimX = target.x;
    u.aimY = target.y;
    u.lastFire = this.time;
    this.sfx('discharge');
  }

  /** Acumula estágios de ionização (mesma mecânica do calor, mas de tipo descarga). */
  private addIon(e: EnemyInst, amount: number, max: number, coef: number, src: number): void {
    if (amount <= 0 || max <= 0) return;
    if (e.ion < max) e.ion = Math.min(max, e.ion + amount);
    e.ionT = 0;
    if (coef >= e.ionCoef) {
      e.ionCoef = coef;
      e.ionSrc = src;
    }
  }

  private stunEnemy(e: EnemyInst, stun: number): void {
    if (stun <= 0 || e.def.behavior.controlImmune) return;
    // chefes sofrem metade da interrupção; 1.2: resistência própria do inimigo (Faraday,
    // Oscilador Parasita) e resistência progressiva do Impossível — cada uma uma única vez
    const own = 1 - (e.def.behavior.controlResist ?? 0);
    const st = (e.def.boss ? stun * 0.5 : stun) * own * (1 - this.controlResist());
    if (st <= 0) return;
    e.stunUntil = Math.max(e.stunUntil, this.time + st);
    e.vulnUntil = Math.max(e.vulnUntil, this.time + st + 0.6);
    this.stats.stuns++;
  }

  private actBolt(u: UnitInst, dt: number, sp: number): void {
    u.cd -= dt * sp;
    if (u.cd > 0) return;
    const targets = this.pick(u, this.rangeOf(u), u.stats.targets);
    if (!targets.length) {
      u.cd = 0;
      return;
    }
    const type = u.def.damageType!;
    const dmg = u.stats.damage * this.dmgMul(u);
    const stun = u.stats.stun + (this.has(u, 'sincronismo') ? 0.15 : 0);
    for (const e of targets) {
      this.hit(e, dmg, type, u);
      if (stun > 0) this.stunEnemy(e, stun);
      this.addFx({ kind: 'bolt', x: u.x, y: u.y, x2: e.x, y2: e.y, r: 0, dur: 0.18, color: u.def.color });
      u.aimX = e.x;
      u.aimY = e.y;
    }
    u.lastFire = this.time;
    u.cd = u.stats.interval;
    this.sfx('zap');
  }

  private actPulse(u: UnitInst, dt: number, sp: number): void {
    u.cd -= dt * sp;
    if (u.cd > 0) return;
    const [target] = this.pick(u, this.rangeOf(u), 1);
    if (!target) {
      u.cd = 0;
      return;
    }
    const dmg = u.stats.damage * this.dmgMul(u);
    const r = u.stats.splash;
    const cx = target.x;
    const cy = target.y;
    for (const e of this.enemies) {
      if (!e.alive || (e.x - cx) ** 2 + (e.y - cy) ** 2 > (r + e.def.radius) ** 2) continue;
      this.hit(e, dmg, 'magnetico', u);
      if (u.stats.slow > 0) this.slowEnemy(e, u.stats.slow, u.stats.slowDur);
      if (u.stats.knockback > 0 && e.alive && !e.def.behavior.controlImmune) {
        this.knockback(e, e.def.boss ? u.stats.knockback * 0.35 : u.stats.knockback);
      }
    }
    this.addFx({ kind: 'pulse', x: cx, y: cy, r, dur: 0.45, color: u.def.color });
    this.addFx({ kind: 'bolt', x: u.x, y: u.y, x2: cx, y2: cy, r: 0, dur: 0.15, color: u.def.color });
    u.aimX = cx;
    u.aimY = cy;
    u.lastFire = this.time;
    u.cd = u.stats.interval;
    this.sfx('pulse');
  }

  private actBeam(u: UnitInst, dt: number, sp: number): void {
    const range = this.rangeOf(u);
    let target = this.enemies.find((e) => e.uid === u.target && e.alive);
    if (target && (target.x - u.x) ** 2 + (target.y - u.y) ** 2 > (range + target.def.radius) ** 2) target = undefined;

    if (!target) {
      // Corrente interrompida: a energia ½LI² (∝ ramp²) fica disponível para um pico
      if (u.target !== -1 && u.ramp > 0.15) {
        u.pendingBurst = u.stats.burst * u.ramp * u.ramp * this.dmgMul(u);
        u.pendingUntil = this.time + 2;
      }
      u.target = -1;
      u.ramp = 0;
      u.extra = [];
      const [next] = this.pick(u, range, 1);
      if (!next) return;
      u.target = next.uid;
      target = next;
      if (u.pendingBurst > 0 && this.time < u.pendingUntil) {
        const hits = [next, ...this.pick(u, range, u.stats.targets).filter((e) => e !== next)].slice(0, u.stats.targets);
        for (const e of hits) {
          this.hit(e, u.pendingBurst, 'magnetico', u);
          this.addFx({ kind: 'spark', x: e.x, y: e.y, x2: u.x, y2: u.y, r: 20, dur: 0.4, color: '#ff9a47' });
        }
        this.sfx('discharge');
      }
      u.pendingBurst = 0;
      u.cd = u.stats.interval;
    }

    // Rampa exponencial: I → Imax com constante τ (filtro LC: 15% mais rápida)
    const tau = u.stats.tau * (this.has(u, 'filtroLC') ? 0.85 : 1);
    u.ramp += (1 - u.ramp) * (1 - Math.exp((-dt * sp) / tau));
    u.aimX = target.x;
    u.aimY = target.y;
    u.lastFire = this.time;
    u.cd -= dt;
    if (u.cd <= 0) {
      u.cd += u.stats.interval;
      const dmg = u.stats.damage * u.ramp * u.stats.interval * this.dmgMul(u);
      this.hit(target, dmg, 'magnetico', u);
      u.extra = [];
      if (u.stats.targets > 1) {
        const tgt = target;
        // feixes derivados: até (alvos − 1) inimigos extras, 60% do dano cada
        const extra = this.pick(u, range, u.stats.targets + 1)
          .filter((e) => e !== tgt)
          .slice(0, u.stats.targets - 1);
        for (const e of extra) {
          this.hit(e, dmg * 0.6, 'magnetico', u);
          u.extra.push(e.uid);
        }
      }
      this.sfxSoft('beam');
    }
  }

  private actCapacitor(u: UnitInst, dt: number, sp: number): void {
    // 1.2: sinergia com a Fonte DC reduz o carregamento em 10% (antes 25%)
    const tau = u.stats.tau * (u.buff.powered ? 1 - POWERED_CHARGE_BONUS : 1);
    if (u.stored < u.stats.charges) {
      // Carga RC: v → V com constante τ
      u.ramp += (1 - u.ramp) * (1 - Math.exp((-dt * sp) / tau));
      if (u.ramp >= CAPACITOR_FIRE_V) {
        u.stored++;
        u.ramp = u.stored < u.stats.charges ? 0 : u.ramp;
      }
    }
    u.cd -= dt;
    if (u.stored <= 0 || u.cd > 0) return;
    const [target] = this.pick(u, this.rangeOf(u), 1);
    if (!target) return;
    const dmg = u.stats.damage * this.dmgMul(u);
    this.discharge(u, target.x, target.y, dmg);
    // Banco de capacitores: descargas consecutivas (cada uma causa dano real)
    for (let k = 1; k <= u.stats.salvo; k++) {
      u.salvoQ.push({ t: this.time + k * SALVO_GAP, x: target.x, y: target.y, dmg: dmg * u.stats.salvoMul, target: target.uid });
    }
    u.stored--;
    if (u.stored < u.stats.charges && u.ramp >= CAPACITOR_FIRE_V) u.ramp = 0;
    // 1.2: o intervalo entre descargas vem do atributo (base +15%, eletrolítico −10%)
    u.cd = CAPACITOR_RECOVER * u.stats.recoverMul;
    this.addFx({ kind: 'bolt', x: u.x, y: u.y, x2: target.x, y2: target.y, r: 0, dur: 0.2, color: u.def.color });
    u.aimX = target.x;
    u.aimY = target.y;
    u.lastFire = this.time;
    this.sfx('discharge');
  }

  private discharge(u: UnitInst, x: number, y: number, dmg: number): void {
    const r = u.stats.splash;
    for (const e of this.enemies) {
      if (!e.alive || (e.x - x) ** 2 + (e.y - y) ** 2 > (r + e.def.radius) ** 2) continue;
      this.hit(e, dmg, 'descarga', u);
      this.slowEnemy(e, u.stats.slow, u.stats.slowDur);
    }
    this.addFx({ kind: 'discharge', x, y, x2: x, y2: y, r, dur: 0.45, color: u.def.color });
  }

  private processSalvo(u: UnitInst): void {
    while (u.salvoQ.length && u.salvoQ[0].t <= this.time) {
      const s = u.salvoQ.shift()!;
      const tgt = this.enemies.find((e) => e.uid === s.target && e.alive);
      const x = tgt ? tgt.x : s.x;
      const y = tgt ? tgt.y : s.y;
      this.discharge(u, x, y, s.dmg);
      this.addFx({ kind: 'bolt', x: u.x, y: u.y, x2: x, y2: y, r: 0, dur: 0.15, color: '#fff3c4' });
      this.sfxSoft('discharge');
    }
  }

  private actZone(u: UnitInst, dt: number): void {
    const range = this.rangeOf(u);
    const tau = u.stats.tau;
    const dps = rlSteadyDps(u.stats) * this.dmgMul(u);
    u.cd -= dt;
    const tickNow = u.cd <= 0;
    if (tickNow) u.cd += u.stats.interval;
    let any = false;
    for (const e of this.enemies) {
      if (!e.alive || (e.x - u.x) ** 2 + (e.y - u.y) ** 2 > (range + e.def.radius * 0.5) ** 2) continue;
      any = true;
      if (!e.inZone) {
        e.inZone = true;
        e.rlTime += dt;
      }
      if (!e.def.behavior.controlImmune) e.zoneSlow = Math.max(e.zoneSlow, u.stats.slow);
      if (tickNow) this.hit(e, dps * (1 - Math.exp(-e.rlTime / tau)) * u.stats.interval, 'magnetico', u);
    }
    if (any) u.lastFire = this.time;
  }

  private actIncome(u: UnitInst, dt: number, sp: number): void {
    if (this.phase !== 'wave') return;
    u.incomeT += dt * sp;
    if (u.incomeT < u.stats.interval) return;
    u.incomeT = 0;
    const amount = Math.round(u.stats.income * this.incomeMul());
    if (amount <= 0) {
      this.addFx({ kind: 'text', x: u.x, y: u.y - 22, r: 0, dur: 1, color: '#ff8f8f', text: 'sem carga' });
      return;
    }
    this.gain(amount);
    u.earned += amount;
    this.stats.fonteIncome += amount;
    u.lastFire = this.time;
    this.addFx({ kind: 'text', x: u.x, y: u.y - 22, r: 0, dur: 1, color: '#39d08a', text: `+${amount}` });
    this.sfxSoft('coin');
  }

  /* ---------------- 1.1: comportamentos novos ---------------- */

  private actAmplifier(u: UnitInst, dt: number, sp: number): void {
    const t = this.time;
    if (t < u.abilityUntil) u.stacks = u.stats.gain;
    u.cd -= dt * sp;
    if (u.cd > 0) return;
    const [primary] = this.pick(u, this.rangeOf(u), 1);
    if (!primary) {
      u.cd = 0;
      if (t - u.lastTargetT > 1.5 && t >= u.abilityUntil) u.stacks = 0; // corte
      return;
    }
    if (primary.uid !== u.target) {
      if (u.target !== -1 && !this.has(u, 'resistorEmissor') && t >= u.abilityUntil) u.stacks = Math.floor(u.stacks / 2);
      u.target = primary.uid;
    }
    const sat = this.saturated(u);
    // 1.2: na saturação o dano-base recebe um bônus adicional (satBonus)
    const dmg = u.stats.damage * (1 + u.stacks * u.stats.gainStep) * (sat ? 1 + u.stats.satBonus : 1) * this.dmgMul(u);
    const hits = sat ? [primary, ...this.pick(u, this.rangeOf(u), u.stats.targets + 2).filter((e) => e !== primary)].slice(0, u.stats.targets + 1) : [primary];
    for (const e of hits) {
      this.hit(e, dmg, 'comutacao', u);
      this.addFx({ kind: 'bolt', x: u.x, y: u.y, x2: e.x, y2: e.y, r: 0, dur: 0.14, color: sat ? '#ffffff' : u.def.color });
    }
    u.stacks = Math.min(u.stats.gain, u.stacks + (this.has(u, 'polarizacao') ? 2 : 1));
    u.lastTargetT = t;
    u.aimX = primary.x;
    u.aimY = primary.y;
    u.lastFire = t;
    u.cd = u.stats.interval;
    this.sfxSoft('zap');
  }

  private actHeat(u: UnitInst, dt: number, sp: number): void {
    u.cd -= dt * sp;
    if (u.cd > 0) return;
    const targets = this.pick(u, this.rangeOf(u), u.stats.targets);
    if (!targets.length) {
      u.cd = 0;
      return;
    }
    const dmg = u.stats.damage * this.dmgMul(u);
    for (const e of targets) {
      this.hit(e, dmg, 'termico', u);
      if (e.alive && !e.open) this.addHeat(e, u.stats.heat, u.stats.heatMax, u.stats.heatCoef * this.dmgMul(u), u.uid);
      this.addFx({ kind: 'heat', x: u.x, y: u.y, x2: e.x, y2: e.y, r: 0, dur: 0.22, color: u.def.color });
      u.aimX = e.x;
      u.aimY = e.y;
    }
    u.lastFire = this.time;
    u.cd = u.stats.interval;
    this.sfxSoft('zap');
  }

  private addHeat(e: EnemyInst, amount: number, max: number, coef: number, src: number): void {
    if (e.heat < max) e.heat = Math.min(max, e.heat + amount);
    e.heatT = 0;
    if (coef >= e.heatCoef) {
      e.heatCoef = coef;
      e.heatSrc = src;
    }
  }

  private actWave(u: UnitInst, dt: number, sp: number): void {
    u.cd -= dt * sp;
    if (u.cd > 0) return;
    const range = this.rangeOf(u);
    const inRange = this.enemies.filter((e) => e.alive && (e.x - u.x) ** 2 + (e.y - u.y) ** 2 <= (range + e.def.radius * 0.5) ** 2);
    if (!inRange.length) {
      u.cd = 0;
      return;
    }
    const t = this.time;
    const resonating = t < u.abilityUntil;
    u.cycle++;
    const positive = u.cycle % 2 === 1;
    const base = u.stats.damage * this.dmgMul(u) * (this.has(u, 'acoplamento') ? 1.15 : 1);
    for (const e of inRange) {
      if (positive) {
        if (e.resBy !== u.uid || e.resLast !== u.cycle - 2) e.res = 0;
        e.res++;
        e.resBy = u.uid;
        e.resLast = u.cycle;
        let d = base;
        if (e.res >= u.stats.resonance || resonating) {
          d *= 2.5;
          e.res = 0;
          this.addFx({ kind: 'spark', x: e.x, y: e.y - 14, x2: e.x, y2: e.y + 14, r: 0, dur: 0.35, color: '#ffffff' });
        }
        this.hit(e, d, 'magnetico', u);
      } else {
        this.hit(e, base * 0.5, 'magnetico', u);
        this.slowEnemy(e, u.stats.slow, u.stats.slowDur);
        if (e.alive && !e.def.behavior.controlImmune) this.knockback(e, e.def.boss ? u.stats.knockback * 0.35 : u.stats.knockback);
      }
    }
    this.addFx({ kind: 'wave', x: u.x, y: u.y, r: range, dur: 0.6, color: positive ? u.def.color : '#45cfe0' });
    let period = u.stats.interval * (resonating ? 0.5 : 1);
    if (u.stats.vco > 0) period *= 1 - Math.min(0.4, u.stats.vco * inRange.length);
    u.cd = period;
    u.lastFire = t;
    this.sfxSoft('pulse');
  }

  private actRectifier(u: UnitInst, dt: number): void {
    u.convT += dt;
    if (u.convT < 2 || u.convAcc < 1) return;
    u.convT = 0;
    const amount = Math.floor(u.convAcc);
    u.convAcc -= amount;
    this.gain(amount);
    u.earned += amount;
    this.stats.rectified += amount;
    u.lastFire = this.time;
    this.addFx({ kind: 'text', x: u.x, y: u.y - 22, r: 0, dur: 1, color: '#7fe36b', text: `+${amount}` });
    this.sfxSoft('coin');
  }

  private actTimer(u: UnitInst, dt: number, sp: number): void {
    const T = u.stats.interval;
    const prev = u.timerT;
    u.timerT += dt * sp;
    if (u.timerT >= T) {
      u.timerT -= T;
      this.timerTrigger(u, 1, true);
    } else if (u.stats.charges >= 2 && prev < T / 2 && u.timerT >= T / 2) {
      this.timerTrigger(u, 1, false); // segundo temporizador do 556: só interrompe
    }
    u.high = u.timerT / T < u.stats.duty || this.time < u.abilityUntil;
  }

  /** Borda de subida do 555: interrompe inimigos e (opcionalmente) sincroniza as vizinhas. */
  private timerTrigger(u: UnitInst, stunMul: number, sync: boolean): void {
    const range = this.rangeOf(u);
    const dmg = u.stats.damage * this.dmgMul(u);
    let any = false;
    for (const e of this.enemies) {
      if (!e.alive || (e.x - u.x) ** 2 + (e.y - u.y) ** 2 > (range + e.def.radius * 0.5) ** 2) continue;
      any = true;
      this.hit(e, dmg, 'comutacao', u);
      this.stunEnemy(e, u.stats.stun * stunMul);
    }
    if (sync) {
      for (const o of this.units) {
        if (o === u || (o.x - u.x) ** 2 + (o.y - u.y) ** 2 > u.stats.aura * u.stats.aura) continue;
        if (ATTACKERS.has(o.def.behavior)) o.cd = Math.min(o.cd, 0);
      }
    }
    this.addFx({ kind: 'ring', x: u.x, y: u.y, r: range, dur: 0.5, color: u.def.color });
    if (any) u.lastFire = this.time;
    this.sfxSoft('zap');
  }

  private actChain(u: UnitInst, dt: number, sp: number): void {
    u.cd -= dt * sp;
    if (u.cd > 0) return;
    const [first] = this.pick(u, this.rangeOf(u), 1);
    if (!first) {
      u.cd = 0;
      return;
    }
    u.cycle++;
    const streamer = u.cycle % 5 === 0;
    const jumps = u.stats.chains + (this.has(u, 'acoplamento') ? 1 : 0) + (streamer ? 2 : 0);
    const dmg = u.stats.damage * this.dmgMul(u) * (streamer ? 1.5 : 1);
    this.chainFrom(u, first, jumps, dmg, u.stats.chainDecay, u.stats.stun);
    if (streamer) this.addFx({ kind: 'text', x: u.x, y: u.y - 30, r: 0, dur: 0.8, color: u.def.color, text: 'streamer!' });
    u.cd = u.stats.interval;
  }

  /** Arco em cadeia: salta para o inimigo mais próximo ainda não atingido (até 110). */
  private chainFrom(u: UnitInst, first: EnemyInst, jumps: number, dmg: number, decay: number, stun: number): void {
    const hitSet = new Set<number>();
    let cur: EnemyInst | undefined = first;
    let px = u.x;
    let py = u.y;
    let d = dmg;
    for (let i = 0; i <= jumps && cur; i++) {
      hitSet.add(cur.uid);
      this.addFx({ kind: 'bolt', x: px, y: py, x2: cur.x, y2: cur.y, r: 0, dur: 0.25, color: u.def.color });
      px = cur.x;
      py = cur.y;
      this.hit(cur, d, 'descarga', u);
      this.stunEnemy(cur, stun);
      d *= decay;
      let best: EnemyInst | undefined;
      let bd = CHAIN_JUMP * CHAIN_JUMP;
      for (const e of this.enemies) {
        if (!e.alive || hitSet.has(e.uid) || e.open) continue;
        const dd = (e.x - px) ** 2 + (e.y - py) ** 2;
        if (dd <= bd) {
          bd = dd;
          best = e;
        }
      }
      cur = best;
    }
    u.aimX = first.x;
    u.aimY = first.y;
    u.lastFire = this.time;
    this.sfx('zap');
  }

  private actSuper(u: UnitInst, dt: number, sp: number): void {
    const range = this.rangeOf(u);
    const targets = this.pick(u, range, u.stats.targets);
    u.extra = targets.map((e) => e.uid);
    u.target = targets[0]?.uid ?? -1;
    if (!targets.length) return; // corrente persistente: R = 0, nada se perde sem alvo
    u.ramp += (1 - u.ramp) * (1 - Math.exp((-dt * sp) / u.stats.tau));
    u.aimX = targets[0].x;
    u.aimY = targets[0].y;
    u.lastFire = this.time;
    u.cd -= dt;
    if (u.cd > 0) return;
    u.cd += u.stats.interval;
    const dmg = u.stats.damage * u.ramp * u.stats.interval * this.dmgMul(u);
    for (const e of targets) this.hit(e, dmg, 'magnetico', u);
    this.sfxSoft('beam');
  }

  /** Seleção de alvos conforme a prioridade da unidade. */
  pick(u: UnitInst, range: number, k: number): EnemyInst[] {
    const c: EnemyInst[] = [];
    const magnetic = u.def.damageType === 'magnetico';
    for (const e of this.enemies) {
      if (!e.alive || (e.open && !magnetic)) continue;
      const r = range + e.def.radius * 0.6;
      if ((e.x - u.x) ** 2 + (e.y - u.y) ** 2 <= r * r) c.push(e);
    }
    if (c.length <= 1) return c;
    // 1.2: PRIMEIRO/ÚLTIMO usam o progresso real na rota (distância percorrida / comprimento
    // total), não a ordem de criação nem o instante de entrada no alcance. O desempate por
    // uid mantém a seleção determinística (requisito do replay no servidor).
    switch (u.priority) {
      case 'primeiro':
        c.sort((a, b) => this.routeProgress(b) - this.routeProgress(a) || a.uid - b.uid);
        break;
      case 'ultimo':
        c.sort((a, b) => this.routeProgress(a) - this.routeProgress(b) || a.uid - b.uid);
        break;
      case 'resistente':
        c.sort((a, b) => b.hp + b.shield - (a.hp + a.shield) || a.uid - b.uid);
        break;
      case 'objetivo':
        c.sort((a, b) => this.remaining(a) - this.remaining(b) || a.uid - b.uid);
        break;
    }
    return c.slice(0, k);
  }

  remaining(e: EnemyInst): number {
    return this.paths[e.path].length - e.d;
  }

  /**
   * 1.2: único ponto que move um inimigo ao longo da rota. Mantém `d`, a posição no mapa e
   * `routeProgress` sempre coerentes — curvas, segmentos, recuo, saltos e desaceleração
   * passam todos por aqui, então nenhum deles deixa o progresso desatualizado.
   */
  moveTo(e: EnemyInst, d: number): void {
    const path = this.paths[e.path];
    e.d = Math.max(0, d);
    e.routeProgress = path.length > 0 ? Math.min(1, e.d / path.length) : 0;
    path.at(e.d, e);
  }

  /** Progresso no percurso em [0, 1] (0 = entrada, 1 = núcleo). */
  routeProgress(e: EnemyInst): number {
    const len = this.paths[e.path].length;
    return len > 0 ? Math.min(1, Math.max(0, e.d / len)) : 0;
  }

  /**
   * 1.2: recuo ao longo da rota. O inimigo volta pelo caminho que percorreu (respeitando
   * curvas e segmentos) e nunca passa do início — não há teletransporte nem posição inválida.
   * Sofre a resistência progressiva a controle do modo Impossível.
   */
  knockback(e: EnemyInst, amount: number): void {
    const eff = amount * (1 - this.controlResist());
    if (eff <= 0) return;
    this.moveTo(e, Math.max(0, e.d - eff));
  }

  /* ---------------- 1.2: resistência progressiva (modo Impossível) ---------------- */

  /** Ondas concluídas (base da resistência progressiva). */
  get wavesCleared(): number {
    return Math.max(0, this.paidThrough + 1);
  }

  /**
   * Resistência a controle acumulada: +3 pontos percentuais por onda concluída, limitada a
   * 60%. Afeta atordoamento, lentidão, recuo e interrupção — aplicada UMA única vez, no
   * ponto em que cada efeito é criado.
   */
  controlResist(): number {
    if (!this.config.progressiveResist) return 0;
    return Math.min(PROGRESSIVE_CONTROL_CAP, PROGRESSIVE_CONTROL_STEP * this.wavesCleared);
  }

  /**
   * Redução do dano recebido: +2 pontos percentuais por onda concluída, limitada a 40%.
   * dano recebido = dano calculado × (1 − redução). Aplicada uma única vez, em `hit`.
   */
  damageReduction(): number {
    if (!this.config.progressiveResist) return 0;
    return Math.min(PROGRESSIVE_DR_CAP, PROGRESSIVE_DR_STEP * this.wavesCleared);
  }

  private slowEnemy(e: EnemyInst, amount: number, dur: number): void {
    if (amount <= 0 || e.def.behavior.controlImmune) return;
    // 1.2: resistência própria do inimigo + resistência progressiva, uma única vez cada
    const own = 1 - (e.def.behavior.controlResist ?? 0);
    const a = (e.def.boss ? amount * 0.6 : amount) * own * (1 - this.controlResist());
    if (a <= 0) return;
    if (this.time < e.slowUntil && e.slowAmt > a) return;
    e.slowAmt = a;
    e.slowUntil = this.time + dur;
  }

  /**
   * Aplica dano considerando resistências, fraquezas, intertravamento, saturação, proteção
   * alternada, circuito aberto, modificadores, blindagem e escudo.
   * `pierce`: ignora a blindagem (calor contínuo do resistor e ionização do plasma).
   * `armorPierce` (1.2): parcela fixa da blindagem ignorada pelo golpe (IGBT).
   */
  hit(e: EnemyInst, amount: number, type: DamageType, u: UnitInst | null, pierce = false, armorPierce = 0): void {
    if (!e.alive || amount <= 0) return;
    if (e.open && type !== 'magnetico') return; // circuito aberto: só a indução o atinge
    let m = e.def.resist[type] ?? 1;
    if (this.time < e.vulnUntil) m *= 1 + VULN_BONUS;
    if (e.def.behavior.saturates && type === 'magnetico') m *= Math.max(0.35, 1 - e.magTaken / (e.maxHp * 0.9));
    if (u?.entry.trait === 'precisao' && (e.def.boss || e.armor > 0)) m *= 1.25;
    if (u && e.def.weakTo?.[u.def.id]) m *= e.def.weakTo[u.def.id]!;
    if (e.def.behavior.cycleImmune) {
      if (type === 'grampeamento') e.clampUntil = this.time + 2;
      else if (this.immuneType(e) === type) m *= 0.15;
    }

    /* ---------------- 1.2 — §4: interações próprias dos inimigos novos ---------------- */
    const bh = e.def.behavior;
    const now = this.time;

    // Dielétrico Rompido: durante a ruptura perde as resistências e sofre dano extra
    if (bh.dielectric) {
      if (now < e.dielUntil) m = (m / (e.def.resist[type] ?? 1)) * 1.25;
      else if (ELECTRIC_TYPES.has(type)) {
        e.diel += amount * m;
        if (e.diel >= bh.dielectric.threshold) {
          e.diel = 0;
          e.dielUntil = now + bh.dielectric.dur;
          this.addFx({ kind: 'spark', x: e.x, y: e.y - 14, x2: e.x, y2: e.y + 14, r: 18, dur: 0.5, color: '#ffffff' });
          this.addFx({ kind: 'text', x: e.x, y: e.y - e.def.radius - 8, r: 0, dur: 1, color: '#6fd4ff', text: 'ruptura!' });
          this.sfxSoft('discharge');
        }
      }
    }

    // Semicondutor Reverso: bloqueia, até um grampeamento colocá-lo em condução direta
    if (bh.reverse) {
      if (type === 'grampeamento' && now >= e.forwardUntil) {
        e.forwardUntil = now + bh.reverse.dur;
        this.addFx({ kind: 'text', x: e.x, y: e.y - e.def.radius - 8, r: 0, dur: 1, color: '#8bb4ff', text: 'condução direta' });
      }
      if (now < e.forwardUntil) m *= 1 + bh.reverse.bonus;
      else if (type === 'comutacao' || type === 'grampeamento') m *= bh.reverse.block;
    }

    // Arco Voltaico / Singularidade: resistências que giram entre os tipos de dano
    const cyc = bh.cycleResist;
    if (cyc && now >= (bh.reverse ? 0 : 0)) {
      const idx = Math.floor((now - e.bornAt) / cyc.every) % cyc.types.length;
      if (cyc.types[idx] === type) m *= 1 - cyc.amount;
    }

    // Saturação Profunda: o magnético preenche o medidor em vez de reduzir a vida
    if (bh.satMeter && now >= e.satUntil) {
      const fills = type === 'magnetico' || type === 'termico';
      if (fills) {
        e.satFill += amount * m * (type === 'termico' ? bh.satMeter.thermalMul : 1);
        if (e.satFill >= bh.satMeter.need) {
          e.satFill = 0;
          e.satUntil = now + bh.satMeter.dur;
          this.addFx({ kind: 'ring', x: e.x, y: e.y, r: e.def.radius + 22, dur: 0.6, color: '#ffffff' });
          this.addFx({ kind: 'text', x: e.x, y: e.y - e.def.radius - 8, r: 0, dur: 1.2, color: '#7d5fd6', text: 'SATURADO!' });
          this.sfxSoft('pulse');
        }
      }
      // enquanto não saturou, o dano magnético não fere (só satura)
      if (type === 'magnetico') {
        e.flash = 0.1;
        e.lastHit = now;
        return;
      }
    }
    // janela de saturação total: sem resistências e sem blindagem
    if (bh.satMeter && now < e.satUntil) {
      m = m / (e.def.resist[type] ?? 1);
      pierce = true;
    }
    if (this.modifiers.includes('instabilidade_circuito')) m *= e.def.boss || e.def.behavior.elite ? 0.8 : 0.92;
    // 1.2 — §11: resistências concedidas por modificadores (permanentes, aplicadas uma vez)
    if (type === 'magnetico' && this.modifiers.includes('blindagem_faraday')) m *= 0.65;
    if ((type === 'descarga' || type === 'grampeamento') && this.modifiers.includes('ruptura_dieletrica')) m *= 0.7;
    // 1.2: o canal ionizado conduz melhor — descargas em alvos ionizados causam mais dano
    if (type === 'descarga' && e.ion > 0) m *= 1 + ION_CONDUCT_BONUS;
    let dmg = amount * m;
    // 1.2: o IGBT ignora uma parcela fixa da blindagem (o piso de 30% continua valendo)
    if (!pierce) dmg = Math.max(dmg * 0.3, dmg - Math.max(0, e.armor - armorPierce));
    // 1.2: redução progressiva do modo Impossível — aplicada uma única vez, aqui
    const dr = this.damageReduction();
    if (dr > 0) dmg *= 1 - dr;
    if (type === 'magnetico') e.magTaken += dmg;
    if (e.shield > 0) {
      const absorbed = Math.min(e.shield, dmg);
      e.shield -= absorbed;
      dmg -= absorbed;
    }
    const dealt = Math.min(e.hp, dmg);
    e.hp -= dmg;
    e.flash = 0.1;
    e.pend += dealt;
    e.lastHit = this.time;
    if (u) {
      u.dealt += dealt;
      this.stats.damageBy[u.def.id] = (this.stats.damageBy[u.def.id] ?? 0) + dealt;
      if (u.buff.rect >= 0) {
        const r = this.unit(u.buff.rect);
        if (r && this.time >= r.stunUntil) {
          const conv = r.stats.conversion * (this.has(r, 'filtroCapacitivo') ? 1.5 : 1);
          r.convAcc += (dealt * conv * this.incomeMul()) / 100;
        }
      }
    }
    if (e.hp <= 0) this.kill(e, u);
  }

  private kill(e: EnemyInst, u: UnitInst | null): void {
    e.alive = false;
    this.gain(e.reward);
    this.stats.kills++;
    if (u) u.kills++;
    if (e.def.boss) {
      this.stats.bosses.push(e.def.id);
      this.toast(`${e.def.name} neutralizado! +${e.reward}`, 'ok');
    }
    // Curto Franco: superaquece unidades próximas
    const burst = e.def.behavior.deathBurst;
    if (burst) {
      for (const o of this.units) {
        if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 > burst.radius * burst.radius) continue;
        o.overheatUntil = Math.max(o.overheatUntil, this.time + (o.buff.protected ? 1 : burst.dur));
      }
      this.addFx({ kind: 'emp', x: e.x, y: e.y, r: burst.radius, dur: 0.5, color: e.def.color });
      this.criticalHeat(e.x, e.y, 'O Curto-Circuito Franco');
    }
    // 1.2 — §4.4: Supercapacitor Instável libera a carga acumulada ao ser destruído
    const dis = e.def.behavior.deathDischarge;
    if (dis && e.charge > 0) {
      const frac = e.def.behavior.accumulate ? Math.min(1, e.charge / e.def.behavior.accumulate.max) : 1;
      const stun = dis.stun * frac;
      this.emp(e.x, e.y, dis.radius, stun, stun * 0.35, e.def.color);
      this.addFx({ kind: 'discharge', x: e.x, y: e.y, r: dis.radius, dur: 0.7, color: e.def.color });
      this.criticalHeat(e.x, e.y, e.def.name);
    }
    // Calor conduzido para os vizinhos
    if (e.heat >= 2) {
      const half = Math.floor(e.heat / 2);
      for (const o of this.enemies) {
        if (o === e || !o.alive || (o.x - e.x) ** 2 + (o.y - e.y) ** 2 > 55 * 55) continue;
        this.addHeat(o, half, Math.max(o.heat, half), e.heatCoef, e.heatSrc);
      }
    }
    this.addFx({ kind: 'death', x: e.x, y: e.y, r: e.def.radius * 1.8, dur: e.def.boss ? 1 : 0.4, color: e.def.color });
    if (this.showDamage) this.addFx({ kind: 'text', x: e.x, y: e.y - 12, r: 0, dur: 0.8, color: '#f2bf4a', text: `+${e.reward}` });
    this.sfxSoft('kill');
  }

  private gain(amount: number): void {
    this.credits += amount;
    this.stats.earned += amount;
  }

  /* ------------------------------------------------------------------ */
  /* Efeitos e eventos                                                   */
  /* ------------------------------------------------------------------ */

  private addFx(f: Omit<Fx, 't' | 'x2' | 'y2'> & { x2?: number; y2?: number }): void {
    if (this.fx.length > 400) return;
    this.fx.push({ x2: f.x, y2: f.y, ...f, t: this.time });
  }

  private sfx(id: SfxId): void {
    this.onEvent?.({ type: 'sfx', id });
  }

  /** Sons frequentes são limitados para não saturar o áudio. */
  private sfxSoft(id: SfxId): void {
    const last = this.sfxGate[id] ?? -1;
    if (this.time - last < 0.12) return;
    this.sfxGate[id] = this.time;
    this.sfx(id);
  }

  private toast(text: string, tone: 'info' | 'warn' | 'boss' | 'ok'): void {
    this.onEvent?.({ type: 'toast', text, tone });
  }
}

