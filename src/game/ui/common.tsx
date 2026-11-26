import { useEffect, useRef, type ReactNode } from 'react';
import { Star } from 'lucide-react';
import { ENEMIES } from '../data/enemies';
import { MAPS, MAP_H, MAP_W } from '../data/maps';
import { CLASS_LABEL, UNITS } from '../data/units';
import type { EnemyInst } from '../engine/GameEngine';
import { drawMapBackground } from '../render/renderer';
import { drawEnemy, drawUnit } from '../render/sprites';
import type { EnemyId, MapId, Tier, UnitId } from '../types';
import { Button } from '../../components/ui';

/** Desenha uma unidade com o mesmo sprite do mapa. */
export function UnitIcon({ id, tier = 0, level = 0, size = 44, dim }: { id: UnitId; tier?: Tier; level?: number; size?: number; dim?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawUnit(ctx, id, size / 2, size / 2 - (level ? 2 : 0), { tier, level, fire: 0, aim: 0, charge: 0.7, stunned: false, t: 0.5 }, size / 52);
  }, [id, tier, level, size]);
  return <canvas ref={ref} className={`gd-icon${dim ? ' is-dim' : ''}`} style={{ width: size, height: size }} aria-hidden />;
}

export function EnemyIcon({ id, size = 34 }: { id: EnemyId; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d')!;
    const def = ENEMIES[id];
    const s = (size / ((def.radius + 10) * 2)) * dpr;
    ctx.setTransform(s, 0, 0, s, (size * dpr) / 2, (size * dpr) / 2);
    const fake = { def, x: 0, y: 0, angle: 0, flash: 0, uid: 3, tA: 2, magTaken: 0, maxHp: 1, shield: 0, toggled: false } as unknown as EnemyInst;
    drawEnemy(ctx, fake, 0.4, false, false);
  }, [id, size]);
  return <canvas ref={ref} className="gd-icon" style={{ width: size, height: size }} aria-hidden />;
}

/** Miniatura estática do mapa (prévia na seleção de fases). */
export function MapPreview({ map }: { map: MapId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = MAP_W;
    c.height = MAP_H;
    const ctx = c.getContext('2d')!;
    drawMapBackground(ctx, MAPS[map]);
    const core = MAPS[map].core;
    ctx.fillStyle = '#3d9bff';
    ctx.beginPath();
    ctx.arc(core.x, core.y, 16, 0, Math.PI * 2);
    ctx.fill();
  }, [map]);
  return <canvas ref={ref} className="gd-mapprev" aria-label={`Mapa: ${MAPS[map].name}`} />;
}

export function Stars({ n, max = 3, size = 16 }: { n: number; max?: number; size?: number }) {
  return (
    <span className="gd-stars" aria-label={`${n} de ${max} estrelas`}>
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} size={size} className={i < n ? 'is-on' : ''} />
      ))}
    </span>
  );
}

export function ClassTags({ id }: { id: UnitId }) {
  return (
    <span className="gd-tags">
      {UNITS[id].classes.map((c) => (
        <span key={c} className={`gd-tag gd-tag--${c.toLowerCase()}`}>
          {CLASS_LABEL[c]}
        </span>
      ))}
    </span>
  );
}

export function Modal({
  title,
  children,
  onClose,
  actions,
  wide,
}: {
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="gd-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className={`gd-modal__box${wide ? ' is-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h3 className="gd-modal__title">{title}</h3>
        <div className="gd-modal__body">{children}</div>
        <div className="gd-modal__actions">{actions ?? <Button onClick={onClose}>Fechar</Button>}</div>
      </div>
    </div>
  );
}

export function Meter({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'green' | 'amber' | 'red' | 'violet' }) {
  return (
    <span className={`gd-meter gd-meter--${tone}`}>
      <span style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </span>
  );
}

/** Número em pt-BR; inteiros não mostram casas decimais. */
export const fmt = (v: number, d = 0) => {
  const dd = Number.isInteger(Math.round(v * 1e6) / 1e6) ? 0 : d;
  return v.toLocaleString('pt-BR', { minimumFractionDigits: dd, maximumFractionDigits: dd });
};
export const pct = (v: number) => `${Math.round(v * 100)}%`;
