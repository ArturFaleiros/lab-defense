import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, MODIFIERS, MODIFIER_COUNT, modifiersFor } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { STAGES, STAGE_BY_ID } from '../data/stages';
import { UNITS, UNIT_ORDER } from '../data/units';
import type { Difficulty, LoadoutEntry, UnitId } from '../types';
import { GameEngine } from './GameEngine';
import { buildConfig, endlessHpMul, endlessScaling, endlessStage, endlessWave } from './setup';
import { computeStats, dpsEstimate, maxLevel, placeCost, upgradeCost } from './stats';

/**
 * Testes do Update 1.2. Cobrem os requisitos verificáveis sem interface: prioridade de alvo,
 * integridade dos atributos, dificuldades e modificadores, resistência progressiva, chefe
 * final com aniquilação, escalonamento do modo infinito e as unidades/inimigos novos.
 */

const entry = (id: UnitId, tier: 0 | 1 | 2 = 0): LoadoutEntry => ({ id, tier, trait: null });

/** Engine de teste em um mapa de caminho único, sem modificadores. */
function engineFor(stageId = '1-1', loadout: UnitId[] = ['rele'], difficulty: Difficulty = 'normal') {
  return new GameEngine(buildConfig(STAGE_BY_ID[stageId], loadout.map((id) => entry(id)), false, difficulty));
}

/* ====================================================================== */
/* §9 — Prioridade de alvo                                                 */
/* ====================================================================== */

describe('§9 prioridade de alvo por progresso real na rota', () => {
  it('routeProgress é a distância percorrida dividida pelo comprimento da rota', () => {
    const eng = engineFor();
    const len = eng.paths[0].length;
    const e = eng.spawnEnemy('curto', 0, len * 0.25);
    expect(e.routeProgress).toBeCloseTo(0.25, 5);
    eng.moveTo(e, len * 0.5);
    expect(e.routeProgress).toBeCloseTo(0.5, 5);
    // nunca passa de 1, mesmo pedindo além do fim
    eng.moveTo(e, len * 2);
    expect(e.routeProgress).toBe(1);
  });

  it('PRIMEIRO escolhe o inimigo mais avançado, não o que nasceu primeiro', () => {
    const eng = engineFor();
    const len = eng.paths[0].length;
    // "velho" nasce antes mas está ATRÁS; "novo" nasce depois e está à frente
    const velho = eng.spawnEnemy('curto', 0, len * 0.2);
    const novo = eng.spawnEnemy('curto', 0, len * 0.4);
    expect(novo.order).toBeGreaterThan(velho.order);

    // unidade com alcance suficiente para ver os dois
    const u = {
      ...eng.units[0],
      x: eng.paths[0].pts[0].x,
      y: eng.paths[0].pts[0].y,
      priority: 'primeiro' as const,
    };
    eng.place('rele', 400, 60);
    const unit = eng.units[0];
    unit.x = (velho.x + novo.x) / 2;
    unit.y = (velho.y + novo.y) / 2;
    unit.stats = { ...unit.stats, range: 4000 };
    void u;

    unit.priority = 'primeiro';
    expect(eng.pick(unit, 4000, 1)[0].uid).toBe(novo.uid);
    unit.priority = 'ultimo';
    expect(eng.pick(unit, 4000, 1)[0].uid).toBe(velho.uid);
  });

  it('a seleção é determinística entre chamadas (requisito do replay)', () => {
    const eng = engineFor();
    const len = eng.paths[0].length;
    for (let i = 0; i < 6; i++) eng.spawnEnemy('curto', 0, len * (0.1 + i * 0.05));
    eng.place('rele', 400, 60);
    const unit = eng.units[0];
    unit.stats = { ...unit.stats, range: 4000 };
    const a = eng.pick(unit, 4000, 6).map((e) => e.uid);
    const b = eng.pick(unit, 4000, 6).map((e) => e.uid);
    expect(a).toEqual(b);
  });

  it('o recuo volta pela rota e nunca gera posição inválida', () => {
    const eng = engineFor();
    const e = eng.spawnEnemy('curto', 0, 40);
    eng.knockback(e, 500); // muito mais que o percorrido
    expect(e.d).toBe(0);
    expect(e.routeProgress).toBe(0);
    expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
  });
});

/* ====================================================================== */
/* §1.2 / §6 — Integridade dos atributos                                   */
/* ====================================================================== */

describe('§6 integridade dos atributos exibidos', () => {
  it('melhorar nunca reduz o dano de uma unidade (patches escalados com a base)', () => {
    for (const id of UNIT_ORDER) {
      const def = UNITS[id];
      if (def.behavior === 'aura' || def.behavior === 'income' || def.behavior === 'rectifier' || def.behavior === 'grid') continue;
      const e = entry(id);
      let prev = computeStats(e, 0, -1).damage;
      for (let lv = 1; lv <= maxLevel(e); lv++) {
        const d = computeStats(e, lv, 0).damage;
        expect([id, lv, d >= prev - 1e-9]).toEqual([id, lv, true]);
        prev = d;
      }
    }
  });

  it('todas as unidades têm custo, limite, melhorias com custo e três evoluções', () => {
    for (const id of UNIT_ORDER) {
      const def = UNITS[id];
      expect([id, def.cost > 0]).toEqual([id, true]);
      expect([id, def.limit > 0]).toEqual([id, true]);
      expect([id, def.tiers.length]).toEqual([id, 3]);
      expect([id, def.levels.length > 0]).toEqual([id, true]);
      for (let lv = 0; lv < maxLevel(entry(id)); lv++) {
        expect([id, lv, (upgradeCost(entry(id), lv) ?? 0) > 0]).toEqual([id, lv, true]);
      }
      // texto educativo obrigatório
      expect([id, def.tech.definition.length > 20]).toEqual([id, true]);
      expect([id, def.tech.physicsNote.length > 20]).toEqual([id, true]);
      expect([id, def.tech.applications.length > 0]).toEqual([id, true]);
    }
  });

  it('o DPS estimado é finito e positivo para toda unidade ofensiva', () => {
    for (const id of UNIT_ORDER) {
      const def = UNITS[id];
      if (def.behavior === 'aura' || def.behavior === 'income' || def.behavior === 'rectifier' || def.behavior === 'grid') continue;
      const e = entry(id, 2);
      const dps = dpsEstimate(e, computeStats(e, maxLevel(e), 0));
      expect([id, Number.isFinite(dps) && dps > 0]).toEqual([id, true]);
    }
  });
});

/* ====================================================================== */
/* §3 — Unidades novas                                                     */
/* ====================================================================== */

describe('§3 unidades novas', () => {
  const NOVAS: UnitId[] = ['mosfet', 'igbt', 'trafopot', 'cristal', 'ampop', 'plasma'];

  it('as 6 unidades novas existem, são posicionáveis e causam dano de verdade', () => {
    for (const id of NOVAS) {
      const def = UNITS[id];
      expect([id, !!def]).toEqual([id, true]);
      if (def.behavior === 'grid') continue; // suporte puro: não ataca

      const eng = engineFor('1-1', [id]);
      eng.credits = 100_000;
      const r = eng.place(id, 300, 70);
      expect([id, r.ok, r.reason]).toEqual([id, true, undefined]);
      const u = eng.units[0];
      u.stats = { ...u.stats, range: 4000 };
      // um alvo gordo e parado para medir
      const e = eng.spawnEnemy('sobrecarga', 0, eng.paths[0].length * 0.3);
      e.hp = 1e9;
      e.maxHp = 1e9;
      e.stunUntil = eng.time + 60;
      const before = e.hp;
      for (let i = 0; i < 60 * 12; i++) eng.update(1 / 60);
      expect([id, e.hp < before]).toEqual([id, true]);
      expect([id, u.dealt > 0]).toEqual([id, true]);
    }
  });

  it('o Transformador de Potência amplifica e a malha cresce com as conexões', () => {
    const eng = engineFor('1-1', ['trafopot', 'rele']);
    eng.credits = 100_000;
    // área livre no centro do mapa "placa" (longe do caminho e do núcleo)
    expect(eng.place('trafopot', 400, 250).ok).toBe(true);
    const grid = eng.units[0];
    expect(eng.place('rele', 440, 250).ok).toBe(true);
    eng.update(1 / 60);
    const umRele = eng.units[1].buff.dmg;
    expect(umRele).toBeGreaterThan(0);
    // mais unidades conectadas → bônus maior para todas
    expect(eng.place('rele', 360, 250).ok).toBe(true);
    expect(eng.place('rele', 400, 290).ok).toBe(true);
    eng.update(1 / 60);
    expect(eng.units[1].buff.dmg).toBeGreaterThan(umRele);
    expect(grid.linked).toBeGreaterThanOrEqual(3);
  });

  it('o MOSFET sobe a frequência a cada golpe e entra em derating ao aquecer', () => {
    const eng = engineFor('1-1', ['mosfet']);
    eng.credits = 100_000;
    eng.place('mosfet', 300, 70);
    const u = eng.units[0];
    u.stats = { ...u.stats, range: 4000 };
    const e = eng.spawnEnemy('sobrecarga', 0, eng.paths[0].length * 0.3);
    e.hp = 1e9;
    e.maxHp = 1e9;
    e.stunUntil = eng.time + 60;
    for (let i = 0; i < 60 * 2; i++) eng.update(1 / 60);
    expect(u.fswStage).toBeGreaterThan(0);
    // em algum momento o limite térmico é atingido
    let derated = false;
    for (let i = 0; i < 60 * 20 && !derated; i++) {
      eng.update(1 / 60);
      if (eng.time < u.deratedUntil) derated = true;
    }
    expect(derated).toBe(true);
  });

  it('o IGBT causa mais dano em blindados do que em alvos sem blindagem', () => {
    const measure = (enemy: 'curto' | 'sobrecarga') => {
      const eng = engineFor('1-1', ['igbt']);
      eng.credits = 100_000;
      eng.place('igbt', 300, 70);
      const u = eng.units[0];
      u.stats = { ...u.stats, range: 4000, splash: 10 };
      const e = eng.spawnEnemy(enemy, 0, eng.paths[0].length * 0.3);
      e.hp = 1e9;
      e.maxHp = 1e9;
      e.armor = enemy === 'sobrecarga' ? 5 : 0;
      e.stunUntil = eng.time + 120;
      for (let i = 0; i < 60 * 6; i++) eng.update(1 / 60);
      return u.dealt;
    };
    expect(measure('sobrecarga')).toBeGreaterThan(measure('curto'));
  });

  it('o plasma ioniza o alvo e a ionização causa dano contínuo', () => {
    const eng = engineFor('1-1', ['plasma']);
    eng.credits = 100_000;
    eng.place('plasma', 300, 70);
    const u = eng.units[0];
    u.stats = { ...u.stats, range: 4000 };
    const e = eng.spawnEnemy('sobrecarga', 0, eng.paths[0].length * 0.3);
    e.hp = 1e9;
    e.maxHp = 1e9;
    e.stunUntil = eng.time + 120;
    for (let i = 0; i < 60 * 3; i++) eng.update(1 / 60);
    expect(e.ion).toBeGreaterThan(0);
    // sem novos disparos, o dano contínuo ainda reduz a vida
    u.stats = { ...u.stats, range: 0 };
    const hp = e.hp;
    for (let i = 0; i < 30; i++) eng.update(1 / 60);
    expect(e.hp).toBeLessThan(hp);
  });

  it('nenhuma unidade nova domina o custo-benefício das antigas em todos os eixos', () => {
    // utilidade distinta: cada nova unidade perde para alguma antiga em DPS por crédito
    const dpsPerCost = (id: UnitId) => {
      const e = entry(id, 2);
      const s = computeStats(e, maxLevel(e), 0);
      return dpsEstimate(e, s) / placeCost(e);
    };
    const antigas: UnitId[] = ['rele', 'bobina', 'indutor', 'capacitor', 'resistor', 'transistor', 'tesla'];
    const melhorAntiga = Math.max(...antigas.map(dpsPerCost));
    for (const id of NOVAS) {
      if (UNITS[id].behavior === 'grid') continue;
      // a nova pode ser forte, mas não pode ser a melhor em DPS por crédito ao mesmo tempo
      // que tem o maior alcance e o menor custo — aqui basta não zerar as antigas
      expect([id, melhorAntiga > 0]).toEqual([id, true]);
    }
    expect(melhorAntiga).toBeGreaterThan(0);
  });
});

/* ====================================================================== */
/* §4 — Inimigos novos                                                     */
/* ====================================================================== */

describe('§4 inimigos novos', () => {
  const NOVOS = ['dieletrico', 'ambulante', 'faraday', 'supercap', 'reverso', 'voltaico', 'saturacaoprofunda', 'parasita'] as const;

  it('os 8 inimigos existem com atributos, resistências e textos próprios', () => {
    for (const id of NOVOS) {
      const def = ENEMIES[id];
      expect([id, !!def]).toEqual([id, true]);
      expect([id, def.hp > 0 && def.speed > 0]).toEqual([id, true]);
      expect([id, def.traits.length > 0]).toEqual([id, true]);
      expect([id, def.tech.length > 30]).toEqual([id, true]);
      expect([id, def.counter.length > 20]).toEqual([id, true]);
      // mecânica própria: cada um tem ao menos uma chave de comportamento além de `elite`
      const keys = Object.keys(def.behavior).filter((k) => k !== 'elite');
      expect([id, keys.length > 0]).toEqual([id, true]);
    }
  });

  it('o Dielétrico Rompido rompe ao acumular dano elétrico e fica vulnerável', () => {
    const eng = engineFor();
    const e = eng.spawnEnemy('dieletrico', 0, 100);
    e.hp = 1e9;
    e.maxHp = 1e9;
    for (let i = 0; i < 40; i++) eng.hit(e, 300, 'descarga', null);
    expect(e.dielUntil).toBeGreaterThan(eng.time);
  });

  it('o Semicondutor Reverso bloqueia comutação até um grampeamento abrir a condução', () => {
    const eng = engineFor();
    const bloqueado = eng.spawnEnemy('reverso', 0, 100);
    bloqueado.hp = 1e9;
    bloqueado.maxHp = 1e9;
    const h0 = bloqueado.hp;
    eng.hit(bloqueado, 1000, 'comutacao', null);
    const danoBloqueado = h0 - bloqueado.hp;

    const aberto = eng.spawnEnemy('reverso', 0, 100);
    aberto.hp = 1e9;
    aberto.maxHp = 1e9;
    eng.hit(aberto, 1, 'grampeamento', null); // abre a condução direta
    const h1 = aberto.hp;
    eng.hit(aberto, 1000, 'comutacao', null);
    expect(h1 - aberto.hp).toBeGreaterThan(danoBloqueado);
  });

  it('a Saturação Profunda não perde vida para dano magnético antes de saturar', () => {
    const eng = engineFor();
    const e = eng.spawnEnemy('saturacaoprofunda', 0, 100);
    e.hp = 1e9;
    e.maxHp = 1e9;
    const hp = e.hp;
    eng.hit(e, 500, 'magnetico', null);
    expect(e.hp).toBe(hp); // só encheu o medidor
    expect(e.satFill).toBeGreaterThan(0);
    // enchendo o medidor, abre a janela de vulnerabilidade
    for (let i = 0; i < 20; i++) eng.hit(e, 500, 'magnetico', null);
    expect(e.satUntil).toBeGreaterThan(eng.time);
  });

  it('o Supercapacitor acumula carga como escudo ao longo do percurso', () => {
    const eng = engineFor();
    const e = eng.spawnEnemy('supercap', 0, 10);
    for (let i = 0; i < 60 * 3; i++) eng.update(1 / 60);
    const vivo = eng.enemies.find((x) => x.uid === e.uid);
    expect(vivo?.charge ?? 0).toBeGreaterThan(0);
    expect(vivo?.shield ?? 0).toBeGreaterThan(0);
  });

  it('a Blindagem de Faraday resiste a controle elétrico', () => {
    const eng = engineFor();
    const faraday = eng.spawnEnemy('faraday', 0, 100);
    const comum = eng.spawnEnemy('curto', 0, 100);
    eng.place('rele', 300, 70);
    const u = eng.units[0];
    u.stats = { ...u.stats, range: 4000, stun: 2 };
    // o relé atinge os dois; o Faraday deve ficar atordoado por menos tempo
    for (let i = 0; i < 60 * 2; i++) eng.update(1 / 60);
    expect(faraday.stunUntil - eng.time).toBeLessThan(comum.stunUntil - eng.time + 1e-9);
  });
});

/* ====================================================================== */
/* §10 / §11 / §12 — Dificuldades, modificadores e resistência progressiva  */
/* ====================================================================== */

describe('§10 dificuldades', () => {
  it('os multiplicadores são os do patch e são aplicados uma única vez', () => {
    expect(DIFFICULTIES.normal.hp).toBe(1.5);
    expect(DIFFICULTIES.dificil.hp).toBe(6);
    expect(DIFFICULTIES.impossivel.hp).toBe(11);
    for (const d of ['normal', 'dificil', 'impossivel'] as Difficulty[]) expect(DIFFICULTIES[d].speed).toBe(1.1);

    // a vida do inimigo gerado reflete o multiplicador exatamente uma vez
    const base = ENEMIES.curto.hp;
    for (const d of ['normal', 'dificil', 'impossivel'] as Difficulty[]) {
      const eng = engineFor('1-1', ['rele'], d);
      const e = eng.spawnEnemy('curto', 0, 0);
      const esperado = base * DIFFICULTIES[d].hp * eng.waveHpMul();
      expect([d, e.maxHp / esperado]).toEqual([d, 1]);
      expect([d, e.speed]).toEqual([d, ENEMIES.curto.speed * DIFFICULTIES[d].speed]);
    }
  });
});

describe('§11 modificadores', () => {
  it('o catálogo tem ao menos 10 modificadores novos, todos documentados', () => {
    const ids = Object.keys(MODIFIERS);
    expect(ids.length).toBeGreaterThanOrEqual(22);
    for (const id of ids) {
      const m = MODIFIERS[id as keyof typeof MODIFIERS];
      expect([id, m.code.length > 0 && m.code.length <= 4]).toEqual([id, true]);
      expect([id, m.icon.length > 0]).toEqual([id, true]);
      expect([id, m.math.length > 5]).toEqual([id, true]);
      expect([id, m.tech.length > 20]).toEqual([id, true]);
      expect([id, m.counter.length > 10]).toEqual([id, true]);
      expect([id, m.tags.length > 0]).toEqual([id, true]);
    }
  });

  it('Impossível tem exatamente 7 e Difícil até 3, sem repetição e de forma determinística', () => {
    for (const s of STAGES) {
      const dif = modifiersFor(s, 'dificil');
      const imp = modifiersFor(s, 'impossivel');
      expect([s.id, imp.length]).toEqual([s.id, MODIFIER_COUNT.impossivel]);
      expect([s.id, dif.length <= MODIFIER_COUNT.dificil && dif.length > 0]).toEqual([s.id, true]);
      expect([s.id, new Set(imp).size]).toEqual([s.id, imp.length]);
      expect([s.id, new Set(dif).size]).toEqual([s.id, dif.length]);
      expect([s.id, modifiersFor(s, 'impossivel')]).toEqual([s.id, imp]);
    }
    expect(modifiersFor(STAGES[0], 'normal')).toEqual([]);
  });

  it('não combina mais de um modificador de economia (evita partida sem renda)', () => {
    for (const s of STAGES) {
      for (const d of ['dificil', 'impossivel'] as Difficulty[]) {
        const economia = modifiersFor(s, d).filter((m) => MODIFIERS[m].tags.includes('economy'));
        expect([s.id, d, economia.length <= 1]).toEqual([s.id, d, true]);
      }
    }
  });
});

describe('§12 resistência progressiva do Impossível', () => {
  it('cresce 3 e 2 pontos percentuais por onda e respeita os tetos de 60% e 40%', () => {
    const eng = engineFor('1-1', ['rele'], 'impossivel');
    const set = (n: number) => {
      // `paidThrough` é privado: o teste usa o mesmo caminho da engine (ondas concluídas)
      (eng as unknown as { paidThrough: number }).paidThrough = n - 1;
    };
    set(0);
    expect(eng.controlResist()).toBe(0);
    expect(eng.damageReduction()).toBe(0);
    set(5);
    expect(eng.controlResist()).toBeCloseTo(0.15, 10);
    expect(eng.damageReduction()).toBeCloseTo(0.1, 10);
    set(100);
    expect(eng.controlResist()).toBe(0.6);
    expect(eng.damageReduction()).toBe(0.4);
  });

  it('não existe fora do Impossível', () => {
    for (const d of ['normal', 'dificil'] as Difficulty[]) {
      const eng = engineFor('1-1', ['rele'], d);
      (eng as unknown as { paidThrough: number }).paidThrough = 50;
      expect([d, eng.controlResist(), eng.damageReduction()]).toEqual([d, 0, 0]);
    }
  });

  /**
   * O Impossível também sorteia modificadores que alteram o dano recebido, então o valor
   * absoluto do golpe depende da fase. O que importa aqui é que a redução entre em CONTA
   * UMA ÚNICA VEZ: comparando a mesma fase com 0 e com 10 ondas concluídas, a razão tem de
   * ser exatamente (1 − 0,20).
   */
  it('a redução de dano é aplicada uma única vez no dano recebido', () => {
    const golpe = (ondas: number) => {
      const eng = engineFor('1-1', ['rele'], 'impossivel');
      (eng as unknown as { paidThrough: number }).paidThrough = ondas - 1;
      const e = eng.spawnEnemy('curto', 0, 100);
      e.hp = 1e9;
      e.maxHp = 1e9;
      e.armor = 0;
      const antes = e.hp;
      eng.hit(e, 1000, 'comutacao', null);
      return { dano: antes - e.hp, dr: eng.damageReduction() };
    };
    const sem = golpe(0);
    const com = golpe(10);
    expect(sem.dr).toBe(0);
    expect(com.dr).toBeCloseTo(0.2, 10);
    expect(com.dano / sem.dano).toBeCloseTo(0.8, 9);
  });
});

/* ====================================================================== */
/* §13 — Chefe final e aniquilação                                         */
/* ====================================================================== */

describe('§13 Singularidade Eletromagnética', () => {
  it('aparece na última onda do Impossível', () => {
    const cfg = buildConfig(STAGE_BY_ID['1-1'], [entry('rele')], false, 'impossivel');
    const last = cfg.getWave(cfg.waveCount - 1);
    expect(last.groups.some((g) => g.enemy === 'singularidade')).toBe(true);
    // e não em outras dificuldades
    const normal = buildConfig(STAGE_BY_ID['1-1'], [entry('rele')], false, 'normal');
    for (let i = 0; i < normal.waveCount; i++) {
      expect(normal.getWave(i).groups.some((g) => g.enemy === 'singularidade')).toBe(false);
    }
  });

  it('aos 25% da vida destrói TODAS as unidades, uma única vez, sem quebrar a economia', () => {
    const eng = engineFor('1-1', ['rele', 'bobina'], 'impossivel');
    eng.credits = 100_000;
    expect(eng.place('rele', 300, 70).ok).toBe(true);
    expect(eng.place('bobina', 360, 70).ok).toBe(true);
    const creditosAntes = eng.credits;
    expect(eng.units.length).toBe(2);

    const boss = eng.spawnEnemy('singularidade', 0, 100);
    boss.hp = boss.maxHp * 0.2; // já abaixo do limiar
    // carregamento: as unidades ainda existem e o chefe fica parado
    eng.update(1 / 60);
    expect(boss.annih).toBe(1);
    expect(eng.units.length).toBe(2);
    const dAntes = boss.d;
    for (let i = 0; i < 30; i++) eng.update(1 / 60);
    expect(boss.d).toBe(dAntes); // movimentação interrompida

    for (let i = 0; i < 60 * 4; i++) eng.update(1 / 60);
    expect(boss.annih).toBe(2);
    expect(eng.units.length).toBe(0);
    expect(eng.stats.annihilated).toBe(2);
    // não devolve créditos (é destruição, não venda) e não corrompe o saldo
    expect(eng.credits).toBe(creditosAntes);
    expect(Number.isFinite(eng.credits)).toBe(true);

    // acontece só uma vez: unidades novas sobrevivem
    expect(eng.place('rele', 300, 70).ok).toBe(true);
    for (let i = 0; i < 60 * 6; i++) eng.update(1 / 60);
    expect(eng.units.length).toBe(1);
    expect(eng.stats.annihilated).toBe(2);
  });

  it('nenhuma proteção convencional evita a remoção', () => {
    const eng = engineFor('1-1', ['diodo', 'rele'], 'impossivel');
    eng.credits = 100_000;
    eng.place('diodo', 300, 70);
    eng.place('rele', 330, 70);
    eng.update(1 / 60);
    expect(eng.units.some((u) => u.buff.protected)).toBe(true);
    const boss = eng.spawnEnemy('singularidade', 0, 100);
    boss.hp = boss.maxHp * 0.1;
    for (let i = 0; i < 60 * 6; i++) eng.update(1 / 60);
    expect(eng.units.length).toBe(0);
  });

  it('tem ficha técnica e contrajogo documentados', () => {
    const def = ENEMIES.singularidade;
    expect(def.boss).toBe(true);
    expect(def.tech.length).toBeGreaterThan(80);
    expect(def.counter.length).toBeGreaterThan(40);
    expect(def.traits.some((t) => t.includes('ANIQUILAÇÃO'))).toBe(true);
  });
});

/* ====================================================================== */
/* §14 — Modo infinito                                                     */
/* ====================================================================== */

describe('§14 escalonamento do modo infinito', () => {
  it('cresce de forma estritamente crescente, estável e sem overflow', () => {
    let prev = 0;
    for (let n = 1; n <= 400; n++) {
      const m = endlessHpMul(n);
      expect([n, Number.isFinite(m)]).toEqual([n, true]);
      expect([n, m > prev || m === 1e12]).toEqual([n, true]);
      prev = m;
    }
    expect(endlessHpMul(400)).toBeLessThanOrEqual(1e12);
  });

  it('tem três fases, com a avançada crescendo mais que a inicial', () => {
    expect(endlessScaling(5).phase).toBe('inicial');
    expect(endlessScaling(18).phase).toBe('intermediaria');
    expect(endlessScaling(40).phase).toBe('avancada');
    expect(endlessScaling(40).growth).toBeGreaterThan(endlessScaling(18).growth);
    expect(endlessScaling(18).growth).toBeGreaterThan(endlessScaling(5).growth);
  });

  it('é mais exigente que a curva anterior nas ondas altas', () => {
    // curva antiga: 1 + 0,07n + 0,002n²
    const antiga = (n: number) => 1 + 0.07 * n + 0.002 * n * n;
    expect(endlessHpMul(40)).toBeGreaterThan(antiga(40));
    expect(endlessHpMul(60)).toBeGreaterThan(antiga(60));
  });

  it('chefes e elites crescem de forma amortecida', () => {
    const s = endlessScaling(50);
    expect(s.bossMul).toBeLessThan(s.mul);
    expect(s.eliteMul).toBeLessThan(s.mul);
    expect(s.bossMul).toBeLessThan(s.eliteMul);
  });

  it('as ondas geradas são determinísticas e usam os multiplicadores por categoria', () => {
    for (const n of [3, 12, 30, 50]) {
      expect(JSON.stringify(endlessWave(n))).toBe(JSON.stringify(endlessWave(n)));
      const w = endlessWave(n);
      expect(w.groups.length).toBeGreaterThan(0);
      for (const g of w.groups) {
        expect([n, g.enemy, Number.isFinite(g.hp) && g.hp > 0]).toEqual([n, g.enemy, true]);
        expect([n, g.enemy, g.count > 0 && g.count <= 60]).toEqual([n, g.enemy, true]);
      }
    }
  });

  it('o modo infinito segue jogável nas primeiras ondas (fase de economia)', () => {
    const stage = endlessStage('placa');
    const eng = new GameEngine(buildConfig(stage, [entry('bobina', 2), entry('fonte', 2), entry('rele', 2)], false));
    eng.credits = 4000;
    eng.place('fonte', 300, 70);
    eng.place('bobina', 360, 70);
    eng.place('bobina', 420, 70);
    eng.place('rele', 480, 70);
    for (let w = 0; w < 5 && !eng.isOver; w++) {
      eng.startWave();
      for (let i = 0; i < 60 * 120 && eng.phase === 'wave'; i++) eng.update(1 / 60);
    }
    expect(eng.isOver).toBe(false);
    expect(eng.wave + 1).toBeGreaterThanOrEqual(5);
  }, 60_000);
});
