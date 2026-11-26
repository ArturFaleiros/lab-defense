import { useState } from 'react';
import { ArrowRight, Award, Brain, CheckCircle2, Home, Map as MapIcon, RotateCcw, Sparkles, Trophy, XCircle } from 'lucide-react';
import { ACHIEVEMENTS } from '../data/achievements';
import { QUIZZES } from '../data/knowledge';
import { DIFFICULTIES } from '../data/difficulty';
import { CAMPAIGN, objectiveLabel, STAGE_BY_ID } from '../data/stages';
import { TRAITS } from '../data/traits';
import { UNITS } from '../data/units';
import { rng } from '../engine/geometry';
import { isEndless } from '../engine/setup';
import { isStageUnlocked } from '../progress/profile';
import { session, useSession } from '../session';
import type { UnitId } from '../types';
import { fmt, Stars, UnitIcon } from './common';
import { Button } from '../../components/ui';

function Quiz({ quizId }: { quizId: string }) {
  const q = QUIZZES[quizId];
  const [choice, setChoice] = useState<number | null>(null);
  const [reward, setReward] = useState(0);
  // embaralha as alternativas (a correta não fica sempre na mesma posição)
  const [order] = useState(() => {
    const rand = rng([...quizId].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) + Date.now());
    const idx = q.options.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  });
  const answer = (i: number) => {
    if (choice !== null) return;
    setChoice(i);
    void session.submitQuiz(i).then(setReward);
  };
  return (
    <div className="gd-card gd-quiz">
      <h3 className="gd-h3">
        <Brain size={18} /> Desafio de conhecimento
      </h3>
      <p className="gd-quiz__q">{q.question}</p>
      <div className="gd-quiz__opts">
        {order.map((i) => {
          const state = choice === null ? '' : i === q.correct ? ' is-right' : i === choice ? ' is-wrong' : ' is-dim';
          return (
            <button key={i} type="button" className={`gd-quiz__opt${state}`} onClick={() => answer(i)} disabled={choice !== null}>
              {choice !== null && i === q.correct && <CheckCircle2 size={16} />}
              {choice === i && i !== q.correct && <XCircle size={16} />}
              {q.options[i]}
            </button>
          );
        })}
      </div>
      {choice !== null && (
        <div className={`gd-quiz__fb ${choice === q.correct ? 'is-right' : 'is-wrong'}`}>
          <strong>{choice === q.correct ? `Correto!${reward ? ` +${reward} EC` : ''}` : 'Não é bem assim.'}</strong>
          <p>{q.explanation}</p>
          {choice !== q.correct && <p className="gd-muted">Você pode tentar de novo ao repetir a fase; a recompensa vale no primeiro acerto.</p>}
        </div>
      )}
    </div>
  );
}

export function ResultScreen() {
  const { report, summary, stage, profile } = useSession();
  if (!report || !summary || !stage) return null;
  const endless = isEndless(stage.id);
  const idx = CAMPAIGN.findIndex((s) => s.id === stage.id);
  const next = idx >= 0 ? CAMPAIGN[idx + 1] : undefined;
  const nextOpen = next && isStageUnlocked(profile, next);
  const s = summary.stats;
  const best = (Object.entries(s.damageBy) as [UnitId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totalDmg = best.reduce((n, [, v]) => n + v, 0) || 1;

  return (
    <div className="gd-page gd-result">
      <section className={`gd-result__hero ${report.won ? 'is-won' : 'is-lost'}`}>
        <Trophy size={40} />
        <div>
          <div className="gd-kicker">
            {endless ? 'Modo infinito' : `${stage.id} · ${stage.name}`}
            {report.difficulty && (
              <span className="gd-diffbadge" style={{ ['--diff' as string]: DIFFICULTIES[report.difficulty].color }}>
                {DIFFICULTIES[report.difficulty].name}
              </span>
            )}
          </div>
          <h1 className="gd-h1">{endless ? `Onda ${summary.waves} alcançada` : report.won ? 'Vitória — núcleo protegido' : 'Derrota — núcleo comprometido'}</h1>
          {!endless && report.won && <Stars n={report.stars} size={26} />}
          {report.endlessRecord && <span className="gd-badge-new">Novo recorde!</span>}
          {report.won && report.firstDiffClear && report.difficulty === 'normal' && !endless && (
            <p className="gd-note">Dificuldade Difícil liberada para esta fase.</p>
          )}
          {report.won && report.firstDiffClear && report.difficulty === 'dificil' && <p className="gd-note">Dificuldade Impossível liberada para esta fase.</p>}
          {!report.won && !endless && (
            <p className="gd-text">
              Analise: quais inimigos passaram? Faltou dano em área, golpes fortes contra blindagem, proteção contra interferência ou
              economia no início? Ajuste a equipe e o posicionamento.
            </p>
          )}
        </div>
      </section>

      <div className="gd-result__grid">
        <section className="gd-card">
          <h3 className="gd-h3">Recompensas</h3>
          <div className="gd-rewards">
            <div>
              <span>XP</span>
              <strong>+{fmt(report.xp)}</strong>
            </div>
            <div>
              <span>Energia concatenada (EC)</span>
              <strong>+{fmt(report.ec)}</strong>
            </div>
            {report.levelAfter > report.levelBefore && (
              <div className="is-up">
                <span>Nível do engenheiro</span>
                <strong>
                  {report.levelBefore} → {report.levelAfter}
                </strong>
              </div>
            )}
          </div>
          {!endless && report.won && (
            <ul className="gd-objs">
              <li className="is-done">
                <CheckCircle2 size={16} /> Proteger o núcleo
              </li>
              {stage.objectives.map((o, i) => (
                <li key={i} className={report.objectives[i] ? 'is-done' : ''}>
                  {report.objectives[i] ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {objectiveLabel(o)}
                  {report.newObjectives[i] && <span className="gd-badge-new">+25 EC</span>}
                </li>
              ))}
            </ul>
          )}
          {report.unlockedUnits.length > 0 && (
            <div className="gd-unlocks">
              {report.unlockedUnits.map((u) => (
                <div key={u} className="gd-unlock">
                  <Sparkles size={16} />
                  <UnitIcon id={u} size={56} />
                  <div>
                    <span className="gd-kicker">Nova unidade</span>
                    <strong>{UNITS[u].name}</strong>
                    <span>{UNITS[u].role}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {report.unlockedTraits.map((t) => (
            <div key={t} className="gd-unlock gd-unlock--trait">
              <Sparkles size={16} />
              <div>
                <span className="gd-kicker">Nova característica</span>
                <strong style={{ color: TRAITS[t].color }}>{TRAITS[t].name}</strong>
                <span>{TRAITS[t].desc}</span>
              </div>
            </div>
          ))}
          {report.achievements.map((id) => {
            const a = ACHIEVEMENTS.find((x) => x.id === id)!;
            return (
              <div key={id} className="gd-unlock gd-unlock--ach">
                <Award size={18} />
                <div>
                  <span className="gd-kicker">Conquista</span>
                  <strong>{a.name}</strong>
                  <span>
                    {a.desc} (+{a.ec} EC)
                  </span>
                </div>
              </div>
            );
          })}
        </section>

        <section className="gd-card">
          <h3 className="gd-h3">Relatório da partida</h3>
          <dl className="gd-kv">
            <div>
              <dt>Falhas eliminadas</dt>
              <dd>{s.kills}</dd>
            </div>
            <div>
              <dt>Vidas perdidas</dt>
              <dd>{s.leaks}</dd>
            </div>
            <div>
              <dt>Créditos obtidos / gastos</dt>
              <dd>
                {fmt(s.earned)} / {fmt(s.spent)}
              </dd>
            </div>
            <div>
              <dt>Unidades (máx. simultâneas)</dt>
              <dd>
                {s.placed} ({s.maxUnits})
              </dd>
            </div>
            <div>
              <dt>Melhorias</dt>
              <dd>{s.upgrades}</dd>
            </div>
            <div>
              <dt>Classes usadas</dt>
              <dd>{s.classes.length}</dd>
            </div>
            <div>
              <dt>Duração (tempo de jogo)</dt>
              <dd>
                {Math.floor(s.time / 60)} min {Math.round(s.time % 60)} s
              </dd>
            </div>
          </dl>
          <div className="gd-sub">Dano por componente</div>
          <ul className="gd-dmg">
            {best.map(([id, v]) => (
              <li key={id}>
                <UnitIcon id={id} size={26} />
                <span>{UNITS[id].short}</span>
                <span className="gd-dmg__bar">
                  <span style={{ width: `${(v / totalDmg) * 100}%`, background: UNITS[id].color }} />
                </span>
                <span className="mono">{fmt(v)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {endless && report.capsules.length > 0 && (
        <section className="gd-card">
          <h3 className="gd-h3">Cápsulas Energéticas</h3>
          <ul className="gd-tips">
            {report.capsules.map((c) => (
              <li key={c.milestone}>
                Onda {c.milestone}:{' '}
                {!c.got
                  ? 'sem cápsula (verificação de 50%)'
                  : c.content?.kind === 'secret'
                    ? 'Unidade Secreta!'
                    : `+${c.content?.kind === 'ec' ? c.content.amount : 0} EC`}
              </li>
            ))}
          </ul>
          <p className="gd-note">As cápsulas são creditadas no momento em que são abertas; a recompensa acima já está no seu perfil.</p>
        </section>
      )}

      {report.quizPending && stage.quiz && <Quiz quizId={stage.quiz} />}

      <div className="gd-result__actions">
        <Button icon={<RotateCcw />} onClick={() => session.restartMatch()}>
          Jogar novamente
        </Button>
        {report.won && next && nextOpen && (
          <Button variant="primary" icon={<ArrowRight />} onClick={() => session.go({ id: 'loadout', stageId: next.id, difficulty: 'normal' })}>
            Próxima fase: {next.id} {STAGE_BY_ID[next.id].name}
          </Button>
        )}
        <Button icon={<MapIcon />} onClick={() => session.go({ id: endless || stage.mode !== 'campaign' ? 'modes' : 'campaign' })}>
          {endless || stage.mode !== 'campaign' ? 'Modos de jogo' : 'Seleção de fases'}
        </Button>
        <Button variant="ghost" icon={<Home />} onClick={() => session.go({ id: 'menu' })}>
          Início
        </Button>
      </div>
    </div>
  );
}
