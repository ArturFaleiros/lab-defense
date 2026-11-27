import { useEffect, useId, useRef, useState } from 'react';
import type { EffectCode, StatSource } from '../engine/GameEngine';

/**
 * §5 — Indicadores de efeito (buffs, debuffs e dano contínuo).
 *
 * Cada efeito aparece como uma SIGLA colorida e sublinhada. A cor é um reforço, nunca a
 * única pista: a sigla, o nome completo e o sinal (+/−) identificam o efeito sozinhos, o que
 * mantém a informação acessível para quem não distingue as cores.
 *
 * O tooltip abre no passar do mouse (desktop) e no toque (celular), e traz nome completo,
 * descrição técnica, valor aplicado, duração, origem e, quando existe, a fórmula e os
 * valores anterior e atual.
 */

export type EffectFamily = 'buff' | 'debuff' | 'dot' | 'control' | 'electric' | 'resist';

export interface EffectDef {
  code: EffectCode;
  name: string;
  family: EffectFamily;
  /** o que o efeito faz, em termos de jogo */
  desc: string;
  /** base técnica (eletroeletrônica) */
  tech: string;
  /** fórmula, quando se aplica */
  formula?: string;
}

/** Cores por família. Buffs verde, debuffs vermelho, DOT laranja, controle azul, elétricos ciano/amarelo, resistências roxo. */
export const FAMILY_COLOR: Record<EffectFamily, string> = {
  buff: '#39d08a',
  debuff: '#ff5f5f',
  dot: '#ff9a47',
  control: '#3d9bff',
  electric: '#45cfe0',
  resist: '#a28bff',
};

export const FAMILY_LABEL: Record<EffectFamily, string> = {
  buff: 'Benefício',
  debuff: 'Penalidade',
  dot: 'Dano contínuo',
  control: 'Controle',
  electric: 'Efeito elétrico',
  resist: 'Resistência',
};

/** Catálogo dos indicadores padrão (§5). As siglas dos modificadores vêm de MODIFIERS.code. */
export const EFFECTS: Record<string, EffectDef> = {
  ATK: {
    code: 'ATK',
    name: 'Dano',
    family: 'buff',
    desc: 'Multiplica o dano causado pela unidade.',
    tech: 'Representa mais potência entregue à carga — tensão ou corrente maior no estágio de saída.',
    formula: 'dano final = dano após melhorias × multiplicador total',
  },
  SPD: {
    code: 'SPD',
    name: 'Velocidade de ataque',
    family: 'buff',
    desc: 'Altera a cadência: quanto maior, menor o intervalo entre ações.',
    tech: 'Equivale à frequência de operação do circuito — quantas vezes por segundo ele comuta.',
    formula: 'intervalo efetivo = intervalo ÷ multiplicador de cadência',
  },
  RNG: {
    code: 'RNG',
    name: 'Alcance',
    family: 'buff',
    desc: 'Altera o raio de atuação da unidade.',
    tech: 'Representa até onde o campo, o arco ou o sinal da unidade mantém intensidade útil.',
    formula: 'alcance efetivo = alcance × (1 + bônus) × penalidades',
  },
  DOT: {
    code: 'DOT',
    name: 'Dano contínuo',
    family: 'dot',
    desc: 'Dano aplicado repetidamente ao longo do tempo, independente dos golpes.',
    tech: 'Energia que continua sendo dissipada no alvo depois do golpe — calor acumulado ou gás ionizado.',
    formula: 'dano/s = k · n² (n = estágios acumulados)',
  },
  STUN: {
    code: 'STUN',
    name: 'Atordoamento',
    family: 'control',
    desc: 'O alvo para completamente por um intervalo.',
    tech: 'Equivale a abrir o circuito: sem caminho fechado, não há corrente e a carga para.',
  },
  SLOW: {
    code: 'SLOW',
    name: 'Lentidão',
    family: 'control',
    desc: 'Reduz a velocidade do alvo por um intervalo.',
    tech: 'Representa impedância adicional no caminho: a mesma tensão produz menos corrente.',
  },
  BURN: {
    code: 'BURN',
    name: 'Queimadura',
    family: 'dot',
    desc: 'Aquecimento acumulado: causa dano contínuo e impede regeneração.',
    tech: 'Efeito Joule: a potência dissipada é P = I²·R e a temperatura sobe enquanto o calor gerado supera o dissipado.',
    formula: 'P = I²·R',
  },
  SHOCK: {
    code: 'SHOCK',
    name: 'Choque elétrico',
    family: 'electric',
    desc: 'Descarga que atinge o alvo e pode saltar para inimigos próximos.',
    tech: 'Ruptura dielétrica do ar: acima da rigidez dielétrica o meio ioniza e passa a conduzir.',
  },
  OVERLOAD: {
    code: 'OVERLOAD',
    name: 'Sobrecarga',
    family: 'electric',
    desc: 'Operação acima do nominal: mais desempenho agora, penalidade depois.',
    tech: 'Operar além da especificação entrega mais potência, mas o aquecimento obriga a reduzir o regime (derating).',
  },
  RES: {
    code: 'RES',
    name: 'Resistência',
    family: 'resist',
    desc: 'Reduz o dano recebido de um tipo específico, ou de todos.',
    tech: 'Blindagem, isolamento ou saturação que impede parte da energia de chegar ao alvo.',
    formula: 'dano recebido = dano × (1 − resistência)',
  },
  VULN: {
    code: 'VULN',
    name: 'Vulnerabilidade',
    family: 'debuff',
    desc: 'Aumenta o dano recebido pelo alvo.',
    tech: 'O isolamento rompeu ou a junção entrou em condução: a energia agora entra sem barreira.',
    formula: 'dano recebido = dano × (1 + vulnerabilidade)',
  },
};

/** Família de um indicador: do catálogo quando existe, senão derivada do tipo da fonte. */
export function familyOf(src: StatSource): EffectFamily {
  const known = EFFECTS[String(src.code)];
  if (known) {
    // o mesmo código pode ser benefício ou penalidade conforme a origem
    if (src.kind === 'debuff' || src.kind === 'mod') return known.family === 'buff' ? 'debuff' : known.family;
    return known.family;
  }
  return src.kind === 'mod' || src.kind === 'debuff' ? 'debuff' : 'buff';
}

/* ---------------------------------------------------------------------- */
/* Componentes                                                             */
/* ---------------------------------------------------------------------- */

export interface EffectChipProps {
  source: StatSource;
  /** duração restante, em segundos (quando o efeito é temporário) */
  duration?: number | null;
  /** valor antes e depois, para o tooltip */
  before?: string;
  after?: string;
}

/**
 * Indicador individual. Abre o tooltip no hover e no toque; fecha com Esc, com um toque fora
 * ou ao perder o foco. É um `<button>` para ser alcançável pelo teclado.
 */
export function EffectChip({ source, duration, before, after }: EffectChipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const family = familyOf(source);
  const def = EFFECTS[String(source.code)];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className="gd-fxchip__wrap" ref={ref}>
      <button
        type="button"
        className={`gd-fxchip is-${family}`}
        style={{ ['--fx' as string]: FAMILY_COLOR[family] }}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onPointerEnter={(e) => {
          if (e.pointerType !== 'touch') setOpen(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'touch') setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="gd-fxchip__code">{source.code}</span>
        {duration != null && duration > 0 && <span className="gd-fxchip__t mono">{duration.toFixed(1)}s</span>}
      </button>
      {open && (
        <span className="gd-fxtip" role="tooltip" id={id} style={{ ['--fx' as string]: FAMILY_COLOR[family] }}>
          <strong className="gd-fxtip__name">
            {def?.name ?? source.label} <em>({FAMILY_LABEL[family]})</em>
          </strong>
          <span className="gd-fxtip__row">
            <b>Valor aplicado</b> {source.value}
          </span>
          {duration != null && duration > 0 && (
            <span className="gd-fxtip__row">
              <b>Duração restante</b> {duration.toFixed(1)} s
            </span>
          )}
          <span className="gd-fxtip__row">
            <b>Origem</b> {source.label}
            {source.detail && source.detail !== source.label ? ` — ${source.detail}` : ''}
          </span>
          {before != null && after != null && (
            <span className="gd-fxtip__row">
              <b>Antes → agora</b> <span className="mono">{before}</span> → <span className="mono">{after}</span>
            </span>
          )}
          {def && <span className="gd-fxtip__desc">{def.desc}</span>}
          {def?.tech && <span className="gd-fxtip__tech">{def.tech}</span>}
          {def?.formula && <span className="gd-fxtip__formula mono">{def.formula}</span>}
        </span>
      )}
    </span>
  );
}

/** Linha de indicadores de uma unidade. */
export function EffectRow({ sources, max = 12 }: { sources: StatSource[]; max?: number }) {
  if (!sources.length) return <span className="gd-muted">Nenhum efeito ativo.</span>;
  return (
    <span className="gd-fxrow">
      {sources.slice(0, max).map((s, i) => (
        <EffectChip key={`${s.code}-${s.label}-${i}`} source={s} />
      ))}
      {sources.length > max && <span className="gd-muted">+{sources.length - max}</span>}
    </span>
  );
}

/** Legenda das famílias (para o compêndio e a tela de ajustes). */
export function EffectLegend() {
  return (
    <ul className="gd-fxlegend">
      {(Object.keys(FAMILY_COLOR) as EffectFamily[]).map((f) => (
        <li key={f}>
          <i style={{ background: FAMILY_COLOR[f] }} /> {FAMILY_LABEL[f]}
        </li>
      ))}
    </ul>
  );
}
