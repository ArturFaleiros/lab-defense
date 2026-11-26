import type { SfxId } from '../engine/GameEngine';

/**
 * Efeitos sonoros sintetizados com Web Audio (sem arquivos externos). Sons curtos e discretos;
 * o volume e o liga/desliga vêm das configurações do jogador.
 */

type Tone = { f: number; f2?: number; dur: number; type: OscillatorType; gain: number; delay?: number };

const SOUNDS: Record<SfxId, Tone[]> = {
  place: [{ f: 420, f2: 640, dur: 0.09, type: 'triangle', gain: 0.25 }],
  upgrade: [
    { f: 520, dur: 0.08, type: 'triangle', gain: 0.22 },
    { f: 780, dur: 0.12, type: 'triangle', gain: 0.22, delay: 0.07 },
  ],
  sell: [{ f: 600, f2: 320, dur: 0.12, type: 'triangle', gain: 0.2 }],
  zap: [{ f: 1400, f2: 500, dur: 0.05, type: 'square', gain: 0.05 }],
  pulse: [{ f: 180, f2: 70, dur: 0.18, type: 'sine', gain: 0.22 }],
  discharge: [{ f: 900, f2: 120, dur: 0.16, type: 'sawtooth', gain: 0.08 }],
  beam: [{ f: 240, f2: 260, dur: 0.05, type: 'sine', gain: 0.03 }],
  kill: [{ f: 700, f2: 1100, dur: 0.05, type: 'sine', gain: 0.06 }],
  leak: [{ f: 200, f2: 110, dur: 0.25, type: 'square', gain: 0.12 }],
  wave: [
    { f: 330, dur: 0.1, type: 'triangle', gain: 0.2 },
    { f: 495, dur: 0.14, type: 'triangle', gain: 0.2, delay: 0.1 },
  ],
  boss: [
    { f: 110, f2: 90, dur: 0.5, type: 'sawtooth', gain: 0.12 },
    { f: 165, f2: 130, dur: 0.5, type: 'sawtooth', gain: 0.08, delay: 0.05 },
  ],
  emp: [{ f: 90, f2: 40, dur: 0.35, type: 'sawtooth', gain: 0.12 }],
  coin: [{ f: 880, f2: 1320, dur: 0.07, type: 'sine', gain: 0.08 }],
  error: [{ f: 160, dur: 0.12, type: 'square', gain: 0.07 }],
  win: [
    { f: 523, dur: 0.14, type: 'triangle', gain: 0.22 },
    { f: 659, dur: 0.14, type: 'triangle', gain: 0.22, delay: 0.13 },
    { f: 784, dur: 0.28, type: 'triangle', gain: 0.22, delay: 0.26 },
  ],
  lose: [
    { f: 392, f2: 370, dur: 0.2, type: 'triangle', gain: 0.2 },
    { f: 311, f2: 290, dur: 0.35, type: 'triangle', gain: 0.2, delay: 0.2 },
  ],
  ability: [{ f: 300, f2: 1200, dur: 0.25, type: 'sawtooth', gain: 0.1 }],
  capsule: [
    { f: 440, f2: 880, dur: 0.3, type: 'sine', gain: 0.18 },
    { f: 660, f2: 1320, dur: 0.35, type: 'triangle', gain: 0.16, delay: 0.18 },
    { f: 988, dur: 0.4, type: 'triangle', gain: 0.14, delay: 0.4 },
  ],
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let volume = 0.6;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

export function configureSound(on: boolean, vol: number): void {
  enabled = on;
  volume = vol;
  if (master) master.gain.value = vol;
}

export function playSfx(id: SfxId): void {
  if (!enabled || volume <= 0) return;
  const ac = audio();
  if (!ac || !master) return;
  const now = ac.currentTime;
  for (const tone of SOUNDS[id]) {
    const start = now + (tone.delay ?? 0);
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.f, start);
    if (tone.f2) osc.frequency.exponentialRampToValueAtTime(tone.f2, start + tone.dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(tone.gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + tone.dur);
    osc.connect(g).connect(master);
    osc.start(start);
    osc.stop(start + tone.dur + 0.02);
  }
}
