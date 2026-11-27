import { useState } from 'react';
import { ArrowUpCircle, BookOpen, ChevronDown, ChevronUp, Coins, Sparkles, X } from 'lucide-react';
import { TRAITS } from '../data/traits';
import { MODIFIERS } from '../data/difficulty';
import { SYNERGY_BY_ID } from '../data/synergies';
import { DAMAGE_LABEL, RARITIES, UNITS, type UnitStats } from '../data/units';
import type { GameEngine, UnitInst } from '../engine/GameEngine';
import { capacitorCycle, computeStats, levelsFor, maxLevel, needsBranch, rlSteadyDps, upgradeCost } from '../engine/stats';
import type { LoadoutEntry, TargetPriority } from '../types';
import { ClassTags, fmt, Meter, pct, UnitIcon } from './common';
import { Button, Formula, Segmented } from '../../components/ui';

type Row = [label: string, value: (s: UnitStats) => string];

const sec = (v: number) => `${fmt(v, 2)} s`;

/** Linhas de atributos conforme o comportamento da unidade. */
export function statRows(entry: LoadoutEntry): Row[] {
  const def = UNITS[entry.id];
  switch (def.behavior) {
    case 'bolt': {
      const rows: Row[] = [
        ['Dano por golpe', (s) => fmt(s.damage, 1)],
        ['Intervalo', (s) => sec(s.interval)],
        ['Alcance', (s) => fmt(s.range)],
        ['Alvos', (s) => String(s.targets)],
      ];
      if (def.base.stun > 0) rows.push(['Interrupção', (s) => sec(s.stun)]);
      if (def.base.auraSpeed > 0) rows.push(['Aura de comando (cadência)', (s) => `+${pct(s.auraSpeed)} · raio ${fmt(s.aura)}`]);
      if (def.base.protect) rows.push(['Raio de proteção', (s) => fmt(s.aura)]);
      return rows;
    }
    case 'pulse':
      return [
        ['Dano do pulso (área)', (s) => fmt(s.damage, 1)],
        ['Raio do pulso', (s) => fmt(s.splash)],
        ['Intervalo', (s) => sec(s.interval)],
        ['Alcance', (s) => fmt(s.range)],
        ['Desaceleração', (s) => (s.slow ? `${pct(s.slow)} por ${sec(s.slowDur)}` : '—')],
        ['Recuo (eletroímã)', (s) => (s.knockback ? fmt(s.knockback) : '—')],
      ];
    case 'beam':
      return [
        ['Dano/s com corrente máxima', (s) => fmt(s.damage, 1)],
        ['Constante de tempo da rampa (τ)', (s) => sec(s.tau)],
        ['Liberação na interrupção (∝ I²)', (s) => fmt(s.burst, 0)],
        ['Alcance', (s) => fmt(s.range)],
        ['Alvos', (s) => String(s.targets)],
      ];
    case 'capacitor':
      return [
        ['Dano da descarga', (s) => fmt(s.damage, 1)],
        ['Constante de carga (τ = RC)', (s) => sec(s.tau)],
        ['Intervalo entre descargas (≈ τ·ln 10)', (s) => sec(capacitorCycle(s))],
        ['Descargas consecutivas', (s) => (s.salvo ? `+${s.salvo} × ${pct(s.salvoMul)}` : '—')],
        ['Raio da descarga', (s) => fmt(s.splash)],
        ['Desaceleração', (s) => `${pct(s.slow)} por ${sec(s.slowDur)}`],
        ['Cargas armazenáveis', (s) => String(s.charges)],
        ['Alcance', (s) => fmt(s.range)],
      ];
    case 'zone':
      return [
        ['Resistência R', (s) => fmt(s.resistance, 3)],
        ['Indutância L', (s) => fmt(s.inductance, 2)],
        ['τ = L/R', (s) => sec(s.tau)],
        ['Dano/s em regime (V/R)', (s) => fmt(rlSteadyDps(s), 1)],
        ['Desaceleração na zona', (s) => pct(s.slow)],
        ['Raio da zona', (s) => fmt(s.range)],
      ];
    case 'aura':
      return [
        ['Raio da aura', (s) => fmt(s.aura)],
        ['Bônus de dano', (s) => `+${pct(s.auraDamage)}`],
        ['Bônus de alcance', (s) => `+${pct(s.auraRange)}`],
        ['Bônus de cadência', (s) => (s.auraSpeed ? `${s.auraSpeed > 0 ? '+' : ''}${pct(s.auraSpeed)}` : '—')],
      ];
    case 'income':
      return [
        ['Créditos por ciclo', (s) => fmt(Math.round(s.income))],
        ['Intervalo', (s) => sec(s.interval)],
        ['Geração por minuto (onda ativa)', (s) => fmt((Math.round(s.income) * 60) / s.interval)],
        ['Reserva ao fim da onda (PFC)', (s) => (s.waveIncome ? `+${fmt(s.waveIncome)}` : '—')],
      ];
    case 'amplifier':
      return [
        ['Dano por golpe (sem ganho)', (s) => fmt(s.damage, 1)],
        ['Intervalo', (s) => sec(s.interval)],
        ['Estágios de ganho (hFE)', (s) => String(s.gain)],
        ['Ganho por estágio', (s) => `+${pct(s.gainStep)}`],
        ['Dano na saturação', (s) => fmt(s.damage * (1 + s.gain * s.gainStep), 1)],
        ['Alcance', (s) => fmt(s.range)],
        ['Alvos na saturação', (s) => String(s.targets + 1)],
      ];
    case 'heat':
      return [
        ['Dano por golpe', (s) => fmt(s.damage, 1)],
        ['Intervalo', (s) => sec(s.interval)],
        ['Aquecimento por golpe', (s) => `+${s.heat}`],
        ['Aquecimento máximo (n)', (s) => String(s.heatMax)],
        ['Dano térmico no máximo (k·n²/s)', (s) => fmt(s.heatCoef * s.heatMax * s.heatMax, 1)],
        ['Alcance', (s) => fmt(s.range)],
        ['Alvos', (s) => String(s.targets)],
      ];
    case 'wave':
      return [
        ['Dano do semiciclo positivo', (s) => fmt(s.damage, 1)],
        ['Semiciclo negativo', (s) => `${fmt(s.damage * 0.5, 1)} + desaceleração ${pct(s.slow)}`],
        ['Período (meio ciclo)', (s) => sec(s.interval)],
        ['Ondas para a ressonância', (s) => String(s.resonance)],
        ['Raio', (s) => fmt(s.range)],
      ];
    case 'rectifier':
      return [
        ['Créditos por 100 de dano', (s) => fmt(s.conversion, 2)],
        ['Raio de conversão e filtro', (s) => fmt(s.aura)],
      ];
    case 'timer':
      return [
        ['Período T', (s) => sec(s.interval)],
        ['Ciclo de trabalho D', (s) => pct(s.duty)],
        ['Interrupção no disparo', (s) => sec(s.stun)],
        ['Cadência no nível alto', (s) => `+${pct(s.auraSpeed)}`],
        ['Raio', (s) => fmt(s.range)],
        ['Temporizadores', (s) => String(s.charges)],
      ];
    case 'chain':
      return [
        ['Dano do arco', (s) => fmt(s.damage, 1)],
        ['Intervalo', (s) => sec(s.interval)],
        ['Saltos', (s) => String(s.chains)],
        ['Mantido por salto', (s) => pct(s.chainDecay)],
        ['Alcance', (s) => fmt(s.range)],
      ];
    case 'super':
      return [
        ['Dano/s por feixe (corrente máxima)', (s) => fmt(s.damage, 1)],
        ['Feixes simultâneos', (s) => String(s.targets)],
        ['Constante de tempo da corrente', (s) => sec(s.tau)],
        ['Efeito Meissner', (s) => `raio ${fmt(s.meissner)} · −${pct(s.meissnerSlow)}`],
        ['Alcance', (s) => fmt(s.range)],
      ];
  }
}

const PRIORITIES: { id: TargetPriority; label: string }[] = [
  { id: 'primeiro', label: 'Primeiro' },
  { id: 'ultimo', label: 'Último' },
  { id: 'resistente', label: 'Mais resistente' },
  { id: 'objetivo', label: 'Perto do núcleo' },
];

function Live({ eng, u }: { eng: GameEngine; u: UnitInst }) {
  const t = eng.time;
  const items: React.ReactNode[] = [];
  if (u.def.behavior === 'beam') {
    items.push(
      <div key="i" className="gd-live">
        <span>Corrente I/Imax</span>
        <Meter value={u.ramp} tone="violet" />
        <span className="mono">{pct(u.ramp)}</span>
      </div>,
      <div key="e" className="gd-live">
        <span>Energia (∝ I²)</span>
        <Meter value={u.ramp * u.ramp} tone="amber" />
        <span className="mono">{pct(u.ramp * u.ramp)}</span>
      </div>,
    );
  }
  if (u.def.behavior === 'capacitor') {
    items.push(
      <div key="v" className="gd-live">
        <span>Tensão v/V</span>
        <Meter value={u.stored >= u.stats.charges ? 1 : u.ramp} tone="amber" />
        <span className="mono">{pct(u.stored >= u.stats.charges ? 1 : u.ramp)}</span>
      </div>,
      <div key="c" className="gd-live">
        <span>Cargas prontas</span>
        <span className="mono">
          {u.stored}/{u.stats.charges}
        </span>
      </div>,
    );
  }
  if (u.def.behavior === 'zone') {
    const r = eng.rangeOf(u);
    const inside = eng.enemies.filter((e) => (e.x - u.x) ** 2 + (e.y - u.y) ** 2 <= r * r);
    const tmax = inside.reduce((m, e) => Math.max(m, e.rlTime), 0);
    items.push(
      <div key="z" className="gd-live">
        <span>Inimigos na zona</span>
        <span className="mono">{inside.length}</span>
      </div>,
      <div key="zt" className="gd-live">
        <span>Maior permanência t/τ</span>
        <Meter value={1 - Math.exp(-tmax / u.stats.tau)} tone="accent" />
        <span className="mono">{fmt(tmax / u.stats.tau, 1)}τ</span>
      </div>,
    );
  }
  if (u.def.behavior === 'amplifier') {
    items.push(
      <div key="g" className="gd-live">
        <span>Ganho {eng.saturated(u) ? '(saturado)' : ''}</span>
        <Meter value={u.stats.gain ? u.stacks / u.stats.gain : 0} tone="accent" />
        <span className="mono">
          {u.stacks}/{u.stats.gain}
        </span>
      </div>,
    );
  }
  if (u.def.behavior === 'super') {
    items.push(
      <div key="s" className="gd-live">
        <span>Corrente persistente</span>
        <Meter value={u.ramp} tone="accent" />
        <span className="mono">{pct(u.ramp)}</span>
      </div>,
      <div key="q" className="gd-live">
        <span>Energia do quench (½LI²)</span>
        <span className="mono">{fmt(u.stats.burst * u.stats.damage * u.ramp * u.ramp * eng.dmgMul(u))}</span>
      </div>,
    );
  }
  if (u.def.behavior === 'timer') {
    items.push(
      <div key="t" className="gd-live">
        <span>Saída {u.high ? 'em nível ALTO' : 'em nível baixo'}</span>
        <Meter value={u.timerT / u.stats.interval} tone={u.high ? 'green' : 'violet'} />
        <span className="mono">{sec(Math.max(0, u.stats.interval - u.timerT))}</span>
      </div>,
    );
  }
  if (u.def.behavior === 'rectifier') {
    items.push(
      <div key="r" className="gd-live">
        <span>Unidades convertidas</span>
        <span className="mono">{eng.units.filter((o) => o.buff.rect === u.uid).length}</span>
      </div>,
    );
  }
  if (u.def.behavior === 'income') {
    items.push(
      <div key="g" className="gd-live">
        <span>Próximo ciclo</span>
        <Meter value={u.incomeT / u.stats.interval} tone="green" />
        <span className="mono">{eng.phase === 'wave' ? sec(Math.max(0, u.stats.interval - u.incomeT)) : 'em pausa'}</span>
      </div>,
    );
  }
  const status: string[] = [];
  if (t < u.stunUntil) status.push(`Desativada por ${fmt(u.stunUntil - t, 1)} s`);
  if (u.buff.noise > 0) status.push(`Ruído: cadência −${pct(u.buff.noise)}`);
  const ov = eng.overloadState(u);
  if (ov === 'boost') status.push('Sobrecarga controlada: +40% de dano');
  if (ov === 'cool') status.push('Resfriamento: −20% de cadência');
  if (t < u.overheatUntil) status.push(`Superaquecida (Curto Franco): −40% de cadência por ${fmt(u.overheatUntil - t, 1)} s`);
  if (u.buff.emi > 0) status.push(`EMI irradiada: alcance −${pct(u.buff.emi)}`);
  if (u.buff.brownout > 0) status.push(`Subtensão (Apagão): dano −${pct(u.buff.brownout)}`);
  for (const m of u.buff.mods) status.push(`Modificador — ${MODIFIERS[m].name}`);
  if (eng.time < eng.incomeHaltUntil && (u.def.behavior === 'income' || u.def.behavior === 'rectifier')) status.push('Rejeição de carga: geração parada');
  const syn = u.links
    .map((uid) => eng.unit(uid))
    .filter(Boolean)
    .map((s) => s!.def.short);
  const buffs: string[] = [];
  if (u.buff.protected) buffs.push('Protegida por diodo');
  if (u.buff.dmg > 0.001) buffs.push(`Dano +${pct(u.buff.dmg)}`);
  if (u.buff.speed > 0.001) buffs.push(`Cadência +${pct(u.buff.speed)}`);
  if (u.buff.range > 0.001) buffs.push(`Alcance +${pct(u.buff.range)}`);
  if (u.buff.powered) buffs.push('Alimentada: recarga 10% mais rápida');
  if (u.buff.filtered) buffs.push('Filtrada pelo retificador: ruído pela metade');
  if (u.buff.timer > 0) buffs.push(`CI 555 em nível alto: cadência +${pct(u.buff.timer)}`);
  for (const sid of u.buff.syn) buffs.push(`${SYNERGY_BY_ID[sid].name}: ${SYNERGY_BY_ID[sid].effect}`);

  return (
    <div className="gd-livebox">
      {items}
      <div className="gd-live">
        <span>{u.def.behavior === 'income' || u.def.behavior === 'rectifier' ? 'Créditos gerados' : 'Dano causado'}</span>
        <span className="mono">{fmt(u.def.behavior === 'income' || u.def.behavior === 'rectifier' ? u.earned : u.dealt)}</span>
      </div>
      {u.def.behavior !== 'income' && u.def.behavior !== 'aura' && u.def.behavior !== 'rectifier' && (
        <div className="gd-live">
          <span>Eliminações</span>
          <span className="mono">{u.kills}</span>
        </div>
      )}
      {(syn.length > 0 || buffs.length > 0) && (
        <div className="gd-syn">
          <strong>Sinergias ativas</strong>
          {syn.length > 0 && <span>Recebe de: {[...new Set(syn)].join(', ')}</span>}
          {buffs.map((b) => (
            <span key={b}>• {b}</span>
          ))}
        </div>
      )}
      {status.map((s) => (
        <div key={s} className="gd-status">
          {s}
        </div>
      ))}
    </div>
  );
}

export function TechInfo({ id }: { id: UnitInst['def']['id'] }) {
  const def = UNITS[id];
  return (
    <div className="gd-tech">
      <p>
        <strong>Definição.</strong> {def.tech.definition}
      </p>
      <p>
        <strong>Princípio de funcionamento.</strong> {def.tech.principle}
      </p>
      {def.tech.formula && <Formula tex={def.tech.formula.tex} label={def.tech.formula.label} compact />}
      <strong>Características elétricas</strong>
      <ul>
        {def.tech.characteristics.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <strong>Aplicações práticas</strong>
      <ul>
        {def.tech.applications.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p>
        <strong>Relação com a mecânica.</strong> {def.tech.mechanic}
      </p>
      <p className="gd-physics">{def.tech.physicsNote}</p>
    </div>
  );
}

export function UnitPanel({ eng, u, onClose }: { eng: GameEngine; u: UnitInst; onClose: () => void }) {
  const [tech, setTech] = useState(false);
  const def = u.def;
  const rows = statRows(u.entry);
  const cost = upgradeCost(u.entry, u.level);
  const branchStep = needsBranch(def, u.level);
  const next = cost !== null && !branchStep ? computeStats(u.entry, u.level + 1, u.branch) : null;
  const nextLv = levelsFor(u.entry)[u.level];
  const trait = u.entry.trait ? TRAITS[u.entry.trait] : null;
  const canPay = cost !== null && eng.credits >= cost;
  const attacks = !['aura', 'income', 'zone', 'rectifier', 'timer', 'wave'].includes(def.behavior);
  const abilityBlock = eng.abilityBlock(u);
  const exclusive = u.level >= def.levels.length;

  return (
    <div className="gd-unitpanel">
      <div className="gd-unitpanel__head">
        <UnitIcon id={def.id} tier={u.entry.tier} level={u.level} size={52} />
        <div>
          <strong>{def.tiers[u.entry.tier].name}</strong>
          <ClassTags id={def.id} />
          <span className="gd-muted">
            <span style={{ color: RARITIES[def.rarity].color }}>{RARITIES[def.rarity].name}</span> · Nível {u.level}/{maxLevel(u.entry)}
            {def.damageType ? ` · dano ${DAMAGE_LABEL[def.damageType].toLowerCase()}` : ''}
            {u.branch >= 0 && def.branches ? ` · ${def.branches[u.branch].name}` : ''}
          </span>
        </div>
        <button type="button" className="gd-x" onClick={onClose} title="Fechar (Esc)">
          <X size={16} />
        </button>
      </div>
      <p className="gd-role">{def.role}</p>
      {trait && (
        <p className="gd-traitline" style={{ borderColor: trait.color }}>
          <strong style={{ color: trait.color }}>{trait.name}:</strong> {trait.desc} {trait.limitation}
        </p>
      )}

      <table className="gd-stats">
        <tbody>
          {rows.map(([label, f]) => {
            const cur = f(u.stats);
            const nv = next ? f(next) : null;
            return (
              <tr key={label}>
                <th>{label}</th>
                <td className="mono">{cur}</td>
                <td className="mono gd-next">{nv && nv !== cur ? `→ ${nv}` : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {cost !== null && nextLv ? (
        <div className="gd-upgrade">
          <div className="gd-upgrade__title">
            <ArrowUpCircle size={15} /> Nível {u.level + 1}: {nextLv.title}
            {exclusive && <span className="gd-excl">Exclusiva de {def.tiers[u.entry.tier].name}</span>}
          </div>
          <p className="gd-upgrade__why">{nextLv.why}</p>
          {branchStep && def.branches ? (
            <div className="gd-branches">
              {def.branches.map((b, i) => (
                <button key={b.id} type="button" className="gd-branch" disabled={!canPay} onClick={() => eng.upgrade(u.uid, i)}>
                  <strong>{b.name}</strong>
                  <span>{b.desc}</span>
                  <em>{b.why}</em>
                  <span className="mono">{cost} créditos</span>
                </button>
              ))}
            </div>
          ) : (
            <Button variant="primary" icon={<ArrowUpCircle />} disabled={!canPay} onClick={() => eng.upgrade(u.uid)} title="Melhorar (U)">
              Melhorar · {cost} {canPay ? '' : `(faltam ${cost - eng.credits})`}
            </Button>
          )}
        </div>
      ) : (
        <div className="gd-maxed">Nível máximo alcançado.</div>
      )}

      {def.ability && (
        <div className="gd-ability">
          <div>
            <strong>
              <Sparkles size={14} /> {def.ability.name}
            </strong>
            <span>{def.ability.desc}</span>
          </div>
          {u.stats.ability ? (
            <div className="gd-ability__act">
              <Button
                variant={abilityBlock ? 'default' : 'primary'}
                size="sm"
                disabled={!!abilityBlock}
                onClick={() => eng.useAbility(u.uid)}
                title="Usar habilidade (Q)"
              >
                {abilityBlock ?? 'Usar (Q)'}
              </Button>
              <Meter value={1 - u.abilityCd / def.ability.cooldown} tone="amber" />
              {eng.time < u.abilityUntil && <span className="gd-note">Ativa: {fmt(u.abilityUntil - eng.time, 1)} s</span>}
              <span className="gd-muted">Recarga total: {def.ability.cooldown} s</span>
            </div>
          ) : (
            <span className="gd-muted">Libera no nível {levelsFor(u.entry).findIndex((l) => l.patch.ability) + 1}</span>
          )}
        </div>
      )}

      {attacks && (
        <div className="gd-prio">
          <span className="gd-sub">Prioridade de alvo (T)</span>
          <Segmented<TargetPriority> value={u.priority} onChange={(p) => eng.setPriority(u.uid, p)} options={PRIORITIES} ariaLabel="Prioridade de alvo" />
          {def.behavior === 'beam' && <span className="gd-note">O indutor mantém o alvo atual até perdê-lo (trocar de alvo interrompe a corrente).</span>}
        </div>
      )}

      <Live eng={eng} u={u} />

      <p className="gd-special">
        <strong>Habilidade especial.</strong> {def.special}
      </p>

      <div className="gd-unitpanel__foot">
        <Button variant="danger" size="sm" icon={<Coins />} onClick={() => eng.sell(u.uid)} title="Vende e devolve 60% do investido">
          Vender (+{eng.sellValue(u)})
        </Button>
        <Button variant="ghost" size="sm" icon={<BookOpen />} onClick={() => setTech((v) => !v)}>
          Ficha técnica {tech ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Button>
      </div>
      {tech && <TechInfo id={def.id} />}
    </div>
  );
}
