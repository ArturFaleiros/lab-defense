import type { Difficulty, EnemyId, MapId, UnitId } from '../types';
import type { ModifierId } from './difficulty';

/**
 * Campanha, desafios e modo de chefes.
 *
 * Ondas usam uma notação compacta: "curto*12/0.9@3#1" =
 *   12 Curtos-Circuitos, 0,9 s entre eles, começando 3 s após o início da onda, no caminho 1.
 * Grupos separados por vírgula correm em paralelo. "~1.4" multiplica a vida do grupo.
 * Sem "#", inimigos se alternam entre os caminhos do mapa.
 */

export interface SpawnGroup {
  enemy: EnemyId;
  count: number;
  gap: number;
  at: number;
  path: number | null;
  hp: number;
}

export interface WaveDef {
  groups: SpawnGroup[];
}

export type Objective =
  | { kind: 'noLeak' }
  | { kind: 'maxLeaks'; n: number }
  | { kind: 'maxUnits'; n: number }
  | { kind: 'minClasses'; n: number }
  | { kind: 'noSell' }
  | { kind: 'withoutUnit'; unit: UnitId };

export type StageMode = 'campaign' | 'challenge' | 'boss';

export interface StageDef {
  id: string;
  mode: StageMode;
  chapter: number;
  name: string;
  /** conceito técnico trabalhado na fase */
  concept: string;
  briefing: string;
  map: MapId;
  startCredits: number;
  lives: number;
  hpScale: number;
  waves: WaveDef[];
  objectives: [Objective, Objective];
  reward: { ec: number; xp: number };
  quiz?: string;
  unlocks?: UnitId[];
  /** id da fase que precisa estar concluída */
  requires?: string;
  allowed?: UnitId[];
  tips: string[];
  /* ---------- Patch 1.1 ---------- */
  /** posição da fase no seu cenário (1ª, 2ª ou 3ª): define a combinação de modificadores */
  variant?: number;
  /** inimigos de elite usados como escolta no Difícil e no Impossível */
  elites?: EnemyId[];
  /** modificadores explícitos por dificuldade (senão, derivados do mapa e da variante) */
  modifiers?: Partial<Record<Exclude<Difficulty, 'normal'>, ModifierId[]>>;
  /** áreas onde não é possível posicionar unidades nesta fase */
  blocked?: BlockedZone[];
}

export interface BlockedZone {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

const ENEMY_IDS: EnemyId[] = [
  'curto',
  'surto',
  'sobrecarga',
  'ruido',
  'interferencia',
  'isolamento',
  'instabilidade',
  'arco',
  'saturacao',
  'cascata',
  'colapso',
  'franco',
  'sobretensao',
  'emi',
  'fuga',
  'aberto',
  'transiente',
  'saturado',
  'ressonancia',
  'apagao',
];

export function parseWave(src: string): WaveDef {
  const groups = src.split(',').map((raw) => {
    const m = raw.trim().match(/^([a-z]+)\*(\d+)(?:\/([\d.]+))?(?:@([\d.]+))?(?:#(\d))?(?:~([\d.]+))?$/);
    if (!m || !ENEMY_IDS.includes(m[1] as EnemyId)) throw new Error(`Onda inválida: "${raw}"`);
    return {
      enemy: m[1] as EnemyId,
      count: Number(m[2]),
      gap: m[3] ? Number(m[3]) : 1,
      at: m[4] ? Number(m[4]) : 0,
      path: m[5] !== undefined ? Number(m[5]) : null,
      hp: m[6] ? Number(m[6]) : 1,
    };
  });
  return { groups };
}

const waves = (...w: string[]) => w.map(parseWave);

export const CHAPTERS = [
  { n: 1, title: 'Fundamentos de Comutação', theme: 'Relés eletromagnéticos: bobina, contatos NA/NF e contato reversível.' },
  { n: 2, title: 'Energia Magnética', theme: 'Indutores e bobinas: indutância, campo, energia armazenada e resposta transitória.' },
  { n: 3, title: 'Proteção de Circuitos', theme: 'Diodos, tensão reversa, proteção de bobinas e sobretensão.' },
  { n: 4, title: 'Sistemas Combinados', theme: 'Circuitos RL: resistência, indutância, constante de tempo e regime transitório.' },
  { n: 5, title: 'Instabilidade do Sistema', theme: 'Desafios integrados que exigem todos os conceitos anteriores.' },
  { n: 6, title: 'Proteção do Núcleo Eletromagnético', theme: 'Batalha final contra o Colapso do Sistema.' },
  { n: 7, title: 'Tela do Osciloscópio', theme: 'Expansão 1.1 — sinais, frequência, transientes e o Resistor de Potência.' },
  { n: 8, title: 'Ponte Retificadora', theme: 'Retificação, corrente de fuga, continuidade e sobretensão sustentada.' },
  { n: 9, title: 'Subestação de Distribuição', theme: 'Curto-circuito, núcleos saturados, harmônicas e ressonância.' },
  { n: 10, title: 'Interior do Circuito Integrado', theme: 'Semicondutores, lógica e temporização (CI 555).' },
  { n: 11, title: 'Linha de Transmissão', theme: 'Sistema trifásico, para-raios e o Apagão Total.' },
];

export const STAGES: StageDef[] = [
  // ---------------- Capítulo 1 ----------------
  {
    id: '1-1',
    mode: 'campaign',
    chapter: 1,
    name: 'Primeiro acionamento',
    concept: 'Bobina e contato',
    briefing:
      'Curtos-circuitos estão avançando pela placa de comando. Posicione uma Bobina nas curvas e use o Relé para interromper o avanço. A Fonte DC gera créditos ao longo da partida.',
    map: 'placa',
    startCredits: 550,
    lives: 20,
    hpScale: 1,
    waves: waves(
      'curto*6/1.6',
      'curto*9/1.3',
      'curto*8/1.2, surto*4/1.5@6',
      'curto*12/1, surto*6/1.2@4',
      'curto*14/0.9, sobrecarga*1@10',
    ),
    objectives: [{ kind: 'noLeak' }, { kind: 'maxUnits', n: 5 }],
    reward: { ec: 80, xp: 100 },
    quiz: 'q1-1',
    tips: ['Selecione uma unidade (teclas 1–5), mova o cursor sobre o mapa e clique para posicionar.', 'Curvas do caminho permitem que uma unidade cubra mais trilha.'],
  },
  {
    id: '1-2',
    mode: 'campaign',
    chapter: 1,
    name: 'Contatos NA e NF',
    concept: 'Normalmente aberto e normalmente fechado',
    briefing:
      'Surtos de Tensão são rápidos e frágeis; Sobrecargas são lentas e blindadas. Combine interrupção (Relé) com dano em área (Bobina).',
    map: 'placa',
    startCredits: 550,
    lives: 20,
    hpScale: 1.05,
    waves: waves(
      'curto*8/1.3',
      'surto*8/1, curto*6/1.2@3',
      'curto*12/0.9, sobrecarga*1@8',
      'surto*12/0.7',
      'sobrecarga*3/3, curto*10/0.9@2',
      'curto*16/0.7, surto*10/0.6@5',
      'sobrecarga*4/2.5, surto*12/0.5@6',
    ),
    objectives: [{ kind: 'noLeak' }, { kind: 'minClasses', n: 3 }],
    reward: { ec: 100, xp: 120 },
    quiz: 'q1-2',
    requires: '1-1',
    tips: ['A blindagem da Sobrecarga reduz golpes fracos: prefira golpes fortes.', 'Defina a prioridade “Mais resistente” em uma Bobina para focar Sobrecargas.'],
  },
  {
    id: '1-3',
    mode: 'campaign',
    chapter: 1,
    name: 'Contato reversível',
    concept: 'Relé SPDT: COM alterna entre NC e NO',
    briefing:
      'Um Arco Elétrico se forma entre contatos que se abrem. Ele salta adiante periodicamente — a interrupção do Relé adia o salto.',
    map: 'placa',
    startCredits: 600,
    lives: 20,
    hpScale: 1.1,
    waves: waves(
      'curto*10/1',
      'surto*10/0.8',
      'curto*12/0.8, sobrecarga*2/3@6',
      'surto*14/0.6, curto*8/0.9@4',
      'sobrecarga*4/2.2',
      'curto*20/0.55',
      'surto*16/0.5, sobrecarga*3/2.5@5',
      'curto*14/0.6, surto*12/0.5@4, sobrecarga*3/2@8',
      'arco*1, curto*12/0.9@3',
    ),
    objectives: [{ kind: 'maxLeaks', n: 3 }, { kind: 'noSell' }],
    reward: { ec: 140, xp: 160 },
    quiz: 'q1-3',
    unlocks: ['indutor'],
    requires: '1-2',
    tips: ['Leve o Relé ao nível 3 (contato reversível) para atingir dois alvos.', 'O chefe custa 8 vidas se alcançar o núcleo.'],
  },

  // ---------------- Capítulo 2 ----------------
  {
    id: '2-1',
    mode: 'campaign',
    chapter: 2,
    name: 'Corrente que não muda de repente',
    concept: 'Indutância: oposição à variação da corrente',
    briefing:
      'O Indutor está disponível: seu dano cresce enquanto mantém o mesmo alvo, como a corrente em um RL. Cuidado com o Ruído Elétrico, que reduz a cadência das unidades próximas.',
    map: 'bancada',
    startCredits: 650,
    lives: 20,
    hpScale: 1.2,
    waves: waves(
      'curto*12/0.9',
      'ruido*4/2, curto*8/1@2',
      'surto*14/0.6',
      'sobrecarga*4/2, ruido*3/2@4',
      'curto*16/0.6, ruido*5/1.5@5',
      'surto*14/0.5, sobrecarga*4/2@3',
      'ruido*8/1.2, curto*14/0.6@3',
      'sobrecarga*6/1.8, ruido*6/1.2@4, surto*12/0.5@8',
    ),
    objectives: [{ kind: 'noLeak' }, { kind: 'maxUnits', n: 7 }],
    reward: { ec: 150, xp: 180 },
    quiz: 'q2-1',
    requires: '1-3',
    tips: ['O Indutor é excelente contra alvos resistentes e fraco contra enxames.', 'Mantenha unidades fora do alcance do Ruído ou derrote-o rápido.'],
  },
  {
    id: '2-2',
    mode: 'campaign',
    chapter: 2,
    name: 'Energia no campo magnético',
    concept: 'E = ½·L·I²',
    briefing: 'A Instabilidade Magnética alterna entre muito lenta e muito rápida. Cubra trechos longos do caminho.',
    map: 'bancada',
    startCredits: 650,
    lives: 20,
    hpScale: 1.3,
    waves: waves(
      'instabilidade*4/2',
      'curto*14/0.7, instabilidade*3/2@4',
      'ruido*6/1.2, surto*10/0.6@3',
      'sobrecarga*5/2, instabilidade*4/1.8@4',
      'curto*20/0.5, ruido*5/1.4@4',
      'instabilidade*8/1.2, surto*12/0.5@4',
      'sobrecarga*6/1.6, ruido*6/1.2@3',
      'instabilidade*10/1, curto*16/0.5@2',
      'sobrecarga*8/1.4, instabilidade*8/1@5, surto*14/0.4@9',
    ),
    objectives: [{ kind: 'maxLeaks', n: 2 }, { kind: 'minClasses', n: 4 }],
    reward: { ec: 160, xp: 200 },
    quiz: 'q2-2',
    requires: '2-1',
    tips: ['Ao perder o alvo, o Indutor libera a energia acumulada no próximo inimigo.'],
  },
  {
    id: '2-3',
    mode: 'campaign',
    chapter: 2,
    name: 'Núcleo saturado',
    concept: 'Campo em solenoides e saturação do núcleo',
    briefing:
      'A Saturação do Núcleo absorve dano magnético e fica cada vez mais resistente a ele. Diversifique os tipos de dano.',
    map: 'bancada',
    startCredits: 700,
    lives: 20,
    hpScale: 1.35,
    waves: waves(
      'curto*16/0.7',
      'surto*16/0.5, ruido*4/1.5@3',
      'sobrecarga*6/1.6',
      'instabilidade*8/1.1, curto*12/0.6@3',
      'ruido*8/1, surto*12/0.5@4',
      'sobrecarga*7/1.4, instabilidade*6/1.2@4',
      'curto*24/0.4, ruido*6/1@4',
      'sobrecarga*8/1.2, surto*16/0.4@5',
      'instabilidade*12/0.8, ruido*8/1@4, sobrecarga*5/1.5@8',
      'saturacao*1, curto*14/0.8@4, sobrecarga*4/2@10',
    ),
    objectives: [{ kind: 'noLeak' }, { kind: 'noSell' }],
    reward: { ec: 200, xp: 240 },
    quiz: 'q2-3',
    unlocks: ['diodo'],
    requires: '2-2',
    tips: ['Relés (comutação) não sofrem com a saturação.'],
  },

  // ---------------- Capítulo 3 ----------------
  {
    id: '3-1',
    mode: 'campaign',
    chapter: 3,
    name: 'Polaridade do diodo',
    concept: 'Condução unidirecional e diodo de flyback',
    briefing:
      'Duas entradas alimentam o barramento. A Interferência Eletromagnética desativa unidades próximas — unidades protegidas por Diodo são imunes.',
    map: 'barramento',
    startCredits: 750,
    lives: 20,
    hpScale: 1.45,
    waves: waves(
      'curto*10/0.9#0, curto*10/0.9#1',
      'interferencia*3/2.5#0, surto*10/0.6@2#1',
      'sobrecarga*4/2, interferencia*3/2@5',
      'surto*20/0.4',
      'interferencia*5/1.6, curto*16/0.6@3',
      'sobrecarga*6/1.5, ruido*4/1.5@4',
      'interferencia*6/1.3#1, surto*14/0.4@3#0',
      'sobrecarga*8/1.2, interferencia*6/1.2@4, curto*16/0.5@8',
    ),
    objectives: [{ kind: 'noLeak' }, { kind: 'maxUnits', n: 8 }],
    reward: { ec: 200, xp: 260 },
    quiz: 'q3-1',
    unlocks: ['capacitor'],
    requires: '2-3',
    tips: ['Posicione Diodos onde a Interferência passa perto das suas unidades.', 'O trecho comum depois da junção recebe inimigos das duas entradas.'],
  },
  {
    id: '3-2',
    mode: 'campaign',
    chapter: 3,
    name: 'Sobretensão no desligamento',
    concept: 'vL = L·di/dt e o pico de tensão',
    briefing:
      'Falhas de Isolamento ignoram desaceleração e interrupção. O Capacitor está disponível: descargas em área com dano de descarga.',
    map: 'barramento',
    startCredits: 750,
    lives: 20,
    hpScale: 1.55,
    waves: waves(
      'isolamento*4/2',
      'curto*14/0.6, isolamento*3/2@4',
      'surto*18/0.4, interferencia*3/2@4',
      'isolamento*6/1.5, sobrecarga*3/2@5',
      'ruido*6/1.2, curto*16/0.5@3',
      'isolamento*8/1.2, surto*14/0.4@4',
      'sobrecarga*8/1.2, interferencia*5/1.3@4',
      'isolamento*10/1, ruido*6/1@3, surto*16/0.4@7',
      'sobrecarga*10/1, isolamento*8/1@5, interferencia*6/1@9',
    ),
    objectives: [{ kind: 'maxLeaks', n: 2 }, { kind: 'minClasses', n: 4 }],
    reward: { ec: 220, xp: 280 },
    quiz: 'q3-2',
    requires: '3-1',
    tips: ['Isolamento resiste a dano magnético: use Capacitores, Relés e Diodos.'],
  },
  {
    id: '3-3',
    mode: 'campaign',
    chapter: 3,
    name: 'Falha em cascata',
    concept: 'Lei de Faraday e lei de Lenz',
    briefing: 'Uma Falha em Cascata gera Curtos-Circuitos enquanto avança. Contenha a fonte antes que o barramento seja tomado.',
    map: 'barramento',
    startCredits: 800,
    lives: 20,
    hpScale: 1.6,
    waves: waves(
      'curto*24/0.5',
      'isolamento*6/1.5, surto*12/0.5@3',
      'interferencia*6/1.4, sobrecarga*4/2@4',
      'ruido*8/1, curto*20/0.4@3',
      'sobrecarga*10/1, surto*16/0.4@5',
      'isolamento*10/1, interferencia*6/1.2@4',
      'instabilidade*10/0.9, ruido*6/1@4',
      'sobrecarga*10/0.9, isolamento*8/1@4, surto*20/0.35@8',
      'interferencia*8/1, curto*24/0.4@3, sobrecarga*6/1.2@8',
      'cascata*1, isolamento*6/1.5@6, surto*16/0.5@12',
    ),
    objectives: [{ kind: 'noLeak' }, { kind: 'noSell' }],
    reward: { ec: 260, xp: 320 },
    quiz: 'q3-3',
    unlocks: ['rl'],
    requires: '3-2',
    tips: ['A blindagem pesada do chefe exige golpes fortes; os curtos gerados pedem dano em área.'],
  },

  // ---------------- Capítulo 4 ----------------
  {
    id: '4-1',
    mode: 'campaign',
    chapter: 4,
    name: 'Constante de tempo',
    concept: 'τ = L/R',
    briefing:
      'O Circuito RL está disponível: inimigos que permanecem na zona sofrem dano crescente, como a corrente que cresce com τ = L/R.',
    map: 'malha',
    startCredits: 800,
    lives: 20,
    hpScale: 1.75,
    waves: waves(
      'curto*20/0.6',
      'instabilidade*8/1.2, surto*10/0.5@3',
      'sobrecarga*6/1.6, ruido*4/1.5@3',
      'isolamento*8/1.2, curto*16/0.5@4',
      'interferencia*6/1.4, instabilidade*6/1.2@4',
      'sobrecarga*10/1, surto*18/0.4@5',
      'ruido*8/1, isolamento*8/1@4',
      'instabilidade*14/0.7, sobrecarga*6/1.2@5',
      'interferencia*8/1, curto*24/0.4@3, isolamento*6/1.2@8',
    ),
    objectives: [{ kind: 'maxLeaks', n: 2 }, { kind: 'maxUnits', n: 9 }],
    reward: { ec: 260, xp: 340 },
    quiz: 'q4-1',
    unlocks: ['transformador'],
    requires: '3-3',
    tips: ['Trechos paralelos do zigue-zague deixam uma zona RL cobrir duas passagens.'],
  },
  {
    id: '4-2',
    mode: 'campaign',
    chapter: 4,
    name: 'Regime transitório',
    concept: 'i(t) = (V/R)(1 − e^(−t/τ))',
    briefing: 'O Transformador amplifica unidades vizinhas. Escolha entre elevar o dano ou a cadência no nível 2.',
    map: 'malha',
    startCredits: 850,
    lives: 20,
    hpScale: 1.9,
    waves: waves(
      'curto*24/0.5, surto*12/0.5@4',
      'sobrecarga*8/1.4',
      'isolamento*10/1, ruido*5/1.4@3',
      'instabilidade*14/0.7',
      'interferencia*8/1.2, sobrecarga*6/1.4@4',
      'surto*30/0.3, curto*16/0.5@4',
      'isolamento*12/0.9, instabilidade*8/1@4',
      'sobrecarga*12/0.9, ruido*8/0.9@4',
      'interferencia*10/0.9, isolamento*10/0.9@4, surto*20/0.3@8',
      'sobrecarga*14/0.8, instabilidade*12/0.7@4, curto*24/0.35@8',
    ),
    objectives: [{ kind: 'noLeak' }, { kind: 'minClasses', n: 5 }],
    reward: { ec: 280, xp: 360 },
    quiz: 'q4-2',
    requires: '4-1',
    tips: ['Transformador + Bobinas ao redor formam um núcleo de dano muito eficiente.'],
  },
  {
    id: '4-3',
    mode: 'campaign',
    chapter: 4,
    name: 'Resposta do circuito',
    concept: 'Efeito de R sobre corrente final e tempo de resposta',
    briefing: 'Dois chefes no mesmo circuito: um Arco Elétrico seguido de uma Saturação do Núcleo.',
    map: 'malha',
    startCredits: 900,
    lives: 20,
    hpScale: 2,
    waves: waves(
      'curto*26/0.45',
      'surto*20/0.35, isolamento*6/1.4@3',
      'sobrecarga*10/1.2',
      'interferencia*8/1.1, ruido*6/1.2@3',
      'instabilidade*14/0.7, sobrecarga*6/1.4@5',
      'arco*1, surto*16/0.4@4',
      'isolamento*14/0.8, curto*20/0.4@4',
      'sobrecarga*14/0.8, interferencia*8/1@5',
      'ruido*10/0.8, instabilidade*14/0.6@3, surto*24/0.3@8',
      'sobrecarga*16/0.7, isolamento*12/0.8@5',
      'saturacao*1~1.1, arco*1@12, curto*20/0.6@4',
    ),
    objectives: [{ kind: 'maxLeaks', n: 4 }, { kind: 'noSell' }],
    reward: { ec: 320, xp: 400 },
    quiz: 'q4-3',
    requires: '4-2',
    tips: ['Prepare dano variado para a Saturação e controle para o Arco.'],
  },

  // ---------------- Capítulo 5 ----------------
  {
    id: '5-1',
    mode: 'campaign',
    chapter: 5,
    name: 'Reatância indutiva',
    concept: 'XL = 2πfL',
    briefing: 'Instabilidades em massa na bancada. Os inimigos chegam em ondas mais densas e variadas.',
    map: 'bancada',
    startCredits: 900,
    lives: 20,
    hpScale: 2.2,
    waves: waves(
      'instabilidade*12/0.8, curto*16/0.5@3',
      'sobrecarga*10/1.1, ruido*6/1.2@3',
      'isolamento*12/0.9, surto*20/0.35@4',
      'interferencia*10/1, instabilidade*10/0.8@4',
      'sobrecarga*14/0.8, curto*24/0.35@4',
      'ruido*12/0.8, isolamento*10/0.9@4',
      'instabilidade*18/0.6, surto*24/0.3@5',
      'sobrecarga*16/0.7, interferencia*10/0.9@4',
      'isolamento*16/0.7, ruido*10/0.8@3, instabilidade*12/0.6@8',
      'sobrecarga*20/0.6, surto*30/0.25@5, interferencia*10/0.8@9',
    ),
    objectives: [{ kind: 'noLeak' }, { kind: 'maxUnits', n: 10 }],
    reward: { ec: 320, xp: 420 },
    quiz: 'q5-1',
    requires: '4-3',
    tips: ['Fontes DC no início pagam as melhorias das ondas finais.'],
  },
  {
    id: '5-2',
    mode: 'campaign',
    chapter: 5,
    name: 'Indução mútua',
    concept: 'Transformador e lei de Faraday',
    briefing: 'Pressão simultânea nas duas entradas do barramento, com muita Interferência e Isolamento.',
    map: 'barramento',
    startCredits: 950,
    lives: 20,
    hpScale: 2.35,
    waves: waves(
      'curto*16/0.5#0, surto*16/0.4#1',
      'isolamento*10/0.9#0, interferencia*6/1.2#1',
      'sobrecarga*10/1#1, ruido*8/0.9#0',
      'instabilidade*14/0.7, surto*20/0.3@4',
      'interferencia*10/0.9#0, isolamento*10/0.9#1',
      'sobrecarga*14/0.8, curto*24/0.35@4',
      'ruido*12/0.8#1, isolamento*12/0.8#0',
      'interferencia*12/0.8, sobrecarga*12/0.8@4',
      'isolamento*18/0.6, surto*30/0.25@5',
      'sobrecarga*18/0.6#0, interferencia*12/0.7#1, ruido*10/0.7@6',
    ),
    objectives: [{ kind: 'maxLeaks', n: 2 }, { kind: 'minClasses', n: 5 }],
    reward: { ec: 340, xp: 440 },
    quiz: 'q5-2',
    requires: '5-1',
    tips: ['Diodos no trecho comum protegem a maior parte da defesa.'],
  },
  {
    id: '5-3',
    mode: 'campaign',
    chapter: 5,
    name: 'Campo elétrico × campo magnético',
    concept: 'Capacitor e indutor armazenam energia de formas diferentes',
    briefing: 'A Falha em Cascata e a Saturação do Núcleo atacam juntas na malha.',
    map: 'malha',
    startCredits: 1000,
    lives: 20,
    hpScale: 2.5,
    waves: waves(
      'curto*30/0.35',
      'sobrecarga*12/0.9, surto*20/0.3@4',
      'isolamento*14/0.8, ruido*8/1@3',
      'instabilidade*18/0.6',
      'interferencia*12/0.8, sobrecarga*10/0.9@4',
      'cascata*1~0.8, curto*16/0.5@5',
      'isolamento*16/0.7, surto*26/0.3@4',
      'sobrecarga*18/0.6, ruido*10/0.8@4',
      'instabilidade*20/0.5, interferencia*10/0.8@5',
      'isolamento*20/0.55, sobrecarga*14/0.7@5',
      'surto*40/0.22, ruido*14/0.6@4',
      'saturacao*1, cascata*1@14, sobrecarga*10/1@6',
    ),
    objectives: [{ kind: 'noLeak' }, { kind: 'noSell' }],
    reward: { ec: 380, xp: 480 },
    quiz: 'q5-3',
    requires: '5-2',
    tips: ['Evolua suas unidades principais antes desta fase.'],
  },

  // ---------------- Final ----------------
  {
    id: 'F-1',
    mode: 'campaign',
    chapter: 6,
    name: 'Proteção do Núcleo Eletromagnético',
    concept: 'Integração de todos os conceitos',
    briefing:
      'O Colapso do Sistema avança pelas duas rotas do núcleo. Ao perder vida, emite pulsos que desativam unidades. Se alcançar o núcleo, a instalação cai.',
    map: 'nucleo',
    startCredits: 1100,
    lives: 25,
    hpScale: 2.7,
    waves: waves(
      'curto*20/0.5#0, curto*20/0.5#1',
      'surto*24/0.3, sobrecarga*6/1.4@4',
      'isolamento*12/0.8, ruido*8/1@3',
      'interferencia*10/0.9, instabilidade*12/0.7@4',
      'sobrecarga*14/0.8#0, surto*24/0.3#1',
      'arco*1#0, arco*1@6#1',
      'isolamento*16/0.7, interferencia*8/0.9@4',
      'instabilidade*20/0.5, ruido*12/0.7@4',
      'sobrecarga*18/0.6, surto*30/0.25@5',
      'saturacao*1#1, isolamento*14/0.7@4#0',
      'interferencia*14/0.7, curto*36/0.3@3',
      'sobrecarga*22/0.5, instabilidade*16/0.6@5',
      'cascata*1#0, isolamento*18/0.6@5#1',
      'surto*50/0.18, ruido*16/0.5@4, sobrecarga*14/0.6@8',
      'colapso*1~0.9, interferencia*10/1.4@4, sobrecarga*12/1.2@10',
    ),
    objectives: [{ kind: 'maxLeaks', n: 5 }, { kind: 'minClasses', n: 5 }],
    reward: { ec: 600, xp: 800 },
    quiz: 'qF-1',
    requires: '5-3',
    tips: ['Diodos reduzem o pulso do Colapso; a característica Isolamento também.', 'Varie os tipos de dano: o Colapso resiste levemente a todos.'],
  },

  // =================== Patch 1.1 — Expansão “Operação Circuito II” ===================

  // ---------------- Capítulo 7: Tela do Osciloscópio ----------------
  {
    id: '7-1',
    mode: 'campaign',
    chapter: 7,
    variant: 1,
    name: 'Sinal de referência',
    concept: 'Tensão alternada, período e frequência',
    briefing:
      'O osciloscópio mostra uma senoide estável — e os Transientes Elétricos aproveitam cada pico para disparar pela tela. O caminho passa várias vezes perto dos mesmos pontos: aproveite os vales e as cristas.',
    map: 'osciloscopio',
    startCredits: 900,
    lives: 20,
    hpScale: 1.9,
    elites: ['transiente', 'franco'],
    waves: waves(
      'curto*16/0.6, surto*8/0.5@4',
      'transiente*8/0.8',
      'curto*20/0.5, transiente*6/0.7@5',
      'sobrecarga*6/1.4, surto*14/0.4@3',
      'ruido*8/1, transiente*10/0.5@4',
      'instabilidade*10/0.8, curto*20/0.4@3',
      'transiente*20/0.35, sobrecarga*6/1.2@5',
      'arco*1~0.9, transiente*14/0.5@4',
    ),
    objectives: [{ kind: 'maxLeaks', n: 2 }, { kind: 'maxUnits', n: 9 }],
    reward: { ec: 220, xp: 320 },
    quiz: 'q7-1',
    unlocks: ['resistor'],
    requires: '4-3',
    tips: ['Transientes perdem vida sozinhos: desacelere-os e o tempo trabalha a seu favor.', 'Os lóbulos da senoide permitem cobrir dois trechos com uma unidade.'],
  },
  {
    id: '7-2',
    mode: 'campaign',
    chapter: 7,
    variant: 2,
    name: 'Ruído na ponta de prova',
    concept: 'Interferência e relação sinal-ruído',
    briefing:
      'A ponta de prova está mal aterrada: duas regiões da tela ficam inutilizáveis e a EMI irradiada encurta o alcance das unidades. Menos créditos iniciais: priorize proteção.',
    map: 'osciloscopio',
    startCredits: 750,
    lives: 20,
    hpScale: 2,
    elites: ['emi', 'transiente'],
    blocked: [
      { x: 20, y: 150, w: 150, h: 100, label: 'Ponta de prova (sem aterramento)' },
      { x: 690, y: 295, w: 170, h: 105, label: 'Ponta de prova (sem aterramento)' },
    ],
    waves: waves(
      'curto*18/0.5, ruido*4/1.5@4',
      'emi*4/2, surto*14/0.4@3',
      'transiente*12/0.5, ruido*6/1@4',
      'sobrecarga*8/1, emi*4/1.8@5',
      'interferencia*6/1.4, transiente*12/0.5@3',
      'ruido*12/0.7, emi*6/1.2@4',
      'isolamento*10/0.9, transiente*16/0.4@4',
      'emi*10/0.9, sobrecarga*10/0.9@5, transiente*14/0.4@9',
    ),
    objectives: [{ kind: 'maxLeaks', n: 3 }, { kind: 'minClasses', n: 4 }],
    reward: { ec: 240, xp: 340 },
    quiz: 'q7-2',
    unlocks: ['mosfet'],
    requires: '7-1',
    tips: ['Diodos tornam as unidades imunes à EMI e ao Ruído.', 'O Resistor ignora blindagem: bom contra Sobrecargas.'],
  },
  {
    id: '7-3',
    mode: 'campaign',
    chapter: 7,
    variant: 3,
    name: 'Disparo (trigger)',
    concept: 'Transitórios e borda de disparo',
    briefing:
      'O trigger do osciloscópio foi ajustado na borda de subida: rajadas de Transientes e Curtos Francos chegam em sincronia, e dois Arcos Elétricos fecham a fase. A linha de base central está bloqueada.',
    map: 'osciloscopio',
    startCredits: 1000,
    lives: 20,
    hpScale: 2.2,
    elites: ['franco', 'transiente', 'sobretensao'],
    blocked: [{ x: 380, y: 236, w: 200, h: 68, label: 'Linha de base (referência)' }],
    waves: waves(
      'transiente*16/0.4',
      'franco*6/1.2, curto*20/0.4@3',
      'transiente*24/0.3, surto*16/0.3@4',
      'sobretensao*3/2.5, transiente*12/0.4@3',
      'instabilidade*14/0.6, franco*6/1@4',
      'transiente*30/0.25, emi*6/1.2@5',
      'arco*1, transiente*20/0.3@3',
      'sobretensao*6/1.6, franco*8/0.9@4, transiente*24/0.3@8',
      'arco*1, arco*1@5, transiente*30/0.25@3',
    ),
    objectives: [{ kind: 'maxLeaks', n: 3 }, { kind: 'noSell' }],
    reward: { ec: 280, xp: 380 },
    quiz: 'q7-3',
    unlocks: ['transistor'],
    requires: '7-2',
    tips: ['Curtos Francos superaquecem unidades ao explodir: destrua-os longe da sua defesa.', 'Diodos reduzem o superaquecimento de 3 s para 1 s.'],
  },

  // ---------------- Capítulo 8: Ponte Retificadora ----------------
  {
    id: '8-1',
    mode: 'campaign',
    chapter: 8,
    variant: 1,
    name: 'Meia onda',
    concept: 'Retificação e corrente de fuga',
    briefing:
      'A entrada se divide nos dois ramos da ponte. Fugas de Corrente regeneram quando deixadas em paz: dano constante é a resposta.',
    map: 'ponte',
    startCredits: 950,
    lives: 20,
    hpScale: 2.2,
    elites: ['fuga', 'sobretensao'],
    waves: waves(
      'curto*20/0.5',
      'fuga*5/1.6, surto*12/0.4@3',
      'sobrecarga*8/1.1, curto*16/0.5@4',
      'fuga*8/1.2, ruido*6/1@4',
      'isolamento*10/0.9, fuga*6/1.1@5',
      'sobretensao*3/2.4, curto*24/0.4@3',
      'fuga*12/0.8, instabilidade*10/0.7@4',
      'cascata*1~0.8, fuga*10/0.9@6',
    ),
    objectives: [{ kind: 'maxLeaks', n: 2 }, { kind: 'maxUnits', n: 10 }],
    reward: { ec: 260, xp: 360 },
    quiz: 'q8-1',
    requires: '7-3',
    tips: ['O calor do Resistor bloqueia a regeneração da Fuga de Corrente.', 'Os dois ramos se reencontram perto do núcleo: um bom ponto de defesa final.'],
  },
  {
    id: '8-2',
    mode: 'campaign',
    chapter: 8,
    variant: 2,
    name: 'Onda completa',
    concept: 'Ponte de diodos e sobretensão',
    briefing:
      'O capacitor de filtro no centro da ponte está energizado: o miolo do losango fica bloqueado. Sobretensões Sustentadas alternam proteção entre tipos de dano — varie a equipe.',
    map: 'ponte',
    startCredits: 900,
    lives: 20,
    hpScale: 2.35,
    elites: ['sobretensao', 'saturado'],
    blocked: [{ x: 375, y: 195, w: 210, h: 150, label: 'Capacitor de filtro (energizado)' }],
    waves: waves(
      'sobretensao*3/2.2, curto*18/0.5@3',
      'fuga*10/1, surto*16/0.35@4',
      'sobretensao*5/1.8, ruido*8/0.9@3',
      'isolamento*12/0.8, fuga*8/1@5',
      'sobretensao*6/1.6, sobrecarga*8/1@4',
      'emi*6/1.3, fuga*12/0.8@4',
      'saturado*2/4, curto*24/0.4@3',
      'sobretensao*8/1.3, fuga*12/0.8@5, saturado*2/5@10',
    ),
    objectives: [{ kind: 'maxLeaks', n: 3 }, { kind: 'minClasses', n: 4 }],
    reward: { ec: 280, xp: 380 },
    quiz: 'q8-2',
    unlocks: ['trafopot'],
    requires: '8-1',
    tips: ['Diodos (grampeamento) removem a proteção da Sobretensão por 2 s.', 'Sem o centro, defenda cada ramo separadamente ou a junção final.'],
  },
  {
    id: '8-3',
    mode: 'campaign',
    chapter: 8,
    variant: 3,
    name: 'Diodos em ponte',
    concept: 'Continuidade do circuito e saturação',
    briefing:
      'Circuitos Abertos só podem ser atingidos por indução enquanto estão abertos, e a Saturação do Núcleo aparece duas vezes. Muitos créditos iniciais, mas apenas 12 vidas.',
    map: 'ponte',
    startCredits: 1300,
    lives: 12,
    hpScale: 2.5,
    elites: ['aberto', 'saturado', 'fuga'],
    waves: waves(
      'aberto*6/1.4, curto*16/0.5@3',
      'fuga*10/0.9, aberto*6/1.2@4',
      'sobretensao*6/1.5, surto*20/0.3@3',
      'aberto*12/0.8, isolamento*8/1@4',
      'saturado*3/3, fuga*10/0.9@4',
      'aberto*14/0.7, sobretensao*6/1.4@5',
      'saturacao*1, aberto*10/0.8@5',
      'sobretensao*8/1.2, aberto*14/0.6@4, saturado*3/3@9',
      'saturacao*1~1.2, fuga*14/0.7@4, aberto*12/0.7@8',
    ),
    objectives: [{ kind: 'maxLeaks', n: 2 }, { kind: 'noSell' }],
    reward: { ec: 320, xp: 420 },
    quiz: 'q8-3',
    unlocks: ['retificador'],
    requires: '8-2',
    tips: ['Bobina, indutor, RL e oscilador atingem o Circuito Aberto mesmo quando ele “abre”.', 'Contra a Saturação, use capacitores, relés e resistores.'],
  },

  // ---------------- Capítulo 9: Subestação ----------------
  {
    id: '9-1',
    mode: 'campaign',
    chapter: 9,
    variant: 1,
    name: 'Barramento energizado',
    concept: 'Corrente de curto-circuito e proteção',
    briefing:
      'Curtos-Circuitos Francos percorrem os barramentos da subestação. O laço do caminho cruza a si mesmo: o cruzamento concentra quatro passagens.',
    map: 'subestacao',
    startCredits: 1000,
    lives: 20,
    hpScale: 2.4,
    elites: ['franco', 'sobrecarga'],
    waves: waves(
      'curto*24/0.45',
      'franco*5/1.4, surto*14/0.35@3',
      'sobrecarga*10/1, franco*4/1.5@4',
      'franco*8/1, ruido*8/0.9@4',
      'isolamento*12/0.8, curto*24/0.4@3',
      'franco*10/0.9, sobretensao*4/2@4',
      'saturado*2/4, franco*8/1@4',
      'arco*1, franco*12/0.8@4',
    ),
    objectives: [{ kind: 'maxLeaks', n: 2 }, { kind: 'maxUnits', n: 10 }],
    reward: { ec: 300, xp: 400 },
    quiz: 'q9-1',
    unlocks: ['igbt'],
    requires: '8-3',
    tips: ['O cruzamento é forte, mas Curtos Francos que explodem ali superaquecem tudo ao redor.'],
  },
  {
    id: '9-2',
    mode: 'campaign',
    chapter: 9,
    variant: 2,
    name: 'Cruzamento de linhas',
    concept: 'Seccionamento e núcleos saturados',
    briefing:
      'A chave seccionadora isolou a área do cruzamento: não é possível construir ali. Núcleos Saturados blindados avançam devagar — prepare dano térmico e descargas.',
    map: 'subestacao',
    startCredits: 950,
    lives: 20,
    hpScale: 2.55,
    elites: ['saturado', 'franco'],
    blocked: [{ x: 655, y: 205, w: 130, h: 130, label: 'Seccionadora (área isolada)' }],
    waves: waves(
      'saturado*2/4, curto*20/0.45@3',
      'franco*8/1, fuga*6/1.2@4',
      'saturado*3/3, surto*24/0.3@3',
      'sobretensao*6/1.5, emi*4/1.6@4',
      'saturado*4/2.5, isolamento*10/0.9@4',
      'franco*12/0.8, aberto*8/1@4',
      'saturado*5/2.2, sobretensao*6/1.4@5',
      'cascata*1, saturado*3/3@6',
    ),
    objectives: [{ kind: 'maxLeaks', n: 3 }, { kind: 'minClasses', n: 4 }],
    reward: { ec: 320, xp: 420 },
    quiz: 'q9-2',
    requires: '9-1',
    tips: ['O Núcleo Saturado resiste a dano magnético e é fraco contra descarga e calor.'],
  },
  {
    id: '9-3',
    mode: 'campaign',
    chapter: 9,
    variant: 3,
    name: 'Harmônicas na rede',
    concept: 'Ressonância e amortecimento',
    briefing:
      'A Ressonância Harmônica acelera tudo ao seu redor a cada 8 s. Amorteça-a com resistores e cancele-a com ondas em oposição de fase.',
    map: 'subestacao',
    startCredits: 1100,
    lives: 20,
    hpScale: 2.7,
    elites: ['transiente', 'saturado', 'franco'],
    waves: waves(
      'transiente*20/0.35, curto*16/0.5@3',
      'franco*8/0.9, instabilidade*10/0.7@4',
      'emi*6/1.2, transiente*24/0.3@3',
      'saturado*3/3, fuga*10/0.9@4',
      'sobretensao*6/1.4, transiente*24/0.3@4',
      'aberto*12/0.8, franco*10/0.8@4',
      'ressonancia*1~0.8, transiente*16/0.4@5',
      'saturado*4/2.5, instabilidade*16/0.5@4, franco*10/0.8@8',
      'ressonancia*1, transiente*30/0.25@4, emi*8/1@8',
    ),
    objectives: [{ kind: 'maxLeaks', n: 3 }, { kind: 'noSell' }],
    reward: { ec: 360, xp: 460 },
    quiz: 'q9-3',
    unlocks: ['oscilador'],
    requires: '9-2',
    tips: ['Relés e o CI 555 seguram os inimigos acelerados pela onda harmônica.'],
  },

  // ---------------- Capítulo 10: Interior do CI ----------------
  {
    id: '10-1',
    mode: 'campaign',
    chapter: 10,
    variant: 1,
    name: 'Portas lógicas',
    concept: 'Níveis lógicos, continuidade e interferência',
    briefing:
      'Dentro do chip, as trilhas são curtas e cheias de quinas. Circuitos Abertos e EMI testam unidades magnéticas e protegidas.',
    map: 'chip',
    startCredits: 1000,
    lives: 20,
    hpScale: 2.6,
    elites: ['aberto', 'emi'],
    waves: waves(
      'curto*24/0.4, aberto*4/1.5@4',
      'emi*6/1.2, surto*20/0.3@3',
      'aberto*10/0.9, ruido*8/0.9@4',
      'fuga*10/0.9, emi*6/1.1@4',
      'isolamento*12/0.7, aberto*10/0.8@4',
      'transiente*24/0.3, emi*8/1@4',
      'sobretensao*6/1.4, aberto*12/0.7@4',
      'saturacao*1~0.9, emi*8/1@5, aberto*10/0.8@9',
    ),
    objectives: [{ kind: 'maxLeaks', n: 2 }, { kind: 'minClasses', n: 4 }],
    reward: { ec: 320, xp: 420 },
    quiz: 'q10-1',
    unlocks: ['cristal'],
    requires: '9-3',
    tips: ['Quinas próximas permitem que uma unidade cubra três ou quatro trechos.'],
  },
  {
    id: '10-2',
    mode: 'campaign',
    chapter: 10,
    variant: 2,
    name: 'Sala limpa',
    concept: 'Semicondutores e restrições de projeto',
    briefing:
      'Blocos de memória e a ULA ocupam boa parte do chip: há poucos lugares livres, poucos créditos e apenas 15 vidas. Cada posicionamento importa.',
    map: 'chip',
    startCredits: 700,
    lives: 15,
    hpScale: 2.6,
    elites: ['transiente', 'aberto', 'sobretensao'],
    blocked: [
      { x: 138, y: 240, w: 72, h: 200, label: 'Bloco de memória' },
      { x: 360, y: 105, w: 88, h: 150, label: 'Unidade lógica (ULA)' },
      { x: 618, y: 110, w: 64, h: 160, label: 'Registradores' },
    ],
    waves: waves(
      'curto*30/0.35',
      'aberto*10/0.9, transiente*16/0.4@4',
      'emi*8/1, fuga*8/1.1@3',
      'sobretensao*6/1.5, surto*24/0.3@3',
      'franco*10/0.9, aberto*10/0.8@4',
      'saturado*3/3, emi*6/1.1@4',
      'transiente*30/0.25, fuga*12/0.8@4',
      'aberto*16/0.6, sobretensao*8/1.2@5, emi*8/1@9',
    ),
    objectives: [{ kind: 'maxLeaks', n: 2 }, { kind: 'maxUnits', n: 8 }],
    reward: { ec: 340, xp: 440 },
    quiz: 'q10-2',
    requires: '10-1',
    tips: ['Retificadores transformam o dano de um grupo compacto em créditos.'],
  },
  {
    id: '10-3',
    mode: 'campaign',
    chapter: 10,
    variant: 3,
    name: 'Falha no circuito integrado',
    concept: 'Temporização e falhas em cascata',
    briefing:
      'Uma Falha em Cascata se espalha pelo chip, seguida pela Ressonância Harmônica. Sincronize a defesa: muitos inimigos chegam ao mesmo tempo.',
    map: 'chip',
    startCredits: 1200,
    lives: 20,
    hpScale: 2.85,
    elites: ['fuga', 'saturado', 'aberto'],
    waves: waves(
      'fuga*12/0.8, curto*24/0.4@3',
      'aberto*14/0.7, emi*6/1.1@4',
      'saturado*4/2.6, transiente*24/0.3@3',
      'franco*12/0.8, sobretensao*6/1.4@4',
      'cascata*1, aberto*10/0.8@5',
      'emi*10/0.9, fuga*14/0.7@4',
      'saturado*5/2.2, transiente*30/0.25@4',
      'ressonancia*1, aberto*14/0.7@5',
      'cascata*1~1.1, ressonancia*1@12~0.8, sobretensao*8/1.2@4',
    ),
    objectives: [{ kind: 'maxLeaks', n: 3 }, { kind: 'noSell' }],
    reward: { ec: 380, xp: 480 },
    quiz: 'q10-3',
    unlocks: ['ci555'],
    requires: '10-2',
    tips: ['Guarde habilidades para as ondas de chefe.'],
  },

  // ---------------- Capítulo 11: Linha de Transmissão ----------------
  {
    id: '11-1',
    mode: 'campaign',
    chapter: 11,
    variant: 1,
    name: 'Sistema trifásico',
    concept: 'Transmissão em três fases',
    briefing:
      'Três linhas chegam de direções diferentes e se unem em um tronco longo. Ondas atacam as três fases ao mesmo tempo.',
    map: 'transmissao',
    startCredits: 1150,
    lives: 20,
    hpScale: 2.8,
    elites: ['transiente', 'franco', 'sobretensao'],
    waves: waves(
      'curto*12/0.5#0, curto*12/0.5#1, curto*12/0.5#2',
      'transiente*12/0.4#0, transiente*12/0.4#2',
      'franco*6/1#1, surto*18/0.3@3',
      'sobretensao*3/2#0, sobretensao*3/2@3#2, fuga*8/1@4#1',
      'transiente*30/0.25, emi*6/1.2@4',
      'saturado*3/3#1, franco*10/0.8@4',
      'aberto*12/0.7, transiente*24/0.3@4',
      'arco*1#0, arco*1@4#2, transiente*20/0.3@6#1',
    ),
    objectives: [{ kind: 'maxLeaks', n: 3 }, { kind: 'minClasses', n: 4 }],
    reward: { ec: 360, xp: 460 },
    quiz: 'q11-1',
    unlocks: ['ampop'],
    requires: '10-3',
    tips: ['O tronco comum é longo: unidades no zigue-zague cobrem as três fases.'],
  },
  {
    id: '11-2',
    mode: 'campaign',
    chapter: 11,
    variant: 2,
    name: 'Linha sobrecarregada',
    concept: 'Sobretensão e para-raios',
    briefing:
      'O para-raios na junção das linhas está energizado: não é possível construir ali. Sobretensões e Núcleos Saturados chegam em massa.',
    map: 'transmissao',
    startCredits: 1000,
    lives: 20,
    hpScale: 2.95,
    elites: ['saturado', 'sobretensao', 'fuga'],
    blocked: [{ x: 300, y: 195, w: 150, h: 150, label: 'Para-raios (área energizada)' }],
    waves: waves(
      'sobretensao*6/1.4, curto*24/0.4@3',
      'saturado*3/3, transiente*20/0.3@3',
      'fuga*12/0.8, sobretensao*6/1.3@4',
      'franco*12/0.8, emi*8/1@4',
      'saturado*5/2.2, aberto*12/0.7@4',
      'sobretensao*10/1, transiente*30/0.25@4',
      'saturado*6/2, fuga*14/0.7@5',
      'cascata*1, sobretensao*8/1.1@5, saturado*3/3@10',
    ),
    objectives: [{ kind: 'maxLeaks', n: 3 }, { kind: 'noSell' }],
    reward: { ec: 380, xp: 480 },
    quiz: 'q11-2',
    requires: '11-1',
    tips: ['Diodos removem a proteção da Sobretensão; capacitores e resistores vencem a blindagem dos Saturados.'],
  },
  {
    id: '11-3',
    mode: 'campaign',
    chapter: 11,
    variant: 3,
    name: 'Apagão Total',
    concept: 'Integração da expansão',
    briefing:
      'O Apagão Total avança pelo tronco da linha. Em 75% da vida, rejeita carga e desliga fontes e retificadores; em 50%, libera Fugas de Corrente; em 25%, passa a abrir o circuito. Se alcançar o núcleo, a rede cai.',
    map: 'transmissao',
    startCredits: 1400,
    lives: 25,
    hpScale: 3,
    elites: ['saturado', 'sobretensao', 'aberto', 'franco'],
    waves: waves(
      'curto*16/0.4#0, curto*16/0.4#1, curto*16/0.4#2',
      'transiente*30/0.25, franco*8/0.9@4',
      'saturado*4/2.5, sobretensao*6/1.3@4',
      'fuga*14/0.7, aberto*12/0.7@4',
      'ressonancia*1~0.8, emi*8/1@4',
      'saturado*6/2, franco*12/0.8@4',
      'transiente*36/0.2, sobretensao*8/1.2@5',
      'cascata*1, aberto*16/0.6@4',
      'saturado*6/2, fuga*16/0.6@4, emi*8/1@8',
      'apagao*1~0.8, transiente*20/0.4@6, saturado*3/3@14',
    ),
    // o chefe final já é a maior ameaça: o Impossível desta fase dispensa a “instabilidade de circuito”
    modifiers: { impossivel: ['ressonancia_magnetica', 'colapso_tensao', 'oscilacao_frequencia'] },
    objectives: [{ kind: 'maxLeaks', n: 5 }, { kind: 'minClasses', n: 5 }],
    reward: { ec: 700, xp: 900 },
    quiz: 'q11-3',
    unlocks: ['tesla'],
    requires: '11-2',
    tips: ['Compre o que precisar antes dos 75% de vida do chefe: depois, a renda para por 8 s.', 'Na fase final do chefe, só dano magnético o atinge quando o circuito abre.'],
  },

  // ---------------- Modo de chefes e desafios ----------------
  {
    id: 'B-1',
    mode: 'boss',
    chapter: 0,
    name: 'Sequência de Falhas',
    concept: 'Modo de chefes',
    briefing: 'Enfrente os quatro chefes em sequência, com poucas escoltas. Sem tempo para economia: comece forte.',
    map: 'nucleo',
    startCredits: 1600,
    lives: 20,
    hpScale: 1.6,
    waves: waves(
      'arco*1, surto*10/0.6@3',
      'saturacao*1, curto*14/0.6@3',
      'cascata*1, isolamento*6/1.4@4',
      'arco*1#0, saturacao*1#1',
      'colapso*1~0.85, ruido*6/1.5@3',
    ),
    objectives: [{ kind: 'maxLeaks', n: 0 }, { kind: 'minClasses', n: 4 }],
    reward: { ec: 300, xp: 300 },
    requires: '3-3',
    tips: ['Cada chefe testa uma resposta diferente: controle, variedade de dano, golpes fortes e proteção.'],
  },
  {
    id: 'D-1',
    mode: 'challenge',
    chapter: 0,
    name: 'Orçamento mínimo',
    concept: 'Desafio técnico: créditos reduzidos e sem Fonte DC',
    briefing: 'Apenas 320 créditos iniciais e nenhuma Fonte DC. Cada compra precisa valer a pena.',
    map: 'placa',
    startCredits: 320,
    lives: 15,
    hpScale: 1.15,
    waves: waves(
      'curto*8/1.2',
      'surto*10/0.8',
      'curto*14/0.8, sobrecarga*2/3@5',
      'surto*14/0.6, curto*10/0.8@3',
      'sobrecarga*5/2',
      'curto*20/0.5, surto*10/0.6@5',
      'ruido*6/1.4, sobrecarga*4/2@4',
      'arco*1~0.8, curto*14/0.8@3',
    ),
    objectives: [{ kind: 'noLeak' }, { kind: 'maxUnits', n: 6 }],
    reward: { ec: 180, xp: 200 },
    requires: '2-3',
    allowed: ['rele', 'bobina', 'indutor', 'diodo', 'capacitor', 'rl', 'transformador'],
    tips: ['Melhorar uma unidade costuma render mais que comprar outra.'],
  },
  {
    id: 'D-2',
    mode: 'challenge',
    chapter: 0,
    name: 'Somente componentes com bobina',
    concept: 'Desafio técnico: apenas relé, bobina, indutor e circuito RL',
    briefing: 'Apenas componentes eletromagnéticos com bobina. Interferências e Isolamentos testam a composição.',
    map: 'malha',
    startCredits: 900,
    lives: 20,
    hpScale: 1.8,
    waves: waves(
      'curto*20/0.6',
      'surto*16/0.45, sobrecarga*4/1.8@4',
      'isolamento*8/1.2',
      'interferencia*6/1.4, curto*16/0.5@3',
      'instabilidade*12/0.8, ruido*6/1.3@4',
      'sobrecarga*10/1, isolamento*6/1.2@5',
      'interferencia*8/1.1, surto*20/0.35@4',
      'saturacao*1~0.8, curto*16/0.6@4',
      'isolamento*12/0.8, sobrecarga*10/0.9@5',
      'instabilidade*16/0.6, interferencia*8/1@4, sobrecarga*10/0.9@9',
    ),
    objectives: [{ kind: 'maxLeaks', n: 3 }, { kind: 'noSell' }],
    reward: { ec: 260, xp: 300 },
    requires: '4-3',
    allowed: ['rele', 'bobina', 'indutor', 'rl'],
    // escoltas vencíveis só com componentes de bobina (sem Saturados nem Sobretensões)
    elites: ['franco', 'fuga'],
    modifiers: { dificil: ['oscilacao_frequencia'], impossivel: ['ressonancia_magnetica', 'sobrecarga_sistemica', 'oscilacao_frequencia'] },
    tips: ['Contra Isolamento, o Relé (comutação) é a principal fonte de dano não magnético.'],
  },
];

// Variante (1ª/2ª/3ª fase do cenário) das fases originais: ordem das fases no mesmo mapa.
{
  const seen: Partial<Record<MapId, number>> = {};
  for (const st of STAGES) {
    const n = (seen[st.map] ?? 0) + 1;
    seen[st.map] = n;
    st.variant ??= ((n - 1) % 3) + 1;
  }
}

export const STAGE_BY_ID: Record<string, StageDef> = Object.fromEntries(STAGES.map((s) => [s.id, s]));
export const CAMPAIGN = STAGES.filter((s) => s.mode === 'campaign');

export function objectiveLabel(o: Objective): string {
  switch (o.kind) {
    case 'noLeak':
      return 'Não perder nenhuma vida';
    case 'maxLeaks':
      return o.n === 0 ? 'Não perder nenhuma vida' : `Perder no máximo ${o.n} vidas`;
    case 'maxUnits':
      return `Usar no máximo ${o.n} unidades ao mesmo tempo`;
    case 'minClasses':
      return `Vencer com unidades de ${o.n} classes diferentes`;
    case 'noSell':
      return 'Não vender nenhuma unidade';
    case 'withoutUnit':
      return `Vencer sem usar ${o.unit}`;
  }
}
