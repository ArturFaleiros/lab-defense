import type { UnitId } from '../types';
import { stats, type UnitDef } from './unitTypes';
import { EXPANSION_UNITS } from './unitsExpansion';

export * from './unitTypes';

/**
 * Definições centralizadas das unidades (componentes eletroeletrônicos).
 *
 * Convenções de balanceamento:
 *  - Distâncias em unidades do mapa (o mapa mede 960 × 540).
 *  - `damage` é o dano por golpe; nas unidades de feixe/zona (indutor, circuito RL) é o dano
 *    por segundo em regime permanente.
 *  - Cada nível de melhoria aplica um `patch` (valores absolutos) sobre o anterior.
 *  - Evoluções permanentes (tiers) aplicam multiplicadores sobre o resultado dos níveis.
 *
 * Todo texto separa o fenômeno físico real (`tech`) da adaptação lúdica (`mechanic`).
 *
 * Patch 1.1: valores de relé, fonte, indutor e capacitor rebalanceados (ver comentários
 * “1.1”); novas unidades em `unitsExpansion.ts`.
 */

const BASE_UNITS: Record<'rele' | 'bobina' | 'fonte' | 'indutor' | 'diodo' | 'capacitor' | 'rl' | 'transformador', UnitDef> = {
  rele: {
    id: 'rele',
    rarity: 'comum',
    name: 'Relé Eletromagnético',
    short: 'Relé',
    classes: ['Support', 'Control'],
    role: 'Interrompe inimigos e acelera unidades vizinhas.',
    damageType: 'comutacao',
    behavior: 'bolt',
    cost: 200,
    limit: 4,
    color: '#45cfe0',
    // 1.1: dano +20%, intervalo (SPA) −15%, alcance +10%
    base: stats({ damage: 19.2, interval: 1.275, range: 126.5, stun: 0.4, aura: 100, auraSpeed: 0.12 }),
    levels: [
      {
        cost: 140,
        title: 'Bobina de maior força magnetomotriz',
        why: 'Mais espiras (maior N·I) produzem campo mais intenso e atração mais firme da armadura.',
        patch: { damage: 26.4 },
      },
      {
        cost: 210,
        title: 'Contatos de baixa resistência',
        why: 'Contatos com menor resistência de contato comutam com mais confiabilidade.',
        patch: { stun: 0.55, auraSpeed: 0.18 },
      },
      {
        cost: 300,
        title: 'Contato reversível (SPDT)',
        why: 'O terminal COM alterna entre NC e NO: o relé passa a atuar sobre dois alvos.',
        patch: { targets: 2, range: 143 },
      },
      {
        cost: 420,
        title: 'Supressão de arco nos contatos',
        why: 'Reduzir o arco na abertura dos contatos diminui o desgaste e permite comutar com mais frequência.',
        patch: { damage: 38.4, interval: 1.02 },
      },
    ],
    tiers: [
      { name: 'Relé Eletromagnético', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
      {
        name: 'Relé de Alta Eficiência',
        ec: 120,
        summary: 'Intervalo −10% e aura de comando +5%.',
        why: 'Bobinas de baixo consumo precisam de menos corrente para atracar a armadura.',
        apply: (s) => {
          s.interval *= 0.9;
          s.auraSpeed += 0.05;
        },
      },
      {
        name: 'Sistema de Comutação Avançado',
        ec: 320,
        summary: '+1 alvo, interrupção +0,15 s e dano +20%.',
        why: 'Associação de contatos e lógica de intertravamento permite comandar várias cargas.',
        apply: (s) => {
          s.targets += 1;
          s.stun += 0.15;
          s.damage *= 1.2;
        },
      },
    ],
    special:
      'Interrupção: cada golpe paralisa o alvo por um instante; alvos interrompidos recebem +15% de dano de todas as unidades (intertravamento). Aura de comando: unidades próximas atacam mais rápido.',
    tech: {
      definition:
        'Dispositivo de comutação eletromecânica: uma bobina, ao ser energizada, atrai uma armadura móvel que muda a posição dos contatos.',
      principle:
        'A corrente na bobina cria um campo magnético no núcleo. A força magnética vence a mola e a armadura desloca o contato COM de NC para NO. Sem corrente, a mola devolve a armadura ao repouso.',
      characteristics: [
        'Tensão e resistência da bobina definem a corrente de acionamento.',
        'Contatos COM, NO (normalmente aberto) e NC (normalmente fechado) em relés SPDT.',
        'Isolamento funcional entre o circuito de comando e o circuito de carga.',
        'A bobina é indutiva: exige proteção (diodo de flyback) no desligamento.',
      ],
      applications: ['Automação e comandos elétricos', 'Sistemas automotivos', 'Acionamento de cargas por microcontroladores'],
      mechanic:
        'O “ataque de comutação” representa o contato que abre e fecha; a interrupção representa a carga sendo desligada por um instante.',
      physicsNote:
        'Real: comutação eletromecânica, NO/NC, isolamento entre comando e carga. Lúdico: causar dano, paralisar inimigos e acelerar unidades vizinhas.',
    },
    unlockText: 'Disponível desde o início.',
  },

  bobina: {
    id: 'bobina',
    rarity: 'comum',
    name: 'Bobina Eletromagnética',
    short: 'Bobina',
    classes: ['Burst'],
    role: 'Pulsos de dano concentrado em área.',
    damageType: 'magnetico',
    behavior: 'pulse',
    cost: 300,
    limit: 5,
    color: '#3d9bff',
    base: stats({ damage: 55, interval: 2.6, range: 125, splash: 50 }),
    levels: [
      {
        cost: 190,
        title: 'Mais espiras',
        why: 'Em um solenoide longo B ≈ μ·N·I / l: mais espiras por comprimento produzem campo maior.',
        patch: { damage: 75 },
      },
      {
        cost: 260,
        title: 'Núcleo ferromagnético',
        why: 'Um núcleo de alta permeabilidade concentra o fluxo magnético (μ maior).',
        patch: { splash: 62 },
      },
      {
        cost: 360,
        title: 'Pulso prolongado',
        why: 'Adaptação lúdica: o pulso mantém o campo por mais tempo e atrasa os inimigos atingidos.',
        patch: { damage: 100, slow: 0.3, slowDur: 1.2 },
      },
      {
        cost: 500,
        title: 'Corrente de pico ampliada',
        why: 'Condutores de maior seção suportam correntes maiores sem aquecimento excessivo.',
        patch: { damage: 140, interval: 2.2 },
      },
    ],
    tiers: [
      { name: 'Bobina Eletromagnética', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
      {
        name: 'Bobina de Núcleo Laminado',
        ec: 140,
        summary: 'Dano +20% e raio do pulso +8.',
        why: 'Laminar o núcleo reduz as correntes parasitas (de Foucault) e as perdas associadas.',
        apply: (s) => {
          s.damage *= 1.2;
          s.splash += 8;
        },
      },
      {
        name: 'Eletroímã de Alta Potência',
        ec: 340,
        summary: 'Dano +20% e o pulso empurra os inimigos para trás.',
        why: 'Eletroímãs exercem força sobre materiais ferromagnéticos; no jogo, isso vira um recuo no caminho.',
        apply: (s) => {
          s.damage *= 1.2;
          s.knockback = 26;
        },
      },
    ],
    special: 'Pulso eletromagnético: atinge todos os inimigos no raio em torno do alvo.',
    tech: {
      definition: 'Condutor enrolado em espiras que produz campo magnético quando percorrido por corrente elétrica.',
      principle:
        'Cada espira contribui para o campo; o núcleo concentra o fluxo. Para um solenoide longo, B ≈ μ·N·I / l, aproximação válida longe das extremidades.',
      characteristics: ['Número de espiras (N)', 'Corrente (I) e comprimento (l)', 'Permeabilidade do núcleo (μ)', 'Resistência do fio'],
      applications: ['Eletroímãs', 'Bobinas de relés e solenoides', 'Atuadores e motores'],
      mechanic: 'O pulso representa um campo magnético intenso e breve que afeta tudo ao redor do ponto de impacto.',
      physicsNote:
        'Real: relação entre corrente, espiras, núcleo e campo magnético. Lúdico: o campo causar dano em área e empurrar inimigos.',
      formula: { tex: 'B = \\dfrac{\\mu N I}{l}', label: 'Solenoide longo (aproximação)' },
    },
    unlockText: 'Disponível desde o início.',
  },

  fonte: {
    id: 'fonte',
    rarity: 'incomum',
    name: 'Fonte de Alimentação DC',
    short: 'Fonte DC',
    classes: ['Economy'],
    role: 'Gera créditos de engenharia durante a partida.',
    damageType: null,
    behavior: 'income',
    cost: 200,
    limit: 3,
    color: '#39d08a',
    // 1.1: geração +50% e intervalo de 8 s para 6 s (níveis escalados na mesma proporção)
    base: stats({ income: 27, interval: 6, aura: 110 }),
    levels: [
      {
        cost: 140,
        title: 'Regulação de tensão',
        why: 'Uma saída regulada mantém a tensão estável mesmo com variação de carga.',
        patch: { income: 39 },
      },
      {
        cost: 210,
        title: 'Maior potência nominal',
        why: 'Transformador e semicondutores dimensionados para mais potência fornecem mais energia ao sistema.',
        patch: { income: 54 },
      },
      {
        cost: 300,
        title: 'Filtragem aprimorada',
        why: 'Capacitores e indutores de filtro reduzem a ondulação (ripple) da saída.',
        patch: { income: 75, interval: 5.25 },
      },
    ],
    tiers: [
      { name: 'Fonte de Alimentação DC', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
      {
        name: 'Fonte Chaveada',
        ec: 130,
        // 1.1: +35% (antes +25%)
        summary: 'Geração +35%.',
        why: 'Fontes chaveadas costumam ter eficiência de conversão maior que fontes lineares equivalentes.',
        apply: (s) => {
          s.income *= 1.35;
        },
      },
      {
        name: 'Fonte Chaveada Síncrona',
        ec: 320,
        // 1.1: +60%, melhorias −15% e três melhorias exclusivas
        summary: 'Geração +60%, melhorias 15% mais baratas e 3 melhorias exclusivas.',
        why: 'A retificação síncrona substitui diodos por transistores (MOSFETs) e reduz as perdas de condução.',
        apply: (s) => {
          s.income *= 1.6;
        },
        upgradeDiscount: 0.15,
        extraLevels: [
          {
            cost: 360,
            title: 'MOSFETs de baixa RDS(on)',
            why: 'Menor resistência de condução nos transistores síncronos reduz a perda I²·R: mais energia chega à saída.',
            patch: { income: 90 },
          },
          {
            cost: 460,
            title: 'Frequência de chaveamento otimizada',
            why: 'Escolher a frequência que equilibra perdas de comutação e tamanho dos magnéticos encurta o ciclo de entrega.',
            patch: { interval: 4.5 },
          },
          {
            cost: 580,
            title: 'Correção do fator de potência (PFC)',
            why: 'Com fator de potência próximo de 1, a fonte aproveita melhor a energia da rede: no jogo, uma reserva é entregue ao fim de cada onda.',
            patch: { income: 100, waveIncome: 60 },
          },
        ],
      },
    ],
    special: 'Alimentação: capacitores dentro do raio da fonte carregam 25% mais rápido.',
    tech: {
      definition: 'Circuito que converte energia de uma entrada em tensão contínua estável para alimentar outros circuitos.',
      principle:
        'Retificação, filtragem e regulação. Em fontes chaveadas, um transistor comuta em alta frequência e indutores/transformadores transferem a energia.',
      characteristics: ['Tensão e corrente de saída', 'Eficiência de conversão', 'Ondulação (ripple)', 'Regulação de linha e de carga'],
      applications: ['Alimentação de circuitos eletrônicos', 'Carregadores', 'Painéis de automação'],
      mechanic: 'Gerar créditos representa fornecer energia ao sistema defendido.',
      physicsNote: 'Real: conversão e regulação de energia, eficiência. Lúdico: “energia” convertida em créditos.',
    },
    unlockText: 'Disponível desde o início.',
  },

  indutor: {
    id: 'indutor',
    rarity: 'raro',
    name: 'Indutor',
    short: 'Indutor',
    classes: ['DPS'],
    role: 'Dano contínuo que cresce enquanto mantém o mesmo alvo.',
    damageType: 'magnetico',
    behavior: 'beam',
    cost: 260,
    limit: 5,
    color: '#a28bff',
    // 1.1: dano +30% e rapidez de liberação (pico na interrupção) +25%
    base: stats({ damage: 46.8, interval: 0.5, range: 120, tau: 1.4, burst: 50 }),
    levels: [
      {
        cost: 150,
        title: 'Tensão de acionamento maior',
        why: 'Com V maior, a corrente final V/R e a taxa inicial di/dt = V/L crescem; τ = L/R não muda.',
        patch: { damage: 65 },
      },
      {
        cost: 230,
        title: 'Enrolamento de menor resistência',
        why: 'Reduzir R aumenta a corrente final V/R, mas também aumenta τ = L/R: a rampa fica mais lenta.',
        patch: { damage: 83.2, tau: 1.7 },
      },
      {
        cost: 320,
        title: 'Maior energia armazenada',
        why: 'Com mais corrente, a energia no campo cresce com o quadrado: E = ½·L·I².',
        patch: { burst: 100, range: 135 },
      },
      {
        cost: 460,
        title: 'Corrente nominal ampliada',
        why: 'Fio e núcleo dimensionados para corrente maior, abaixo da saturação do núcleo.',
        patch: { damage: 117 },
      },
    ],
    tiers: [
      { name: 'Indutor', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
      {
        name: 'Indutor de Alta Indutância',
        ec: 150,
        // 1.1: dano +40%, rapidez de liberação +50%, rampa 35% mais lenta
        summary: 'Dano +40%, rapidez de liberação +50%, rampa 35% mais lenta.',
        why: 'L maior armazena mais energia para a mesma corrente (E = ½LI²) e responde mais devagar (τ = L/R).',
        apply: (s) => {
          s.damage *= 1.4;
          s.burst *= 1.5;
          s.tau *= 1.35;
        },
      },
      {
        name: 'Núcleo Magnético Especializado',
        ec: 360,
        // 1.1: dano +50%, rapidez de liberação +75%, até 3 alvos
        summary: 'Dano +50%, rapidez de liberação +75% e atinge até 3 inimigos.',
        why: 'Núcleos de alta permeabilidade e baixas perdas concentram o fluxo com menos aquecimento; derivações no enrolamento alimentam vários feixes.',
        apply: (s) => {
          s.damage *= 1.5;
          s.burst *= 1.75;
          s.targets = 3;
        },
      },
    ],
    special:
      'Rampa de corrente: o dano parte de zero e cresce como 1 − e^(−t/τ) enquanto o alvo é mantido. Ao perder o alvo, a corrente é interrompida e a energia acumulada é liberada em um pico no próximo inimigo.',
    tech: {
      definition: 'Componente que armazena energia no campo magnético e se opõe a variações da corrente elétrica.',
      principle:
        'Pela convenção passiva, vL = L·di/dt: a corrente não muda instantaneamente. Em um circuito RL série ligado a uma fonte, i(t) = (V/R)(1 − e^(−t/τ)), com τ = L/R.',
      characteristics: ['Indutância L (henry, H)', 'Resistência do enrolamento', 'Corrente de saturação do núcleo', 'Energia armazenada E = ½·L·I²'],
      applications: ['Filtros e fontes chaveadas', 'Conversores CC-CC', 'Supressão de ruído'],
      mechanic:
        'O dano por segundo segue a curva de carga de um RL; a troca de alvo imita a interrupção da corrente, que libera a energia acumulada.',
      physicsNote:
        'Real: rampa exponencial com τ = L/R e energia ½LI². Lúdico: a energia liberada virar dano em um inimigo.',
      formula: { tex: 'v_L = L\\,\\dfrac{di}{dt} \\qquad E = \\tfrac{1}{2} L I^2', label: 'Tensão e energia no indutor' },
    },
    unlockText: 'Conclua a fase 1-3.',
  },

  diodo: {
    id: 'diodo',
    rarity: 'incomum',
    name: 'Diodo de Proteção',
    short: 'Diodo',
    classes: ['Support', 'Defense'],
    role: 'Protege unidades próximas e grampeia surtos.',
    damageType: 'grampeamento',
    behavior: 'bolt',
    cost: 180,
    limit: 4,
    color: '#ff9a47',
    base: stats({ damage: 9, interval: 0.8, range: 130, aura: 105, protect: true }),
    levels: [
      {
        cost: 110,
        title: 'Maior corrente direta nominal',
        why: 'Diodos de maior corrente direta suportam o pico de descarga de bobinas maiores.',
        patch: { damage: 13 },
      },
      {
        cost: 170,
        title: 'Proteção distribuída',
        why: 'Adaptação lúdica: a área protegida pelo diodo aumenta.',
        patch: { aura: 130 },
      },
      {
        cost: 240,
        title: 'Condução mais rápida',
        why: 'Diodos com menor tempo de recuperação respondem melhor a transitórios rápidos.',
        patch: { interval: 0.65 },
      },
      {
        cost: 340,
        title: 'Maior tensão reversa suportada',
        why: 'O diodo precisa suportar a tensão reversa do circuito com margem de segurança.',
        patch: { damage: 25 },
      },
    ],
    tiers: [
      { name: 'Diodo de Proteção', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
      {
        name: 'Diodo de Recuperação Rápida',
        ec: 110,
        summary: 'Intervalo −20%.',
        why: 'Diodos de recuperação rápida têm tempo de recuperação reversa (trr) curto.',
        apply: (s) => {
          s.interval *= 0.8;
        },
      },
      {
        name: 'Supressor de Transientes (TVS)',
        ec: 300,
        summary: 'Dano +40% e unidades protegidas recebem +8% de dano.',
        why: 'Diodos TVS são projetados para grampear surtos de tensão e proteger o restante do circuito.',
        apply: (s) => {
          s.damage *= 1.4;
          s.auraDamage += 0.08;
        },
      },
    ],
    special:
      'Proteção: unidades no raio ficam imunes à Interferência e ao Ruído e sofrem menos com o Colapso. Componentes com bobina protegidos (relé, bobina, indutor, RL) recebem +10% de dano. Grampeamento: dano dobrado contra Surtos de Tensão.',
    tech: {
      definition: 'Semicondutor que conduz preferencialmente em um sentido (do anodo para o catodo).',
      principle:
        'Em antiparalelo com uma bobina (diodo de flyback), fica reversamente polarizado na operação normal. No desligamento, oferece caminho para a corrente da bobina e limita o pico de tensão; a energia é dissipada ao longo do decaimento, não instantaneamente.',
      characteristics: ['Corrente direta máxima', 'Tensão reversa máxima', 'Queda de tensão direta', 'Tempo de recuperação reversa'],
      applications: ['Proteção de bobinas de relés e solenoides', 'Retificação', 'Proteção contra inversão de polaridade'],
      mechanic: 'A proteção contra Interferência e Ruído representa o diodo absorvendo transitórios que danificariam o circuito vizinho.',
      physicsNote:
        'Real: condução unidirecional, caminho de roda-livre e limitação de sobretensão. Lúdico: proteger “unidades” de efeitos especiais de inimigos.',
    },
    unlockText: 'Conclua a fase 2-3.',
  },

  capacitor: {
    id: 'capacitor',
    rarity: 'raro',
    name: 'Capacitor',
    short: 'Capacitor',
    classes: ['Burst', 'Control'],
    role: 'Acumula carga e descarrega em área, desacelerando grupos.',
    damageType: 'descarga',
    behavior: 'capacitor',
    cost: 280,
    limit: 4,
    color: '#f2bf4a',
    // 1.1: intervalo entre descargas +30% (τ de recarga ×1,3) e dano +15%
    base: stats({ damage: 92, tau: 1.82, range: 115, splash: 70, slow: 0.35, slowDur: 1.5 }),
    levels: [
      {
        cost: 190,
        title: 'Maior capacitância',
        why: 'A energia armazenada no campo elétrico é E = ½·C·V²: C maior armazena mais energia.',
        patch: { damage: 120.75 },
      },
      {
        cost: 270,
        title: 'Descarga Total (habilidade)',
        why: 'Liberar toda a carga de uma vez produz um pulso intenso, seguido de nova recarga.',
        patch: { ability: true },
      },
      {
        cost: 360,
        title: 'Menor resistência série (ESR)',
        why: 'Na carga por um resistor, τ = R·C: reduzir a resistência série acelera a recarga.',
        patch: { splash: 85, tau: 1.495 },
      },
      {
        cost: 500,
        title: 'Maior tensão nominal',
        why: 'Como a energia cresce com V², suportar tensão maior aumenta muito a energia disponível.',
        patch: { damage: 172.5 },
      },
    ],
    tiers: [
      { name: 'Capacitor', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
      {
        name: 'Capacitor Eletrolítico',
        ec: 140,
        // 1.1: +40% (antes +25%)
        summary: 'Dano +40%.',
        why: 'Capacitores eletrolíticos oferecem alta capacitância por volume (e têm polaridade).',
        apply: (s) => {
          s.damage *= 1.4;
        },
      },
      {
        name: 'Banco de Capacitores',
        ec: 340,
        // 1.1: dano +30% e duas descargas consecutivas extras (dano real)
        summary: 'Dano +30%, armazena 2 cargas e cada disparo vem seguido de 2 descargas consecutivas (55% cada).',
        why: 'Capacitores em paralelo somam capacitâncias (C_eq = C₁ + C₂): cada célula do banco descarrega em sequência sobre a mesma carga.',
        apply: (s) => {
          s.damage *= 1.3;
          s.charges = 2;
          s.salvo = 2;
          s.salvoMul = 0.55;
        },
      },
    ],
    ability: {
      kind: 'discharge',
      name: 'Descarga Total',
      desc: 'Fecha a chave de carga rápida: completa a carga instantaneamente e libera toda a energia armazenada (cargas + carga atual) em todos os inimigos no alcance, com dano ×1,6.',
      cooldown: 22,
      duration: 0,
    },
    special:
      'Carga exponencial: a tensão sobe como 1 − e^(−t/τ). Dispara quando a energia (∝ V²) passa de 80% e desacelera os inimigos atingidos.',
    tech: {
      definition: 'Componente que armazena energia no campo elétrico entre duas placas condutoras separadas por um dielétrico.',
      principle:
        'Ao ser carregado por um resistor, v(t) = V(1 − e^(−t/RC)). A energia armazenada é E = ½·C·V². Não confundir com o indutor, que armazena energia no campo magnético.',
      characteristics: ['Capacitância C (farad, F)', 'Tensão nominal', 'Resistência série equivalente (ESR)', 'Polaridade (eletrolíticos)'],
      applications: ['Filtragem em fontes', 'Temporização RC', 'Desacoplamento de circuitos integrados', 'Flash fotográfico'],
      mechanic: 'A recarga segue a curva RC; o disparo usa a energia (proporcional a V²), não a tensão diretamente.',
      physicsNote: 'Real: curva de carga RC e E = ½CV² no campo elétrico. Lúdico: a descarga causar dano e desacelerar inimigos.',
      formula: { tex: 'v(t) = V\\left(1 - e^{-t/RC}\\right) \\qquad E = \\tfrac{1}{2} C V^2', label: 'Carga e energia no capacitor' },
    },
    unlockText: 'Conclua a fase 3-1.',
  },

  rl: {
    id: 'rl',
    rarity: 'epico',
    name: 'Circuito RL',
    short: 'Circuito RL',
    classes: ['Hybrid', 'Control'],
    role: 'Campo de desaceleração com dano progressivo.',
    damageType: 'magnetico',
    behavior: 'zone',
    cost: 320,
    limit: 3,
    color: '#45cfe0',
    // damage = tensão de excitação (escala do jogo): dano/s em regime = V / R
    base: stats({ damage: 10.4, interval: 0.25, range: 85, slow: 0.22, resistance: 0.4, inductance: 0.6 }),
    levels: [
      {
        cost: 190,
        title: 'Reduzir a resistência (R = 0,32)',
        why: 'I = V/R cresce ao reduzir R; τ = L/R também cresce, então o regime permanente demora mais.',
        patch: { resistance: 0.32 },
      },
      {
        cost: 260,
        title: 'Campo de atuação ampliado',
        why: 'Adaptação lúdica: a área de desaceleração aumenta.',
        patch: { range: 95, slow: 0.3 },
      },
      {
        cost: 360,
        title: 'Reduzir a resistência (R = 0,26)',
        why: 'Mesma relação: mais corrente final, constante de tempo maior.',
        patch: { resistance: 0.26 },
      },
      {
        cost: 480,
        title: 'Fonte de maior tensão',
        why: 'Com V maior, I = V/R aumenta sem alterar τ = L/R.',
        patch: { damage: 14, slow: 0.35 },
      },
    ],
    tiers: [
      { name: 'Circuito RL', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
      {
        name: 'RL de Baixa Resistência',
        ec: 150,
        summary: 'R −15%: mais dano em regime, τ maior.',
        why: 'Condutores de menor resistência aumentam a corrente final e a constante de tempo.',
        apply: (s) => {
          s.resistance *= 0.85;
        },
      },
      {
        name: 'Filtro RL de Potência',
        ec: 340,
        summary: 'Desaceleração +8% e raio +15.',
        why: 'Filtros RL de potência suavizam variações de corrente em cargas maiores.',
        apply: (s) => {
          s.slow += 0.08;
          s.range += 15;
        },
      },
    ],
    special:
      'Resposta transitória: cada inimigo na zona sofre dano/s = (V/R)(1 − e^(−t/τ)), onde t é o tempo de permanência e τ = L/R. Inimigos na zona ficam mais lentos.',
    tech: {
      definition: 'Associação de resistor e indutor. Em série com uma fonte DC, a corrente cresce de forma exponencial até V/R.',
      principle:
        'i(t) = (V/R)(1 − e^(−t/τ)), com τ = L/R. Após cerca de 5τ a corrente está muito próxima do regime permanente (≈ 99,3%).',
      characteristics: ['Constante de tempo τ = L/R', 'Corrente de regime V/R', 'Tensão no indutor decai como V·e^(−t/τ)'],
      applications: ['Filtros', 'Temporização', 'Modelagem de bobinas de relés e motores'],
      mechanic:
        'O dano depende do tempo que o inimigo permanece na zona, como a corrente que depende do tempo desde o fechamento da chave.',
      physicsNote:
        'Real: a curva i(t), τ = L/R e o efeito de R sobre corrente final e tempo de resposta. Lúdico: a corrente virar dano e a zona desacelerar inimigos.',
      formula: { tex: 'i(t) = \\dfrac{V}{R}\\left(1 - e^{-t/\\tau}\\right), \\quad \\tau = \\dfrac{L}{R}', label: 'Circuito RL série' },
    },
    unlockText: 'Conclua a fase 3-3.',
  },

  transformador: {
    id: 'transformador',
    rarity: 'epico',
    name: 'Transformador',
    short: 'Transformador',
    classes: ['Support'],
    role: 'Amplifica dano, alcance ou cadência das unidades próximas.',
    damageType: null,
    behavior: 'aura',
    cost: 350,
    limit: 2,
    color: '#ff9a47',
    base: stats({ aura: 120, auraDamage: 0.15, auraRange: 0.08 }),
    levels: [
      {
        cost: 200,
        title: 'Núcleo de maior seção',
        why: 'Um núcleo maior transfere mais potência sem saturar.',
        patch: { auraDamage: 0.2, auraRange: 0.1 },
      },
      {
        cost: 280,
        title: 'Relação de espiras',
        why: 'No transformador ideal, V₂/V₁ = N₂/N₁ e a potência se conserva: elevar a tensão reduz a corrente.',
        patch: {},
      },
      {
        cost: 360,
        title: 'Sobretensão controlada (habilidade)',
        why: 'Adaptação lúdica: um pico breve de potência nas unidades vizinhas.',
        patch: { aura: 150, ability: true },
      },
    ],
    branchAt: 2,
    branches: [
      {
        id: 'elevador',
        name: 'Elevador de tensão',
        desc: 'Dano da aura +35% no total, cadência −6%.',
        why: 'N₂ > N₁: tensão maior e corrente menor (potência conservada no caso ideal).',
        patch: { auraDamage: 0.35, auraSpeed: -0.06 },
      },
      {
        id: 'abaixador',
        name: 'Abaixador de tensão',
        desc: 'Cadência da aura +22%; dano da aura mantido.',
        why: 'N₂ < N₁: tensão menor e corrente maior (potência conservada no caso ideal).',
        patch: { auraSpeed: 0.22 },
      },
    ],
    tiers: [
      { name: 'Transformador', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
      {
        name: 'Transformador Toroidal',
        ec: 160,
        summary: 'Raio +15 e dano da aura +5%.',
        why: 'O núcleo toroidal confina melhor o fluxo e reduz a dispersão magnética.',
        apply: (s) => {
          s.aura += 15;
          s.auraDamage += 0.05;
        },
      },
      {
        name: 'Subestação Compacta',
        ec: 360,
        summary: 'Aura também concede +10% de cadência.',
        why: 'Conjuntos de transformação integram proteção e distribuição em um único equipamento.',
        apply: (s) => {
          s.auraSpeed += 0.1;
        },
      },
    ],
    ability: {
      kind: 'overvolt',
      name: 'Sobretensão controlada',
      desc: '+45% de dano para todas as unidades na aura durante 6 s.',
      cooldown: 28,
      duration: 6,
    },
    special: 'Transformação: unidades no raio recebem bônus de dano e alcance. No nível 2, escolha elevar ou abaixar a tensão.',
    tech: {
      definition: 'Máquina estática que transfere energia entre circuitos por indução eletromagnética.',
      principle:
        'Uma corrente alternada no primário produz fluxo variável no núcleo, que induz tensão no secundário (lei de Faraday). Idealmente, V₂/V₁ = N₂/N₁. Não funciona com corrente contínua constante, pois não há variação de fluxo.',
      characteristics: ['Relação de espiras N₂/N₁', 'Potência nominal', 'Perdas no núcleo e no cobre', 'Isolamento entre enrolamentos'],
      applications: ['Distribuição de energia', 'Fontes de alimentação', 'Isolamento galvânico'],
      mechanic: 'Os ramos elevador/abaixador representam a troca entre tensão e corrente com potência conservada.',
      physicsNote: 'Real: indução mútua, relação de espiras e conservação de potência no caso ideal. Lúdico: “potência” virar dano e cadência.',
      formula: { tex: '\\dfrac{V_2}{V_1} = \\dfrac{N_2}{N_1}', label: 'Transformador ideal' },
    },
    unlockText: 'Conclua a fase 4-1.',
  },
};

export const UNITS: Record<UnitId, UnitDef> = { ...BASE_UNITS, ...EXPANSION_UNITS };

/** Ordem de exibição (as unidades do Patch 1.1 vêm depois das originais). */
export const UNIT_ORDER: UnitId[] = [
  'rele',
  'bobina',
  'fonte',
  'indutor',
  'diodo',
  'capacitor',
  'rl',
  'transformador',
  'resistor',
  'retificador',
  'transistor',
  'oscilador',
  'ci555',
  'tesla',
  'supercondutor',
];

/** Unidades com bobina (recebem bônus quando protegidas por diodo — referência ao flyback). */
export const INDUCTIVE_UNITS: UnitId[] = ['rele', 'bobina', 'indutor', 'rl', 'oscilador', 'tesla'];
