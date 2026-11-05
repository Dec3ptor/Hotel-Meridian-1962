/**
 * Synthesised audio on the Web Audio API: rain and thunder, a crackling
 * jazz radio in the bar, footsteps by floor, the creaking step, a clock
 * tick that quickens after 1:30, and stings for clues and the loop reset.
 * Everything is procedural; no audio files. The context is created lazily
 * on the first user gesture.
 */
import type { Static } from '../sim/registry';
import type { RoomId, World } from '../sim/types';

export type Sfx =
  | 'step_carpet'
  | 'step_tile'
  | 'step_gravel'
  | 'step_puddle'
  | 'creak'
  | 'thunder'
  | 'knock'
  | 'bell'
  | 'scream'
  | 'gunshot'
  | 'glass'
  | 'struggle'
  | 'clue'
  | 'reset'
  | 'door'
  | 'ui';

interface Volumes {
  master: number;
  music: number;
  sfx: number;
}

const FLOOR_STEP: Record<string, Sfx> = {
  lot: 'step_gravel',
  kitchen: 'step_tile',
  laundry: 'step_tile',
  room6: 'step_tile',
  room7: 'step_tile',
  office: 'step_carpet',
  bar: 'step_carpet',
};

export class AudioEngine {
  private ctx: AudioContext | undefined;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private rainGain: GainNode | undefined;
  private radioGain: GainNode | undefined;
  private noise: AudioBuffer | undefined;
  private radioTimer: number | undefined;
  private radioNext = 0;
  private radioBeat = 0;
  private tickTimer: number | undefined;
  private tickInterval = 1000;
  private volumes: Volumes = { master: 0.8, music: 0.6, sfx: 0.8 };
  private lastStep = 0;
  private roomDistance: number[][] = [];
  muted = false;

  constructor(private s: Static) {
    this.buildRoomDistances();
  }

  get ready(): boolean {
    return this.ctx !== undefined;
  }

  /** Create the context after a user gesture; start the beds. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(ctx.destination);
    this.applyVolumes();
    this.noise = this.makeNoise(2);
    this.startRain();
    this.startRadio();
    this.startClock();
  }

  setVolumes(v: Partial<Volumes>): void {
    this.volumes = { ...this.volumes, ...v };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : this.volumes.master;
    this.musicBus.gain.value = this.volumes.music;
    this.sfxBus.gain.value = this.volumes.sfx;
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private buildRoomDistances(): void {
    const nav = this.s.nav;
    const n = nav.roomIds.length;
    for (let i = 0; i < n; i++) {
      const row = new Array<number>(n).fill(Infinity);
      row[i] = 0;
      const queue = [i];
      while (queue.length) {
        const cur = queue.shift()!;
        for (let j = 0; j < n; j++) {
          if (row[j] !== Infinity) continue;
          if (nav.linkTable[cur]![j]!.length === 0) continue;
          row[j] = row[cur]! + 1;
          queue.push(j);
        }
      }
      this.roomDistance.push(row);
    }
  }

  private distance(a: RoomId, b: RoomId): number {
    const i = this.s.nav.roomIndex[a];
    const j = this.s.nav.roomIndex[b];
    if (i === undefined || j === undefined) return 99;
    return this.roomDistance[i]![j]!;
  }

  // ---------------------------------------------------------------------------
  // Beds
  // ---------------------------------------------------------------------------

  private startRain(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise!;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1400;
    band.Q.value = 0.6;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 5000;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0.08;
    src.connect(band).connect(low).connect(this.rainGain).connect(this.sfxBus);
    src.start();
  }

  private startRadio(): void {
    const ctx = this.ctx!;
    this.radioGain = ctx.createGain();
    this.radioGain.gain.value = 0.0;
    // A narrow "radio" band with a little crackle.
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1200;
    band.Q.value = 0.9;
    band.connect(this.radioGain).connect(this.musicBus);
    const crackle = ctx.createBufferSource();
    crackle.buffer = this.noise!;
    crackle.loop = true;
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.015;
    crackle.connect(crackleGain).connect(band);
    crackle.start();
    this.radioNext = ctx.currentTime + 0.1;
    const bass = [55, 55, 65.4, 73.4, 82.4, 82.4, 73.4, 65.4, 55, 58.3, 65.4, 61.7];
    const lead = [220, 261.6, 293.7, 329.6, 392, 440, 523.3, 392, 329.6, 293.7];
    const schedule = () => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      while (this.radioNext < now + 0.6) {
        const t = this.radioNext;
        const beat = this.radioBeat;
        const swing = beat % 2 === 1 ? 0.07 : 0;
        // Walking bass.
        const b = ctx.createOscillator();
        b.type = 'triangle';
        b.frequency.value = bass[(beat >> 1) % bass.length]!;
        const bg = ctx.createGain();
        bg.gain.setValueAtTime(0.0001, t + swing);
        bg.gain.exponentialRampToValueAtTime(0.5, t + swing + 0.02);
        bg.gain.exponentialRampToValueAtTime(0.0001, t + swing + 0.42);
        b.connect(bg).connect(band);
        b.start(t + swing);
        b.stop(t + swing + 0.45);
        // Brushes.
        const brush = ctx.createBufferSource();
        brush.buffer = this.noise!;
        const bf = ctx.createBiquadFilter();
        bf.type = 'highpass';
        bf.frequency.value = 6000;
        const bgn = ctx.createGain();
        bgn.gain.setValueAtTime(beat % 2 === 0 ? 0.08 : 0.04, t + swing);
        bgn.gain.exponentialRampToValueAtTime(0.0001, t + swing + 0.12);
        brush.connect(bf).connect(bgn).connect(band);
        brush.start(t + swing);
        brush.stop(t + swing + 0.15);
        // A lazy lead every other beat, drifting through the scale.
        if (beat % 2 === 0 && Math.random() < 0.8) {
          const l = ctx.createOscillator();
          l.type = 'square';
          const idx = Math.floor(Math.abs(Math.sin(beat * 0.7)) * lead.length) % lead.length;
          l.frequency.value = lead[idx]! * (Math.random() < 0.15 ? 2 : 1);
          const lg = ctx.createGain();
          lg.gain.setValueAtTime(0.0001, t + swing);
          lg.gain.exponentialRampToValueAtTime(0.09, t + swing + 0.03);
          lg.gain.exponentialRampToValueAtTime(0.0001, t + swing + 0.6);
          l.connect(lg).connect(band);
          l.start(t + swing);
          l.stop(t + swing + 0.65);
        }
        this.radioNext += 0.5;
        this.radioBeat++;
      }
    };
    this.radioTimer = window.setInterval(schedule, 250);
  }

  private startClock(): void {
    const tick = () => {
      this.play('ui', 0.5, 'clock');
      this.tickTimer = window.setTimeout(tick, this.tickInterval);
    };
    this.tickTimer = window.setTimeout(tick, this.tickInterval);
  }

  /** Called each frame: ambience follows the player's room and the clock. */
  update(w: World, radioOn: boolean, afterHalfPastOne: boolean): void {
    if (!this.ctx) return;
    const room = w.agents.player?.room ?? 'lot';
    const def = this.s.rooms[room];
    const outdoor = def?.outdoor === true;
    const nearWindow = room === 'room7' || room === 'corridor' || room === 'suite3' || room === 'suite1';
    const rainLevel = outdoor ? 0.22 : nearWindow ? 0.09 : 0.045;
    this.rainGain?.gain.setTargetAtTime(rainLevel, this.ctx.currentTime, 0.4);
    const d = this.distance(room, 'bar');
    const radioLevel = !radioOn ? 0 : d === 0 ? 0.5 : d === 1 ? 0.22 : d === 2 ? 0.08 : 0.02;
    this.radioGain?.gain.setTargetAtTime(radioLevel, this.ctx.currentTime, 0.5);
    this.tickInterval = afterHalfPastOne ? 500 : 1000;
  }

  // ---------------------------------------------------------------------------
  // One-shots
  // ---------------------------------------------------------------------------

  stepFor(room: RoomId, nowMs: number): void {
    if (nowMs - this.lastStep < 220) return;
    this.lastStep = nowMs;
    this.play(FLOOR_STEP[room] ?? 'step_carpet', 0.35);
  }

  /** Play a sound; `gain` scales it; room distance from the player attenuates it. */
  play(kind: Sfx, gain = 1, variant?: string, fromRoom?: RoomId, playerRoom?: RoomId): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    let level = gain;
    if (fromRoom && playerRoom) {
      const d = this.distance(fromRoom, playerRoom);
      level *= d === 0 ? 1 : d === 1 ? 0.5 : d === 2 ? 0.25 : d === 3 ? 0.1 : 0;
      if (level <= 0.001) return;
    }
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = level;
    out.connect(this.sfxBus);
    const noiseBurst = (ms: number, filter: BiquadFilterType, freq: number, q: number, peak: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise!;
      const f = ctx.createBiquadFilter();
      f.type = filter;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      src.connect(f).connect(g).connect(out);
      src.start(t);
      src.stop(t + ms / 1000 + 0.05);
    };
    const tone = (freq: number, ms: number, type: OscillatorType, peak: number, endFreq?: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + ms / 1000);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + ms / 1000 + 0.05);
    };
    switch (kind) {
      case 'step_carpet':
        noiseBurst(70, 'lowpass', 400, 0.8, 0.25);
        break;
      case 'step_tile':
        noiseBurst(60, 'bandpass', 1800, 2, 0.3);
        break;
      case 'step_gravel':
        noiseBurst(110, 'bandpass', 900, 0.8, 0.35);
        break;
      case 'step_puddle':
        noiseBurst(140, 'bandpass', 2600, 1, 0.3);
        break;
      case 'creak':
        tone(180, 420, 'sawtooth', 0.12, 110);
        noiseBurst(300, 'bandpass', 700, 3, 0.08);
        break;
      case 'thunder':
        noiseBurst(2600, 'lowpass', 220, 0.5, 0.9);
        noiseBurst(900, 'lowpass', 90, 0.5, 0.6);
        break;
      case 'knock':
        noiseBurst(90, 'lowpass', 300, 1, 0.6);
        window.setTimeout(() => this.play('ui', level, 'knock2'), 180);
        break;
      case 'bell':
        tone(1480, 900, 'sine', 0.3);
        tone(2960, 500, 'sine', 0.08);
        break;
      case 'scream':
        tone(900, 650, 'sawtooth', 0.18, 1400);
        noiseBurst(600, 'bandpass', 2000, 1.5, 0.2);
        break;
      case 'gunshot':
        noiseBurst(260, 'lowpass', 1200, 0.5, 1.0);
        noiseBurst(1200, 'lowpass', 150, 0.5, 0.5);
        break;
      case 'glass':
        noiseBurst(350, 'highpass', 4000, 1, 0.4);
        tone(3200, 220, 'sine', 0.06, 2000);
        break;
      case 'struggle':
        noiseBurst(400, 'lowpass', 500, 1, 0.3);
        break;
      case 'door':
        noiseBurst(80, 'lowpass', 500, 1, 0.25);
        break;
      case 'clue':
        tone(880, 500, 'sine', 0.2);
        window.setTimeout(() => this.play('ui', level, 'clue2'), 140);
        break;
      case 'reset':
        tone(110, 2400, 'triangle', 0.3, 55);
        noiseBurst(1800, 'lowpass', 300, 0.5, 0.2);
        break;
      case 'ui':
        if (variant === 'clock') noiseBurst(25, 'bandpass', 1200, 6, 0.08);
        else if (variant === 'knock2') noiseBurst(90, 'lowpass', 300, 1, 0.5);
        else if (variant === 'clue2') tone(1320, 600, 'sine', 0.18);
        else noiseBurst(30, 'bandpass', 2000, 4, 0.1);
        break;
    }
  }

  destroy(): void {
    if (this.radioTimer !== undefined) window.clearInterval(this.radioTimer);
    if (this.tickTimer !== undefined) window.clearTimeout(this.tickTimer);
    void this.ctx?.close();
    this.ctx = undefined;
  }
}
