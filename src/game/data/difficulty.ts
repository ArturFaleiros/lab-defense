import type { Difficulty, EnemyId, MapId } from '../types';
import { ENEMIES } from './enemies';
import type { SpawnGroup, StageDef, WaveDef } from './stages';

/**
 * Dificuldades e modificadores (Patch 1.1).
 *
 * - O número de ondas é fixo por dificuldade (12 / 15 / 25). As ondas de cada fase são
 *   geradas de forma determinística a partir das ondas autorais da fase (`buildWaves`).
 * - Vida e velocidade de TODOS os inimigos (inclusive chefes e inimigos gerados durante a
 *   partida) são multiplicadas sobre os valores-base: nunca se acumulam entre dificuldades.
 * - Difícil e Impossível adicionam escoltas de elite e modificadores com contrajogo.
 */

export interface DifficultyDef {
  id: Difficulty;
  name: string;
  waves: number;
  /** multiplicadores sobre os atributos-base dos inimigos */
  hp: number;
  speed: number;
  /** multiplicador da recompensa de EC/XP da primeira vitória nesta dificuldade */
  reward: number;
  /** fração inicial da rampa de vida dentro da fase (mais ondas → começo mais suave, mesmo pico) */
  rampStart: number;
  color: string;
  desc: string;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  normal: {
    id: 'normal',
    name: 'Normal',
    waves: 12,
    hp: 1.15,
    speed: 1.15,
    reward: 1,
    rampStart: 0.35,
    color: '#39d08a',
    desc: '12 ondas. Inimigos com +15% de vida e velocidade. Sem modificadores.',
  },
  dificil: {
    id: 'dificil',
    name: 'Difícil',
    waves: 15,
    hp: 1.25,
    speed: 1.25,
    reward: 1.6,
    rampStart: 0.3,
    color: '#f2bf4a',
    desc: '15 ondas. +25% de vida e velocidade, escoltas de elite e modificadores de instabilidade.',
  },
  impossivel: {
    id: 'impossivel',
    name: 'Impossível',
    waves: 25,
    hp: 1.45,
    speed: 1.45,
    reward: 2.6,
    rampStart: 0,
    color: '#ff5f5f',
    desc: '25 ondas. +45% de vida e velocidade, elites desde cedo e modificadores severos combinados. Exige composição específica.',
  },
};

export const DIFFICULTY_ORDER: Difficulty[] = ['normal', 'dificil', 'impossivel'];

/* ------------------------------------------------------------------------ */
/* Modificadores                                                            */
/* ------------------------------------------------------------------------ */

export type ModifierId =
  | 'instabilidade_tensao'
  | 'sobrecarga_eletrica'
  | 'interferencia_em'
  | 'queda_rendimento'
  | 'oscilacao_frequencia'
  | 'colapso_tensao'
  | 'interferencia_critica'
  | 'sobrecarga_sistemica'
  | 'dreno_energetico'
  | 'instabilidade_circuito'
  | 'ressonancia_magnetica'
  | 'falha_isolamento';

export interface ModifierDef {
  id: ModifierId;
  name: string;
  level: 'dificil' | 'impossivel';
  /** efeito em jogo, com números */
  desc: string;
  /** coerência técnica do modificador */
  tech: string;
  /** como responder */
  counter: string;
  color: string;
  /** janela periódica (s): ativo durante `duration` a cada `period`; ausente = permanente */
  period?: number;
  duration?: number;
  offset?: number;
}

export const MODIFIERS: Record<ModifierId, ModifierDef> = {
  instabilidade_tensao: {
    id: 'instabilidade_tensao',
    name: 'Instabilidade de tensão',
    level: 'dificil',
    desc: 'A cada 20 s, por 5 s, cerca de 35% das unidades (sorteadas) causam −25% de dano.',
    tech: 'Afundamentos de tensão (sags) reduzem a potência entregue a cargas sensíveis.',
    counter: 'Unidades protegidas por diodo são imunes.',
    color: '#f2bf4a',
    period: 20,
    duration: 5,
    offset: 8,
  },
  sobrecarga_eletrica: {
    id: 'sobrecarga_eletrica',
    name: 'Sobrecarga elétrica',
    level: 'dificil',
    desc: 'A cada 18 s, por 5 s, unidades de ataque direto (relé, diodo, transistor, resistor, Tesla, bobina) ficam com intervalo de ataque +35%.',
    tech: 'Sob sobrecarga, a proteção térmica limita a taxa de operação para evitar aquecimento excessivo.',
    counter: 'Feixes, zonas e capacitores não são afetados; auras de cadência compensam.',
    color: '#ff9a47',
    period: 18,
    duration: 5,
    offset: 6,
  },
  interferencia_em: {
    id: 'interferencia_em',
    name: 'Interferência eletromagnética',
    level: 'dificil',
    desc: 'A cada 22 s, por 6 s, uma região (raio 190, marcada no mapa) reduz em 20% o alcance das unidades dentro dela.',
    tech: 'Campos externos acoplados aos cabos degradam sensores e a precisão dos comandos.',
    counter: 'Característica Isolamento e proteção de diodo anulam o efeito.',
    color: '#e05fd0',
    period: 22,
    duration: 6,
    offset: 10,
  },
  queda_rendimento: {
    id: 'queda_rendimento',
    name: 'Queda de rendimento',
    level: 'dificil',
    desc: 'A cada 25 s, por 8 s, a geração de créditos de fontes e retificadores cai 40%.',
    tech: 'Perdas de conversão aumentam quando a fonte opera fora do ponto nominal.',
    counter: 'Antecipe compras; o bônus de onda não é afetado.',
    color: '#39d08a',
    period: 25,
    duration: 8,
    offset: 12,
  },
  oscilacao_frequencia: {
    id: 'oscilacao_frequencia',
    name: 'Oscilação de frequência',
    level: 'dificil',
    desc: 'A cadência das unidades oscila ±15% continuamente (período de 8 s); metade das unidades oscila em oposição de fase.',
    tech: 'Variações da frequência da rede alteram a velocidade de máquinas e temporizações.',
    counter: 'O CI 555 e o transformador (ramo abaixador) estabilizam a cadência média.',
    color: '#45cfe0',
  },
  colapso_tensao: {
    id: 'colapso_tensao',
    name: 'Colapso de tensão',
    level: 'impossivel',
    desc: 'A cada 15 s, por 4 s, 2 unidades sorteadas causam −60% de dano (−30% se protegidas por diodo).',
    tech: 'Quando a demanda supera a capacidade do sistema, a tensão colapsa localmente.',
    counter: 'Diodos reduzem a penalidade pela metade; distribua o dano entre várias unidades.',
    color: '#ff5f5f',
    period: 15,
    duration: 4,
    offset: 5,
  },
  interferencia_critica: {
    id: 'interferencia_critica',
    name: 'Interferência crítica',
    level: 'impossivel',
    desc: 'A cada 20 s, por 8 s, uma região (raio 230, marcada) reduz em 35% o alcance das unidades dentro dela.',
    tech: 'Interferência intensa satura entradas de sensores e receptores.',
    counter: 'Isolamento anula; diodo reduz o efeito à metade.',
    color: '#ff6fd8',
    period: 20,
    duration: 8,
    offset: 7,
  },
  sobrecarga_sistemica: {
    id: 'sobrecarga_sistemica',
    name: 'Sobrecarga sistêmica',
    level: 'impossivel',
    desc: 'A cada 20 s, por 6 s, todas as unidades de ataque ficam com intervalo de ataque +50%.',
    tech: 'Sobrecarga generalizada aciona limitações térmicas em todo o sistema.',
    counter: 'Guarde habilidades para essas janelas; o CI 555 sincroniza disparos.',
    color: '#ff9a47',
    period: 20,
    duration: 6,
    offset: 14,
  },
  dreno_energetico: {
    id: 'dreno_energetico',
    name: 'Dreno energético',
    level: 'impossivel',
    desc: 'Permanente: fontes e retificadores geram 45% menos e o bônus de conclusão de onda cai 25%.',
    tech: 'Correntes de fuga e perdas parasitas consomem parte da energia gerada.',
    counter: 'Economia mínima e unidades de alto dano por custo.',
    color: '#39d08a',
  },
  instabilidade_circuito: {
    id: 'instabilidade_circuito',
    name: 'Instabilidade de circuito',
    level: 'impossivel',
    desc: 'Permanente: elites e chefes recebem 20% menos dano; demais inimigos, 8% menos.',
    tech: 'Um circuito instável reage de forma imprevisível, “absorvendo” parte das correções.',
    counter: 'Característica Precisão (+25% contra chefes e blindados) e dano térmico sustentado.',
    color: '#a28bff',
  },
  ressonancia_magnetica: {
    id: 'ressonancia_magnetica',
    name: 'Ressonância magnética',
    level: 'impossivel',
    desc: 'Permanente: dois trechos do caminho (marcados) aceleram os inimigos em 35% e reduzem pela metade as desacelerações sofridas ali.',
    tech: 'Em ressonância, pequenas excitações produzem grandes respostas.',
    counter: 'Posicione interrupção (relé, CI 555) antes ou depois dos trechos ressonantes.',
    color: '#c77dff',
  },
  falha_isolamento: {
    id: 'falha_isolamento',
    name: 'Falha de isolamento',
    level: 'impossivel',
    desc: 'A cada 16 s, por 5 s, unidades sem proteção de diodo causam −30% de dano.',
    tech: 'Isolamentos degradados permitem fugas que roubam parte da energia útil.',
    counter: 'Proteção de diodo torna a unidade imune.',
    color: '#39d0b8',
    period: 16,
    duration: 5,
    offset: 9,
  },
};

const MAP_MODIFIERS: Record<MapId, { dificil: ModifierId[]; impossivel: ModifierId[] }> = {
  placa: { dificil: ['sobrecarga_eletrica', 'instabilidade_tensao'], impossivel: ['sobrecarga_sistemica', 'colapso_tensao', 'instabilidade_circuito'] },
  bancada: { dificil: ['oscilacao_frequencia', 'queda_rendimento'], impossivel: ['ressonancia_magnetica', 'dreno_energetico', 'falha_isolamento'] },
  barramento: { dificil: ['instabilidade_tensao', 'interferencia_em'], impossivel: ['falha_isolamento', 'colapso_tensao', 'interferencia_critica'] },
  malha: { dificil: ['interferencia_em', 'oscilacao_frequencia'], impossivel: ['interferencia_critica', 'ressonancia_magnetica', 'sobrecarga_sistemica'] },
  nucleo: { dificil: ['queda_rendimento', 'instabilidade_tensao'], impossivel: ['dreno_energetico', 'instabilidade_circuito', 'colapso_tensao'] },
  osciloscopio: { dificil: ['oscilacao_frequencia', 'interferencia_em'], impossivel: ['ressonancia_magnetica', 'interferencia_critica', 'colapso_tensao'] },
  ponte: { dificil: ['queda_rendimento', 'instabilidade_tensao'], impossivel: ['dreno_energetico', 'falha_isolamento', 'instabilidade_circuito'] },
  subestacao: { dificil: ['sobrecarga_eletrica', 'queda_rendimento'], impossivel: ['sobrecarga_sistemica', 'colapso_tensao', 'dreno_energetico'] },
  chip: { dificil: ['interferencia_em', 'sobrecarga_eletrica'], impossivel: ['interferencia_critica', 'falha_isolamento', 'sobrecarga_sistemica'] },
  transmissao: { dificil: ['instabilidade_tensao', 'oscilacao_frequencia'], impossivel: ['ressonancia_magnetica', 'instabilidade_circuito', 'colapso_tensao'] },
};

/**
 * Modificadores de uma fase. A combinação depende do mapa e da posição da fase no cenário
 * (1ª, 2ª ou 3ª fase): Difícil usa 1–2 modificadores; Impossível combina 2–3 severos com um
 * do Difícil. Fases podem declarar a lista explicitamente.
 */
export function modifiersFor(stage: StageDef, diff: Difficulty): ModifierId[] {
  if (diff === 'normal') return [];
  const own = stage.modifiers?.[diff];
  if (own) return own;
  const t = MAP_MODIFIERS[stage.map];
  const k = stage.variant ?? 1;
  const hard = [t.dificil[(k - 1) % t.dificil.length]];
  if (k === 3) hard.push(t.dificil[k % t.dificil.length]);
  if (diff === 'dificil') return hard;
  const severe = t.impossivel.slice(0, k === 1 ? 2 : 3);
  return [...severe, hard[0]];
}

/* ------------------------------------------------------------------------ */
/* Geração das ondas por dificuldade                                        */
/* ------------------------------------------------------------------------ */

const CHAPTER_ELITES: Record<number, EnemyId[]> = {
  0: ['franco', 'saturado', 'sobretensao'],
  1: ['franco', 'sobrecarga'],
  2: ['fuga', 'sobrecarga'],
  3: ['sobretensao', 'emi'],
  4: ['aberto', 'fuga'],
  5: ['saturado', 'franco', 'emi'],
  6: ['saturado', 'sobretensao', 'aberto'],
};

export function elitesFor(stage: StageDef): EnemyId[] {
  return stage.elites ?? CHAPTER_ELITES[stage.chapter] ?? CHAPTER_ELITES[6];
}

/**
 * Ondas de uma fase em uma dificuldade. As ondas autorais são distribuídas ao longo das N
 * ondas (cada uma aparece ao menos uma vez, na ordem); chefes só aparecem na última
 * repetição da onda em que foram escritos. Difícil e Impossível somam escoltas de elite.
 */
export function buildWaves(stage: StageDef, diff: Difficulty): WaveDef[] {
  const src = stage.waves;
  const k = src.length;
  const n = DIFFICULTIES[diff].waves;
  if (!k) return [];
  const elites = elitesFor(stage);
  const out: WaveDef[] = [];
  const idx = (j: number) => Math.round((n > 1 ? j / (n - 1) : 1) * (k - 1));
  for (let j = 0; j < n; j++) {
    const prog = n > 1 ? j / (n - 1) : 1;
    let groups: SpawnGroup[];
    if (k > n) {
      // mais ondas autorais que o necessário: cada onda reúne um bloco consecutivo de ondas
      // autorais (nada é descartado; blocos seguintes começam 10 s depois)
      const from = Math.floor((j * k) / n);
      const to = Math.floor(((j + 1) * k) / n);
      groups = [];
      for (let a = from; a < to; a++) for (const g of src[a].groups) groups.push({ ...g, at: g.at + (a - from) * 10 });
    } else {
      const a = idx(j);
      const lastForA = j === n - 1 || idx(j + 1) !== a;
      groups = src[a].groups.filter((g) => !ENEMIES[g.enemy].boss || lastForA).map((g) => ({ ...g }));
    }
    // aquecimento: no Difícil e no Impossível as primeiras ondas têm menos inimigos comuns
    // (a pressão vem depois, com elites, modificadores e a rampa de vida)
    const warm = diff === 'impossivel' ? 0.25 : diff === 'dificil' ? 0.15 : 0;
    if (prog < warm) {
      const f = diff === 'impossivel' ? 0.55 : 0.8;
      groups = groups.map((g) => (ENEMIES[g.enemy].boss ? g : { ...g, count: Math.max(1, Math.round(g.count * f)), gap: g.gap / f }));
    }
    if (diff !== 'normal' && elites.length) {
      const start = diff === 'dificil' ? 0.3 : 0.2;
      if (prog >= start) {
        const enemy = elites[j % elites.length];
        const count = diff === 'dificil' ? 1 + Math.floor(prog * 2) : 2 + Math.floor(prog * 4);
        groups.push({ enemy, count, gap: 2.2, at: 5, path: null, hp: 1 });
      }
    }
    if (diff === 'impossivel' && prog >= 0.5 && elites.length > 1) {
      const enemy = elites[(j + 1) % elites.length];
      groups.push({ enemy, count: 1 + Math.floor(prog * 3), gap: 2.6, at: 12, path: null, hp: 1 });
    }
    out.push({ groups });
  }
  return out;
}
