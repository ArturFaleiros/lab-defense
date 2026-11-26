/**
 * Tipos compartilhados do EMLab Defense.
 *
 * Os atributos de balanceamento ficam centralizados em `data/`; a engine em `engine/` só lê
 * essas definições. Nada aqui depende de React ou do DOM.
 */

export type UnitId =
  | 'rele'
  | 'bobina'
  | 'fonte'
  | 'indutor'
  | 'diodo'
  | 'capacitor'
  | 'rl'
  | 'transformador'
  // Patch 1.1
  | 'resistor'
  | 'transistor'
  | 'retificador'
  | 'oscilador'
  | 'ci555'
  | 'tesla'
  | 'supercondutor';

export type EnemyId =
  | 'curto'
  | 'surto'
  | 'sobrecarga'
  | 'ruido'
  | 'interferencia'
  | 'isolamento'
  | 'instabilidade'
  | 'arco'
  | 'saturacao'
  | 'cascata'
  | 'colapso'
  // Patch 1.1
  | 'franco'
  | 'sobretensao'
  | 'emi'
  | 'fuga'
  | 'aberto'
  | 'transiente'
  | 'saturado'
  | 'ressonancia'
  | 'apagao';

export type UnitClass = 'DPS' | 'Burst' | 'Support' | 'Control' | 'Economy' | 'Hybrid' | 'Defense';

/** Tipo de dano (adaptação lúdica, usado para resistências dos inimigos). */
export type DamageType = 'magnetico' | 'comutacao' | 'descarga' | 'grampeamento' | 'termico';

export type TargetPriority = 'primeiro' | 'ultimo' | 'resistente' | 'objetivo';

export type TraitId = 'eficiencia' | 'precisao' | 'resposta' | 'isolamento' | 'sobrecarga';

/** Raridade (identidade e regras de equipe; não determina sozinha a utilidade). */
export type Rarity = 'comum' | 'incomum' | 'raro' | 'epico' | 'lendario' | 'mitico' | 'secreto';

/** Dificuldade de uma fase. */
export type Difficulty = 'normal' | 'dificil' | 'impossivel';

/** Nível de evolução permanente (0 = forma base). */
export type Tier = 0 | 1 | 2;

export type MapId =
  | 'placa'
  | 'bancada'
  | 'barramento'
  | 'malha'
  | 'nucleo'
  // Patch 1.1
  | 'osciloscopio'
  | 'ponte'
  | 'subestacao'
  | 'chip'
  | 'transmissao';

export interface Vec {
  x: number;
  y: number;
}

/** Unidade escolhida para a partida, com sua evolução e característica permanentes. */
export interface LoadoutEntry {
  id: UnitId;
  tier: Tier;
  trait: TraitId | null;
}
