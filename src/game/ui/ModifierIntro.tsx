import { useEffect, useRef, useState } from 'react';
import { MODIFIERS, type ModifierId } from '../data/difficulty';
import type { Difficulty } from '../types';
import { DIFFICULTIES } from '../data/difficulty';
import { Button } from '../../components/ui';

/**
 * §11.1 — Apresentação dos modificadores, antes do início do Difícil e do Impossível.
 *
 * Os símbolos e nomes aparecem no CENTRO da tela, são animados saindo do centro e vão para a
 * região superior esquerda, onde ficam fixos durante a partida (a `ModBar` do HUD). A
 * sequência dura cerca de 30 s no total, dividida entre os modificadores sorteados, e pode
 * ser avançada ou ignorada a qualquer momento — sem perder a identificação, porque os
 * indicadores continuam fixos no HUD depois.
 */

/** Duração total da apresentação (s) e mínimo por modificador. */
const TOTAL = 30;
const MIN_PER = 2.2;

export interface ModifierIntroProps {
  modifiers: ModifierId[];
  difficulty: Difficulty;
  onDone: () => void;
}

export function ModifierIntro({ modifiers, difficulty, onDone }: ModifierIntroProps) {
  const [shown, setShown] = useState(0);
  const [flying, setFlying] = useState(false);
  const timers = useRef<number[]>([]);
  const per = Math.max(MIN_PER, TOTAL / Math.max(1, modifiers.length));

  useEffect(() => {
    // revela um modificador por vez; ao fim, anima tudo para o canto e encerra
    for (let i = 0; i < modifiers.length; i++) {
      timers.current.push(window.setTimeout(() => setShown(i + 1), i * per * 1000));
    }
    timers.current.push(window.setTimeout(() => setFlying(true), modifiers.length * per * 1000));
    timers.current.push(window.setTimeout(() => onDone(), modifiers.length * per * 1000 + 1400));
    return () => {
      for (const t of timers.current) window.clearTimeout(t);
      timers.current = [];
    };
  }, [modifiers, per, onDone]);

  // Esc / Enter / clique pulam a apresentação
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onDone();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  const d = DIFFICULTIES[difficulty];

  return (
    <div className={`gd-mintro${flying ? ' is-flying' : ''}`} role="dialog" aria-modal="true" aria-label="Modificadores desta partida">
      <div className="gd-mintro__head">
        <span className="gd-diffbadge" style={{ ['--diff' as string]: d.color }}>
          {d.name}
        </span>
        <strong>
          {modifiers.length} modificador{modifiers.length === 1 ? '' : 'es'} nesta partida
        </strong>
        <span className="gd-muted">
          Vida dos inimigos ×{d.hp.toFixed(2).replace('.', ',')} · velocidade ×{d.speed.toFixed(2).replace('.', ',')}
          {difficulty === 'impossivel' ? ' · resistência progressiva a controle e dano' : ''}
        </span>
      </div>

      <ul className="gd-mintro__list">
        {modifiers.map((id, i) => {
          const m = MODIFIERS[id];
          const visible = i < shown;
          return (
            <li
              key={id}
              className={`gd-mintro__item${visible ? ' is-in' : ''}`}
              style={{ ['--mod' as string]: m.color, ['--i' as string]: String(i) }}
            >
              <span className="gd-mintro__code" aria-hidden="true">
                {m.code}
              </span>
              <span className="gd-mintro__body">
                <strong>{m.name}</strong>
                <span>{m.desc}</span>
                <em className="mono">{m.math}</em>
                <span className="gd-mintro__counter">Contrajogo: {m.counter}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="gd-mintro__foot">
        <Button variant="primary" onClick={onDone}>
          {shown < modifiers.length ? 'Mostrar tudo e começar' : 'Começar'}
        </Button>
        <span className="gd-muted">Os indicadores ficam fixos no canto superior durante a partida (Esc pula).</span>
      </div>
    </div>
  );
}
