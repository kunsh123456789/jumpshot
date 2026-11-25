import { layout } from '../core/layout';
import { settings } from '../core/settings';
import { audio } from '../core/audio';
import { WORLD } from '../data/tuning';
import { SPECIAL } from '../data/special';
import type { Family } from '../data/cines';
import type { World } from '../sim/world';
import type { SpecialResult } from '../sim/special';
import type { Camera } from '../core/camera';
import type { DrawPad } from './pad';
import type { Keyboard } from '../core/keyboard';
import type { RhythmDirector } from '../rhythm/director';
import { getUiScale } from './arcadeHud';
import { specialScript, familyOf } from '../data/cines';
import { WEAPONS, availableWeapons } from '../data/weapons';
import { ICON } from './icons';

/**
 * The Special's input (revision pass 9), run in REAL time on the UI side while
 * the sim keeps stepping with the world frozen (so Rhythm Mode's beat clock
 * never drifts):
 *
 *  1. PICK: choose whose Special to use: any available weapon, not just the
 *     equipped one. One tap on a tile (or arrows + Enter / X, or the gamepad
 *     d-pad + A) picks it; the equipped weapon is highlighted and is used if
 *     nothing is chosen within SPECIAL.pickSec.
 *  2. TRACE: that Special's guide path over the screen. Drag it in one stroke
 *     before the fuse burns down; the grade (coverage, accuracy, speed) alone
 *     sets SLOPPY / CLEAN / PERFECT. The Hook's path is connect-the-dots through
 *     the real enemies; the Throw ends with a free flick that aims the hurl.
 *     Keyboard: press the shown arrows in order.
 *
 * The trace can't fail outright: the result only picks the tier. Assist
 * (Settings) widens the band and lengthens the fuse.
 * UI: drawn on the canvas in the Arcade style (draw()), sized by the shared --u scale.
 */
type Phase = 'off' | 'pick' | 'trace' | 'result';

const DIR_KEY: Record<string, number> = { right: 0, up: 2, left: 4, down: 6 };
const DIR_GLYPH = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];

export class SpecialInput {
  phase: Phase = 'off';
  private fam: Family = 'fists';
  private w: World | null = null;
  // ---- trace ----
  private path: Float32Array = new Float32Array(0);
  private cum: Float32Array = new Float32Array(0);
  private total = 1;
  private prog = 0;
  private tol = 40;
  private dist = 0; private distN = 0;
  private limit = 2;
  private elapsed = 0;
  private stroke = false; private strokeDone = false;
  private trail: number[] = [];
  private keys: number[] = [];
  private keyIdx = 0; private keyMiss = 0;
  private dots: { id: number; x: number; y: number; hit: boolean }[] = [];
  private aim = 0;
  private flickPts: number[] = [];
  private facing = 1;
  private traceScore = 0; private cov = 0; private acc = 0; private spd = 0;
  // ---- pick ----
  /** The weapon whose Special is being used (chosen in the pick phase). */
  weaponId = 'fists';
  private pickIds: string[] = [];
  private pickSel = 0;
  private pickT = 0;
  private pickCols = 9;
  private pickRects: { x: number; y: number; s: number }[] = [];
  private gpPrev = { l: false, r: false, u: false, d: false, a: false };
  private resultT = 0;
  private resultTier = '';
  private debug: string[] = [];

  constructor(private pad: DrawPad, private keyboard: Keyboard, private cam: Camera, private rhythm: RhythmDirector) {}

  get active(): boolean { return this.phase !== 'off'; }

  /** World point -> CSS pixel (ignores camera roll). */
  private toScreen(x: number, y: number): [number, number] {
    const s = layout.scale, r = layout.world, z = this.cam.effectiveZoom();
    return [r.x + s * (WORLD.viewW / 2 + this.cam.ox + z * (x - this.cam.x) - layout.viewX0), r.y + s * (this.cam.groundScreen + this.cam.oy + z * (y - this.cam.y) - layout.viewY0)];
  }

  /** Open the Special input: first the weapon pick, then the trace. */
  begin(w: World): void {
    this.w = w;
    this.pickIds = availableWeapons().slice();
    if (!this.pickIds.includes(w.weapon.id)) this.pickIds.unshift(w.weapon.id);
    this.pickSel = Math.max(0, this.pickIds.indexOf(w.weapon.id));
    this.weaponId = w.weapon.id;
    this.pickT = SPECIAL.pickSec;
    this.phase = 'pick';
    this.debug = [];
    this.pad.rawSink = (ph, x, y, t) => this.onPointer(ph, x, y, t);
    this.keyboard.specialSink = (k, down) => this.onKey(k, down);
  }

  private choose(i: number): void {
    if (this.phase !== 'pick') return;
    this.pickSel = i;
    this.weaponId = this.pickIds[i];
    audio.ui('select');
    this.startTrace(familyOf(this.weaponId));
  }

  private startTrace(fam: Family): void {
    const w = this.w!;
    this.fam = fam;
    this.facing = w.player.facing || 1;
    this.phase = 'trace';
    this.elapsed = 0; this.prog = 0; this.dist = 0; this.distN = 0;
    this.stroke = false; this.strokeDone = false; this.trail = []; this.flickPts = [];
    this.keyIdx = 0; this.keyMiss = 0;
    this.aim = this.facing > 0 ? 0.04 : Math.PI - 0.04;
    const assist = settings.specialAssist;
    this.tol = SPECIAL.tolerance * Math.min(innerWidth, innerHeight) * (assist ? SPECIAL.toleranceAssist : 1);
    let lim = assist ? SPECIAL.traceSecAssist : SPECIAL.traceSec;
    // Rhythm Mode: the trace lasts a whole number of beats.
    const spb = this.spb();
    if (spb > 0) lim = Math.max(2, Math.round(lim / spb)) * spb;
    this.limit = lim;
    this.buildPath();
    audio.riser(lim);
  }

  private spb(): number {
    const w = this.w;
    if (!w || !w.rhythm || !this.rhythm.clock.ready) return 0;
    const now = this.rhythm.heardAt(performance.now());
    const b = this.rhythm.clock.beatAt(now);
    return Math.max(0.2, this.rhythm.clock.timeOfBeat(Math.floor(b) + 1) - this.rhythm.clock.timeOfBeat(Math.floor(b)));
  }

  // ------------------------------------------------------------------ path
  private buildPath(): void {
    const pr = layout.pad;
    const W = innerWidth, H = innerHeight;
    const bx = Math.max(20, pr.x + pr.w * 0.12), bw = Math.min(W - 40, pr.w * 0.76);
    const by = pr.y + pr.h * 0.12, bh = pr.h * 0.72;
    const m = Math.min(bw, bh);
    const cx = bx + bw / 2, cy = by + bh / 2;
    const pts: number[] = [];
    const f = this.facing;
    const X = (u: number) => (f > 0 ? bx + u * bw : bx + (1 - u) * bw);
    const push = (x: number, y: number) => pts.push(x, y);
    this.dots = [];
    switch (this.fam) {
      case 'fists': {
        // rising line that curls into a loop (up, over, down)
        for (let i = 0; i <= 12; i++) { const t = i / 12; push(X(0.12 + t * 0.36), by + bh * (0.95 - t * 0.75)); }
        const lx = X(0.62), ly = by + bh * 0.36, r = m * 0.3;
        const a0 = f > 0 ? Math.PI : 0;
        for (let i = 1; i <= 30; i++) { const a = a0 + f * (i / 30) * Math.PI * 1.75; push(lx + Math.cos(a) * r * 1.1, ly - Math.sin(a) * r * -1 * -1 + 0); }
        const ex = pts[pts.length - 2], ey = pts[pts.length - 1];
        for (let i = 1; i <= 8; i++) push(ex + f * i * 6, ey + i * (by + bh - ey) / 8);
        break;
      }
      case 'staff': {
        // spiral outward, two turns
        const n = 64;
        for (let i = 0; i <= n; i++) { const t = i / n, a = f * t * Math.PI * 4, r = m * (0.06 + t * 0.44); push(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r); }
        break;
      }
      case 'laser': {
        // long horizontal sweep arc
        for (let i = 0; i <= 40; i++) { const t = i / 40; push(X(0.04 + t * 0.92), by + bh * (0.8 - Math.sin(t * Math.PI) * 0.55)); }
        break;
      }
      case 'throw': {
        // one full circle (then a free flick aims the hurl)
        const r = m * 0.42;
        for (let i = 0; i <= 48; i++) { const a = Math.PI / 2 - f * (i / 48) * Math.PI * 2; push(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r); }
        break;
      }
      case 'hook': {
        // connect-the-dots through the real enemies (screen positions), starting at the hero
        const w = this.w!;
        const p = w.player;
        const [hx, hy] = this.toScreen(p.x, p.cy);
        push(clampN(hx, 30, W - 30), clampN(hy, 40, H - 30));
        const es = w.enemies.filter((e) => e.alive && e.state !== 'ko' && e.kind !== 'dummy')
          .map((e) => { const [sx, sy] = this.toScreen(e.x, e.cy); return { id: e.id, x: clampN(sx, 30, W - 30), y: clampN(sy, 40, H - 30), d: Math.abs(e.x - p.x) }; })
          .sort((a, b) => a.d - b.d).slice(0, 8);
        // order: sweep outward on the facing side first, then the other side
        es.sort((a, b) => { const sa = Math.sign(a.x - hx) === f ? 0 : 1, sb = Math.sign(b.x - hx) === f ? 0 : 1; return sa - sb || (sa === 0 ? Math.abs(a.x - hx) - Math.abs(b.x - hx) : Math.abs(b.x - hx) - Math.abs(a.x - hx)); });
        for (const e of es) { this.dots.push({ id: e.id, x: e.x, y: e.y, hit: false }); push(e.x, e.y); }
        if (es.length === 0) push(clampN(hx + f * 220, 30, W - 30), hy);
        break;
      }
    }
    // densify to ~8px steps
    const dense: number[] = [];
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const x1 = pts[i], y1 = pts[i + 1], x2 = pts[i + 2], y2 = pts[i + 3];
      const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 8));
      for (let k = 0; k < n; k++) dense.push(x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n);
    }
    dense.push(pts[pts.length - 2], pts[pts.length - 1]);
    this.path = new Float32Array(dense);
    const n = dense.length / 2;
    this.cum = new Float32Array(n);
    for (let i = 1; i < n; i++) this.cum[i] = this.cum[i - 1] + Math.hypot(dense[i * 2] - dense[i * 2 - 2], dense[i * 2 + 1] - dense[i * 2 - 1]);
    this.total = Math.max(1, this.cum[n - 1]);
    // keyboard: the path as a sequence of 4-way arrows (one per ~1/7 of its length, repeats collapsed)
    this.keys = [];
    const K = this.fam === 'hook' ? Math.max(1, this.dots.length) : 7;
    if (this.fam === 'hook') {
      let px0 = this.path[0], py0 = this.path[1];
      for (const d of this.dots) { this.keys.push(dir4(d.x - px0, d.y - py0)); px0 = d.x; py0 = d.y; }
    } else {
      for (let k = 0; k < K; k++) {
        const i0 = this.idxAt((k / K) * this.total), i1 = this.idxAt(((k + 1) / K) * this.total);
        const d = dir4(this.path[i1 * 2] - this.path[i0 * 2], this.path[i1 * 2 + 1] - this.path[i0 * 2 + 1]);
        if (this.keys[this.keys.length - 1] !== d) this.keys.push(d);
      }
    }
  }
  private idxAt(s: number): number { let i = 0; while (i < this.cum.length - 1 && this.cum[i] < s) i++; return i; }

  // ------------------------------------------------------------------ input
  private onPointer(ph: 'down' | 'move' | 'up', x: number, y: number, t: number): void {
    if (this.phase === 'pick') {
      if (ph !== 'down') return;
      const i = this.pickRects.findIndex((r) => x >= r.x && x <= r.x + r.s && y >= r.y && y <= r.y + r.s);
      if (i >= 0) this.choose(i);
      return;
    }
    if (this.phase === 'trace') {
      if (ph === 'down') {
        if (this.strokeDone) return;
        this.stroke = true; this.trail = [x, y];
      } else if (ph === 'move' && this.stroke) {
        this.sampleTrace(x, y, t);
      } else if (ph === 'up' && this.stroke) {
        this.stroke = false; this.strokeDone = true;
        this.finishTrace();
      }
    }
  }

  private onKey(k: 'up' | 'down' | 'left' | 'right' | 'tap', down: boolean): void {
    if (!down) return;
    if (this.phase === 'pick') {
      if (k === 'tap') { this.choose(this.pickSel); return; }
      this.movePick(k === 'left' ? -1 : k === 'right' ? 1 : k === 'up' ? -this.pickCols : this.pickCols);
      return;
    }
    if (this.phase === 'trace') {
      if (k === 'tap') return;
      const d = DIR_KEY[k];
      if (this.keys[this.keyIdx] === d) {
        this.keyIdx++;
        this.prog = (this.keyIdx / this.keys.length) * this.total;
        if (this.fam === 'hook' && this.dots[this.keyIdx - 1]) this.dots[this.keyIdx - 1].hit = true;
        if (this.fam === 'throw' || this.fam === 'laser') this.aim = Math.atan2(d === 2 ? -1 : d === 6 ? 1 : 0, d === 0 ? 1 : d === 4 ? -1 : 0);
        if (this.keyIdx >= this.keys.length) this.finishTrace();
      } else this.keyMiss++;
    }
  }

  private movePick(d: number): void {
    const n = this.pickIds.length;
    const i = this.pickSel + d;
    this.pickSel = Math.abs(d) === 1 ? (i + n) % n : Math.max(0, Math.min(n - 1, i));
    this.pickT = Math.max(this.pickT, 1.5);   // browsing keeps the picker open a moment longer
    audio.ui('move');
  }

  /** Gamepad in the picker: d-pad / stick moves, A picks (polled; edges only). */
  private pollPadPick(): void {
    const gp = typeof navigator.getGamepads === 'function' ? [...navigator.getGamepads()].find((g) => g && g.connected) : null;
    if (!gp) return;
    const b = (i: number) => !!gp.buttons[i]?.pressed;
    const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
    const now = { l: b(14) || ax < -0.5, r: b(15) || ax > 0.5, u: b(12) || ay < -0.5, d: b(13) || ay > 0.5, a: b(0) };
    const p = this.gpPrev;
    if (now.l && !p.l) this.movePick(-1);
    if (now.r && !p.r) this.movePick(1);
    if (now.u && !p.u) this.movePick(-this.pickCols);
    if (now.d && !p.d) this.movePick(this.pickCols);
    this.gpPrev = now;
    if (now.a && !p.a) this.choose(this.pickSel);
  }

  private sampleTrace(x: number, y: number, t: number): void {
    this.trail.push(x, y);
    if (this.trail.length > 400) this.trail.splice(0, 2);
    this.flickPts.push(x, y, t);
    while (this.flickPts.length > 3 && t - this.flickPts[2] > 90) this.flickPts.splice(0, 3);
    // nearest path point in a window ahead of the progress (so the path can cross itself)
    const lo = this.idxAt(Math.max(0, this.prog - this.total * 0.05)), hi = this.idxAt(Math.min(this.total, this.prog + this.total * 0.22));
    let best = -1, bd = Infinity;
    for (let i = lo; i <= hi; i++) { const d = Math.hypot(this.path[i * 2] - x, this.path[i * 2 + 1] - y); if (d < bd) { bd = d; best = i; } }
    if (best >= 0 && bd < this.tol * 1.7) {
      this.prog = Math.max(this.prog, this.cum[best]);
      this.dist += bd; this.distN++;
    } else { this.dist += Math.min(bd, this.tol * 3); this.distN++; }
    for (const d of this.dots) if (!d.hit && Math.hypot(d.x - x, d.y - y) < this.tol * 1.2) d.hit = true;
  }

  private finishTrace(): void {
    if (this.phase !== 'trace') return;
    const keyboard = this.keyIdx > 0;
    this.cov = Math.min(1, this.prog / this.total);
    if (keyboard) this.acc = Math.max(0, 1 - this.keyMiss * 0.15);
    else this.acc = this.distN ? Math.max(0, Math.min(1, 1 - (this.dist / this.distN - this.tol * 0.35) / this.tol)) : 0;
    this.spd = this.cov > 0.95 ? Math.max(0, 1 - this.elapsed / this.limit) : 0;
    this.traceScore = this.cov * SPECIAL.wCoverage + this.acc * SPECIAL.wAccuracy + this.spd * SPECIAL.wSpeed;
    // the hurl / sweep aim: the last flick of the stroke (throw), or the trace's own direction (laser)
    if (this.fam === 'throw' && this.flickPts.length >= 6 && !keyboard) {
      const n = this.flickPts.length;
      const dx = this.flickPts[n - 3] - this.flickPts[0], dy = this.flickPts[n - 2] - this.flickPts[1];
      if (Math.hypot(dx, dy) > 20) this.aim = Math.atan2(dy * 0.3, dx);
    }
    this.debug = [`TRACE ${this.fam}: score ${this.traceScore.toFixed(2)} coverage ${this.cov.toFixed(2)} accuracy ${this.acc.toFixed(2)} speed ${this.spd.toFixed(2)} ${keyboard ? '(keys)' : ''}${this.fam === 'hook' ? ' dots ' + this.dots.filter((d) => d.hit).length + '/' + this.dots.length : ''}`];
    this.submit();
  }

  // ------------------------------------------------------------------ frame
  update(dt: number, paused: boolean): void {
    if (this.phase === 'off') return;
    const w = this.w;
    if (!w || (w.special.phase !== 'input' && this.phase !== 'result')) { this.close(); return; }
    if (paused) return;
    if (this.phase === 'pick') {
      this.pollPadPick();
      this.pickT -= dt;
      if (this.pickT <= 0) this.choose(this.pickSel);
    } else if (this.phase === 'trace') {
      this.elapsed += dt;
      if (this.elapsed >= this.limit) { this.stroke = false; this.finishTrace(); }
    } else if (this.phase === 'result') {
      this.resultT -= dt;
      if (this.resultT <= 0) this.close();
    }
  }

  private submit(): void {
    const w = this.w!;
    const res: SpecialResult = {
      trace: this.traceScore, coverage: this.cov, accuracy: this.acc, speed: this.spd,
      // no QTE any more: the trace alone grades it. qteHits only scales the cinematic's length (0-3).
      qteHits: Math.round(this.traceScore * 3), qteCount: 0, perfects: 0,
      aim: this.aim, dots: this.dots.filter((d) => d.hit).map((d) => d.id),
      judgments: [], weapon: this.weaponId,
    };
    w.special.submit(res);
    const tier = res.trace >= SPECIAL.tierPerfect ? 2 : res.trace >= SPECIAL.tierClean ? 1 : 0;
    this.resultTier = SPECIAL.tierNames[tier];
    this.debug.push(`${this.weaponId} -> ${this.resultTier}`);
    this.phase = 'result';
    this.resultT = 0.9;
    this.release();
  }

  private release(): void {
    this.pad.rawSink = null;
    this.keyboard.specialSink = null;
  }
  close(): void { this.release(); this.phase = 'off'; }

  debugLines(): string[] { return this.debug.length ? ['SPECIAL ' + this.debug.join(' | ')] : []; }

  // ------------------------------------------------------------------ drawing (CSS px): the Arcade Fighter overlay
  /**
   * Special mode look: the screen dims to navy with radial speed lines; the guide path is a
   * glowing cyan tube with chevrons, the traced part fills magenta, the fuse is a gold timer
   * ring under the Special's name banner; tier words slam in as a banner. The pick phase is a
   * grid of weapon tiles (drawPick).
   */
  draw(ctx: CanvasRenderingContext2D, now: number): void {
    if (this.phase === 'off') return;
    const W = innerWidth, H = innerHeight;
    const u = getUiScale();
    const cyan = '#2ee6ff', magenta = '#ff2e88', gold = '#ffd23f';
    ctx.save();
    // dim + speed lines
    const g = ctx.createRadialGradient(W / 2, H * 0.58, Math.min(W, H) * 0.12, W / 2, H * 0.58, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'rgba(11,16,38,0.42)'); g.addColorStop(1, 'rgba(11,16,38,0.86)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(46,230,255,0.10)'; ctx.lineWidth = 2;
    ctx.beginPath();
    const rot = (now / 1000) * 0.15, R = Math.hypot(W, H);
    for (let i = 0; i < 48; i++) { const a = rot + (i / 48) * Math.PI * 2; ctx.moveTo(W / 2 + Math.cos(a) * R * 0.18, H * 0.58 + Math.sin(a) * R * 0.18); ctx.lineTo(W / 2 + Math.cos(a) * R, H * 0.58 + Math.sin(a) * R); }
    ctx.stroke();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (this.phase === 'pick') { this.drawPick(ctx, now, u); ctx.restore(); return; }
    this.banner(ctx, specialScript(this.weaponId).name, W / 2, Math.max(54 * u, H * 0.14), 30 * u, magenta);
    if (this.phase === 'trace') {
      const P = this.path, n = P.length / 2;
      const line = (upto: number) => { ctx.beginPath(); for (let i = 0; i <= upto; i++) i ? ctx.lineTo(P[i * 2], P[i * 2 + 1]) : ctx.moveTo(P[0], P[1]); };
      // tube + dotted guide
      ctx.strokeStyle = 'rgba(46,230,255,0.22)'; ctx.lineWidth = 24 * u; line(n - 1); ctx.stroke();
      ctx.shadowColor = cyan; ctx.shadowBlur = 10 * u;
      ctx.setLineDash([2 * u, 13 * u]); ctx.strokeStyle = cyan; ctx.lineWidth = 5 * u; line(n - 1); ctx.stroke(); ctx.setLineDash([]);
      // traced fill
      const end = this.idxAt(this.prog);
      if (end > 0) { ctx.shadowColor = magenta; ctx.shadowBlur = 14 * u; ctx.strokeStyle = magenta; ctx.lineWidth = 13 * u; line(end); ctx.stroke(); }
      ctx.shadowBlur = 0;
      // chevrons
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4 * u;
      const step = 130 * u;
      for (let s0 = step * 0.6; s0 < this.total - 10; s0 += step) {
        const i = this.idxAt(s0), j = Math.min(n - 1, i + 2);
        const ang = Math.atan2(P[j * 2 + 1] - P[i * 2 + 1], P[j * 2] - P[i * 2]);
        ctx.save(); ctx.translate(P[i * 2], P[i * 2 + 1]); ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(-9 * u, -9 * u); ctx.lineTo(0, 0); ctx.lineTo(-9 * u, 9 * u); ctx.stroke();
        ctx.restore();
      }
      // start orb + end ring
      const pulse = 1 + Math.sin(now / 110) * 0.14;
      ctx.shadowColor = magenta; ctx.shadowBlur = 16 * u;
      ctx.fillStyle = magenta; ctx.beginPath(); ctx.arc(P[0], P[1], 14 * u * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * u; ctx.stroke();
      ctx.strokeStyle = cyan; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(P[(n - 1) * 2], P[(n - 1) * 2 + 1], 12 * u, 0, Math.PI * 2); ctx.stroke();
      // hook dots: hollow cyan targets that fill magenta when connected
      for (const d of this.dots) {
        ctx.shadowColor = d.hit ? magenta : cyan; ctx.shadowBlur = 12 * u;
        ctx.fillStyle = d.hit ? magenta : 'rgba(11,16,38,0.85)';
        ctx.beginPath(); ctx.arc(d.x, d.y, 15 * u * (d.hit ? 1.15 : pulse), 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = d.hit ? '#fff' : cyan; ctx.lineWidth = 3 * u; ctx.stroke();
      }
      // the finger's stroke
      if (this.trail.length > 3) {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3 * u;
        ctx.beginPath(); ctx.moveTo(this.trail[0], this.trail[1]); for (let i = 2; i < this.trail.length; i += 2) ctx.lineTo(this.trail[i], this.trail[i + 1]); ctx.stroke();
      }
      // fuse: gold timer ring with the seconds left
      const fx = W / 2, fy = Math.max(54 * u, H * 0.14) + 62 * u, FR = 28 * u;
      const left = Math.max(0, 1 - this.elapsed / this.limit);
      ctx.lineWidth = 8 * u;
      ctx.strokeStyle = '#3a4566'; ctx.beginPath(); ctx.arc(fx, fy, FR, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(11,16,38,0.85)'; ctx.fill();
      ctx.strokeStyle = left < 0.3 ? '#ff3b3b' : gold; ctx.beginPath(); ctx.arc(fx, fy, FR, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2); ctx.stroke();
      this.text(ctx, (this.limit - this.elapsed).toFixed(1), fx, fy + 1, 18 * u, '#fff', 'Russo One');
      const hint = this.fam === 'hook' ? 'CONNECT THE DOTS!' : this.fam === 'throw' ? 'TRACE THE CIRCLE, THEN FLICK!' : 'TRACE THE PATH!';
      this.text(ctx, hint, fx, fy + FR + 24 * u, 18 * u, '#fff', 'Oswald', true);
      const kb = this.keys.map((d, i) => (i < this.keyIdx ? '·' : DIR_GLYPH[d])).join(' ');
      this.text(ctx, 'KEYS  ' + kb, fx, fy + FR + 48 * u, 13 * u, cyan, 'Oswald', true);
    } else if (this.phase === 'result') {
      const t = this.resultTier;
      const k = 1 + Math.max(0, this.resultT - 0.7) * 2;
      this.banner(ctx, t + '!', W / 2, H * 0.42, 44 * u * k, t === 'PERFECT' ? magenta : t === 'CLEAN' ? '#2a6bff' : '#3a4566');
    }
    ctx.restore();
  }

  /** The weapon picker: a panel with a balanced grid of tiles (equipped one marked), the highlighted Special's name and an auto-pick timer. */
  private drawPick(ctx: CanvasRenderingContext2D, now: number, u: number): void {
    const W = innerWidth, H = innerHeight;
    const cyan = '#2ee6ff', magenta = '#ff2e88', gold = '#ffd23f';
    const n = this.pickIds.length;
    const s = Math.max(44, Math.min(70 * u, (W - 60) / 9 - 10));
    const gap = Math.max(8, s * 0.16);
    const maxCols = Math.max(1, Math.floor((W - 48 + gap) / (s + gap)));
    const rows = Math.ceil(n / maxCols), cols = Math.ceil(n / rows);     // balanced rows (17 -> 9 + 8)
    this.pickCols = cols;
    const gridW = cols * s + (cols - 1) * gap, gridH = rows * s + (rows - 1) * gap;
    const titleH = 44 * u, infoH = 118 * u, padX = 20 * u, padY = 16 * u;
    const panelW = Math.min(W - 16, gridW + padX * 2), panelH = titleH + gridH + infoH + padY * 2;
    const top = Math.max(layout.safe.top + 92 * u, (H - panelH) / 2);
    // panel
    ctx.save(); ctx.translate(W / 2, top + panelH / 2); ctx.transform(1, 0, -0.08, 1, 0, 0);
    ctx.fillStyle = 'rgba(11,16,38,0.93)'; ctx.fillRect(-panelW / 2, -panelH / 2, panelW, panelH);
    ctx.strokeStyle = cyan; ctx.lineWidth = 2; ctx.strokeRect(-panelW / 2, -panelH / 2, panelW, panelH);
    ctx.restore();
    this.banner(ctx, 'CHOOSE YOUR SPECIAL', W / 2, top, 24 * u, magenta);
    const y0 = top + titleH + padY * 0.5;
    this.pickRects = [];
    const equipped = this.w?.weapon.id;
    for (let i = 0; i < n; i++) {
      const id = this.pickIds[i], r = Math.floor(i / cols), c = i % cols;
      const inRow = Math.min(cols, n - r * cols);
      const rowX = (W - (inRow * s + (inRow - 1) * gap)) / 2;            // centre every row, the last one too
      const x = rowX + c * (s + gap), y = y0 + r * (s + gap), on = i === this.pickSel;
      this.pickRects.push({ x, y, s });
      ctx.save(); ctx.translate(x + s / 2, y + s / 2);
      if (on) { const k = 1.08 + Math.sin(now / 140) * 0.03; ctx.scale(k, k); }
      ctx.transform(1, 0, -0.18, 1, 0, 0);
      ctx.shadowColor = on ? gold : 'transparent'; ctx.shadowBlur = on ? 18 * u : 0;
      ctx.fillStyle = on ? '#2a2410' : '#172042'; ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = on ? gold : id === equipped ? cyan : '#3a4566'; ctx.lineWidth = on ? 4 : 2; ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.save(); ctx.translate(x + s * 0.18, y + s * 0.16); ctx.scale((s * 0.64) / 24, (s * 0.64) / 24);
      ctx.strokeStyle = on ? gold : '#e8eefc'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.stroke(new Path2D(ICON[id] ?? ICON.star)); ctx.restore();
      if (id === equipped) this.text(ctx, 'E', x + s - 9, y + 10, 11, cyan, 'Oswald');
    }
    const id = this.pickIds[this.pickSel];
    const ny = y0 + gridH + 34 * u;
    this.text(ctx, specialScript(id).name, W / 2, ny, Math.max(18, 30 * u), '#fff', 'Russo One');
    this.text(ctx, (WEAPONS[id as keyof typeof WEAPONS]?.name ?? id).toUpperCase() + (id === equipped ? ' · EQUIPPED' : ''), W / 2, ny + 30 * u, Math.max(11, 15 * u), cyan, 'Oswald');
    const k = Math.max(0, Math.min(1, this.pickT / SPECIAL.pickSec)), bw = Math.min(panelW * 0.7, 320 * u);
    ctx.fillStyle = '#3a4566'; ctx.fillRect(W / 2 - bw / 2, ny + 50 * u, bw, 6 * u);
    ctx.fillStyle = k < 0.3 ? '#ff3b3b' : gold; ctx.fillRect(W / 2 - bw / 2, ny + 50 * u, bw * k, 6 * u);
    this.text(ctx, 'TAP A SPECIAL  ·  ← → + ENTER  ·  PAD: D-PAD + A', W / 2, ny + 72 * u, Math.max(10, 13 * u), '#c9d3f0', 'Oswald');
  }

  /** A skewed magenta band with italic display lettering (the Arcade banner). */
  private banner(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, col: string): void {
    ctx.save();
    ctx.font = `italic ${Math.round(size)}px "Russo One", sans-serif`;
    const tw = ctx.measureText(s).width;
    const bw = tw + size * 2.4, bh = size * 1.5;
    ctx.translate(x, y); ctx.transform(1, 0, -0.25, 1, 0, 0);
    const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.15, col); g.addColorStop(0.85, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.restore(); ctx.save();
    ctx.font = `italic ${Math.round(size)}px "Russo One", sans-serif`;
    ctx.translate(x, y);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0b1026'; ctx.fillText(s, size * 0.08, size * 0.08 + 1);
    ctx.fillStyle = '#fff'; ctx.fillText(s, 0, 1);
    ctx.restore();
  }
  private text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, col: string, font: 'Russo One' | 'Oswald', plate = false): void {
    ctx.font = font === 'Russo One' ? `italic ${Math.round(size)}px "Russo One", sans-serif` : `700 ${Math.round(size)}px "Oswald", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (plate) {
      const tw = ctx.measureText(s).width + size * 1.2;
      ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, -0.25, 1, 0, 0);
      ctx.fillStyle = 'rgba(11,16,38,0.85)'; ctx.fillRect(-tw / 2, -size * 0.75, tw, size * 1.5); ctx.restore();
    } else { ctx.lineWidth = Math.max(3, size * 0.14); ctx.strokeStyle = '#0b1026'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = col; ctx.fillText(s, x, y);
  }
}

function clampN(v: number, a: number, b: number): number { return Math.max(a, Math.min(b, v)); }
function dir4(dx: number, dy: number): number { return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 0 : 4) : dy < 0 ? 2 : 6; }
