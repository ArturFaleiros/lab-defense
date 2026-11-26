import { useState } from 'react';
import { Ban, CheckCircle2, Circle, Lock, Play, Skull, Zap } from 'lucide-react';
import { buildWaves, DIFFICULTIES, DIFFICULTY_ORDER, MODIFIERS, modifiersFor } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { MAPS } from '../data/maps';
import { CAMPAIGN, CHAPTERS, objectiveLabel, STAGE_BY_ID, type StageDef } from '../data/stages';
import { UNITS } from '../data/units';
import { isDifficultyUnlocked, isStageUnlocked, nextCampaignStage } from '../progress/profile';
import { session, useSession } from '../session';
import type { Difficulty, EnemyId } from '../types';
import { EnemyIcon, MapPreview, Stars, UnitIcon } from './common';
import { Button } from '../../components/ui';

export function stageEnemies(stage: StageDef, difficulty: Difficulty = 'normal'): EnemyId[] {
  const ids: EnemyId[] = [];
  for (const w of buildWaves(stage, difficulty)) for (const g of w.groups) if (!ids.includes(g.enemy)) ids.push(g.enemy);
  return ids;
}

/** Seletor de dificuldade com bloqueio progressivo e medalhas de conclusão. */
export function DifficultyPicker({ stageId, value, onChange }: { stageId: string; value: Difficulty; onChange: (d: Difficulty) => void }) {
  const { profile } = useSession();
  const rec = profile.stages[stageId];
  return (
    <div className="gd-diffs" role="radiogroup" aria-label="Dificuldade">
      {DIFFICULTY_ORDER.map((d) => {
        const def = DIFFICULTIES[d];
        const open = isDifficultyUnlocked(profile, stageId, d);
        const done = !!rec?.diff[d]?.cleared;
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={value === d}
            className={`gd-diff${value === d ? ' is-sel' : ''}${open ? '' : ' is-locked'}`}
            style={{ ['--diff' as string]: def.color }}
            disabled={!open}
            onClick={() => onChange(d)}
            title={open ? def.desc : d === 'dificil' ? 'Vença no Normal para liberar' : 'Vença no Difícil para liberar'}
          >
            <strong>
              {open ? done ? <CheckCircle2 size={13} /> : <Circle size={13} /> : <Lock size={13} />} {def.name}
            </strong>
            <span>{def.waves} ondas · +{Math.round((def.hp - 1) * 100)}% vida/vel.</span>
          </button>
        );
      })}
    </div>
  );
}

export function StageDetail({ stage }: { stage: StageDef }) {
  const { profile } = useSession();
  const rec = profile.stages[stage.id];
  const unlocked = isStageUnlocked(profile, stage);
  const best = [...DIFFICULTY_ORDER].reverse().find((d) => isDifficultyUnlocked(profile, stage.id, d)) ?? 'normal';
  const [diffState, setDiff] = useState<{ id: string; d: Difficulty }>({ id: stage.id, d: 'normal' });
  const diff: Difficulty = diffState.id === stage.id && isDifficultyUnlocked(profile, stage.id, diffState.d) ? diffState.d : 'normal';
  const dd = DIFFICULTIES[diff];
  const mods = modifiersFor(stage, diff);
  const enemies = stageEnemies(stage, diff);
  const bosses = enemies.filter((e) => ENEMIES[e].boss);
  const firstDiff = !rec?.diff[diff]?.cleared;
  return (
    <div className="gd-stage">
      <div className="gd-stage__map">
        <MapPreview map={stage.map} />
        <span className="gd-stage__mapname">{MAPS[stage.map].name}</span>
      </div>
      <div className="gd-stage__body">
        <div className="gd-kicker">
          {stage.mode === 'campaign' ? `Fase ${stage.id}` : stage.mode === 'boss' ? 'Modo de chefes' : 'Desafio técnico'} · {stage.concept}
        </div>
        <h2 className="gd-h2">{stage.name}</h2>
        <p className="gd-text">{stage.briefing}</p>
        <div className="gd-sub">Dificuldade</div>
        <DifficultyPicker stageId={stage.id} value={diff} onChange={(d) => setDiff({ id: stage.id, d })} />
        {best !== 'impossivel' && unlocked && (
          <p className="gd-note">
            {best === 'normal' ? 'Vença no Normal para liberar o Difícil.' : 'Vença no Difícil para liberar o Impossível.'}
          </p>
        )}
        <div className="gd-stage__facts">
          <span>
            <strong>{dd.waves}</strong> ondas
          </span>
          <span>
            Inimigos <strong>+{Math.round((dd.hp - 1) * 100)}%</strong> vida e <strong>+{Math.round((dd.speed - 1) * 100)}%</strong> velocidade
          </span>
          <span>
            <strong>{stage.startCredits}</strong> créditos iniciais
          </span>
          <span>
            <strong>{stage.lives}</strong> vidas
          </span>
          {bosses.length > 0 && (
            <span className="is-boss">
              <Skull size={14} /> {bosses.map((b) => ENEMIES[b].name).join(' + ')}
            </span>
          )}
        </div>
        {mods.length > 0 && (
          <>
            <div className="gd-sub">Modificadores ativos</div>
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
          </>
        )}
        {stage.blocked && stage.blocked.length > 0 && (
          <p className="gd-note">
            <Ban size={13} /> Áreas bloqueadas para construção: {[...new Set(stage.blocked.map((b) => b.label))].join(', ')}.
          </p>
        )}
        <div className="gd-sub">Inimigos</div>
        <div className="gd-enemyrow">
          {enemies.map((e) => (
            <span key={e} className="gd-enemychip" title={`${ENEMIES[e].name}: ${ENEMIES[e].traits.join(' · ')}`}>
              <EnemyIcon id={e} size={26} />
              {ENEMIES[e].name}
            </span>
          ))}
        </div>
        <div className="gd-sub">Objetivos (estrelas)</div>
        <ul className="gd-objs">
          <li className={rec?.cleared ? 'is-done' : ''}>
            {rec?.cleared ? <CheckCircle2 size={16} /> : <Circle size={16} />} Proteger o núcleo até a última onda
          </li>
          {stage.objectives.map((o, i) => (
            <li key={i} className={rec?.objectives[i] ? 'is-done' : ''}>
              {rec?.objectives[i] ? <CheckCircle2 size={16} /> : <Circle size={16} />} {objectiveLabel(o)} <span className="gd-muted">(+25 EC)</span>
            </li>
          ))}
        </ul>
        <div className="gd-stage__rewards">
          <span>
            Recompensa ({dd.name}): <strong>{Math.round(stage.reward.ec * dd.reward)} EC</strong> ·{' '}
            <strong>{Math.round(stage.reward.xp * dd.reward)} XP</strong>
            {!firstDiff && <span className="gd-muted"> (repetição: 35%)</span>}
          </span>
          {stage.unlocks?.map((u) => (
            <span key={u} className="gd-unlockchip">
              <UnitIcon id={u} size={24} /> Desbloqueia {UNITS[u].name}
            </span>
          ))}
        </div>
        {stage.allowed && (
          <p className="gd-note">Unidades permitidas: {stage.allowed.map((u) => UNITS[u].short).join(', ')}.</p>
        )}
        <div className="gd-stage__cta">
          {unlocked ? (
            <Button variant="primary" icon={<Play />} onClick={() => session.go({ id: 'loadout', stageId: stage.id, difficulty: diff })}>
              Preparar equipe · {dd.name}
            </Button>
          ) : (
            <span className="gd-locked">
              <Lock size={15} /> Conclua a fase {stage.requires} ({STAGE_BY_ID[stage.requires!]?.name}) para liberar.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function CampaignScreen() {
  const { profile } = useSession();
  const [sel, setSel] = useState(nextCampaignStage(profile).id);
  const stage = STAGE_BY_ID[sel];
  return (
    <div className="gd-page">
      <div className="gd-pagehead">
        <div>
          <div className="gd-kicker">Campanha</div>
          <h1 className="gd-h1">Seleção de fases</h1>
          <p className="gd-text">
            As primeiras fases ensinam, as intermediárias testam a compreensão e as finais exigem domínio. Cada fase tem três dificuldades
            (Normal, Difícil e Impossível). Os capítulos 7 a 11 formam a expansão 1.1 e são liberados ao concluir a fase 4-3.
          </p>
        </div>
      </div>
      <div className="gd-campaign">
        <div className="gd-chapters">
          {CHAPTERS.map((ch) => {
            const stages = CAMPAIGN.filter((s) => s.chapter === ch.n);
            return (
              <div key={ch.n} className="gd-chapter">
                <div className="gd-chapter__head">
                  <span className={`gd-chapter__n${ch.n >= 7 ? ' is-exp' : ''}`}>{ch.n === 6 ? 'F' : ch.n}</span>
                  <div>
                    <strong>{ch.title}</strong>
                    <span>{ch.theme}</span>
                  </div>
                </div>
                <div className="gd-chapter__stages">
                  {stages.map((s) => {
                    const rec = profile.stages[s.id];
                    const open = isStageUnlocked(profile, s);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`gd-node${sel === s.id ? ' is-sel' : ''}${rec?.cleared ? ' is-done' : ''}${open ? '' : ' is-locked'}`}
                        onClick={() => setSel(s.id)}
                        title={open ? s.name : 'Bloqueada'}
                      >
                        <span className="gd-node__id">{s.id}</span>
                        <span className="gd-node__name">{s.name}</span>
                        {open ? <Stars n={rec?.stars ?? 0} size={12} /> : <Lock size={13} />}
                        {open && (
                          <span className="gd-node__diffs" aria-label="Dificuldades vencidas">
                            {DIFFICULTY_ORDER.map((d) => (
                              <i key={d} style={{ background: rec?.diff[d]?.cleared ? DIFFICULTIES[d].color : undefined }} title={DIFFICULTIES[d].name} />
                            ))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {stage && <StageDetail stage={stage} />}
      </div>
    </div>
  );
}
