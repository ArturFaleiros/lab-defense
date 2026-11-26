import { RARITIES, UNITS } from '../data/units';
import type { EnemyInst } from '../engine/GameEngine';
import type { Tier, UnitId } from '../types';

/**
 * Desenhos procedurais (canvas 2D) das unidades e inimigos. A mesma função desenha a unidade
 * no mapa e nos cartões da interface, garantindo identidade visual única.
 */

type Ctx = CanvasRenderingContext2D;

export interface UnitLook {
  tier: Tier;
  level: number;
  /** 0..1: brilho logo após um ataque */
  fire: number;
  /** ângulo de mira (rad) */
  aim: number;
  /** indutor: corrente; capacitor: energia; outras: 0 */
  charge: number;
  stunned: boolean;
  t: number;
}

const COPPER = '#c98a4b';
const INK = '#0b111a';

function base(ctx: Ctx, color: string, look: UnitLook) {
  // plataforma
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fillStyle = '#111b28';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = look.stunned ? '#4c5c70' : color;
  ctx.stroke();
  // evolução permanente: anéis externos
  if (look.tier >= 1) {
    ctx.save();
    ctx.setLineDash(look.tier === 1 ? [4, 4] : []);
    ctx.lineDashOffset = -look.t * 8;
    ctx.beginPath();
    ctx.arc(0, 0, 19.5, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
  if (look.tier >= 2) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 22.5, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.moveTo(0, 22.5);
    ctx.arc(0, 0, 22.5, Math.PI * 0.15, Math.PI * 0.85);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  // brilho de disparo
  if (look.fire > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.18 * look.fire;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function pips(ctx: Ctx, level: number, color: string) {
  if (level <= 0) return;
  const w = (level - 1) * 6;
  for (let i = 0; i < level; i++) {
    ctx.beginPath();
    ctx.arc(-w / 2 + i * 6, 21, 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function coil(ctx: Ctx, x: number, y: number, w: number, h: number, turns: number) {
  ctx.fillStyle = '#5a3a1c';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COPPER;
  ctx.lineWidth = 1.4;
  for (let i = 0; i <= turns; i++) {
    const yy = y + (h * i) / turns;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
  }
}

const DRAW: Record<'rele' | 'bobina' | 'fonte' | 'indutor' | 'diodo' | 'capacitor' | 'rl' | 'transformador', (ctx: Ctx, look: UnitLook, color: string) => void> = {
  rele(ctx, look, color) {
    ctx.fillStyle = '#16283a';
    ctx.fillRect(-10, -9, 20, 18);
    ctx.strokeStyle = '#2b4562';
    ctx.lineWidth = 1;
    ctx.strokeRect(-10, -9, 20, 18);
    coil(ctx, -8, -6, 7, 12, 5);
    // armadura: gira quando dispara (contato COM vai ao NO)
    const ang = look.fire > 0.3 ? -0.35 : 0;
    ctx.save();
    ctx.translate(1, 6);
    ctx.rotate(ang);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -12);
    ctx.lineTo(7, -12);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = look.fire > 0.3 ? '#39d08a' : '#6f8197';
    ctx.beginPath();
    ctx.arc(8, -6, 1.8, 0, Math.PI * 2);
    ctx.fill();
  },
  bobina(ctx, look, color) {
    coil(ctx, -7, -10, 14, 20, 7);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-7, -10, 14, 20);
    if (look.fire > 0) {
      ctx.globalAlpha = look.fire;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12 + (1 - look.fire) * 6, 5 + (1 - look.fire) * 3, 0, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },
  fonte(ctx, look, color) {
    ctx.fillStyle = '#15281f';
    ctx.fillRect(-10, -7, 20, 14);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-10, -7, 20, 14);
    ctx.fillStyle = color;
    ctx.fillRect(10, -3, 2.5, 6);
    ctx.font = '700 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DC', 0, 0.5);
    if (look.fire > 0) {
      ctx.globalAlpha = look.fire;
      ctx.fillText('+', 0, -13 - (1 - look.fire) * 4);
      ctx.globalAlpha = 1;
    }
  },
  indutor(ctx, look, color) {
    // símbolo do indutor: arcos em sequência, brilho proporcional à corrente
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 * look.charge;
    ctx.strokeStyle = look.charge > 0.05 ? color : COPPER;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-12, 3);
    for (let i = 0; i < 4; i++) ctx.arc(-9 + i * 6, 3, 3, Math.PI, 0);
    ctx.lineTo(12, 3);
    ctx.stroke();
    ctx.restore();
    // barra da corrente
    ctx.fillStyle = '#1e2a3a';
    ctx.fillRect(-9, 8, 18, 2.5);
    ctx.fillStyle = color;
    ctx.fillRect(-9, 8, 18 * look.charge, 2.5);
  },
  diodo(ctx, _look, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-7, -7);
    ctx.lineTo(5, 0);
    ctx.lineTo(-7, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(5, -8, 2.6, 16);
    ctx.strokeStyle = '#ffd2a6';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-7, 0);
    ctx.moveTo(7.6, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();
  },
  capacitor(ctx, look, color) {
    ctx.fillStyle = color;
    ctx.fillRect(-6, -10, 3, 20);
    ctx.fillRect(3, -10, 3, 20);
    ctx.strokeStyle = '#a3b2c4';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-6, 0);
    ctx.moveTo(6, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();
    // energia armazenada (∝ v²) entre as placas
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25 + 0.6 * look.charge;
    const h = 18 * look.charge;
    ctx.fillRect(-2.2, 9 - h, 4.4, h);
    ctx.globalAlpha = 1;
  },
  rl(ctx, look, color) {
    ctx.strokeStyle = '#b9c7d8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-12, -4);
    for (let i = 0; i < 5; i++) ctx.lineTo(-10 + i * 2.4, i % 2 ? -1 : -7);
    ctx.lineTo(0, -4);
    ctx.stroke();
    ctx.strokeStyle = look.fire > 0 ? color : COPPER;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, 4);
    for (let i = 0; i < 3; i++) ctx.arc(-3 + i * 5, 6, 2.5, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '700 7px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('τ', 8, -2);
  },
  transformador(ctx, look, color) {
    coil(ctx, -11, -9, 7, 18, 6);
    coil(ctx, 4, -9, 7, 18, look.level >= 2 ? 8 : 4);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-1.5, -11);
    ctx.lineTo(-1.5, 11);
    ctx.moveTo(1.5, -11);
    ctx.lineTo(1.5, 11);
    ctx.stroke();
  },
};

/* ---------------- Patch 1.1: novas unidades ---------------- */

const DRAW_EXP: Record<'resistor' | 'transistor' | 'retificador' | 'oscilador' | 'ci555' | 'tesla' | 'supercondutor', (ctx: Ctx, look: UnitLook, color: string) => void> = {
  resistor(ctx, look, color) {
    // corpo cerâmico com faixas de cor e brilho de aquecimento
    ctx.strokeStyle = '#a3b2c4';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(-8, 0);
    ctx.moveTo(8, 0);
    ctx.lineTo(13, 0);
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 * look.fire;
    ctx.fillStyle = look.fire > 0.2 ? '#7a3a22' : '#e8d3a8';
    ctx.beginPath();
    ctx.roundRect(-8, -5, 16, 10, 3);
    ctx.fill();
    ctx.restore();
    const bands = ['#7a4a1c', '#111', '#ff3b3b', color];
    bands.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(-5.5 + i * 3.4, -5, 1.8, 10);
    });
    // ondas de calor
    if (look.fire > 0) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = look.fire;
      ctx.lineWidth = 1.2;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(k * 5, -8);
        ctx.quadraticCurveTo(k * 5 + 2, -11, k * 5, -14);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  },
  transistor(ctx, look, color) {
    // símbolo NPN: base, coletor e emissor (seta)
    ctx.strokeStyle = '#b9c7d8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-3, 0);
    ctx.moveTo(-3, -6);
    ctx.lineTo(-3, 6);
    ctx.moveTo(-3, -2);
    ctx.lineTo(5, -8);
    ctx.moveTo(-3, 2);
    ctx.lineTo(5, 8);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(5, 8);
    ctx.lineTo(0.5, 7.5);
    ctx.lineTo(3, 3.8);
    ctx.closePath();
    ctx.fill();
    // ganho atual (estágios)
    ctx.fillStyle = '#1e2a3a';
    ctx.fillRect(-9, 11, 18, 2.5);
    ctx.fillStyle = look.charge >= 1 ? '#ffffff' : color;
    ctx.fillRect(-9, 11, 18 * look.charge, 2.5);
  },
  retificador(ctx, look, color) {
    // ponte de 4 diodos em losango
    ctx.save();
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = '#3c5a3a';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.restore();
    ctx.fillStyle = color;
    const tri = (x: number, y: number, a: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-3, -3);
      ctx.lineTo(3, 0);
      ctx.lineTo(-3, 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(3, -3, 1.2, 6);
      ctx.restore();
    };
    tri(-5, -5, Math.PI / 4);
    tri(5, -5, -Math.PI / 4 + Math.PI / 2);
    tri(-5, 5, -Math.PI / 4);
    tri(5, 5, Math.PI / 4 - Math.PI / 2 + Math.PI);
    ctx.font = '700 7px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('~', -12, 0);
    ctx.fillText('=', 12, 0);
    if (look.fire > 0) {
      ctx.globalAlpha = look.fire;
      ctx.fillText('+', 0, -14 - (1 - look.fire) * 4);
      ctx.globalAlpha = 1;
    }
  },
  oscilador(ctx, look, color) {
    // senoide viva sobre um tanque LC
    ctx.strokeStyle = COPPER;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) ctx.arc(-6 + i * 5, 7, 2.5, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#a3b2c4';
    ctx.fillRect(7, 3, 4, 1.6);
    ctx.fillRect(7, 6.5, 4, 1.6);
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 6 + 8 * look.fire;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const x = -11 + (22 * i) / 24;
      const y = -4 - 5 * Math.sin((i / 24) * Math.PI * 4 + look.t * 6);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  },
  ci555(ctx, look, color) {
    // encapsulamento DIP-8
    ctx.fillStyle = '#1b1f26';
    ctx.fillRect(-8, -10, 16, 20);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-8, -10, 16, 20);
    ctx.fillStyle = '#c9ced6';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-11, -8 + i * 5, 3, 2);
      ctx.fillRect(8, -8 + i * 5, 3, 2);
    }
    ctx.beginPath();
    ctx.arc(0, -10, 2.5, 0, Math.PI);
    ctx.fillStyle = '#0b111a';
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = '800 7px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('555', 0, -2);
    // onda quadrada: nível alto aceso
    ctx.strokeStyle = look.charge > 0.5 ? '#39d08a' : '#4c5c70';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-6, 7);
    ctx.lineTo(-6, 3);
    ctx.lineTo(-1, 3);
    ctx.lineTo(-1, 7);
    ctx.lineTo(3, 7);
    ctx.lineTo(3, 3);
    ctx.lineTo(6, 3);
    ctx.stroke();
  },
  tesla(ctx, look, color) {
    // secundário alto com toroide no topo
    ctx.fillStyle = '#5a3a1c';
    ctx.fillRect(-3.5, -6, 7, 16);
    ctx.strokeStyle = COPPER;
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(-3.5, -5 + i * 2);
      ctx.lineTo(3.5, -5 + i * 2);
      ctx.stroke();
    }
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 + 10 * look.fire;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -9, 8, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // faíscas
    ctx.strokeStyle = '#e8ffff';
    ctx.lineWidth = 1;
    const n = look.fire > 0.2 ? 4 : 2;
    for (let k = 0; k < n; k++) {
      const a = look.t * 9 + k * 2.1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 8, -9 + Math.sin(a) * 3);
      ctx.lineTo(Math.cos(a) * 14, -12 + Math.sin(a * 1.7) * 5);
      ctx.stroke();
    }
  },
  supercondutor(ctx, look, color) {
    // pastilha levitando sobre o ímã (efeito Meissner) e anel de corrente persistente
    ctx.fillStyle = '#16323a';
    ctx.fillRect(-9, 5, 18, 5);
    ctx.strokeStyle = '#2d5c66';
    ctx.lineWidth = 1;
    ctx.strokeRect(-9, 5, 18, 5);
    const lift = 2 + Math.sin(look.t * 2.5) * 1.5;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 6 + 14 * look.charge;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(0, -2 - lift, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 3]);
    ctx.lineDashOffset = -look.t * 20 * (0.2 + look.charge);
    ctx.beginPath();
    ctx.ellipse(0, -2 - lift, 12.5, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // vapor criogênico
    ctx.fillStyle = 'rgba(200,250,255,0.35)';
    for (let k = 0; k < 3; k++) {
      const p = (look.t * 0.6 + k / 3) % 1;
      ctx.beginPath();
      ctx.arc(-8 + k * 8, 4 - p * 8, 1.5 * (1 - p) + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

/* ---------------------------------------------------------------- */
/* Patch 1.2: unidades novas                                         */
/* ---------------------------------------------------------------- */

const DRAW_OD: Record<'mosfet' | 'igbt' | 'trafopot' | 'cristal' | 'ampop' | 'plasma', (ctx: Ctx, look: UnitLook, color: string) => void> = {
  mosfet(ctx, look, color) {
    // símbolo do MOSFET canal N: porta isolada, canal e seta do substrato
    ctx.strokeStyle = '#b9c7d8';
    ctx.lineWidth = 1.6;
    // terminal de porta + barra isolada
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(-7, 0);
    ctx.moveTo(-7, -7);
    ctx.lineTo(-7, 7);
    ctx.stroke();
    // canal (três segmentos) e trilhos de dreno/fonte
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(-3.5, k * 5 - 1.6);
      ctx.lineTo(-3.5, k * 5 + 1.6);
      ctx.stroke();
    }
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-3.5, -5);
    ctx.lineTo(7, -5);
    ctx.lineTo(7, -12);
    ctx.moveTo(-3.5, 5);
    ctx.lineTo(7, 5);
    ctx.lineTo(7, 12);
    ctx.moveTo(-3.5, 0);
    ctx.lineTo(3, 0);
    ctx.stroke();
    // seta do substrato
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(3, 0);
    ctx.lineTo(0.5, -2);
    ctx.lineTo(0.5, 2);
    ctx.closePath();
    ctx.fill();
    // frequência de comutação: trem de pulsos que acelera com `charge`
    const n = 3 + Math.round(look.charge * 4);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5 + 0.5 * look.fire;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = -10 + (i * 20) / n;
      const w = 20 / n / 2;
      ctx.moveTo(x, -14);
      ctx.lineTo(x, -17);
      ctx.lineTo(x + w, -17);
      ctx.lineTo(x + w, -14);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  igbt(ctx, look, color) {
    // símbolo do IGBT: porta isolada (MOSFET) + saída bipolar com seta
    ctx.strokeStyle = '#b9c7d8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(-8, 0);
    ctx.moveTo(-8, -6);
    ctx.lineTo(-8, 6);
    ctx.moveTo(-4.5, -7);
    ctx.lineTo(-4.5, 7);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-4.5, -4.5);
    ctx.lineTo(6, -10);
    ctx.moveTo(-4.5, 4.5);
    ctx.lineTo(6, 10);
    ctx.stroke();
    // seta do emissor
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(6, 10);
    ctx.lineTo(1.6, 8.6);
    ctx.lineTo(3.4, 5.4);
    ctx.closePath();
    ctx.fill();
    // barramento CC carregado: brilha ao disparar
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 * look.fire;
    ctx.strokeStyle = look.fire > 0.3 ? '#ffffff' : '#7f8ca3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(9, -13);
    ctx.lineTo(9, 13);
    ctx.moveTo(12.5, -9);
    ctx.lineTo(12.5, 9);
    ctx.stroke();
    ctx.restore();
  },

  trafopot(ctx, look, color) {
    // dois enrolamentos sobre núcleo laminado + barramento de distribuição
    coil(ctx, -11, -8, 6, 16, 5);
    coil(ctx, 5, -8, 6, 16, 5);
    ctx.strokeStyle = '#8c9bb0';
    ctx.lineWidth = 1.5;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(-2 + k * 1.6, -10);
      ctx.lineTo(-2 + k * 1.6, 10);
      ctx.stroke();
    }
    // conexões: traços que pulsam para fora conforme a malha é usada
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.3;
    const links = 4;
    for (let i = 0; i < links; i++) {
      const a = (i / links) * Math.PI * 2 + look.t * 0.5;
      const r0 = 17;
      const r1 = 21 + 2 * Math.sin(look.t * 3 + i);
      ctx.globalAlpha = 0.45 + 0.4 * look.fire;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },

  cristal(ctx, look, color) {
    // símbolo do cristal: retângulo do quartzo entre duas placas
    ctx.strokeStyle = '#b9c7d8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(-7, 0);
    ctx.moveTo(7, 0);
    ctx.lineTo(13, 0);
    ctx.moveTo(-7, -7);
    ctx.lineTo(-7, 7);
    ctx.moveTo(7, -7);
    ctx.lineTo(7, 7);
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 + 6 * look.fire;
    ctx.fillStyle = INK;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.rect(-4.5, -8, 9, 16);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // vibração piezoelétrica: linhas finas e estáveis
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(look.t * 6));
    for (let k = -1; k <= 1; k += 2) {
      ctx.beginPath();
      ctx.moveTo(k * 7.5, -12);
      ctx.lineTo(k * 7.5, 12);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // marcação do nível alto do clock
    if (look.charge > 0.5) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -13.5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  ampop(ctx, look, color) {
    // triângulo do amp. op. com entradas + e −
    ctx.strokeStyle = '#b9c7d8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-13, -5);
    ctx.lineTo(-8, -5);
    ctx.moveTo(-13, 5);
    ctx.lineTo(-8, 5);
    ctx.moveTo(9, 0);
    ctx.lineTo(13, 0);
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 * look.fire;
    ctx.fillStyle = INK;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(-8, 10);
    ctx.lineTo(9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // sinais das entradas
    ctx.strokeStyle = '#e4ebf3';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-6.5, -5);
    ctx.lineTo(-3.5, -5); // −
    ctx.moveTo(-6.5, 5);
    ctx.lineTo(-3.5, 5); // +
    ctx.moveTo(-5, 3.5);
    ctx.lineTo(-5, 6.5);
    ctx.stroke();
    // saturação (clipping): a onda de saída vira quadrada
    if (look.charge >= 0.999) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-9, -15);
      ctx.lineTo(-4, -15);
      ctx.lineTo(-4, -19);
      ctx.lineTo(4, -19);
      ctx.lineTo(4, -15);
      ctx.lineTo(9, -15);
      ctx.stroke();
    } else {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let x = -9; x <= 9; x++) ctx.lineTo(x, -17 + 2.4 * Math.sin((x / 9) * Math.PI * 2 + look.t * 4));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },

  plasma(ctx, look, color) {
    // tocha: bico cônico com jato ionizado girando
    ctx.save();
    ctx.strokeStyle = '#8c9bb0';
    ctx.lineWidth = 1.8;
    ctx.fillStyle = '#1b2430';
    ctx.beginPath();
    ctx.moveTo(-7, -11);
    ctx.lineTo(7, -11);
    ctx.lineTo(4, 2);
    ctx.lineTo(-4, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // bobina de acoplamento indutivo
    ctx.strokeStyle = COPPER;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, -8 + i * 4, 8.5, 2.2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // jato de plasma
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    const grad = ctx.createLinearGradient(0, 2, 0, 18);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, 'rgba(255,111,224,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.quadraticCurveTo(-2, 12, 0, 18);
    ctx.quadraticCurveTo(2, 12, 4, 2);
    ctx.closePath();
    ctx.fill();
    // arcos ionizados ao redor
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5 + 0.5 * look.fire;
    for (let i = 0; i < 3; i++) {
      const a = look.t * 2.5 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(0, 4, 11, a, a + 0.9);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  },
};

/** Marca de raridade (Lendário, Mítico e Secreto ganham um selo brilhante). */
function rarityMark(ctx: Ctx, id: UnitId, t: number) {
  const r = RARITIES[UNITS[id].rarity];
  if (r.rank < 4) return;
  ctx.save();
  ctx.translate(13, -13);
  ctx.rotate(Math.PI / 4 + (r.rank >= 6 ? t : 0));
  ctx.shadowColor = r.color;
  ctx.shadowBlur = 6;
  ctx.fillStyle = r.color;
  ctx.fillRect(-3, -3, 6, 6);
  ctx.restore();
}

export function drawUnit(ctx: Ctx, id: UnitId, x: number, y: number, look: UnitLook, scale = 1): void {
  const color = UNITS[id].color;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  base(ctx, color, look);
  // 1.2: três tabelas (original, expansão 1.1 e Overdrive 1.2); a plataforma é desenhada
  // mesmo que alguma unidade nova ainda não tenha sprite própria.
  const draw = DRAW[id as keyof typeof DRAW] ?? DRAW_EXP[id as keyof typeof DRAW_EXP] ?? DRAW_OD[id as keyof typeof DRAW_OD];
  draw?.(ctx, look, color);
  rarityMark(ctx, id, look.t);
  pips(ctx, look.level, color);
  if (look.stunned) {
    ctx.strokeStyle = '#ff5f5f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, -24);
    ctx.lineTo(-1, -19);
    ctx.lineTo(-4, -19);
    ctx.lineTo(2, -13);
    ctx.stroke();
    ctx.fillStyle = 'rgba(8,12,19,0.45)';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- */
/* Inimigos                                                          */
/* ---------------------------------------------------------------- */

function star(ctx: Ctx, r: number, n: number, inner: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = rot + (i * Math.PI) / n;
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

function poly(ctx: Ctx, r: number, n: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

export function drawEnemy(ctx: Ctx, e: EnemyInst, t: number, stunned: boolean, slowed: boolean, immune: string | null = null, boosted = false): void {
  const r = e.def.radius;
  const c = e.def.color;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.shadowColor = c;
  ctx.shadowBlur = e.def.boss ? 18 : 8;
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : c;
  ctx.strokeStyle = c;
  switch (e.def.id) {
    case 'curto':
      star(ctx, r, 6, 0.45, t * 3 + e.uid);
      ctx.fill();
      break;
    case 'surto':
      ctx.rotate(e.angle);
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(-r * 0.7, -r * 0.8);
      ctx.lineTo(-r * 0.25, 0);
      ctx.lineTo(-r * 0.7, r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.fillRect(-r * 2.2, -1.5, r * 1.4, 3);
      break;
    case 'sobrecarga':
      poly(ctx, r, 6, t * 0.4);
      ctx.fillStyle = e.flash > 0 ? '#fff' : '#3a2410';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.font = '800 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, 1);
      break;
    case 'ruido': {
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const rr = r * (0.8 + 0.25 * Math.sin(a * 5 + t * 14 + e.uid));
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 0.06;
      ctx.beginPath();
      ctx.arc(0, 0, e.def.behavior.noiseRadius!, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'interferencia': {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      const prog = e.tA / (e.def.behavior.pulseEvery ?? 6);
      ctx.lineWidth = 2;
      for (let k = 0; k < 2; k++) {
        ctx.globalAlpha = 0.8 - k * 0.3;
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.9 + k * 0.4), -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'isolamento':
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.2);
      ctx.lineTo(-r * 0.1, r * 0.1);
      ctx.lineTo(r * 0.2, -r * 0.3);
      ctx.lineTo(r * 0.6, r * 0.3);
      ctx.stroke();
      break;
    case 'instabilidade': {
      ctx.rotate(t * (e.toggled ? 9 : 2));
      ctx.lineWidth = 5;
      ctx.strokeStyle = e.toggled ? '#ff5f5f' : c;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.65, Math.PI * 0.15, Math.PI * 0.85, true);
      ctx.stroke();
      ctx.fillStyle = e.toggled ? '#ff5f5f' : c;
      ctx.fillRect(r * 0.42, -1, 6, 8);
      ctx.fillRect(-r * 0.42 - 6, -1, 6, 8);
      break;
    }
    case 'arco': {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#2a230c';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = e.flash > 0 ? '#fff' : c;
      ctx.beginPath();
      ctx.moveTo(3, -r * 0.8);
      ctx.lineTo(-7, 2);
      ctx.lineTo(0, 2);
      ctx.lineTo(-4, r * 0.8);
      ctx.lineTo(8, -4);
      ctx.lineTo(1, -4);
      ctx.closePath();
      ctx.fill();
      for (let k = 0; k < 3; k++) {
        const a = t * 4 + (k * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a + 0.3) * (r + 7), Math.sin(a + 0.3) * (r + 7));
        ctx.stroke();
      }
      break;
    }
    case 'saturacao': {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#1b1530';
      ctx.fill();
      ctx.stroke();
      // laço de histerese estilizado
      ctx.lineWidth = 2;
      ctx.strokeStyle = e.flash > 0 ? '#fff' : '#d4c8ff';
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, r * 0.45);
      ctx.bezierCurveTo(-r * 0.2, r * 0.45, -r * 0.1, -r * 0.45, r * 0.7, -r * 0.45);
      ctx.moveTo(r * 0.7, -r * 0.45);
      ctx.bezierCurveTo(r * 0.2, -r * 0.45, r * 0.1, r * 0.45, -r * 0.7, r * 0.45);
      ctx.stroke();
      const sat = Math.min(1, e.magTaken / (e.maxHp * 0.9));
      ctx.strokeStyle = c;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r + 5, -Math.PI / 2, -Math.PI / 2 + sat * Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'cascata': {
      star(ctx, r, 8, 0.6, t);
      ctx.fillStyle = e.flash > 0 ? '#fff' : '#3a1414';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = c;
      for (let k = 0; k < 3; k++) {
        const a = t * 2.5 + (k * Math.PI * 2) / 3;
        ctx.save();
        ctx.translate(Math.cos(a) * (r + 8), Math.sin(a) * (r + 8));
        star(ctx, 5, 5, 0.45, a);
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'colapso': {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        ctx.save();
        ctx.rotate(t * (k % 2 ? -1 : 1) * (0.8 + k * 0.4));
        ctx.setLineDash([10 + k * 4, 6]);
        ctx.globalAlpha = 0.9 - k * 0.2;
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.75 + k * 0.22), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    /* ---------------- Patch 1.1 ---------------- */
    case 'franco': {
      // estrela agressiva com núcleo incandescente
      star(ctx, r, 8, 0.38, -t * 5 + e.uid);
      ctx.fill();
      ctx.fillStyle = '#ffe1a0';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'sobretensao': {
      // escudo hexagonal pulsante em volta de um raio
      poly(ctx, r, 6, t * 0.6);
      ctx.fill();
      ctx.strokeStyle = '#0b111a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-3, -r * 0.6);
      ctx.lineTo(2, -1);
      ctx.lineTo(-2, 1);
      ctx.lineTo(3, r * 0.6);
      ctx.stroke();
      break;
    }
    case 'emi': {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      for (let k = 1; k <= 3; k++) {
        const p = (t * 1.2 + k / 3) % 1;
        ctx.globalAlpha = 1 - p;
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.6 + p * 1.4), -0.7, 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.6 + p * 1.4), Math.PI - 0.7, Math.PI + 0.7);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'fuga': {
      // gota com gotículas escapando
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r, -r * 0.1, r * 0.8, r, 0, r);
      ctx.bezierCurveTo(-r * 0.8, r, -r, -r * 0.1, 0, -r);
      ctx.fill();
      for (let k = 0; k < 3; k++) {
        const p = (t * 0.8 + k / 3) % 1;
        ctx.globalAlpha = 1 - p;
        ctx.beginPath();
        ctx.arc(Math.cos(k * 2.1) * r * (1 + p), Math.sin(k * 2.1) * r * (1 + p), 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'aberto': {
      // dois terminais com o contato interrompido
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-r * 0.55, 0, r * 0.35, 0, Math.PI * 2);
      ctx.arc(r * 0.55, 0, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, 0);
      ctx.lineTo(r * 0.35, e.open ? -r * 0.8 : -r * 0.1);
      ctx.stroke();
      break;
    }
    case 'transiente': {
      // pico estreito (spike)
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-r * 1.3, r * 0.5);
      ctx.lineTo(-r * 0.3, r * 0.5);
      ctx.lineTo(0, -r * 1.2);
      ctx.lineTo(r * 0.3, r * 0.5);
      ctx.lineTo(r * 1.3, r * 0.5);
      ctx.stroke();
      break;
    }
    case 'saturado': {
      // núcleo laminado (E-I) com brilho de saturação
      ctx.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 0.35);
      ctx.fillRect(-r * 0.8, r * 0.45, r * 1.6, r * 0.35);
      ctx.fillRect(-r * 0.8, -r * 0.8, r * 0.35, r * 1.6);
      ctx.fillRect(-r * 0.12, -r * 0.45, r * 0.3, r * 0.9);
      ctx.fillRect(r * 0.45, -r * 0.8, r * 0.35, r * 1.6);
      break;
    }
    case 'ressonancia': {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.5;
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath();
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          const rr = r * (0.65 + k * 0.15) + Math.sin(a * (k + 2) + t * (3 + k)) * 3;
          if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.globalAlpha = 1 - k * 0.22;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'apagao': {
      // disco escuro com coroa vermelha intermitente
      ctx.fillStyle = '#14080b';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 2));
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : c;
      ctx.font = `800 ${Math.round(r * 0.7)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⏻', 0, 1);
      break;
    }

    /* ==================== Patch 1.2 — §4 ==================== */

    case 'dieletrico': {
      // bloco isolante com uma trilha de ruptura carbonizada
      const broken = t < e.dielUntil;
      ctx.beginPath();
      ctx.roundRect(-r * 0.8, -r * 0.7, r * 1.6, r * 1.4, 4);
      ctx.fill();
      ctx.strokeStyle = broken ? '#ffffff' : c;
      ctx.lineWidth = broken ? 2.4 : 1.4;
      ctx.stroke();
      // caminho de ruptura em zigue-zague
      ctx.strokeStyle = broken ? '#ffffff' : '#0b111a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.5);
      ctx.lineTo(-r * 0.2, 0);
      ctx.lineTo(-r * 0.5, r * 0.2);
      ctx.lineTo(r * 0.2, r * 0.5);
      ctx.stroke();
      if (broken) {
        ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 12));
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      break;
    }

    case 'ambulante': {
      // faísca veloz com rastro
      star(ctx, r, 5, 0.4, -t * 9 + e.uid);
      ctx.fill();
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.6;
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath();
        ctx.arc(-k * 5, 0, r * (1 - k * 0.22), Math.PI * 0.6, Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }

    case 'faraday': {
      // gaiola: hexágono com malha interna
      poly(ctx, r, 6, Math.PI / 6);
      ctx.fill();
      ctx.strokeStyle = '#e4ebf3';
      ctx.lineWidth = 1.2;
      poly(ctx, r, 6, Math.PI / 6);
      ctx.stroke();
      ctx.lineWidth = 0.9;
      ctx.globalAlpha = 0.8;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * (r / 2.6), -r * 0.8);
        ctx.lineTo(i * (r / 2.6), r * 0.8);
        ctx.moveTo(-r * 0.8, i * (r / 2.6));
        ctx.lineTo(r * 0.8, i * (r / 2.6));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }

    case 'supercap': {
      // duas placas de supercapacitor; o preenchimento mostra a carga acumulada
      const frac = e.def.behavior.accumulate ? Math.min(1, e.charge / e.def.behavior.accumulate.max) : 0;
      ctx.beginPath();
      ctx.roundRect(-r * 0.85, -r * 0.8, r * 1.7, r * 1.6, 3);
      ctx.fillStyle = '#1b2430';
      ctx.fill();
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : c;
      ctx.fillRect(-r * 0.85, r * 0.8 - r * 1.6 * frac, r * 1.7, r * 1.6 * frac);
      // terminais
      ctx.strokeStyle = '#e4ebf3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.8);
      ctx.lineTo(-r * 0.3, -r * 1.25);
      ctx.moveTo(r * 0.3, -r * 0.8);
      ctx.lineTo(r * 0.3, -r * 1.25);
      ctx.stroke();
      if (frac > 0.75) {
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 8));
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      break;
    }

    case 'reverso': {
      // símbolo de diodo invertido; acende quando entra em condução direta
      const fwd = t < e.forwardUntil;
      ctx.fillStyle = fwd ? '#ffffff' : c;
      ctx.beginPath();
      ctx.moveTo(r * 0.7, -r * 0.7);
      ctx.lineTo(r * 0.7, r * 0.7);
      ctx.lineTo(-r * 0.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = fwd ? '#ffffff' : '#e4ebf3';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.8);
      ctx.lineTo(-r * 0.6, r * 0.8);
      ctx.stroke();
      if (fwd) {
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      break;
    }

    case 'voltaico': {
      // coluna de arco entre dois eletrodos
      ctx.strokeStyle = '#9fb0c6';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, -r);
      ctx.lineTo(-r * 0.9, r);
      ctx.moveTo(r * 0.9, -r);
      ctx.lineTo(r * 0.9, r);
      ctx.stroke();
      ctx.strokeStyle = e.flash > 0 ? '#ffffff' : c;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, 0);
      for (let i = 1; i <= 4; i++) {
        const x = -r * 0.9 + (i * r * 1.8) / 4;
        const y = Math.sin(t * 14 + i * 2 + e.uid) * r * 0.45;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    }

    case 'saturacaoprofunda': {
      // núcleo com curva de histerese; o anel mostra o medidor de saturação
      const sm = e.def.behavior.satMeter;
      const open = t < e.satUntil;
      poly(ctx, r, 4, Math.PI / 4);
      ctx.fillStyle = open ? '#ffffff' : e.flash > 0 ? '#ffffff' : c;
      ctx.fill();
      ctx.strokeStyle = '#2a2140';
      ctx.lineWidth = 2;
      ctx.stroke();
      // laço B-H estilizado
      ctx.strokeStyle = '#0b111a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, r * 0.35);
      ctx.bezierCurveTo(-r * 0.1, r * 0.5, r * 0.2, -r * 0.1, r * 0.45, -r * 0.35);
      ctx.bezierCurveTo(r * 0.1, -r * 0.5, -r * 0.2, r * 0.1, -r * 0.45, r * 0.35);
      ctx.stroke();
      if (sm && e.satFill > 0 && !open) {
        ctx.strokeStyle = '#c0a6ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.min(1, e.satFill / sm.need) * Math.PI * 2);
        ctx.stroke();
      }
      break;
    }

    case 'parasita': {
      // oscilação parasita: senoide desgovernada dentro de um círculo
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a1026';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.strokeStyle = e.flash > 0 ? '#ffffff' : '#1a1026';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = -6; i <= 6; i++) {
        const x = (i * r * 0.7) / 6;
        const y = Math.sin(i * 1.1 + t * 11 + e.uid) * r * 0.42;
        if (i === -6) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // janela de interferência ativa
      if (t < e.jamUntil) {
        ctx.strokeStyle = c;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.55;
        for (let k = 1; k <= 2; k++) {
          ctx.beginPath();
          ctx.arc(0, 0, r + 4 + k * 5 + Math.sin(t * 6) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      break;
    }

    case 'singularidade': {
      // §13: núcleo de plasma colapsando, com anéis de campo e braços de descarga
      const charging = e.annih === 1;
      ctx.save();
      // halo de campo
      const halo = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.6);
      halo.addColorStop(0, '#ffffff');
      halo.addColorStop(0.35, c);
      halo.addColorStop(1, 'rgba(255,95,240,0)');
      ctx.fillStyle = halo;
      ctx.globalAlpha = charging ? 0.95 : 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // núcleo
      ctx.fillStyle = e.flash > 0 || charging ? '#ffffff' : '#2a0b26';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2);
      ctx.fill();
      // anéis de campo em rotações opostas
      ctx.strokeStyle = c;
      ctx.lineWidth = 2.2;
      for (let k = 0; k < 3; k++) {
        const a = t * (k % 2 ? -1.6 : 1.9) + k;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * (0.95 + k * 0.22), r * (0.34 + k * 0.1), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // braços de descarga
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = charging ? 2.2 : 1.4;
      ctx.globalAlpha = charging ? 1 : 0.75;
      const arms = charging ? 8 : 5;
      for (let i = 0; i < arms; i++) {
        const a = (i / arms) * Math.PI * 2 + t * 2.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
        for (let s = 1; s <= 3; s++) {
          const rr = r * (0.5 + s * 0.28);
          const aa = a + Math.sin(t * 9 + i + s) * 0.22;
          ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      break;
    }
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  if (e.shield > 0) {
    ctx.strokeStyle = '#45cfe0';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(0, 0, r + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (slowed) {
    ctx.strokeStyle = '#3d9bff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (stunned) {
    ctx.fillStyle = '#45cfe0';
    ctx.font = '800 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⏸', 0, -r - 10);
  }
  // 1.1: circuito aberto, aquecimento, proteção alternada e aceleração harmônica
  if (e.open) {
    ctx.fillStyle = 'rgba(8,12,19,0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e4ebf3';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (e.heat > 0) {
    ctx.strokeStyle = '#ff7a59';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ff7a59';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(0, 0, r + 3, Math.PI / 2, Math.PI / 2 + (Math.min(8, e.heat) / 8) * Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  if (immune) {
    ctx.fillStyle = '#ffb347';
    ctx.font = '800 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(immune, r + 6, -r - 2);
  }
  if (boosted) {
    ctx.strokeStyle = '#c77dff';
    ctx.lineWidth = 1.5;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(-r - 4, k * 4);
      ctx.lineTo(-r - 10, k * 4);
      ctx.stroke();
    }
  }
  ctx.restore();
}
