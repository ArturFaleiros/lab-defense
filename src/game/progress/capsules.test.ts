import { describe, expect, it } from 'vitest';
import { rng } from '../engine/geometry';
import {
  CAPSULE_CHANCE,
  CAPSULE_TABLE,
  PITY_LIMIT,
  pickInt,
  pityRemaining,
  resolveCapsule,
  rollCapsule,
  SECRET_DUPLICATE_EC,
  SECRET_UNITS,
  type CapsuleRoll,
} from './capsules';
import { defaultProfile, grantCapsule, levelInfo, ownedSecrets, sanitize, type Profile } from './profile';

/**
 * §15.5 — testes obrigatórios das cápsulas: distribuição das quatro categorias, limites de
 * EC e XP, a chance de 5%, a garantia na 50ª abertura, a reinicialização do contador, a
 * persistência, a prevenção de duplicidade e a integridade das transações.
 */

const roll = (r1: number, r2: number, milestone = 5): CapsuleRoll => ({ milestone, got: true, r1, r2 });

describe('§15 tabela oficial', () => {
  it('as quatro categorias somam exatamente 100%', () => {
    const total = CAPSULE_TABLE.reduce((s, r) => s + r.p, 0);
    expect(total).toBeCloseTo(1, 12);
    expect(CAPSULE_TABLE.length).toBe(4);
  });

  it('as probabilidades e faixas são as do patch', () => {
    expect(CAPSULE_TABLE.map((r) => [r.kind, r.p, r.min, r.max])).toEqual([
      ['ec', 0.5, 50, 70],
      ['ecPlus', 0.3, 70, 100],
      ['xp', 0.15, 50, 100],
      ['secret', 0.05, 0, 0],
    ]);
  });

  it('cada cápsula concede exatamente uma recompensa', () => {
    for (let i = 0; i < 2000; i++) {
      const r = resolveCapsule(roll(i / 2000, (i * 7919) % 1000 / 1000), 0, SECRET_UNITS);
      // com todas as secretas no inventário, a de 5% vira energia — nunca duas recompensas
      const c = r.content;
      const campos = [c.kind === 'ec' || c.kind === 'ecPlus' || c.kind === 'secretDuplicate' ? 1 : 0, c.kind === 'xp' ? 1 : 0, c.kind === 'secret' ? 1 : 0];
      expect(campos.reduce((a, b) => a + b, 0)).toBe(1);
    }
  });
});

describe('§15.5 distribuição em grande quantidade de aberturas', () => {
  it('as frequências observadas batem com 50/30/15/5 (200 mil aberturas)', () => {
    const rand = rng(20251126);
    const N = 200_000;
    const freq: Record<string, number> = { ec: 0, ecPlus: 0, xp: 0, secret: 0 };
    for (let i = 0; i < N; i++) {
      // pity 0 e inventário incompleto não interferem: a garantia só age na 50ª
      const r = resolveCapsule(roll(rand(), rand()), 0, []);
      const k = r.content.kind === 'secretDuplicate' ? 'secret' : r.content.kind;
      freq[k]++;
    }
    // tolerância de 0,6 ponto percentual (muito acima do erro estatístico para N = 200 mil)
    expect(freq.ec / N).toBeCloseTo(0.5, 2);
    expect(freq.ecPlus / N).toBeCloseTo(0.3, 2);
    expect(freq.xp / N).toBeCloseTo(0.15, 2);
    expect(Math.abs(freq.secret / N - 0.05)).toBeLessThan(0.006);
  });

  it('os valores de EC e XP respeitam os limites mínimos e máximos', () => {
    const rand = rng(777);
    let minEc = Infinity;
    let maxEc = -Infinity;
    let minXp = Infinity;
    let maxXp = -Infinity;
    for (let i = 0; i < 100_000; i++) {
      const r = resolveCapsule(roll(rand(), rand()), 0, []);
      const c = r.content;
      if (c.kind === 'ec') {
        minEc = Math.min(minEc, c.amount);
        maxEc = Math.max(maxEc, c.amount);
        expect(c.amount).toBeGreaterThanOrEqual(50);
        expect(c.amount).toBeLessThanOrEqual(70);
        expect(Number.isInteger(c.amount)).toBe(true);
      }
      if (c.kind === 'ecPlus') {
        expect(c.amount).toBeGreaterThanOrEqual(70);
        expect(c.amount).toBeLessThanOrEqual(100);
        expect(Number.isInteger(c.amount)).toBe(true);
      }
      if (c.kind === 'xp') {
        minXp = Math.min(minXp, c.amount);
        maxXp = Math.max(maxXp, c.amount);
        expect(c.amount).toBeGreaterThanOrEqual(50);
        expect(c.amount).toBeLessThanOrEqual(100);
        expect(Number.isInteger(c.amount)).toBe(true);
      }
    }
    // as pontas da faixa são alcançáveis (sorteio uniforme de verdade)
    expect(minEc).toBe(50);
    expect(maxEc).toBe(70);
    expect(minXp).toBe(50);
    expect(maxXp).toBe(100);
  });

  it('pickInt é uniforme e nunca sai da faixa, inclusive com r = 1 − ε', () => {
    expect(pickInt(0, 50, 70)).toBe(50);
    expect(pickInt(0.999999999, 50, 70)).toBe(70);
    expect(pickInt(1, 50, 70)).toBe(70);
    for (let i = 0; i < 1000; i++) {
      const v = pickInt(i / 1000, 70, 100);
      expect(v).toBeGreaterThanOrEqual(70);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('a verificação de obtenção é de 50%', () => {
    const rand = rng(4242);
    let got = 0;
    const N = 100_000;
    for (let i = 0; i < N; i++) if (rollCapsule(5, rand).got) got++;
    expect(got / N).toBeCloseTo(CAPSULE_CHANCE, 2);
  });
});

describe('§15.2 garantia (pity) da unidade secreta', () => {
  it('a 50ª abertura concede a unidade mesmo com a rolagem desfavorável', () => {
    // r1 = 0,99 cairia em "70–100 EC"… mas a garantia substitui a rolagem
    const r = resolveCapsule(roll(0.99, 0.5), PITY_LIMIT - 1, []);
    expect(r.content.kind).toBe('secret');
    expect(r.guaranteed).toBe(true);
    expect(r.pityAfter).toBe(0);
  });

  it('antes da 50ª, a rolagem normal vale', () => {
    // r1 = 0,70 cai na faixa 0,50–0,80 → "70–100 EC" (a faixa da secreta é 0,95–1,00)
    const r = resolveCapsule(roll(0.7, 0.5), PITY_LIMIT - 2, []);
    expect(r.content.kind).toBe('ecPlus');
    expect(r.guaranteed).toBe(false);
    expect(r.pityAfter).toBe(PITY_LIMIT - 1);
  });

  it('obter pela chance de 5% também zera o contador', () => {
    const r = resolveCapsule(roll(0.99999, 0.5), 20, []);
    expect(r.content.kind).toBe('secret');
    expect(r.guaranteed).toBe(false);
    expect(r.pityAfter).toBe(0);
  });

  it('49 aberturas sem secreta e a 50ª garante — em qualquer sequência improvável', () => {
    let p: Profile = defaultProfile();
    // força 49 aberturas que NUNCA caem na secreta (r1 = 0 → categoria de 50%)
    for (let i = 1; i <= PITY_LIMIT - 1; i++) {
      const g = grantCapsule(p, `m:${i}`, roll(0, 0.5, i * 5));
      expect([i, g.applied]).toEqual([i, true]);
      expect([i, g.newSecret]).toEqual([i, false]);
      p = g.profile;
      expect([i, p.capsules.pity]).toEqual([i, i]);
    }
    expect(pityRemaining(p.capsules.pity)).toBe(1);
    // a 50ª concede obrigatoriamente
    const g50 = grantCapsule(p, 'm:50', roll(0, 0.5, 250));
    expect(g50.newSecret).toBe(true);
    expect(g50.guaranteed).toBe(true);
    expect(g50.secretUnit).toBe(SECRET_UNITS[0]);
    p = g50.profile;
    expect(p.capsules.pity).toBe(0);
    expect(p.units).toContain(SECRET_UNITS[0]);
    expect(p.capsules.guaranteed).toBe(1);
  });

  it('a garantia funciona de novo para a segunda unidade secreta', () => {
    let p: Profile = defaultProfile();
    p.units.push(SECRET_UNITS[0]);
    p.secrets[SECRET_UNITS[0]] = Date.now();
    for (let i = 1; i <= PITY_LIMIT; i++) p = grantCapsule(p, `s:${i}`, roll(0, 0.5, i * 5)).profile;
    expect(p.units).toContain(SECRET_UNITS[1]);
    expect(p.capsules.pity).toBe(0);
  });

  it('com todas as secretas no inventário a cápsula vira energia e o contador segue correndo', () => {
    const p = defaultProfile();
    for (const u of SECRET_UNITS) p.units.push(u);
    const g = grantCapsule(p, 'full:1', roll(0.999, 0.5));
    expect(g.content?.kind).toBe('secretDuplicate');
    expect(g.ec).toBe(SECRET_DUPLICATE_EC);
    expect(g.newSecret).toBe(false);
    // a garantia NÃO é zerada (não houve unidade nova), mas a abertura conta
    expect(g.guaranteed).toBe(false);
    expect(g.pity).toBe(1);
  });

  it('sanitize limita o contador vindo de dados corrompidos', () => {
    expect(sanitize({ ...defaultProfile(), capsules: { ...defaultProfile().capsules, pity: 999 } }).capsules.pity).toBe(PITY_LIMIT);
    expect(sanitize({ ...defaultProfile(), capsules: { ...defaultProfile().capsules, pity: -5 } }).capsules.pity).toBe(0);
    expect(sanitize({ ...defaultProfile(), capsules: { ...defaultProfile().capsules, pity: 'x' } }).capsules.pity).toBe(0);
    // perfil antigo (sem o campo) começa em zero, sem quebrar
    expect(sanitize({ v: 2, capsules: { checks: 3, opened: 2 } }).capsules.pity).toBe(0);
  });
});

describe('§15.3 persistência e integridade', () => {
  it('a mesma abertura não credita duas vezes (idempotência pela chave)', () => {
    const p0 = defaultProfile();
    const g1 = grantCapsule(p0, 'partida1:5', roll(0, 0.5));
    expect(g1.applied).toBe(true);
    const ecDepois = g1.profile.ec;
    const g2 = grantCapsule(g1.profile, 'partida1:5', roll(0, 0.5));
    expect(g2.applied).toBe(false);
    expect(g2.profile.ec).toBe(ecDepois);
    expect(g2.profile.capsules.opened).toBe(g1.profile.capsules.opened);
    expect(g2.profile.capsules.pity).toBe(g1.profile.capsules.pity);
  });

  it('o perfil anterior não é modificado (função pura: ou aplica tudo, ou nada)', () => {
    const p0 = defaultProfile();
    const antes = JSON.stringify(p0);
    grantCapsule(p0, 'k:1', roll(0, 0.5));
    expect(JSON.stringify(p0)).toBe(antes);
  });

  /**
   * O saldo do perfil pode subir MAIS que a cápsula, porque abrir cápsulas também concede
   * conquistas (que creditam EC). O que o teste fixa é o rastro específico da cápsula:
   * `capsules.ec` e `capsules.xp`.
   */
  it('EC e XP vão para os campos certos e a XP avança o nível de engenheiro', () => {
    const p0 = defaultProfile();
    const gEc = grantCapsule(p0, 'a', roll(0.1, 0.5)); // 50–70 EC
    expect(gEc.content?.kind).toBe('ec');
    expect(gEc.ec).toBeGreaterThanOrEqual(50);
    expect(gEc.ec).toBeLessThanOrEqual(70);
    expect(gEc.profile.capsules.ec).toBe(gEc.ec);
    expect(gEc.profile.ec).toBeGreaterThanOrEqual(gEc.ec);
    expect(gEc.profile.xp).toBe(0);

    const gXp = grantCapsule(p0, 'b', roll(0.9, 0.999)); // 50–100 XP
    expect(gXp.content?.kind).toBe('xp');
    expect(gXp.xp).toBe(100);
    expect(gXp.profile.xp).toBe(100);
    expect(gXp.profile.capsules.xp).toBe(100);
    expect(gXp.profile.capsules.ec).toBe(0);
    // o relatório informa o nível antes e depois (para a interface conceder recompensas)
    expect(gXp.levelBefore).toBe(levelInfo(0).level);
    expect(gXp.levelAfter).toBe(levelInfo(100).level);
  });

  it('a unidade secreta é registrada no inventário com data de descoberta', () => {
    const g = grantCapsule(defaultProfile(), 'sec', roll(0.999, 0.5));
    expect(g.newSecret).toBe(true);
    const u = g.secretUnit!;
    expect(g.profile.units).toContain(u);
    expect(typeof g.profile.secrets[u]).toBe('number');
    expect(g.profile.capsules.secrets).toBe(1);
    expect(ownedSecrets(g.profile)).toContain(u);
  });

  it('uma cápsula não obtida registra a verificação sem conceder nada', () => {
    const g = grantCapsule(defaultProfile(), 'miss', { milestone: 5, got: false, r1: 0, r2: 0 });
    expect(g.applied).toBe(true);
    expect(g.ec).toBe(0);
    expect(g.xp).toBe(0);
    expect(g.content).toBe(null);
    expect(g.profile.capsules.checks).toBe(1);
    expect(g.profile.capsules.opened).toBe(0);
    expect(g.profile.capsules.pity).toBe(0);
  });

  it('o sorteio é reproduzível: mesmos números crus ⇒ mesma recompensa', () => {
    const r = roll(0.42, 0.73);
    const a = resolveCapsule(r, 7, []);
    const b = resolveCapsule(r, 7, []);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('rollCapsule consome o gerador de forma determinística', () => {
    const a = rollCapsule(5, rng(99));
    const b = rollCapsule(5, rng(99));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('o contador sobrevive a uma ida e volta de serialização (persistência da conta)', () => {
    let p: Profile = defaultProfile();
    for (let i = 1; i <= 7; i++) p = grantCapsule(p, `p:${i}`, roll(0, 0.5, i * 5)).profile;
    expect(p.capsules.pity).toBe(7);
    const roundTrip: Profile = JSON.parse(JSON.stringify(p));
    expect(roundTrip.capsules.pity).toBe(7);
    // e continua de onde parou
    const g = grantCapsule(roundTrip, 'p:8', roll(0, 0.5, 40));
    expect(g.profile.capsules.pity).toBe(8);
  });
});
