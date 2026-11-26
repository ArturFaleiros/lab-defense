import { Award, BookOpen, Boxes, Infinity as InfinityIcon, Map as MapIcon, Play, ShieldCheck, Swords } from 'lucide-react';
import { ACHIEVEMENTS } from '../data/achievements';
import { CAMPAIGN, STAGE_BY_ID } from '../data/stages';
import { UNIT_ORDER } from '../data/units';
import { isEndless } from '../engine/setup';
import { levelInfo, nextCampaignStage, totalStars } from '../progress/profile';
import { session, useSession } from '../session';
import { fmt, Meter, Stars, UnitIcon } from './common';
import { Button } from '../../components/ui';

export function MenuScreen() {
  const { profile } = useSession();
  const next = nextCampaignStage(profile);
  const cleared = CAMPAIGN.filter((s) => profile.stages[s.id]?.cleared).length;
  const lv = levelInfo(profile.xp);
  const achieved = Object.keys(profile.achievements).length;
  const first = cleared === 0;

  return (
    <div className="gd-page gd-menu">
      <section className="gd-hero">
        <div className="gd-hero__text">
          <div className="gd-kicker">Experiência complementar do EMLab</div>
          <h1 className="gd-hero__title">
            EMLab Defense <span>— Operação Circuito</span>
          </h1>
          <p className="gd-hero__sub">
            Anomalias elétricas avançam em direção ao núcleo da instalação. Como engenheiro responsável, posicione componentes
            eletroeletrônicos — relés, bobinas, indutores, diodos, capacitores e circuitos RL — para conter as falhas onda após onda.
          </p>
          <div className="gd-hero__cta">
            <Button variant="primary" size="lg" icon={<Play />} onClick={() => session.go({ id: 'loadout', stageId: next.id })}>
              {first ? 'Jogar' : 'Continuar'}: {next.id} {next.name}
            </Button>
            <Button size="lg" icon={<MapIcon />} onClick={() => session.go({ id: 'campaign' })}>
              Campanha
            </Button>
            <Button size="lg" icon={<InfinityIcon />} onClick={() => session.go({ id: 'modes' })}>
              Modo infinito e desafios
            </Button>
          </div>
          {first && (
            <p className="gd-hero__hint">
              Como jogar: escolha uma unidade na barra inferior (ou teclas 1–5), clique no mapa para posicionar, clique numa unidade
              para melhorá-la e inicie a onda. Cada componente tem uma função técnica — consulte a ficha de cada um durante a partida.
            </p>
          )}
        </div>
        <div className="gd-hero__art" aria-hidden>
          {UNIT_ORDER.map((id, i) => (
            <div key={id} className="gd-hero__unit" style={{ animationDelay: `${i * 0.25}s` }}>
              <UnitIcon id={id} tier={profile.tiers[id] ?? 0} size={58} dim={!profile.units.includes(id)} />
            </div>
          ))}
        </div>
      </section>

      <section className="gd-grid3">
        <button type="button" className="gd-tile" onClick={() => session.go({ id: 'campaign' })}>
          <MapIcon />
          <div>
            <strong>Campanha</strong>
            <span>
              {cleared}/{CAMPAIGN.length} fases · <Stars n={1} max={1} size={12} /> {totalStars(profile)}/{CAMPAIGN.length * 3}
            </span>
          </div>
        </button>
        <button type="button" className="gd-tile" onClick={() => session.go({ id: 'units' })}>
          <Boxes />
          <div>
            <strong>Unidades e evoluções</strong>
            <span>
              {profile.units.length}/{UNIT_ORDER.length} desbloqueadas · {fmt(profile.ec)} EC disponíveis
            </span>
          </div>
        </button>
        <button type="button" className="gd-tile" onClick={() => session.go({ id: 'achievements' })}>
          <Award />
          <div>
            <strong>Conquistas</strong>
            <span>
              {achieved}/{ACHIEVEMENTS.length} obtidas
            </span>
          </div>
        </button>
        <button type="button" className="gd-tile" onClick={() => session.go({ id: 'modes' })}>
          <Swords />
          <div>
            <strong>Modos de jogo</strong>
            <span>Infinito · chefes · desafios técnicos</span>
          </div>
        </button>
        <button type="button" className="gd-tile" onClick={() => session.go({ id: 'knowledge' })}>
          <BookOpen />
          <div>
            <strong>Base técnica</strong>
            <span>Fichas, inimigos, glossário e fórmulas</span>
          </div>
        </button>
        <div className="gd-tile gd-tile--static">
          <ShieldCheck />
          <div>
            <strong>Engenheiro nível {lv.level}</strong>
            <Meter value={lv.frac} />
            <span>
              {fmt(profile.xp - lv.cur)}/{fmt(lv.next - lv.cur)} XP para o próximo nível
            </span>
          </div>
        </div>
      </section>

      <section className="gd-panels2">
        <div className="gd-card">
          <h3 className="gd-h3">Estatísticas</h3>
          <dl className="gd-kv">
            <div>
              <dt>Partidas</dt>
              <dd>
                {profile.stats.matches} ({profile.stats.wins} vitórias)
              </dd>
            </div>
            <div>
              <dt>Falhas eliminadas</dt>
              <dd>{fmt(profile.stats.kills)}</dd>
            </div>
            <div>
              <dt>Chefes derrotados</dt>
              <dd>{profile.stats.bosses}</dd>
            </div>
            <div>
              <dt>Melhor onda (infinito)</dt>
              <dd>{profile.stats.endlessBest || '—'}</dd>
            </div>
            <div>
              <dt>Desafios de conhecimento</dt>
              <dd>
                {profile.stats.quizCorrect}/{profile.stats.quizAnswered} acertos
              </dd>
            </div>
            <div>
              <dt>Tempo de jogo</dt>
              <dd>{Math.round(profile.stats.playTime / 60)} min (tempo de jogo)</dd>
            </div>
          </dl>
        </div>
        <div className="gd-card">
          <h3 className="gd-h3">Histórico recente</h3>
          {profile.history.length === 0 ? (
            <p className="gd-muted">Nenhuma partida registrada ainda.</p>
          ) : (
            <ul className="gd-history">
              {profile.history.slice(0, 7).map((h) => (
                <li key={h.date}>
                  <span className={`gd-dot ${h.won ? 'is-ok' : 'is-bad'}`} />
                  <span className="gd-history__name">{isEndless(h.stage) ? `Infinito (${h.stage.slice(2)})` : `${h.stage} · ${STAGE_BY_ID[h.stage]?.name ?? ''}`}</span>
                  <span className="gd-muted mono">{isEndless(h.stage) ? `onda ${h.wave}` : h.won ? <Stars n={h.stars} size={12} /> : `derrota · onda ${h.wave}`}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="gd-note">Progresso salvo apenas neste navegador (armazenamento local, sem sincronização em nuvem).</p>
        </div>
      </section>
    </div>
  );
}
