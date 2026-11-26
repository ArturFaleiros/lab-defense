import { useEffect } from 'react';
import { ArrowLeft, Award, BookOpen, Boxes, Gamepad2, Home, Map as MapIcon, Settings, Swords } from 'lucide-react';
import { GameLogo } from './GameLogo';
import { AccessCodeNotice, NickScreen } from './NickScreen';
import { levelInfo } from '../progress/profile';
import { session, useSession, type Screen } from '../session';
import { fmt, Meter } from './common';
import { MenuScreen } from './MenuScreen';
import { CampaignScreen } from './CampaignScreen';
import { ModesScreen } from './ModesScreen';
import { LoadoutScreen } from './LoadoutScreen';
import { MatchScreen } from './MatchScreen';
import { ResultScreen } from './ResultScreen';
import { UnitsScreen } from './UnitsScreen';
import { AchievementsScreen } from './AchievementsScreen';
import { KnowledgeScreen } from './KnowledgeScreen';
import { SettingsScreen } from './SettingsScreen';

const NAV: { id: Screen['id']; label: string; icon: React.ReactNode }[] = [
  { id: 'menu', label: 'Início', icon: <Home /> },
  { id: 'campaign', label: 'Campanha', icon: <MapIcon /> },
  { id: 'modes', label: 'Modos', icon: <Swords /> },
  { id: 'units', label: 'Unidades', icon: <Boxes /> },
  { id: 'achievements', label: 'Conquistas', icon: <Award /> },
  { id: 'knowledge', label: 'Base técnica', icon: <BookOpen /> },
  { id: 'settings', label: 'Ajustes', icon: <Settings /> },
];

/** Jogo completo, independente do EMLab (usado também no Lab Defense). */
export function GameShell({ onBack, backLabel, brand = 'EMLab Defense' }: { onBack?: () => void; backLabel?: string; brand?: string }) {
  const s = useSession();
  const lv = levelInfo(s.profile.xp);
  const inMatch = s.screen.id === 'match';

  // Ao sair da aba do jogo, a partida em andamento é pausada (o estado é preservado)
  useEffect(() => {
    return () => {
      const e = session.state.engine;
      if (e && !e.isOver) e.setPaused(true);
    };
  }, []);

  const back = () => onBack?.();

  if (s.auth !== 'ready') return <NickScreen />;

  return (
    <div className={`gd${inMatch ? ' gd--match' : ''}`}>
      {!inMatch && (
        <header className="gd-top">
          {onBack && (
            <button type="button" className="gd-back" onClick={back} title={`${backLabel} (a partida e o progresso são preservados)`}>
              <ArrowLeft size={16} /> <span className="hide-sm">{backLabel}</span>
            </button>
          )}
          <div className="gd-brand">
            <GameLogo />
            <div>
              <strong>{brand}</strong>
              <span>Operação Circuito</span>
            </div>
          </div>
          <nav className="gd-nav" aria-label="Seções do jogo">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                className={s.screen.id === n.id || (n.id === 'campaign' && s.screen.id === 'loadout') ? 'is-on' : ''}
                onClick={() => session.go({ id: n.id } as Screen)}
              >
                {n.icon}
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
          <div className="gd-profile" title={`${s.nick} · ${fmt(s.profile.xp)} XP · próximo nível em ${fmt(lv.next)} XP`}>
            <span className="gd-profile__nick">{s.nick}</span>
            <span className="gd-profile__lv">Nv {lv.level}</span>
            <Meter value={lv.frac} tone="accent" />
            <span className="gd-profile__cp mono" title="Energia concatenada (EC) — recurso permanente para evoluções">
              {fmt(s.profile.ec)} EC
            </span>
          </div>
        </header>
      )}
      {s.engine && !inMatch && !s.engine.isOver && (
        <button type="button" className="gd-resume" onClick={() => session.go({ id: 'match' })}>
          <Gamepad2 size={16} /> Partida em andamento ({s.stage?.name}) — voltar
        </button>
      )}
      {s.saveFailed && <div className="gd-savewarn">{s.netError ?? 'Não foi possível salvar o progresso no servidor.'} Verifique a conexão.</div>}
      {s.busy === 'verify' && (
        <div className="gd-verify" role="status">
          <span className="gd-verify__spin" /> Servidor verificando a partida (re-simulação dos seus comandos)…
        </div>
      )}
      {s.busy === 'start' && (
        <div className="gd-verify" role="status">
          <span className="gd-verify__spin" /> Preparando a partida no servidor…
        </div>
      )}
      <AccessCodeNotice />

      <div className="gd-screen" key={s.screen.id}>
        {s.screen.id === 'menu' && <MenuScreen />}
        {s.screen.id === 'campaign' && <CampaignScreen />}
        {s.screen.id === 'modes' && <ModesScreen />}
        {s.screen.id === 'loadout' && <LoadoutScreen key={s.screen.stageId + (s.screen.difficulty ?? 'normal')} stageId={s.screen.stageId} difficulty={s.screen.difficulty} />}
        {s.screen.id === 'match' && s.engine && <MatchScreen engine={s.engine} onExit={onBack ?? (() => session.go({ id: 'menu' }))} />}
        {s.screen.id === 'match' && !s.engine && <MenuScreen />}
        {s.screen.id === 'result' && <ResultScreen />}
        {s.screen.id === 'units' && <UnitsScreen initial={s.screen.unit} />}
        {s.screen.id === 'achievements' && <AchievementsScreen />}
        {s.screen.id === 'knowledge' && <KnowledgeScreen initial={s.screen.tab} />}
        {s.screen.id === 'settings' && <SettingsScreen />}
      </div>

      <div className="gd-toasts" aria-live="polite">
        {s.toasts.map((t) => (
          <div key={t.id} className={`gd-toast gd-toast--${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
