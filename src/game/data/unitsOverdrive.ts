import { stats, type UnitDef } from './unitTypes';

/**
 * Unidades do Patch 1.2 — “Electrotechnical Overdrive”.
 *
 * Cada uma traduz uma propriedade física própria em uma mecânica que nenhuma unidade
 * anterior tinha (nada de “dano genérico com outro nome”), e todas ocupam um nicho que não
 * torna as antigas inúteis:
 *
 *  - MOSFET de Potência        → frequência de comutação: cadência altíssima que esquenta
 *                                (perdas de comutação ∝ f) e precisa de pausas.
 *  - IGBT de Alta Tensão       → tensão de bloqueio alta: poucos disparos, muito pesados,
 *                                especializados em blindagem (ignora parte da armadura).
 *  - Transformador de Potência → transferência por indução: a aura CRESCE com o número de
 *                                unidades conectadas e distribui energia (renda).
 *  - Oscilador de Cristal      → ressonância piezoelétrica: o clock mais estável do arsenal,
 *                                sincroniza unidades e desregula a velocidade dos inimigos.
 *  - Amp. Operacional          → ganho de malha: amplifica os VIZINHOS e satura com clipping.
 *  - Plasma de Alta Frequência → gás ionizado: cadeia + ionização acumulada (dano contínuo
 *                                em área). Unidade secreta.
 */

/* ====================================================================== */
/* 3.1 MOSFET de Potência — DPS de alta frequência                         */
/* ====================================================================== */

const MOSFET: UnitDef = {
  id: 'mosfet',
  name: 'MOSFET de Potência',
  short: 'MOSFET',
  classes: ['DPS'],
  rarity: 'raro',
  role: 'Cadência altíssima: o dano cresce com a frequência de comutação, mas a unidade aquece e precisa de pausas.',
  damageType: 'comutacao',
  behavior: 'switching',
  cost: 300,
  limit: 4,
  color: '#4ad6b0',
  base: stats({ damage: 24, interval: 0.3, range: 125, fsw: 10, fswStep: 0.12, thermal: 6, heat: 1 }),
  levels: [
    {
      cost: 180,
      title: 'Gate driver de maior corrente',
      why: 'A capacitância de porta (Ciss) precisa ser carregada e descarregada a cada comutação. Um driver que fornece mais corrente encurta os tempos de subida e descida, permitindo comutar mais vezes por segundo.',
      patch: { damage: 32, interval: 0.26 },
    },
    {
      cost: 260,
      title: 'Menor RDS(on)',
      why: 'A perda de condução é I²·RDS(on). Reduzir essa resistência deixa mais energia chegar à carga em vez de virar calor no encapsulamento.',
      patch: { damage: 44, thermal: 8 },
    },
    {
      cost: 360,
      title: 'Comutação suave (snubber RC)',
      why: 'Um snubber amortece o pico de tensão na abertura e reduz a perda de comutação, que cresce com a frequência: a unidade sustenta frequências altas por mais tempo.',
      patch: { fsw: 14, thermal: 10 },
    },
    {
      cost: 480,
      title: 'Comutação máxima (habilidade)',
      why: 'Operar no limite de frequência entrega potência máxima — por um tempo curto, antes de o calor acumulado exigir recuo.',
      patch: { ability: true, damage: 58, range: 135 },
    },
  ],
  tiers: [
    { name: 'MOSFET de Potência', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
    {
      name: 'MOSFET Super-Junction',
      ec: 170,
      summary: 'Intervalo −12% e +4 estágios de frequência.',
      why: 'Colunas de dopagem alternada (super-junção) sustentam a tensão com uma camada de deriva muito mais fina: menos resistência para a mesma tensão de bloqueio.',
      apply: (s) => {
        s.interval *= 0.88;
        s.fsw += 4;
      },
    },
    {
      name: 'Transistor GaN HEMT',
      ec: 400,
      summary: 'Dano +35%, ganho por estágio +50% e aquecimento máximo +6.',
      why: 'O nitreto de gálio tem campo de ruptura muito maior que o silício e praticamente não acumula carga de recuperação: comuta em frequências que o silício não alcança, com perdas muito menores.',
      apply: (s) => {
        s.damage *= 1.35;
        s.fswStep *= 1.5;
        s.thermal += 6;
      },
    },
  ],
  ability: {
    kind: 'maxSwitching',
    name: 'Comutação máxima',
    desc: 'Por 6 s a frequência fica travada no estágio máximo e o aquecimento é zerado e congelado (como se a refrigeração fosse ideal).',
    cooldown: 26,
    duration: 6,
  },
  special:
    'Frequência de comutação: cada golpe sobe um estágio (+12% de dano cada, até o limite) e o intervalo encurta junto. Cada estágio também acumula aquecimento; ao passar do limite térmico, a unidade entra em derating (cadência −45%) e os estágios caem rápido até esfriar. Ficar 1 s sem alvo zera a frequência.',
  tech: {
    definition:
      'Transistor de efeito de campo de porta isolada (Metal-Oxide-Semiconductor Field-Effect Transistor): a tensão aplicada à porta controla a condução entre dreno e fonte.',
    principle:
      'A porta é isolada por óxido e funciona como um capacitor: não há corrente contínua de controle, apenas a carga e descarga dessa capacitância. Acima da tensão de limiar, forma-se um canal condutor. Como chave, o MOSFET tem perda de condução I²·RDS(on) e perda de comutação proporcional à frequência — é esse par que define quanta potência ele dissipa.',
    characteristics: [
      'Resistência de condução RDS(on)',
      'Tensão de limiar da porta (VGS(th))',
      'Capacitâncias de entrada e saída (Ciss, Coss)',
      'Tensão máxima dreno-fonte (VDS)',
      'Diodo de corpo intrínseco',
    ],
    applications: ['Fontes chaveadas e conversores CC-CC', 'Inversores e acionamento de motores', 'Retificação síncrona', 'Chaves de carga e proteção eletrônica'],
    mechanic:
      'Os estágios de frequência representam o aumento da taxa de comutação; o aquecimento representa a perda de comutação, que cresce com a frequência e obriga a recuar (derating).',
    physicsNote:
      'Real: controle por campo elétrico com porta isolada, RDS(on), perdas de condução e de comutação, derating térmico. Lúdico: a frequência virar dano e o aquecimento virar uma penalidade de cadência.',
    formula: { tex: 'P_{tot} = I^2 R_{DS(on)} + \\tfrac{1}{2} V_{DS} I\\,(t_r + t_f)\\,f_{sw}', label: 'Perdas de condução e de comutação' },
  },
  unlockText: 'Conclua a fase 7-2.',
};

/* ====================================================================== */
/* 3.2 IGBT de Alta Tensão — dano pesado                                   */
/* ====================================================================== */

const IGBT: UnitDef = {
  id: 'igbt',
  name: 'IGBT de Alta Tensão',
  short: 'IGBT',
  classes: ['Burst', 'DPS'],
  rarity: 'epico',
  role: 'Disparos de energia concentrada: poucos golpes, muito pesados, especializados em atravessar blindagem.',
  damageType: 'comutacao',
  behavior: 'hv',
  cost: 420,
  limit: 3,
  color: '#ff8a4c',
  base: stats({ damage: 300, interval: 2.2, range: 140, splash: 45, armorBonus: 0.6, armorPierce: 4, stun: 0.2 }),
  levels: [
    {
      cost: 240,
      title: 'Porta trincheira (trench gate)',
      why: 'A estrutura em trincheira aumenta a densidade de canal e reduz a tensão de saturação coletor-emissor (VCE(sat)): mais corrente entregue com a mesma queda.',
      patch: { damage: 420 },
    },
    {
      cost: 340,
      title: 'Tensão de bloqueio ampliada',
      why: 'Uma camada de deriva mais espessa suporta tensões de bloqueio maiores. Com mais tensão disponível, a mesma corrente entrega muito mais potência ao alvo.',
      patch: { damage: 580, armorPierce: 7 },
    },
    {
      cost: 460,
      title: 'Potência máxima (habilidade)',
      why: 'Levar o dispositivo ao limite de corrente de curto-circuito suportável (tempo de suportabilidade) entrega um pico que nenhuma blindagem contém.',
      patch: { ability: true, splash: 60 },
    },
    {
      cost: 620,
      title: 'Módulo em meia-ponte',
      why: 'Dois IGBTs em meia-ponte alternam a condução e dobram o aproveitamento do barramento CC, encurtando o intervalo entre disparos.',
      patch: { damage: 760, interval: 1.85 },
    },
  ],
  tiers: [
    { name: 'IGBT de Alta Tensão', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
    {
      name: 'Módulo IGBT com Diodo de Roda Livre',
      ec: 200,
      summary: 'Dano +25% e blindagem ignorada +4.',
      why: 'O diodo antiparalelo (freewheeling) dá caminho à corrente da carga indutiva e evita que o pico de tensão destrua o módulo: o conjunto opera com margem maior.',
      apply: (s) => {
        s.damage *= 1.25;
        s.armorPierce += 4;
      },
    },
    {
      name: 'IGBT de Carboneto de Silício (SiC)',
      ec: 460,
      summary: 'Dano +45%, intervalo −15% e bônus contra blindados +40 p.p.',
      why: 'O SiC tem banda proibida larga e campo crítico ~10× maior que o do silício: suporta tensões altíssimas com menos perdas e opera em temperaturas que o silício não tolera.',
      apply: (s) => {
        s.damage *= 1.45;
        s.interval *= 0.85;
        s.armorBonus += 0.4;
      },
    },
  ],
  ability: {
    kind: 'maxPower',
    name: 'Potência máxima',
    desc: 'Por 8 s os disparos causam o dobro do dano, ignoram totalmente a blindagem e atingem em área ampliada.',
    cooldown: 32,
    duration: 8,
  },
  special:
    'Descarga de alta tensão: cada disparo atinge o alvo e a área em torno dele, ignorando parte fixa da blindagem (não o mínimo de 30%). Especialista em blindagem: +60% de dano contra inimigos blindados e chefes. Interrompe brevemente o alvo principal.',
  tech: {
    definition:
      'Transistor bipolar de porta isolada (Insulated-Gate Bipolar Transistor): combina a porta isolada do MOSFET com a condução bipolar de um transistor de potência.',
    principle:
      'A porta isolada é controlada por tensão (como no MOSFET), mas a condução ocorre com injeção de portadores minoritários (como no BJT). Isso dá baixa queda de condução em tensões e correntes altas — o preço é uma comutação mais lenta, por causa da remoção dessa carga armazenada (cauda de corrente).',
    characteristics: [
      'Tensão de saturação coletor-emissor VCE(sat)',
      'Tensão de bloqueio (centenas de V a alguns kV)',
      'Corrente de coletor nominal e de pico',
      'Cauda de corrente na abertura',
      'Tempo de suportabilidade a curto-circuito',
    ],
    applications: ['Inversores de tração (trens e veículos elétricos)', 'Acionamento de motores industriais', 'Soldagem a arco', 'Conversores de alta potência e HVDC'],
    mechanic:
      'A tensão de bloqueio alta vira dano concentrado por disparo; a comutação lenta vira intervalo longo; a condução bipolar robusta vira a especialidade contra blindagem.',
    physicsNote:
      'Real: porta isolada com condução bipolar, VCE(sat) baixa em alta tensão, comutação lenta com cauda de corrente. Lúdico: “ignorar blindagem” e o bônus contra chefes.',
    formula: { tex: 'P_{cond} = V_{CE(sat)}\\,I_C', label: 'Perda de condução no IGBT' },
  },
  unlockText: 'Conclua a fase 9-1.',
};

/* ====================================================================== */
/* 3.3 Transformador de Potência — suporte                                 */
/* ====================================================================== */

const TRAFOPOT: UnitDef = {
  id: 'trafopot',
  name: 'Transformador de Potência',
  short: 'Trafo Pot.',
  classes: ['Support', 'Economy'],
  rarity: 'epico',
  role: 'Amplifica e alimenta as unidades conectadas: o bônus cresce com quantas unidades estão na área.',
  damageType: null,
  behavior: 'grid',
  cost: 380,
  limit: 2,
  color: '#ffc14d',
  base: stats({ aura: 150, auraDamage: 0.1, auraSpeed: 0.06, auraRange: 0.04, perLink: 0.04, linkMax: 6, income: 6, interval: 8 }),
  levels: [
    {
      cost: 220,
      title: 'Núcleo de maior seção',
      why: 'A tensão induzida é proporcional à área do núcleo e à frequência (E = 4,44·f·N·A·B). Um núcleo de seção maior transfere mais potência antes de saturar.',
      patch: { auraDamage: 0.14, aura: 165 },
    },
    {
      cost: 310,
      title: 'Derivações no secundário (taps)',
      why: 'Tomadas no enrolamento permitem ajustar a relação de espiras para cada carga: mais unidades podem ser atendidas no ponto certo de tensão.',
      patch: { linkMax: 8, perLink: 0.05 },
    },
    {
      cost: 420,
      title: 'Refrigeração a óleo forçada',
      why: 'Óleo isolante em circulação retira o calor das perdas no cobre e no núcleo, permitindo operar perto da potência nominal continuamente.',
      patch: { auraSpeed: 0.1, income: 12, interval: 7 },
    },
    {
      cost: 560,
      title: 'Barramento de distribuição (habilidade)',
      why: 'Um barramento comum permite redistribuir potência entre todas as cargas ao mesmo tempo — por um intervalo curto, acima do regime nominal.',
      patch: { ability: true, auraDamage: 0.18 },
    },
  ],
  tiers: [
    { name: 'Transformador de Potência', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
    {
      name: 'Transformador Imerso em Óleo',
      ec: 190,
      summary: 'Raio +25 e bônus por conexão +2 p.p.',
      why: 'O óleo mineral isola e refrigera ao mesmo tempo, permitindo enrolamentos mais compactos e potências bem maiores que no transformador a seco.',
      apply: (s) => {
        s.aura += 25;
        s.perLink += 0.02;
      },
    },
    {
      name: 'Subestação Unitária Compacta',
      ec: 440,
      summary: 'Até 12 conexões, dano da aura +8 p.p. e renda dobrada.',
      why: 'Uma subestação unitária integra transformador, proteção e distribuição no mesmo invólucro, atendendo muitos ramais a partir de um ponto só.',
      apply: (s) => {
        s.linkMax = Math.max(s.linkMax, 12);
        s.auraDamage += 0.08;
        s.income *= 2;
      },
    },
  ],
  ability: {
    kind: 'gridBoost',
    name: 'Barramento de distribuição',
    desc: 'Por 7 s todas as conexões contam como se estivessem no máximo (bônus por conexão cheio) e a renda do ciclo é paga imediatamente.',
    cooldown: 30,
    duration: 7,
  },
  special:
    'Transferência por indução: unidades no raio recebem bônus de dano, cadência e alcance. Carga conectada: cada unidade na área soma +4% de dano a TODAS as conectadas (até o limite de conexões) — quanto mais densa a malha, mais forte. Distribuição: paga créditos por ciclo, e o valor dobra se houver uma Fonte DC ou uma Ponte Retificadora na área.',
  tech: {
    definition: 'Máquina estática que transfere energia elétrica entre dois ou mais circuitos por indução eletromagnética, alterando tensão e corrente.',
    principle:
      'A corrente alternada no primário cria um fluxo magnético variável no núcleo, que induz tensão no secundário (lei de Faraday). No transformador ideal V₂/V₁ = N₂/N₁ e a potência se conserva, então elevar a tensão reduz a corrente na mesma proporção — é isso que torna viável transmitir energia a longas distâncias, porque a perda na linha é I²·R.',
    characteristics: [
      'Relação de espiras N₂/N₁',
      'Potência nominal (kVA) e regulação',
      'Perdas no núcleo (histerese e Foucault) e no cobre (I²R)',
      'Impedância de curto-circuito',
      'Classe de isolamento e forma de refrigeração',
    ],
    applications: ['Subestações de distribuição', 'Transmissão em alta tensão', 'Isolamento galvânico', 'Fontes de alimentação'],
    mechanic:
      'A conservação de potência vira redistribuição: o transformador não cria dano do nada, ele amplifica as unidades conectadas — e o ganho cresce com o número de cargas atendidas, como um barramento bem aproveitado.',
    physicsNote:
      'Real: indução mútua, relação de espiras, conservação de potência no caso ideal e perdas no núcleo e no cobre. Lúdico: “potência transferida” virar bônus de dano e créditos.',
    formula: { tex: '\\dfrac{V_2}{V_1} = \\dfrac{N_2}{N_1} = \\dfrac{I_1}{I_2} \\qquad E = 4{,}44\\,f N A B', label: 'Transformador ideal e tensão induzida' },
  },
  unlockText: 'Conclua a fase 8-2.',
};

/* ====================================================================== */
/* 3.4 Oscilador de Cristal — controle e suporte                           */
/* ====================================================================== */

const CRISTAL: UnitDef = {
  id: 'cristal',
  name: 'Oscilador de Cristal',
  short: 'Cristal',
  classes: ['Control', 'Support'],
  rarity: 'lendario',
  role: 'Clock estável: sincroniza a cadência das unidades e desregula a velocidade dos inimigos a cada pulso.',
  damageType: 'comutacao',
  behavior: 'crystal',
  cost: 360,
  limit: 2,
  color: '#9ef0ff',
  base: stats({ damage: 45, interval: 3, duty: 0.5, range: 140, aura: 140, auraSpeed: 0.18, slow: 0.3, slowDur: 1.6, stun: 0.25 }),
  levels: [
    {
      cost: 210,
      title: 'Corte AT do quartzo',
      why: 'O corte AT tem coeficiente de temperatura próximo de zero perto da temperatura ambiente: a frequência quase não varia com o aquecimento.',
      patch: { auraSpeed: 0.24, range: 150, aura: 150 },
    },
    {
      cost: 300,
      title: 'Fator de qualidade Q elevado',
      why: 'Cristais de quartzo têm Q na ordem de 10⁴–10⁶, muito acima de um tanque LC. A ressonância é tão estreita que o circuito só oscila na frequência do cristal.',
      patch: { damage: 70, slow: 0.4 },
    },
    {
      cost: 400,
      title: 'Divisor de frequência programável',
      why: 'Dividir a frequência do cristal por um inteiro gera um clock mais lento com a MESMA estabilidade relativa: dá para escolher o período sem perder precisão.',
      patch: { interval: 2.4, duty: 0.6 },
    },
    {
      cost: 520,
      title: 'Travamento de fase (habilidade)',
      why: 'Em uma malha de captura de fase (PLL), o sinal de saída acompanha a fase da referência: todas as cargas passam a comutar no mesmo instante.',
      patch: { ability: true, stun: 0.45 },
    },
  ],
  tiers: [
    { name: 'Oscilador de Cristal', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
    {
      name: 'Oscilador Compensado (TCXO)',
      ec: 180,
      summary: 'Cadência da aura +8 p.p. e lentidão +10 p.p.',
      why: 'Um TCXO mede a temperatura e aplica uma correção na rede de sintonia, cancelando a deriva térmica residual do cristal.',
      apply: (s) => {
        s.auraSpeed += 0.08;
        s.slow += 0.1;
      },
    },
    {
      name: 'Oscilador em Forno (OCXO)',
      ec: 420,
      summary: 'Período −20%, interrupção +0,3 s e imune à Instabilidade de frequência.',
      why: 'Um OCXO mantém o cristal em um forno a temperatura constante, acima da ambiente: a deriva térmica praticamente desaparece e a estabilidade chega a 10⁻⁹.',
      apply: (s) => {
        s.interval *= 0.8;
        s.stun += 0.3;
      },
    },
  ],
  ability: {
    kind: 'phaseLock',
    name: 'Travamento de fase (PLL)',
    desc: 'Por 8 s todas as unidades na aura disparam em sincronia a cada pulso, com o dobro do bônus de cadência, e cada pulso interrompe os inimigos no alcance.',
    cooldown: 30,
    duration: 8,
  },
  special:
    'Clock de referência: a cada período, um pulso atinge os inimigos no alcance, desacelera-os e sincroniza as unidades da aura (que disparam imediatamente). Durante o nível alto (D·T), as unidades na aura ganham cadência. Interferência de clock: inimigos atingidos ficam com a velocidade irregular (a lentidão não se acumula, substitui). Estabilidade: sofre apenas metade do desvio da Instabilidade de frequência — e nenhum, no OCXO. Sinergia de temporização: com um CI 555 na área, ambos ganham +15% de cadência de aura.',
  tech: {
    definition: 'Oscilador cuja frequência é determinada pela ressonância mecânica de um cristal piezoelétrico, normalmente quartzo.',
    principle:
      'No efeito piezoelétrico, uma tensão aplicada deforma o cristal e uma deformação gera tensão. Cortado e montado de forma adequada, o quartzo se comporta como um ressonador eletromecânico de perdas muito baixas: seu Q altíssimo faz o circuito oscilar em uma frequência praticamente fixa, determinada pelas dimensões físicas do cristal — não por R e C, que variam muito mais com temperatura e envelhecimento.',
    characteristics: [
      'Frequência de ressonância série e paralela',
      'Fator de qualidade Q muito alto (10⁴–10⁶)',
      'Estabilidade em ppm (TCXO) ou ppb (OCXO)',
      'Coeficiente de temperatura dependente do corte (AT, SC)',
      'Capacitância de carga especificada',
    ],
    applications: ['Clock de microcontroladores e computadores', 'Relógios e temporização', 'Rádios e sintetizadores de frequência', 'Instrumentos de medição'],
    mechanic:
      'A estabilidade do cristal vira sincronização: em vez de causar dano alto, ele faz as outras unidades atacarem no mesmo instante e mantém a defesa no compasso, mesmo sob modificadores que desregulam o tempo.',
    physicsNote:
      'Real: efeito piezoelétrico, ressonância mecânica, Q elevado, compensação térmica (TCXO/OCXO) e PLL. Lúdico: o clock “acelerar” unidades e desregular a velocidade dos inimigos.',
    formula: { tex: 'f_s = \\dfrac{1}{2\\pi\\sqrt{L_m C_m}} \\qquad Q = \\dfrac{1}{R_m}\\sqrt{\\dfrac{L_m}{C_m}}', label: 'Ressonador piezoelétrico (modelo elétrico equivalente)' },
  },
  unlockText: 'Conclua a fase 10-1.',
};

/* ====================================================================== */
/* 3.5 Amplificador Operacional — amplificação de dano                     */
/* ====================================================================== */

const AMPOP: UnitDef = {
  id: 'ampop',
  name: 'Amplificador Operacional',
  short: 'Amp. Op.',
  classes: ['DPS', 'Support'],
  rarity: 'lendario',
  role: 'Ganho por estágios em vários alvos e amplificação das unidades vizinhas, até a saturação (clipping).',
  damageType: 'comutacao',
  behavior: 'opamp',
  cost: 400,
  limit: 3,
  color: '#b48bff',
  base: stats({ damage: 52, interval: 0.7, range: 130, targets: 2, gain: 6, gainStep: 0.35, satBonus: 0.5, aura: 110, auraDamage: 0.15 }),
  levels: [
    {
      cost: 230,
      title: 'Realimentação negativa ajustada',
      why: 'Em um amplificador inversor o ganho é −R_f/R_in: ele é definido pelos resistores externos, não pelo componente. Reduzir R_in eleva o ganho de forma previsível e estável.',
      patch: { damage: 72, gainStep: 0.45 },
    },
    {
      cost: 320,
      title: 'Produto ganho-banda maior',
      why: 'O produto ganho-banda (GBW) é aproximadamente constante: um amp. op. com GBW maior sustenta o mesmo ganho em frequências mais altas, ou seja, responde mais rápido.',
      patch: { interval: 0.58, gain: 8 },
    },
    {
      cost: 430,
      title: 'Saída em três estágios (buffer)',
      why: 'Um estágio de saída em classe AB entrega corrente aos dois sentidos com baixa distorção: a mesma tensão de saída alimenta mais cargas em paralelo.',
      patch: { targets: 3, auraDamage: 0.22 },
    },
    {
      cost: 560,
      title: 'Ganho de malha aberta (habilidade)',
      why: 'Sem realimentação, o ganho é o próprio ganho de malha aberta (10⁵–10⁶): enorme, mas a saída satura nos trilhos de alimentação quase imediatamente.',
      patch: { ability: true, damage: 95 },
    },
  ],
  tiers: [
    { name: 'Amplificador Operacional', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
    {
      name: 'Amplificador de Instrumentação',
      ec: 200,
      summary: 'Ganho por estágio +40% e aura de dano +6 p.p.',
      why: 'Três amp. op. em topologia de instrumentação oferecem ganho diferencial alto e rejeição de modo comum (CMRR) elevada: amplificam o sinal útil e descartam o ruído comum às duas entradas.',
      apply: (s) => {
        s.gainStep *= 1.4;
        s.auraDamage += 0.06;
      },
    },
    {
      name: 'Amplificador de Potência Classe AB',
      ec: 450,
      summary: 'Dano +40%, +1 alvo e bônus de saturação +40 p.p.',
      why: 'Em classe AB os dois transistores de saída conduzem com uma pequena corrente de repouso, eliminando a distorção de cruzamento da classe B sem o desperdício da classe A.',
      apply: (s) => {
        s.damage *= 1.4;
        s.targets += 1;
        s.satBonus += 0.4;
      },
    },
  ],
  ability: {
    kind: 'openLoop',
    name: 'Ganho de malha aberta',
    desc: 'Por 6 s o amplificador opera sem realimentação: ganho máximo imediato, +50% de alvos e a aura de amplificação dobra. Ao terminar, fica 2 s em recuperação (slew rate) sem atacar.',
    cooldown: 34,
    duration: 6,
  },
  special:
    'Ganho por estágios: cada golpe soma um estágio (+35% de dano cada, até o limite de ganho), aplicado a TODOS os alvos atingidos ao mesmo tempo. Trocar de alvo não zera o ganho (a realimentação mantém o ponto de operação), mas 2 s sem alvo zeram. Saturação (clipping): no ganho máximo o dano recebe +50% adicional, o golpe atinge +1 alvo e as unidades na aura recebem o bônus de dano em dobro — a saída “bate nos trilhos” e não cresce mais.',
  tech: {
    definition:
      'Amplificador diferencial de ganho muito alto, projetado para operar com realimentação: duas entradas (inversora e não inversora) e uma saída.',
    principle:
      'O ganho de malha aberta é enorme (10⁵–10⁶), então na prática o circuito é definido pela realimentação externa. Com realimentação negativa valem as duas regras do amp. op. ideal: a corrente nas entradas é desprezível e a tensão entre elas tende a zero (“curto-circuito virtual”). Daí saem ganhos previsíveis como −R_f/R_in. A saída nunca passa dos trilhos de alimentação: quando a exigência supera esse limite, ocorre saturação (clipping).',
    characteristics: [
      'Ganho de malha aberta e produto ganho-banda (GBW)',
      'Tensão de offset de entrada e corrente de polarização',
      'Rejeição de modo comum (CMRR)',
      'Slew rate (taxa máxima de variação da saída)',
      'Tensão de saturação (limitada pela alimentação)',
    ],
    applications: ['Condicionamento de sinais de sensores', 'Filtros ativos', 'Comparadores e somadores', 'Amplificadores de instrumentação e áudio'],
    mechanic:
      'O ganho por estágios representa a amplificação crescente do sinal; a saturação representa o clipping nos trilhos de alimentação — a partir dali o ganho não cresce, mas o sinal sai “quadrado”, o que o jogo traduz em bônus fixo e mais alvos.',
    physicsNote:
      'Real: ganho de malha aberta, realimentação negativa, curto-circuito virtual, GBW, slew rate e saturação nos trilhos. Lúdico: o ganho virar dano e a aura amplificar outras unidades.',
    formula: { tex: 'A_v = -\\dfrac{R_f}{R_{in}} \\qquad V_{out} = A_{OL}\\,(V_+ - V_-)', label: 'Ganho com realimentação e em malha aberta' },
  },
  unlockText: 'Conclua a fase 11-1.',
};

/* ====================================================================== */
/* 3.6 Plasma de Alta Frequência — unidade secreta de dano em área          */
/* ====================================================================== */

const PLASMA: UnitDef = {
  id: 'plasma',
  name: 'Tocha de Plasma de Alta Frequência',
  short: 'Plasma',
  classes: ['Burst', 'Control'],
  rarity: 'secreto',
  role: 'Descargas encadeadas que ionizam o ar: dano em área, dano contínuo acumulado e uma habilidade suprema eletromagnética.',
  damageType: 'descarga',
  behavior: 'plasma',
  cost: 950,
  limit: 1,
  color: '#ff6fe0',
  base: stats({
    damage: 260,
    interval: 1.4,
    range: 150,
    splash: 68,
    chains: 4,
    chainDecay: 0.85,
    ion: 1,
    ionMax: 6,
    ionCoef: 2.4,
    slow: 0.25,
    slowDur: 1.2,
    ability: true,
  }),
  levels: [
    {
      cost: 600,
      title: 'Gás de trabalho argônio',
      why: 'O argônio é inerte e tem potencial de ionização moderado: a coluna de plasma acende com menos tensão e fica mais estável que no ar atmosférico.',
      patch: { damage: 360, ion: 2 },
    },
    {
      cost: 820,
      title: 'Bobina de acoplamento indutivo (ICP)',
      why: 'Em um plasma acoplado indutivamente, a energia entra por indução em vez de eletrodos: sem erosão de eletrodo, a descarga sustenta densidade de elétrons muito maior.',
      patch: { chains: 6, splash: 82, ionMax: 8 },
    },
    {
      cost: 1100,
      title: 'Confinamento magnético do jato',
      why: 'Um campo magnético externo estrangula a coluna de plasma (efeito pinch): a densidade de corrente no centro cresce e o jato alcança mais longe.',
      patch: { damage: 520, range: 170, ionCoef: 3.4 },
    },
  ],
  tiers: [
    { name: 'Tocha de Plasma de Alta Frequência', ec: 0, summary: 'Forma base.', why: '', apply: () => {} },
    {
      name: 'Plasma Acoplado Indutivamente (ICP)',
      ec: 500,
      summary: 'Ionização máxima +3 e cada salto mantém 92%.',
      why: 'Sem eletrodos em contato com o gás, a tocha ICP opera continuamente em potências altas e atinge temperaturas de milhares de kelvin.',
      apply: (s) => {
        s.ionMax += 3;
        s.chainDecay = 0.92;
      },
    },
    {
      name: 'Tocha de Arco Transferido',
      ec: 800,
      summary: 'Dano +40%, +2 saltos e dano contínuo de ionização +60%.',
      why: 'No arco transferido, a própria peça faz parte do circuito: a energia é depositada diretamente no alvo, e não apenas no gás — é o princípio do corte a plasma industrial.',
      apply: (s) => {
        s.damage *= 1.4;
        s.chains += 2;
        s.ionCoef *= 1.6;
      },
    },
  ],
  ability: {
    kind: 'plasmaStorm',
    name: 'Tempestade eletromagnética',
    desc: 'Habilidade suprema: três descargas em cadeia sucessivas (dano ×2,5, saltos dobrados) e todos os inimigos no alcance recebem ionização máxima e ficam 40% mais lentos por 4 s.',
    cooldown: 40,
    duration: 4,
  },
  special:
    'Descarga encadeada: cada disparo atinge o alvo em área e salta para inimigos próximos, perdendo 15% por salto. Ionização: cada atingido acumula estágios de ionização (até o limite) e sofre dano contínuo de k·n² por segundo, como o calor do resistor — mas de tipo descarga, e o gás ionizado reduz a velocidade. Condutividade: inimigos ionizados recebem +20% de dano de descarga (o canal já está condutivo). Unidade secreta (1 por equipe).',
  tech: {
    definition:
      'Plasma é o quarto estado da matéria: um gás parcialmente ionizado, com elétrons livres e íons em quantidade suficiente para conduzir corrente e responder a campos eletromagnéticos.',
    principle:
      'Quando o campo elétrico supera a rigidez dielétrica do gás, elétrons livres são acelerados e ionizam outras moléculas por colisão, em avalanche. O gás passa a conduzir e o canal se mantém enquanto houver energia. Em alta frequência a energia pode ser acoplada por indução, sem eletrodos. O plasma é quase neutro no conjunto (mesma densidade de cargas positivas e negativas) e é fortemente afetado por campos magnéticos, o que permite confiná-lo.',
    characteristics: [
      'Grau de ionização e densidade de elétrons',
      'Temperatura do elétron × temperatura do gás (plasma não térmico)',
      'Rigidez dielétrica do gás e tensão de ruptura',
      'Frequência de excitação (RF, tipicamente 13,56 MHz)',
      'Quase neutralidade e comprimento de Debye',
    ],
    applications: ['Corte e soldagem a plasma', 'Deposição e corrosão de semicondutores', 'Espectrometria ICP', 'Esterilização e tratamento de superfícies', 'Pesquisa em fusão por confinamento magnético'],
    mechanic:
      'A avalanche de ionização vira estágios acumulados: quanto mais ionizado o alvo, mais dano contínuo ele sofre e melhor a descarga conduz até ele — e a cadeia representa o arco procurando o caminho mais condutivo.',
    physicsNote:
      'Real: ionização por avalanche, condutividade do gás ionizado, acoplamento indutivo em RF, confinamento magnético e quase neutralidade. Lúdico: a ionização virar dano contínuo e a cadeia “escolher” inimigos. Tochas de plasma reais operam com temperaturas e tensões perigosas: apenas equipes treinadas as manipulam.',
    formula: { tex: 'P_{ion} = k\\,n^2 \\qquad \\lambda_D = \\sqrt{\\dfrac{\\varepsilon_0 k_B T_e}{n_e e^2}}', label: 'Dano por ionização (modelo do jogo) e comprimento de Debye' },
  },
  unlockText: 'Unidade secreta: obtida apenas nas Cápsulas de Energia (5% das cápsulas, com garantia na 50ª).',
  secret: true,
};

export const OVERDRIVE_UNITS = {
  mosfet: MOSFET,
  igbt: IGBT,
  trafopot: TRAFOPOT,
  cristal: CRISTAL,
  ampop: AMPOP,
  plasma: PLASMA,
};
