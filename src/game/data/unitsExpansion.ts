import { stats, type UnitDef } from './unitTypes';

/**
 * Unidades do Patch 1.1. Cada uma traduz uma propriedade física do componente em uma
 * mecânica própria (nada de “dano genérico com outro nome”):
 *
 *  - Resistor de Potência → efeito Joule (P = I²R): aquecimento que cresce com o quadrado.
 *  - Ponte Retificadora   → converte energia alternada em contínua: dano vira créditos.
 *  - Transistor           → amplificação progressiva até a saturação (ganho hFE).
 *  - Oscilador LC         → semiciclos alternados e ressonância.
 *  - CI 555               → temporização astável: disparo sincronizado e ciclo de trabalho.
 *  - Bobina de Tesla      → arcos de alta tensão que saltam entre alvos.
 *  - Supercondutor        → resistência zero: corrente persistente e efeito Meissner (secreta).
 */

const RESISTOR: UnitDef = {
  id: 'resistor',
  name: 'Resistor de Potência',
  short: 'Resistor',
  classes: ['Control', 'DPS'],
  rarity: 'comum',
  role: 'Aquece os inimigos: dano contínuo que cresce com o quadrado do aquecimento e ignora blindagem.',
  damageType: 'termico',
  behavior: 'heat',
  cost: 160,
  limit: 5,
  color: '#ff7a59',
  // 1.2: dano-base por golpe +400% (×5); dano térmico máximo +70% (heatCoef ×1,7)
  base: stats({ damage: 35, interval: 0.9, range: 110, heat: 1, heatMax: 5, heatCoef: 1.53 }),
  levels: [
    {
      cost: 110,
      title: 'Maior potência nominal',
      why: 'Resistores especificados para mais watts suportam maior dissipação sem se danificar.',
      patch: { damage: 50, heatMax: 6 },
    },
    {
      cost: 170,
      title: 'Resistor de fio enrolado',
      why: 'Resistores de fio (wirewound) dissipam potências maiores com estabilidade térmica.',
      patch: { heatCoef: 1.87 },
    },
    {
      cost: 240,
      title: 'Divisor de corrente (dois ramos)',
      why: 'Resistores em paralelo dividem a corrente entre ramos: o calor passa a ser aplicado em dois alvos.',
      patch: { targets: 2 },
    },
    {
      cost: 340,
      title: 'Dissipação forçada',
      why: 'Com dissipador e ventilação, o resistor opera em potência maior: aquece mais rápido e mais alto.',
      patch: { heat: 2, heatMax: 7 },
    },
  ],
  tiers: [
    { name: 'Resistor de Potência', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
    {
      name: 'Resistor Cerâmico de Potência',
      ec: 110,
      // 1.2: dano térmico +50% sobre o anterior (1,3 × 1,5 = 1,95); intervalo −10%; 2 alvos
      summary: 'Dano térmico (k·n²) +95%, intervalo −10% e 2 alvos simultâneos.',
      why: 'O corpo cerâmico suporta temperaturas maiores e conduz bem o calor para fora, permitindo ciclos mais curtos em dois ramos.',
      apply: (s) => {
        s.heatCoef *= 1.95;
        s.interval *= 0.9;
        s.targets = Math.max(s.targets, 2);
      },
    },
    {
      name: 'Banco de Resistores de Frenagem',
      ec: 300,
      // 1.2: alvos adicionais +1 → +3; aquecimento máximo +1 → +2
      summary: '+3 alvos e aquecimento máximo +2.',
      why: 'Bancos de frenagem dissipam em calor a energia devolvida por motores durante a frenagem, em vários ramos em paralelo.',
      apply: (s) => {
        s.targets += 3;
        s.heatMax += 2;
      },
    },
  ],
  special:
    'Efeito Joule: cada golpe aquece o inimigo (+1 estágio, até o limite do resistor). Inimigos aquecidos sofrem dano contínuo de k·n² por segundo (n = estágios), que ignora blindagem. O calor cai 1 estágio a cada 1,5 s e bloqueia a regeneração (Fuga de Corrente). Ao ser destruído, metade do calor se propaga para inimigos a até 55 unidades.',
  tech: {
    definition: 'Componente que se opõe à passagem da corrente e converte energia elétrica em calor.',
    principle:
      'A potência dissipada é P = V·I = I²·R = V²/R. Dobrar a corrente quadruplica o calor. Resistores de potência são dimensionados para dissipar esse calor sem ultrapassar sua temperatura máxima.',
    characteristics: ['Resistência R (ohm, Ω)', 'Potência nominal (W)', 'Tolerância', 'Coeficiente de temperatura'],
    applications: ['Limitação de corrente', 'Divisores de tensão', 'Resistores de frenagem em inversores', 'Cargas de teste (dummy loads)'],
    mechanic:
      'O aquecimento acumulado faz o papel da corrente: o dano contínuo cresce com o quadrado dos estágios, como P = I²R.',
    physicsNote:
      'Real: dissipação por efeito Joule, dependência quadrática com a corrente e propagação de calor. Lúdico: o calor causar dano nos inimigos e se espalhar quando um deles é destruído.',
    formula: { tex: 'P = I^2 R = \\dfrac{V^2}{R}', label: 'Potência dissipada (efeito Joule)' },
  },
  unlockText: 'Conclua a fase 7-1.',
};

const RETIFICADOR: UnitDef = {
  id: 'retificador',
  name: 'Ponte Retificadora',
  short: 'Retificador',
  classes: ['Economy', 'Support'],
  rarity: 'incomum',
  role: 'Converte o dano causado pelas unidades vizinhas em créditos e filtra o ruído.',
  damageType: null,
  behavior: 'rectifier',
  cost: 220,
  limit: 2,
  color: '#7fe36b',
  // 1.2: conversão 2–5 → 4–8 EC a cada 100 de dano
  base: stats({ aura: 110, conversion: 4 }),
  levels: [
    {
      cost: 150,
      title: 'Ponte completa (onda completa)',
      why: 'Na meia onda só um semiciclo é aproveitado (média Vp/π); a ponte de 4 diodos aproveita os dois (média 2Vp/π): o dobro.',
      patch: { conversion: 6 },
    },
    {
      cost: 220,
      title: 'Capacitor de filtro maior',
      why: 'Um filtro capacitivo maior reduz a ondulação (ripple) e estende a área atendida.',
      patch: { aura: 140 },
    },
    {
      cost: 320,
      title: 'Diodos de menor queda direta',
      why: 'Cada diodo conduzindo “perde” sua queda direta (≈ 0,7 V no silício); diodos de queda menor desperdiçam menos.',
      patch: { conversion: 8 },
    },
  ],
  tiers: [
    { name: 'Ponte Retificadora', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
    {
      name: 'Ponte de Diodos Schottky',
      ec: 120,
      // 1.2: conversão +35% sobre o anterior (1,2 × 1,35 = 1,62)
      summary: 'Conversão +62%.',
      why: 'Diodos Schottky têm queda direta menor (≈ 0,3 V) e comutam mais rápido.',
      apply: (s) => {
        s.conversion *= 1.62;
      },
    },
    {
      name: 'Retificador Síncrono Ativo',
      ec: 300,
      // 1.2: conversão +50% sobre o anterior (1,25 × 1,5 = 1,875); raio +20 → +40
      summary: 'Conversão +88% e raio +40.',
      why: 'Transistores controlados substituem os diodos e quase eliminam a perda de condução.',
      apply: (s) => {
        s.conversion *= 1.875;
        s.aura += 40;
      },
    },
  ],
  special:
    'Retificação: a cada 100 de dano causado por unidades dentro do raio, gera créditos (meia onda: 4; ponte completa: 6; diodos de baixa queda: 8). Filtro: unidades no raio sofrem metade do efeito do Ruído Elétrico. Não ataca.',
  tech: {
    definition: 'Circuito de diodos que converte corrente alternada em corrente contínua pulsante.',
    principle:
      'Os diodos conduzem só quando diretamente polarizados. Na ponte (4 diodos), os dois semiciclos são direcionados no mesmo sentido para a carga. Um capacitor de filtro suaviza a tensão pulsante.',
    characteristics: ['Meia onda × onda completa', 'Queda direta dos diodos', 'Tensão de ondulação (ripple)', 'Corrente média na carga'],
    applications: ['Fontes de alimentação', 'Carregadores de bateria', 'Inversores e conversores'],
    mechanic:
      'A energia “alternada” das unidades em combate é retificada e vira crédito utilizável; a ponte completa aproveita o dobro da meia onda.',
    physicsNote:
      'Real: condução unidirecional dos diodos, relação 2× entre onda completa e meia onda, filtragem capacitiva. Lúdico: dano virar créditos.',
    formula: { tex: 'V_{m\\acute{e}d} = \\dfrac{2V_p}{\\pi} \\;(\\text{onda completa}) \\qquad V_{m\\acute{e}d} = \\dfrac{V_p}{\\pi} \\;(\\text{meia onda})', label: 'Tensão média retificada' },
  },
  unlockText: 'Conclua a fase 8-3.',
};

const TRANSISTOR: UnitDef = {
  id: 'transistor',
  name: 'Transistor Bipolar (BJT)',
  short: 'Transistor',
  classes: ['DPS', 'Support'],
  rarity: 'raro',
  role: 'Amplificação progressiva: o dano cresce a cada golpe no mesmo alvo até a saturação.',
  damageType: 'comutacao',
  behavior: 'amplifier',
  cost: 280,
  limit: 4,
  color: '#5ab4ff',
  // 1.2: dano por golpe +350% (×4,5); ganho por estágio 25% → 30% (valor-base);
  // dano-base na saturação +40% (`satBonus`)
  base: stats({ damage: 40.5, interval: 0.55, range: 120, gain: 8, gainStep: 0.3, satBonus: 0.4, aura: 90, auraDamage: 0.1 }),
  levels: [
    {
      cost: 160,
      title: 'Maior corrente de coletor',
      why: 'Transistores com IC máxima maior entregam mais corrente à carga.',
      patch: { damage: 54 },
    },
    {
      cost: 230,
      title: 'Ganho hFE maior',
      why: 'Na região ativa, IC = β·IB: um β maior permite amplificar mais antes da saturação.',
      patch: { gain: 10 },
    },
    {
      cost: 320,
      title: 'Polarização forçada (habilidade)',
      why: 'Injetar corrente de base acima do necessário leva o transistor direto à saturação.',
      patch: { ability: true, range: 135 },
    },
    {
      cost: 460,
      title: 'Encapsulamento de potência',
      why: 'Encapsulamentos com dissipador (TO-220, TO-3) permitem corrente e frequência de comutação maiores.',
      patch: { damage: 76.5, interval: 0.48 },
    },
  ],
  tiers: [
    { name: 'Transistor Bipolar (BJT)', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
    {
      name: 'Transistor Darlington',
      ec: 150,
      // 1.2: ganho por estágio +60% sobre o anterior (1,4 × 1,6 = 2,24); dano +30%
      summary: 'Cada estágio de ganho rende 124% a mais e o dano sobe 30%.',
      why: 'Dois transistores em cascata: o ganho total é aproximadamente β₁·β₂.',
      apply: (s) => {
        s.gainStep *= 2.24;
        s.damage *= 1.3;
      },
    },
    {
      name: 'Par Complementar Push-Pull',
      ec: 340,
      // 1.2: dano +80% sobre o anterior (1,2 × 1,8 = 2,16); na saturação +2 alvos adicionais
      summary: 'Dano +116% e, na saturação, +2 alvos adicionais.',
      why: 'Um NPN e um PNP conduzem alternadamente cada semiciclo, dobrando o aproveitamento do estágio de saída.',
      apply: (s) => {
        s.damage *= 2.16;
        s.targets += 2;
      },
    },
  ],
  ability: {
    kind: 'forceBias',
    name: 'Polarização forçada',
    desc: 'Leva o transistor à saturação imediatamente e a mantém por 6 s (ganho máximo, alvo extra e amplificação das vizinhas).',
    cooldown: 24,
    duration: 6,
  },
  special:
    'Amplificação progressiva: cada golpe consecutivo no mesmo alvo soma um estágio de ganho (+30% de dano cada, até o hFE). Trocar de alvo perde metade dos estágios; 1,5 s sem alvo leva ao corte (zero). Na saturação, o dano ganha +40% adicional, o golpe atinge alvos extras e unidades a até 90 recebem +10% de dano (amplificação do sinal).',
  tech: {
    definition: 'Dispositivo semicondutor de três terminais (base, coletor, emissor) em que uma pequena corrente controla uma corrente maior.',
    principle:
      'Na região ativa, IC ≈ β·IB (β = hFE, ganho de corrente). Aumentando IB, IC cresce até a saturação, quando o transistor se comporta como uma chave fechada; com IB = 0 ele está em corte (chave aberta).',
    characteristics: ['Ganho de corrente β (hFE)', 'Corrente máxima de coletor', 'Tensão VCE de saturação', 'Regiões de corte, ativa e saturação'],
    applications: ['Amplificadores de áudio e sinal', 'Chaves eletrônicas (acionamento de relés)', 'Fontes chaveadas', 'Portas lógicas'],
    mechanic:
      'Os estágios de ganho representam o aumento progressivo da corrente amplificada; o limite é a saturação, e a falta de sinal leva ao corte.',
    physicsNote:
      'Real: IC = β·IB, regiões de corte/ativa/saturação, montagem Darlington e push-pull. Lúdico: o ganho crescer a cada golpe e virar dano.',
    formula: { tex: 'I_C = \\beta \\, I_B', label: 'Ganho de corrente na região ativa' },
  },
  unlockText: 'Conclua a fase 7-3.',
};

const OSCILADOR: UnitDef = {
  id: 'oscilador',
  name: 'Oscilador LC',
  short: 'Oscilador',
  classes: ['Control', 'Burst'],
  rarity: 'epico',
  role: 'Emite ondas em semiciclos alternados; inimigos atingidos em sequência entram em ressonância.',
  damageType: 'magnetico',
  behavior: 'wave',
  cost: 340,
  limit: 2,
  color: '#c77dff',
  base: stats({ damage: 42, interval: 2, range: 130, slow: 0.3, slowDur: 1.2, knockback: 14, resonance: 3 }),
  levels: [
    {
      cost: 200,
      title: 'Indutor do tanque maior',
      why: 'No circuito tanque, a energia oscila entre L e C: mais energia armazenada, maior amplitude.',
      patch: { damage: 58 },
    },
    {
      cost: 270,
      title: 'Fator de qualidade (Q) elevado',
      why: 'Menos perdas (Q alto) mantêm a oscilação forte por mais tempo e mais longe.',
      patch: { range: 150 },
    },
    {
      cost: 360,
      title: 'Frequência de ressonância (habilidade)',
      why: 'Excitar o sistema na sua frequência natural produz amplitude máxima.',
      patch: { ability: true },
    },
    {
      cost: 500,
      title: 'Capacitor de sintonia',
      why: 'f = 1/(2π√LC): reduzir C eleva a frequência e encurta o período.',
      patch: { damage: 80, interval: 1.7 },
    },
  ],
  tiers: [
    { name: 'Oscilador LC', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
    {
      name: 'Oscilador a Cristal (Quartzo)',
      ec: 160,
      summary: 'Ressonância com 2 ondas em vez de 3.',
      why: 'O cristal de quartzo vibra em uma frequência muito estável (efeito piezoelétrico), com Q altíssimo.',
      apply: (s) => {
        s.resonance = 2;
      },
    },
    {
      name: 'Oscilador Controlado por Tensão (VCO)',
      ec: 360,
      summary: 'Dano +20% e período −6% por inimigo no alcance (até −40%).',
      why: 'No VCO, uma tensão de controle ajusta a frequência de oscilação.',
      apply: (s) => {
        s.damage *= 1.2;
        s.vco = 0.06;
      },
    },
  ],
  ability: {
    kind: 'resonance',
    name: 'Frequência de ressonância',
    desc: 'Por 6 s o período cai pela metade e todo semiciclo positivo provoca a ressonância nos inimigos atingidos.',
    cooldown: 26,
    duration: 6,
  },
  special:
    'Semiciclos: a cada período, uma onda atinge todos os inimigos no alcance. O semiciclo positivo causa dano total; o negativo causa 50%, desacelera e empurra para trás. Ressonância: inimigos atingidos por 3 semiciclos positivos seguidos sofrem um pico de 2,5× o dano. Contra a Ressonância Harmônica, as ondas entram em oposição de fase (+60% de dano).',
  tech: {
    definition: 'Circuito que gera um sinal periódico a partir de uma fonte contínua; no oscilador LC, a energia troca entre o indutor e o capacitor.',
    principle:
      'No circuito tanque ideal, a energia passa do campo elétrico do capacitor para o campo magnético do indutor e volta, em f = 1/(2π√LC). Perdas resistivas amortecem a oscilação; um amplificador repõe a energia perdida.',
    characteristics: ['Frequência de ressonância', 'Fator de qualidade Q', 'Amortecimento (resistência)', 'Estabilidade de frequência'],
    applications: ['Transmissores e receptores de rádio', 'Geração de clock', 'Fontes ressonantes', 'Sintonia de filtros'],
    mechanic:
      'As ondas alternam semiciclos positivo e negativo; acertar o mesmo inimigo em sequência acumula energia como uma excitação na frequência de ressonância.',
    physicsNote:
      'Real: troca de energia L↔C, f = 1/(2π√LC), Q e amortecimento. Lúdico: a onda causar dano e a ressonância virar um pico de dano.',
    formula: { tex: 'f_0 = \\dfrac{1}{2\\pi\\sqrt{LC}}', label: 'Frequência de ressonância do circuito LC' },
  },
  unlockText: 'Conclua a fase 9-3.',
};

const CI555: UnitDef = {
  id: 'ci555',
  name: 'CI Temporizador 555',
  short: 'CI 555',
  classes: ['Support', 'Control'],
  rarity: 'lendario',
  role: 'Disparo sincronizado: a cada período interrompe inimigos e faz as unidades vizinhas atacarem juntas.',
  damageType: 'comutacao',
  behavior: 'timer',
  cost: 400,
  limit: 1,
  color: '#ffd166',
  // 1.2: período 6–4,5 s → 5–3,5 s; ciclo de trabalho 45–60% → 50–70%;
  // raio 125–145 → 135–155; duração do atordoamento +100% (×2)
  base: stats({ damage: 15, interval: 5, duty: 0.5, range: 135, aura: 135, auraSpeed: 0.2, stun: 1.2, charges: 1 }),
  levels: [
    {
      cost: 220,
      title: 'Ciclo de trabalho maior',
      why: 'No modo astável, D = (R₁ + R₂)/(R₁ + 2R₂): aumentar R₁ prolonga o nível alto.',
      patch: { duty: 0.7 },
    },
    {
      cost: 300,
      title: 'Comparadores mais rápidos',
      why: 'Os comparadores internos (limiares de 1/3 e 2/3 de Vcc) definem com precisão o instante de disparo.',
      patch: { range: 155, aura: 155, stun: 1.6 },
    },
    {
      cost: 380,
      title: 'Modo monoestável (habilidade)',
      why: 'No modo monoestável, um único gatilho gera um pulso de duração T = 1,1·R·C.',
      patch: { ability: true },
    },
    {
      cost: 520,
      title: 'Capacitor de temporização menor',
      why: 'No astável, T ≈ 0,693·(R₁ + 2R₂)·C: um C menor encurta o período.',
      patch: { interval: 3.5 },
    },
  ],
  tiers: [
    { name: 'CI Temporizador 555', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
    {
      name: 'CI 556 (Temporizador Duplo)',
      ec: 180,
      summary: 'Um segundo temporizador dispara no meio do período (interrupção apenas).',
      why: 'O 556 reúne dois 555 independentes no mesmo encapsulamento.',
      apply: (s) => {
        s.charges = 2;
      },
    },
    {
      name: 'Temporizador CMOS (7555)',
      ec: 380,
      // 1.2: interrupção +0,3 s → +0,5 s; cadência do nível alto +10% → +25%
      summary: 'Interrupção +0,5 s e cadência do nível alto +25%.',
      why: 'A versão CMOS consome menos corrente e comuta com transições mais limpas.',
      apply: (s) => {
        s.stun += 0.5;
        s.auraSpeed += 0.25;
      },
    },
  ],
  ability: {
    kind: 'monostable',
    name: 'Disparo monoestável',
    desc: 'Gatilho imediato com interrupção dobrada e nível alto por 5 s com o dobro do bônus de cadência.',
    cooldown: 30,
    duration: 5,
  },
  special:
    'Astável: a cada período T, na borda de subida, interrompe os inimigos no alcance (chefes: metade) e sincroniza as unidades no raio, que disparam imediatamente. Durante o nível alto (D·T) as unidades no raio ganham cadência. Limite: 1 por partida.',
  tech: {
    definition: 'Circuito integrado temporizador com dois comparadores, um flip-flop e um transistor de descarga.',
    principle:
      'O capacitor externo carrega por R₁ + R₂ e descarrega por R₂. Os comparadores mudam o flip-flop em 2/3 e 1/3 de Vcc, gerando uma onda quadrada (astável) ou um pulso único (monoestável).',
    characteristics: ['Período T ≈ 0,693·(R₁ + 2R₂)·C', 'Ciclo de trabalho D', 'Modos astável e monoestável', 'Saída capaz de acionar relés e LEDs'],
    applications: ['Pisca-piscas e geradores de clock', 'Temporizadores de atraso', 'Modulação PWM simples', 'Debounce de botões'],
    mechanic:
      'A borda de subida da onda quadrada sincroniza as unidades; o ciclo de trabalho define quanto tempo o bônus fica ativo.',
    physicsNote:
      'Real: carga e descarga RC entre 1/3 e 2/3 de Vcc, período e ciclo de trabalho. Lúdico: o pulso interromper inimigos e acelerar unidades.',
    formula: { tex: 'T \\approx 0{,}693\\,(R_1 + 2R_2)\\,C \\qquad D = \\dfrac{R_1 + R_2}{R_1 + 2R_2}', label: '555 no modo astável' },
  },
  unlockText: 'Conclua a fase 10-3.',
};

const TESLA: UnitDef = {
  id: 'tesla',
  name: 'Bobina de Tesla',
  short: 'Tesla',
  classes: ['Burst', 'Control'],
  rarity: 'mitico',
  role: 'Arcos de alta tensão que saltam entre vários inimigos.',
  damageType: 'descarga',
  behavior: 'chain',
  cost: 600,
  limit: 1,
  color: '#8ff7ff',
  // 1.2: intervalo-base −11% (×0,89); dano +300% (×4); saltos 4–6 → 5–7
  base: stats({ damage: 380, interval: 1.602, range: 140, chains: 5, chainDecay: 0.8, stun: 0.15 }),
  levels: [
    {
      cost: 300,
      title: 'Secundário com mais espiras',
      why: 'A tensão no secundário cresce com a relação de espiras e com a ressonância entre primário e secundário.',
      patch: { damage: 500 },
    },
    {
      cost: 400,
      title: 'Toroide de descarga maior',
      why: 'O toroide no topo acumula carga e controla de onde partem as descargas.',
      patch: { chains: 7, range: 155 },
    },
    {
      cost: 520,
      title: 'Descarga de alta tensão (habilidade)',
      why: 'Liberar toda a energia acumulada no circuito ressonante produz um arco muito mais longo.',
      patch: { ability: true },
    },
    {
      cost: 700,
      title: 'Centelhador rotativo',
      why: 'Um centelhador (spark gap) mais rápido aumenta a taxa de descargas do primário.',
      patch: { damage: 640, interval: 1.335 },
    },
  ],
  tiers: [
    { name: 'Bobina de Tesla', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
    {
      name: 'Tesla de Estado Sólido (SSTC)',
      ec: 260,
      summary: 'Intervalo −15%.',
      why: 'Transistores substituem o centelhador e comutam o primário de forma controlada.',
      apply: (s) => {
        s.interval *= 0.85;
      },
    },
    {
      name: 'Tesla Ressonante Dupla (DRSSTC)',
      ec: 480,
      // 1.2: dano +50% sobre o anterior (1,3 × 1,5 = 1,95); retenção por salto 80% → 90%
      summary: 'Dano +95%, cada salto mantém 90% e libera 2 melhorias exclusivas.',
      why: 'Primário e secundário sintonizados na mesma frequência transferem energia com muito mais eficiência.',
      apply: (s) => {
        s.damage *= 1.95;
        s.chainDecay = 0.9;
      },
      extraLevels: [
        {
          cost: 2300,
          title: 'Capacitor MMC de baixa perda (upgrade I)',
          why: 'Um banco de capacitores de filme metalizado (MMC) com fator de dissipação baixíssimo devolve ao tanque a energia que antes virava calor: cada ciclo ressonante entrega mais corrente de pico ao primário.',
          patch: { damage: 1080 },
        },
        {
          cost: 3500,
          title: 'Ponte H de IGBTs com realimentação de fase (upgrade II)',
          why: 'Travar a comutação na fase da corrente do secundário (feedback ressonante) mantém o acionamento exatamente na frequência de ressonância: a tensão de saída cresce ciclo após ciclo em vez de se dispersar.',
          patch: { damage: 1750, chains: 9 },
        },
      ],
    },
  ],
  ability: {
    kind: 'hvDischarge',
    name: 'Descarga de alta tensão',
    // 1.2: multiplicador da habilidade 2× → 5×
    desc: 'Um arco com 12 saltos, dano ×5 e interrupção de 0,8 s em cada inimigo atingido.',
    cooldown: 26,
    duration: 0,
  },
  special:
    'Arco em cadeia: cada descarga salta para até N inimigos próximos (até 110 do anterior), perdendo 20% por salto (10% no DRSSTC), e interrompe brevemente. A cada 5 descargas, um “streamer” ganha +2 saltos e +50% de dano. Limite: 1 por equipe (Mítica).',
  tech: {
    definition: 'Transformador ressonante com núcleo de ar que produz tensões altíssimas em alta frequência.',
    principle:
      'Um circuito LC primário excita um secundário com muitas espiras sintonizado na mesma frequência. A ressonância transfere energia ao secundário até a tensão romper a rigidez dielétrica do ar, formando arcos.',
    characteristics: ['Acoplamento fraco primário/secundário', 'Ressonância dos dois circuitos', 'Tensões de centenas de kV', 'Alta frequência (dezenas a centenas de kHz)'],
    applications: ['Demonstrações científicas', 'História da transmissão de energia sem fio', 'Estudo de descargas em gases'],
    mechanic: 'Os saltos entre inimigos representam o arco procurando o caminho de menor rigidez dielétrica.',
    physicsNote:
      'Real: transformador ressonante, ruptura dielétrica do ar e arcos. Lúdico: o arco escolher inimigos e causar dano em cadeia. Alta tensão real é perigosa: apenas especialistas operam esses equipamentos.',
    formula: { tex: 'f_1 = \\dfrac{1}{2\\pi\\sqrt{L_1C_1}} = f_2 = \\dfrac{1}{2\\pi\\sqrt{L_2C_2}}', label: 'Primário e secundário sintonizados' },
  },
  unlockText: 'Conclua a fase 11-3 (final da expansão).',
};

const SUPERCONDUTOR: UnitDef = {
  id: 'supercondutor',
  name: 'Núcleo Supercondutor',
  short: 'Supercondutor',
  classes: ['DPS', 'Control'],
  rarity: 'secreto',
  role: 'Resistência zero: a corrente persiste entre alvos e o campo expulsa e desacelera os inimigos próximos.',
  damageType: 'magnetico',
  behavior: 'super',
  cost: 900,
  limit: 1,
  color: '#5ff2e8',
  // 1.2: dano-base +200% (×3); liberação de dano (quench) +20% (×1,2)
  base: stats({ damage: 450, interval: 0.25, range: 140, targets: 3, tau: 2.5, meissner: 80, meissnerSlow: 0.35, burst: 16.8, ability: true }),
  levels: [
    {
      cost: 450,
      title: 'Fio de nióbio-titânio (NbTi)',
      why: 'NbTi é a liga supercondutora mais usada em ímãs de ressonância magnética.',
      patch: { damage: 600 },
    },
    {
      cost: 600,
      title: 'Blindagem magnética ampliada',
      why: 'O efeito Meissner expulsa o campo do interior do supercondutor; uma blindagem maior desvia o fluxo em área maior.',
      patch: { range: 155, meissner: 100 },
    },
    {
      cost: 800,
      title: 'Corrente crítica elevada',
      why: 'Acima da corrente crítica o material deixa de ser supercondutor; elevá-la permite alimentar mais cargas.',
      patch: { targets: 4, damage: 720 },
    },
  ],
  tiers: [
    { name: 'Núcleo Supercondutor', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
    {
      name: 'Supercondutor de Alta Temperatura (YBCO)',
      ec: 400,
      summary: 'Corrente estabelece 2× mais rápido (τ ÷ 2).',
      why: 'Cerâmicas como YBCO supercondutam a ~92 K, acima do nitrogênio líquido (77 K): resfriamento mais simples.',
      apply: (s) => {
        s.tau *= 0.5;
      },
    },
    {
      name: 'Ímã Supercondutor',
      ec: 700,
      summary: 'Dano +20% e desaceleração Meissner 50%.',
      why: 'Bobinas supercondutoras geram campos muito intensos sem dissipar energia por efeito Joule.',
      apply: (s) => {
        s.damage *= 1.2;
        s.meissnerSlow = 0.5;
      },
    },
  ],
  ability: {
    kind: 'quench',
    name: 'Quench controlado',
    desc: 'Interrompe a supercondutividade e libera a energia armazenada (½LI²) em uma explosão de raio 170 (até 14× o dano/s). Depois, fica 5 s desligado e a corrente recomeça do zero.',
    cooldown: 35,
    duration: 0,
  },
  special:
    'Corrente persistente: feixes em até 3 alvos; a corrente sobe uma vez (τ) e não se perde ao trocar de alvo (R = 0). Efeito Meissner: inimigos a até 80 ficam mais lentos e não recebem acelerações. Temperatura crítica: explosões de Curto-Circuito Franco e saltos do Arco Elétrico a até 70 provocam um quench involuntário (3 s desligado) — exceto se estiver protegido por um diodo. Unidade secreta (1 por equipe).',
  tech: {
    definition: 'Material que, abaixo de uma temperatura crítica, conduz corrente sem resistência elétrica e expulsa o campo magnético do seu interior.',
    principle:
      'Abaixo de Tc, R = 0: uma corrente em um anel supercondutor circula indefinidamente (corrente persistente). O efeito Meissner expulsa o campo magnético. Se a temperatura, o campo ou a corrente passarem do valor crítico, ocorre o quench: a resistência volta e a energia ½LI² é liberada rapidamente como calor.',
    characteristics: ['Temperatura crítica Tc', 'Corrente e campo críticos', 'Efeito Meissner', 'Quench (perda súbita da supercondutividade)'],
    applications: ['Ímãs de ressonância magnética (RM)', 'Aceleradores de partículas', 'Trens de levitação magnética', 'Cabos de energia experimentais'],
    mechanic:
      'R = 0 vira corrente que não se perde ao trocar de alvo; o efeito Meissner vira desaceleração; o quench vira a habilidade explosiva e a vulnerabilidade a calor.',
    physicsNote:
      'Real: resistência nula, corrente persistente, efeito Meissner, temperatura crítica e quench com liberação de ½LI². Lúdico: o campo causar dano e desacelerar inimigos.',
    formula: { tex: 'R = 0 \\;(T < T_c) \\qquad E = \\tfrac{1}{2} L I^2', label: 'Supercondutividade e energia liberada no quench' },
  },
  unlockText: 'Unidade secreta: obtida apenas em Cápsulas Energéticas do modo infinito (5% das cápsulas).',
  secret: true,
};

export const EXPANSION_UNITS = {
  resistor: RESISTOR,
  retificador: RETIFICADOR,
  transistor: TRANSISTOR,
  oscilador: OSCILADOR,
  ci555: CI555,
  tesla: TESLA,
  supercondutor: SUPERCONDUTOR,
};
