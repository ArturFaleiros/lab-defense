import type { UnitId } from '../types';

/**
 * Sinergias específicas entre componentes (Patch 1.1). Cada uma tem base técnica e efeito
 * pontual — não há bônus universais. A engine marca em cada unidade quais sinergias estão
 * ativas (`buff.syn`) e os comportamentos consultam essas marcas.
 */

export type SynergyId =
  | 'flyback'
  | 'alimentacao'
  | 'filtroLC'
  | 'polarizacao'
  | 'resistorEmissor'
  | 'filtroCapacitivo'
  | 'acoplamento'
  | 'sincronismo';

export interface SynergyDef {
  id: SynergyId;
  name: string;
  /** quem provoca o efeito */
  source: UnitId[];
  /** quem recebe o efeito */
  target: UnitId[];
  /** distância máxima entre as duas unidades; 'aura' = raio de aura da fonte */
  range: number | 'aura';
  effect: string;
  why: string;
}

export const SYNERGIES: SynergyDef[] = [
  {
    id: 'flyback',
    name: 'Diodo de flyback',
    source: ['diodo'],
    target: ['rele', 'bobina', 'indutor', 'rl', 'oscilador', 'tesla'],
    range: 'aura',
    effect: 'Componentes com bobina protegidos por um diodo causam +15% de dano.',
    why: 'O diodo em antiparalelo dá caminho à corrente da bobina no desligamento e evita o pico de tensão.',
  },
  {
    id: 'alimentacao',
    name: 'Alimentação do capacitor',
    source: ['fonte'],
    target: ['capacitor'],
    range: 'aura',
    effect: 'Capacitores no raio da Fonte DC carregam 10% mais rápido.',
    why: 'Uma fonte capaz de fornecer mais corrente carrega o capacitor mais depressa.',
  },
  {
    id: 'filtroLC',
    name: 'Filtro LC',
    source: ['capacitor', 'indutor'],
    target: ['indutor', 'capacitor'],
    range: 120,
    effect: 'Indutor e capacitor a até 120 um do outro: rampa do indutor 15% mais rápida e descarga do capacitor +10%.',
    why: 'Indutor e capacitor juntos formam o filtro LC das fontes chaveadas: um suaviza a corrente, o outro a tensão.',
  },
  {
    id: 'polarizacao',
    name: 'Polarização estável',
    source: ['fonte'],
    target: ['transistor'],
    range: 'aura',
    effect: 'Transistores no raio da Fonte DC ganham 2 estágios de ganho por golpe.',
    why: 'Uma alimentação estável mantém o ponto de operação (polarização) do transistor.',
  },
  {
    id: 'resistorEmissor',
    name: 'Resistor de emissor',
    source: ['resistor'],
    target: ['transistor'],
    range: 100,
    effect: 'Transistores a até 100 de um Resistor não perdem estágios de ganho ao trocar de alvo.',
    why: 'O resistor de emissor realimenta a polarização e estabiliza o ganho contra variações (inclusive térmicas).',
  },
  {
    id: 'filtroCapacitivo',
    name: 'Filtro capacitivo',
    source: ['capacitor'],
    target: ['retificador'],
    range: 'aura',
    effect: 'Retificadores com um Capacitor no raio convertem 50% mais.',
    why: 'O capacitor de filtro após a ponte eleva a tensão média entregue à carga.',
  },
  {
    id: 'acoplamento',
    name: 'Acoplamento indutivo',
    source: ['transformador'],
    target: ['tesla', 'oscilador'],
    range: 'aura',
    effect: 'Na aura de um Transformador, a Bobina de Tesla ganha +1 salto e o Oscilador, +15% de dano.',
    why: 'Bobinas acopladas trocam energia pelo fluxo magnético comum — a base do transformador e da Tesla.',
  },
  {
    id: 'sincronismo',
    name: 'Sincronismo de comando',
    source: ['ci555'],
    target: ['rele'],
    range: 'aura',
    effect: 'Relés na aura do CI 555 interrompem por +0,15 s enquanto o temporizador está em nível alto.',
    why: 'A saída do 555 aciona relés diretamente (via transistor), sincronizando a comutação.',
  },
];

export const SYNERGY_BY_ID: Record<SynergyId, SynergyDef> = Object.fromEntries(SYNERGIES.map((s) => [s.id, s])) as Record<SynergyId, SynergyDef>;
