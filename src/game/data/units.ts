import type { UnitId } from '../types';
import { stats, type UnitDef } from './unitTypes';
import { EXPANSION_UNITS } from './unitsExpansion';
import { OVERDRIVE_UNITS } from './unitsOverdrive';

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
 *
 * Patch 1.2 — convenção de escala dos ajustes percentuais
 * -------------------------------------------------------
 * Cada `patch` de nível substitui o atributo por um valor ABSOLUTO. Por isso, quando o
 * patch 1.2 pede “dano-base +50%”, o fator 1,5 é aplicado ao valor-base E a todos os
 * patches absolutos do mesmo atributo. Escalar apenas a base deixaria o nível 1 abaixo do
 * nível 0 (melhorar pioraria a unidade) — o que violaria a integridade matemática exigida.
 *
 * Percentuais de evolução (`tiers[].apply`) são multiplicadores sobre o resultado dos
 * níveis e se acumulam com os valores anteriores à atualização, exceto quando o patch diz
 * explicitamente “X para Y” ou “substituindo” — nesses casos o valor é trocado.
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
    // 1.2: limite de posicionamento 5 → 4
    limit: 4,
    color: '#3d9bff',
    // 1.2: dano-base +50% (×1,5); raio do pulso 50–62 → 65–80; intervalo-base −20% (×0,8)
    base: stats({ damage: 82.5, interval: 2.08, range: 125, splash: 65 }),
    levels: [
      {
        cost: 190,
        title: 'Mais espiras',
        why: 'Em um solenoide longo B ≈ μ·N·I / l: mais espiras por comprimento produzem campo maior.',
        patch: { damage: 112.5 },
      },
      {
        cost: 260,
        title: 'Núcleo ferromagnético',
        why: 'Um núcleo de alta permeabilidade concentra o fluxo magnético (μ maior).',
        patch: { splash: 80 },
      },
      {
        cost: 360,
        title: 'Pulso prolongado',
        why: 'Adaptação lúdica: o pulso mantém o campo por mais tempo e atrasa os inimigos atingidos.',
        patch: { damage: 150, slow: 0.3, slowDur: 1.2 },
      },
      {
        cost: 500,
        title: 'Corrente de pico ampliada',
        why: 'Condutores de maior seção suportam correntes maiores sem aquecimento excessivo.',
        patch: { damage: 210, interval: 1.76 },
      },
    ],
    tiers: [
      { name: 'Bobina Eletromagnética', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
      {
        name: 'Bobina de Núcleo Laminado',
        ec: 140,
        // 1.2: dano +40% sobre o anterior (1,2 × 1,4 = 1,68); raio do pulso +10; alcance +30
        summary: 'Dano +68%, raio do pulso +10 e alcance +30.',
        why: 'Laminar o núcleo reduz as correntes parasitas (de Foucault) e as perdas associadas, e o campo útil alcança mais longe.',
        apply: (s) => {
          s.damage *= 1.68;
          s.splash += 10;
          s.range += 30;
        },
      },
      {
        name: 'Eletroímã de Alta Potência',
        ec: 340,
        // 1.2: dano +50% sobre o anterior (1,2 × 1,5 = 1,8); recuo 26 → 15; lentidão +30%
        summary: 'Dano +80%, lentidão 30% mais longa e o pulso empurra os inimigos para trás (recuo 15).',
        why: 'Eletroímãs exercem força sobre materiais ferromagnéticos; no jogo, isso vira um recuo ao longo do caminho (sem teletransporte).',
        apply: (s) => {
          s.damage *= 1.8;
          s.knockback = 15;
          s.slowDur *= 1.3;
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
    // 1.2: geração-base −20% (×0,8); intervalo 6–5,25 s → 7–6 s; melhorias básicas +20%
    base: stats({ income: 21.6, interval: 7, aura: 110 }),
    levels: [
      {
        cost: 168,
        title: 'Regulação de tensão',
        why: 'Uma saída regulada mantém a tensão estável mesmo com variação de carga.',
        patch: { income: 31.2 },
      },
      {
        cost: 252,
        title: 'Maior potência nominal',
        why: 'Transformador e semicondutores dimensionados para mais potência fornecem mais energia ao sistema.',
        patch: { income: 43.2 },
      },
      {
        cost: 360,
        title: 'Filtragem aprimorada',
        why: 'Capacitores e indutores de filtro reduzem a ondulação (ripple) da saída.',
        patch: { income: 60, interval: 6 },
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
        // 1.2: geração +50% sobre o anterior (1,6 × 1,5 = 2,4); desconto das melhorias comuns
        // 15% → 10%; melhorias exclusivas 25% mais caras (eficiência, estabilidade, conversão)
        summary: 'Geração +140%, melhorias comuns 10% mais baratas e 3 melhorias exclusivas.',
        why: 'A retificação síncrona substitui diodos por transistores (MOSFETs) e reduz as perdas de condução.',
        apply: (s) => {
          s.income *= 2.4;
        },
        upgradeDiscount: 0.1,
        extraLevels: [
          {
            cost: 450,
            title: 'MOSFETs de baixa RDS(on) — eficiência energética',
            why: 'Menor resistência de condução nos transistores síncronos reduz a perda I²·R: mais energia chega à saída em vez de virar calor.',
            patch: { income: 72 },
          },
          {
            cost: 575,
            title: 'Malha de realimentação rápida — estabilidade de tensão',
            why: 'Um compensador com margem de fase adequada corrige desvios de carga sem oscilar: a saída se mantém regulada e o ciclo de entrega encurta.',
            patch: { interval: 5.1, income: 86 },
          },
          {
            cost: 725,
            title: 'Correção do fator de potência (PFC) — conversão de potência',
            why: 'Com fator de potência próximo de 1, a corrente de entrada acompanha a tensão e quase toda a potência aparente vira potência ativa: uma reserva é entregue ao fim de cada onda.',
            patch: { income: 96, waveIncome: 60 },
          },
        ],
      },
    ],
    special: 'Alimentação: capacitores dentro do raio da fonte carregam 10% mais rápido.',
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
    // 1.2: dano-base +50% (×1,5) e liberação-base +25% (×1,25) — ver nota de escala no topo
    base: stats({ damage: 70.2, interval: 0.5, range: 120, tau: 1.4, burst: 62.5 }),
    levels: [
      {
        cost: 150,
        title: 'Tensão de acionamento maior',
        why: 'Com V maior, a corrente final V/R e a taxa inicial di/dt = V/L crescem; τ = L/R não muda.',
        patch: { damage: 97.5 },
      },
      {
        cost: 230,
        title: 'Enrolamento de menor resistência',
        why: 'Reduzir R aumenta a corrente final V/R, mas também aumenta τ = L/R: a rampa fica mais lenta.',
        patch: { damage: 124.8, tau: 1.7 },
      },
      {
        cost: 320,
        title: 'Maior energia armazenada',
        why: 'Com mais corrente, a energia no campo cresce com o quadrado: E = ½·L·I².',
        patch: { burst: 125, range: 135 },
      },
      {
        cost: 460,
        title: 'Corrente nominal ampliada',
        why: 'Fio e núcleo dimensionados para corrente maior, abaixo da saturação do núcleo.',
        patch: { damage: 175.5 },
      },
    ],
    tiers: [
      { name: 'Indutor', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
      {
        name: 'Indutor de Alta Indutância',
        ec: 150,
        // 1.2: dano +30% sobre o anterior (1,4 × 1,3 = 1,82); rampa 40% mais lenta
        // (substitui os 35% do patch 1.1); 2 alvos simultâneos
        summary: 'Dano +82%, rapidez de liberação +50%, 2 alvos, rampa 40% mais lenta.',
        why: 'L maior armazena mais energia para a mesma corrente (E = ½LI²) e responde mais devagar (τ = L/R). Derivações no enrolamento alimentam um segundo feixe.',
        apply: (s) => {
          s.damage *= 1.82;
          s.burst *= 1.5;
          s.tau *= 1.4;
          s.targets = Math.max(s.targets, 2);
        },
      },
      {
        name: 'Núcleo Magnético Especializado',
        ec: 360,
        // 1.2: dano +70% sobre o anterior (1,5 × 1,7 = 2,55); liberação +100% (1,75 × 2 = 3,5)
        summary: 'Dano +155%, rapidez de liberação +250% e atinge até 3 inimigos. Libera 2 melhorias exclusivas.',
        why: 'Núcleos de alta permeabilidade e baixas perdas concentram o fluxo com menos aquecimento; derivações no enrolamento alimentam vários feixes.',
        apply: (s) => {
          s.damage *= 2.55;
          s.burst *= 3.5;
          s.targets = 3;
        },
        extraLevels: [
          {
            cost: 1200,
            title: 'Entreferro calibrado (upgrade I)',
            why: 'Um entreferro bem dimensionado afasta o núcleo da saturação: a indutância se mantém com correntes muito maiores, elevando V/R e a energia ½LI².',
            patch: { damage: 320, range: 150 },
          },
          {
            cost: 2150,
            title: 'Núcleo nanocristalino (upgrade II)',
            why: 'Ligas nanocristalinas somam permeabilidade altíssima a perdas mínimas em alta frequência: mais fluxo útil por ampère, com menos aquecimento.',
            patch: { damage: 520, range: 165, burst: 170 },
          },
        ],
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
    // 1.2: dano-base por golpe +300% (×4); raio de proteção 105–130 → 120–150
    base: stats({ damage: 36, interval: 0.8, range: 130, aura: 120, protect: true }),
    levels: [
      {
        cost: 110,
        title: 'Maior corrente direta nominal',
        why: 'Diodos de maior corrente direta suportam o pico de descarga de bobinas maiores.',
        patch: { damage: 52 },
      },
      {
        cost: 170,
        title: 'Proteção distribuída',
        why: 'Adaptação lúdica: a área protegida pelo diodo aumenta.',
        patch: { aura: 150 },
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
        patch: { damage: 100 },
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
        // 1.2: dano +100% (substitui os +40% anteriores); buff das protegidas 8% → 15%
        summary: 'Dano +100% e unidades protegidas recebem +15% de dano.',
        why: 'Diodos TVS são projetados para grampear surtos de tensão e proteger o restante do circuito.',
        apply: (s) => {
          s.damage *= 2;
          s.auraDamage += 0.15;
        },
      },
    ],
    special:
      'Proteção: unidades no raio ficam imunes à Interferência e ao Ruído e sofrem menos com o Colapso. Componentes com bobina protegidos (relé, bobina, indutor, RL) recebem +15% de dano. Grampeamento: dano dobrado contra Surtos de Tensão.',
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
    // 1.2: limite de posicionamento 4 → 3
    limit: 3,
    color: '#f2bf4a',
    // 1.2: dano +10% (×1,1); constante de carga 30% mais lenta (τ ×1,3);
    // intervalo entre descargas 15% mais lento (`recoverMul`); alcance 115 → 130
    base: stats({ damage: 101.2, tau: 2.366, range: 130, splash: 70, slow: 0.35, slowDur: 1.5, recoverMul: 1.15 }),
    levels: [
      {
        cost: 190,
        title: 'Maior capacitância',
        why: 'A energia armazenada no campo elétrico é E = ½·C·V²: C maior armazena mais energia.',
        patch: { damage: 132.825 },
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
        patch: { splash: 85, tau: 1.9435 },
      },
      {
        cost: 500,
        title: 'Maior tensão nominal',
        why: 'Como a energia cresce com V², suportar tensão maior aumenta muito a energia disponível.',
        patch: { damage: 189.75 },
      },
    ],
    tiers: [
      { name: 'Capacitor', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
      {
        name: 'Capacitor Eletrolítico',
        ec: 140,
        // 1.2: dano +50% sobre o anterior (1,4 × 1,5 = 2,1); carga 10% mais rápida;
        // intervalo entre descargas 10% mais rápido
        summary: 'Dano +110%, constante de carga 10% mais rápida e descargas 10% mais frequentes.',
        why: 'Capacitores eletrolíticos oferecem alta capacitância por volume (e têm polaridade); a ESR menor acelera carga e descarga.',
        apply: (s) => {
          s.damage *= 2.1;
          s.tau *= 0.9;
          s.recoverMul *= 0.9;
        },
      },
      {
        name: 'Banco de Capacitores',
        ec: 340,
        // 1.2: dano +50% sobre o anterior (1,3 × 1,5 = 1,95); descargas secundárias 55% → 45%
        summary: 'Dano +95%, armazena 2 cargas e cada disparo vem seguido de 2 descargas consecutivas (45% cada).',
        why: 'Capacitores em paralelo somam capacitâncias (C_eq = C₁ + C₂): cada célula do banco descarrega em sequência sobre a mesma carga.',
        apply: (s) => {
          s.damage *= 1.95;
          s.charges = 2;
          s.salvo = 2;
          s.salvoMul = 0.45;
        },
      },
    ],
    ability: {
      kind: 'discharge',
      name: 'Descarga Total',
      desc: 'Fecha a chave de carga rápida: completa a carga instantaneamente e libera toda a energia armazenada (cargas + carga atual) em todos os inimigos no alcance, com dano ×1,6.',
      // 1.2: recarga da habilidade 22 s → 30 s
      cooldown: 30,
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

export const UNITS: Record<UnitId, UnitDef> = { ...BASE_UNITS, ...EXPANSION_UNITS, ...OVERDRIVE_UNITS };

/** Ordem de exibição (1.1 depois das originais; 1.2 no fim). */
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
  // Patch 1.2
  'mosfet',
  'igbt',
  'trafopot',
  'cristal',
  'ampop',
  'plasma',
];

/** Unidades com bobina (recebem bônus quando protegidas por diodo — referência ao flyback). */
export const INDUCTIVE_UNITS: UnitId[] = ['rele', 'bobina', 'indutor', 'rl', 'oscilador', 'tesla', 'trafopot', 'cristal'];

/* ---------------------------------------------------------------------- */
/* 1.2: categorias usadas pelos modificadores (§11) e pelas sinergias      */
/* ---------------------------------------------------------------------- */

/** Unidades cujo funcionamento depende de junções semicondutoras. */
export const SEMICONDUCTOR_UNITS: UnitId[] = ['diodo', 'transistor', 'retificador', 'ci555', 'mosfet', 'igbt', 'ampop', 'cristal'];

/** Unidades cujo dano vem de núcleo/campo magnético. */
export const MAGNETIC_UNITS: UnitId[] = ['bobina', 'indutor', 'rl', 'oscilador', 'transformador', 'trafopot', 'supercondutor'];

/** Unidades baseadas em transistores (sofrem a Falha de comutação). */
export const TRANSISTOR_UNITS: UnitId[] = ['transistor', 'mosfet', 'igbt', 'ampop'];

/** Unidades temporizadoras (sofrem a Instabilidade de frequência). */
export const TIMER_UNITS: UnitId[] = ['ci555', 'oscilador', 'cristal'];

/** Unidades cujo dano contínuo é térmico/ionizante (sofrem o Efeito Joule). */
export const THERMAL_UNITS: UnitId[] = ['resistor', 'plasma'];
