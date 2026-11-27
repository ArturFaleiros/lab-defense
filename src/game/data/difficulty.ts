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

/**
 * 1.2 — §10: vida e velocidade são multiplicadores sobre os atributos-BASE dos inimigos,
 * aplicados uma única vez em `spawnEnemy` (nunca acumulados entre dificuldades, nem
 * reaplicados aos inimigos gerados durante a partida).
 *
 *   Normal      vida ×1,50  (+50%)   velocidade ×1,10  (+10%)
 *   Difícil     vida ×6,00  (+500%)  velocidade ×1,10  (+10%)   até 3 modificadores
 *   Impossível  vida ×11,00 (+1000%) velocidade ×1,10  (+10%)   exatamente 7 modificadores
 *                                                               + resistência progressiva
 */
export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  normal: {
    id: 'normal',
    name: 'Normal',
    waves: 12,
    hp: 1.5,
    speed: 1.1,
    reward: 1,
    rampStart: 0.35,
    color: '#39d08a',
    desc: '12 ondas. Inimigos com +50% de vida e +10% de velocidade. Sem modificadores.',
  },
  dificil: {
    id: 'dificil',
    name: 'Difícil',
    waves: 15,
    hp: 6,
    speed: 1.1,
    reward: 1.6,
    rampStart: 0.3,
    color: '#f2bf4a',
    desc: '15 ondas. +500% de vida e +10% de velocidade, escoltas de elite e até 3 modificadores.',
  },
  impossivel: {
    id: 'impossivel',
    name: 'Impossível',
    waves: 25,
    hp: 11,
    speed: 1.1,
    reward: 2.6,
    rampStart: 0,
    color: '#ff5f5f',
    desc:
      '25 ondas. +1000% de vida e +10% de velocidade, elites desde cedo, exatamente 7 modificadores e resistência progressiva a controle e dano. Exige composição específica.',
  },
};

/** 1.2 — §10: número de modificadores por dificuldade (Impossível é exato). */
export const MODIFIER_COUNT: Record<Difficulty, number> = { normal: 0, dificil: 3, impossivel: 7 };

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
  | 'falha_isolamento'
  /* ---------- Patch 1.2 (§11) ---------- */
  | 'emi_conduzida'
  | 'blindagem_faraday'
  | 'sobretensao_periodica'
  | 'subtensao'
  | 'saturacao_magnetica'
  | 'ruido_eletrico'
  | 'ruptura_dieletrica'
  | 'efeito_joule'
  | 'falha_comutacao'
  | 'instabilidade_frequencia';

/**
 * 1.2: eixo de impacto de cada modificador. O sorteio limita quantos modificadores do mesmo
 * eixo podem coexistir — é isso que impede combinações matematicamente impossíveis
 * (por exemplo, três modificadores de economia simultâneos, que zerariam a renda).
 */
export type ModifierTag = 'economy' | 'rate' | 'damage' | 'resist' | 'range' | 'enemySpeed' | 'control';

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
  /* ---------- Patch 1.2 ---------- */
  /** sigla de 3–4 letras exibida no indicador (identificação visual sem depender da cor) */
  code: string;
  /** ícone (nome do ícone lucide usado pela interface) */
  icon: string;
  /** efeito matemático exato, para a ficha do modificador */
  math: string;
  /** o que muda nas unidades */
  onUnits: string;
  /** o que muda nos inimigos */
  onEnemies: string;
  /** eixos de impacto (usados pelo sorteio para evitar combinações impossíveis) */
  tags: ModifierTag[];
}

export const MODIFIERS: Record<ModifierId, ModifierDef> = {
  instabilidade_tensao: {
    id: 'instabilidade_tensao',
    name: 'Instabilidade de tensão',
    level: 'dificil',
    code: 'SAG',
    icon: 'TrendingDown',
    desc: 'A cada 20 s, por 5 s, cerca de 35% das unidades (sorteadas) causam −25% de dano.',
    tech: 'Afundamentos de tensão (sags) reduzem a potência entregue a cargas sensíveis.',
    counter: 'Unidades protegidas por diodo são imunes.',
    math: 'dano × 0,75 nas unidades sorteadas (hash determinístico, ~35%)',
    onUnits: 'Sorteia ~35% das unidades e reduz o dano; protegidas por diodo ficam de fora.',
    onEnemies: 'Nenhum efeito direto.',
    tags: ['damage'],
    color: '#f2bf4a',
    period: 20,
    duration: 5,
    offset: 8,
  },
  sobrecarga_eletrica: {
    id: 'sobrecarga_eletrica',
    name: 'Sobrecarga elétrica',
    level: 'dificil',
    code: 'OVL',
    icon: 'Flame',
    desc: 'A cada 18 s, por 5 s, unidades de ataque direto (relé, diodo, transistor, resistor, Tesla, bobina) ficam com intervalo de ataque +35%.',
    tech: 'Sob sobrecarga, a proteção térmica limita a taxa de operação para evitar aquecimento excessivo.',
    counter: 'Feixes, zonas e capacitores não são afetados; auras de cadência compensam.',
    math: 'intervalo × 1,35 (cadência × 1/1,35) nos comportamentos de ataque direto',
    onUnits: 'Reduz a cadência das unidades de golpe direto.',
    onEnemies: 'Nenhum efeito direto.',
    tags: ['rate'],
    color: '#ff9a47',
    period: 18,
    duration: 5,
    offset: 6,
  },
  interferencia_em: {
    id: 'interferencia_em',
    name: 'Interferência eletromagnética irradiada',
    level: 'dificil',
    code: 'EMI',
    icon: 'RadioTower',
    desc: 'A cada 22 s, por 6 s, uma região (raio 190, marcada no mapa) reduz em 20% o alcance das unidades dentro dela.',
    tech: 'Campos externos acoplados aos cabos degradam sensores e a precisão dos comandos.',
    counter: 'Característica Isolamento e proteção de diodo anulam o efeito.',
    math: 'alcance × 0,80 dentro da região (× 0,90 se protegida por diodo)',
    onUnits: 'Encolhe o alcance das unidades dentro da região marcada.',
    onEnemies: 'Nenhum efeito direto.',
    tags: ['range'],
    color: '#e05fd0',
    period: 22,
    duration: 6,
    offset: 10,
  },
  queda_rendimento: {
    id: 'queda_rendimento',
    name: 'Queda de rendimento',
    level: 'dificil',
    code: 'EFF',
    icon: 'BatteryLow',
    desc: 'A cada 25 s, por 8 s, a geração de créditos de fontes e retificadores cai 40%.',
    tech: 'Perdas de conversão aumentam quando a fonte opera fora do ponto nominal.',
    counter: 'Antecipe compras; o bônus de onda não é afetado.',
    math: 'geração × 0,60 (fontes e retificadores)',
    onUnits: 'Reduz a renda de Fonte DC e Ponte Retificadora.',
    onEnemies: 'Nenhum efeito direto.',
    tags: ['economy'],
    color: '#39d08a',
    period: 25,
    duration: 8,
    offset: 12,
  },
  oscilacao_frequencia: {
    id: 'oscilacao_frequencia',
    name: 'Oscilação de frequência',
    level: 'dificil',
    code: 'FRQ',
    icon: 'Activity',
    desc: 'A cadência das unidades oscila ±15% continuamente (período de 8 s); metade das unidades oscila em oposição de fase.',
    tech: 'Variações da frequência da rede alteram a velocidade de máquinas e temporizações.',
    counter: 'O CI 555 e o transformador (ramo abaixador) estabilizam a cadência média.',
    math: 'cadência × (1 + 0,15·sen(2πt/8 + φ)), φ = 0 ou π conforme o uid',
    onUnits: 'Oscila a cadência de todas as unidades (média preservada).',
    onEnemies: 'Nenhum efeito direto.',
    tags: ['rate'],
    color: '#45cfe0',
  },
  colapso_tensao: {
    id: 'colapso_tensao',
    name: 'Colapso de tensão',
    level: 'impossivel',
    code: 'BRN',
    icon: 'PlugZap',
    desc: 'A cada 15 s, por 4 s, 2 unidades sorteadas causam −60% de dano (−30% se protegidas por diodo).',
    tech: 'Quando a demanda supera a capacidade do sistema, a tensão colapsa localmente.',
    counter: 'Diodos reduzem a penalidade pela metade; distribua o dano entre várias unidades.',
    math: 'dano × 0,40 nas 2 unidades sorteadas (× 0,70 se protegidas)',
    onUnits: 'Derruba o dano de duas unidades por janela.',
    onEnemies: 'Nenhum efeito direto.',
    tags: ['damage'],
    color: '#ff5f5f',
    period: 15,
    duration: 4,
    offset: 5,
  },
  interferencia_critica: {
    id: 'interferencia_critica',
    name: 'Interferência crítica',
    level: 'impossivel',
    code: 'EMI+',
    icon: 'RadioTower',
    desc: 'A cada 20 s, por 8 s, uma região (raio 230, marcada) reduz em 35% o alcance das unidades dentro dela.',
    tech: 'Interferência intensa satura entradas de sensores e receptores.',
    counter: 'Isolamento anula; diodo reduz o efeito à metade.',
    math: 'alcance × 0,65 dentro da região (× 0,825 se protegida por diodo)',
    onUnits: 'Encolhe muito o alcance das unidades na região marcada.',
    onEnemies: 'Nenhum efeito direto.',
    tags: ['range'],
    color: '#ff6fd8',
    period: 20,
    duration: 8,
    offset: 7,
  },
  sobrecarga_sistemica: {
    id: 'sobrecarga_sistemica',
    name: 'Sobrecarga sistêmica',
    level: 'impossivel',
    code: 'OVL+',
    icon: 'Flame',
    desc: 'A cada 20 s, por 6 s, todas as unidades de ataque ficam com intervalo de ataque +50%.',
    tech: 'Sobrecarga generalizada aciona limitações térmicas em todo o sistema.',
    counter: 'Guarde habilidades para essas janelas; o CI 555 sincroniza disparos.',
    math: 'intervalo × 1,50 em todos os comportamentos ofensivos',
    onUnits: 'Reduz a cadência de praticamente todo o arsenal.',
    onEnemies: 'Nenhum efeito direto.',
    tags: ['rate'],
    color: '#ff9a47',
    period: 20,
    duration: 6,
    offset: 14,
  },
  dreno_energetico: {
    id: 'dreno_energetico',
    name: 'Dreno energético',
    level: 'impossivel',
    code: 'DRN',
    icon: 'BatteryWarning',
    desc: 'Permanente: fontes e retificadores geram 45% menos e o bônus de conclusão de onda cai 25%.',
    tech: 'Correntes de fuga e perdas parasitas consomem parte da energia gerada.',
    counter: 'Economia mínima e unidades de alto dano por custo.',
    math: 'geração × 0,55 e bônus de onda × 0,75',
    onUnits: 'Corta a renda das unidades de economia.',
    onEnemies: 'Nenhum efeito direto.',
    tags: ['economy'],
    color: '#39d08a',
  },
  instabilidade_circuito: {
    id: 'instabilidade_circuito',
    name: 'Instabilidade de circuito',
    level: 'impossivel',
    code: 'RES',
    icon: 'ShieldHalf',
    desc: 'Permanente: elites e chefes recebem 20% menos dano; demais inimigos, 8% menos.',
    tech: 'Um circuito instável reage de forma imprevisível, “absorvendo” parte das correções.',
    counter: 'Característica Precisão (+25% contra chefes e blindados) e dano térmico sustentado.',
    math: 'dano recebido × 0,80 (elite/chefe) ou × 0,92 (demais)',
    onUnits: 'Nenhum efeito direto.',
    onEnemies: 'Todos recebem menos dano, elites e chefes bem menos.',
    tags: ['resist'],
    color: '#a28bff',
  },
  ressonancia_magnetica: {
    id: 'ressonancia_magnetica',
    name: 'Ressonância magnética',
    level: 'impossivel',
    code: 'RSN',
    icon: 'Waves',
    desc: 'Permanente: dois trechos do caminho (marcados) aceleram os inimigos em 35% e reduzem pela metade as desacelerações sofridas ali.',
    tech: 'Em ressonância, pequenas excitações produzem grandes respostas.',
    counter: 'Posicione interrupção (relé, CI 555) antes ou depois dos trechos ressonantes.',
    math: 'velocidade × 1,35 e lentidão × 0,50 dentro dos trechos ressonantes',
    onUnits: 'Nenhum efeito direto.',
    onEnemies: 'Correm mais rápido e resistem à lentidão em dois trechos fixos da rota.',
    tags: ['enemySpeed'],
    color: '#c77dff',
  },
  falha_isolamento: {
    id: 'falha_isolamento',
    name: 'Falha de isolamento',
    level: 'impossivel',
    code: 'ISO',
    icon: 'ShieldOff',
    desc: 'A cada 16 s, por 5 s, unidades sem proteção de diodo causam −30% de dano.',
    tech: 'Isolamentos degradados permitem fugas que roubam parte da energia útil.',
    counter: 'Proteção de diodo torna a unidade imune.',
    math: 'dano × 0,70 nas unidades sem proteção de diodo',
    onUnits: 'Pune composições sem diodos de proteção.',
    onEnemies: 'Nenhum efeito direto.',
    tags: ['damage'],
    color: '#39d0b8',
    period: 16,
    duration: 5,
    offset: 9,
  },

  /* ==================== Patch 1.2 — §11: dez modificadores novos ==================== */

  emi_conduzida: {
    id: 'emi_conduzida',
    name: 'Interferência eletromagnética conduzida',
    level: 'dificil',
    code: 'EMC',
    icon: 'Cable',
    desc: 'A cada 20 s, por 6 s, as unidades semicondutoras (diodo, transistor, MOSFET, IGBT, amp. operacional, retificador, CI 555) ficam com intervalo de ataque +30%.',
    tech: 'Ruído conduzido entra pelos próprios cabos de alimentação e sinal. Junções semicondutoras, que comutam com base em limiares de tensão, erram o instante de condução — é por isso que normas de EMC exigem filtros de linha e modo comum.',
    counter: 'Unidades magnéticas (bobina, indutor, RL) não são semicondutoras e ignoram o efeito; o filtro da Ponte Retificadora reduz a penalidade à metade.',
    math: 'intervalo × 1,30 nas unidades semicondutoras (× 1,15 se filtradas por retificador)',
    onUnits: 'Atrasa a comutação de todo o arsenal de semicondutores.',
    onEnemies: 'Nenhum efeito direto.',
    tags: ['rate'],
    color: '#8bb4ff',
    period: 20,
    duration: 6,
    offset: 4,
  },
  blindagem_faraday: {
    id: 'blindagem_faraday',
    name: 'Blindagem de Faraday',
    level: 'impossivel',
    code: 'FAR',
    icon: 'Shield',
    desc: 'Permanente: todos os inimigos recebem 35% menos dano magnético (bobina, indutor, RL, oscilador, supercondutor).',
    tech: 'Uma gaiola de Faraday é um invólucro condutor: as cargas se redistribuem e anulam o campo elétrico externo no interior. Contra campos magnéticos variáveis, correntes induzidas no invólucro opõem-se à variação do fluxo (lei de Lenz) e atenuam o campo que chega dentro.',
    counter: 'Troque o eixo de dano: comutação (relé), descarga (capacitor, Tesla), grampeamento (diodo) e térmico (resistor) passam pela blindagem.',
    math: 'dano recebido × 0,65 quando o tipo é magnético',
    onUnits: 'Nenhum efeito direto.',
    onEnemies: 'Ganham resistência eletromagnética uniforme.',
    tags: ['resist'],
    color: '#7f8ca3',
  },
  sobretensao_periodica: {
    id: 'sobretensao_periodica',
    name: 'Sobretensão',
    level: 'dificil',
    code: 'SRG',
    icon: 'ArrowUpNarrowWide',
    desc: 'A cada 18 s, por 5 s, todos os inimigos ficam 35% mais rápidos.',
    tech: 'Tensão acima do valor nominal entrega mais potência à carga do que o projeto previa (P = V²/R). Em máquinas, isso aparece como aumento de velocidade e aquecimento.',
    counter: 'Interrupção e lentidão (relé, CI 555, capacitor, RL) seguram as janelas; distribua defesas ao longo da rota em vez de concentrar na entrada.',
    math: 'velocidade dos inimigos × 1,35 durante a janela',
    onUnits: 'Nenhum efeito direto.',
    onEnemies: 'Avançam em disparadas periódicas.',
    tags: ['enemySpeed'],
    color: '#ffb347',
    period: 18,
    duration: 5,
    offset: 7,
  },
  subtensao: {
    id: 'subtensao',
    name: 'Subtensão',
    level: 'impossivel',
    code: 'UVL',
    icon: 'BatteryLow',
    desc: 'Permanente: a geração de créditos do jogador cai 35%.',
    tech: 'Com tensão abaixo da nominal, a potência disponível cai com o quadrado da tensão. Fontes passam a operar fora do ponto de projeto e o rendimento da conversão despenca.',
    counter: 'Priorize dano por crédito em vez de economia; o bônus de conclusão de onda não é afetado.',
    math: 'geração × 0,65 (fontes e retificadores)',
    onUnits: 'Reduz a renda de todas as unidades de economia.',
    onEnemies: 'Nenhum efeito direto.',
    tags: ['economy'],
    color: '#4f9e73',
  },
  saturacao_magnetica: {
    id: 'saturacao_magnetica',
    name: 'Saturação magnética',
    level: 'dificil',
    code: 'SAT',
    icon: 'Magnet',
    desc: 'A cada 22 s, por 7 s, as unidades magnéticas (bobina, indutor, RL, oscilador, transformador, supercondutor) causam −40% de dano.',
    tech: 'Acima de certa corrente, os domínios do núcleo já estão alinhados: o fluxo para de crescer proporcionalmente e a indutância efetiva cai. A bobina deixa de converter corrente em campo útil.',
    counter: 'Semicondutores e dano térmico não dependem do núcleo; alterne os eixos de dano durante a janela.',
    math: 'dano × 0,60 nas unidades de núcleo magnético',
    onUnits: 'Derruba o dano do arsenal eletromagnético por janelas longas.',
    onEnemies: 'Nenhum efeito direto.',
    tags: ['damage'],
    color: '#9a7bff',
    period: 22,
    duration: 7,
    offset: 11,
  },
  ruido_eletrico: {
    id: 'ruido_eletrico',
    name: 'Ruído elétrico',
    level: 'dificil',
    code: 'NSE',
    icon: 'AudioWaveform',
    desc: 'A cada 14 s, por 6 s, cerca de 40% das unidades (sorteadas) ficam com intervalo de ataque +30%.',
    tech: 'Ruído é sinal indesejado somado ao sinal útil. Quando a relação sinal-ruído cai, comandos são interpretados fora de hora e a cadência real se afasta da nominal.',
    counter: 'O filtro da Ponte Retificadora corta o efeito pela metade; a característica Isolamento e a proteção de diodo anulam.',
    math: 'intervalo × 1,30 nas unidades sorteadas (hash determinístico, ~40%)',
    onUnits: 'Desregula a cadência de parte do arsenal, variando a cada janela.',
    onEnemies: 'Nenhum efeito direto.',
    tags: ['rate'],
    color: '#a28bff',
    period: 14,
    duration: 6,
    offset: 3,
  },
  ruptura_dieletrica: {
    id: 'ruptura_dieletrica',
    name: 'Ruptura dielétrica',
    level: 'impossivel',
    code: 'DIE',
    icon: 'Zap',
    desc: 'Permanente: todos os inimigos recebem 30% menos dano de descarga e de grampeamento.',
    tech: 'Quando o campo elétrico supera a rigidez dielétrica do meio, ele ioniza e passa a conduzir. O caminho ionizado tem impedância muito baixa: a descarga escoa por ele em vez de depositar energia no alvo.',
    counter: 'Dano magnético e térmico não dependem de ruptura: indutor, bobina, RL e resistor mantêm a eficácia.',
    math: 'dano recebido × 0,70 quando o tipo é descarga ou grampeamento',
    onUnits: 'Nenhum efeito direto.',
    onEnemies: 'Resistem a capacitores, Tesla e diodos.',
    tags: ['resist'],
    color: '#ffe066',
  },
  efeito_joule: {
    id: 'efeito_joule',
    name: 'Efeito Joule',
    level: 'dificil',
    code: 'JLE',
    icon: 'Thermometer',
    desc: 'Permanente: o dano térmico contínuo (calor do resistor e do plasma) cai 40%.',
    tech: 'A potência dissipada em um resistor é P = I²·R, e a temperatura final depende do equilíbrio entre o calor gerado e o dissipado para o ambiente. Com mais dissipação para o meio, o alvo não acumula temperatura.',
    counter: 'O golpe direto do resistor não é afetado — só o dano contínuo; combine com dano de impacto.',
    math: 'dano térmico contínuo × 0,60 (k·n² por segundo)',
    onUnits: 'Reduz o rendimento das unidades de dano térmico.',
    onEnemies: 'Aquecem menos e sofrem menos dano contínuo.',
    tags: ['damage'],
    color: '#ff7a59',
  },
  falha_comutacao: {
    id: 'falha_comutacao',
    name: 'Falha de comutação',
    level: 'impossivel',
    code: 'SWF',
    icon: 'ToggleLeft',
    desc: 'A cada 17 s, por 5 s, as unidades baseadas em transistores (transistor, MOSFET, IGBT, amp. operacional) causam −35% de dano e perdem os estágios de ganho acumulados.',
    tech: 'Em comutação dura, o transistor atravessa a região ativa com tensão e corrente altas ao mesmo tempo. Se a comutação falha ou atrasa, a perda vira calor em vez de potência entregue — e o ponto de polarização se perde.',
    counter: 'Sinergias que estabilizam a polarização (Resistor de emissor, Fonte DC) devolvem o ganho mais rápido; mantenha fontes de dano não transistorizadas.',
    math: 'dano × 0,65 e estágios de ganho zerados nas unidades de transistor',
    onUnits: 'Zera a amplificação progressiva e corta o dano do eixo de semicondutores.',
    onEnemies: 'Nenhum efeito direto.',
    tags: ['rate', 'damage'],
    color: '#5ab4ff',
    period: 17,
    duration: 5,
    offset: 9,
  },
  instabilidade_frequencia: {
    id: 'instabilidade_frequencia',
    name: 'Instabilidade de frequência',
    level: 'dificil',
    code: 'CLK',
    icon: 'Timer',
    desc: 'A cada 16 s, por 8 s, as unidades temporizadoras (CI 555, Oscilador LC, Oscilador de Cristal) têm o período alterado em ±25%, alternando a cada janela.',
    tech: 'O período de um astável depende de R e C (T ≈ 0,693·(R₁ + 2R₂)·C). Deriva térmica e tolerância dos componentes deslocam essa constante, e o circuito deixa de bater no tempo projetado.',
    counter: 'O Oscilador de Cristal é o mais estável do arsenal e sofre metade do desvio; não dependa de um único temporizador para sincronizar a defesa.',
    math: 'período × 1,25 nas janelas ímpares e × 0,80 nas pares (× 0,5 do desvio no cristal)',
    onUnits: 'Desalinha a sincronização dos temporizadores — para melhor ou para pior.',
    onEnemies: 'Nenhum efeito direto.',
    tags: ['rate'],
    color: '#ffd166',
    period: 16,
    duration: 8,
    offset: 5,
  },
};

/** 1.2: quantos modificadores do mesmo eixo podem coexistir em uma mesma partida. */
const TAG_CAPS: Record<ModifierTag, number> = {
  economy: 1,
  resist: 2,
  rate: 3,
  damage: 3,
  range: 1,
  enemySpeed: 1,
  control: 2,
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

/** Ordem canônica dos modificadores (base determinística do sorteio). */
export const MODIFIER_ORDER: ModifierId[] = Object.keys(MODIFIERS) as ModifierId[];

/** hash determinístico em [0, 1) — mesma função usada pela engine. */
function hash01(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * 1.2 — §10/§11: modificadores de uma fase.
 *
 *   Normal      nenhum
 *   Difícil     até 3 (MODIFIER_COUNT.dificil)
 *   Impossível  exatamente 7 (MODIFIER_COUNT.impossivel)
 *
 * A seleção é DETERMINÍSTICA (semente = mapa + variante + dificuldade), para que cliente e
 * servidor cheguem à mesma lista na re-simulação. Começa pelos modificadores temáticos do
 * mapa, depois completa a partir do catálogo embaralhado, respeitando os limites por eixo
 * (`TAG_CAPS`) — é esse limite que evita combinações matematicamente impossíveis, como três
 * modificadores de economia ao mesmo tempo. Se os limites impedirem atingir a quantidade
 * exigida, as últimas vagas são preenchidas ignorando o limite, porque a quantidade do
 * Impossível é um requisito do modo.
 */
export function modifiersFor(stage: StageDef, diff: Difficulty): ModifierId[] {
  if (diff === 'normal') return [];
  const want = MODIFIER_COUNT[diff];
  const k = stage.variant ?? 1;
  const seed = stage.map.length * 31 + k * 7 + (diff === 'impossivel' ? 101 : 0);

  const chosen: ModifierId[] = [];
  const used = new Set<ModifierId>();
  const counts: Partial<Record<ModifierTag, number>> = {};

  const fits = (id: ModifierId) => MODIFIERS[id].tags.every((t) => (counts[t] ?? 0) < TAG_CAPS[t]);
  const take = (id: ModifierId, force = false) => {
    if (used.has(id) || chosen.length >= want) return;
    if (!force && !fits(id)) return;
    for (const t of MODIFIERS[id].tags) counts[t] = (counts[t] ?? 0) + 1;
    used.add(id);
    chosen.push(id);
  };

  // 1) modificadores declarados pela fase e os temáticos do mapa (identidade do cenário)
  for (const id of stage.modifiers?.[diff] ?? []) take(id);
  const t = MAP_MODIFIERS[stage.map];
  for (const id of diff === 'impossivel' ? [...t.impossivel, ...t.dificil] : t.dificil) take(id);

  // 2) completa a partir do catálogo, embaralhado de forma determinística
  const pool = MODIFIER_ORDER.filter((id) => diff === 'impossivel' || MODIFIERS[id].level === 'dificil')
    .map((id, i) => ({ id, r: hash01(seed, i + 1, id.length) }))
    .sort((a, b) => a.r - b.r || a.id.localeCompare(b.id))
    .map((x) => x.id);
  for (const id of pool) take(id);

  // 3) o Impossível exige a quantidade exata: preenche ignorando os limites por eixo
  if (chosen.length < want) for (const id of pool) take(id, true);
  return chosen;
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
