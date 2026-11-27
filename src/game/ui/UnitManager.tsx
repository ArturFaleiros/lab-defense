import { useEffect, useMemo, useState } from 'react';
import { ArrowUpCircle, Check, Coins, Copy, Lock, LockOpen, Sparkles, Target, Unlock, X, Zap } from 'lucide-react';
import type { GameEngine, UnitInst } from '../engine/GameEngine';
import { maxLevel, needsBranch, upgradeCost } from '../engine/stats';
import type { TargetPriority } from '../types';
import { fmt, Meter, UnitIcon } from './common';
import { EffectRow } from './effects';
import { Button, Segmented } from '../../components/ui';

/**
 * §7 — Unit Manager.
 *
 * Permite administrar todas as unidades posicionadas sem depender de clicar nelas no mapa:
 * lista com atributos ao vivo, seleção múltipla (que destaca os modelos no mapa), melhoria,
 * venda, prioridade de alvo, bloqueio, melhoria automática com prioridade de 1 a 6 e vendas
 * em massa. Tudo passa pelos comandos da engine, então tudo entra no log do replay.
 */

const PRIORITIES: { id: TargetPriority; label: string }[] = [
  { id: 'primeiro', label: 'Primeiro' },
  { id: 'ultimo', label: 'Último' },
  { id: 'resistente', label: 'Resistente' },
  { id: 'objetivo', label: 'Núcleo' },
];

export interface UnitManagerProps {
  eng: GameEngine;
  /** seleção compartilhada com o mapa (destaque dos modelos) */
  selected: number[];
  onSelect: (uids: number[]) => void;
  onClose: () => void;
  /** abre o painel completo de uma unidade */
  onFocus: (uid: number) => void;
}

export function UnitManager({ eng, selected, onSelect, onClose, onFocus }: UnitManagerProps) {
  const [confirm, setConfirm] = useState<null | 'all' | 'economy' | 'selected'>(null);
  const [tab, setTab] = useState<'lista' | 'passivas'>('lista');

  const units = eng.units;
  const sel = useMemo(() => units.filter((u) => selected.includes(u.uid)), [units, selected]);

  // a seleção acompanha as unidades que deixaram de existir (venda, aniquilação do chefe)
  useEffect(() => {
    const vivos = selected.filter((uid) => units.some((u) => u.uid === uid));
    if (vivos.length !== selected.length) onSelect(vivos);
  }, [units, selected, onSelect]);

  const toggle = (uid: number, additive: boolean) => {
    if (!additive) {
      onSelect(selected.includes(uid) && selected.length === 1 ? [] : [uid]);
      return;
    }
    onSelect(selected.includes(uid) ? selected.filter((x) => x !== uid) : [...selected, uid]);
  };

  const totalVenda = sel.reduce((s, u) => s + (u.locked ? 0 : eng.sellValue(u)), 0);
  const bloqueadas = sel.filter((u) => u.locked).length;

  const executar = (scope: 'all' | 'economy' | 'selected') => {
    const r = eng.sellMany(scope, selected);
    setConfirm(null);
    if (scope !== 'economy') onSelect([]);
    return r;
  };

  return (
    <div className="gd-um" role="dialog" aria-label="Gerenciador de unidades">
      <header className="gd-um__head">
        <strong>
          <Target size={15} /> Unidades posicionadas
          <span className="gd-um__count mono">{units.length}</span>
        </strong>
        <div className="seg" role="tablist" aria-label="Abas do gerenciador">
          <button type="button" role="tab" aria-selected={tab === 'lista'} className={tab === 'lista' ? 'is-on' : ''} onClick={() => setTab('lista')}>
            Lista
          </button>
          <button type="button" role="tab" aria-selected={tab === 'passivas'} className={tab === 'passivas' ? 'is-on' : ''} onClick={() => setTab('passivas')}>
            Passivas
          </button>
        </div>
        <button type="button" className="gd-x" onClick={onClose} title="Fechar o gerenciador (M)">
          <X size={16} />
        </button>
      </header>

      {units.length === 0 && <p className="gd-muted gd-um__empty">Nenhuma unidade posicionada.</p>}

      {tab === 'lista' && (
        <>
          <div className="gd-um__bulk">
            <label className="gd-auto" title="O Auto Upgrade ignora unidades bloqueadas">
              <input type="checkbox" checked={eng.autoSkipLocked} onChange={(e) => eng.setAutoSkipLocked(e.target.checked)} /> Auto ignora bloqueadas
            </label>
            <Button size="sm" icon={<Copy />} disabled={sel.length !== 1} onClick={() => onSelect(eng.copiesOf(sel[0].uid))} title="Selecionar todas as cópias deste tipo">
              Cópias
            </Button>
            <Button size="sm" icon={<Lock />} disabled={!sel.length} onClick={() => sel.forEach((u) => eng.setLock(u.uid, true))}>
              Bloquear
            </Button>
            <Button size="sm" icon={<Unlock />} disabled={!sel.length} onClick={() => sel.forEach((u) => eng.setLock(u.uid, false))}>
              Desbloquear
            </Button>
            <Button size="sm" variant="danger" icon={<Coins />} disabled={!sel.length || sel.length === bloqueadas} onClick={() => setConfirm('selected')}>
              Vender seleção (+{fmt(totalVenda)})
            </Button>
            <Button size="sm" variant="danger" icon={<Coins />} disabled={!units.some((u) => !u.locked && ECONOMY.has(u.def.behavior))} onClick={() => setConfirm('economy')}>
              Vender economia
            </Button>
            <Button size="sm" variant="danger" icon={<Coins />} disabled={!units.some((u) => !u.locked)} onClick={() => setConfirm('all')}>
              Vender tudo
            </Button>
            {!!selected.length && (
              <Button size="sm" variant="ghost" icon={<X />} onClick={() => onSelect([])}>
                Cancelar seleção
              </Button>
            )}
          </div>

          <div className="gd-um__list" role="listbox" aria-multiselectable="true">
            {units.map((u) => (
              <UnitRow
                key={u.uid}
                eng={eng}
                u={u}
                selected={selected.includes(u.uid)}
                onToggle={(additive) => toggle(u.uid, additive)}
                onFocus={() => onFocus(u.uid)}
              />
            ))}
          </div>
        </>
      )}

      {tab === 'passivas' && (
        <div className="gd-um__passives">
          {units.length === 0 && <p className="gd-muted">Posicione unidades para ver suas passivas.</p>}
          {[...new Map(units.map((u) => [u.def.id, u])).values()].map((u) => (
            <article key={u.def.id} className="gd-um__passive">
              <h4>
                <UnitIcon id={u.def.id} tier={u.entry.tier} size={28} /> {u.def.tiers[u.entry.tier].name}
              </h4>
              <p>
                <strong>Passiva.</strong> {u.def.special}
              </p>
              {u.def.ability && (
                <p>
                  <strong>
                    <Sparkles size={12} /> {u.def.ability.name}.
                  </strong>{' '}
                  {u.def.ability.desc} <em>Recarga: {u.def.ability.cooldown} s.</em>
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {confirm && (
        <div className="gd-um__confirm">
          <p>
            {confirm === 'all'
              ? `Vender TODAS as ${units.filter((u) => !u.locked).length} unidade(s) desbloqueadas?`
              : confirm === 'economy'
                ? `Vender apenas as unidades de suporte econômico (${units.filter((u) => !u.locked && ECONOMY.has(u.def.behavior)).length})?`
                : `Vender ${sel.filter((u) => !u.locked).length} unidade(s) selecionada(s)?`}
            {bloqueadas > 0 && confirm === 'selected' && <em> {bloqueadas} bloqueada(s) será(ão) mantida(s).</em>}
          </p>
          <div className="gd-um__confirmrow">
            <Button size="sm" variant="danger" icon={<Check />} onClick={() => executar(confirm)}>
              Confirmar
            </Button>
            <Button size="sm" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const ECONOMY = new Set(['income', 'rectifier', 'grid']);

function UnitRow({
  eng,
  u,
  selected,
  onToggle,
  onFocus,
}: {
  eng: GameEngine;
  u: UnitInst;
  selected: boolean;
  onToggle: (additive: boolean) => void;
  onFocus: () => void;
}) {
  const b = eng.breakdown(u);
  const cost = upgradeCost(u.entry, u.level);
  const ramo = needsBranch(u.def, u.level);
  const podePagar = cost !== null && eng.credits >= cost;
  const abilityBlock = u.def.ability && u.stats.ability ? eng.abilityBlock(u) : 'sem habilidade';

  return (
    <div className={`gd-umrow${selected ? ' is-sel' : ''}${u.locked ? ' is-locked' : ''}`} role="option" aria-selected={selected}>
      <button
        type="button"
        className="gd-umrow__pick"
        onClick={(e) => onToggle(e.shiftKey || e.ctrlKey || e.metaKey)}
        title="Selecionar (Shift/Ctrl para somar à seleção)"
      >
        <UnitIcon id={u.def.id} tier={u.entry.tier} level={u.level} size={34} />
      </button>

      <div className="gd-umrow__main">
        <div className="gd-umrow__title">
          <button type="button" className="gd-umrow__name" onClick={onFocus} title="Abrir o painel completo">
            {u.def.short}
          </button>
          <span className="gd-umrow__lv mono">
            nv {u.level}/{maxLevel(u.entry)}
          </span>
          {u.locked && (
            <span className="gd-umrow__lockmark" title="Bloqueada contra venda">
              <Lock size={11} />
            </span>
          )}
          {u.autoUpgrade && (
            <span className="gd-umrow__auto" title={`Auto Upgrade ligado · prioridade ${u.autoPriority}`}>
              AUTO {u.autoPriority}
            </span>
          )}
        </div>

        <dl className="gd-umrow__stats">
          <div>
            <dt>Dano</dt>
            <dd className="mono">{fmt(b.finalDamage, 1)}</dd>
          </div>
          <div>
            <dt>DPS</dt>
            <dd className="mono">{fmt(b.dps, 1)}</dd>
          </div>
          <div>
            <dt>Alcance</dt>
            <dd className="mono">{fmt(b.finalRange)}</dd>
          </div>
          <div>
            <dt>Alvos</dt>
            <dd className="mono">{b.targets}</dd>
          </div>
          <div>
            <dt>Venda</dt>
            <dd className="mono">{fmt(eng.sellValue(u))}</dd>
          </div>
        </dl>

        <div className="gd-umrow__fx">
          <EffectRow sources={b.sources} max={6} />
        </div>

        <div className="gd-umrow__actions">
          <Button
            size="sm"
            variant={podePagar && !ramo ? 'primary' : 'default'}
            icon={<ArrowUpCircle />}
            disabled={cost === null || !podePagar || ramo}
            onClick={() => eng.upgrade(u.uid)}
            title={
              cost === null
                ? 'Nível máximo'
                : ramo
                  ? 'Este nível exige escolher um ramo: use o painel da unidade'
                  : `Nível ${u.level + 1}: ${u.def.levels[u.level]?.title ?? ''}`
            }
          >
            {cost === null ? 'Máx.' : ramo ? 'Ramo' : `↑ ${cost}`}
          </Button>

          <Button
            size="sm"
            icon={<Sparkles />}
            disabled={!!abilityBlock}
            onClick={() => eng.useAbility(u.uid)}
            title={typeof abilityBlock === 'string' ? abilityBlock : u.def.ability?.name}
          >
            Hab.
          </Button>

          <label className="gd-umrow__autotoggle" title="Melhorar automaticamente quando houver créditos">
            <input type="checkbox" checked={u.autoUpgrade} onChange={(e) => eng.setAutoUpgrade(u.uid, e.target.checked)} /> auto
          </label>

          <label className="gd-umrow__prio" title="Prioridade do Auto Upgrade: 1 é a maior, 6 a menor">
            <span>prio</span>
            <select value={u.autoPriority} onChange={(e) => eng.setAutoPriority(u.uid, Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="gd-umrow__lock"
            onClick={() => eng.setLock(u.uid, !u.locked)}
            title={u.locked ? 'Desbloquear (permite vender)' : 'Bloquear contra venda acidental'}
          >
            {u.locked ? <Lock size={13} /> : <LockOpen size={13} />}
          </button>

          <Button size="sm" variant="danger" icon={<Coins />} disabled={u.locked} onClick={() => eng.sell(u.uid)} title={u.locked ? 'Bloqueada' : 'Vender'}>
            Vender
          </Button>
        </div>

        <div className="gd-umrow__prioline">
          <Segmented<TargetPriority> value={u.priority} onChange={(p) => eng.setPriority(u.uid, p)} options={PRIORITIES} ariaLabel="Prioridade de alvo" />
        </div>

        {u.def.ability && u.stats.ability && u.abilityCd > 0 && (
          <div className="gd-umrow__cd">
            <Zap size={11} />
            <Meter value={1 - u.abilityCd / u.def.ability.cooldown} tone="amber" />
            <span className="mono">{Math.ceil(u.abilityCd)} s</span>
          </div>
        )}
      </div>
    </div>
  );
}
