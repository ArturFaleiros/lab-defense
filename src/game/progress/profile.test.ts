import { describe, expect, it } from 'vitest';
import type { MatchStats } from '../engine/GameEngine';
import { answerQuiz, applyMatch, defaultProfile, evolve, levelInfo, sanitize, setTrait, xpForLevel } from './profile';

const stats = (over: Partial<MatchStats> = {}): MatchStats => ({
  kills: 40,
  leaks: 0,
  earned: 900,
  spent: 800,
  placed: 4,
  upgrades: 3,
  sold: 0,
  maxUnits: 4,
  stuns: 10,
  fonteIncome: 100,
  bosses: [],
  classes: ['Support', 'Control', 'Burst', 'Economy'],
  unitsUsed: ['rele', 'bobina', 'fonte'],
  damageBy: {},
  time: 200,
  abilities: 0,
  rectified: 0,
  capsules: [],
  ...over,
});

describe('progressão', () => {
  it('primeira vitória: estrelas, recompensas, histórico e conquistas', () => {
    const { profile, report } = applyMatch(defaultProfile(), { stageId: '1-1', won: true, waves: 5, stats: stats() });
    expect(report.firstClear).toBe(true);
    expect(report.stars).toBe(3);
    expect(profile.stages['1-1'].cleared).toBe(true);
    expect(report.xp).toBe(100);
    expect(report.achievements).toContain('primeiro');
    expect(report.achievements).toContain('estrelas');
    expect(profile.ec).toBe(report.ec);
    expect(profile.history[0].stage).toBe('1-1');
    expect(report.quizPending).toBe(true);
  });

  it('repetir a fase paga 35% e não duplica objetivos', () => {
    const a = applyMatch(defaultProfile(), { stageId: '1-1', won: true, waves: 5, stats: stats() });
    const b = applyMatch(a.profile, { stageId: '1-1', won: true, waves: 5, stats: stats() });
    expect(b.report.firstClear).toBe(false);
    expect(b.report.ec).toBe(Math.round(80 * 0.35));
    expect(b.report.newObjectives).toEqual([false, false]);
  });

  it('derrota não conclui a fase', () => {
    const { profile, report } = applyMatch(defaultProfile(), { stageId: '1-1', won: false, waves: 3, stats: stats({ leaks: 20 }) });
    expect(profile.stages['1-1'].cleared).toBe(false);
    expect(report.stars).toBe(0);
    expect(profile.stats.losses).toBe(1);
  });

  it('desbloqueia unidades pela campanha', () => {
    let p = defaultProfile();
    p.stages['1-2'] = { cleared: true, stars: 1, objectives: [false, false], quizDone: false, plays: 1, wins: 1, bestLeaks: 0, bestTime: 1, diff: {} };
    const r = applyMatch(p, { stageId: '1-3', won: true, waves: 9, stats: stats() });
    p = r.profile;
    expect(r.report.unlockedUnits).toEqual(['indutor']);
    expect(p.units).toContain('indutor');
  });

  it('quiz recompensa só o primeiro acerto', () => {
    const a = applyMatch(defaultProfile(), { stageId: '1-1', won: true, waves: 5, stats: stats() });
    const q1 = answerQuiz(a.profile, '1-1', true);
    expect(q1.ec).toBe(40);
    const q2 = answerQuiz(q1.profile, '1-1', true);
    expect(q2.ec).toBe(0);
  });

  it('evolução consome EC e respeita a ordem dos tiers', () => {
    const p = { ...defaultProfile(), ec: 1000 };
    const a = evolve(p, 'rele');
    expect(a.ok).toBe(true);
    expect(a.profile.tiers.rele).toBe(1);
    expect(a.profile.ec).toBe(880);
    const b = evolve(a.profile, 'rele');
    expect(b.profile.tiers.rele).toBe(2);
    expect(evolve(b.profile, 'rele').ok).toBe(false);
    expect(evolve(p, 'indutor').ok).toBe(false); // não desbloqueada
  });

  it('características dependem do nível do engenheiro', () => {
    const p = defaultProfile();
    expect(setTrait(p, 'rele', 'sobrecarga').traits.rele).toBeUndefined();
    const lv6 = { ...p, xp: xpForLevel(6) };
    expect(levelInfo(lv6.xp).level).toBe(6);
    expect(setTrait(lv6, 'rele', 'sobrecarga').traits.rele).toBe('sobrecarga');
  });

  it('dados corrompidos são saneados', () => {
    const p = sanitize({ units: ['xyz', 'indutor'], tiers: { rele: 7, bobina: 2 }, traits: { rele: 'magia' }, cp: -5, stages: { '1-1': { stars: 9 } } });
    expect(p.units).toEqual(expect.arrayContaining(['indutor', 'rele', 'bobina', 'fonte']));
    expect(p.units).not.toContain('xyz');
    expect(p.tiers).toEqual({ bobina: 2 });
    expect(p.traits).toEqual({});
    expect(p.ec).toBe(0);
    expect(p.stages['1-1'].stars).toBe(3);
    expect(sanitize('lixo')).toEqual(defaultProfile());
  });

  it('modo infinito registra recorde', () => {
    const { profile, report } = applyMatch(defaultProfile(), { stageId: 'E-placa', won: false, waves: 12, stats: stats() });
    expect(profile.stats.endlessBest).toBe(12);
    expect(report.endlessRecord).toBe(true);
    expect(report.ec).toBe(96);
  });
});
