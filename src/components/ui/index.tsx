import { useMemo, type CSSProperties, type ReactNode } from 'react';
import katex from 'katex';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, StickyNote } from 'lucide-react';

/* ---------------- Botões ---------------- */

type BtnVariant = 'default' | 'primary' | 'ghost' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  icon?: ReactNode;
  iconOnly?: boolean;
}

export function Button({
  variant = 'default',
  size = 'md',
  active,
  icon,
  iconOnly,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const cls = [
    'btn',
    variant !== 'default' && `btn--${variant}`,
    size !== 'md' && `btn--${size}`,
    active && 'btn--active',
    iconOnly && 'btn--icon',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {icon}
      {!iconOnly && children}
    </button>
  );
}

/* ---------------- Slider ---------------- */

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  warnAbove?: number;
  hint?: ReactNode;
  disabled?: boolean;
  /** escala logarítmica (útil para L e R com várias décadas) */
  log?: boolean;
}

export function Slider({ label, value, min, max, step, onChange, format, warnAbove, hint, disabled, log }: SliderProps) {
  const warn = warnAbove !== undefined && value > warnAbove;
  const toPos = (v: number) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
  const fromPos = (p: number) => {
    const raw = log ? min * Math.pow(max / min, p) : min + p * (max - min);
    const snapped = Math.round(raw / step) * step;
    return Math.min(max, Math.max(min, Number(snapped.toFixed(6))));
  };
  const pos = toPos(value);
  return (
    <label className="field">
      <span className="field__top">
        <span className="field__label">{label}</span>
        <span className={`field__value${warn ? ' is-warn' : ''}`}>{format(value)}</span>
      </span>
      <input
        className={`range${warn ? ' is-warn' : ''}`}
        type="range"
        min={0}
        max={1000}
        step={1}
        value={Math.round(pos * 1000)}
        disabled={disabled}
        style={{ '--fill': `${pos * 100}%` } as CSSProperties}
        onChange={(e) => onChange(fromPos(Number(e.target.value) / 1000))}
        aria-label={label}
      />
      <span className="field__hint">
        <span>{format(min)}</span>
        {hint && <span>{hint}</span>}
        <span>{format(max)}</span>
      </span>
    </label>
  );
}

/* ---------------- Toggle ---------------- */

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="toggle" style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span className="toggle__track" />
    </label>
  );
}

/* ---------------- Segmentado ---------------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { id: T; label: ReactNode }[];
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          className={o.id === value ? 'is-on' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Painel ---------------- */

export function Panel({
  title,
  icon,
  actions,
  children,
  className = '',
  bodyClassName = '',
  style,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={`panel ${className}`} style={style}>
      {(title || actions) && (
        <header className="panel__head">
          {title && (
            <h3 className="panel__title">
              {icon}
              {title}
            </h3>
          )}
          {actions && <div className="panel__actions">{actions}</div>}
        </header>
      )}
      <div className={`panel__body ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/* ---------------- Callout ---------------- */

const CALLOUT_ICONS = {
  info: Info,
  warn: AlertTriangle,
  danger: OctagonAlert,
  ok: CheckCircle2,
  note: StickyNote,
};

export function Callout({
  kind = 'info',
  children,
  title,
}: {
  kind?: keyof typeof CALLOUT_ICONS;
  children: ReactNode;
  title?: ReactNode;
}) {
  const Icon = CALLOUT_ICONS[kind];
  return (
    <div className={`callout callout--${kind}`}>
      <Icon />
      <div>
        {title && <strong style={{ display: 'block', marginBottom: 2, color: 'var(--text)' }}>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

/* ---------------- Badge / LED / Kbd ---------------- */

export function Badge({
  tone,
  children,
}: {
  tone?: 'accent' | 'green' | 'orange' | 'red' | 'cyan';
  children: ReactNode;
}) {
  return <span className={`badge${tone ? ` badge--${tone}` : ''}`}>{children}</span>;
}

export function Led({ on, color = 'green' }: { on: boolean; color?: 'green' | 'amber' | 'red' | 'blue' }) {
  const cls = on ? (color === 'green' ? 'led led--on' : `led led--${color}`) : 'led';
  return <span className={cls} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}

/* ---------------- Leituras ---------------- */

export function Readout({
  label,
  value,
  tone,
  title,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: 'green' | 'amber' | 'orange' | 'red' | 'plain';
  title?: string;
}) {
  return (
    <div className={`readout${tone ? ` readout--${tone}` : ''}`} title={title}>
      <div className="readout__label">{label}</div>
      <div className="readout__value">{value}</div>
    </div>
  );
}

/* ---------------- Fórmulas (KaTeX) ---------------- */

export function Tex({ children, display = false }: { children: string; display?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(children, { displayMode: display, throwOnError: false, strict: false }),
    [children, display],
  );
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Formula({
  tex,
  label,
  vars,
  compact,
  children,
}: {
  tex: string;
  label?: string;
  vars?: [string, ReactNode][];
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`formula${compact ? ' formula--compact' : ''}`}>
      {label && <div className="formula__label">{label}</div>}
      <div className="formula__tex">
        <Tex display>{tex}</Tex>
      </div>
      {vars && (
        <dl className="formula__vars">
          {vars.map(([k, v]) => (
            <FormulaVar key={k} sym={k} desc={v} />
          ))}
        </dl>
      )}
      {children}
    </div>
  );
}

function FormulaVar({ sym, desc }: { sym: string; desc: ReactNode }) {
  return (
    <>
      <dt>
        <Tex>{sym}</Tex>
      </dt>
      <dd>{desc}</dd>
    </>
  );
}
