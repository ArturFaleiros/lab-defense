import { useState } from 'react';
import { ArrowLeft, HelpCircle, Link2, Lock, Play, Settings2, Zap } from 'lucide-react';
import { DIFFICULTIES, MODIFIERS, modifiersFor } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { SYNERGIES } from '../data/synergies';
import { MAPS } from '../data/maps';
import { TRAITS } from '../data/traits';
import { RARITIES, UNITS, UNIT_ORDER } from '../data/units';
import { isEndless } from '../engine/setup';
import { placeCost } from '../engine/stats';
import { fixLoadout, LOADOUT_SIZE, loadoutBlock, loadoutEntries } from '../progress/profile';
import { session, useSession } from '../session';
import type { Difficulty, UnitId } from '../types';
import { stageEnemies } from './CampaignScreen';
import { ClassTags, EnemyIcon, UnitIcon } from './common';
import { Button } from '../../components/ui';

export function LoadoutScreen({ stageId, difficulty = 'normal' }: { stageId: string; difficulty?: Difficulty }) {
  const { profile, busy } = useSession();
  const stage = session.stageFor(stageId);
  const allowedFor = (u: UnitId) => profile.units.includes(u) && (!stage?.allowed || stage.allowed.includes(u));
  const [team, setTeam] = useState<UnitId[]>(() => {
    const t = profile.loadout.filter(allowedFor);
    for (const u of UNIT_ORDER) if (t.length < LOADOUT_SIZE && allowedFor(u) && !t.includes(u) && !loadoutBlock(t, u)) t.push(u);
    return fixLoadout(t);
  });
  const [warn, setWarn] = useState<string | null>(null);
  if (!stage) return null;
  const endless = isEndless(stage.id);
  const enemies = endless ? [] : stageEnemies(stage, difficulty);
  const dd = DIFFICULTIES[difficulty];
  const mods = endless ? [] : modifiersFor(stage, difficulty);
  // sinergias possíveis dentro da equipe escolhida
  const teamSyn = SYNERGIES.filter((sy) => sy.source.some((a) => team.includes(a)) && sy.target.some((b) => team.includes(b) && (sy.id !== 'filtroLC' || team.includes('capacitor') && team.includes('indutor'))));

  const toggle = (u: UnitId) => {
    if (!allowedFor(u)) return;
    if (team.includes(u)) {
      setWarn(null);
      setTeam(team.filter((x) => x !== u));
      return;
    }
    const block = loadoutBlock(team, u);
    setWarn(block);
    if (!block) setTeam([...team, u]);
  };

  const start = () => {
    if (!team.length) return;
    if (!stage.allowed) session.setLoadout(team);
    void session.startMatch(stage.id, team, difficulty);
  };

  return (
    <div className="gd-page">
      <div className="gd-pagehead">
        <div>
          <button type="button" className="gd-link" onClick={() => session.go({ id: isEndless(stage.id) || stage.mode !== 'campaign' ? 'modes' : 'campaign' })}>
            <ArrowLeft size={14} /> Voltar
          </button>
          <div className="gd-kicker">
            Preparação · {MAPS[stage.map].name}
            {!endless && (
              <span className="gd-diffbadge" style={{ ['--diff' as string]: dd.color }}>
                {dd.name} · {dd.waves} ondas
              </span>
            )}
          </div>
          <h1 className="gd-h1">{stage.name}</h1>
          <p className="gd-text">{stage.briefing}</p>
        </div>
        <Button variant="primary" size="lg" icon={<Play />} disabled={!team.length || !!busy} onClick={start}>
          Iniciar missão
        </Button>
      </div>

      <div className="gd-loadout">
        <section className="gd-card">
          <h3 className="gd-h3">
            Equipe ({team.length}/{LOADOUT_SIZE})
          </h3>
          <div className="gd-slots">
            {Array.from({ length: LOADOUT_SIZE }, (_, i) => {
              const id = team[i];
              return (
                <button key={i} type="button" className={`gd-slot${id ? ' is-full' : ''}`} onClick={() => id && toggle(id)} title={id ? 'Remover da equipe' : 'Vazio'} disabled={!id}>
                  <span className="gd-slot__key">{i + 1}</span>
                  {id ? (
                    <>
                      <UnitIcon id={id} tier={profile.tiers[id] ?? 0} size={46} />
                      <span>{UNITS[id].short}</span>
                    </>
                  ) : (
                    <span className="gd-muted">vazio</span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="gd-note">
            Clique em uma unidade abaixo para adicionar ou remover. As teclas 1–5 selecionam os espaços durante a partida. Regra de equipe:
            no máximo 1 unidade Mítica ou Secreta.
          </p>
          {warn && <p className="gd-warn">{warn}</p>}
          <div className="gd-roster">
            {UNIT_ORDER.map((id) => {
              const def = UNITS[id];
              const owned = profile.units.includes(id);
              if (def.secret && !owned) {
                return (
                  <div key={id} className="gd-rosteritem is-locked is-secret">
                    <span className="gd-secreticon">
                      <HelpCircle size={22} />
                    </span>
                    <div className="gd-rosteritem__txt">
                      <strong>??? (unidade secreta)</strong>
                      <span className="gd-muted">Pode surgir em Cápsulas Energéticas do modo infinito.</span>
                    </div>
                    <Lock size={14} />
                  </div>
                );
              }
              const allowed = allowedFor(id);
              const entry = loadoutEntries(profile, [id])[0];
              const trait = entry.trait ? TRAITS[entry.trait] : null;
              return (
                <button
                  key={id}
                  type="button"
                  className={`gd-rosteritem${team.includes(id) ? ' is-on' : ''}${allowed ? '' : ' is-locked'}`}
                  onClick={() => toggle(id)}
                  disabled={!allowed}
                >
                  <UnitIcon id={id} tier={entry.tier} size={40} dim={!owned} />
                  <div className="gd-rosteritem__txt">
                    <strong>{owned ? def.tiers[entry.tier].name : def.name}</strong>
                    <span className="gd-rarity" style={{ color: RARITIES[def.rarity].color }}>
                      {RARITIES[def.rarity].name}
                    </span>
                    {owned ? <ClassTags id={id} /> : <span className="gd-muted">{def.unlockText}</span>}
                    {owned && !allowed && <span className="gd-muted">Não permitida neste desafio</span>}
                    {trait && <span className="gd-traitchip" style={{ color: trait.color }}>{trait.name}</span>}
                  </div>
                  {owned ? <span className="mono gd-cost">{placeCost(entry)}</span> : <Lock size={14} />}
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" icon={<Settings2 />} onClick={() => session.go({ id: 'units' })}>
            Evoluções e características
          </Button>
        </section>

        <section className="gd-card">
          <h3 className="gd-h3">Análise da missão</h3>
          {!endless && (
            <p className="gd-text">
              {dd.desc}
            </p>
          )}
          {mods.length > 0 && (
            <ul className="gd-mods">
              {mods.map((m) => (
                <li key={m} style={{ borderColor: MODIFIERS[m].color }}>
                  <strong style={{ color: MODIFIERS[m].color }}>
                    <Zap size={13} /> {MODIFIERS[m].name}
                  </strong>
                  <span>{MODIFIERS[m].desc}</span>
                  <em>Contrajogo: {MODIFIERS[m].counter}</em>
                </li>
              ))}
            </ul>
          )}
          {teamSyn.length > 0 && (
            <>
              <div className="gd-sub">
                <Link2 size={13} /> Sinergias possíveis na equipe
              </div>
              <ul className="gd-tips">
                {teamSyn.map((sy) => (
                  <li key={sy.id}>
                    <strong>{sy.name}:</strong> {sy.effect}
                  </li>
                ))}
              </ul>
            </>
          )}
          {endless ? (
            <p className="gd-text">
              Ondas procedurais: todos os tipos de inimigo aparecem progressivamente; chefes nas ondas 10, 20, 30… A cada 5 ondas
              concluídas há 50% de chance de ganhar uma Cápsula Energética (EC ou, raramente, a unidade secreta).
            </p>
          ) : (
            <ul className="gd-threats">
              {enemies.map((e) => (
                <li key={e}>
                  <EnemyIcon id={e} size={30} />
                  <div>
                    <strong>{ENEMIES[e].name}</strong>
                    <span>{ENEMIES[e].traits.join(' · ')}</span>
                    <span className="gd-counter">Resposta: {ENEMIES[e].counter}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {stage.tips.length > 0 && (
            <>
              <div className="gd-sub">Dicas</div>
              <ul className="gd-tips">
                {stage.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
