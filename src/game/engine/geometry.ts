import type { Vec } from '../types';

/** Distância de um ponto a um segmento AB. */
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx - px;
  const cy = ay + t * dy - py;
  return Math.hypot(cx, cy);
}

/** Caminho poligonal parametrizado pela distância percorrida. */
export class PathGeo {
  readonly pts: Vec[];
  readonly cum: number[];
  readonly length: number;

  constructor(pts: Vec[]) {
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) {
      this.cum.push(this.cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    this.length = this.cum[this.cum.length - 1];
  }

  /** Posição e direção (rad) a uma distância d do início. */
  at(d: number, out: { x: number; y: number; angle: number }): void {
    const dd = Math.max(0, Math.min(this.length, d));
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < dd) i++;
    const a = this.pts[i - 1];
    const b = this.pts[i];
    const seg = this.cum[i] - this.cum[i - 1] || 1;
    const t = (dd - this.cum[i - 1]) / seg;
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.angle = Math.atan2(b.y - a.y, b.x - a.x);
  }

  distTo(x: number, y: number): number {
    let best = Infinity;
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1];
      const b = this.pts[i];
      best = Math.min(best, segDist(x, y, a.x, a.y, b.x, b.y));
    }
    return best;
  }

  /** Comprimento do caminho dentro de um círculo (amostrado) — usado nas dicas de posicionamento. */
  coverage(x: number, y: number, r: number, step = 8): number {
    let n = 0;
    const tmp = { x: 0, y: 0, angle: 0 };
    for (let d = 0; d <= this.length; d += step) {
      this.at(d, tmp);
      if ((tmp.x - x) ** 2 + (tmp.y - y) ** 2 <= r * r) n++;
    }
    return n * step;
  }
}

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
