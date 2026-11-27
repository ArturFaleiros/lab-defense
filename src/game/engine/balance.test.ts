import { describe, expect, it } from 'vitest';
import { CAMPAIGN, STAGES, STAGE_BY_ID } from '../data/stages';
import type { Difficulty, LoadoutEntry, UnitId } from '../types';
import { runBot } from './bot';
import { GameEngine } from './GameEngine';
import { buildConfig } from './setup';

/** Unidades disponíveis ao iniciar cada fase (seguindo os desbloqueios da campanha). */
function unlockedBefore(stageId: string): UnitId[] {
  const units: UnitId[] = ['rele', 'bobina', 'fonte'];
  for (const s of CAMPAIGN) {
    if (s.id === stageId) break;
    for (const u of s.unlocks ?? []) units.push(u);
  }
  return units;
}

/** Equipe e ordem de construção de um jogador razoável (bot). */
export function teamFor(stageId: string, tierOverride?: 0 | 1 | 2): { loadout: LoadoutEntry[]; order: UnitId[] } {
  const stage = STAGE_BY_ID[stageId];
  const av = (stage.allowed ?? unlockedBefore(stageId === 'B-1' || stageId.startsWith('D') ? 'F-1' : stageId)).filter(
    (u) => !stage.allowed || stage.allowed.includes(u),
  );
  const pref: UnitId[] = ['bobina', 'rele', 'indutor', 'capacitor', 'diodo', 'fonte', 'rl', 'transformador'];
  const ids = pref.filter((u) => av.includes(u)).slice(0, 5);
  const order: UnitId[] = [];
  const push = (u: UnitId, n = 1) => {
    for (let i = 0; i < n; i++) if (ids.includes(u)) order.push(u);
  };
  push('bobina');
  push('fonte');
  push('rele');
  push('indutor');
  push('bobina');
  push('diodo');
  push('capacitor');
  push('fonte');
  push('rl');
  push('indutor');
  push('bobina');
  push('capacitor');
  push('transformador');
  push('rele');
  push('diodo');
  push('bobina');
  push('indutor', 2);
  // evolução permanente plausível para quem chegou até a fase
  const tier = tierOverride ?? ((stage.chapter >= 5 || stage.chapter === 0 ? 2 : stage.chapter >= 3 ? 1 : 0) as 0 | 1 | 2);
  return { loadout: ids.map((id) => ({ id, tier, trait: null })), order };
}

export function play(stageId: string, upgrades = true, maxUnits = 14, difficulty: Difficulty = 'normal') {
  const stage = STAGE_BY_ID[stageId];
  const team = teamFor(stageId);
  const eng = new GameEngine(buildConfig(stage, team.loadout, false, difficulty));
  runBot(eng, { order: team.order, upgrades, maxUnits });
  return eng;
}

describe('balanceamento (bot automático, dificuldade Normal)', () => {
  it('a fase 1-1 é vencível por uma estratégia razoável', () => {
    const eng = play('1-1');
    expect(eng.phase).toBe('won');
  });

  it('não fazer nada leva à derrota', () => {
    const eng = new GameEngine(buildConfig(STAGE_BY_ID['1-1'], [{ id: 'rele', tier: 0, trait: null }], false));
    for (let w = 0; w < 14 && !eng.isOver; w++) {
      if (eng.phase === 'prep') eng.startWave();
      for (let i = 0; i < 60 * 60 && !eng.isOver; i++) eng.update(1 / 60);
    }
    expect(eng.phase).toBe('lost');
  });

  it('toda a campanha é vencível no Normal com evolução permanente plausível', () => {
    for (const s of CAMPAIGN) expect([s.id, play(s.id).phase]).toEqual([s.id, 'won']);
  }, 400_000);

  /**
   * As melhorias em partida precisam continuar sendo decisivas: com no máximo 4 unidades e
   * sem nenhuma melhoria, estas fases têm de ser perdidas.
   *
   * Patch 1.2: a fase 3-3 saiu da lista. O patch elevou muito o DANO-BASE de várias unidades
   * (diodo +300%, indutor +50%, resistor +400%…), enquanto o Normal subiu de +15% para +50%
   * de vida — o saldo deixou 3-3 vencível já no nível 0. A proporção base → nível máximo não
   * mudou (os patches de nível foram escalados pelo mesmo fator), então as melhorias seguem
   * valendo o mesmo em termos relativos; o que mudou foi o patamar do Normal. As fases abaixo
   * foram medidas uma a uma e seguem exigindo melhorias.
   */
  it('sem melhorias, o capítulo 2 em diante não é vencível', () => {
    for (const id of ['2-2', '2-3', '4-3', 'F-1', '9-3', '11-3']) expect([id, play(id, false, 4).phase]).toEqual([id, 'lost']);
  }, 120_000);

  it('relatório de todas as fases', () => {
    const rows: string[] = [];
    for (const s of STAGES) {
      const eng = play(s.id);
      rows.push(`${s.id.padEnd(5)} bot: ${eng.phase.padEnd(4)} vidas ${String(eng.lives).padStart(2)}/${eng.maxLives} onda ${eng.wave + 1}/${eng.totalWaves}`);
    }
    console.log(rows.join('\n'));
    expect(rows.length).toBe(STAGES.length);
  }, 400_000);
});
