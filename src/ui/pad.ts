import { PAD } from '../data/tuning';
import { layout } from '../core/layout';
import { settings } from '../core/settings';
import { angleDiff, clamp } from '../core/math';

export type SwipeKind = 'swipe' | 'tap' | 'upgrade';
export interface SwipeEvent {
  kind: SwipeKind;
  /** 0=E,1=NE,2=N,3=NW,4=W,5=SW,6=S,7=SE */
  dir: number;
  heavy: boolean;
  len: number;
  speed: number;
  /** Segment id; an 'upgrade' refers to the swipe with the same id. */
  segId: number;
  time: number;
  source: 'pad' | 'key';
}

const TRAIL_CAP = 128;
const DIR_ARROWS = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];

/** Color index for trail points. */
export const TRAIL_COLORS = ['#ffffff', '#9ff0ff', '#ff9a3a', '#ffe14a', '#ff4dd2'];

export function classifyDir(dx: number, dy: number): number {
  // dy is screen-space (down positive); flip so N = up.
  let deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  // Cardinal bias: snap to the nearest cardinal if within half-sector + bias.
  const half = PAD.sectorHalfDeg;
  for (let c = 0; c < 4; c++) {
    const center = c * 90;
    let d = Math.abs(deg - center);
    if (d > 180) d = 360 - d;
    if (d <= half + PAD.cardinalBiasDeg) return c * 2;
  }
  return ((Math.round(deg / 45) % 8) + 8) % 8;
}

/** Gesture recognizer + visual feedback for the draw pad. */
export class DrawPad {
  readonly events: SwipeEvent[] = [];
  /** Last committed info for the debug overlay. */
  lastDir = -1; lastLen = 0; lastSpeed = 0; lastKind: SwipeKind | '' = '';
  enabled = true;

  private pointerId = -1;
  private segId = 0;
  // stroke state
  private startX = 0; private startY = 0; private startT = 0;
  private travel = 0;
  private lastX = 0; private lastY = 0;
  private anyCommit = false;
  // segment state
  private segOX = 0; private segOY = 0; private segT = 0;
  private committed = false;
  private segAngle = 0;
  private commitT = 0;
  private upgraded = false;
  private segTrailStart = 0;
  private anchorX = 0; private anchorY = 0;
  private curSegId = 0;
  // speed samples
  private sx = new Float64Array(8); private sy = new Float64Array(8); private st = new Float64Array(8);
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
  /** Tutorial hint: direction index, -2 = tap, -1 = none. */
  hint = -1;
  hintLabel = '';
  /** Title screen mode shows a demo gesture. */
  demo = false;

  attach(el: HTMLElement): void {
    el.addEventListener('pointerdown', (e) => this.onDown(e), { passive: false });
    el.addEventListener('pointermove', (e) => this.onMove(e), { passive: false });
    el.addEventListener('pointerup', (e) => this.onUp(e), { passive: false });
    el.addEventListener('pointercancel', (e) => this.onUp(e), { passive: false });
  }

  private minDist(): number {
    const p = layout.pad;
    return Math.max(PAD.minDistPx, Math.min(p.w, p.h) * PAD.minDistFrac) / settings.sensitivity;
  }

  private onDown(e: PointerEvent): void {
    if (!this.enabled) return;
    if (this.pointerId !== -1) return; // ignore extra touches
    if (!layout.inPad(e.clientX, e.clientY)) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    const t = e.timeStamp || performance.now();
    this.startX = this.lastX = e.clientX; this.startY = this.lastY = e.clientY; this.startT = t;
    this.travel = 0;
    this.anyCommit = false;
    this.sCount = 0;
    this.beginSegment(e.clientX, e.clientY, t);
    this.pushTrail(e.clientX, e.clientY, t, true);
  }

  private beginSegment(x: number, y: number, t: number): void {
    this.segOX = this.anchorX = x; this.segOY = this.anchorY = y; this.segT = t;
    this.committed = false;
    this.upgraded = false;
    this.curColor = 0;
    this.segTrailStart = this.tHead;
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
    if (list && list.length > 0) {
      for (let i = 0; i < list.length; i++) this.sample(list[i].clientX, list[i].clientY, list[i].timeStamp || e.timeStamp);
    } else {
      this.sample(e.clientX, e.clientY, e.timeStamp || performance.now());
    }
  }

  private sample(x: number, y: number, t: number): void {
    const ddx = x - this.lastX, ddy = y - this.lastY;
    this.travel += Math.sqrt(ddx * ddx + ddy * ddy);
    this.lastX = x; this.lastY = y;
    this.sx[this.sHead] = x; this.sy[this.sHead] = y; this.st[this.sHead] = t;
    this.sHead = (this.sHead + 1) & 7; if (this.sCount < 8) this.sCount++;
    this.pushTrail(x, y, t, false);

    const minD = this.minDist();
    if (!this.committed) {
      const dx = x - this.segOX, dy = y - this.segOY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= minD) {
        const speed = this.speed();
        if (speed >= PAD.minSpeed || d >= minD * 2) this.commit(dx, dy, d, speed, t, x, y);
      }
      return;
    }
    // Heavy upgrade: long, fast, straight continuation of the committed swipe.
    const short = Math.min(layout.pad.w, layout.pad.h);
    if (!this.upgraded && t - this.commitT <= PAD.heavyUpgradeFrames * 16.7) {
      const dx = x - this.segOX, dy = y - this.segOY;
      const d = Math.sqrt(dx * dx + dy * dy);
      const ang = Math.atan2(-dy, dx);
      const avg = d / Math.max(1, t - this.segT);
      if (d >= short * PAD.heavyDistFrac / settings.sensitivity && angleDiff(ang, this.segAngle) < 0.55 && avg >= PAD.heavyMinSpeed) {
        this.upgraded = true;
        this.recolorSegment(this.lastDir === 2 ? 3 : 2);
        this.emit('upgrade', this.lastDir, true, d, avg, t);
        this.flash(x, y, this.lastDir, this.curColor);
      }
    }
    // Chain: sharp turn starts a new swipe from the turn point.
    const lx = x - this.anchorX, ly = y - this.anchorY;
    const ld = Math.sqrt(lx * lx + ly * ly);
    if (ld >= minD * 0.6) {
      const la = Math.atan2(-ly, lx);
      if (angleDiff(la, this.segAngle) > (PAD.chainTurnDeg * Math.PI) / 180) {
        const ax = this.anchorX, ay = this.anchorY;
        this.beginSegment(ax, ay, t - 30);
        const dx = x - ax, dy = y - ay;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= minD * 0.85) this.commit(dx, dy, d, this.speed(), t, x, y);
      } else {
        this.anchorX = x; this.anchorY = y;
      }
    }
  }

  private commit(dx: number, dy: number, d: number, speed: number, t: number, x: number, y: number): void {
    const dir = classifyDir(dx, dy);
    this.committed = true;
    this.anyCommit = true;
    this.segAngle = Math.atan2(-dy, dx);
    this.commitT = t;
    this.anchorX = x; this.anchorY = y;
    this.curSegId = ++this.segId;
    this.recolorSegment(dir === 2 ? 3 : 1);
    this.emit('swipe', dir, false, d, speed, t);
    this.flash(x, y, dir, this.curColor);
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = -1;
    const t = e.timeStamp || performance.now();
    const short = Math.min(layout.pad.w, layout.pad.h);
    if (!this.anyCommit) {
      const dur = t - this.startT;
      if (this.travel <= short * PAD.tapMaxDistFrac + 4 && dur <= PAD.tapMaxMs) {
        this.curSegId = ++this.segId;
        this.emit('tap', -1, false, 0, 0, t);
        this.flash(e.clientX, e.clientY, -1, 4);
      } else if (this.travel >= this.minDist() * 0.6) {
        // Slow short drag: still honor it on release so no input is swallowed.
        const dx = e.clientX - this.startX, dy = e.clientY - this.startY;
        if (dx * dx + dy * dy > 16) this.commit(dx, dy, Math.sqrt(dx * dx + dy * dy), 0, t, e.clientX, e.clientY);
      }
    }
    this.tBreak[(this.tHead + TRAIL_CAP - 1) % TRAIL_CAP] = 1;
  }

  private emit(kind: SwipeKind, dir: number, heavy: boolean, len: number, speed: number, t: number): void {
    this.events.push({ kind, dir, heavy, len, speed, segId: this.curSegId, time: t, source: 'pad' });
    this.lastDir = dir; this.lastLen = len; this.lastSpeed = speed; this.lastKind = kind;
  }

  /** Inject a keyboard-generated event. */
  inject(kind: SwipeKind, dir: number, heavy: boolean): void {
    const segId = ++this.segId;
    this.events.push({ kind, dir, heavy, len: 0, speed: 0, segId, time: performance.now(), source: 'key' });
    this.lastDir = dir; this.lastKind = kind; this.lastLen = 0; this.lastSpeed = 0;
    const p = layout.pad;
    this.flash(p.x + p.w / 2, p.y + p.h / 2, kind === 'tap' ? -1 : dir, kind === 'tap' ? 4 : heavy ? 2 : dir === 2 ? 3 : 1);
  }

  private speed(): number {
    if (this.sCount < 2) return 0;
    const newest = (this.sHead + 7) & 7;
    const nt = this.st[newest];
    let oldest = newest;
    for (let i = 1; i < this.sCount; i++) {
      const idx = (newest - i + 8) & 7;
      if (nt - this.st[idx] > 80) break;
      oldest = idx;
    }
    const dt = nt - this.st[oldest];
    if (dt <= 0) return 0;
    const dx = this.sx[newest] - this.sx[oldest], dy = this.sy[newest] - this.sy[oldest];
    return Math.sqrt(dx * dx + dy * dy) / dt;
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
    let i = this.segTrailStart;
    let guard = 0;
    while (i !== this.tHead && guard++ < TRAIL_CAP) { this.tc[i] = c; i = (i + 1) % TRAIL_CAP; }
  }

  private flash(x: number, y: number, dir: number, c: number): void {
    const i = this.fxHead; this.fxHead = (i + 1) & 7;
    this.fxT[i] = performance.now(); this.fxX[i] = x; this.fxY[i] = y; this.fxDir[i] = dir; this.fxC[i] = c;
  }

  /** Mark that a hit landed: the pad pulses. */
  onHit(weight: number): void { this.pulse = Math.min(1, this.pulse + 0.35 + weight * 0.5); }

  isTouching(): boolean { return this.pointerId !== -1; }

  // ---------------- Rendering (css px space) ----------------
  draw(ctx: CanvasRenderingContext2D, now: number, dt: number): void {
    const p = layout.pad;
    this.pulse = Math.max(0, this.pulse - dt * 3.2);
    const r = Math.min(28, p.h * 0.12);
    ctx.save();
    // panel
    ctx.beginPath();
    roundRect(ctx, p.x, p.y, p.w, p.h, r);
    ctx.fillStyle = `rgba(14,18,34,${0.42 + this.pulse * 0.12})`;
    ctx.fill();
    ctx.lineWidth = 2 + this.pulse * 3;
    ctx.strokeStyle = `rgba(160,220,255,${0.22 + this.pulse * 0.5})`;
    ctx.stroke();
    // subtle grid/crosshair
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    ctx.strokeStyle = 'rgba(160,220,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, p.y + 14); ctx.lineTo(cx, p.y + p.h - 14);
    ctx.moveTo(p.x + 14, cy); ctx.lineTo(p.x + p.w - 14, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(p.w, p.h) * 0.22, 0, Math.PI * 2);
    ctx.stroke();

    // hint arrow
    if (this.hint !== -1 || this.demo) this.drawHint(ctx, now);

    // trail
    this.drawTrail(ctx, now);

    // commit fx
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) {
      const age = (now - this.fxT[i]) / 1000;
      if (age < 0 || age > 0.35 || this.fxT[i] === 0) continue;
      const k = age / 0.35;
      const col = TRAIL_COLORS[this.fxC[i]];
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(this.fxX[i], this.fxY[i], 10 + k * 46, 0, Math.PI * 2);
      ctx.stroke();
      if (this.fxDir[i] >= 0) {
        const a = -this.fxDir[i] * Math.PI / 4;
        const dist = 26 + k * 30;
        drawArrow(ctx, this.fxX[i] + Math.cos(a) * dist, this.fxY[i] + Math.sin(a) * dist, a, 22 * (1 - k * 0.5), col);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  private drawTrail(ctx: CanvasRenderingContext2D, now: number): void {
    if (this.tCount < 2) return;
    const fade = PAD.trailFadeMs;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';
    const start = (this.tHead - this.tCount + TRAIL_CAP) % TRAIL_CAP;
    for (let pass = 0; pass < 2; pass++) {
      let prev = start;
      for (let n = 1; n < this.tCount; n++) {
        const i = (start + n) % TRAIL_CAP;
        if (this.tBreak[prev]) { prev = i; continue; }
        const age = now - this.tt[i];
        if (age > fade || age < -50) { prev = i; continue; }
        const k = 1 - clamp(age / fade, 0, 1);
        ctx.strokeStyle = TRAIL_COLORS[this.tc[i]];
        ctx.globalAlpha = pass === 0 ? k * 0.25 : k * 0.95;
        ctx.lineWidth = pass === 0 ? 4 + 18 * k : 2 + 6 * k;
        ctx.beginPath();
        ctx.moveTo(this.tx[prev], this.ty[prev]);
        ctx.lineTo(this.tx[i], this.ty[i]);
        ctx.stroke();
        prev = i;
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawHint(ctx: CanvasRenderingContext2D, now: number): void {
    const p = layout.pad;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const t = (now / 1000) % 1.4;
    let dir = this.hint;
    if (this.demo) dir = [0, 2, 4, 6][Math.floor(now / 1400) % 4];
    ctx.save();
    if (dir === -2) {
      const k = (t % 0.7) / 0.7;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#ff9ff0';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, 14 + k * 50, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ff9ff0';
      ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
    } else if (dir >= 0) {
      const a = -dir * Math.PI / 4;
      const len = Math.min(p.w, p.h) * 0.34;
      const k = Math.min(1, t / 0.8);
      const e = 1 - Math.pow(1 - k, 3);
      const x0 = cx - Math.cos(a) * len * 0.5, y0 = cy - Math.sin(a) * len * 0.5;
      const x1 = x0 + Math.cos(a) * len * e, y1 = y0 + Math.sin(a) * len * e;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 * (1 - Math.max(0, t - 0.8) / 0.6);
      ctx.strokeStyle = '#ffe96a';
      ctx.lineCap = 'round';
      ctx.lineWidth = 22;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.globalAlpha = 0.95 * (1 - Math.max(0, t - 0.8) / 0.6);
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      drawArrow(ctx, x1, y1, a, 26, '#ffe96a');
      // finger dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x1, y1, 10, 0, Math.PI * 2); ctx.fill();
    }
    if (this.hintLabel) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 ${Math.round(Math.max(13, p.h * 0.075))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(this.hintLabel, cx, p.y + p.h - Math.max(14, p.h * 0.08));
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
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(size * 0.6, 0);
  ctx.lineTo(-size * 0.4, -size * 0.45);
  ctx.lineTo(-size * 0.15, 0);
  ctx.lineTo(-size * 0.4, size * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
