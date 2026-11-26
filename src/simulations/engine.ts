/**
 * Infraestrutura de simulação em tempo real:
 *  - SampleBuffer: buffer circular colunar para o osciloscópio.
 *  - Store: padrão subscribe/getSnapshot compatível com useSyncExternalStore.
 *  - Ticker global: um único requestAnimationFrame avança todos os motores.
 *
 * Os motores ficam fora da árvore React, então o estado do circuito persiste ao
 * trocar de modo (apresentação, laboratório, exploração).
 */

export class SampleBuffer {
  readonly capacity: number;
  readonly channels: number;
  private t: Float64Array;
  private data: Float64Array[];
  private head = 0;
  private count = 0;

  constructor(capacity: number, channels: number) {
    this.capacity = capacity;
    this.channels = channels;
    this.t = new Float64Array(capacity);
    this.data = Array.from({ length: channels }, () => new Float64Array(capacity));
  }

  push(t: number, values: number[]): void {
    this.t[this.head] = t;
    for (let c = 0; c < this.channels; c++) this.data[c][this.head] = values[c];
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }

  get size(): number {
    return this.count;
  }

  /** Último instante gravado. */
  get lastT(): number {
    if (this.count === 0) return 0;
    return this.t[(this.head - 1 + this.capacity) % this.capacity];
  }

  /**
   * Retorna amostras em [t0, t1], decimadas para no máximo maxPoints (preserva picos
   * mantendo mínimo e máximo por intervalo).
   */
  range(t0: number, t1: number, channel: number, maxPoints = 900): [number, number][] {
    const out: [number, number][] = [];
    if (this.count === 0) return out;
    const start = (this.head - this.count + this.capacity) % this.capacity;
    const idx: number[] = [];
    for (let k = 0; k < this.count; k++) {
      const j = (start + k) % this.capacity;
      const tt = this.t[j];
      if (tt >= t0 && tt <= t1) idx.push(j);
    }
    if (idx.length <= maxPoints) {
      for (const j of idx) out.push([this.t[j], this.data[channel][j]]);
      return out;
    }
    const buckets = Math.floor(maxPoints / 2);
    const per = idx.length / buckets;
    for (let b = 0; b < buckets; b++) {
      const a = Math.floor(b * per);
      const z = Math.min(idx.length, Math.floor((b + 1) * per));
      let jMin = idx[a];
      let jMax = idx[a];
      for (let k = a; k < z; k++) {
        const j = idx[k];
        if (this.data[channel][j] < this.data[channel][jMin]) jMin = j;
        if (this.data[channel][j] > this.data[channel][jMax]) jMax = j;
      }
      const pair = this.t[jMin] <= this.t[jMax] ? [jMin, jMax] : [jMax, jMin];
      for (const j of pair) out.push([this.t[j], this.data[channel][j]]);
    }
    return out;
  }
}

type Listener = () => void;

export abstract class Store<Snap> {
  private listeners = new Set<Listener>();
  protected snap!: Snap;

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getSnapshot = (): Snap => this.snap;

  protected emit(): void {
    this.listeners.forEach((l) => l());
  }

  get hasListeners(): boolean {
    return this.listeners.size > 0;
  }
}

export interface Tickable {
  tick(realDt: number): void;
}

const tickables = new Set<Tickable>();
let rafId: number | null = null;
let lastTs = 0;

function loop(ts: number) {
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  tickables.forEach((t) => t.tick(dt));
  rafId = requestAnimationFrame(loop);
}

export function registerTickable(t: Tickable): void {
  tickables.add(t);
  if (rafId === null && typeof requestAnimationFrame !== 'undefined') {
    lastTs = 0;
    rafId = requestAnimationFrame(loop);
  }
}

export function unregisterTickable(t: Tickable): void {
  tickables.delete(t);
}

/** Opções de "câmera lenta": quanto tempo real (s) representa 1 ms simulado. */
export const TIME_SCALES = [
  { id: 'x2000', label: '1 ms ↦ 2 s', simPerReal: 1e-3 / 2 },
  { id: 'x500', label: '1 ms ↦ 0,5 s', simPerReal: 1e-3 / 0.5 },
  { id: 'x100', label: '1 ms ↦ 0,1 s', simPerReal: 1e-3 / 0.1 },
  { id: 'x20', label: '1 ms ↦ 20 ms', simPerReal: 1e-3 / 0.02 },
] as const;
export type TimeScaleId = (typeof TIME_SCALES)[number]['id'];
