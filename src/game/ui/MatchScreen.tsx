import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, FastForward, Heart, LogOut, Pause, Play, RotateCcw, Skull, Waves, X, Zap } from 'lucide-react';
import { registerTickable, unregisterTickable } from '../../simulations/engine';
import { DIFFICULTIES, MODIFIERS } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { RARITIES, UNITS } from '../data/units';
import type { GameEngine } from '../engine/GameEngine';
import { placeCost } from '../engine/stats';
import { Renderer, type RenderUi } from '../render/renderer';
import { session, useEngineVersion, useSession } from '../session';
import type { EnemyId, TargetPriority, UnitId, Vec } from '../types';
import { EnemyIcon, fmt, Modal, UnitIcon } from './common';
import { UnitPanel } from './UnitPanel';
import { Button } from '../../components/ui';

const PRIO_CYCLE: TargetPriority[] = ['primeiro', 'ultimo', 'resistente', 'objetivo'];

function WavePreview({ eng }: { eng: GameEngine }) {
  const w = eng.peekWave();
  if (!w) return <p className="gd-muted">Última onda em andamento.</p>;
  const counts = new Map<EnemyId, number>();
  for (const g of w.groups) counts.set(g.enemy, (counts.get(g.enemy) ?? 0) + g.count);
  return (
    <div className="gd-wavepreview">
      {[...counts].map(([id, n]) => (
        <span key={id} className={`gd-enemychip${ENEMIES[id].boss ? ' is-boss' : ''}`} title={ENEMIES[id].traits.join(' · ')}>
          <EnemyIcon id={id} size={24} /> {ENEMIES[id].name} × {n}
        </span>
      ))}
    </div>
  );
}

function Hud({ eng, onExit, onQuit, onRestart }: { eng: GameEngine; onExit: () => void; onQuit: () => void; onRestart: () => void }) {
  const total = Number.isFinite(eng.totalWaves) ? eng.totalWaves : null;
  const waveNum = Math.max(0, eng.wave + 1);
  const next = eng.wave + 1;
  let label = '';
  if (eng.phase === 'prep') label = eng.wave < 0 ? 'Iniciar primeira onda' : `Iniciar onda ${next + 1}`;
  else if (eng.canCallWave) label = `Antecipar onda ${next + 1} (+${Math.round(eng.waveBonus(next) * 1.25)})`;
  else label = total !== null && eng.wave + 1 >= total ? 'Última onda' : 'Onda em andamento';
  return (
    <div className="gd-hud">
      <button type="button" className="gd-back" onClick={onExit} title="Voltar ao EMLab (a partida fica pausada)">
        <ArrowLeft size={16} />
      </button>
      <div className="gd-hud__stage">
        <strong>{eng.config.stage.name}</strong>
        <span>{eng.config.stage.id.startsWith('E-') ? 'Modo infinito' : eng.config.stage.concept}</span>
      </div>
      <div className="gd-hud__stat" title="Créditos de engenharia">
        <Zap size={16} className="is-amber" />
        <span className="mono">{fmt(eng.credits)}</span>
      </div>
      <div className={`gd-hud__stat${eng.lives <= eng.maxLives * 0.3 ? ' is-danger' : ''}`} title="Vidas do núcleo">
        <Heart size={16} className="is-red" />
        <span className="mono">
          {eng.lives}/{eng.maxLives}
        </span>
      </div>
      <div className="gd-hud__stat" title="Onda atual">
        <Waves size={16} className="is-cyan" />
        <span className="mono">
          {waveNum}/{total ?? '∞'}
        </span>
        {total !== null && (
          <span className="gd-wavebar">
            <span style={{ width: `${(waveNum / total) * 100}%` }} />
          </span>
        )}
      </div>
      <div className="gd-hud__stat" title="Inimigos no mapa">
        <Skull size={16} />
        <span className="mono">{eng.aliveEnemies}</span>
      </div>
      <div className="gd-hud__ctl">
        <div className="seg" role="radiogroup" aria-label="Velocidade">
          {([1, 2, 3] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={eng.speed === s} className={eng.speed === s ? 'is-on' : ''} onClick={() => eng.setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
        <Button size="sm" iconOnly icon={eng.paused ? <Play /> : <Pause />} onClick={() => eng.setPaused(!eng.paused)} title={eng.paused ? 'Continuar (Espaço)' : 'Pausar (Espaço)'} />
        <label className="gd-auto" title="Iniciar a próxima onda automaticamente após 3 s">
          <input type="checkbox" checked={eng.autoStart} onChange={(e) => eng.setAutoStart(e.target.checked)} /> Auto
        </label>
        <Button
          variant={eng.phase === 'prep' ? 'primary' : 'default'}
          size="sm"
          icon={<FastForward />}
          disabled={!eng.canCallWave}
          onClick={() => eng.startWave()}
          title="Próxima onda (N)"
          className={eng.phase === 'prep' ? 'gd-pulse' : ''}
        >
          {label}
          {eng.phase === 'prep' && eng.autoStart && eng.wave >= 0 ? ` (${Math.ceil(eng.prepTimer)} s)` : ''}
        </Button>
        <Button size="sm" iconOnly variant="ghost" icon={<RotateCcw />} onClick={onRestart} title="Reiniciar partida" />
        <Button size="sm" iconOnly variant="ghost" icon={<LogOut />} onClick={onQuit} title="Abandonar e voltar ao menu" />
      </div>
    </div>
  );
}

/** Dificuldade, modificadores ativos (com tempo) e avisos de economia. */
function ModBar({ eng }: { eng: GameEngine }) {
  const d = eng.config.difficulty;
  if (!d && eng.time >= eng.incomeHaltUntil) return null;
  const dd = d ? DIFFICULTIES[d] : null;
  return (
    <div className="gd-modbar">
      {dd && (
        <span className="gd-diffbadge" style={{ ['--diff' as string]: dd.color }} title={dd.desc}>
          {dd.name}
        </span>
      )}
      {eng.modifiers.map((m) => {
        const def = MODIFIERS[m];
        const on = eng.modActive(m);
        const timer = eng.modTimer(m);
        return (
          <span
            key={m}
            className={`gd-modchip${on ? ' is-on' : ''}`}
            style={{ ['--mod' as string]: def.color }}
            title={`${def.desc}\nContrajogo: ${def.counter}\n${def.tech}`}
          >
            <Zap size={12} /> {def.name}
            <em>{timer === null ? 'permanente' : on ? `ativo · ${Math.ceil(timer)} s` : `em ${Math.ceil(timer)} s`}</em>
          </span>
        );
      })}
      {eng.time < eng.incomeHaltUntil && (
        <span className="gd-modchip is-on" style={{ ['--mod' as string]: '#ff4d4d' }}>
          Rejeição de carga: sem geração por {Math.ceil(eng.incomeHaltUntil - eng.time)} s
        </span>
      )}
    </div>
  );
}

/** Abertura da Cápsula Energética (modo infinito). */
function CapsuleOverlay() {
  const { capsule } = useSession();
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    setOpened(false);
    if (!capsule) return;
    const t = window.setTimeout(() => setOpened(true), 1400);
    return () => window.clearTimeout(t);
  }, [capsule]);
  if (!capsule) return null;
  const c = capsule.roll.content;
  const secret = c?.kind === 'secret';
  const sc = UNITS.supercondutor;
  return (
    <div className={`gd-capsule${opened ? ' is-open' : ''}${secret ? ' is-secret' : ''}`} role="dialog" aria-modal="true" aria-label="Cápsula Energética">
      <div className="gd-capsule__card">
        <div className="gd-kicker">Onda {capsule.roll.milestone} · Cápsula Energética</div>
        <div className="gd-capsule__orb" aria-hidden="true">
          <span />
          <i />
          <i />
          <i />
        </div>
        {!opened ? (
          <p className="gd-capsule__msg">Concatenando energia…</p>
        ) : secret && capsule.newSecret ? (
          <div className="gd-capsule__reward">
            <span className="gd-rarity" style={{ color: RARITIES.secreto.color }}>
              Unidade Secreta descoberta
            </span>
            <UnitIcon id="supercondutor" size={72} />
            <strong>{sc.name}</strong>
            <p>{sc.role}</p>
            <p className="gd-muted">Entra na sua coleção quando o servidor confirmar a partida (1 unidade Mítica ou Secreta por equipe).</p>
          </div>
        ) : (
          <div className="gd-capsule__reward">
            {secret && <p className="gd-muted">Você já possui a unidade secreta: a cápsula foi convertida em energia.</p>}
            <strong className="gd-capsule__ec">+{capsule.ec} EC</strong>
            <p className="gd-muted">Confirmada pelo servidor ao encerrar a partida.</p>
          </div>
        )}
        <Button variant="primary" disabled={!opened} onClick={() => session.closeCapsule()}>
          Coletar e continuar
        </Button>
      </div>
    </div>
  );
}

function BossBar({ eng }: { eng: GameEngine }) {
  const b = eng.boss;
  if (!b) return null;
  const phases = b.def.behavior.phases ?? [];
  return (
    <div className="gd-bossbar">
      <div className="gd-bossbar__top">
        <Skull size={14} />
        <strong>{b.def.name}</strong>
        <span className="mono">
          {fmt(Math.max(0, b.hp))}/{fmt(b.maxHp)}
        </span>
      </div>
      <div className="gd-bossbar__track">
        <span style={{ width: `${Math.max(0, b.hp / b.maxHp) * 100}%`, background: b.def.color }} />
        {b.shield > 0 && <i style={{ width: `${Math.min(1, b.shield / b.maxHp) * 100}%` }} />}
        {phases.map((p, k) => (
          <b key={p} className={k < b.phase ? 'is-past' : ''} style={{ left: `${p * 100}%` }} title={`Mudança de fase em ${Math.round(p * 100)}%`} />
        ))}
      </div>
      <span className="gd-bossbar__hint">{b.def.traits.slice(1).join(' · ')}</span>
    </div>
  );
}

function UnitBar({ eng, placing, onPick }: { eng: GameEngine; placing: UnitId | null; onPick: (id: UnitId) => void }) {
  return (
    <div className="gd-unitbar" role="toolbar" aria-label="Unidades da equipe">
      {eng.config.loadout.map((entry, i) => {
        const def = UNITS[entry.id];
        const cost = placeCost(entry);
        const count = eng.countOf(entry.id);
        const full = count >= def.limit;
        const poor = eng.credits < cost;
        return (
          <button
            key={entry.id}
            type="button"
            className={`gd-ucard${placing === entry.id ? ' is-on' : ''}${poor || full ? ' is-off' : ''}`}
            onClick={() => onPick(entry.id)}
            title={`${def.tiers[entry.tier].name} — ${def.role}`}
          >
            <span className="gd-ucard__key">{i + 1}</span>
            <UnitIcon id={entry.id} tier={entry.tier} size={40} />
            <span className="gd-ucard__name">{def.short}</span>
            <span className={`gd-ucard__cost mono${poor ? ' is-poor' : ''}`}>
              <Zap size={11} />
              {cost}
            </span>
            <span className="gd-ucard__count mono">
              {count}/{def.limit}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function MatchScreen({ engine: eng, onExit }: { engine: GameEngine; onExit: () => void }) {
  useEngineVersion(eng);
  const capsuleOpen = !!useSession().capsule;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [placing, setPlacing] = useState<UnitId | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [touchGhost, setTouchGhost] = useState<Vec | null>(null);
  const [confirm, setConfirm] = useState<'quit' | 'restart' | null>(null);
  const ui = useRef<RenderUi>({ placing: null, ghost: null, ghostOk: false, ghostReason: '', selected: null, hover: null });

  ui.current.placing = placing;
  ui.current.selected = selected;

  // canvas: ajuste de tamanho
  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const r = new Renderer(canvas);
    rendererRef.current = r;
    const ro = new ResizeObserver(() => r.fit(wrap.clientWidth, wrap.clientHeight));
    ro.observe(wrap);
    r.fit(wrap.clientWidth, wrap.clientHeight);
    return () => ro.disconnect();
  }, []);

  // desenho a cada quadro, no mesmo ticker global que avança a engine
  useEffect(() => {
    const drawer = { tick: () => rendererRef.current?.draw(eng, ui.current) };
    registerTickable(drawer);
    return () => unregisterTickable(drawer);
  }, [eng]);

  // unidade selecionada que foi vendida
  const sel = selected !== null ? eng.unit(selected) : undefined;
  useEffect(() => {
    if (selected !== null && !sel) setSelected(null);
  }, [selected, sel]);

  const updateGhost = useCallback(
    (p: Vec | null) => {
      ui.current.ghost = p;
      if (p && ui.current.placing) {
        const r = eng.canPlace(ui.current.placing, p.x, p.y);
        ui.current.ghostOk = r.ok;
        ui.current.ghostReason = r.reason ?? '';
      }
    },
    [eng],
  );

  const pick = useCallback(
    (id: UnitId) => {
      setTouchGhost(null);
      setSelected(null);
      setPlacing((cur) => (cur === id ? null : id));
    },
    [],
  );

  const cancel = useCallback(() => {
    setPlacing(null);
    setTouchGhost(null);
    ui.current.ghost = null;
  }, []);

  const tryPlace = (p: Vec, keep: boolean) => {
    if (!placing) return;
    const r = eng.place(placing, p.x, p.y);
    if (r.ok && !keep) cancel();
    else updateGhost(p);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const r = rendererRef.current;
    if (!r || e.pointerType === 'touch') return;
    const p = r.toWorld(e.clientX, e.clientY);
    ui.current.hover = p;
    updateGhost(placing ? p : null);
  };

  const onPointerLeave = () => {
    ui.current.hover = null;
    if (!touchGhost) ui.current.ghost = null;
  };

  const onClick = (e: React.PointerEvent) => {
    const r = rendererRef.current;
    if (!r || e.button !== 0) return;
    const p = r.toWorld(e.clientX, e.clientY);
    if (placing) {
      if (e.pointerType === 'touch') {
        // toque: mostrar prévia e pedir confirmação
        setTouchGhost(p);
        updateGhost(p);
        return;
      }
      tryPlace(p, e.shiftKey);
      return;
    }
    const hit = eng.units.find((u) => (u.x - p.x) ** 2 + (u.y - p.y) ** 2 <= 20 * 20);
    setSelected(hit ? hit.uid : null);
  };

  // atalhos da partida
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || confirm || capsuleOpen) return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'SELECT' || tgt.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if (/^[1-5]$/.test(k)) {
        const entry = eng.config.loadout[Number(k) - 1];
        if (entry) pick(entry.id);
        return;
      }
      if (k === 'escape') {
        if (placing) cancel();
        else setSelected(null);
        return;
      }
      if (k === ' ') {
        e.preventDefault();
        eng.setPaused(!eng.paused);
        return;
      }
      if (k === 'n') eng.startWave();
      const u = selected !== null ? eng.unit(selected) : undefined;
      if (!u) return;
      if (k === 'u') eng.upgrade(u.uid); // ramos são escolhidos no painel
      if (k === 'q') eng.useAbility(u.uid);
      if (k === 't') eng.setPriority(u.uid, PRIO_CYCLE[(PRIO_CYCLE.indexOf(u.priority) + 1) % PRIO_CYCLE.length]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [eng, placing, selected, confirm, pick, cancel, capsuleOpen]);

  const over = eng.isOver;
  const placingDef = placing ? UNITS[placing] : null;

  return (
    <div className="gd-match">
      <Hud
        eng={eng}
        onExit={onExit}
        onQuit={() => {
          eng.setPaused(true);
          setConfirm('quit');
        }}
        onRestart={() => {
          eng.setPaused(true);
          setConfirm('restart');
        }}
      />
      <ModBar eng={eng} />
      <div className="gd-match__body">
        <div className="gd-arena" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            className={`gd-canvas${placing ? ' is-placing' : ''}`}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            onPointerUp={onClick}
            onContextMenu={(e) => {
              e.preventDefault();
              cancel();
              setSelected(null);
            }}
          />
          <BossBar eng={eng} />
          <CapsuleOverlay />
          {eng.paused && !over && !confirm && !capsuleOpen && (
            <button type="button" className="gd-pauseov" onClick={() => eng.setPaused(false)}>
              <Play size={28} />
              <span>Partida pausada — clique ou pressione Espaço para continuar</span>
            </button>
          )}
          {placingDef && (
            <div className="gd-placehint">
              Posicionando <strong>{placingDef.short}</strong> · clique em uma área livre fora do caminho
              {touchGhost ? '' : ' · Shift mantém a seleção · Esc/botão direito cancela'}
            </div>
          )}
          {touchGhost && placing && (
            <div className="gd-touchconfirm">
              <Button variant="primary" size="sm" icon={<Check />} disabled={!ui.current.ghostOk} onClick={() => tryPlace(touchGhost, false)}>
                Confirmar
              </Button>
              <Button size="sm" icon={<X />} onClick={cancel}>
                Cancelar
              </Button>
              {!ui.current.ghostOk && <span className="gd-touchconfirm__why">{ui.current.ghostReason}</span>}
            </div>
          )}
          {over && (
            <div className={`gd-endov ${eng.phase === 'won' ? 'is-won' : 'is-lost'}`}>
              <strong>{eng.phase === 'won' ? 'Núcleo protegido!' : 'Núcleo comprometido'}</strong>
              <span>Calculando resultados…</span>
            </div>
          )}
        </div>

        <aside className="gd-side">
          {sel ? (
            <UnitPanel eng={eng} u={sel} onClose={() => setSelected(null)} />
          ) : (
            <div className="gd-sideinfo">
              <h3 className="gd-h3">{eng.phase === 'prep' ? 'Próxima onda' : 'Onda seguinte'}</h3>
              <WavePreview eng={eng} />
              {eng.wave < 0 && (
                <p className="gd-text">
                  Posicione suas primeiras unidades e clique em <strong>Iniciar primeira onda</strong>. Fontes DC geram créditos apenas
                  durante as ondas.
                </p>
              )}
              <h3 className="gd-h3">Legenda</h3>
              <ul className="gd-legend">
                <li>
                  <i style={{ background: '#ff9a47' }} /> Protegida por diodo
                </li>
                <li>
                  <i style={{ background: '#45cfe0' }} /> Cadência aumentada (relé/transformador)
                </li>
                <li>
                  <i style={{ background: '#ff5f5f' }} /> Dano aumentado
                </li>
                <li>
                  <i style={{ background: '#39d08a' }} /> Alimentada por fonte
                </li>
                <li>
                  <i style={{ background: '#a28bff' }} /> Afetada por ruído
                </li>
                <li>
                  <i className="is-ring" /> Habilidade disponível (anel dourado)
                </li>
              </ul>
              <h3 className="gd-h3">Atalhos</h3>
              <p className="gd-keys">
                <kbd>1</kbd>–<kbd>5</kbd> unidades · <kbd>U</kbd> melhorar · <kbd>Q</kbd> habilidade · <kbd>T</kbd> prioridade ·{' '}
                <kbd>N</kbd> próxima onda · <kbd>Espaço</kbd> pausa · <kbd>Esc</kbd> cancelar
              </p>
              <h3 className="gd-h3">Desempenho</h3>
              <dl className="gd-kv">
                <div>
                  <dt>Eliminações</dt>
                  <dd>{eng.stats.kills}</dd>
                </div>
                <div>
                  <dt>Vidas perdidas</dt>
                  <dd>{eng.stats.leaks}</dd>
                </div>
                <div>
                  <dt>Créditos obtidos</dt>
                  <dd>{fmt(eng.stats.earned)}</dd>
                </div>
              </dl>
            </div>
          )}
        </aside>
      </div>
      <UnitBar eng={eng} placing={placing} onPick={pick} />

      {confirm && (
        <Modal
          title={confirm === 'quit' ? 'Abandonar a partida?' : 'Reiniciar a partida?'}
          onClose={() => setConfirm(null)}
          actions={
            <>
              <Button onClick={() => setConfirm(null)}>Continuar jogando</Button>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirm(null);
                  if (confirm === 'quit') void session.abandonMatch();
                  else session.restartMatch();
                }}
              >
                {confirm === 'quit' ? 'Abandonar' : 'Reiniciar'}
              </Button>
            </>
          }
        >
          <p>O andamento desta partida será descartado. Seu progresso permanente (fases, evoluções, conquistas) não é afetado.</p>
        </Modal>
      )}
    </div>
  );
}
