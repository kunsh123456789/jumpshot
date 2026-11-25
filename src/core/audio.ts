import { settings } from './settings';
import { fxRng } from './rng';

/** Recorded sound effects (CC0, from Freesound; see SOUND_CREDITS.md), bundled with the build. */
/**
 * The clips are inlined into the build as base64 data: URLs. Decode those
 * directly: hosts with a strict Content-Security-Policy (connect-src) refuse
 * fetch() of data: URLs, which silently left every sound on the synth fallback.
 * Real URLs (a dev server or a non-inlined build) still go through fetch.
 */
function bytesOf(url: string): Promise<ArrayBuffer> {
  if (url.startsWith('data:')) {
    try {
      const bin = atob(url.slice(url.indexOf(',') + 1));
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return Promise.resolve(out.buffer);
    } catch (e) { return Promise.reject(e); }
  }
  return fetch(url).then((r) => r.arrayBuffer());
}

/** Mix calibration (measured with the bus-level test against the previous build; see DECISIONS.md). */
const MIX = { inst: 0.3, hit: 0.9 };
const HIT_L = ['hit_l1', 'hit_l2', 'hit_l3', 'hit_l4'];
const HIT_M = ['hit_m1', 'hit_m2', 'hit_m3', 'hit_m4'];
const HIT_H = ['hit_h1', 'hit_h2', 'hit_h3'];

const SFX_URLS = import.meta.glob('../assets/sfx/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/**
 * WebAudio sound. Every effect and every music instrument plays recorded CC0
 * samples from Freesound (Settings -> Sound effects = Recorded, the default).
 * Each also keeps its original synthesized version, which plays until the
 * samples have decoded and when Settings -> Sound effects = Synthesized.
 *
 * Hits play one finished punch from three tiers (light / medium / heavy),
 * pre-mixed offline from Freesound punches; heavies also duck the music.
 */
class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  /** Music bus (classic loop and Rhythm Mode songs both play through it). */
  music!: GainNode;
  /** Trim for recorded music instruments (one-shots are mastered hot; this sits them where the synth band was). */
  inst!: GainNode;
  private comp!: DynamicsCompressorNode;
  private noise!: AudioBuffer;
  private lastPlay: Record<string, number> = {};
  private lastPick: Record<string, number> = {};
  /** Decoded recorded samples by name (file name without extension). */
  private bufs: Record<string, AudioBuffer> = {};
  private musicTimer = 0;
  private musicStep = 0;
  private musicNext = 0;
  musicOn = false;
  intensity = 0;

  /** Must be called from a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      // Glue compressor with a slower attack so a punch's first ~10 ms (the part you feel) passes
      // untouched, then a fast brick-wall-ish limiter after the master gain so peaks never clip.
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.knee.value = 6; this.comp.ratio.value = 4;
      this.comp.attack.value = 0.012; this.comp.release.value = 0.14;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -1.5; limiter.knee.value = 0; limiter.ratio.value = 20;
      limiter.attack.value = 0.001; limiter.release.value = 0.06;
      this.master = ctx.createGain();
      this.sfx = ctx.createGain();
      this.music = ctx.createGain();
      this.sfx.connect(this.comp);
      this.music.connect(this.comp);
      this.inst = ctx.createGain();
      this.inst.gain.value = MIX.inst;
      this.inst.connect(this.music);
      this.comp.connect(this.master);
      this.master.connect(limiter);
      limiter.connect(ctx.destination);
      const len = ctx.sampleRate * 1.0;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolume();
      this.loadSamples();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private loadSamples(): void {
    const ctx = this.ctx!;
    for (const [path, url] of Object.entries(SFX_URLS)) {
      const name = path.slice(path.lastIndexOf('/') + 1, path.lastIndexOf('.'));
      bytesOf(url).then((b) => ctx.decodeAudioData(b)).then((buf) => { this.bufs[name] = buf; }).catch(() => { /* synth fallback */ });
    }
  }

  /** Recorded samples are in use and this one has decoded. */
  has(name: string): boolean { return settings.sfxStyle !== 'synth' && !!this.ctx && !!this.bufs[name]; }

  /** Pick a variant, never the same one twice in a row (repeats are what make hits sound robotic). */
  private pick(group: string[]): string {
    if (group.length === 1) return group[0];
    const key = group[0];
    let i = Math.floor(fxRng.next() * group.length);
    if (i === this.lastPick[key]) i = (i + 1) % group.length;
    this.lastPick[key] = i;
    return group[i];
  }

  /**
   * Play a sample at context time t into a bus (SFX by default). dur > 0 holds
   * it that long then releases (pitched music notes). False when the Synth
   * setting is on or the sample isn't loaded, so the caller can synthesize.
   */
  sample(name: string, t: number, gain: number, rate = 1, dest?: AudioNode, dur = 0): boolean {
    if (!this.has(name)) return false;
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.bufs[name];
    src.playbackRate.value = Math.max(0.1, Math.min(8, rate));
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    src.connect(g); g.connect(dest ?? this.sfx);
    src.start(t);
    if (dur > 0) {
      g.gain.setValueAtTime(gain, t + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
      src.stop(t + dur + 0.08);
    }
    return true;
  }

  /** A pitched sample note: the sample's recorded pitch is rootHz; it is re-pitched to hz. */
  note(name: string, rootHz: number, t: number, hz: number, dur: number, gain: number, dest?: AudioNode): boolean {
    return this.sample(name, t, gain, hz / rootHz, dest ?? this.music, dur);
  }

  /** Play a recorded effect now (a group picks a non-repeating variant). */
  private rec(name: string | string[], gain: number, rate = 1, delay = 0, dur = 0): boolean {
    if (!this.ctx) return false;
    return this.sample(Array.isArray(name) ? this.pick(name) : name, this.ctx.currentTime + delay, gain, rate, undefined, dur);
  }

  /** Dip the music for a moment so a big impact punches through, then let it swell back. */
  private duck(depth: number, sec: number): void {
    const ctx = this.ctx!;
    const g = this.music.gain, t = ctx.currentTime, base = settings.musicVolume * 0.5;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(base * depth, t + 0.008);
    g.setTargetAtTime(base, t + 0.03, sec / 3);
  }

  applyVolume(): void {
    if (!this.ctx) return;
    this.master.gain.value = settings.masterVolume;
    this.music.gain.value = settings.musicVolume * 0.5;
    this.sfx.gain.value = 0.9;
  }

  private ok(key: string, minGap: number): boolean {
    if (!this.ctx || this.ctx.state !== 'running') return false;
    const t = this.ctx.currentTime;
    if ((this.lastPlay[key] ?? -1) > t - minGap) return false;
    this.lastPlay[key] = t;
    return true;
  }

  noiseBurst(t: number, dur: number, gain: number, type: BiquadFilterType, freq: number, q = 1, freqEnd = 0, dest?: AudioNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + fxRng.next() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd > 0) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest ?? this.sfx);
    src.start(t, fxRng.next() * 0.5); src.stop(t + dur + 0.02);
  }

  tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, gain: number, dest?: AudioNode, attack = 0.003): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest ?? this.sfx);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /** Punch/kick impact. weight 0..1, pitch multiplier climbs with combo. */
  hit(weight: number, pitch: number, kind: 'punch' | 'kick' | 'heavy' | 'slash' = 'punch', crit = false): void {
    if (!this.ok('hit', 0.018)) return;
    const t = this.ctx!.currentTime;
    const r = 0.94 + fxRng.next() * 0.12;
    const p = pitch * r;
    const v = (0.55 + weight * 0.45) * (0.85 + fxRng.next() * 0.3);
    if (this.has('hit_m1')) {
      // One finished punch per hit: three tiers, each pre-mixed offline from Freesound punches
      // (core punch + low thud + transient snap, EQ'd, saturated and limited; see DECISIONS.md).
      const h = MIX.hit * (0.8 + weight * 0.25) * (0.92 + fxRng.next() * 0.16);
      const rp = (1 + (pitch - 1) * 0.2) * (0.97 + fxRng.next() * 0.06) * (kind === 'kick' ? 0.94 : 1);
      const tier = weight >= 0.72 ? HIT_H : weight >= 0.42 ? HIT_M : HIT_L;
      this.rec(tier, h, rp);
      if (kind === 'slash') this.rec('staff', 0.4 * h, rp * 1.15);
      if (weight >= 0.72) this.duck(0.45, 0.22);
      else if (weight >= 0.55) this.duck(0.75, 0.1);
      if (crit) { this.rec('ping', 0.45, rp * 1.3); this.rec('m_glass', 0.25, 2, 0.012); }
      return;
    }
    // body thump
    this.tone(t, 'sine', (170 - weight * 70) * p, 42 * p, 0.09 + weight * 0.16, 0.9 * v);
    this.tone(t, 'triangle', (320 - weight * 120) * p, 90 * p, 0.05 + weight * 0.06, 0.35 * v);
    // crack / slap
    const bright = kind === 'kick' ? 2600 : kind === 'slash' ? 5200 : 3400;
    this.noiseBurst(t, 0.035 + weight * 0.05, 0.75 * v, 'bandpass', bright * p, 0.9);
    this.noiseBurst(t, 0.08 + weight * 0.14, 0.5 * v * weight + 0.12, 'lowpass', 900 * p, 0.7, 180);
    if (kind === 'slash') this.noiseBurst(t, 0.12, 0.25 * v, 'highpass', 6000, 0.5, 2000);
    if (crit) this.tone(t, 'square', 1400 * p, 2200 * p, 0.12, 0.12);
  }

  whoosh(weight: number): void {
    if (!this.ok('whoosh', 0.03)) return;
    const t = this.ctx!.currentTime;
    const d = 0.1 + weight * 0.12;
    if (this.rec(['whoosh1', 'whoosh2', 'whoosh3'], 0.35 + weight * 0.45, 1.15 - weight * 0.3 + (fxRng.next() - 0.5) * 0.1)) return;
    this.noiseBurst(t, d, 0.12 + weight * 0.2, 'bandpass', 600 + weight * 300, 1.4, 2400 + weight * 1500);
  }

  launch(): void {
    if (!this.ok('launch', 0.05)) return;
    const t = this.ctx!.currentTime;
    if (this.rec('launch', 0.8, 1.1)) { this.rec('whoosh2', 0.4, 0.8); this.rec(HIT_M, 0.45, 0.95); return; }
    this.tone(t, 'sine', 140, 720, 0.22, 0.5);
    this.tone(t, 'square', 280, 1200, 0.12, 0.08);
    this.noiseBurst(t, 0.28, 0.35, 'bandpass', 500, 1.2, 4000);
  }

  spike(power = 1): void {
    if (!this.ok('spike', 0.05)) return;
    const t = this.ctx!.currentTime;
    if (this.rec('slam', 0.8 + power * 0.2, 0.8)) {
      this.rec('boom', 0.4 + power * 0.3, 1.1);
      this.rec(HIT_H, 0.6 + power * 0.2, 0.82); this.rec('m_808', 0.35 + power * 0.15, 0.75, 0, 0.4);
      this.duck(0.35, 0.35);
      return;
    }
    this.tone(t, 'sine', 110, 28, 0.5 + power * 0.3, 1.0);
    this.tone(t, 'sawtooth', 70, 30, 0.25, 0.18);
    this.noiseBurst(t, 0.5 + power * 0.3, 0.8, 'lowpass', 1400, 0.8, 120);
    this.noiseBurst(t, 0.06, 0.6, 'bandpass', 2200, 1);
  }

  /** Special: a rising sweep under the trace phase, and the grade sting when the trace ends (good = CLEAN / PERFECT). */
  riser(sec: number): void {
    if (!this.ok('riser', 0.3)) return;
    const t = this.ctx!.currentTime;
    if (this.rec('riser', 0.55, Math.max(0.5, Math.min(2, 2.9 / Math.max(0.5, sec))))) return;
    this.tone(t, 'sawtooth', 110, 880, sec, 0.12, undefined, sec * 0.6);
    this.tone(t, 'sine', 220, 1760, sec, 0.1, undefined, sec * 0.6);
    this.noiseBurst(t, sec, 0.18, 'bandpass', 400, 2, 6000);
  }
  prompt(good: boolean): void {
    if (!this.ok('prompt', 0.04)) return;
    const t = this.ctx!.currentTime;
    if (this.rec(good ? 'qte_good' : 'qte_bad', good ? 0.5 : 0.45, good ? 1 + fxRng.next() * 0.08 : 1)) return;
    if (good) { this.tone(t, 'square', 880, 1320, 0.08, 0.12); this.tone(t + 0.05, 'square', 1320, 1760, 0.08, 0.1); }
    else this.tone(t, 'sawtooth', 220, 110, 0.15, 0.12);
  }

  boom(): void {
    if (!this.ok('boom', 0.08)) return;
    const t = this.ctx!.currentTime;
    if (this.rec('boom', 1.0, 0.9)) { this.rec('m_808', 0.4, 0.7, 0, 0.5); this.duck(0.35, 0.4); return; }
    this.tone(t, 'sine', 90, 22, 1.1, 1.0);
    this.tone(t, 'triangle', 180, 40, 0.5, 0.4);
    this.noiseBurst(t, 1.0, 0.9, 'lowpass', 2000, 0.7, 60);
    this.noiseBurst(t + 0.02, 0.4, 0.4, 'bandpass', 600, 0.6, 200);
  }

  parry(): void {
    if (!this.ok('parry', 0.05)) return;
    const t = this.ctx!.currentTime;
    if (this.rec('parry', 0.75, 1.05)) { this.rec(HIT_L, 0.35, 1.25); this.rec('m_glass', 0.25, 1.5, 0.01); return; }
    for (const f of [1760, 2637, 3520]) this.tone(t, 'sine', f, f * 0.98, 0.6, 0.18, undefined, 0.001);
    this.tone(t, 'square', 880, 880, 0.08, 0.1);
    this.noiseBurst(t, 0.18, 0.4, 'highpass', 4000, 0.7, 9000);
  }

  /** Weapon sounds (revision pass 7). */
  weapon(kind: 'hookFire' | 'hookHit' | 'reel' | 'zap' | 'beam' | 'grab' | 'throw' | 'overheat' | 'swap' | 'deflect' | 'thunder'): void {
    if (!this.ok('w' + kind, 0.04)) return;
    const t = this.ctx!.currentTime;
    const REC: Record<string, [string | string[], number, number]> = {
      hookFire: ['chain', 0.6, 1.1], hookHit: ['clank', 0.7, 1.0], reel: ['chain', 0.5, 1.35], zap: [['zap1', 'zap2'], 0.55, 1.0],
      beam: ['beam', 0.8, 0.9], grab: ['grab', 0.7, 1.0], throw: ['whoosh3', 0.7, 0.8], overheat: ['steam', 0.6, 1.0],
      swap: ['staff', 0.4, 1.3], deflect: ['ping', 0.6, 1.0], thunder: ['thunder', 0.9, 0.7],
    };
    const rc = REC[kind];
    if (rc && this.rec(rc[0], rc[1], rc[2])) { if (kind === 'thunder') this.rec('boom', 0.6, 0.7, 0.02); return; }
    switch (kind) {
      case 'hookFire': // snap + a rattling chain
        this.noiseBurst(t, 0.05, 0.4, 'highpass', 3000, 1, 8000);
        for (let i = 0; i < 4; i++) this.tone(t + 0.02 + i * 0.025, 'square', 2400 - i * 200, 1900 - i * 200, 0.02, 0.05);
        break;
      case 'hookHit': // metallic clank
        this.tone(t, 'triangle', 1320, 1240, 0.18, 0.22);
        this.tone(t, 'square', 1980, 1900, 0.06, 0.08);
        this.noiseBurst(t, 0.05, 0.3, 'bandpass', 3500, 2);
        break;
      case 'reel':
        for (let i = 0; i < 5; i++) this.tone(t + i * 0.03, 'square', 1500 + i * 120, 1500 + i * 120, 0.015, 0.04);
        break;
      case 'zap':
        this.tone(t, 'sawtooth', 1800, 420, 0.09, 0.16);
        this.noiseBurst(t, 0.06, 0.18, 'highpass', 2500, 1, 6000);
        break;
      case 'beam':
        this.tone(t, 'sawtooth', 220, 60, 0.6, 0.3);
        this.tone(t, 'square', 880, 180, 0.45, 0.1);
        this.noiseBurst(t, 0.6, 0.5, 'bandpass', 1200, 0.8, 300);
        break;
      case 'grab':
        this.noiseBurst(t, 0.07, 0.35, 'bandpass', 900, 1.2, 500);
        this.tone(t, 'sine', 180, 120, 0.08, 0.25);
        break;
      case 'throw':
        this.noiseBurst(t, 0.22, 0.3, 'bandpass', 500, 1.2, 2600);
        break;
      case 'overheat':
        this.noiseBurst(t, 0.7, 0.35, 'highpass', 3000, 0.7, 1200);
        this.tone(t, 'square', 600, 300, 0.25, 0.06);
        break;
      case 'swap':
        this.tone(t, 'triangle', 660, 990, 0.08, 0.15);
        this.noiseBurst(t, 0.05, 0.2, 'bandpass', 2000, 1.5);
        break;
      case 'deflect':
        this.tone(t, 'triangle', 1760, 1600, 0.12, 0.15);
        break;
      case 'thunder':
        this.noiseBurst(t, 0.9, 0.8, 'lowpass', 2400, 0.7, 80);
        this.tone(t, 'sawtooth', 90, 30, 0.6, 0.3);
        break;
    }
  }

  dodge(): void {
    if (!this.ok('dodge', 0.04)) return;
    const t = this.ctx!.currentTime;
    if (this.rec('dodge', 0.5, 1 + (fxRng.next() - 0.5) * 0.1)) return;
    this.noiseBurst(t, 0.16, 0.18, 'bandpass', 2400, 1.5, 700);
  }

  /** Soft footstep / landing scuff (keyframe sfx). */
  step(heavy = false): void {
    if (!this.ok('step', 0.06)) return;
    const t = this.ctx!.currentTime;
    if (heavy ? this.rec('land', 0.55, 0.95 + fxRng.next() * 0.1) : this.rec(['step1', 'step2'], 0.22, 0.9 + fxRng.next() * 0.2)) {
      if (heavy) this.rec(HIT_L, 0.18, 0.7);
      return;
    }
    this.noiseBurst(t, heavy ? 0.09 : 0.05, heavy ? 0.22 : 0.08, 'lowpass', heavy ? 700 : 1100, 0.7, 200);
    if (heavy) this.tone(t, 'sine', 120, 50, 0.08, 0.2);
  }

  hurt(): void {
    if (!this.ok('hurt', 0.06)) return;
    const t = this.ctx!.currentTime;
    if (this.rec(['hurt1', 'hurt2', 'hurt3'], 0.55, 0.96 + fxRng.next() * 0.08)) {
      this.rec(HIT_M, 0.5, 0.88);
      this.duck(0.6, 0.2);
      return;
    }
    this.tone(t, 'sawtooth', 220, 70, 0.22, 0.25);
    this.noiseBurst(t, 0.15, 0.5, 'lowpass', 1200, 0.8, 200);
  }

  block(): void {
    if (!this.ok('block', 0.03)) return;
    const t = this.ctx!.currentTime;
    if (this.rec('block', 0.8, 1.0)) return;
    this.tone(t, 'square', 620, 540, 0.09, 0.16);
    this.tone(t, 'triangle', 1240, 1100, 0.18, 0.14);
    this.noiseBurst(t, 0.06, 0.4, 'highpass', 3000, 0.7);
  }

  telegraph(): void {
    if (!this.ok('tele', 0.07)) return;
    const t = this.ctx!.currentTime;
    if (this.rec('tele', 0.32, 1.15)) return;
    this.tone(t, 'square', 1320, 1320, 0.05, 0.05);
    this.tone(t + 0.06, 'square', 1320, 1320, 0.05, 0.04);
  }

  throwDart(): void {
    if (!this.ok('throw', 0.05)) return;
    const t = this.ctx!.currentTime;
    if (this.rec('dart', 0.55, 1.05)) return;
    this.tone(t, 'sawtooth', 900, 300, 0.18, 0.12);
  }

  ko(): void {
    if (!this.ok('ko', 0.05)) return;
    const t = this.ctx!.currentTime;
    if (this.rec('impact', 0.85, 1)) {
      this.rec(HIT_H, 0.9, 0.78); this.rec('heavy', 0.35, 0.8); this.rec('m_808', 0.4, 0.7, 0, 0.5);
      this.duck(0.25, 0.6);
      return;
    }
    this.tone(t, 'sine', 160, 30, 0.6, 0.8);
    this.noiseBurst(t, 0.5, 0.6, 'lowpass', 2600, 0.8, 100);
    for (let i = 0; i < 4; i++) this.tone(t + i * 0.04, 'sine', 1200 + i * 400, 1500 + i * 400, 0.25, 0.06);
  }

  pickup(kind: 'health' | 'orb'): void {
    if (!this.ok('pick' + kind, 0.04)) return;
    const t = this.ctx!.currentTime;
    if (this.rec('pickup', 0.45, kind === 'orb' ? 1.25 : 0.95)) return;
    const base = kind === 'health' ? 660 : 990;
    this.tone(t, 'sine', base, base * 1.5, 0.12, 0.16);
    this.tone(t + 0.05, 'sine', base * 1.5, base * 2, 0.12, 0.12);
  }

  rankUp(rank: number): void {
    if (!this.ok('rank', 0.05)) return;
    const t = this.ctx!.currentTime;
    const notes = [523, 587, 659, 784, 880, 1046, 1318];
    const n = notes[Math.min(notes.length - 1, rank)];
    if (this.rec('rankup', 0.5, 0.9 + rank * 0.07)) { if (rank >= 4) this.rec('m_crash', 0.22, 1.1); return; }
    this.tone(t, 'square', n, n, 0.1, 0.08);
    this.tone(t + 0.07, 'square', n * 1.5, n * 1.5, 0.16, 0.08);
    this.tone(t, 'sine', n * 2, n * 2, 0.3, 0.1);
  }

  ui(kind: 'click' | 'select' | 'wave' | 'clear' | 'gameover' | 'move' | 'back'): void {
    if (!this.ok('ui' + kind, 0.03)) return;
    const t = this.ctx!.currentTime;
    const REC: Record<string, [string, number]> = {
      move: ['ui_move', 0.35], click: ['ui_click', 0.5], select: ['ui_ok', 0.5], back: ['ui_back', 0.45],
      wave: ['bell', 0.5], clear: ['clear', 0.55], gameover: ['gameover', 0.6],
    };
    if (this.rec(REC[kind][0], REC[kind][1])) return;
    if (kind === 'back') { this.tone(t, 'square', 990, 660, 0.05, 0.05); return; }
    // Arcade UI focus tick (keyboard / gamepad navigation): a short bright blip.
    if (kind === 'move') { this.tone(t, 'square', 1320, 1500, 0.035, 0.05); return; }
    switch (kind) {
      case 'click': this.paper('tap'); break;
      case 'select': this.tone(t, 'triangle', 660, 1320, 0.16, 0.18); this.tone(t + 0.08, 'sine', 1320, 1760, 0.2, 0.12); break;
      case 'wave': for (let i = 0; i < 3; i++) this.tone(t + i * 0.11, 'square', 440 * (1 + i * 0.25), 440 * (1 + i * 0.25), 0.1, 0.07); break;
      case 'clear': for (const [i, f] of [523, 659, 784, 1046].entries()) this.tone(t + i * 0.08, 'triangle', f, f, 0.4, 0.14); break;
      case 'gameover': for (const [i, f] of [392, 330, 262, 196].entries()) this.tone(t + i * 0.18, 'triangle', f, f * 0.98, 0.5, 0.16); break;
    }
  }

  /**
   * Paper UI sounds (revision pass 6), short and quiet: a marker tap, a pencil
   * scratch, a paper rustle, a page turn and a crumple. Filtered noise bursts
   * through the SFX bus, so the volume sliders apply.
   */
  paper(kind: 'tap' | 'scratch' | 'rustle' | 'page' | 'crumple'): void {
    if (!this.ok('paper' + kind, 0.04)) return;
    const t = this.ctx!.currentTime;
    if (this.rec(kind === 'tap' ? 'pencil' : kind, kind === 'tap' ? 0.5 : 0.45)) return;
    switch (kind) {
      case 'tap':
        this.noiseBurst(t, 0.03, 0.18, 'bandpass', 2400, 2.5, 1600);
        this.tone(t, 'triangle', 420, 300, 0.035, 0.05);
        break;
      case 'scratch':
        for (let i = 0; i < 3; i++) this.noiseBurst(t + i * 0.045, 0.04, 0.09, 'bandpass', 5200 + i * 600, 4, 3800);
        break;
      case 'rustle':
        this.noiseBurst(t, 0.16, 0.08, 'highpass', 2600, 0.8, 1400);
        this.noiseBurst(t + 0.05, 0.12, 0.06, 'bandpass', 3800, 1.2, 2200);
        break;
      case 'page':
        this.noiseBurst(t, 0.28, 0.12, 'bandpass', 1400, 0.9, 4200);
        this.noiseBurst(t + 0.18, 0.1, 0.09, 'highpass', 3000, 0.7, 1500);
        break;
      case 'crumple':
        for (let i = 0; i < 7; i++) this.noiseBurst(t + i * 0.06 + Math.random() * 0.03, 0.05, 0.12, 'bandpass', 1800 + Math.random() * 2500, 2, 900);
        break;
    }
  }

  private laserLoops: { src: AudioScheduledSourceNode; g: GainNode }[] = [];
  /**
   * Laser Special: an anime charge-up, then the fire blast and a deep humming beam (two seamless
   * loops: a pitched-down machine hum and a laser-beam loop, with a slow wobble) that runs for
   * `sec` or until laser('end').
   */
  laser(kind: 'charge' | 'fire' | 'end', sec = 2): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (kind === 'charge') { if (!this.rec('laser_charge', 0.6, 1.0)) this.riser(0.7); return; }
    if (kind === 'end') { this.stopLaser(0.3); this.rec('m_808', 0.45, 0.6, 0, 0.5); return; }
    this.stopLaser(0.03);
    if (!this.rec('laser_blast', 0.7, 0.9)) { this.tone(t, 'sawtooth', 55, 50, sec, 0.25); return; }
    this.rec('impact', 0.45, 1.1); this.rec('m_808', 0.6, 0.6, 0, 0.7);
    for (const [name, gain, rate] of [['laser_hum', 0.62, 0.78], ['laser_beam', 0.26, 0.85]] as [string, number, number][]) {
      if (!this.has(name)) continue;
      const src = ctx.createBufferSource();
      src.buffer = this.bufs[name]; src.loop = true; src.loopStart = 0.1; src.loopEnd = 0.95; src.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.08);
      g.gain.setValueAtTime(gain, t + sec); g.gain.exponentialRampToValueAtTime(0.0001, t + sec + 0.35);   // safety stop
      // slow 7 Hz wobble on the hum: the 'wub' of a big beam
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = 7; depth.gain.value = gain * 0.18; lfo.connect(depth); depth.connect(g.gain);
      src.connect(g); g.connect(this.sfx);
      src.start(t, 0.1); src.stop(t + sec + 0.4); lfo.start(t); lfo.stop(t + sec + 0.4);
      this.laserLoops.push({ src, g });
    }
    this.duck(0.35, sec);
  }
  private stopLaser(fade: number): void {
    const t = this.ctx!.currentTime;
    for (const { src, g } of this.laserLoops) {
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t); g.gain.exponentialRampToValueAtTime(0.0001, t + fade);
      try { src.stop(t + fade + 0.02); } catch { /* already stopped */ }
    }
    this.laserLoops.length = 0;
  }

  /** The Special Bar just filled: a charge-up sting. */
  ready(): void {
    if (!this.ok('ready', 0.3)) return;
    const t = this.ctx!.currentTime;
    if (this.rec('ready', 0.55)) { this.rec('m_glass', 0.2, 2, 0.18); return; }
    this.tone(t, 'triangle', 660, 1320, 0.16, 0.18); this.tone(t + 0.08, 'sine', 1320, 1760, 0.2, 0.12);
  }

  /** Metronome click on the music bus at context time t (Rhythm Mode calibration / count-in). */
  click(t: number, accent = false): void {
    if (!this.ctx) return;
    if (this.sample(accent ? 'metro_hi' : 'metro_lo', t, accent ? 0.8 : 0.6, 1, this.music)) return;
    this.tone(t, 'square', accent ? 1760 : 1320, accent ? 1760 : 1320, 0.04, accent ? 0.22 : 0.15, this.music, 0.001);
    this.noiseBurst(t, 0.02, 0.2, 'highpass', 6000, 0.7, 0, this.music);
  }

  // ---------------- Procedural music: a driving minor groove ----------------
  startMusic(): void { this.musicOn = true; if (this.ctx) this.musicNext = this.ctx.currentTime + 0.05; }
  stopMusic(): void { this.musicOn = false; }

  /** Call every frame; schedules ahead with a lookahead window. */
  updateMusic(): void {
    if (!this.ctx || !this.musicOn || this.ctx.state !== 'running') return;
    const bpm = 124;
    const step = 60 / bpm / 4;
    const ctx = this.ctx;
    if (this.musicNext < ctx.currentTime - 0.2) this.musicNext = ctx.currentTime + 0.05;
    while (this.musicNext < ctx.currentTime + 0.12) {
      this.scheduleStep(this.musicStep, this.musicNext);
      this.musicNext += step;
      this.musicStep = (this.musicStep + 1) % 64;
    }
    this.musicTimer++;
  }

  private scheduleStep(s: number, t: number): void {
    const m = this.music;
    const bar = Math.floor(s / 16) % 4;
    const st = s % 16;
    const roots = [55, 55, 43.65, 49];
    const root = roots[bar];
    const hype = this.intensity;
    if (this.has('m_kick')) {
      if (st % 4 === 0) this.sample('m_kick', t, 0.8, 1, this.inst);
      if (st === 4 || st === 12) { this.sample('m_clap', t, 0.45, 1, this.inst); this.sample('m_snare2', t, 0.3, 1, this.inst); }
      if (st % 2 === 1 || hype > 0.5) this.sample('m_hat', t, st % 2 === 1 ? 0.3 : 0.16, 1, this.inst);
      const pt = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
      if (pt[st]) this.note('m_bass', 69.1, t, root * (st === 13 ? 1.5 : st === 11 ? 1.189 : 1), 0.16, 0.55, this.inst);
      if (hype > 0.3 && st % 2 === 0) {
        const arp = [4, 3, 2, 1.5, 2, 3, 4, 6];
        this.note('m_pluck', 258.5, t, root * arp[(st / 2) % 8] * 2, 0.1, 0.12 + hype * 0.12, this.inst);
      }
      return;
    }
    // kick
    if (st % 4 === 0) {
      const o = this.ctx!.createOscillator(); const g = this.ctx!.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(m); o.start(t); o.stop(t + 0.2);
    }
    // snare/clap on 2 and 4
    if (st === 4 || st === 12) this.noiseBurst(t, 0.14, 0.35, 'bandpass', 1800, 0.8, 900, m);
    // hats
    if (st % 2 === 1 || hype > 0.5) this.noiseBurst(t, 0.03, st % 2 === 1 ? 0.12 : 0.06, 'highpass', 8000, 0.7, 0, m);
    // bass
    const pat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
    if (pat[st]) {
      const f = root * (st === 13 ? 1.5 : st === 11 ? 1.189 : 1);
      this.tone(t, 'sawtooth', f, f, 0.16, 0.16, m);
      this.tone(t, 'sine', f / 2, f / 2, 0.2, 0.25, m);
    }
    // arp when intense
    if (hype > 0.3 && st % 2 === 0) {
      const arp = [4, 3, 2, 1.5, 2, 3, 4, 6];
      const f = root * arp[(st / 2) % 8] * 2;
      this.tone(t, 'square', f, f, 0.07, 0.035 + hype * 0.03, m);
    }
  }
}

export const audio = new Audio();
if (import.meta.env.DEV) (window as unknown as { __audio: Audio }).__audio = audio;
