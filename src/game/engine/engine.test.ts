import { describe, expect, it } from 'vitest';
import { parseWave, STAGE_BY_ID, STAGES, type StageDef } from '../data/stages';
import { UNITS } from '../data/units';
import type { LoadoutEntry, UnitId } from '../types';
import { GameEngine } from './GameEngine';
import { buildConfig, endlessWave } from './setup';
import { computeStats, placeCost, upgradeCost } from './stats';

const entry = (id: UnitId, extra: Partial<LoadoutEntry> = {}): LoadoutEntry => ({ id, tier: 0, trait: null, ...extra });

function stage(over: Partial<StageDef> = {}): StageDef {
  return { ...STAGE_BY_ID['1-1'], waves: [parseWave('curto*1')], ...over };
}

function engine(over: Partial<StageDef> = {}, loadout: LoadoutEntry[] = [entry('rele'), entry('bobina'), entry('fonte'), entry('indutor'), entry('rl')]) {
  return new GameEngine(buildConfig(stage(over), loadout, false));
}

const run = (eng: GameEngine, seconds: number) => {
  for (let i = 0; i < seconds * 60 && !eng.isOver; i++) eng.update(1 / 60);
};

/** Ponto livre próximo ao primeiro trecho do mapa 'placa' (trecho y = 90). */
const SPOT = { x: 150, y: 150 };

describe('dados', () => {
  it('todas as ondas usam inimigos válidos e as fases referenciam fases existentes', () => {
    for (const s of STAGES) {
      expect(s.waves.length).toBeGreaterThan(0);
      if (s.requires) expect(STAGE_BY_ID[s.requires]).toBeDefined();
    }
  });
  it('notação de onda', () => {
    const w = parseWave('curto*12/0.9@3#1~1.5, surto*4');
    expect(w.groups[0]).toEqual({ enemy: 'curto', count: 12, gap: 0.9, at: 3, path: 1, hp: 1.5 });
    expect(w.groups[1]).toMatchObject({ enemy: 'surto', count: 4, gap: 1, at: 0, path: null });
    expect(() => parseWave('fantasma*3')).toThrow();
  });
  it('τ do circuito RL é sempre L/R', () => {
    for (let lv = 0; lv <= UNITS.rl.levels.length; lv++) {
      const s = computeStats(entry('rl'), lv, -1);
      expect(s.tau).toBeCloseTo(s.inductance / s.resistance, 10);
    }
  });
  it('reduzir R no RL aumenta a corrente final e a constante de tempo', () => {
    const a = computeStats(entry('rl'), 0, -1);
    const b = computeStats(entry('rl'), 1, -1);
    expect(b.resistance).toBeLessThan(a.resistance);
    expect(b.damage / b.resistance).toBeGreaterThan(a.damage / a.resistance);
    expect(b.tau).toBeGreaterThan(a.tau);
  });
  it('modo infinito é determinístico e cresce', () => {
    expect(endlessWave(7)).toEqual(endlessWave(7));
    const hp = (n: number) => endlessWave(n).groups.reduce((s, g) => s + g.count * g.hp, 0);
    expect(hp(20)).toBeGreaterThan(hp(5));
    expect(endlessWave(10).groups.some((g) => g.enemy === 'arco')).toBe(true);
  });
});

describe('posicionamento e economia', () => {
  it('desconta créditos ao posicionar e respeita áreas proibidas', () => {
    const eng = engine();
    const c0 = eng.credits;
    expect(eng.canPlace('rele', 100, 90).ok).toBe(false); // sobre o caminho
    expect(eng.place('rele', SPOT.x, SPOT.y).ok).toBe(true);
    expect(eng.credits).toBe(c0 - placeCost(entry('rele')));
    expect(eng.canPlace('bobina', SPOT.x + 10, SPOT.y).reason).toBe('Sobre outra unidade');
    expect(eng.canPlace('bobina', 5, 5).ok).toBe(false);
  });
  it('não posiciona sem créditos nem acima do limite', () => {
    const eng = engine({ startCredits: 150 });
    expect(eng.canPlace('rele', SPOT.x, SPOT.y).reason).toBe('Créditos insuficientes');
    const rich = engine({ startCredits: 99999 });
    for (let i = 0; i < UNITS.fonte.limit; i++) expect(rich.place('fonte', 600 + i * 50, 300).ok).toBe(true);
    expect(rich.canPlace('fonte', 600, 360).reason).toMatch(/Limite/);
  });
  it('unidade fora da equipe não pode ser posicionada', () => {
    const eng = engine({}, [entry('rele')]);
    expect(eng.canPlace('bobina', SPOT.x, SPOT.y).ok).toBe(false);
  });
  it('melhoria altera atributos e custa o valor definido', () => {
    const eng = engine({ startCredits: 2000 });
    eng.place('bobina', SPOT.x, SPOT.y);
    const u = eng.units[0];
    const before = u.stats.damage;
    const c = eng.credits;
    expect(eng.upgrade(u.uid).ok).toBe(true);
    expect(u.stats.damage).toBeGreaterThan(before);
    expect(eng.credits).toBe(c - upgradeCost(entry('bobina'), 0)!);
  });
  it('melhoria sem créditos é recusada', () => {
    const eng = engine({ startCredits: 300 });
    eng.place('bobina', SPOT.x, SPOT.y);
    expect(eng.upgrade(eng.units[0].uid).reason).toBe('Créditos insuficientes');
    expect(eng.units[0].level).toBe(0);
  });
  it('ramo do transformador é obrigatório no nível 2', () => {
    const eng = engine({ startCredits: 5000 }, [entry('transformador')]);
    eng.place('transformador', SPOT.x, SPOT.y);
    const u = eng.units[0];
    eng.upgrade(u.uid);
    expect(eng.upgrade(u.uid).reason).toBe('Escolha um ramo');
    expect(eng.upgrade(u.uid, 1).ok).toBe(true);
    expect(u.branch).toBe(1);
    expect(u.stats.auraSpeed).toBeGreaterThan(0.2);
  });
  it('venda devolve 60% do investido e remove a unidade', () => {
    const eng = engine({ startCredits: 2000 });
    eng.place('bobina', SPOT.x, SPOT.y);
    const u = eng.units[0];
    eng.upgrade(u.uid);
    const spent = u.spent;
    const c = eng.credits;
    eng.sell(u.uid);
    expect(eng.units.length).toBe(0);
    expect(eng.credits).toBe(c + Math.round(spent * 0.6));
    expect(eng.stats.sold).toBe(1);
  });
  it('característica Alta eficiência reduz custos', () => {
    expect(placeCost(entry('bobina', { trait: 'eficiencia' }))).toBeLessThan(placeCost(entry('bobina')));
  });
});

describe('combate', () => {
  it('inimigos percorrem o caminho e reduzem as vidas ao alcançar o núcleo', () => {
    const eng = engine({ waves: [parseWave('curto*1')] });
    eng.startWave();
    run(eng, 1);
    const e = eng.enemies[0];
    const d0 = e.d;
    run(eng, 1);
    expect(e.d).toBeGreaterThan(d0);
    run(eng, 60);
    expect(eng.lives).toBe(eng.maxLives - 1);
  });
  it('unidades respeitam o alcance', () => {
    const eng = engine({ startCredits: 2000 });
    eng.place('rele', 600, 520); // longe de todo o caminho inicial
    const u = eng.units[0];
    const e = eng.spawnEnemy('curto', 0, 10);
    run(eng, 2);
    expect(e.hp).toBe(e.maxHp);
    expect(u.dealt).toBe(0);
    // dentro do alcance
    const eng2 = engine({ startCredits: 2000 });
    eng2.place('rele', SPOT.x, 140);
    const e2 = eng2.spawnEnemy('curto', 0, 180);
    run(eng2, 1);
    expect(e2.hp).toBeLessThan(e2.maxHp);
  });
  it('blindagem reduz golpes fracos, mas nunca abaixo de 30%', () => {
    const eng = engine();
    const e = eng.spawnEnemy('sobrecarga', 0, 100);
    const hp = e.hp;
    eng.hit(e, 6, 'comutacao', null);
    expect(hp - e.hp).toBeCloseTo(Math.max(6 * 0.3, 6 - e.armor));
  });
  it('resistências por tipo de dano', () => {
    const eng = engine();
    const a = eng.spawnEnemy('surto', 0, 100);
    const b = eng.spawnEnemy('surto', 0, 120);
    eng.hit(a, 10, 'grampeamento', null);
    eng.hit(b, 10, 'comutacao', null);
    expect(a.maxHp - a.hp).toBeCloseTo(20);
    expect(b.maxHp - b.hp).toBeCloseTo(10);
  });
  it('indutor: corrente sobe como 1 − e^(−t/τ)', () => {
    const eng = engine({ startCredits: 2000 });
    eng.place('indutor', 300, 160);
    const u = eng.units[0];
    const boss = eng.spawnEnemy('sobrecarga', 0, 290, 50);
    boss.armor = 0;
    run(eng, 0.1);
    const t0 = eng.time;
    const tau = u.stats.tau;
    run(eng, tau);
    // após ~1τ a corrente normalizada está perto de 63%
    expect(u.ramp).toBeGreaterThan(0.55);
    expect(u.ramp).toBeLessThan(0.72);
    expect(eng.time - t0).toBeCloseTo(tau, 1);
  });
  it('circuito RL: dano cresce com o tempo de permanência na zona', () => {
    const eng = engine({ startCredits: 2000 });
    eng.place('rl', 300, 160);
    const e = eng.spawnEnemy('sobrecarga', 0, 300, 50);
    e.armor = 0;
    run(eng, 0.5);
    const early = e.maxHp - e.hp;
    run(eng, 0.5);
    const mid = e.maxHp - e.hp - early;
    expect(mid).toBeGreaterThan(early);
  });
  it('interferência desativa unidades sem proteção; diodo protege', () => {
    const eng = engine({ startCredits: 5000 }, [entry('rele'), entry('diodo')]);
    eng.place('rele', 300, 160);
    eng.place('rele', 680, 230);
    eng.place('diodo', 630, 230);
    const [free, guarded] = eng.units;
    const e1 = eng.spawnEnemy('interferencia', 0, 290);
    e1.tA = 5.99;
    run(eng, 0.05);
    expect(eng.time < free.stunUntil).toBe(true);
    const e2 = eng.spawnEnemy('interferencia', 0, 0);
    // posiciona a interferência perto da unidade protegida (só para o teste)
    e2.x = 680;
    e2.y = 210;
    e2.tA = 5.99;
    eng.update(1 / 60);
    expect(guarded.buff.protected).toBe(true);
    expect(eng.time < guarded.stunUntil).toBe(false);
  });
});

describe('ondas, vitória e derrota', () => {
  it('vitória após a última onda com todos os inimigos eliminados', () => {
    const eng = engine({ startCredits: 5000, waves: [parseWave('curto*2/0.5'), parseWave('curto*2/0.5')] });
    eng.place('bobina', 190, 160);
    eng.place('rele', 330, 160);
    eng.place('indutor', 190, 220);
    eng.startWave();
    run(eng, 60);
    expect(eng.phase).toBe('prep');
    expect(eng.wave).toBe(0);
    // 1.1: a dificuldade Normal estende a fase para 12 ondas
    while (eng.phase === 'prep') {
      eng.startWave();
      run(eng, 60);
    }
    expect(eng.wave + 1).toBe(eng.totalWaves);
    expect(eng.phase).toBe('won');
  });
  it('derrota quando as vidas chegam a zero', () => {
    const eng = engine({ lives: 3, waves: [parseWave('curto*5/0.3')] });
    eng.startWave();
    run(eng, 120);
    expect(eng.phase).toBe('lost');
    expect(eng.lives).toBe(0);
  });
  it('bônus de onda é pago ao concluir a onda', () => {
    const eng = engine({ lives: 20, waves: [parseWave('curto*1'), parseWave('curto*1')] });
    eng.startWave();
    const c = eng.credits;
    run(eng, 60);
    expect(eng.credits).toBe(c + eng.waveBonus(1));
  });
  it('antecipar onda paga o bônus atual com acréscimo', () => {
    const eng = engine({ waves: [parseWave('curto*1'), parseWave('curto*1')] });
    eng.startWave();
    run(eng, 1);
    const c = eng.credits;
    expect(eng.canCallWave).toBe(true);
    eng.startWave();
    expect(eng.credits).toBe(c + eng.waveBonus(1) + Math.round(eng.waveBonus(1) * 0.25));
    expect(eng.wave).toBe(1);
  });
  it('fonte DC só gera durante as ondas', () => {
    const eng = engine({ startCredits: 2000, waves: [parseWave('curto*1@20')] });
    eng.place('fonte', 600, 300);
    const c = eng.credits;
    run(eng, 20);
    expect(eng.credits).toBe(c);
    eng.startWave();
    run(eng, 9);
    expect(eng.credits).toBeGreaterThan(c);
  });
  it('partida pausada não avança', () => {
    const eng = engine();
    eng.startWave();
    eng.setPaused(true);
    eng.tick(0.5);
    expect(eng.time).toBe(0);
    eng.setPaused(false);
    eng.tick(0.05);
    expect(eng.time).toBeGreaterThan(0);
  });
});
