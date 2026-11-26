import { MOVE, PAD } from '../data/tuning';
import { layout } from '../core/layout';
import { settings } from '../core/settings';
import { angleDiff, clamp } from '../core/math';
import { getUiScale } from './arcadeHud';


export type SwipeKind = 'swipe' | 'tap' | 'promote' | 'jump' | 'hold';
export interface SwipeEvent {
  kind: SwipeKind;
  /** 0=E,1=NE,2=N,3=NW,4=W,5=SW,6=S,7=SE */
  dir: number;
  heavy: boolean;
  len: number;
  speed: number;
  /** Segment id; a 'promote' (light flick turning heavy) refers to the swipe with the same id. */
  segId: number;
  time: number;
  source: 'pad' | 'key';
}
export type PadMode = 'idle' | 'moving' | 'attacking';

const TRAIL_CAP = 160;
const SAMPLE_N = 24;
const DIR_ARROWS = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];

/** Color index for trail points. */
export const TRAIL_COLORS = ['#ffffff', '#9ff0ff', '#ff9a3a', '#ffe14a', '#ff4dd2'];

export function classifyDir(dx: number, dy: number): number {
  let deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  const half = PAD.sectorHalfDeg;
  for (let c = 0; c < 4; c++) {
    let d = Math.abs(deg - c * 90);
    if (d > 180) d = 360 - d;
    if (d <= half + PAD.cardinalBiasDeg) return c * 2;
  }
  return ((Math.round(deg / 45) % 8) + 8) % 8;
}

/**
 * The draw pad: the full-width bottom band of the screen.
 * One touch can do everything without lifting:
 *  - slow drag  -> floating-stick movement (anchor = touch start, re-anchored after flicks)
 *  - quick flick (speed + length over the last ~75 ms) -> directional attack,
 *    promoted to heavy for long fast strokes and zig-zag chaining
 *  - tap -> dodge / parry
 */
export class DrawPad {
  readonly events: SwipeEvent[] = [];
  lastDir = -1; lastLen = 0; lastSpeed = 0; lastKind: SwipeKind | '' = '';
  enabled = true;

  // ---- live state read by the sim / debug overlay ----
  /** Horizontal movement axis in [-1, 1]. */
  moveX = 0;
  mode: PadMode = 'idle';
  /** Recent stroke speed (px/s) used for flick detection. */
  recentSpeed = 0;
  stickDX = 0; stickDY = 0;

  private pointerId = -1;
  /** A finger is on the pad (the staff's momentum spin keeps going while it stays down). */
  get touching(): boolean { return this.pointerId !== -1 && !this.rawSink; }
  private segId = 0;
  private startT = 0;
  private travel = 0;
  private lastX = 0; private lastY = 0;
  private anyCommit = false;
  // movement stick
  private anchorX = 0; private anchorY = 0;
  private suppressUntil = 0;
  // flick state
  private armed = true;
  private armT = 0;
  private commitT = -1e9;
  private commitAng = 0;
  private chainX = 0; private chainY = 0;
  private segOX = 0; private segOY = 0; private segT = 0;
  private promoted = true;
  private curSegId = 0;
  private curDir = 0;
  // samples
  private sx = new Float64Array(SAMPLE_N); private sy = new Float64Array(SAMPLE_N); private st = new Float64Array(SAMPLE_N);
  private sHead = 0; private sCount = 0;

  // trail ring buffer
  private tx = new Float32Array(TRAIL_CAP);
  private ty = new Float32Array(TRAIL_CAP);
  private tt = new Float64Array(TRAIL_CAP);
  private tc = new Uint8Array(TRAIL_CAP);
  private tBreak = new Uint8Array(TRAIL_CAP);
  private tHead = 0; private tCount = 0;
  private curColor = 0;

  // feedback fx
  private fxT = new Float64Array(8); private fxX = new Float32Array(8); private fxY = new Float32Array(8);
  private fxDir = new Int8Array(8); private fxC = new Uint8Array(8); private fxHead = 0;
  pulse = 0;

  // ---- Jump (slow upward drag) and long-press (special) ----
  /** Live jump strength 0..1: how far the finger has dragged up since the jump fired (variable height). */
  jumpCharge = 0;
  private jumpY0 = 0; private jumpX0 = 0;
  private jumpArmed = true;
  private jumpFiredY = 0;
  private holdFired = false;
  /**
   * Special-input mode: when set, every pointer goes straight here (Special picker / trace) and the normal
   * gesture recognizer is bypassed. The whole screen accepts input while it is set.
   */
  rawSink: ((phase: 'down' | 'move' | 'up', x: number, y: number, t: number) => void) | null = null;
  private stickAlpha = 0;
  /** Tutorial hint: direction index, -2 = tap, -3 = drag demo, -1 = none. */
  hint = -1;
  hintLabel = '';
  /** Title screen mode shows a demo gesture. */
  demo = false;
  /** First-launch label alpha (fades away). */
  labelAlpha = 0;

  attach(el: HTMLElement): void {
    el.addEventListener('pointerdown', (e) => this.onDown(e), { passive: false });
    el.addEventListener('pointermove', (e) => this.onMove(e), { passive: false });
    el.addEventListener('pointerup', (e) => this.onUp(e), { passive: false });
    el.addEventListener('pointercancel', (e) => this.onUp(e), { passive: false });
  }

  private flickSpeed(): number { return PAD.flickSpeed / settings.sensitivity; }
  private flickDist(): number { return PAD.flickMinDist / settings.sensitivity; }

  private onDown(e: PointerEvent): void {
    if (this.rawSink) {
      if (this.pointerId !== -1) return;
      e.preventDefault();
      this.pointerId = e.pointerId;
      try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
      this.rawSink('down', e.clientX, e.clientY, e.timeStamp || performance.now());
      return;
    }
    if (!this.enabled) return;
    if (this.pointerId !== -1) return; // ignore extra touches
    if (!layout.inPad(e.clientX, e.clientY)) return; // upper half: menus/buttons only
    e.preventDefault();
    this.pointerId = e.pointerId;
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    const t = e.timeStamp || performance.now();
    this.lastX = this.anchorX = e.clientX;
    this.lastY = this.anchorY = e.clientY;
    this.startT = this.armT = t;
    this.travel = 0;
    this.anyCommit = false;
    this.armed = true;
    this.promoted = true;
    this.sCount = 0;
    this.moveX = 0;
    this.mode = 'idle';
    this.curColor = 0;
    this.jumpX0 = e.clientX; this.jumpY0 = e.clientY; this.jumpArmed = true; this.jumpCharge = 0;
    this.holdFired = false;
    this.addSample(e.clientX, e.clientY, t);
    this.pushTrail(e.clientX, e.clientY, t, true);
  }

  /** Long-press in place (special): fired from the frame poll, since a still finger sends no events. */
  pollHold(now: number): void {
    if (this.rawSink || this.pointerId === -1 || this.holdFired || this.anyCommit) return;
    if (this.travel > PAD.holdMaxDist || now - this.startT < PAD.holdMs) return;
    this.holdFired = true;
    this.anyCommit = true; // no tap on release
    this.curSegId = ++this.segId;
    this.emit('hold', -1, false, 0, 0, now);
    this.flash(this.lastX, this.lastY, -1, 4);
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    if (this.rawSink) { this.rawSink('move', e.clientX, e.clientY, e.timeStamp || performance.now()); return; }
    const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
    if (list && list.length > 0) {
      for (let i = 0; i < list.length; i++) this.sample(list[i].clientX, list[i].clientY, list[i].timeStamp || e.timeStamp);
    } else {
      this.sample(e.clientX, e.clientY, e.timeStamp || performance.now());
    }
  }

  private addSample(x: number, y: number, t: number): void {
    this.sx[this.sHead] = x; this.sy[this.sHead] = y; this.st[this.sHead] = t;
    this.sHead = (this.sHead + 1) % SAMPLE_N;
    if (this.sCount < SAMPLE_N) this.sCount++;
  }

  /** Oldest sample within `ms` of the newest, not older than `notBefore`. Returns its index. */
  private windowStart(ms: number, notBefore: number): number {
    const newest = (this.sHead - 1 + SAMPLE_N) % SAMPLE_N;
    const nt = this.st[newest];
    let idx = newest;
    for (let i = 1; i < this.sCount; i++) {
      const j = (newest - i + SAMPLE_N) % SAMPLE_N;
      if (nt - this.st[j] > ms || this.st[j] < notBefore) break;
      idx = j;
    }
    return idx;
  }

  private pathSpeed(ms: number): number {
    const newest = (this.sHead - 1 + SAMPLE_N) % SAMPLE_N;
    const nt = this.st[newest];
    let len = 0, prev = newest, ot = nt;
    for (let i = 1; i < this.sCount; i++) {
      const j = (newest - i + SAMPLE_N) % SAMPLE_N;
      if (nt - this.st[j] > ms) break;
      const dx = this.sx[prev] - this.sx[j], dy = this.sy[prev] - this.sy[j];
      len += Math.sqrt(dx * dx + dy * dy);
      prev = j; ot = this.st[j];
    }
    return (len / Math.max(8, nt - ot)) * 1000;
  }

  private sample(x: number, y: number, t: number): void {
    const ddx = x - this.lastX, ddy = y - this.lastY;
    this.travel += Math.sqrt(ddx * ddx + ddy * ddy);
    this.lastX = x; this.lastY = y;
    this.addSample(x, y, t);
    this.pushTrail(x, y, t, false);

    // ---- Flick (attack) detection over a short window ----
    const w0 = this.windowStart(PAD.flickWindowMs, this.armed ? this.armT : -1e12);
    const wx = this.sx[w0], wy = this.sy[w0], wt = this.st[w0];
    const dx = x - wx, dy = y - wy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dtw = Math.max(8, t - wt);
    // Finger speed along its PATH over the window (stays high through a zig-zag turn,
    // unlike net displacement). Used for re-arming, the stick freeze and debug.
    this.recentSpeed = this.pathSpeed(PAD.flickWindowMs);
    const speed = (dist / dtw) * 1000;

    if (this.armed) {
      if (dist >= this.flickDist() && speed >= this.flickSpeed()) {
        this.commit(dx, dy, dist, speed, t, x, y, wx, wy, wt);
      }
    } else {
      if (this.recentSpeed < this.flickSpeed() * PAD.rearmFrac && t - this.commitT > PAD.rearmMinMs) {
        this.armed = true;
        this.armT = t;
      } else {
        // Zig-zag chaining: a sharp turn while still fast fires the next attack.
        const lx = x - this.chainX, ly = y - this.chainY;
        const ld = Math.sqrt(lx * lx + ly * ly);
        if (ld >= this.flickDist() * 0.55) {
          const la = Math.atan2(-ly, lx);
          if (angleDiff(la, this.commitAng) > (PAD.chainTurnDeg * Math.PI) / 180) {
            this.commit(lx, ly, ld, this.recentSpeed, t, x, y, this.chainX, this.chainY, t - 30);
          } else {
            this.chainX = x; this.chainY = y;
          }
        }
      }
      // Promote to heavy: the flick keeps going long, fast and straight.
      if (!this.promoted && t - this.commitT <= PAD.heavyPromoteFrames * 16.7) {
        const hx = x - this.segOX, hy = y - this.segOY;
        const hd = Math.sqrt(hx * hx + hy * hy);
        const avg = (hd / Math.max(8, t - this.segT)) * 1000;
        if (hd >= PAD.heavyDist / settings.sensitivity && avg >= PAD.heavySpeed / settings.sensitivity && angleDiff(Math.atan2(-hy, hx), this.commitAng) < 0.55) {
          this.promoted = true;
          this.recolorSegment(this.curDir === 2 ? 3 : 2);
          this.emit('promote', this.curDir, true, hd, avg, t);
          this.flash(x, y, this.curDir, this.curColor);
        }
      }
    }

    // ---- Floating-stick movement ----
    if (t < this.suppressUntil) {
      // post-flick: follow the finger so its drift never shoves the player
      this.anchorX = x; this.anchorY = y;
      this.moveX = 0;
    } else if (this.recentSpeed < MOVE.freezeSpeed) {
      let sdx = x - this.anchorX;
      const r = MOVE.maxRadius;
      if (Math.abs(sdx) > r) { this.anchorX = x - Math.sign(sdx) * r; sdx = x - this.anchorX; }
      const ady = y - this.anchorY;
      if (Math.abs(ady) > r) this.anchorY = y - Math.sign(ady) * r;
      const mag = clamp((Math.abs(sdx) - MOVE.deadZone) / (r - MOVE.deadZone), 0, 1);
      this.moveX = Math.sign(sdx) * mag;
    }
    this.stickDX = x - this.anchorX; this.stickDY = y - this.anchorY;
    this.jumpGesture(x, y, t);
    if (t - this.commitT < 160) this.mode = 'attacking';
    else this.mode = this.moveX !== 0 ? 'moving' : 'idle';
  }

  /**
   * JUMP: a deliberate SLOW upward drag. The finger's lowest point is the reference; once it has
   * risen jumpDragPx above it (mostly vertical, below the flick speed) a jump fires. Dragging on
   * keeps raising jumpCharge (the sim reads it for a higher jump). A quick flick up never gets
   * here first: flick detection runs before this and re-bases the reference.
   */
  private jumpGesture(x: number, y: number, t: number): void {
    if (t - this.commitT < PAD.jumpAfterFlickMs) { this.jumpY0 = y; this.jumpX0 = x; return; }
    if (!this.jumpArmed) {
      if (y - this.jumpFiredY > PAD.jumpRearmPx) { this.jumpArmed = true; this.jumpY0 = y; this.jumpX0 = x; }
      else this.jumpCharge = Math.max(this.jumpCharge, clamp((this.jumpFiredY - y) / PAD.jumpBoostPx, 0, 1));
      return;
    }
    if (y > this.jumpY0) { this.jumpY0 = y; this.jumpX0 = x; return; }
    const up = this.jumpY0 - y;
    const side = Math.abs(x - this.jumpX0);
    if (up >= PAD.jumpDragPx / settings.sensitivity && up >= side * PAD.jumpMinSlope && this.recentSpeed < this.flickSpeed() * PAD.jumpMaxSpeedFrac) {
      this.jumpArmed = false;
      this.jumpFiredY = y;
      this.jumpCharge = 0;
      this.curSegId = ++this.segId;
      this.emit('jump', 2, false, up, this.recentSpeed, t);
      this.flash(x, y, 2, 4);
      this.anyCommit = true;
    }
  }

  private commit(dx: number, dy: number, d: number, speed: number, t: number, x: number, y: number, ox: number, oy: number, ot: number): void {
    const dir = classifyDir(dx, dy);
    this.armed = false;
    this.anyCommit = true;
    this.commitAng = Math.atan2(-dy, dx);
    this.commitT = t;
    this.chainX = x; this.chainY = y;
    this.segOX = ox; this.segOY = oy; this.segT = ot;
    this.promoted = false;
    this.curSegId = ++this.segId;
    this.curDir = dir;
    // Re-anchor movement and suppress it for a few frames (post-flick drift).
    this.anchorX = x; this.anchorY = y;
    this.suppressUntil = t + MOVE.suppressFrames * 16.7;
    this.moveX = 0;
    this.mode = 'attacking';
    this.recolorSegment(dir === 2 ? 3 : 1);
    this.emit('swipe', dir, false, d, speed, t);
    this.flash(x, y, dir, dir === 2 ? 3 : 1);
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = -1;
    const t = e.timeStamp || performance.now();
    this.jumpCharge = 0;
    if (this.rawSink) { this.rawSink('up', e.clientX, e.clientY, t); return; }
    if (!this.anyCommit && this.travel <= PAD.tapMaxDist && t - this.startT <= PAD.tapMaxMs) {
      this.curSegId = ++this.segId;
      this.emit('tap', -1, false, 0, 0, t);
      this.flash(e.clientX, e.clientY, -1, 4);
    }
    this.moveX = 0;
    this.mode = 'idle';
    this.recentSpeed = 0;
    this.tBreak[(this.tHead + TRAIL_CAP - 1) % TRAIL_CAP] = 1;
  }

  private emit(kind: SwipeKind, dir: number, heavy: boolean, len: number, speed: number, t: number): void {
    this.events.push({ kind, dir, heavy, len, speed, segId: this.curSegId, time: t, source: 'pad' });
    this.lastDir = dir; this.lastLen = len; this.lastSpeed = speed; this.lastKind = kind;
  }

  /** Inject a keyboard-generated event. */
  inject(kind: SwipeKind, dir: number, heavy: boolean, time = performance.now()): void {
    const segId = ++this.segId;
    this.events.push({ kind, dir, heavy, len: 0, speed: 0, segId, time, source: 'key' });
    this.lastDir = dir; this.lastKind = kind; this.lastLen = 0; this.lastSpeed = 0;
    const p = layout.pad;
    this.flash(p.x + p.w / 2, p.y + p.h / 2, kind === 'tap' ? -1 : dir, kind === 'tap' ? 4 : heavy ? 2 : dir === 2 ? 3 : 1);
  }

  private pushTrail(x: number, y: number, t: number, brk: boolean): void {
    const i = this.tHead;
    this.tx[i] = x; this.ty[i] = y; this.tt[i] = t; this.tc[i] = this.curColor; this.tBreak[i] = 0;
    if (brk) this.tBreak[(i + TRAIL_CAP - 1) % TRAIL_CAP] = 1;
    this.tHead = (i + 1) % TRAIL_CAP;
    if (this.tCount < TRAIL_CAP) this.tCount++;
  }

  private recolorSegment(c: number): void {
    this.curColor = c;
    // recolor the recent part of the stroke that formed this flick
    let i = (this.tHead - 1 + TRAIL_CAP) % TRAIL_CAP;
    const now = this.tt[i];
    for (let n = 0; n < TRAIL_CAP && n < this.tCount; n++) {
      if (now - this.tt[i] > PAD.flickWindowMs + 20 || this.tBreak[i]) break;
      this.tc[i] = c;
      i = (i - 1 + TRAIL_CAP) % TRAIL_CAP;
    }
  }

  private flash(x: number, y: number, dir: number, c: number): void {
    const i = this.fxHead; this.fxHead = (i + 1) & 7;
    this.fxT[i] = performance.now(); this.fxX[i] = x; this.fxY[i] = y; this.fxDir[i] = dir; this.fxC[i] = c;
  }

  onHit(weight: number): void { this.pulse = Math.min(1, this.pulse + 0.35 + weight * 0.5); }
  isTouching(): boolean { return this.pointerId !== -1; }
  /** Low stance: the finger has slid down from its anchor (and isn't flicking). */
  get crouching(): boolean { return this.pointerId !== -1 && !this.rawSink && this.stickDY > PAD.crouchPx && this.mode !== 'attacking'; }

  // ---------------- Rendering (css px space): Arcade Fighter feedback (pass 8 UI) ----------------
  /**
   * The pad stays transparent. Feedback uses the Arcade palette with a navy
   * under-stroke so it reads on the light page: the trail is a neon core
   * (steel = move, cyan = light, magenta = heavy, gold = launcher, pink = tap)
   * that thins and fades, the floating stick a steel ring with a white dot, a
   * committed flick a ring + arrow burst. First launch: a dashed cyan line at
   * the pad's top edge with a labelled plate.
   */
  draw(ctx: CanvasRenderingContext2D, now: number, dt: number): void {
    const p = layout.pad;
    const u = getUiScale();
    this.pulse = Math.max(0, this.pulse - dt * 3.2);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (this.labelAlpha > 0.01) {
      const a = Math.min(1, this.labelAlpha);
      ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(46,230,255,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(p.x + 8, p.y + 1); ctx.lineTo(p.x + p.w - 8, p.y + 1); ctx.stroke(); ctx.setLineDash([]);
      const txt = 'TOUCH AREA · DRAG = MOVE · FLICK = ATTACK · SLOW DRAG ↑ = JUMP · HOLD = SPECIAL';
      let fs = Math.round(13 * u);
      ctx.font = `700 ${fs}px "Oswald", sans-serif`;
      const maxW = p.w - 40;
      if (ctx.measureText(txt).width > maxW) { fs = Math.max(9, Math.floor(fs * maxW / ctx.measureText(txt).width)); ctx.font = `700 ${fs}px "Oswald", sans-serif`; }
      const tw = ctx.measureText(txt).width + fs * 1.6;
      const lx = p.x + p.w / 2, ly = p.y + 16 * u;
      ctx.save(); ctx.translate(lx, ly); ctx.transform(1, 0, -0.25, 1, 0, 0);
      ctx.fillStyle = 'rgba(11,16,38,0.86)'; ctx.fillRect(-tw / 2, -fs * 0.85, tw, fs * 1.7); ctx.restore();
      ctx.fillStyle = '#2ee6ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, lx, ly + 0.5);
      ctx.globalAlpha = 1;
    }
    if (this.hint !== -1 || this.demo) this.drawHint(ctx, now, u);
    // floating stick
    const touching = this.pointerId !== -1;
    this.stickAlpha += ((touching ? 1 : 0) - this.stickAlpha) * Math.min(1, dt * (touching ? 14 : 6));
    if (this.stickAlpha > 0.03) {
      const a = this.stickAlpha;
      ctx.globalAlpha = 0.5 * a;
      ctx.strokeStyle = '#0b1026'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(this.anchorX, this.anchorY, MOVE.maxRadius, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#8d99b8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.anchorX, this.anchorY, MOVE.maxRadius, 0, Math.PI * 2); ctx.stroke();
      if (touching) {
        ctx.globalAlpha = 0.9 * a;
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0b1026'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(this.lastX, this.lastY, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // trail: navy under-stroke + neon core, thinning with age
    if (this.tCount >= 2) {
      const fade = PAD.trailFadeMs;
      const start = (this.tHead - this.tCount + TRAIL_CAP) % TRAIL_CAP;
      for (let pass = 0; pass < 2; pass++) {
        let prev = start;
        for (let n = 1; n < this.tCount; n++) {
          const i = (start + n) % TRAIL_CAP;
          if (this.tBreak[prev]) { prev = i; continue; }
          const age = now - this.tt[i];
          if (age > fade || age < -50) { prev = i; continue; }
          const k = 1 - clamp(age / fade, 0, 1);
          const strong = this.tc[i] !== 0 ? 1 : 0.5;
          ctx.globalAlpha = k * strong;
          ctx.strokeStyle = pass === 0 ? '#0b1026' : ARC_TRAIL[this.tc[i]];
          ctx.lineWidth = pass === 0 ? 4 + 9 * k : 2 + 5 * k;
          ctx.beginPath(); ctx.moveTo(this.tx[prev], this.ty[prev]); ctx.lineTo(this.tx[i], this.ty[i]); ctx.stroke();
          prev = i;
        }
      }
      ctx.globalAlpha = 1;
    }
    // committed swipe: ring + arrow burst
    for (let i = 0; i < 8; i++) {
      const age = (now - this.fxT[i]) / 1000;
      if (age < 0 || age > 0.32 || this.fxT[i] === 0) continue;
      const k = age / 0.32, e = 1 - (1 - k) * (1 - k);
      const col = ARC_TRAIL[this.fxC[i]];
      const r = 12 + e * 42;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#0b1026'; ctx.lineWidth = 7 * (1 - k) + 2;
      ctx.beginPath(); ctx.arc(this.fxX[i], this.fxY[i], r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 3.5 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(this.fxX[i], this.fxY[i], r, 0, Math.PI * 2); ctx.stroke();
      if (this.fxDir[i] >= 0) {
        const a = -this.fxDir[i] * Math.PI / 4, d = 28 + e * 28;
        drawArrow(ctx, this.fxX[i] + Math.cos(a) * d, this.fxY[i] + Math.sin(a) * d, a, 24 * (1 - k * 0.4), col);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Tutorial / title demo gesture: a glowing cyan arrow (or tap ring, or drag dot) with a label plate. */
  private drawHint(ctx: CanvasRenderingContext2D, now: number, u: number): void {
    const p = layout.pad;
    const cx = p.x + p.w / 2, cy = p.y + p.h * 0.45;
    const t = (now / 1000) % 1.4;
    let dir = this.hint;
    if (this.demo) dir = [0, 2, 4, 6][Math.floor(now / 1400) % 4];
    ctx.save();
    ctx.shadowColor = '#2ee6ff';
    if (dir === -2) {
      const k = (t % 0.7) / 0.7;
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ff8ad8'; ctx.lineWidth = 4; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(cx, cy, 14 + k * 50, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.95; ctx.fillStyle = '#ff2e88';
      ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
    } else if (dir === -3) {
      const off = Math.sin((now / 1000) * 1.6) * MOVE.maxRadius * 0.9;
      ctx.globalAlpha = 0.6; ctx.strokeStyle = '#8d99b8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, MOVE.maxRadius, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0b1026'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx + off, cy, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (dir >= 0) {
      const a = -dir * Math.PI / 4;
      const len = Math.min(p.w, p.h) * 0.3;
      const k = Math.min(1, t / 0.35), e = 1 - Math.pow(1 - k, 3);
      const x0 = cx - Math.cos(a) * len * 0.5, y0 = cy - Math.sin(a) * len * 0.5;
      const x1 = x0 + Math.cos(a) * len * e, y1 = y0 + Math.sin(a) * len * e;
      const fadeOut = 1 - Math.max(0, t - 0.6) / 0.8;
      ctx.globalAlpha = fadeOut;
      ctx.strokeStyle = '#0b1026'; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.shadowBlur = 12; ctx.strokeStyle = '#2ee6ff'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      drawArrow(ctx, x1, y1, a, 28, '#2ee6ff');
    }
    ctx.shadowBlur = 0;
    if (this.hintLabel) {
      ctx.globalAlpha = 1;
      const fs = Math.round(16 * u);
      ctx.font = `italic ${fs}px "Russo One", sans-serif`;
      const tw = ctx.measureText(this.hintLabel).width + fs * 1.6;
      const ly = p.y + p.h - Math.max(22, p.h * 0.12);
      ctx.save(); ctx.translate(cx, ly); ctx.transform(1, 0, -0.25, 1, 0, 0);
      ctx.fillStyle = 'rgba(11,16,38,0.86)'; ctx.fillRect(-tw / 2, -fs * 0.85, tw, fs * 1.7); ctx.restore();
      ctx.fillStyle = '#ffd23f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.hintLabel, cx, ly + 1);
    }
    ctx.restore();
  }

  static arrowFor(dir: number): string { return dir >= 0 ? DIR_ARROWS[dir] : '•'; }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, size: number, col: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.strokeStyle = '#0b1026'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(size * 0.6, 0);
  ctx.lineTo(-size * 0.4, -size * 0.45);
  ctx.lineTo(-size * 0.15, 0);
  ctx.lineTo(-size * 0.4, size * 0.45);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

/** Trail / flash colors by stroke kind: move, light, heavy, launcher, tap. */
const ARC_TRAIL = ['#e9eef8', '#2ee6ff', '#ff2e88', '#ffd23f', '#ff8ad8'];
