import { MAP_H, MAP_W, PATH_WIDTH, type MapDef, type MapTheme } from '../data/maps';
import { MODIFIERS } from '../data/difficulty';
import { DAMAGE_LABEL, UNITS } from '../data/units';
import type { EnemyInst, Fx, GameEngine, UnitInst } from '../engine/GameEngine';
import { rng } from '../engine/geometry';
import type { UnitId, Vec } from '../types';
import { drawEnemy, drawUnit } from './sprites';

/**
 * Renderização do mapa em canvas 2D. Somente leitura do estado da engine: nada aqui
 * altera a simulação. O fundo (placa, trilhas, caminho) é pré-renderizado por mapa.
 */

export interface RenderUi {
  placing: UnitId | null;
  ghost: Vec | null;
  ghostOk: boolean;
  ghostReason: string;
  selected: number | null;
  hover: Vec | null;
  /** §7.2: uids selecionados no Unit Manager (recebem contorno luminoso no mapa) */
  multi: number[];
}

const bgCache = new Map<string, HTMLCanvasElement>();

/** Letra exibida sobre a Sobretensão indicando o tipo de dano bloqueado no momento. */
const IMMUNE_LETTER: Record<string, string> = { comutacao: 'C', descarga: 'D', magnetico: 'M', grampeamento: 'G', termico: 'T' };

/** Comportamentos cujo círculo relevante é a aura (não o alcance de ataque). */
// 1.2: 'grid' (Transformador de Potência) também só tem área de aura, não alcance de tiro
const AURA_ONLY = new Set(['aura', 'income', 'rectifier', 'grid']);

function pathStroke(ctx: CanvasRenderingContext2D, pts: Vec[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
}

/** Fundo estático: grade, trilhas decorativas de PCB e o caminho dos inimigos. */
export function drawMapBackground(ctx: CanvasRenderingContext2D, map: MapDef): void {
  ctx.fillStyle = '#080d15';
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  ctx.strokeStyle = 'rgba(61,155,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= MAP_W; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, MAP_H);
    ctx.stroke();
  }
  for (let y = 0; y <= MAP_H; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(MAP_W, y + 0.5);
    ctx.stroke();
  }
  decorate(ctx, map);
  // trilhas decorativas (estáticas, não interativas)
  const rand = rng(map.seed);
  ctx.lineCap = 'round';
  for (let i = 0; i < 34; i++) {
    let x = Math.round((rand() * MAP_W) / 24) * 24;
    let y = Math.round((rand() * MAP_H) / 24) * 24;
    ctx.strokeStyle = 'rgba(80,110,150,0.13)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      if (rand() < 0.5) x += (rand() < 0.5 ? -1 : 1) * 24 * (1 + Math.floor(rand() * 3));
      else y += (rand() < 0.5 ? -1 : 1) * 24 * (1 + Math.floor(rand() * 3));
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(201,138,75,0.16)';
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // caminho
  ctx.lineJoin = 'round';
  const pal = PATH_COLORS[map.theme];
  for (const pts of map.paths) {
    pathStroke(ctx, pts);
    ctx.strokeStyle = pal.edge;
    ctx.lineWidth = PATH_WIDTH + 8;
    ctx.stroke();
  }
  for (const pts of map.paths) {
    pathStroke(ctx, pts);
    ctx.strokeStyle = pal.fill;
    ctx.lineWidth = PATH_WIDTH;
    ctx.stroke();
  }
  for (const pts of map.paths) {
    pathStroke(ctx, pts);
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // entradas
  for (const pts of map.paths) {
    const a = pts[0];
    const b = pts[1];
    const ex = Math.max(14, Math.min(MAP_W - 14, a.x + (b.x - a.x) * 0.06));
    const ey = Math.max(14, Math.min(MAP_H - 14, a.y + (b.y - a.y) * 0.06));
    const g = ctx.createRadialGradient(ex, ey, 2, ex, ey, 34);
    g.addColorStop(0, 'rgba(255,95,95,0.45)');
    g.addColorStop(1, 'rgba(255,95,95,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ex, ey, 34, 0, Math.PI * 2);
    ctx.fill();
  }
}

const PATH_COLORS: Record<MapTheme, { edge: string; fill: string; line: string }> = {
  pcb: { edge: '#1d3552', fill: '#0d1724', line: 'rgba(201,138,75,0.22)' },
  scope: { edge: '#1b4a36', fill: '#07140f', line: 'rgba(120,255,170,0.35)' },
  bridge: { edge: '#2a4a22', fill: '#0c160c', line: 'rgba(127,227,107,0.25)' },
  substation: { edge: '#4a3c1c', fill: '#14110a', line: 'rgba(242,191,74,0.28)' },
  chip: { edge: '#3a3f4a', fill: '#101318', line: 'rgba(200,210,225,0.25)' },
  line: { edge: '#28405e', fill: '#0b1220', line: 'rgba(143,247,255,0.25)' },
};

/** Ambientação própria de cada cenário (desenhada uma vez e guardada em cache). */
function decorate(ctx: CanvasRenderingContext2D, map: MapDef): void {
  ctx.save();
  switch (map.theme) {
    case 'scope': {
      // tela de osciloscópio: retícula com divisões e eixo central
      ctx.fillStyle = 'rgba(20,80,50,0.16)';
      ctx.fillRect(0, 0, MAP_W, MAP_H);
      ctx.strokeStyle = 'rgba(120,255,170,0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= MAP_W; x += 96) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, MAP_H);
        ctx.stroke();
      }
      for (let y = 30; y <= MAP_H; y += 96) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(MAP_W, y + 0.5);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(120,255,170,0.25)';
      ctx.beginPath();
      ctx.moveTo(0, 270.5);
      ctx.lineTo(MAP_W, 270.5);
      ctx.stroke();
      for (let x = 0; x <= MAP_W; x += 19.2) {
        ctx.beginPath();
        ctx.moveTo(x, 266);
        ctx.lineTo(x, 275);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(120,255,170,0.4)';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillText('CH1  2 V/div   5 ms/div   TRIG ↑', 14, MAP_H - 12);
      break;
    }
    case 'bridge': {
      // quatro diodos da ponte nos lados do losango
      const diode = (x: number, y: number, a: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.fillStyle = 'rgba(127,227,107,0.28)';
        ctx.beginPath();
        ctx.moveTo(-16, -14);
        ctx.lineTo(14, 0);
        ctx.lineTo(-16, 14);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(14, -15, 5, 30);
        ctx.restore();
      };
      diode(215, 175, -0.82);
      diode(745, 175, 0.82);
      diode(215, 365, 0.82);
      diode(745, 365, -0.82);
      ctx.fillStyle = 'rgba(127,227,107,0.45)';
      ctx.font = '700 22px Inter, sans-serif';
      ctx.fillText('~', 40, 240);
      ctx.fillText('+', 870, 240);
      ctx.fillText('−', 870, 320);
      break;
    }
    case 'substation': {
      // barramentos, isoladores e transformadores de potência
      ctx.strokeStyle = 'rgba(242,191,74,0.18)';
      ctx.lineWidth = 6;
      for (const y of [40, 500]) {
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(MAP_W - 20, y);
        ctx.stroke();
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(242,191,74,0.2)';
      for (let x = 60; x < MAP_W; x += 120) {
        for (const y of [40, 500]) {
          for (let k = 0; k < 3; k++) {
            const dy = (y < 100 ? 1 : -1) * (10 + k * 5);
            ctx.beginPath();
            ctx.ellipse(x, y + dy, 7, 2, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      const xfmr = (x: number, y: number) => {
        ctx.strokeStyle = 'rgba(242,191,74,0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 28, y - 20, 56, 40);
        ctx.beginPath();
        ctx.arc(x - 8, y, 11, 0, Math.PI * 2);
        ctx.moveTo(x + 19, y);
        ctx.arc(x + 8, y, 11, 0, Math.PI * 2);
        ctx.stroke();
      };
      xfmr(470, 345);
      xfmr(860, 160);
      xfmr(120, 490);
      break;
    }
    case 'chip': {
      // pastilha de silício: blocos funcionais, pads e fios de ligação
      ctx.fillStyle = 'rgba(120,130,150,0.07)';
      ctx.fillRect(14, 14, MAP_W - 28, MAP_H - 28);
      ctx.strokeStyle = 'rgba(200,210,225,0.18)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(14, 14, MAP_W - 28, MAP_H - 28);
      ctx.fillStyle = 'rgba(201,138,75,0.3)';
      for (let x = 40; x < MAP_W - 30; x += 40) {
        ctx.fillRect(x, 4, 14, 8);
        ctx.fillRect(x, MAP_H - 12, 14, 8);
      }
      for (let y = 40; y < MAP_H - 30; y += 40) {
        ctx.fillRect(4, y, 8, 14);
        ctx.fillRect(MAP_W - 12, y, 8, 14);
      }
      const blocks = [
        [140, 240, 70, 200],
        [360, 105, 88, 150],
        [618, 110, 64, 160],
        [500, 330, 70, 110],
        [730, 140, 90, 120],
      ];
      ctx.strokeStyle = 'rgba(120,180,255,0.12)';
      ctx.fillStyle = 'rgba(120,180,255,0.05)';
      for (const [x, y, w, h] of blocks) {
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      }
      break;
    }
    case 'line': {
      // torres de transmissão e catenárias ao fundo
      const tower = (x: number, y: number) => {
        ctx.strokeStyle = 'rgba(143,247,255,0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 14, y + 40);
        ctx.lineTo(x, y);
        ctx.lineTo(x + 14, y + 40);
        ctx.moveTo(x - 18, y + 10);
        ctx.lineTo(x + 18, y + 10);
        ctx.moveTo(x - 10, y + 22);
        ctx.lineTo(x + 10, y + 22);
        ctx.moveTo(x - 8, y + 25);
        ctx.lineTo(x + 6, y + 36);
        ctx.moveTo(x + 8, y + 25);
        ctx.lineTo(x - 6, y + 36);
        ctx.stroke();
      };
      const xs = [60, 260, 470, 680, 890];
      for (const x of xs) tower(x, 175);
      for (const x of xs) tower(x, 470);
      ctx.strokeStyle = 'rgba(143,247,255,0.1)';
      for (const y of [185, 480]) {
        for (let i = 0; i < xs.length - 1; i++) {
          ctx.beginPath();
          ctx.moveTo(xs[i] + 18, y);
          ctx.quadraticCurveTo((xs[i] + xs[i + 1]) / 2, y + 22, xs[i + 1] - 18, y);
          ctx.stroke();
        }
      }
      break;
    }
    case 'pcb':
      break;
  }
  ctx.restore();
}

function background(map: MapDef, dpr: number): HTMLCanvasElement {
  const key = `${map.id}@${dpr}`;
  const cached = bgCache.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = MAP_W * dpr;
  c.height = MAP_H * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  drawMapBackground(ctx, map);
  bgCache.set(key, c);
  return c;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  scale = 1;
  dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  /** Ajusta o canvas ao contêiner mantendo a proporção 16:9. */
  fit(w: number, h: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.scale = Math.max(0.2, Math.min(w / MAP_W, h / MAP_H));
    const cw = Math.round(MAP_W * this.scale);
    const ch = Math.round(MAP_H * this.scale);
    this.canvas.style.width = `${cw}px`;
    this.canvas.style.height = `${ch}px`;
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);
  }

  toWorld(clientX: number, clientY: number): Vec {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * MAP_W, y: ((clientY - r.top) / r.height) * MAP_H };
  }

  draw(eng: GameEngine, ui: RenderUi): void {
    const ctx = this.ctx;
    const k = this.scale * this.dpr;
    const t = eng.time;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(background(eng.map, this.dpr), 0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    this.drawFlow(eng, t);
    this.drawStageOverlays(eng, t);
    this.drawCore(eng, t);

    const selected = ui.selected !== null ? eng.unit(ui.selected) : undefined;

    // zonas RL sempre visíveis (são área de efeito real)
    for (const u of eng.units) {
      if (u.def.behavior !== 'zone') continue;
      const r = eng.rangeOf(u);
      ctx.fillStyle = 'rgba(69,207,224,0.06)';
      ctx.strokeStyle = 'rgba(69,207,224,0.28)';
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -t * 10;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(u.x, u.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (selected) this.drawSelection(eng, selected);

    // feixes contínuos do indutor (e derivados) e do supercondutor
    for (const u of eng.units) {
      if (u.def.behavior === 'beam' && u.target >= 0) {
        const e = eng.enemies.find((x) => x.uid === u.target);
        if (e) this.beam(u, e, t, u.ramp);
        for (const id of u.extra) {
          const x = eng.enemies.find((y) => y.uid === id);
          if (x) this.beam(u, x, t, u.ramp * 0.6);
        }
      } else if (u.def.behavior === 'super' && t >= u.stunUntil) {
        for (const id of u.extra) {
          const x = eng.enemies.find((y) => y.uid === id);
          if (x) this.beam(u, x, t, Math.max(0.2, u.ramp));
        }
      }
    }

    for (const e of eng.enemies) {
      const imm = eng.immuneType(e);
      drawEnemy(
        ctx,
        e,
        t,
        t < e.stunUntil && !e.def.behavior.controlImmune,
        (t < e.slowUntil || e.zoneSlow > 0 || e.meissner > 0) && !e.def.behavior.controlImmune,
        imm ? IMMUNE_LETTER[imm] : null,
        t < e.boostUntil || eng.inResonantZone(e),
      );
      if (!e.def.boss && e.hp < e.maxHp) this.hpBar(e);
    }

    for (const u of eng.units) {
      const b = u.def.behavior;
      // “carga” exibida no sprite: o que cada comportamento acumula (1.2 inclui os novos)
      let charge = 0;
      if (b === 'beam' || b === 'super') charge = u.ramp;
      else if (b === 'capacitor') charge = u.stored > 0 ? 1 : u.ramp * u.ramp;
      else if (b === 'amplifier' || b === 'opamp') charge = u.stats.gain > 0 ? u.stacks / u.stats.gain : 0;
      else if (b === 'timer' || b === 'crystal') charge = u.high ? 1 : 0;
      else if (b === 'switching') charge = u.stats.fsw > 0 ? u.fswStage / u.stats.fsw : 0;
      else if (b === 'grid') charge = u.stats.linkMax > 0 ? u.linked / u.stats.linkMax : 0;
      else if (b === 'plasma') charge = u.stormLeft > 0 ? 1 : 0;
      drawUnit(ctx, u.def.id, u.x, u.y, {
        tier: u.entry.tier,
        level: u.level,
        fire: Math.max(0, 1 - (t - u.lastFire) / 0.35),
        aim: Math.atan2(u.aimY - u.y, u.aimX - u.x),
        charge,
        stunned: t < u.stunUntil,
        t,
      });
      this.buffIcons(eng, u);
      if (u.def.ability && u.stats.ability) {
        if (eng.abilityReady(u)) {
          ctx.strokeStyle = '#f2bf4a';
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 6);
          ctx.beginPath();
          ctx.arc(u.x, u.y, 25, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (u.abilityCd > 0) {
          // recarga visível: arco que se completa até a habilidade ficar pronta
          const f = 1 - u.abilityCd / u.def.ability.cooldown;
          ctx.strokeStyle = 'rgba(242,191,74,0.55)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(u.x, u.y, 25, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
          ctx.stroke();
        }
      }
      if (u === selected) {
        ctx.strokeStyle = '#e4ebf3';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(u.x, u.y, 24, 0, Math.PI * 2);
        ctx.stroke();
      }
      // §7.2: contorno luminoso pulsante nas unidades escolhidas no Unit Manager
      if (ui.multi?.includes(u.uid)) {
        ctx.save();
        ctx.strokeStyle = '#f2bf4a';
        ctx.shadowColor = '#f2bf4a';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2.4;
        ctx.setLineDash([5, 4]);
        ctx.lineDashOffset = -t * 18;
        ctx.beginPath();
        ctx.arc(u.x, u.y, 27 + Math.sin(t * 4) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // §7.4: marca de unidade bloqueada contra venda
      if (u.locked) {
        ctx.fillStyle = '#9fb0c6';
        ctx.font = '700 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔒', u.x + 15, u.y - 15);
      }
    }

    for (const f of eng.fx) this.drawFx(f, t);

    if (ui.placing && ui.ghost) this.drawGhost(eng, ui);
    if (!ui.placing && ui.hover) this.drawHover(eng, ui.hover);
  }

  private drawFlow(eng: GameEngine, t: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.setLineDash([3, 21]);
    ctx.lineDashOffset = -t * (eng.phase === 'wave' ? 40 : 10);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = eng.phase === 'wave' ? 'rgba(255,154,71,0.55)' : 'rgba(61,155,255,0.35)';
    for (const pts of eng.map.paths) {
      pathStroke(ctx, pts);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCore(eng: GameEngine, t: number) {
    const ctx = this.ctx;
    const { x, y } = eng.map.core;
    const frac = eng.lives / eng.maxLives;
    const col = frac > 0.6 ? '#39d08a' : frac > 0.3 ? '#f2bf4a' : '#ff5f5f';
    ctx.save();
    ctx.translate(x, y);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 44);
    g.addColorStop(0, 'rgba(61,155,255,0.35)');
    g.addColorStop(1, 'rgba(61,155,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f1a28';
    ctx.strokeStyle = '#24456b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 29, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    // logotipo do EMLab: onda sobre o núcleo
    ctx.strokeStyle = '#3d9bff';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    for (let i = 0; i < 4; i++) ctx.arc(-9 + i * 6, 0, 3, Math.PI, 0, i % 2 === 1);
    ctx.stroke();
    ctx.fillStyle = '#45cfe0';
    ctx.beginPath();
    ctx.arc(14, 0, 2.4 + Math.sin(t * 3) * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Zonas bloqueadas da fase, trechos ressonantes e regiões de interferência ativas. */
  private drawStageOverlays(eng: GameEngine, t: number) {
    const ctx = this.ctx;
    ctx.save();
    for (const b of eng.blocked) {
      ctx.fillStyle = 'rgba(255,95,95,0.07)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(b.x, b.y, b.w, b.h);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,95,95,0.22)';
      ctx.lineWidth = 2;
      for (let k = -b.h; k < b.w; k += 14) {
        ctx.beginPath();
        ctx.moveTo(b.x + k, b.y + b.h);
        ctx.lineTo(b.x + k + b.h, b.y);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,95,95,0.5)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,143,143,0.85)';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + 13, b.w - 6);
    }
    // trechos ressonantes (modificador Ressonância magnética)
    const tmp = { x: 0, y: 0, angle: 0 };
    eng.resonantZones.forEach((zones, i) => {
      const p = eng.paths[i];
      for (const [a, z] of zones) {
        ctx.strokeStyle = 'rgba(199,125,255,0.35)';
        ctx.lineWidth = PATH_WIDTH - 6;
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -t * 30;
        ctx.beginPath();
        for (let d = a; d <= z; d += 8) {
          p.at(d, tmp);
          if (d === a) ctx.moveTo(tmp.x, tmp.y);
          else ctx.lineTo(tmp.x, tmp.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
    for (const r of eng.modRegions) {
      const g = ctx.createRadialGradient(r.x, r.y, r.r * 0.2, r.x, r.y, r.r);
      g.addColorStop(0, 'rgba(255,111,216,0.12)');
      g.addColorStop(1, 'rgba(255,111,216,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = t * 12;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private beam(u: UnitInst, e: EnemyInst, t: number, ramp: number) {
    const ctx = this.ctx;
    const c = u.def.color;
    ctx.save();
    ctx.strokeStyle = c;
    ctx.shadowColor = c;
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.3 + 0.7 * ramp;
    ctx.lineWidth = 1 + 3 * ramp;
    const dx = e.x - u.x;
    const dy = e.y - u.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    ctx.beginPath();
    ctx.moveTo(u.x, u.y);
    const seg = 10;
    for (let i = 1; i < seg; i++) {
      const f = i / seg;
      const wob = Math.sin(f * Math.PI * 5 + t * 30) * 3 * ramp;
      ctx.lineTo(u.x + dx * f + nx * wob, u.y + dy * f + ny * wob);
    }
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
    ctx.restore();
  }

  private hpBar(e: EnemyInst) {
    const ctx = this.ctx;
    const w = Math.max(18, e.def.radius * 2);
    const x = e.x - w / 2;
    const y = e.y - e.def.radius - 7;
    ctx.fillStyle = 'rgba(8,12,19,0.85)';
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    const f = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = f > 0.5 ? '#39d08a' : f > 0.25 ? '#f2bf4a' : '#ff5f5f';
    ctx.fillRect(x, y, w * f, 3);
    if (e.armor > 0) {
      ctx.fillStyle = '#a3b2c4';
      ctx.fillRect(x + w + 2, y - 1, 3, 5);
    }
  }

  private buffIcons(eng: GameEngine, u: UnitInst) {
    const ctx = this.ctx;
    const icons: string[] = [];
    if (u.buff.protected) icons.push('#ff9a47');
    if (u.buff.speed > 0) icons.push('#45cfe0');
    if (u.buff.dmg > (u.buff.protected ? 0.0001 : 0) || u.buff.boosted) icons.push('#ff5f5f');
    if (u.buff.powered) icons.push('#39d08a');
    if (u.buff.noise > 0) icons.push('#a28bff');
    const ov = eng.overloadState(u);
    if (ov === 'boost') icons.push('#f2bf4a');
    if (u.buff.syn.length) icons.push('#5ff2e8');
    if (u.buff.emi > 0) icons.push('#ff6fd8');
    if (eng.time < u.overheatUntil) icons.push('#ff3b3b');
    for (const m of u.buff.mods) icons.push(MODIFIERS[m].color);
    if (eng.saturated(u)) icons.push('#ffffff');
    const w = (icons.length - 1) * 7;
    icons.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(u.x - w / 2 + i * 7, u.y - 25, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  private drawSelection(eng: GameEngine, u: UnitInst) {
    const ctx = this.ctx;
    const def = u.def;
    const range = eng.rangeOf(u);
    if (!AURA_ONLY.has(def.behavior) && def.behavior !== 'zone') {
      ctx.fillStyle = 'rgba(61,155,255,0.07)';
      ctx.strokeStyle = 'rgba(61,155,255,0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(u.x, u.y, range, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (u.stats.aura > 0) {
      ctx.strokeStyle = def.color;
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(u.x, u.y, u.stats.aura, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    // sinergias: quem esta unidade fortalece e quem a fortalece
    ctx.lineWidth = 1.6;
    for (const other of eng.units) {
      const gives = other.links.includes(u.uid);
      const gets = u.links.includes(other.uid);
      if (!gives && !gets) continue;
      ctx.strokeStyle = gives ? def.color : other.def.color;
      ctx.globalAlpha = 0.75;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(other.x, other.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  private drawGhost(eng: GameEngine, ui: RenderUi) {
    const ctx = this.ctx;
    const id = ui.placing!;
    const def = UNITS[id];
    const g = ui.ghost!;
    const col = ui.ghostOk ? '61,155,255' : '255,95,95';
    const auraOnly = AURA_ONLY.has(def.behavior);
    const r = auraOnly ? def.base.aura : def.base.range;
    ctx.fillStyle = `rgba(${col},0.08)`;
    ctx.strokeStyle = `rgba(${col},0.7)`;
    ctx.lineWidth = 1.4;
    ctx.setLineDash(auraOnly ? [6, 5] : []);
    ctx.beginPath();
    ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.7;
    const entry = eng.entryFor(id);
    drawUnit(ctx, id, g.x, g.y, { tier: entry?.tier ?? 0, level: 0, fire: 0, aim: 0, charge: 0, stunned: false, t: eng.time });
    ctx.globalAlpha = 1;
    if (!ui.ghostOk) {
      ctx.font = '600 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff8f8f';
      ctx.fillText(ui.ghostReason, g.x, g.y - 30);
    }
  }

  private drawHover(eng: GameEngine, p: Vec) {
    const ctx = this.ctx;
    const e = eng.enemies.find((x) => (x.x - p.x) ** 2 + (x.y - p.y) ** 2 < (x.def.radius + 6) ** 2);
    if (!e) return;
    const imm = eng.immuneType(e);
    const text = `${e.def.name} · ${Math.ceil(e.hp)}/${Math.round(e.maxHp)}${e.armor ? ` · blindagem ${e.armor}` : ''}${e.heat ? ` · calor ${e.heat}` : ''}${e.open ? ' · ABERTO' : ''}${imm ? ` · protegido: ${DAMAGE_LABEL[imm]}` : ''}`;
    ctx.font = '600 12px Inter, sans-serif';
    const w = ctx.measureText(text).width + 14;
    const x = Math.min(MAP_W - w - 4, Math.max(4, e.x - w / 2));
    const y = Math.max(4, e.y - e.def.radius - 34);
    ctx.fillStyle = 'rgba(15,22,33,0.95)';
    ctx.strokeStyle = e.def.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 20, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e4ebf3';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 7, y + 14);
  }

  private drawFx(f: Fx, t: number) {
    const ctx = this.ctx;
    const p = Math.min(1, (t - f.t) / f.dur);
    ctx.save();
    switch (f.kind) {
      case 'bolt': {
        ctx.strokeStyle = f.color;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 6;
        ctx.globalAlpha = 1 - p;
        ctx.lineWidth = 2;
        const dx = f.x2 - f.x;
        const dy = f.y2 - f.y;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        for (let i = 1; i < 5; i++) {
          const j = ((i * 7919 + Math.floor(f.t * 100)) % 9) - 4;
          ctx.lineTo(f.x + (dx * i) / 5 + j * 1.5, f.y + (dy * i) / 5 - j * 1.5);
        }
        ctx.lineTo(f.x2, f.y2);
        ctx.stroke();
        break;
      }
      case 'pulse':
      case 'ring':
      case 'place':
      case 'upgrade':
      case 'emp':
      case 'leak': {
        ctx.strokeStyle = f.color;
        ctx.globalAlpha = (1 - p) * (f.kind === 'emp' ? 0.9 : 0.8);
        ctx.lineWidth = f.kind === 'upgrade' ? 3 : 2;
        const rr = f.kind === 'pulse' || f.kind === 'emp' ? f.r * (0.4 + 0.6 * p) : f.r * (0.6 + 0.6 * p);
        ctx.beginPath();
        ctx.arc(f.x, f.y, rr, 0, Math.PI * 2);
        ctx.stroke();
        if (f.kind === 'pulse' || f.kind === 'emp') {
          ctx.fillStyle = f.color;
          ctx.globalAlpha = (1 - p) * 0.14;
          ctx.fill();
        }
        if (f.kind === 'upgrade') {
          ctx.fillStyle = f.color;
          ctx.globalAlpha = 1 - p;
          ctx.font = '800 14px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('▲', f.x, f.y - 26 - p * 14);
        }
        break;
      }
      case 'discharge': {
        ctx.strokeStyle = f.color;
        ctx.fillStyle = f.color;
        ctx.globalAlpha = 1 - p;
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + f.t;
          ctx.beginPath();
          ctx.moveTo(f.x, f.y);
          ctx.lineTo(f.x + Math.cos(a) * f.r * (0.5 + p * 0.5), f.y + Math.sin(a) * f.r * (0.5 + p * 0.5));
          ctx.stroke();
        }
        ctx.globalAlpha = (1 - p) * 0.15;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
        if (f.x2 !== f.x || f.y2 !== f.y) {
          ctx.globalAlpha = 1 - p;
          ctx.beginPath();
          ctx.moveTo(f.x2, f.y2);
          ctx.lineTo(f.x, f.y);
          ctx.stroke();
        }
        break;
      }
      case 'spark':
      case 'dash': {
        ctx.strokeStyle = f.color;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 10;
        ctx.globalAlpha = 1 - p;
        ctx.lineWidth = f.kind === 'dash' ? 4 : 3;
        ctx.beginPath();
        ctx.moveTo(f.x2, f.y2);
        ctx.lineTo(f.x, f.y);
        ctx.stroke();
        break;
      }
      case 'wave': {
        // anel que se expande (oscilador, onda harmônica)
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 3 * (1 - p) + 1;
        ctx.globalAlpha = 1 - p;
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          const rr = f.r * p + Math.sin(a * 10 + f.t * 20) * 3 * (1 - p);
          if (i === 0) ctx.moveTo(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr);
          else ctx.lineTo(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr);
        }
        ctx.stroke();
        break;
      }
      case 'heat': {
        ctx.strokeStyle = f.color;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 1 - p;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        const mx = (f.x + f.x2) / 2;
        const my = (f.y + f.y2) / 2 - 10;
        ctx.quadraticCurveTo(mx, my, f.x2, f.y2);
        ctx.stroke();
        break;
      }
      case 'quench': {
        const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.r * (0.3 + 0.7 * p));
        g.addColorStop(0, 'rgba(255,255,255,0.7)');
        g.addColorStop(0.5, 'rgba(95,242,232,0.35)');
        g.addColorStop(1, 'rgba(95,242,232,0)');
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.3 + 0.7 * p), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }
      case 'death': {
        ctx.fillStyle = f.color;
        ctx.globalAlpha = (1 - p) * 0.8;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + f.t * 3;
          ctx.beginPath();
          ctx.arc(f.x + Math.cos(a) * f.r * p, f.y + Math.sin(a) * f.r * p, 2.5 * (1 - p) + 1, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'text': {
        ctx.fillStyle = f.color;
        ctx.globalAlpha = 1 - p * p;
        ctx.font = '700 12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(f.text ?? '', f.x, f.y - p * 18);
        break;
      }
    }
    ctx.restore();
  }
}
