import { ACHIEVEMENTS } from '../data/achievements';
import { DIFFICULTIES } from '../data/difficulty';
import { QUIZZES } from '../data/knowledge';
import { CAMPAIGN, STAGE_BY_ID, type Objective, type StageDef } from '../data/stages';
import { TRAITS, TRAIT_ORDER } from '../data/traits';
import { EXCLUSIVE_RARITIES, UNITS, UNIT_ORDER } from '../data/units';
import type { MatchStats } from '../engine/GameEngine';
import { isEndless } from '../engine/setup';
import type { Difficulty, LoadoutEntry, MapId, Tier, TraitId, UnitId } from '../types';
import { SECRET_DUPLICATE_EC, type CapsuleContent, type CapsuleRoll } from './capsules';

/**
 * Progresso permanente do jogador, salvo localmente (localStorage).
 * Não há backend nem sincronização em nuvem: o progresso fica neste navegador.
 *
 * Versão 2 (Patch 1.1): “Créditos de pesquisa (CP)” passaram a se chamar “Energia
 * concatenada (EC)”. Perfis antigos (v1, campo `cp`) são migrados sem perda: o saldo vira EC
 * e as fases concluídas passam a contar como vitórias na dificuldade Normal.
 */

export const STORAGE_KEY = 'emlab.defense.v1';
export const PROFILE_VERSION = 2;
export const LOADOUT_SIZE = 5;
const START_UNITS: UnitId[] = ['rele', 'bobina', 'fonte'];
const SECRET_UNIT: UnitId = 'supercondutor';

export interface DiffRecord {
  cleared: boolean;
  wins: number;
  plays: number;
  bestLeaks: number | null;
}

export interface StageRecord {
  /** concluída em qualquer dificuldade */
  cleared: boolean;
  stars: number;
  objectives: [boolean, boolean];
  quizDone: boolean;
  plays: number;
  wins: number;
  bestLeaks: number | null;
  bestTime: number | null;
  /** 1.1: registro por dificuldade */
  diff: Partial<Record<Difficulty, DiffRecord>>;
}

export interface HistoryEntry {
  stage: string;
  won: boolean;
  stars: number;
  wave: number;
  kills: number;
  date: number;
  difficulty?: Difficulty | null;
}

export interface Profile {
  v: 2;
  xp: number;
  /** Energia concatenada (recurso permanente) */
  ec: number;
  units: UnitId[];
  tiers: Partial<Record<UnitId, Tier>>;
  traits: Partial<Record<UnitId, TraitId | null>>;
  loadout: UnitId[];
  stages: Record<string, StageRecord>;
  achievements: Record<string, number>;
  /** unidades secretas descobertas (data da descoberta) */
  secrets: Partial<Record<UnitId, number>>;
  capsules: {
    /** verificações feitas (marcos de 5 ondas) */
    checks: number;
    /** cápsulas obtidas */
    opened: number;
    /** EC recebida em cápsulas */
    ec: number;
    secrets: number;
    /** identificadores das cápsulas já creditadas (evita duplicidade) */
    log: string[];
  };
  stats: {
    kills: number;
    leaks: number;
    matches: number;
    wins: number;
    losses: number;
    earned: number;
    playTime: number;
    bosses: number;
    quizCorrect: number;
    quizAnswered: number;
    endlessBest: number;
    endlessBestMap: MapId | null;
    upgrades: number;
    placed: number;
  };
  history: HistoryEntry[];
  settings: { sound: boolean; volume: number; showDamage: boolean; autoStart: boolean };
}

export function defaultProfile(): Profile {
  return {
    v: 2,
    xp: 0,
    ec: 0,
    units: [...START_UNITS],
    tiers: {},
    traits: {},
    loadout: [...START_UNITS],
    stages: {},
    achievements: {},
    secrets: {},
    capsules: { checks: 0, opened: 0, ec: 0, secrets: 0, log: [] },
    stats: {
      kills: 0,
      leaks: 0,
      matches: 0,
      wins: 0,
      losses: 0,
      earned: 0,
      playTime: 0,
      bosses: 0,
      quizCorrect: 0,
      quizAnswered: 0,
      endlessBest: 0,
      endlessBestMap: null,
      upgrades: 0,
      placed: 0,
    },
    history: [],
    settings: { sound: true, volume: 0.6, showDamage: true, autoStart: false },
  };
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function sanitizeDiff(v: unknown): DiffRecord | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const d = v as Partial<DiffRecord>;
  return { cleared: !!d.cleared, wins: num(d.wins), plays: num(d.plays), bestLeaks: typeof d.bestLeaks === 'number' ? d.bestLeaks : null };
}

/**
 * Valida, completa e migra dados carregados (versões antigas ou corrompidas não quebram o jogo).
 * Migração v1 → v2: `cp` → `ec`; fase concluída → vitória na dificuldade Normal.
 */
export function sanitize(raw: unknown): Profile {
  const base = defaultProfile();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Profile> & { cp?: unknown };
  const units = Array.isArray(r.units) ? r.units.filter((u): u is UnitId => u in UNITS) : base.units;
  for (const u of START_UNITS) if (!units.includes(u)) units.push(u);
  const tiers: Profile['tiers'] = {};
  for (const [k, v] of Object.entries(r.tiers ?? {})) if (k in UNITS && (v === 1 || v === 2)) tiers[k as UnitId] = v;
  const traits: Profile['traits'] = {};
  for (const [k, v] of Object.entries(r.traits ?? {})) if (k in UNITS && typeof v === 'string' && v in TRAITS) traits[k as UnitId] = v as TraitId;
  const stages: Profile['stages'] = {};
  for (const [k, v] of Object.entries(r.stages ?? {})) {
    if (!v || typeof v !== 'object') continue;
    const s = v as Partial<StageRecord>;
    const diff: StageRecord['diff'] = {};
    for (const d of ['normal', 'dificil', 'impossivel'] as Difficulty[]) {
      const rec = sanitizeDiff(s.diff?.[d]);
      if (rec) diff[d] = rec;
    }
    // v1: a fase concluída conta como vitória no Normal
    if (s.cleared && !diff.normal) {
      diff.normal = { cleared: true, wins: Math.max(1, num(s.wins)), plays: num(s.plays), bestLeaks: typeof s.bestLeaks === 'number' ? s.bestLeaks : null };
    }
    stages[k] = {
      cleared: !!s.cleared,
      stars: Math.max(0, Math.min(3, num(s.stars))),
      objectives: [!!s.objectives?.[0], !!s.objectives?.[1]],
      quizDone: !!s.quizDone,
      plays: num(s.plays),
      wins: num(s.wins),
      bestLeaks: typeof s.bestLeaks === 'number' ? s.bestLeaks : null,
      bestTime: typeof s.bestTime === 'number' ? s.bestTime : null,
      diff,
    };
  }
  const secrets: Profile['secrets'] = {};
  for (const [k, v] of Object.entries(r.secrets ?? {})) if (k in UNITS && typeof v === 'number') secrets[k as UnitId] = v;
  // a unidade secreta só existe na coleção se tiver sido descoberta
  const cleanUnits = units.filter((u) => !UNITS[u].secret || secrets[u]);
  const loadout = Array.isArray(r.loadout) ? r.loadout.filter((u): u is UnitId => cleanUnits.includes(u)).slice(0, LOADOUT_SIZE) : base.loadout;
  const c = (r.capsules ?? {}) as Partial<Profile['capsules']>;
  // migração v1 → v2: o saldo de CP vira EC (mesmo valor)
  const ec = r.ec !== undefined ? num(r.ec) : num(r.cp);
  return {
    v: 2,
    xp: Math.max(0, num(r.xp)),
    ec: Math.max(0, ec),
    units: cleanUnits,
    tiers,
    traits,
    loadout: fixLoadout(loadout.length ? loadout : base.loadout),
    stages,
    achievements: typeof r.achievements === 'object' && r.achievements ? { ...r.achievements } : {},
    secrets,
    capsules: {
      checks: num(c.checks),
      opened: num(c.opened),
      ec: num(c.ec),
      secrets: num(c.secrets),
      log: Array.isArray(c.log) ? c.log.filter((x): x is string => typeof x === 'string').slice(-200) : [],
    },
    stats: { ...base.stats, ...(typeof r.stats === 'object' ? r.stats : {}) },
    history: Array.isArray(r.history) ? r.history.slice(0, 20) : [],
    settings: { ...base.settings, ...(typeof r.settings === 'object' ? r.settings : {}) },
  };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : defaultProfile();
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(p: Profile): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

/* ---------------- Nível do engenheiro ---------------- */

/** XP acumulada necessária para atingir o nível `lv` (nível 1 = 0 XP). */
export function xpForLevel(lv: number): number {
  return Math.round(150 * (lv - 1) ** 1.45);
}

export function levelInfo(xp: number): { level: number; cur: number; next: number; frac: number } {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, cur, next, frac: (xp - cur) / (next - cur) };
}

export function unlockedTraits(p: Profile): TraitId[] {
  const lv = levelInfo(p.xp).level;
  return TRAIT_ORDER.filter((t) => TRAITS[t].unlockLevel <= lv);
}

/* ---------------- Fases e dificuldades ---------------- */

export function stageRecord(p: Profile, id: string): StageRecord | undefined {
  return p.stages[id];
}

export function isStageUnlocked(p: Profile, stage: StageDef): boolean {
  return !stage.requires || !!p.stages[stage.requires]?.cleared;
}

/** Normal: sempre; Difícil: após vencer no Normal; Impossível: após vencer no Difícil. */
export function isDifficultyUnlocked(p: Profile, stageId: string, d: Difficulty): boolean {
  const rec = p.stages[stageId];
  if (d === 'normal') return true;
  if (d === 'dificil') return !!rec?.diff.normal?.cleared;
  return !!rec?.diff.dificil?.cleared;
}

export function totalStars(p: Profile): number {
  return CAMPAIGN.reduce((n, s) => n + (p.stages[s.id]?.stars ?? 0), 0);
}

export function nextCampaignStage(p: Profile): StageDef {
  return CAMPAIGN.find((s) => !p.stages[s.id]?.cleared && isStageUnlocked(p, s)) ?? CAMPAIGN[CAMPAIGN.length - 1];
}

export function loadoutEntries(p: Profile, ids: UnitId[] = p.loadout): LoadoutEntry[] {
  return ids.map((id) => ({ id, tier: p.tiers[id] ?? 0, trait: p.traits[id] ?? null }));
}

/** Mapas disponíveis no modo infinito: os dos capítulos já alcançados. */
export function endlessMaps(p: Profile): MapId[] {
  const maps: MapId[] = [];
  for (const s of CAMPAIGN) if (isStageUnlocked(p, s) && !maps.includes(s.map)) maps.push(s.map);
  return maps;
}

export function evaluateObjective(o: Objective, s: MatchStats): boolean {
  switch (o.kind) {
    case 'noLeak':
      return s.leaks === 0;
    case 'maxLeaks':
      return s.leaks <= o.n;
    case 'maxUnits':
      return s.maxUnits <= o.n;
    case 'minClasses':
      return s.classes.length >= o.n;
    case 'noSell':
      return s.sold === 0;
    case 'withoutUnit':
      return !s.unitsUsed.includes(o.unit);
  }
}

/* ---------------- Resultado da partida ---------------- */

export interface MatchSummary {
  stageId: string;
  won: boolean;
  /** ondas concluídas */
  waves: number;
  stats: MatchStats;
  /** dificuldade (null no modo infinito) */
  difficulty?: Difficulty | null;
}

export interface RewardReport {
  won: boolean;
  firstClear: boolean;
  /** primeira vitória nesta dificuldade */
  firstDiffClear: boolean;
  difficulty: Difficulty | null;
  stars: number;
  objectives: [boolean, boolean];
  newObjectives: [boolean, boolean];
  xp: number;
  ec: number;
  levelBefore: number;
  levelAfter: number;
  unlockedUnits: UnitId[];
  unlockedTraits: TraitId[];
  achievements: string[];
  endlessRecord: boolean;
  quizPending: boolean;
  /** cápsulas sorteadas na partida (já creditadas durante a partida) */
  capsules: CapsuleRoll[];
}

const OBJECTIVE_EC = 25;

/** Função pura: aplica o resultado ao perfil e calcula as recompensas. */
export function applyMatch(prev: Profile, m: MatchSummary): { profile: Profile; report: RewardReport } {
  const p: Profile = structuredClone(prev);
  const levelBefore = levelInfo(p.xp).level;
  const traitsBefore = unlockedTraits(p);
  const endless = isEndless(m.stageId);
  const stage = STAGE_BY_ID[m.stageId];
  const difficulty: Difficulty | null = endless ? null : (m.difficulty ?? 'normal');

  p.stats.matches++;
  p.stats.kills += m.stats.kills;
  p.stats.leaks += m.stats.leaks;
  p.stats.earned += m.stats.earned;
  p.stats.playTime += m.stats.time;
  p.stats.bosses += m.stats.bosses.length;
  p.stats.upgrades += m.stats.upgrades;
  p.stats.placed += m.stats.placed;
  if (m.won) p.stats.wins++;
  else p.stats.losses++;

  const report: RewardReport = {
    won: m.won,
    firstClear: false,
    firstDiffClear: false,
    difficulty,
    stars: 0,
    objectives: [false, false],
    newObjectives: [false, false],
    xp: 0,
    ec: 0,
    levelBefore,
    levelAfter: levelBefore,
    unlockedUnits: [],
    unlockedTraits: [],
    achievements: [],
    endlessRecord: false,
    quizPending: false,
    capsules: m.stats.capsules ?? [],
  };

  if (endless) {
    report.xp = 15 * m.waves;
    report.ec = 8 * m.waves;
    if (m.waves > p.stats.endlessBest) {
      p.stats.endlessBest = m.waves;
      p.stats.endlessBestMap = m.stageId.slice(2) as MapId;
      report.endlessRecord = m.waves > 0;
    }
  } else if (stage && difficulty) {
    const rec: StageRecord = p.stages[stage.id] ?? {
      cleared: false,
      stars: 0,
      objectives: [false, false],
      quizDone: false,
      plays: 0,
      wins: 0,
      bestLeaks: null,
      bestTime: null,
      diff: {},
    };
    const dr: DiffRecord = rec.diff[difficulty] ?? { cleared: false, wins: 0, plays: 0, bestLeaks: null };
    rec.plays++;
    dr.plays++;
    if (m.won) {
      rec.wins++;
      dr.wins++;
      report.firstClear = !rec.cleared;
      report.firstDiffClear = !dr.cleared;
      dr.cleared = true;
      dr.bestLeaks = dr.bestLeaks === null ? m.stats.leaks : Math.min(dr.bestLeaks, m.stats.leaks);
      const obj: [boolean, boolean] = [evaluateObjective(stage.objectives[0], m.stats), evaluateObjective(stage.objectives[1], m.stats)];
      report.objectives = obj;
      report.newObjectives = [obj[0] && !rec.objectives[0], obj[1] && !rec.objectives[1]];
      rec.objectives = [rec.objectives[0] || obj[0], rec.objectives[1] || obj[1]];
      report.stars = 1 + (obj[0] ? 1 : 0) + (obj[1] ? 1 : 0);
      rec.stars = Math.max(rec.stars, 1 + (rec.objectives[0] ? 1 : 0) + (rec.objectives[1] ? 1 : 0));
      rec.cleared = true;
      rec.bestLeaks = rec.bestLeaks === null ? m.stats.leaks : Math.min(rec.bestLeaks, m.stats.leaks);
      rec.bestTime = rec.bestTime === null ? m.stats.time : Math.min(rec.bestTime, m.stats.time);

      // recompensa: integral na primeira vitória em cada dificuldade, 35% nas repetições
      const mult = (report.firstDiffClear ? 1 : 0.35) * DIFFICULTIES[difficulty].reward;
      report.xp = Math.round(stage.reward.xp * mult);
      report.ec = Math.round(stage.reward.ec * mult) + OBJECTIVE_EC * (Number(report.newObjectives[0]) + Number(report.newObjectives[1]));
      for (const u of stage.unlocks ?? []) {
        if (!p.units.includes(u)) {
          p.units.push(u);
          report.unlockedUnits.push(u);
          if (p.loadout.length < LOADOUT_SIZE) p.loadout.push(u);
        }
      }
      report.quizPending = !!stage.quiz && !rec.quizDone && !!QUIZZES[stage.quiz];
    } else {
      // participação: um pouco de XP pelas ondas vencidas
      report.xp = Math.round(m.waves * 6);
    }
    rec.diff[difficulty] = dr;
    p.stages[stage.id] = rec;
  }

  p.xp += report.xp;
  p.ec += report.ec;
  report.levelAfter = levelInfo(p.xp).level;
  report.unlockedTraits = unlockedTraits(p).filter((t) => !traitsBefore.includes(t));

  p.history.unshift({ stage: m.stageId, won: m.won, stars: report.stars, wave: m.waves, kills: m.stats.kills, date: Date.now(), difficulty });
  p.history = p.history.slice(0, 20);

  report.achievements = grantAchievements(p, { ...m, difficulty });
  for (const id of report.achievements) report.ec += ACHIEVEMENTS.find((a) => a.id === id)!.ec;
  return { profile: p, report };
}

/** Concede (e credita) conquistas recém-obtidas; retorna seus ids. */
export function grantAchievements(p: Profile, m: MatchSummary | null): string[] {
  const got: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (p.achievements[a.id]) continue;
    if (a.check(p, m)) {
      p.achievements[a.id] = Date.now();
      p.ec += a.ec;
      got.push(a.id);
    }
  }
  return got;
}

/* ---------------- Cápsulas energéticas ---------------- */

export interface CapsuleGrant {
  profile: Profile;
  /** false se esta cápsula já tinha sido creditada (chave repetida) */
  applied: boolean;
  /** EC efetivamente creditada */
  ec: number;
  /** a unidade secreta foi descoberta agora */
  newSecret: boolean;
  achievements: string[];
}

/**
 * Registra uma verificação de cápsula (idempotente pela chave `key`, única por partida e
 * marco). Cápsulas obtidas creditam EC ou desbloqueiam a unidade secreta na hora.
 */
export function grantCapsule(prev: Profile, key: string, roll: CapsuleRoll): CapsuleGrant {
  if (prev.capsules.log.includes(key)) return { profile: prev, applied: false, ec: 0, newSecret: false, achievements: [] };
  const p: Profile = structuredClone(prev);
  p.capsules.log = [...p.capsules.log, key].slice(-200);
  p.capsules.checks++;
  let ec = 0;
  let newSecret = false;
  if (roll.got && roll.content) {
    p.capsules.opened++;
    const c: CapsuleContent = roll.content;
    if (c.kind === 'secret') {
      if (!p.units.includes(SECRET_UNIT)) {
        p.units.push(SECRET_UNIT);
        p.secrets[SECRET_UNIT] = Date.now();
        p.capsules.secrets++;
        newSecret = true;
      } else {
        ec = SECRET_DUPLICATE_EC;
      }
    } else {
      ec = c.amount;
    }
    p.ec += ec;
    p.capsules.ec += ec;
  }
  const achievements = grantAchievements(p, null);
  return { profile: p, applied: true, ec, newSecret, achievements };
}

/** Desafio de conhecimento pós-fase. Recompensa apenas no primeiro acerto. */
export function answerQuiz(prev: Profile, stageId: string, correct: boolean): { profile: Profile; ec: number; achievements: string[] } {
  const p: Profile = structuredClone(prev);
  const rec = p.stages[stageId];
  p.stats.quizAnswered++;
  let ec = 0;
  if (correct) {
    p.stats.quizCorrect++;
    if (rec && !rec.quizDone) {
      rec.quizDone = true;
      ec = 40;
      p.ec += ec;
    }
  }
  const achievements = grantAchievements(p, null);
  return { profile: p, ec, achievements };
}

/* ---------------- Coleção ---------------- */

export function evolveCost(p: Profile, id: UnitId): number | null {
  const tier = p.tiers[id] ?? 0;
  if (tier >= 2) return null;
  return UNITS[id].tiers[tier + 1].ec;
}

export function evolve(prev: Profile, id: UnitId): { profile: Profile; ok: boolean; achievements: string[] } {
  const cost = evolveCost(prev, id);
  if (cost === null || prev.ec < cost || !prev.units.includes(id)) return { profile: prev, ok: false, achievements: [] };
  const p: Profile = structuredClone(prev);
  p.ec -= cost;
  p.tiers[id] = ((p.tiers[id] ?? 0) + 1) as Tier;
  const achievements = grantAchievements(p, null);
  return { profile: p, ok: true, achievements };
}

export function setTrait(prev: Profile, id: UnitId, trait: TraitId | null): Profile {
  if (trait && !unlockedTraits(prev).includes(trait)) return prev;
  const p: Profile = structuredClone(prev);
  p.traits[id] = trait;
  return p;
}

/** Regra de equipe: no máximo uma unidade Mítica ou Secreta. Mantém a primeira. */
export function fixLoadout(ids: UnitId[]): UnitId[] {
  let exclusive = false;
  return ids.filter((u) => {
    if (!EXCLUSIVE_RARITIES.includes(UNITS[u].rarity)) return true;
    if (exclusive) return false;
    exclusive = true;
    return true;
  });
}

/** Motivo para a unidade não poder entrar na equipe atual (null = pode). */
export function loadoutBlock(ids: UnitId[], add: UnitId): string | null {
  if (ids.includes(add)) return null;
  if (ids.length >= LOADOUT_SIZE) return `Equipe completa (${LOADOUT_SIZE} unidades)`;
  if (EXCLUSIVE_RARITIES.includes(UNITS[add].rarity) && ids.some((u) => EXCLUSIVE_RARITIES.includes(UNITS[u].rarity))) {
    return 'Apenas 1 unidade Mítica ou Secreta por equipe';
  }
  return null;
}

export function setLoadout(prev: Profile, ids: UnitId[]): Profile {
  const clean = UNIT_ORDER.filter((u) => ids.includes(u) && prev.units.includes(u)).slice(0, LOADOUT_SIZE);
  const ordered = fixLoadout(ids.filter((u) => clean.includes(u)));
  return { ...prev, loadout: ordered };
}
