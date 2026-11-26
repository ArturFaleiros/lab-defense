import { describe, expect, it } from 'vitest';
import { STAGE_BY_ID } from '../data/stages';
import { EXPERT_PRESETS, runBot } from './bot';
import { GameEngine } from './GameEngine';
import { COMMANDS, attachRecorder, matchRng, replayMatch, validateLog, type LogEntry } from './replay';
import { buildConfig, endlessStage } from './setup';

function play(stageId: string | null, difficulty: 'normal' | 'impossivel', seed: number, cheat = false) {
  const stage = stageId ? STAGE_BY_ID[stageId] : endlessStage('placa');
  const preset = EXPERT_PRESETS[0];
  const ids = [...new Set(preset.order)].filter((u) => !stage.allowed || stage.allowed.includes(u)).slice(0, 5);
  const entries = ids.map((id) => ({ id, tier: 2 as const, trait: null }));
  const cfg = () => buildConfig(stage, entries, false, difficulty, matchRng(seed));
  const eng = new GameEngine(cfg());
  const log = attachRecorder(eng);
  if (cheat) {
    // trapaça típica pelo console: créditos e vidas infinitos
    const upd = eng.update.bind(eng);
    eng.update = (dt: number) => {
      eng.credits = 999_999;
      eng.lives = 999;
      upd(dt);
    };
  }
  const base = preset.order.filter((u) => ids.includes(u));
  runBot(eng, { order: [...base, ...base, ...base], upgrades: true, maxUnits: 28, abilities: true }, stageId ? 6000 : 400);
  return { eng, log, cfg };
}

describe('replay determinístico', () => {
  it('reproduz exatamente uma partida da campanha', () => {
    const { eng, log, cfg } = play('1-1', 'normal', 42);
    expect(validateLog(log)).toBeNull();
    const r = replayMatch(cfg(), false, log, eng.steps + 10).engine;
    expect(r.phase).toBe(eng.phase);
    expect(r.wave).toBe(eng.wave);
    expect(r.stats.kills).toBe(eng.stats.kills);
    expect(r.credits).toBe(eng.credits);
    expect(r.lives).toBe(eng.lives);
    expect(r.steps).toBe(eng.steps);
  });

  it('reproduz o modo infinito, inclusive as cápsulas sorteadas', () => {
    const { eng, log, cfg } = play(null, 'normal', 7);
    const r = replayMatch(cfg(), false, log, eng.steps).engine;
    expect(r.wave).toBe(eng.wave);
    expect(r.stats.capsules).toEqual(eng.stats.capsules);
  });

  it('trapaça pelo console não sobrevive ao replay', () => {
    const { eng, log, cfg } = play('1-1', 'normal', 99, true);
    const r = replayMatch(cfg(), false, log, eng.steps + 10).engine;
    expect(eng.credits).toBeGreaterThan(900_000);
    expect(r.credits).toBeLessThan(900_000);
  });

  it('rejeita logs malformados', () => {
    const place = COMMANDS.indexOf('place');
    expect(validateLog('x')).not.toBeNull();
    expect(validateLog([[5, place, 'rele', 1, 2], [3, 0]] as LogEntry[])).not.toBeNull(); // passos fora de ordem
    expect(validateLog([[0, place, 'naoexiste', 1, 2]])).not.toBeNull();
    expect(validateLog([[0, 99]])).not.toBeNull();
    expect(validateLog([[0, place, 'rele', Infinity, 2]])).not.toBeNull();
    expect(validateLog([[0, place, 'rele', 100, 200]])).toBeNull();
  });
});
