import type { DamageType, EnemyId, UnitId } from '../types';

/**
 * Inimigos: falhas e perturbações em sistemas eletroeletrônicos.
 * `resist` multiplica o dano recebido por tipo (0,5 = metade; 2 = dobro).
 * `armor` é uma redução fixa por golpe (o golpe nunca cai abaixo de 30% do original).
 */

export interface EnemyBehavior {
  /** Interferência: atordoa unidades próximas periodicamente */
  pulseEvery?: number;
  pulseRadius?: number;
  pulseStun?: number;
  /** Ruído: reduz a cadência das unidades próximas */
  noiseRadius?: number;
  noise?: number;
  /** Instabilidade: alterna a velocidade */
  toggleEvery?: number;
  slowFactor?: number;
  fastFactor?: number;
  /** imune a desaceleração e interrupção */
  controlImmune?: boolean;
  /** Arco: salta adiante no caminho */
  dashEvery?: number;
  dashDistance?: number;
  /** Saturação: dano magnético perde eficácia conforme é absorvido */
  saturates?: boolean;
  /** Cascata: gera inimigos */
  spawnEvery?: number;
  spawnId?: EnemyId;
  spawnCount?: number;
  /** Chefes: limiares de vida (fração) em que mudam de fase */
  phases?: number[];
  /** ações executadas em cada mudança de fase (padrão: pulso + escudo) */
  phaseActions?: PhaseAction[][];
  /* ---------- Patch 1.1 ---------- */
  /** Curto-Circuito Franco: ao ser destruído, superaquece unidades próximas (−cadência) */
  deathBurst?: { radius: number; slow: number; dur: number };
  /** Sobretensão: alterna a imunidade (85% de redução) entre tipos de dano */
  cycleImmune?: { every: number; types: DamageType[] };
  /** EMI irradiada: reduz o alcance das unidades próximas */
  rangeAura?: { radius: number; amount: number };
  /** Fuga de Corrente: regenera (fração da vida máx./s) se ficar `delay` s sem dano */
  regen?: { delay: number; rate: number };
  /** Circuito Aberto: periodicamente “abre” e só o dano magnético (indução) o atinge */
  openCycle?: { every: number; open: number };
  /** Transiente: velocidade imprevisível e vida que decai sozinha */
  erratic?: { every: number; min: number; max: number };
  decay?: number;
  /** Ressonância Harmônica: acelera os inimigos próximos periodicamente */
  harmonic?: { every: number; radius: number; boost: number; dur: number };
  /** Apagão: reduz o dano das unidades próximas (subtensão) */
  brownout?: { radius: number; amount: number };
  /** inimigo de elite (recebe mais efeito de alguns modificadores) */
  elite?: boolean;
  /* ---------- Patch 1.2 ---------- */
  /**
   * Dielétrico Rompido: acumula o dano ELÉTRICO recebido; ao passar do limiar, o isolamento
   * rompe e ele perde as resistências por `dur` segundos (e sofre +25% de dano).
   */
  dielectric?: { threshold: number; dur: number };
  /**
   * Interferência na cadência das unidades próximas. Sem `every`, é contínua (Curto-Circuito
   * Ambulante); com `every`/`dur`, é periódica (Oscilador Parasita).
   */
  jam?: { radius: number; amount: number; every?: number; dur?: number };
  /** Resistência parcial a controle (0,6 = sofre 40% do atordoamento e da lentidão). */
  controlResist?: number;
  /**
   * Supercapacitor Instável: acumula energia ao longo do percurso (fração da vida máxima por
   * segundo, até `max`), vira escudo, e descarrega ao ser destruído.
   */
  accumulate?: { rate: number; max: number };
  deathDischarge?: { radius: number; stun: number };
  /**
   * Semicondutor Reverso: polarização reversa. Bloqueia a maior parte do dano de comutação e
   * grampeamento, MAS um golpe de grampeamento (diodo) o coloca em condução direta por
   * `dur` s — nessa janela recebe dano total e `bonus` extra.
   */
  reverse?: { block: number; dur: number; bonus: number };
  /** Arco Voltaico: descargas de contato que desativam unidades próximas ao passar. */
  contact?: { every: number; radius: number; stun: number };
  /** Arco Voltaico: alterna qual tipo de dano resiste (resistências variáveis). */
  cycleResist?: { every: number; types: DamageType[]; amount: number };
  /**
   * Saturação Profunda: enquanto o medidor de saturação não enche, o dano MAGNÉTICO não
   * reduz a vida — só preenche o medidor (e o desacelera). Cheio, ele fica totalmente
   * vulnerável por `dur` s. Dano térmico enche o medidor `thermalMul`× mais rápido.
   */
  satMeter?: { need: number; dur: number; thermalMul: number };
  /**
   * §13 — Aniquilação eletromagnética. Ao atingir `at` (fração da vida máxima), o chefe para,
   * carrega por `charge` segundos e então DESTRÓI todas as unidades posicionadas. Acontece
   * uma única vez por chefe; nenhuma proteção convencional evita a remoção.
   */
  annihilate?: { at: number; charge: number };
}

export type PhaseAction = 'emp' | 'shield' | 'blackout' | 'spawnFuga' | 'spawnTrans' | 'open';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  speed: number;
  armor: number;
  reward: number;
  /** vidas perdidas ao alcançar o núcleo */
  leak: number;
  radius: number;
  color: string;
  boss?: boolean;
  resist: Partial<Record<DamageType, number>>;
  behavior: EnemyBehavior;
  /** multiplicadores de dano recebido de unidades específicas (fraquezas temáticas) */
  weakTo?: Partial<Record<UnitId, number>>;
  /** frases curtas para a interface */
  traits: string[];
  tech: string;
  counter: string;
}

/* ====================================================================== */
/* §13 — Chefe final do modo Impossível                                    */
/* ====================================================================== */

/**
 * SINGULARIDADE ELETROMAGNÉTICA — uma instalação de potência que perdeu o controle de si
 * mesma: o plasma do barramento deixou de ser contido, os campos se realimentam e o conjunto
 * caminha para uma falha catastrófica.
 *
 * Identidade: plasma, alta tensão, campos eletromagnéticos, saturação magnética, descargas e
 * instabilidade de potência. Tem barra de vida própria (com os marcos de fase e o limiar de
 * aniquilação), modelo exclusivo, animação de carregamento e aviso global.
 *
 * Aniquilação (§13.1): aos 25% da vida máxima, interrompe a movimentação, carrega por 3,5 s
 * com efeitos de concentração de energia e aviso global, e então remove TODAS as unidades
 * posicionadas. Uma única vez por chefe.
 */
const SINGULARIDADE: EnemyDef = {
  id: 'singularidade',
  name: 'Singularidade Eletromagnética',
  // 1.2: calibrada para que a aniquilação (25%) seja alcançável por uma composição forte
  // nas fases de hpScale alto — ver scripts de verificação no relatório do patch.
  hp: 24000,
  speed: 17,
  armor: 8,
  reward: 1600,
  leak: 99,
  radius: 34,
  color: '#ff5ff0',
  boss: true,
  // campos realimentados: resiste a tudo, sem imunidade a nada
  resist: { magnetico: 0.82, comutacao: 0.86, descarga: 0.86, grampeamento: 0.86, termico: 0.88 },
  behavior: {
    annihilate: { at: 0.25, charge: 3.5 },
    // saturação magnética do núcleo em colapso + descargas de contato do plasma
    saturates: true,
    contact: { every: 5, radius: 150, stun: 1.6 },
    cycleResist: { every: 6, types: ['magnetico', 'descarga', 'comutacao', 'termico'], amount: 0.35 },
    brownout: { radius: 170, amount: 0.18 },
    harmonic: { every: 11, radius: 230, boost: 0.35, dur: 3 },
    phases: [0.75, 0.5],
    phaseActions: [
      ['emp', 'shield', 'spawnTrans'],
      ['blackout', 'shield', 'spawnFuga'],
    ],
    spawnEvery: 10,
    spawnId: 'ambulante',
    spawnCount: 2,
    elite: true,
  },
  weakTo: { cristal: 1.25, igbt: 1.2 },
  traits: [
    'Chefe final do modo Impossível',
    'Instabilidade de potência: resiste a todos os tipos de dano e alterna qual resiste mais a cada 6 s',
    'Subtensão: unidades a até 170 causam −18% de dano',
    'Descarga de contato: a cada 5 s desativa por 1,6 s as unidades a até 150',
    'A cada 11 s, uma onda harmônica acelera os inimigos a até 230',
    'Gera 2 Curtos-Circuitos Ambulantes a cada 10 s',
    '75%: pulso, escudo e Transientes · 50%: rejeição de carga, escudo e Fugas',
    '25%: ANIQUILAÇÃO ELETROMAGNÉTICA — destrói TODAS as unidades posicionadas',
    'Alcançar o núcleo = derrota',
  ],
  tech:
    'Representa a falha catastrófica de um sistema eletroeletrônico de potência: quando a proteção não isola a falta a tempo, a energia armazenada nos barramentos, capacitores e indutores é liberada de uma vez. Em instalações reais, esse evento tem nome — arc flash: a pressão, a luz e o calor do arco destroem o painel inteiro em milissegundos. A “singularidade” é a licença poética para esse ponto sem retorno, em que a realimentação entre campo, corrente e temperatura deixa de ter solução estável.',
  counter:
    'Aceite a aniquilação: guarde créditos para reconstruir rápido depois dos 25% e leve-o o mais perto possível da morte antes disso. O Oscilador de Cristal (+25%) impõe frequência ao caos e o IGBT (+20%) atravessa a blindagem. Diodos reduzem os pulsos, mas NÃO evitam a aniquilação.',
};

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  curto: {
    id: 'curto',
    name: 'Curto-Circuito',
    hp: 52,
    speed: 58,
    armor: 0,
    reward: 7,
    leak: 1,
    radius: 11,
    color: '#ff5f5f',
    resist: {},
    behavior: {},
    traits: ['Inimigo comum'],
    tech: 'Ligação de baixa resistência entre pontos de potenciais diferentes, que provoca corrente muito acima da prevista.',
    counter: 'Qualquer unidade de dano. Bobinas lidam bem com grupos.',
  },
  surto: {
    id: 'surto',
    name: 'Surto de Tensão',
    hp: 32,
    speed: 122,
    armor: 0,
    reward: 6,
    leak: 1,
    radius: 9,
    color: '#f2bf4a',
    resist: { grampeamento: 2, magnetico: 0.85 },
    behavior: {},
    traits: ['Muito rápido', 'Pouca resistência', 'Fraco contra grampeamento (diodo)'],
    tech: 'Elevação transitória e breve da tensão acima do valor nominal, por exemplo ao desligar cargas indutivas.',
    counter: 'Diodos (dano dobrado) e relés para interromper o avanço.',
  },
  sobrecarga: {
    id: 'sobrecarga',
    name: 'Sobrecarga',
    hp: 240,
    speed: 36,
    armor: 5,
    reward: 16,
    leak: 2,
    radius: 15,
    color: '#ff9a47',
    resist: { grampeamento: 0.6 },
    behavior: {},
    traits: ['Blindado (−5 por golpe)', 'Lento', 'Custa 2 vidas'],
    tech: 'Corrente acima da nominal por tempo prolongado, que aquece condutores e componentes.',
    counter: 'Golpes fortes (bobina, capacitor) e o indutor com rampa completa. Ataques fracos perdem efeito na blindagem.',
  },
  ruido: {
    id: 'ruido',
    name: 'Ruído Elétrico',
    hp: 78,
    speed: 66,
    armor: 0,
    reward: 10,
    leak: 1,
    radius: 11,
    color: '#a28bff',
    resist: {},
    behavior: { noiseRadius: 95, noise: 0.28 },
    traits: ['Reduz a cadência de unidades próximas (−28%)'],
    tech: 'Sinal indesejado sobreposto ao sinal útil, que pode corromper leituras e comandos.',
    counter: 'Unidades protegidas por diodo ou com a característica Isolamento ignoram o ruído.',
  },
  interferencia: {
    id: 'interferencia',
    name: 'Interferência Eletromagnética',
    hp: 118,
    speed: 54,
    armor: 0,
    reward: 13,
    leak: 1,
    radius: 13,
    color: '#e05fd0',
    resist: {},
    behavior: { pulseEvery: 6, pulseRadius: 110, pulseStun: 1.6 },
    traits: ['A cada 6 s, desativa unidades próximas por 1,6 s'],
    tech: 'Perturbação causada por campos eletromagnéticos externos acoplados ao circuito.',
    counter: 'Proteção do diodo (imunidade) ou eliminação rápida antes do pulso.',
  },
  isolamento: {
    id: 'isolamento',
    name: 'Falha de Isolamento',
    hp: 150,
    speed: 52,
    armor: 1,
    reward: 14,
    leak: 1,
    radius: 13,
    color: '#39d0b8',
    resist: { magnetico: 0.7 },
    behavior: { controlImmune: true },
    traits: ['Imune a desaceleração e interrupção', 'Resiste a dano magnético (−30%)'],
    tech: 'Degradação do material isolante, que permite corrente de fuga entre partes que deveriam estar isoladas.',
    counter: 'Dano bruto de comutação, descarga e grampeamento. Controle não funciona.',
  },
  instabilidade: {
    id: 'instabilidade',
    name: 'Instabilidade Magnética',
    hp: 135,
    speed: 54,
    armor: 0,
    reward: 13,
    leak: 1,
    radius: 13,
    color: '#3d9bff',
    resist: {},
    behavior: { toggleEvery: 2.2, slowFactor: 0.5, fastFactor: 1.9 },
    traits: ['Alterna entre muito lento e muito rápido a cada 2,2 s'],
    tech: 'Variação indesejada do fluxo magnético, que altera o comportamento do circuito de forma irregular.',
    counter: 'Zonas e unidades de longo alcance cobrem bem as fases rápidas.',
  },

  arco: {
    id: 'arco',
    name: 'Arco Elétrico',
    hp: 1500,
    speed: 30,
    armor: 2,
    reward: 160,
    leak: 8,
    radius: 22,
    color: '#ffd35f',
    boss: true,
    resist: { grampeamento: 1.5 },
    behavior: { dashEvery: 7, dashDistance: 85 },
    traits: ['Chefe', 'A cada 7 s salta 85 unidades adiante', 'Interrupção (relé) adia o salto'],
    tech: 'Descarga elétrica através do ar entre contatos que se separam, comum na abertura de contatos com carga.',
    counter: 'Relés interrompem o salto; diodos causam dano extra. Distribua defesas ao longo do caminho.',
  },
  saturacao: {
    id: 'saturacao',
    name: 'Saturação do Núcleo',
    hp: 2600,
    speed: 26,
    armor: 3,
    reward: 220,
    leak: 10,
    radius: 24,
    color: '#a28bff',
    boss: true,
    resist: {},
    behavior: { saturates: true },
    traits: ['Chefe', 'Dano magnético perde eficácia conforme é absorvido (até −65%)'],
    tech: 'Na saturação, o núcleo não consegue aumentar o fluxo de forma proporcional à corrente e a indutância efetiva cai.',
    counter: 'Varie os tipos de dano: capacitores, relés e diodos não sofrem a saturação.',
  },
  cascata: {
    id: 'cascata',
    name: 'Falha em Cascata',
    hp: 3200,
    speed: 24,
    armor: 6,
    reward: 280,
    leak: 12,
    radius: 25,
    color: '#ff5f5f',
    boss: true,
    resist: {},
    behavior: { spawnEvery: 6, spawnId: 'curto', spawnCount: 2 },
    traits: ['Chefe', 'Blindagem pesada (−6)', 'Gera 2 Curtos-Circuitos a cada 6 s'],
    tech: 'Uma falha que provoca outras falhas em sequência, propagando-se pelo sistema.',
    counter: 'Golpes fortes para a blindagem e dano em área para os curtos gerados.',
  },
  colapso: {
    id: 'colapso',
    name: 'Colapso do Sistema',
    hp: 9000,
    speed: 20,
    armor: 5,
    reward: 600,
    leak: 99,
    radius: 30,
    color: '#ff3d6e',
    boss: true,
    resist: { magnetico: 0.9, comutacao: 0.9, descarga: 0.9, grampeamento: 0.9 },
    behavior: { phases: [0.66, 0.33], phaseActions: [['emp', 'shield'], ['emp', 'shield']], spawnEvery: 9, spawnId: 'ruido', spawnCount: 1 },
    traits: [
      'Chefe final',
      'Em 66% e 33% da vida: pulso que desativa unidades por 3 s e ativa escudo',
      'Gera Ruído Elétrico a cada 9 s',
      'Alcançar o núcleo = derrota',
    ],
    tech: 'Perda generalizada de funcionamento do sistema causada pela combinação de falhas não contidas.',
    counter: 'Equipe equilibrada: diodos reduzem o pulso, dano variado vence o escudo, controle ganha tempo.',
  },
  /* ------------------------- Patch 1.1 ------------------------- */
  franco: {
    id: 'franco',
    name: 'Curto-Circuito Franco',
    hp: 190,
    speed: 82,
    armor: 0,
    reward: 14,
    leak: 2,
    radius: 13,
    color: '#ff3b3b',
    resist: {},
    behavior: { deathBurst: { radius: 90, slow: 0.4, dur: 3 }, elite: true },
    traits: ['Elite agressiva e rápida', 'Ao ser destruído, superaquece unidades a até 90 (−40% de cadência por 3 s)', 'Custa 2 vidas'],
    tech: 'Curto “franco” (sólido) é uma ligação de impedância praticamente nula: a corrente de falta é máxima e o aquecimento é violento.',
    counter: 'Destrua-o longe das unidades (alcance longo) ou proteja-as com diodos (o superaquecimento dura só 1 s).',
  },
  sobretensao: {
    id: 'sobretensao',
    name: 'Sobretensão Sustentada',
    hp: 420,
    speed: 40,
    armor: 3,
    reward: 26,
    leak: 2,
    radius: 15,
    color: '#ffb347',
    resist: { grampeamento: 1.6 },
    behavior: { cycleImmune: { every: 4, types: ['comutacao', 'descarga', 'magnetico'] } },
    traits: ['Blindado (−3)', 'A cada 4 s fica protegido contra um tipo de dano (−85%)', 'Golpes de grampeamento (diodo) removem a proteção por 2 s'],
    tech: 'Tensão acima do valor nominal por um tempo prolongado (não um pico breve), que estressa isolamentos e componentes.',
    counter: 'Diodos (grampeamento) e equipes com tipos de dano variados.',
  },
  emi: {
    id: 'emi',
    name: 'Interferência Irradiada (EMI)',
    hp: 160,
    speed: 52,
    armor: 0,
    reward: 15,
    leak: 1,
    radius: 13,
    color: '#ff6fd8',
    resist: {},
    behavior: { rangeAura: { radius: 120, amount: 0.25 } },
    traits: ['Reduz o alcance das unidades a até 120 (−25%)'],
    tech: 'Energia eletromagnética irradiada que se acopla a cabos e trilhas, degradando sinais e sensores.',
    counter: 'Unidades protegidas por diodo ou com Isolamento ignoram o efeito. Elimine-a cedo com unidades de alcance longo.',
  },
  fuga: {
    id: 'fuga',
    name: 'Fuga de Corrente',
    hp: 260,
    speed: 46,
    armor: 1,
    reward: 18,
    leak: 1,
    radius: 13,
    color: '#6fe3ff',
    resist: {},
    behavior: { regen: { delay: 1.5, rate: 0.07 } },
    traits: ['Regenera 7% da vida por segundo após 1,5 s sem sofrer dano', 'O calor do resistor impede a regeneração'],
    tech: 'Corrente que escapa por caminhos não previstos (isolamento úmido, sujo ou degradado). Some e volta enquanto a causa persiste.',
    counter: 'Dano constante (indutor, RL, resistor). Golpes espaçados deixam a fuga se recuperar.',
  },
  aberto: {
    id: 'aberto',
    name: 'Circuito Aberto',
    hp: 220,
    speed: 50,
    armor: 0,
    reward: 17,
    leak: 1,
    radius: 13,
    color: '#d7dde6',
    resist: {},
    behavior: { openCycle: { every: 3, open: 1.4 } },
    traits: ['A cada 3 s “abre” por 1,4 s', 'Aberto: só o dano magnético (indução) o atinge, e as demais unidades não o miram'],
    tech: 'Interrupção da continuidade do circuito: sem caminho fechado, não há corrente de condução.',
    counter: 'Unidades magnéticas (bobina, indutor, RL, oscilador): a indução não precisa de contato elétrico.',
  },
  transiente: {
    id: 'transiente',
    name: 'Transiente Elétrico',
    hp: 85,
    speed: 120,
    armor: 0,
    reward: 9,
    leak: 1,
    radius: 9,
    color: '#fff27a',
    resist: {},
    behavior: { erratic: { every: 0.5, min: 0.6, max: 1.45 }, decay: 0.035 },
    traits: ['Extremamente rápido e imprevisível', 'A vida decai sozinha (até 15%)'],
    tech: 'Variação rápida e passageira de tensão ou corrente, que decai com o tempo (como e^(−t/τ)).',
    counter: 'Interrupção (relé, CI 555) e desaceleração em área; ele enfraquece sozinho com o tempo.',
  },
  saturado: {
    id: 'saturado',
    name: 'Núcleo Saturado',
    hp: 900,
    speed: 30,
    armor: 6,
    reward: 45,
    leak: 3,
    radius: 17,
    color: '#9a7bff',
    resist: { magnetico: 0.6, descarga: 1.35, termico: 1.2 },
    behavior: { saturates: true, elite: true },
    traits: ['Elite muito resistente (blindagem −6)', 'Resiste a dano magnético (−40%) e satura', 'Fraco contra descarga (+35%) e calor (+20%)'],
    tech: 'Núcleo ferromagnético saturado: o fluxo não cresce mais com a corrente e a indutância efetiva despenca.',
    counter: 'Capacitores, Tesla e resistores. Golpes fracos perdem efeito na blindagem.',
  },
  ressonancia: {
    id: 'ressonancia',
    name: 'Ressonância Harmônica',
    hp: 6500,
    speed: 25,
    armor: 3,
    reward: 420,
    leak: 15,
    radius: 26,
    color: '#c77dff',
    boss: true,
    resist: {},
    behavior: {
      harmonic: { every: 8, radius: 210, boost: 0.4, dur: 3 },
      phases: [0.7, 0.4],
      phaseActions: [['spawnTrans', 'emp'], ['spawnTrans', 'shield']],
    },
    weakTo: { oscilador: 1.6, resistor: 1.3 },
    traits: [
      'Chefe',
      'A cada 8 s, uma onda harmônica acelera os inimigos a até 210 (+40% por 3 s)',
      'Em 70% e 40% da vida: libera Transientes e pulso/escudo',
      'Fraco contra o Oscilador (oposição de fase, +60%) e o Resistor (amortecimento, +30%)',
    ],
    tech: 'Harmônicas são componentes em múltiplos da frequência fundamental; quando coincidem com uma ressonância do sistema, a amplitude cresce perigosamente.',
    counter: 'Amorteça (resistores) e cancele (oscilador). Diodos reduzem o pulso; controle segura os acelerados.',
  },
  apagao: {
    id: 'apagao',
    name: 'Apagão Total',
    hp: 15000,
    speed: 18,
    armor: 6,
    reward: 900,
    leak: 99,
    radius: 31,
    color: '#ff4d4d',
    boss: true,
    resist: { magnetico: 0.9, comutacao: 0.9, descarga: 0.9, grampeamento: 0.9, termico: 0.9 },
    behavior: {
      brownout: { radius: 150, amount: 0.2 },
      phases: [0.75, 0.5, 0.25],
      phaseActions: [['blackout', 'emp'], ['spawnFuga', 'shield'], ['open', 'emp']],
    },
    traits: [
      'Chefe final da expansão',
      'Subtensão: unidades a até 150 causam −20% de dano',
      '75%: rejeição de carga (fontes e retificadores param por 8 s)',
      '50%: libera Fugas de Corrente e ativa escudo',
      '25%: passa a abrir o circuito periodicamente',
      'Alcançar o núcleo = derrota',
    ],
    tech: 'Perda total de alimentação de um sistema, normalmente após falhas em cascata que a proteção não isolou a tempo.',
    counter: 'Economia guardada antes dos 75%, dano magnético para a fase aberta e diodos contra os pulsos.',
  },

  /* ========================= Patch 1.2 — §4 ========================= */

  dieletrico: {
    id: 'dieletrico',
    name: 'Dielétrico Rompido',
    hp: 520,
    speed: 44,
    armor: 2,
    reward: 30,
    leak: 2,
    radius: 15,
    color: '#6fd4ff',
    // isolante degradado: segura muito bem o elétrico, mas não o calor
    resist: { descarga: 0.4, comutacao: 0.5, grampeamento: 0.45, magnetico: 0.7, termico: 1.6 },
    behavior: { dielectric: { threshold: 600, dur: 4 }, elite: true },
    traits: [
      'Elite isolante: resiste muito a descarga, comutação e grampeamento',
      'Fraco contra dano térmico (+60%)',
      'Ruptura dielétrica: ao acumular dano elétrico, o isolamento rompe e ele perde TODAS as resistências por 4 s (+25% de dano)',
    ],
    tech: 'Todo isolante suporta um campo elétrico máximo (rigidez dielétrica). Acima dele, o material ioniza e passa a conduzir: é a ruptura dielétrica, que em sólidos deixa um caminho carbonizado permanente.',
    counter: 'Resistor e Plasma (calor) derretem a resistência. Ou insista no dano elétrico até provocar a ruptura e aproveite a janela de 4 s com tudo.',
  },

  ambulante: {
    id: 'ambulante',
    name: 'Curto-Circuito Ambulante',
    hp: 95,
    speed: 135,
    armor: 0,
    reward: 13,
    leak: 1,
    radius: 10,
    color: '#ff4d6d',
    resist: {},
    // muito rápido, pouca vida, e atrapalha quem ele passa perto
    behavior: { jam: { radius: 85, amount: 0.3 } },
    traits: [
      'Velocidade altíssima e pouca vida',
      'Interferência de contato: unidades a até 85 perdem 30% de cadência enquanto ele estiver por perto',
      'Protegidas por diodo e com Isolamento ignoram a interferência',
    ],
    tech: 'Um curto em movimento arrasta a corrente de falta pelo circuito: a queda de tensão acompanha o ponto de falha, e cada carga próxima sente o afundamento enquanto ele passa.',
    counter: 'Interrupção e lentidão na entrada da rota, ou dano em área: ele morre rápido, o problema é chegar perto das unidades.',
  },

  faraday: {
    id: 'faraday',
    name: 'Blindagem de Faraday',
    hp: 760,
    speed: 38,
    armor: 4,
    reward: 38,
    leak: 2,
    radius: 16,
    color: '#9fb0c6',
    // invólucro condutor: barra o eletromagnético e o controle elétrico
    resist: { magnetico: 0.35, descarga: 0.6, termico: 1.3, comutacao: 1.15 },
    behavior: { controlResist: 0.65, elite: true },
    traits: [
      'Elite blindada: dano magnético −65% e descarga −40%',
      'Resiste a controle elétrico: sofre apenas 35% da lentidão e do atordoamento',
      'Fraco contra calor (+30%) e comutação mecânica (+15%)',
    ],
    tech: 'Uma gaiola de Faraday é um invólucro condutor: as cargas se redistribuem e anulam o campo elétrico no interior. Contra campos magnéticos variáveis, correntes induzidas no invólucro se opõem à variação do fluxo (lei de Lenz) e atenuam o que passa.',
    counter: 'Relé (comutação mecânica), Resistor e Plasma. Não gaste controle elétrico nele: a blindagem absorve quase tudo.',
  },

  supercap: {
    id: 'supercap',
    name: 'Supercapacitor Instável',
    hp: 430,
    speed: 42,
    armor: 1,
    reward: 32,
    leak: 2,
    radius: 15,
    color: '#ffd166',
    resist: { descarga: 0.75 },
    behavior: {
      // carrega ao longo do percurso (vira escudo) e descarrega ao morrer
      accumulate: { rate: 0.05, max: 0.6 },
      deathDischarge: { radius: 110, stun: 2.2 },
      elite: true,
    },
    traits: [
      'Armazenamento eletroquímico: acumula 5% da vida máxima por segundo como escudo (até 60%)',
      'Quanto mais tarde você matá-lo, mais forte ele fica',
      'Ao ser destruído, libera a carga acumulada: desativa por até 2,2 s as unidades a até 110 (proporcional à carga)',
    ],
    tech: 'Supercapacitores armazenam energia na dupla camada elétrica, não em reação química: têm capacitância enorme e aceitam carga e descarga muito rápidas, com densidade de potência altíssima.',
    counter: 'Mate-o CEDO, longe das unidades. Diodos reduzem o atordoamento da descarga; posicionar dano alto na entrada evita que ele chegue carregado.',
  },

  reverso: {
    id: 'reverso',
    name: 'Semicondutor Reverso',
    hp: 600,
    speed: 46,
    armor: 2,
    reward: 34,
    leak: 2,
    radius: 15,
    color: '#8bb4ff',
    resist: {},
    // polarização reversa: bloqueia, até um grampeamento colocá-lo em condução direta
    behavior: { reverse: { block: 0.25, dur: 3, bonus: 0.5 }, elite: true },
    weakTo: { diodo: 1.3 },
    traits: [
      'Polarização reversa: recebe apenas 25% do dano de comutação e grampeamento',
      'Um golpe de grampeamento (Diodo) o força à condução direta por 3 s',
      'Em condução direta: recebe dano total e +50% adicional',
    ],
    tech: 'Uma junção PN reversamente polarizada praticamente não conduz: só a corrente de fuga atravessa a região de depleção. Invertida a polaridade, ela entra em condução direta acima da tensão de joelho (~0,7 V no silício) e a corrente cresce exponencialmente.',
    counter: 'O Diodo é a chave: um golpe dele abre a janela de 3 s em que todo o resto do seu arsenal passa a funcionar. Transistor e MOSFET sozinhos sofrem.',
  },

  voltaico: {
    id: 'voltaico',
    name: 'Arco Voltaico',
    hp: 340,
    speed: 104,
    armor: 1,
    reward: 28,
    leak: 2,
    radius: 13,
    color: '#fff0a6',
    resist: {},
    behavior: {
      // rápido, com descargas de contato e resistências que giram
      contact: { every: 2.6, radius: 80, stun: 1 },
      cycleResist: { every: 3.5, types: ['magnetico', 'descarga', 'comutacao', 'termico'], amount: 0.3 },
    },
    traits: [
      'Muito rápido',
      'Descarga de contato: a cada 2,6 s desativa por 1 s as unidades a até 80',
      'Resistências variáveis: a cada 3,5 s passa a receber 30% menos de um tipo de dano diferente',
    ],
    tech: 'Um arco voltaico é plasma conduzindo entre dois eletrodos separados. A coluna ionizada tem resistência negativa (a tensão cai quando a corrente sobe) e se desloca com os campos e as correntes de ar — é por isso que o arco “anda”.',
    counter: 'Equipe com tipos de dano variados (ele só resiste a um por vez) e diodos para anular as descargas de contato.',
  },

  saturacaoprofunda: {
    id: 'saturacaoprofunda',
    name: 'Saturação Profunda do Núcleo',
    hp: 1600,
    speed: 28,
    armor: 7,
    reward: 62,
    leak: 3,
    radius: 19,
    color: '#7d5fd6',
    resist: { comutacao: 0.85, descarga: 0.85, grampeamento: 0.85 },
    behavior: {
      // o dano magnético não fere: ele preenche o medidor de saturação
      satMeter: { need: 1400, dur: 5, thermalMul: 2.5 },
      elite: true,
    },
    weakTo: { resistor: 1.4, plasma: 1.3 },
    traits: [
      'Elite de vida muito alta e blindagem pesada (−7)',
      'Enquanto não satura, o dano MAGNÉTICO não reduz a vida: só enche o medidor de saturação (e o desacelera)',
      'Dano térmico enche o medidor 2,5× mais rápido',
      'Medidor cheio: fica totalmente vulnerável por 5 s (o medidor zera depois)',
      'Fraco contra Resistor (+40%) e Plasma (+30%)',
    ],
    tech: 'Em saturação profunda, os domínios magnéticos do núcleo já estão alinhados: por mais que a corrente aumente, o fluxo quase não cresce e a indutância efetiva despenca. O núcleo deixa de transformar corrente em campo útil e a energia vira calor.',
    counter: 'Use o magnético para SATURÁ-LO (não para matá-lo) e o térmico para encher o medidor rápido; quando a janela de 5 s abrir, concentre todo o dano.',
  },

  parasita: {
    id: 'parasita',
    name: 'Oscilador Parasita',
    hp: 480,
    speed: 48,
    armor: 1,
    reward: 33,
    leak: 2,
    radius: 15,
    color: '#c77dff',
    resist: {},
    behavior: {
      // interferência periódica na cadência + resistência parcial a controle
      jam: { radius: 125, amount: 0.4, every: 6, dur: 2.5 },
      controlResist: 0.6,
      elite: true,
    },
    weakTo: { cristal: 1.5, ci555: 1.35 },
    traits: [
      'A cada 6 s, por 2,5 s, as unidades a até 125 perdem 40% de cadência',
      'Resiste parcialmente a controle: sofre 40% da lentidão e do atordoamento',
      'Fraco contra o Oscilador de Cristal (+50%) e o CI 555 (+35%)',
    ],
    tech: 'Oscilação parasita é uma oscilação não projetada, sustentada por indutâncias e capacitâncias parasitas das trilhas e dos encapsulamentos. Com realimentação involuntária e ganho suficiente, o circuito oscila em alta frequência e contamina tudo ao redor.',
    counter: 'Temporizadores estáveis (Cristal, CI 555) impõem a frequência correta e causam dano extra. Diodos e Isolamento protegem as unidades da interferência.',
  },

  /* ---- §13: chefe final do modo Impossível ---- */
  singularidade: SINGULARIDADE,
};
