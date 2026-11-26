import { useState } from 'react';
import { ArrowUpCircle, CheckCircle2, HelpCircle, Link2, Lock, Sparkles, Zap } from 'lucide-react';
import { SYNERGIES } from '../data/synergies';
import { TRAITS, TRAIT_ORDER } from '../data/traits';
import { CLASS_LABEL, DAMAGE_LABEL, RARITIES, UNITS, UNIT_ORDER } from '../data/units';
import { computeStats, maxLevel, placeCost } from '../engine/stats';
import { evolveCost, levelInfo, loadoutEntries, unlockedTraits } from '../progress/profile';
import { session, useSession } from '../session';
import type { Rarity, Tier, UnitId } from '../types';
import { ClassTags, fmt, UnitIcon } from './common';
import { statRows, TechInfo } from './UnitPanel';
import { Button } from '../../components/ui';

export function UnitsScreen({ initial }: { initial?: UnitId }) {
  const { profile } = useSession();
  const [sel, setSel] = useState<UnitId>(initial ?? 'rele');
  const [flash, setFlash] = useState(0);
  const [rarity, setRarity] = useState<Rarity | 'todas'>('todas');
  const def = UNITS[sel];
  const owned = profile.units.includes(sel);
  const hidden = !!def.secret && !owned;
  const discovered = UNIT_ORDER.filter((u) => profile.units.includes(u)).length;
  const list = UNIT_ORDER.filter((u) => rarity === 'todas' || UNITS[u].rarity === rarity);
  const synergies = SYNERGIES.filter((x) => x.source.includes(sel) || x.target.includes(sel));
  const rar = RARITIES[def.rarity];
  const entry = loadoutEntries(profile, [sel])[0];
  const tier = entry.tier;
  const cost = evolveCost(profile, sel);
  const traits = unlockedTraits(profile);
  const lv = levelInfo(profile.xp).level;
  const rows = statRows(entry);
  const s0 = computeStats(entry, 0, -1);
  const sMax = computeStats(entry, maxLevel(entry), 0);

  const doEvolve = () => {
    void session.evolveUnit(sel).then((ok) => ok && setFlash((f) => f + 1));
  };

  return (
    <div className="gd-page">
      <div className="gd-pagehead">
        <div>
          <div className="gd-kicker">Coleção</div>
          <h1 className="gd-h1">Coleção de unidades</h1>
          <p className="gd-text">
            Evoluções são permanentes e custam Energia concatenada (EC), obtidos em fases, objetivos, desafios de conhecimento e
            conquistas (e Cápsulas Energéticas do modo infinito). Características são desbloqueadas pelo nível do engenheiro e podem ser
            trocadas a qualquer momento. A raridade indica identidade e regras de equipe (1 Mítica ou Secreta por equipe), não utilidade:
            unidades comuns continuam essenciais em várias composições.
          </p>
          <div className="gd-rarityfilter" role="radiogroup" aria-label="Filtrar por raridade">
            <button type="button" role="radio" aria-checked={rarity === 'todas'} className={rarity === 'todas' ? 'is-on' : ''} onClick={() => setRarity('todas')}>
              Todas ({discovered}/{UNIT_ORDER.length} descobertas)
            </button>
            {Object.values(RARITIES).map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={rarity === r.id}
                className={rarity === r.id ? 'is-on' : ''}
                style={{ ['--rar' as string]: r.color }}
                onClick={() => setRarity(r.id)}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
        <div className="gd-cpbox">
          <span>Energia concatenada</span>
          <strong className="mono">{fmt(profile.ec)} EC</strong>
        </div>
      </div>

      <div className="gd-units">
        <div className="gd-unitlist">
          {list.map((id) => {
            const has = profile.units.includes(id);
            const t = (profile.tiers[id] ?? 0) as Tier;
            const u = UNITS[id];
            const secretHidden = !!u.secret && !has;
            const r = RARITIES[u.rarity];
            return (
              <button
                key={id}
                type="button"
                className={`gd-unititem${sel === id ? ' is-sel' : ''}${has ? '' : ' is-locked'}`}
                style={{ ['--rar' as string]: r.color }}
                onClick={() => setSel(id)}
              >
                {secretHidden ? (
                  <span className="gd-secreticon">
                    <HelpCircle size={22} />
                  </span>
                ) : (
                  <UnitIcon id={id} tier={t} size={42} dim={!has} />
                )}
                <div>
                  <strong>{secretHidden ? '???' : has ? u.tiers[t].name : u.name}</strong>
                  <span className="gd-rarity" style={{ color: r.color }}>
                    {r.name}
                  </span>
                  {has ? <ClassTags id={id} /> : <span className="gd-muted">{secretHidden ? 'Unidade secreta não descoberta' : u.unlockText}</span>}
                </div>
                {!has && <Lock size={14} />}
              </button>
            );
          })}
        </div>

        {hidden ? (
          <div className="gd-card gd-unitdetail">
            <div className="gd-unitdetail__head">
              <span className="gd-secreticon is-big">
                <HelpCircle size={56} />
              </span>
              <div>
                <span className="gd-rarity" style={{ color: rar.color }}>
                  {rar.name}
                </span>
                <h2 className="gd-h2">Unidade secreta</h2>
                <p className="gd-text">
                  Uma unidade extremamente poderosa, ligada a um fenômeno físico surpreendente. Ela só pode ser encontrada em Cápsulas
                  Energéticas do modo infinito (a cada 5 ondas há 50% de chance de cápsula; 5% das cápsulas contêm a unidade secreta).
                </p>
                <p className="gd-muted">
                  Cápsulas obtidas: {profile.capsules.opened} · verificações: {profile.capsules.checks}
                </p>
              </div>
            </div>
          </div>
        ) : (
        <div className="gd-card gd-unitdetail">
          <div className="gd-unitdetail__head">
            <div className={`gd-unitdetail__icon${flash ? ' is-evolving' : ''}`} key={flash}>
              <UnitIcon id={sel} tier={tier} size={96} dim={!owned} />
            </div>
            <div>
              <div className="gd-kicker">
                <span className="gd-rarity" style={{ color: rar.color }}>
                  {rar.name}
                </span>{' '}
                · {def.classes.map((c) => CLASS_LABEL[c]).join(' / ')}
              </div>
              <h2 className="gd-h2">{owned ? def.tiers[tier].name : def.name}</h2>
              <p className="gd-text">{def.role}</p>
              <p className="gd-muted">
                Custo {placeCost(entry)} créditos · limite {def.limit} por partida
                {def.damageType ? ` · dano ${DAMAGE_LABEL[def.damageType].toLowerCase()}` : ''}
              </p>
            </div>
          </div>

          {!owned && (
            <p className="gd-locked">
              <Lock size={15} /> {def.unlockText}
            </p>
          )}

          <div className="gd-sub">Caminho de evolução (permanente)</div>
          <div className="gd-tiers">
            {def.tiers.map((t, i) => (
              <div key={t.name} className={`gd-tier${i <= tier && owned ? ' is-have' : ''}${i === tier + 1 ? ' is-next' : ''}`}>
                <UnitIcon id={sel} tier={i as Tier} size={44} dim={!owned || i > tier} />
                <strong>{t.name}</strong>
                <span>{t.summary}</span>
                {t.why && <em>{t.why}</em>}
                {t.extraLevels && <span className="gd-excl">+{t.extraLevels.length} melhorias exclusivas</span>}
                {t.upgradeDiscount && <span className="gd-excl">Melhorias −{Math.round(t.upgradeDiscount * 100)}%</span>}
                {i <= tier && owned && (
                  <span className="gd-have">
                    <CheckCircle2 size={14} /> Obtida
                  </span>
                )}
                {i === tier + 1 && owned && cost !== null && (
                  <Button variant="primary" size="sm" icon={<Sparkles />} disabled={profile.ec < cost} onClick={doEvolve}>
                    Evoluir · {cost} EC
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="gd-sub">Característica especial</div>
          <div className="gd-traits">
            <button type="button" className={`gd-trait${!entry.trait ? ' is-on' : ''}`} disabled={!owned} onClick={() => session.chooseTrait(sel, null)}>
              <strong>Nenhuma</strong>
            </button>
            {TRAIT_ORDER.map((t) => {
              const tr = TRAITS[t];
              const open = traits.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  className={`gd-trait${entry.trait === t ? ' is-on' : ''}${open ? '' : ' is-locked'}`}
                  disabled={!open || !owned}
                  onClick={() => session.chooseTrait(sel, t)}
                  style={{ borderColor: entry.trait === t ? tr.color : undefined }}
                >
                  <strong style={{ color: open ? tr.color : undefined }}>{tr.name}</strong>
                  <span>{tr.desc}</span>
                  {tr.limitation && <em>{tr.limitation}</em>}
                  {!open && (
                    <span className="gd-muted">
                      <Lock size={12} /> Nível {tr.unlockLevel} (atual: {lv})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="gd-sub">Atributos (forma atual)</div>
          <table className="gd-stats">
            <thead>
              <tr>
                <th />
                <th>Nível 0</th>
                <th>Nível máximo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, f]) => (
                <tr key={label}>
                  <th>{label}</th>
                  <td className="mono">{f(s0)}</td>
                  <td className="mono">{f(sMax)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="gd-sub">Melhorias durante a partida</div>
          <ol className="gd-levels">
            {[...def.levels.map((l) => ({ l, tierName: null as string | null })), ...def.tiers.flatMap((t) => (t.extraLevels ?? []).map((l) => ({ l, tierName: t.name })))].map(({ l, tierName }, i) => (
              <li key={l.title} className={tierName ? 'is-excl' : ''}>
                <ArrowUpCircle size={15} />
                <div>
                  <strong>
                    Nível {i + 1}: {l.title} <span className="gd-muted mono">({l.cost})</span>
                  </strong>
                  {tierName && <span className="gd-excl">Exclusiva de {tierName}</span>}
                  <span>{l.why}</span>
                  {def.branches && def.branchAt === i + 1 && (
                    <span className="gd-branchnote">
                      Escolha de ramo: {def.branches.map((b) => `${b.name} (${b.desc})`).join(' ou ')}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <p className="gd-special">
            <strong>Habilidade passiva / mecânica exclusiva.</strong> {def.special}
          </p>
          {def.ability && (
            <p className="gd-special">
              <strong>
                <Zap size={13} /> Habilidade ativa — {def.ability.name}.
              </strong>{' '}
              {def.ability.desc} Recarga: {def.ability.cooldown} s.{' '}
              {(() => {
                const at = def.levels.findIndex((l) => l.patch.ability);
                return def.base.ability ? 'Disponível desde o posicionamento.' : at >= 0 ? `Liberada no nível ${at + 1} da partida.` : '';
              })()}
            </p>
          )}
          {synergies.length > 0 && (
            <>
              <div className="gd-sub">
                <Link2 size={13} /> Sinergias
              </div>
              <ul className="gd-tips">
                {synergies.map((x) => (
                  <li key={x.id}>
                    <strong>{x.name}:</strong> {x.effect} <em className="gd-muted">{x.why}</em>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="gd-sub">Ficha técnica</div>
          <TechInfo id={sel} />
        </div>
        )}
      </div>
    </div>
  );
}
