/**
 * Cápsulas Energéticas do modo infinito (Patch 1.1).
 *
 * - A cada 5 ondas concluídas (5, 10, 15, …) há UMA verificação com 50% de chance.
 * - Conteúdo de uma cápsula obtida (probabilidades condicionais, somam 100%):
 *     Unidade Secreta 5% · 70–100 EC 50% · 100–140 EC 45%  (inteiros, sorteio uniforme)
 * - Se a Unidade Secreta já tiver sido descoberta, a cápsula entrega 150 EC no lugar dela.
 *
 * Funções puras: recebem o gerador de números aleatórios para serem testáveis.
 */

export const CAPSULE_EVERY = 5;
export const CAPSULE_CHANCE = 0.5;
export const CAPSULE_TABLE = [
  { kind: 'secret' as const, p: 0.05 },
  { kind: 'ecLow' as const, p: 0.5, min: 70, max: 100 },
  { kind: 'ecHigh' as const, p: 0.45, min: 100, max: 140 },
];
export const SECRET_DUPLICATE_EC = 150;

export type CapsuleContent = { kind: 'secret' } | { kind: 'ec'; amount: number; tier: 'ecLow' | 'ecHigh' };

export interface CapsuleRoll {
  /** onda-marco (5, 10, 15…) */
  milestone: number;
  got: boolean;
  content: CapsuleContent | null;
}

export function isCapsuleMilestone(wave: number): boolean {
  return wave > 0 && wave % CAPSULE_EVERY === 0;
}

/** Sorteio uniforme de inteiro em [min, max]. */
export function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.min(max - min, Math.floor(rand() * (max - min + 1)));
}

/** Conteúdo de uma cápsula já obtida. */
export function openCapsule(rand: () => number): CapsuleContent {
  const r = rand();
  if (r < CAPSULE_TABLE[0].p) return { kind: 'secret' };
  if (r < CAPSULE_TABLE[0].p + CAPSULE_TABLE[1].p) return { kind: 'ec', amount: randInt(rand, 70, 100), tier: 'ecLow' };
  return { kind: 'ec', amount: randInt(rand, 100, 140), tier: 'ecHigh' };
}

/** Uma única verificação de 50% para o marco; se obtida, abre a cápsula. */
export function rollCapsule(milestone: number, rand: () => number): CapsuleRoll {
  const got = rand() < CAPSULE_CHANCE;
  return { milestone, got, content: got ? openCapsule(rand) : null };
}
