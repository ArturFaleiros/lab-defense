/**
 * Conteúdo acadêmico do jogo: desafios de conhecimento (pós-fase) e glossário desbloqueável.
 * Todos os valores numéricos são calculados a partir das relações apresentadas no EMLab.
 */

export interface QuizDef {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export const QUIZZES: Record<string, QuizDef> = {
  'q1-1': {
    id: 'q1-1',
    question: 'Em um relé SPDT com a bobina desenergizada, o terminal COM está ligado a qual contato?',
    options: ['NC (normalmente fechado)', 'NO (normalmente aberto)', 'Aos dois ao mesmo tempo', 'A nenhum deles'],
    correct: 0,
    explanation:
      'Sem corrente na bobina, a mola mantém a armadura em repouso e COM fica ligado ao NC. Com a bobina energizada, a armadura é atraída e COM passa ao NO. A numeração dos terminais varia conforme o modelo.',
  },
  'q1-2': {
    id: 'q1-2',
    question: 'Qual é a principal vantagem de acionar uma carga por meio de um relé?',
    options: [
      'Isolamento funcional entre o circuito de comando e o circuito de carga',
      'Aumentar a frequência do sinal de comando',
      'Armazenar energia para a carga no campo elétrico',
      'Converter corrente alternada em contínua',
    ],
    correct: 0,
    explanation:
      'O circuito de comando (bobina) e o de carga (contatos) são eletricamente separados: um sinal de baixa potência comanda uma carga de tensão ou corrente maiores.',
  },
  'q1-3': {
    id: 'q1-3',
    question: 'Por que se coloca um diodo em antiparalelo com a bobina de um relé?',
    options: [
      'Para oferecer caminho à corrente da bobina no desligamento e limitar o pico de tensão',
      'Para aumentar a força de atração da armadura',
      'Para que o relé funcione com corrente alternada',
      'Para eliminar instantaneamente toda a energia armazenada',
    ],
    correct: 0,
    explanation:
      'Ao cortar a corrente, a bobina tende a mantê-la (vL = L·di/dt). O diodo de flyback dá um caminho para essa corrente, que decai gradualmente; a energia é dissipada ao longo do decaimento, não de forma instantânea.',
  },
  'q2-1': {
    id: 'q2-1',
    question: 'Qual é o efeito principal da indutância em um circuito?',
    options: [
      'Opor-se a variações da corrente elétrica',
      'Opor-se a variações de tensão armazenando carga nas placas',
      'Permitir corrente em apenas um sentido',
      'Converter energia elétrica diretamente em luz',
    ],
    correct: 0,
    explanation:
      'O indutor se opõe à variação da corrente: vL = L·di/dt. Opor-se a variações de tensão armazenando carga é o comportamento do capacitor.',
  },
  'q2-2': {
    id: 'q2-2',
    question: 'Um indutor de 100 mH conduz 0,5 A. Qual a energia armazenada no campo magnético?',
    options: ['12,5 mJ', '25 mJ', '50 mJ', '5 mJ'],
    correct: 0,
    explanation: 'E = ½·L·I² = ½ × 0,1 H × (0,5 A)² = 0,0125 J = 12,5 mJ.',
  },
  'q2-3': {
    id: 'q2-3',
    question: 'No solenoide longo, B ≈ μ·N·I / l. Dobrando o número de espiras (mantidos μ, I e l), o campo:',
    options: ['Dobra', 'Cai pela metade', 'Quadruplica', 'Não muda'],
    correct: 0,
    explanation: 'B é proporcional a N na aproximação do solenoide longo, válida longe das extremidades e sem saturação do núcleo.',
  },
  'q3-1': {
    id: 'q3-1',
    question: 'Na configuração típica, como fica o diodo de flyback em relação à bobina alimentada por tensão positiva?',
    options: [
      'Catodo no lado positivo da bobina: reversamente polarizado na operação normal',
      'Anodo no lado positivo: conduzindo durante a operação normal',
      'Em série com a bobina, no lado negativo',
      'A polaridade não importa',
    ],
    correct: 0,
    explanation:
      'Com o catodo no positivo, o diodo não conduz enquanto a bobina está alimentada. No desligamento, a polaridade da tensão na bobina se inverte e o diodo passa a conduzir a corrente de decaimento. Ao contrário, ele curto-circuitaria a fonte.',
  },
  'q3-2': {
    id: 'q3-2',
    question: 'O que acontece ao interromper bruscamente a corrente de uma bobina sem proteção?',
    options: [
      'Surge um pico de tensão, pois di/dt é muito grande na interrupção',
      'A corrente vai a zero sem nenhum efeito',
      'A energia passa a ser armazenada no campo elétrico da bobina',
      'A tensão na bobina se torna exatamente zero',
    ],
    correct: 0,
    explanation:
      'Como vL = L·di/dt, uma queda muito rápida da corrente produz tensão elevada, que pode danificar o transistor de acionamento ou gerar arcos nos contatos.',
  },
  'q3-3': {
    id: 'q3-3',
    question: 'O que indica o sinal negativo na lei de Faraday, ε = −N·dΦ/dt?',
    options: [
      'A fem induzida se opõe à variação do fluxo que a produziu (lei de Lenz)',
      'A fem induzida é sempre negativa',
      'O fluxo magnético sempre diminui com o tempo',
      'Só há indução com corrente contínua constante',
    ],
    correct: 0,
    explanation: 'O sinal expressa a lei de Lenz: o efeito induzido tende a se opor à causa — a variação do fluxo magnético.',
  },
  'q4-1': {
    id: 'q4-1',
    question: 'Qual a constante de tempo de um RL série com L = 100 mH e R = 100 Ω?',
    options: ['1 ms', '10 ms', '0,1 ms', '1 s'],
    correct: 0,
    explanation: 'τ = L/R = 0,1 H / 100 Ω = 0,001 s = 1 ms.',
  },
  'q4-2': {
    id: 'q4-2',
    question: 'Em um RL série ideal com V = 5 V e R = 100 Ω, quanto vale a corrente após um τ?',
    options: ['≈ 31,6 mA', '50 mA', '25 mA', '≈ 43,2 mA'],
    correct: 0,
    explanation: 'I final = V/R = 50 mA. Em t = τ: i = 50 mA × (1 − e⁻¹) ≈ 50 × 0,632 ≈ 31,6 mA. (43,2 mA corresponde a t = 2τ.)',
  },
  'q4-3': {
    id: 'q4-3',
    question: 'Em um RL série com L fixo, o que acontece ao reduzir R?',
    options: [
      'A corrente final V/R aumenta e a constante de tempo L/R também aumenta',
      'A corrente final diminui e a constante de tempo diminui',
      'Só a corrente final muda',
      'Só a constante de tempo muda',
    ],
    correct: 0,
    explanation: 'Corrente final I = V/R e τ = L/R crescem quando R diminui: mais corrente, porém resposta mais lenta.',
  },
  'q5-1': {
    id: 'q5-1',
    question: 'Qual a reatância indutiva de um indutor de 100 mH em 60 Hz?',
    options: ['≈ 37,7 Ω', '≈ 6,0 Ω', '≈ 377 Ω', '≈ 0,6 Ω'],
    correct: 0,
    explanation: 'XL = 2π·f·L = 2π × 60 × 0,1 ≈ 37,7 Ω. A oposição cresce com a frequência e com a indutância.',
  },
  'q5-2': {
    id: 'q5-2',
    question: 'Por que um transformador não transfere energia com corrente contínua constante no primário?',
    options: [
      'Sem variação de fluxo magnético não há tensão induzida no secundário',
      'Porque corrente contínua não produz campo magnético',
      'Porque a relação de espiras se inverte em CC',
      'Porque o secundário fica em curto-circuito',
    ],
    correct: 0,
    explanation: 'Pela lei de Faraday, a fem induzida depende de dΦ/dt. Corrente constante produz fluxo constante e nenhuma tensão induzida.',
  },
  'q5-3': {
    id: 'q5-3',
    question: 'Onde o capacitor e o indutor armazenam energia, respectivamente?',
    options: [
      'No campo elétrico e no campo magnético',
      'No campo magnético e no campo elétrico',
      'Ambos no campo magnético',
      'Nenhum dos dois armazena energia',
    ],
    correct: 0,
    explanation: 'Capacitor: E = ½·C·V² no campo elétrico entre as placas. Indutor: E = ½·L·I² no campo magnético.',
  },
  'qF-1': {
    id: 'qF-1',
    question: 'Em um RL série, após quantas constantes de tempo a corrente atinge cerca de 99% do valor final?',
    options: ['Cerca de 5τ (≈ 99,3%)', '1τ', '2τ', 'Nunca passa de 63%'],
    correct: 0,
    explanation: '1 − e⁻⁵ ≈ 0,993. Por isso se costuma considerar o regime permanente atingido após aproximadamente 5τ.',
  },
  // ---------------- Patch 1.1 ----------------
  'q7-1': {
    id: 'q7-1',
    question: 'Uma senoide completa 50 ciclos por segundo. Qual é o seu período?',
    options: ['20 ms', '50 ms', '2 ms', '0,5 s'],
    correct: 0,
    explanation: 'T = 1/f = 1/50 Hz = 0,02 s = 20 ms. Frequência e período são inversos.',
  },
  'q7-2': {
    id: 'q7-2',
    question: 'Um resistor de 10 Ω é percorrido por 2 A. Qual potência ele dissipa?',
    options: ['40 W', '20 W', '5 W', '200 W'],
    correct: 0,
    explanation: 'P = I²·R = 2² × 10 = 40 W. Dobrar a corrente quadruplica a potência — é a base do dano térmico do Resistor.',
  },
  'q7-3': {
    id: 'q7-3',
    question: 'Na região ativa, um transistor com β = 100 recebe IB = 0,2 mA. Qual é IC (aproximadamente)?',
    options: ['20 mA', '0,2 mA', '2 mA', '200 mA'],
    correct: 0,
    explanation: 'IC ≈ β·IB = 100 × 0,2 mA = 20 mA. Acima de certo IB o transistor satura e IC deixa de crescer com β.',
  },
  'q8-1': {
    id: 'q8-1',
    question: 'Por que um diodo conduz em apenas um sentido?',
    options: [
      'A junção PN só permite corrente significativa quando diretamente polarizada',
      'Porque armazena carga como um capacitor',
      'Porque sua resistência é sempre infinita',
      'Porque transforma a tensão por indução',
    ],
    correct: 0,
    explanation: 'Polarizada diretamente, a barreira da junção PN é vencida (≈ 0,7 V no silício); em polarização reversa só flui uma corrente de fuga muito pequena.',
  },
  'q8-2': {
    id: 'q8-2',
    question: 'Comparado à meia onda, quanto vale a tensão média de um retificador de onda completa (mesmo pico, diodos ideais)?',
    options: ['O dobro', 'A metade', 'É igual', 'Quatro vezes'],
    correct: 0,
    explanation: 'Meia onda: Vmed = Vp/π. Onda completa: Vmed = 2Vp/π. A ponte aproveita os dois semiciclos.',
  },
  'q8-3': {
    id: 'q8-3',
    question: 'Em um circuito aberto, o que acontece com a corrente?',
    options: ['É nula, pois não há caminho fechado', 'É máxima', 'Fica igual à corrente de curto-circuito', 'Depende só da indutância'],
    correct: 0,
    explanation: 'Sem continuidade não há corrente de condução. No jogo, só o “dano magnético” (indução, que não depende de contato) atinge o Circuito Aberto.',
  },
  'q9-1': {
    id: 'q9-1',
    question: 'Por que a corrente de curto-circuito é perigosa?',
    options: [
      'A impedância é muito baixa, então a corrente fica muito acima da nominal e aquece condutores',
      'Porque a tensão sobe indefinidamente',
      'Porque a corrente cai a zero',
      'Porque a frequência dobra',
    ],
    correct: 0,
    explanation: 'Com impedância quase nula, I = V/Z cresce muito; o aquecimento (∝ I²) pode danificar cabos e equipamentos em pouco tempo. Proteções devem interrompê-la rapidamente.',
  },
  'q9-2': {
    id: 'q9-2',
    question: 'O que acontece com a indutância efetiva quando o núcleo satura?',
    options: ['Cai, pois o fluxo deixa de crescer proporcionalmente à corrente', 'Aumenta muito', 'Não se altera', 'Fica negativa'],
    correct: 0,
    explanation: 'Na saturação a permeabilidade efetiva despenca: mais corrente quase não aumenta o fluxo, e L = NΦ/I diminui.',
  },
  'q9-3': {
    id: 'q9-3',
    question: 'Qual é a frequência de ressonância de um circuito LC?',
    options: ['f₀ = 1/(2π√LC)', 'f₀ = 2π√LC', 'f₀ = L/R', 'f₀ = RC'],
    correct: 0,
    explanation: 'Na ressonância, as reatâncias indutiva e capacitiva se igualam (2πfL = 1/(2πfC)), o que leva a f₀ = 1/(2π√LC). A resistência amortece a oscilação.',
  },
  'q10-1': {
    id: 'q10-1',
    question: 'Um transistor usado como chave digital opera principalmente em quais regiões?',
    options: ['Corte e saturação', 'Apenas na região ativa', 'Ruptura reversa', 'Somente na saturação'],
    correct: 0,
    explanation: 'Como chave, o transistor alterna entre corte (aberto, IC ≈ 0) e saturação (fechado, VCE baixo). A região ativa é usada em amplificadores.',
  },
  'q10-2': {
    id: 'q10-2',
    question: 'No 555 astável, aumentar o capacitor de temporização C faz o quê?',
    options: ['Aumenta o período (diminui a frequência)', 'Diminui o período', 'Não altera nada', 'Muda apenas o ciclo de trabalho'],
    correct: 0,
    explanation: 'T ≈ 0,693·(R₁ + 2R₂)·C: o período é proporcional a C. O ciclo de trabalho depende só de R₁ e R₂.',
  },
  'q10-3': {
    id: 'q10-3',
    question: 'No 555 astável, R₁ = R₂. Qual é o ciclo de trabalho D = (R₁ + R₂)/(R₁ + 2R₂)?',
    options: ['≈ 67%', '50%', '33%', '100%'],
    correct: 0,
    explanation: 'D = 2R/3R = 2/3 ≈ 67%. No 555 astável clássico, D é sempre maior que 50% (sem diodos adicionais).',
  },
  'q11-1': {
    id: 'q11-1',
    question: 'Por que a energia é transmitida em alta tensão nas linhas de longa distância?',
    options: [
      'Para a mesma potência, a corrente é menor e as perdas I²R nos cabos diminuem',
      'Porque alta tensão não tem perdas',
      'Para aumentar a frequência da rede',
      'Porque a corrente alta reduz o aquecimento',
    ],
    correct: 0,
    explanation: 'P = V·I: elevando V, I cai para a mesma potência, e a perda nos condutores (I²R) cai com o quadrado da corrente. Transformadores fazem a elevação e o abaixamento.',
  },
  'q11-2': {
    id: 'q11-2',
    question: 'Qual a função de um para-raios (supressor de surto) em uma linha?',
    options: [
      'Desviar sobretensões para a terra, limitando a tensão sobre os equipamentos',
      'Aumentar a tensão nominal',
      'Armazenar a energia do raio',
      'Converter corrente alternada em contínua',
    ],
    correct: 0,
    explanation: 'Acima de um limiar, o dispositivo conduz e grampeia a tensão, desviando a energia do surto — a mesma ideia do diodo TVS em circuitos eletrônicos.',
  },
  'q11-3': {
    id: 'q11-3',
    question: 'Qual propriedade define um material supercondutor abaixo da temperatura crítica?',
    options: ['Resistência elétrica nula e expulsão do campo magnético (efeito Meissner)', 'Resistência infinita', 'Capacitância nula', 'Permeabilidade magnética infinita'],
    correct: 0,
    explanation: 'Abaixo de Tc, R = 0 (corrente persistente) e o campo é expulso do interior (Meissner). Se a temperatura, o campo ou a corrente excedem os limites, ocorre o quench.',
  },
};

export interface GlossaryTerm {
  id: string;
  term: string;
  text: string;
  tex?: string;
  /** fase cuja conclusão desbloqueia o termo (null = desde o início) */
  unlock: string | null;
}

export const GLOSSARY: GlossaryTerm[] = [
  { id: 'rele', term: 'Relé eletromecânico', text: 'Chave acionada por uma bobina: o campo magnético atrai uma armadura que muda a posição dos contatos.', unlock: null },
  { id: 'contatos', term: 'Contatos COM, NO e NC', text: 'COM é o comum; NO (NA) fica aberto em repouso; NC (NF) fica fechado em repouso. A numeração dos terminais varia entre modelos.', unlock: null },
  { id: 'bobina', term: 'Bobina e espira', text: 'Bobina é um condutor enrolado; cada volta é uma espira. Mais espiras produzem mais campo para a mesma corrente.', unlock: null },
  { id: 'campo', term: 'Campo magnético (B)', text: 'Grandeza vetorial produzida por correntes elétricas e ímãs; medida em tesla (T).', tex: 'B = \\dfrac{\\mu N I}{l}', unlock: '1-1' },
  { id: 'isolamento-func', term: 'Isolamento funcional', text: 'Separação elétrica entre o circuito de comando (bobina) e o de carga (contatos) de um relé.', unlock: '1-2' },
  { id: 'arco', term: 'Arco elétrico', text: 'Descarga através do ar entre contatos que se separam sob carga; desgasta os contatos.', unlock: '1-3' },
  { id: 'indutancia', term: 'Indutância (L)', text: 'Propriedade de se opor à variação da corrente; medida em henry (H).', tex: 'v_L = L\\,\\dfrac{di}{dt}', unlock: '2-1' },
  { id: 'energia-mag', term: 'Energia magnética', text: 'Energia armazenada no campo magnético de um indutor percorrido por corrente.', tex: 'E = \\tfrac{1}{2} L I^2', unlock: '2-2' },
  { id: 'saturacao', term: 'Saturação do núcleo', text: 'Acima de certo campo, o material do núcleo não aumenta o fluxo proporcionalmente e a indutância efetiva cai.', unlock: '2-3' },
  { id: 'fluxo', term: 'Fluxo magnético (Φ)', text: 'Medida do campo magnético que atravessa uma superfície; medido em weber (Wb).', unlock: '2-3' },
  { id: 'diodo', term: 'Diodo', text: 'Semicondutor que conduz preferencialmente do anodo para o catodo.', unlock: '3-1' },
  { id: 'flyback', term: 'Diodo de flyback', text: 'Diodo em antiparalelo com uma bobina; conduz a corrente de decaimento no desligamento e limita o pico de tensão.', unlock: '3-1' },
  { id: 'sobretensao', term: 'Sobretensão', text: 'Tensão acima da nominal; na interrupção de cargas indutivas surge por causa de di/dt elevado.', unlock: '3-2' },
  { id: 'capacitor', term: 'Capacitor', text: 'Armazena energia no campo elétrico entre placas separadas por um dielétrico.', tex: 'E = \\tfrac{1}{2} C V^2', unlock: '3-2' },
  { id: 'faraday', term: 'Lei de Faraday e lei de Lenz', text: 'A variação do fluxo induz fem; o sinal negativo indica que o efeito induzido se opõe à variação.', tex: '\\varepsilon = -N\\,\\dfrac{d\\Phi_B}{dt}', unlock: '3-3' },
  { id: 'fcem', term: 'Força contraeletromotriz', text: 'Fem induzida que se opõe à variação de corrente que a produziu.', unlock: '3-3' },
  { id: 'tau', term: 'Constante de tempo (τ)', text: 'Em um RL série, τ = L/R. Após 1τ a corrente atinge ≈ 63,2% do valor final.', tex: '\\tau = \\dfrac{L}{R}', unlock: '4-1' },
  { id: 'transitorio', term: 'Regime transitório', text: 'Intervalo em que as grandezas ainda variam até o regime permanente (≈ 5τ).', tex: 'i(t) = \\dfrac{V}{R}\\left(1 - e^{-t/\\tau}\\right)', unlock: '4-2' },
  { id: 'transformador', term: 'Transformador', text: 'Transfere energia por indução mútua; idealmente V₂/V₁ = N₂/N₁. Requer fluxo variável.', tex: '\\dfrac{V_2}{V_1} = \\dfrac{N_2}{N_1}', unlock: '4-2' },
  { id: 'reatancia', term: 'Reatância indutiva', text: 'Oposição do indutor à corrente alternada; cresce com a frequência e a indutância.', tex: 'X_L = 2\\pi f L', unlock: '5-1' },
  // ---------------- Patch 1.1 ----------------
  { id: 'frequencia', term: 'Frequência e período', text: 'Frequência (Hz) é o número de ciclos por segundo; o período é o tempo de um ciclo.', tex: 'T = \\dfrac{1}{f}', unlock: '7-1' },
  { id: 'joule', term: 'Efeito Joule', text: 'Conversão de energia elétrica em calor em um condutor percorrido por corrente; cresce com o quadrado da corrente.', tex: 'P = I^2 R', unlock: '7-1' },
  { id: 'transiente', term: 'Transitório (transiente)', text: 'Variação breve de tensão ou corrente entre dois regimes permanentes; costuma decair exponencialmente.', unlock: '7-2' },
  { id: 'transistor', term: 'Transistor bipolar (BJT)', text: 'Semicondutor de três terminais em que a corrente de base controla a corrente de coletor; opera em corte, região ativa ou saturação.', tex: 'I_C = \\beta I_B', unlock: '7-3' },
  { id: 'fuga', term: 'Corrente de fuga', text: 'Corrente que escapa por caminhos não previstos, como isolamentos úmidos ou degradados.', unlock: '8-1' },
  { id: 'retificacao', term: 'Retificação', text: 'Conversão de corrente alternada em contínua pulsante com diodos; a ponte de onda completa aproveita os dois semiciclos.', tex: 'V_{m\\acute{e}d} = \\dfrac{2V_p}{\\pi}', unlock: '8-2' },
  { id: 'continuidade', term: 'Continuidade e circuito aberto', text: 'Sem um caminho fechado não há corrente; o teste de continuidade do multímetro verifica se o caminho existe.', unlock: '8-3' },
  { id: 'curto', term: 'Corrente de curto-circuito', text: 'Corrente que surge quando a impedância entre dois potenciais fica muito baixa; deve ser interrompida rapidamente pela proteção.', unlock: '9-1' },
  { id: 'saturacao-mag', term: 'Saturação magnética', text: 'Condição em que o núcleo não consegue aumentar o fluxo proporcionalmente à corrente; a indutância efetiva cai.', unlock: '9-2' },
  { id: 'ressonancia', term: 'Ressonância LC', text: 'Frequência em que a energia oscila entre o indutor e o capacitor com amplitude máxima; a resistência amortece.', tex: 'f_0 = \\dfrac{1}{2\\pi\\sqrt{LC}}', unlock: '9-3' },
  { id: 'harmonicas', term: 'Harmônicas', text: 'Componentes de frequência múltiplas da fundamental, geradas por cargas não lineares; podem excitar ressonâncias da rede.', unlock: '9-3' },
  { id: 'logica', term: 'Níveis lógicos', text: 'Faixas de tensão interpretadas como 0 e 1 em circuitos digitais; transistores operam como chaves entre corte e saturação.', unlock: '10-1' },
  { id: 'ci', term: 'Circuito integrado', text: 'Muitos componentes (transistores, resistores, capacitores) fabricados juntos em uma única pastilha de silício.', unlock: '10-2' },
  { id: '555', term: 'Temporizador 555', text: 'CI com comparadores em 1/3 e 2/3 de Vcc e um flip-flop; gera ondas quadradas (astável) ou pulsos únicos (monoestável).', tex: 'T \\approx 0{,}693\\,(R_1 + 2R_2)\\,C', unlock: '10-3' },
  { id: 'transmissao', term: 'Transmissão em alta tensão', text: 'Elevar a tensão reduz a corrente para a mesma potência e, assim, as perdas I²R nas linhas.', unlock: '11-1' },
  { id: 'pararaios', term: 'Para-raios e supressores de surto', text: 'Dispositivos que conduzem acima de um limiar e desviam sobretensões para a terra.', unlock: '11-2' },
  { id: 'supercondutor', term: 'Supercondutividade', text: 'Abaixo da temperatura crítica, R = 0 e o campo magnético é expulso (efeito Meissner); o quench é a perda súbita desse estado.', unlock: '11-3' },
  { id: 'tesla', term: 'Bobina de Tesla', text: 'Transformador ressonante com núcleo de ar que produz tensões altíssimas e descargas no ar.', unlock: '11-3' },
];
