import type { MapId, Vec } from '../types';

/** Dimensões lógicas do mapa (a tela escala mantendo a proporção). */
export const MAP_W = 960;
export const MAP_H = 540;
export const PATH_WIDTH = 36;
export const UNIT_RADIUS = 17;

export interface MapDef {
  id: MapId;
  name: string;
  desc: string;
  /** um ou mais caminhos; todos terminam no núcleo */
  paths: Vec[][];
  core: Vec;
  /** semente das trilhas decorativas de fundo */
  seed: number;
  /** ambientação do cenário (desenho de fundo) */
  theme: MapTheme;
}

export type MapTheme = 'pcb' | 'scope' | 'bridge' | 'substation' | 'chip' | 'line';

/** Senoide amostrada: caminho do mapa do osciloscópio (2 períodos completos). */
function sine(): Vec[] {
  const out: Vec[] = [];
  for (let x = -30; x <= 900; x += 15) out.push({ x, y: Math.round(270 - 165 * Math.sin((2 * Math.PI * (x + 30)) / 465)) });
  return out;
}

const p = (...xy: number[]): Vec[] => {
  const out: Vec[] = [];
  for (let i = 0; i < xy.length; i += 2) out.push({ x: xy[i], y: xy[i + 1] });
  return out;
};

export const MAPS = {
  placa: {
    id: 'placa',
    name: 'Placa de Comando',
    desc: 'Trilha única em S. Curvas fechadas favorecem unidades centrais.',
    paths: [p(-30, 90, 260, 90, 260, 270, 120, 270, 120, 440, 520, 440, 520, 150, 760, 150, 760, 380, 905, 380)],
    core: { x: 905, y: 380 },
    seed: 11,
    theme: 'pcb',
  },
  bancada: {
    id: 'bancada',
    name: 'Bancada de Bobinas',
    desc: 'Espiral longa em direção ao centro. Muito espaço, pouco tempo nas bordas.',
    paths: [p(-30, 70, 880, 70, 880, 470, 90, 470, 90, 190, 740, 190, 740, 355, 300, 355)],
    core: { x: 300, y: 355 },
    seed: 23,
    theme: 'pcb',
  },
  barramento: {
    id: 'barramento',
    name: 'Barramento de Proteção',
    desc: 'Duas entradas que se unem em um barramento comum antes do núcleo.',
    paths: [
      p(-30, 110, 300, 110, 300, 270, 610, 270, 610, 430, 905, 430),
      p(-30, 470, 200, 470, 200, 340, 430, 340, 430, 270, 610, 270, 610, 430, 905, 430),
    ],
    core: { x: 905, y: 430 },
    seed: 37,
    theme: 'pcb',
  },
  malha: {
    id: 'malha',
    name: 'Malha RL',
    desc: 'Zigue-zague vertical: trechos paralelos próximos permitem cobrir duas passagens.',
    paths: [p(80, -30, 80, 440, 260, 440, 260, 110, 440, 110, 440, 440, 620, 440, 620, 110, 800, 110, 800, 300, 910, 300)],
    core: { x: 910, y: 300 },
    seed: 41,
    theme: 'pcb',
  },
  nucleo: {
    id: 'nucleo',
    name: 'Núcleo Eletromagnético',
    desc: 'Duas rotas simétricas convergem para o núcleo central da instalação.',
    paths: [
      p(-30, 80, 200, 80, 200, 185, 400, 185, 400, 80, 640, 80, 640, 270, 820, 270),
      p(-30, 460, 200, 460, 200, 355, 400, 355, 400, 460, 640, 460, 640, 270, 820, 270),
    ],
    core: { x: 820, y: 270 },
    seed: 53,
    theme: 'pcb',
  },
} as Record<MapId, MapDef>;


/* ------------------------------ Patch 1.1 ------------------------------ */

export const EXPANSION_MAPS: Record<'osciloscopio' | 'ponte' | 'subestacao' | 'chip' | 'transmissao', MapDef> = {
  osciloscopio: {
    id: 'osciloscopio',
    name: 'Tela do Osciloscópio',
    desc: 'O caminho é uma senoide de dois períodos: curvas suaves, picos e vales que expõem os inimigos várias vezes ao mesmo ponto.',
    paths: [sine()],
    core: { x: 900, y: 270 },
    seed: 61,
    theme: 'scope',
  },
  ponte: {
    id: 'ponte',
    name: 'Ponte Retificadora',
    desc: 'Uma entrada que se divide em losango, como os quatro diodos da ponte, e volta a se unir antes do núcleo.',
    paths: [
      p(-30, 270, 150, 270, 290, 120, 670, 120, 810, 270, 905, 270),
      p(-30, 270, 150, 270, 290, 420, 670, 420, 810, 270, 905, 270),
    ],
    core: { x: 905, y: 270 },
    seed: 67,
    theme: 'bridge',
  },
  subestacao: {
    id: 'subestacao',
    name: 'Subestação de Distribuição',
    desc: 'Barramentos longos e um laço que cruza o próprio caminho: o cruzamento é o ponto mais disputado do mapa.',
    paths: [p(-30, 100, 720, 100, 720, 440, 240, 440, 240, 270, 905, 270)],
    core: { x: 905, y: 270 },
    seed: 71,
    theme: 'substation',
  },
  chip: {
    id: 'chip',
    name: 'Interior do Circuito Integrado',
    desc: 'Labirinto de trilhas estreitas entre blocos do chip: trechos curtos, muitas quinas e pouco espaço livre.',
    paths: [p(-30, 70, 110, 70, 110, 470, 230, 470, 230, 190, 330, 190, 330, 70, 470, 70, 470, 470, 590, 470, 590, 300, 700, 300, 700, 70, 840, 70, 840, 400, 905, 400)],
    core: { x: 905, y: 400 },
    seed: 79,
    theme: 'chip',
  },
  transmissao: {
    id: 'transmissao',
    name: 'Linha de Transmissão',
    desc: 'Três linhas chegam de pontos diferentes e se unem em um tronco longo em zigue-zague até a subestação.',
    paths: [
      p(-30, 80, 380, 80, 380, 270, 560, 270, 560, 130, 780, 130, 780, 400, 905, 400),
      p(-30, 270, 380, 270, 560, 270, 560, 130, 780, 130, 780, 400, 905, 400),
      p(-30, 460, 380, 460, 380, 270, 560, 270, 560, 130, 780, 130, 780, 400, 905, 400),
    ],
    core: { x: 905, y: 400 },
    seed: 83,
    theme: 'line',
  },
};

Object.assign(MAPS, EXPANSION_MAPS);

export const MAP_ORDER: MapId[] = ['placa', 'bancada', 'barramento', 'malha', 'nucleo', 'osciloscopio', 'ponte', 'subestacao', 'chip', 'transmissao'];
