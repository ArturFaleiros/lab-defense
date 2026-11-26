import type { TraitId } from '../types';

/**
 * Características passivas permanentes. São desbloqueadas pelo nível do engenheiro
 * (determinístico, sem sorteio) e podem ser trocadas livremente na tela de unidades.
 */
export interface TraitDef {
  id: TraitId;
  name: string;
  desc: string;
  limitation?: string;
  unlockLevel: number;
  color: string;
}

export const TRAITS: Record<TraitId, TraitDef> = {
  resposta: {
    id: 'resposta',
    name: 'Resposta rápida',
    desc: 'Intervalo entre ataques −12% (capacitor recarrega 12% mais rápido; fonte gera com mais frequência).',
    unlockLevel: 2,
    color: '#45cfe0',
  },
  eficiencia: {
    id: 'eficiencia',
    name: 'Alta eficiência',
    desc: 'Custo de posicionamento e de melhorias −12%.',
    unlockLevel: 3,
    color: '#39d08a',
  },
  precisao: {
    id: 'precisao',
    name: 'Precisão',
    desc: '+25% de dano contra chefes e inimigos blindados.',
    unlockLevel: 4,
    color: '#3d9bff',
  },
  isolamento: {
    id: 'isolamento',
    name: 'Isolamento',
    desc: 'Imune à Interferência e ao Ruído; o pulso do Colapso dura 70% menos.',
    unlockLevel: 5,
    color: '#a28bff',
  },
  sobrecarga: {
    id: 'sobrecarga',
    name: 'Sobrecarga controlada',
    desc: 'A cada 14 s, +40% de dano por 4 s.',
    limitation: 'Depois, −20% de cadência por 3 s (resfriamento).',
    unlockLevel: 6,
    color: '#ff9a47',
  },
};

export const TRAIT_ORDER: TraitId[] = ['resposta', 'eficiencia', 'precisao', 'isolamento', 'sobrecarga'];
