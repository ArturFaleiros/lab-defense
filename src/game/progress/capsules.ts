import type { UnitId } from '../types';

/**
 * Cápsulas de Energia — sistema de recompensas do Update 1.2 (§15).
 *
 * Obtenção (mantida do patch 1.1): a cada 5 ondas concluídas do modo infinito há UMA
 * verificação com 50% de chance de obter uma cápsula.
 *
 * Conteúdo de uma cápsula ABERTA — quatro categorias, probabilidades fixas que somam
 * exatamente 100%:
 *
 *   50%  →  50–70 EC          (energia)
 *   30%  →  70–100 EC         (energia avançada)
 *   15%  →  50–100 XP         (experiência de engenheiro, progressão permanente)
 *    5%  →  Unidade Secreta   (adicionada permanentemente ao inventário)
 *
 * GARANTIA (pity, §15.2): após 50 cápsulas abertas sem a unidade secreta, a próxima
 * abertura concede a unidade obrigatoriamente. Obter a unidade (pela chance normal ou pela
 * garantia) zera o contador.
 *
 * ---------------------------------------------------------------------------------------
 * Separação cliente/servidor (§15.3)
 * ---------------------------------------------------------------------------------------
 * A engine NÃO decide a recompensa: ela apenas consome dois números do gerador da partida e
 * os registra (`r1`, `r2`). Quem transforma esses números em recompensa é `resolveCapsule`,
 * chamada pelo sistema que persiste a conta — porque o resultado depende do contador de
 * garantia e do inventário, que são dados do jogador, não da partida.
 *
 * Isso dá três propriedades de uma vez: o servidor re-simula a partida e chega aos mesmos
 * `r1`/`r2`; a recompensa é calculada e validada no servidor; e o cliente consegue mostrar
 * a mesma prévia aplicando a função pura ao perfil que recebeu.
 */

/** Unidades secretas, na ordem em que as cápsulas as concedem. */
export const SECRET_UNITS: UnitId[] = ['supercondutor', 'plasma'];

export const CAPSULE_EVERY = 5;
export const CAPSULE_CHANCE = 0.5;

/** Limite da garantia: a 50ª abertura sem a unidade secreta a concede. */
export const PITY_LIMIT = 50;

export type CapsuleKind = 'ec' | 'ecPlus' | 'xp' | 'secret';

export interface CapsuleTableRow {
  kind: CapsuleKind;
  /** probabilidade (as quatro somam 1) */
  p: number;
  min: number;
  max: number;
  label: string;
}

/**
 * Tabela oficial. A ordem importa: `resolveCapsule` percorre acumulando as probabilidades.
 * A soma é verificada em teste (`§15 tabela oficial`).
 */
export const CAPSULE_TABLE: CapsuleTableRow[] = [
  { kind: 'ec', p: 0.5, min: 50, max: 70, label: '50–70 EC' },
  { kind: 'ecPlus', p: 0.3, min: 70, max: 100, label: '70–100 EC' },
  { kind: 'xp', p: 0.15, min: 50, max: 100, label: '50–100 XP de Engenheiro' },
  { kind: 'secret', p: 0.05, min: 0, max: 0, label: 'Unidade Secreta' },
];

/** EC concedida no lugar da unidade secreta quando o jogador já tem todas. */
export const SECRET_DUPLICATE_EC = 150;

export type CapsuleContent =
  | { kind: 'ec' | 'ecPlus'; amount: number }
  | { kind: 'xp'; amount: number }
  | { kind: 'secret'; unit: UnitId }
  /** já possui todas as unidades secretas: a cápsula vira energia */
  | { kind: 'secretDuplicate'; amount: number };

export interface CapsuleRoll {
  /** onda-marco (5, 10, 15…) */
  milestone: number;
  got: boolean;
  /** números crus do gerador da partida: categoria e valor dentro da faixa */
  r1: number;
  r2: number;
}

export interface CapsuleResult {
  content: CapsuleContent;
  /** a unidade veio da garantia (e não da chance de 5%) */
  guaranteed: boolean;
  /** contador de garantia depois desta abertura */
  pityAfter: number;
}

export function isCapsuleMilestone(wave: number): boolean {
  return wave > 0 && wave % CAPSULE_EVERY === 0;
}

/** Sorteio uniforme de inteiro em [min, max] a partir de um número em [0, 1). */
export function pickInt(r: number, min: number, max: number): number {
  return min + Math.min(max - min, Math.floor(r * (max - min + 1)));
}

/**
 * Uma única verificação de 50% para o marco. Consome dois números do gerador quando a
 * cápsula é obtida, para que a re-simulação no servidor avance o gerador igual.
 */
export function rollCapsule(milestone: number, rand: () => number): CapsuleRoll {
  const got = rand() < CAPSULE_CHANCE;
  return { milestone, got, r1: got ? rand() : 0, r2: got ? rand() : 0 };
}

/**
 * Converte o sorteio cru na recompensa, considerando a garantia e o inventário.
 * Função PURA: mesmo `roll` + mesmo estado da conta ⇒ mesma recompensa, no cliente e no
 * servidor.
 *
 * @param pity   cápsulas abertas desde a última unidade secreta
 * @param owned  unidades secretas que o jogador já possui
 */
export function resolveCapsule(roll: CapsuleRoll, pity: number, owned: UnitId[]): CapsuleResult {
  const next = SECRET_UNITS.find((u) => !owned.includes(u));
  // §15.2: a abertura que completa o limite concede a unidade obrigatoriamente, substituindo
  // a rolagem aleatória
  const guaranteed = pity + 1 >= PITY_LIMIT;

  let kind: CapsuleKind = 'secret';
  if (!guaranteed) {
    let acc = 0;
    for (const row of CAPSULE_TABLE) {
      acc += row.p;
      if (roll.r1 < acc) {
        kind = row.kind;
        break;
      }
    }
  }

  if (kind === 'secret') {
    // sem unidade nova para dar, a cápsula vira energia — e a garantia NÃO é consumida
    if (!next) return { content: { kind: 'secretDuplicate', amount: SECRET_DUPLICATE_EC }, guaranteed: false, pityAfter: pity + 1 };
    return { content: { kind: 'secret', unit: next }, guaranteed, pityAfter: 0 };
  }

  const row = CAPSULE_TABLE.find((r) => r.kind === kind)!;
  const amount = pickInt(roll.r2, row.min, row.max);
  const content: CapsuleContent = kind === 'xp' ? { kind: 'xp', amount } : { kind, amount };
  return { content, guaranteed: false, pityAfter: pity + 1 };
}

/** Quantas cápsulas faltam para a garantia (para o indicador “X/50”). */
export function pityRemaining(pity: number): number {
  return Math.max(0, PITY_LIMIT - pity);
}
