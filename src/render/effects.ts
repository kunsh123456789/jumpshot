import { Pool } from '../core/pool';
import { fxRng } from '../core/rng';
import { JOINT_N, J, RIG } from './rig';
import { TAU } from '../core/math';
import { WORLD } from '../data/tuning';

/** Particle kinds. */
export const PK = { spark: 0, dot: 1, ring: 2, star: 3, dust: 4, debris: 5, ember: 6, flash: 7, shock: 8 } as const;

class Particle {
  kind = 0;
  x = 0; y = 0; vx = 0; vy = 0;
  life = 0; max = 1;
  size = 1; size2 = 0;
  rot = 0; vr = 0;
  color = '#fff';
  grav = 0; drag = 1;
  additive = true;
}

class Afterimage {
  joints = new Float32Array(JOINT_N * 2);
  color = '#fff';
  width = 6;
  scale = 1;
  life = 0; max = 1;
}

class FloatText {
  text = '';
  x = 0; y = 0; vy = 0; vx = 0;
  life = 0; max = 1;
  color = '#fff';
  size = 24;
  outline = '#000';
}

/** All cosmetic effects, pooled. Updated per render frame with scaled dt. */
export class Effects {
  readonly parts = new Pool(() => new Particle(), 700);
  readonly ghosts = new Pool(() => new Afterimage(), 48);
  readonly texts = new Pool(() => new FloatText(), 64);
  /** Full-screen flash (0..1) and color. */
  screenFlash = 0;
  screenFlashColor = '#ffffff';
  /** Red damage vignette 0..1 */
  hurtVignette = 0;
  /** Impact frame: inverted-color flash time left (s). */
  invert = 0;
  /** Speed-line bursts radiating from contact points. */
  private slX = new Float32Array(6); private slY = new Float32Array(6); private slT = new Float32Array(6);
  private slA = new Float32Array(6); private slH = new Uint8Array(6); private slHead = 0;

  /** Radial speed lines from a contact point (impact frame). */
  speedLines(x: number, y: number, dirX: number, dirY: number, heavy: boolean): void {
    const i = this.slHead; this.slHead = (i + 1) % 6;
    this.slX[i] = x; this.slY[i] = y; this.slT[i] = 0.0001; this.slA[i] = Math.atan2(dirY, dirX); this.slH[i] = heavy ? 1 : 0;
  }

  drawSpeedLines(ctx: CanvasRenderingContext2D, life: number, count: number): void {
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const t = this.slT[i];
      if (t <= 0 || t > life) continue;
      const k = t / life;
      const heavy = this.slH[i] === 1;
      const n = heavy ? count : Math.round(count * 0.6);
      const r0 = (heavy ? 40 : 28) + k * 60, len = (heavy ? 150 : 80) * (1 - k * 0.5);
      ctx.globalAlpha = (1 - k) * (heavy ? 0.9 : 0.7);
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      for (let j = 0; j < n; j++) {
        // biased toward the hit direction, but radiating all round
        const a = this.slA[i] + ((j / n) * Math.PI * 2) + Math.sin(j * 12.9898) * 0.15;
        const bias = 0.6 + 0.4 * Math.cos(a - this.slA[i]);
        const c = Math.cos(a), s = Math.sin(a);
        ctx.moveTo(this.slX[i] + c * r0, this.slY[i] + s * r0);
        ctx.lineTo(this.slX[i] + c * (r0 + len * bias), this.slY[i] + s * (r0 + len * bias));
      }
      ctx.lineWidth = heavy ? 3 : 2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  spawn(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, additive = true): Particle {
    const p = this.parts.acquire();
    p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = 0; p.max = life;
    p.size = size; p.size2 = 0; p.rot = fxRng.range(0, TAU); p.vr = 0; p.color = color;
    p.grav = 0; p.drag = 1; p.additive = additive;
    return p;
  }

  /** Anime-style hit spark + speed lines along the knockback direction. */
  hitSpark(x: number, y: number, dx: number, dy: number, weight: number, color: string, crit = false): void {
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len, ny = dy / len;
    const w = Math.min(1.4, weight);
    // Brief: the spark pops for ~2-4 frames so the frozen contact pose stays readable.
    const star = this.spawn(PK.star, x, y, 0, 0, 0.055 + w * 0.025, 22 + w * 30 + (crit ? 20 : 0), crit ? '#fff27a' : color);
    star.size2 = 6 + Math.floor(w * 4);
    star.rot = Math.atan2(ny, nx);
    this.spawn(PK.flash, x, y, 0, 0, 0.03, 14 + w * 18, '#ffffff');
    const ring = this.spawn(PK.ring, x, y, 0, 0, 0.12 + w * 0.05, 10, color);
    ring.size2 = 30 + w * 50;
    // speed lines
    const n = 6 + Math.floor(w * 10);
    for (let i = 0; i < n; i++) {
      const spread = (fxRng.next() - 0.5) * (1.1 - w * 0.4);
      const c = Math.cos(spread), s = Math.sin(spread);
      const vx = (nx * c - ny * s), vy = (nx * s + ny * c);
      const sp = fxRng.range(700, 1500) * (0.7 + w * 0.6);
      const p = this.spawn(PK.spark, x, y, vx * sp, vy * sp, fxRng.range(0.12, 0.22 + w * 0.1), fxRng.range(2, 3.5 + w * 2), i % 3 === 0 ? '#ffffff' : color);
      p.drag = 0.86;
    }
    // back-spray dots
    const m = 4 + Math.floor(w * 6);
    for (let i = 0; i < m; i++) {
      const a = fxRng.range(0, TAU);
      const sp = fxRng.range(120, 520) * (0.6 + w);
      const p = this.spawn(PK.dot, x, y, Math.cos(a) * sp, Math.sin(a) * sp, fxRng.range(0.2, 0.45), fxRng.range(2, 4.5), color);
      p.drag = 0.9; p.grav = 900;
    }
  }

  dust(x: number, y: number, power: number, dir = 0): void {
    const n = 5 + Math.floor(power * 10);
    for (let i = 0; i < n; i++) {
      const side = dir !== 0 ? dir : (fxRng.next() < 0.5 ? -1 : 1);
      const sp = fxRng.range(60, 260) * (0.6 + power);
      const p = this.spawn(PK.dust, x + fxRng.range(-14, 14), y - fxRng.range(0, 8), side * sp * fxRng.range(0.4, 1), -fxRng.range(20, 140) * (0.5 + power), fxRng.range(0.35, 0.7), fxRng.range(8, 16) * (0.7 + power * 0.6), 'rgba(200,200,215,0.5)', false);
      p.drag = 0.9; p.grav = -40; p.size2 = p.size * 2.4;
    }
  }

  crater(x: number, y: number, power: number, color: string): void {
    this.dust(x, y, power * 1.4);
    const ring = this.spawn(PK.shock, x, y, 0, 0, 0.35 + power * 0.2, 20, color);
    ring.size2 = 120 + power * 220;
    for (let i = 0; i < 8 + power * 12; i++) {
      const a = -fxRng.range(0.2, Math.PI - 0.2);
      const sp = fxRng.range(300, 800) * (0.6 + power * 0.6);
      const p = this.spawn(PK.debris, x, y - 4, Math.cos(a) * sp, Math.sin(a) * sp, fxRng.range(0.4, 0.8), fxRng.range(3, 7), '#8a8aa0', false);
      p.grav = 2400; p.vr = fxRng.range(-20, 20); p.drag = 0.99;
    }
  }

  shockwave(x: number, y: number, radius: number, color: string): void {
    const r = this.spawn(PK.shock, x, y, 0, 0, 0.45, 20, color);
    r.size2 = radius;
    const r2 = this.spawn(PK.ring, x, y - 40, 0, 0, 0.35, 20, '#ffffff');
    r2.size2 = radius * 0.8;
  }

  embers(x: number, y: number, n: number, color: string): void {
    for (let i = 0; i < n; i++) {
      const a = fxRng.range(0, TAU);
      const sp = fxRng.range(80, 420);
      const p = this.spawn(PK.ember, x + fxRng.range(-20, 20), y + fxRng.range(-40, 20), Math.cos(a) * sp, Math.sin(a) * sp - 120, fxRng.range(0.5, 1.1), fxRng.range(2, 5), color);
      p.drag = 0.94; p.grav = -200;
    }
  }

  afterimage(joints: Float32Array, color: string, width: number, scale: number, life = 0.22): void {
    const g = this.ghosts.acquire();
    g.joints.set(joints); g.color = color; g.width = width; g.scale = scale; g.life = 0; g.max = life;
  }

  text(text: string, x: number, y: number, color: string, size: number, life = 0.85, outline = '#000'): void {
    const t = this.texts.acquire();
    t.text = text; t.x = x + fxRng.range(-10, 10); t.y = y; t.vy = -150 - size * 2; t.vx = fxRng.range(-30, 30);
    t.life = 0; t.max = life; t.color = color; t.size = size; t.outline = outline;
  }

  update(dt: number): void {
    const ps = this.parts;
    for (let i = ps.count - 1; i >= 0; i--) {
      const p = ps.items[i];
      p.life += dt;
      if (p.life >= p.max) { ps.releaseAt(i); continue; }
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.kind === PK.debris && p.y > WORLD.groundY) { p.y = WORLD.groundY; p.vy *= -0.35; p.vx *= 0.6; }
    }
    const gs = this.ghosts;
    for (let i = gs.count - 1; i >= 0; i--) {
      const g = gs.items[i];
      g.life += dt;
      if (g.life >= g.max) gs.releaseAt(i);
    }
    const ts = this.texts;
    for (let i = ts.count - 1; i >= 0; i--) {
      const t = ts.items[i];
      t.life += dt;
      if (t.life >= t.max) { ts.releaseAt(i); continue; }
      t.vy += 420 * dt;
      t.y += t.vy * dt; t.x += t.vx * dt;
    }
    this.screenFlash = Math.max(0, this.screenFlash - dt * 6);
    this.invert = Math.max(0, this.invert - dt);
    for (let i = 0; i < 6; i++) if (this.slT[i] > 0) this.slT[i] += dt;
    this.hurtVignette = Math.max(0, this.hurtVignette - dt * 2.2);
  }

  clear(): void { this.parts.clear(); this.ghosts.clear(); this.texts.clear(); this.screenFlash = 0; this.hurtVignette = 0; this.invert = 0; this.slT.fill(0); }

  // ---------------- drawing (world space) ----------------
  drawGhosts(ctx: CanvasRenderingContext2D): void {
    const gs = this.ghosts;
    if (gs.count === 0) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < gs.count; i++) {
      const g = gs.items[i];
      const k = 1 - g.life / g.max;
      ctx.globalAlpha = k * 0.3;
      ctx.strokeStyle = g.color;
      ctx.lineWidth = g.width * g.scale;
      const jn = g.joints;
      ctx.beginPath();
      seg(ctx, jn, J.hip, J.chest); seg(ctx, jn, J.chest, J.neck);
      seg(ctx, jn, J.shA, J.elbA); seg(ctx, jn, J.elbA, J.handA);
      seg(ctx, jn, J.shB, J.elbB); seg(ctx, jn, J.elbB, J.handB);
      seg(ctx, jn, J.hipA, J.kneeA); seg(ctx, jn, J.kneeA, J.footA);
      seg(ctx, jn, J.hipB, J.kneeB); seg(ctx, jn, J.kneeB, J.footB);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(jn[J.head * 2], jn[J.head * 2 + 1], RIG.headR * g.scale * 0.95, 0, TAU);
      ctx.fillStyle = g.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  drawParticles(ctx: CanvasRenderingContext2D, additivePass: boolean): void {
    const ps = this.parts;
    ctx.globalCompositeOperation = additivePass ? 'lighter' : 'source-over';
    ctx.lineCap = 'round';
    for (let i = 0; i < ps.count; i++) {
      const p = ps.items[i];
      if (p.additive !== additivePass) continue;
      const k = p.life / p.max;
      const inv = 1 - k;
      switch (p.kind) {
        case PK.spark: {
          ctx.globalAlpha = inv;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * inv + 0.5;
          const l = 0.035;
          ctx.beginPath();
          ctx.moveTo(p.x - p.vx * l, p.y - p.vy * l);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          break;
        }
        case PK.dot: case PK.ember: {
          ctx.globalAlpha = inv;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (p.kind === PK.ember ? inv : 1), 0, TAU);
          ctx.fill();
          break;
        }
        case PK.ring: {
          ctx.globalAlpha = inv * 0.9;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2 + 6 * inv;
          const r = p.size + (p.size2 - p.size) * (1 - inv * inv);
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
          break;
        }
        case PK.shock: {
          ctx.globalAlpha = inv * 0.85;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 + 10 * inv;
          const r = p.size + (p.size2 - p.size) * (1 - inv * inv * inv);
          ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.22, 0, 0, TAU); ctx.stroke();
          break;
        }
        case PK.star: {
          const grow = k < 0.25 ? k / 0.25 : 1;
          const s = p.size * (0.5 + grow * 0.6);
          ctx.globalAlpha = Math.min(1, inv * 1.6);
          ctx.fillStyle = p.color;
          drawStar(ctx, p.x, p.y, s, s * 0.22, p.size2 | 0, p.rot);
          ctx.fillStyle = '#ffffff';
          drawStar(ctx, p.x, p.y, s * 0.55, s * 0.12, p.size2 | 0, p.rot + 0.3);
          break;
        }
        case PK.flash: {
          ctx.globalAlpha = inv * 0.8;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + k * 0.6), 0, TAU); ctx.fill();
          break;
        }
        case PK.dust: {
          ctx.globalAlpha = inv * 0.55;
          ctx.fillStyle = p.color;
          const r = p.size + (p.size2 - p.size) * k;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
          break;
        }
        case PK.debris: {
          ctx.globalAlpha = Math.min(1, inv * 2);
          ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Ink look: handwritten, stepped floating text (set by the Game each frame). */
  paperText = false;

  drawTexts(ctx: CanvasRenderingContext2D): void {
    const ts = this.texts;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (let i = 0; i < ts.count; i++) {
      const t = ts.items[i];
      const k = t.life / t.max;
      if (this.paperText) {
        // Handwritten numbers with a stepped bounce (3 drawings), ink on paper; blink out instead of fading.
        const kq = Math.floor(k * 12) / 12;
        if (kq > 0.8 && Math.floor(k * 24) % 2) continue;
        const pop = kq < 0.09 ? 1.35 : kq < 0.18 ? 0.9 : 1;
        const size = Math.round(t.size * pop * 1.05);
        ctx.font = `${size}px "Patrick Hand", "Comic Sans MS", cursive`;
        ctx.lineWidth = Math.max(3, size * 0.18);
        ctx.strokeStyle = '#fbf8f0';
        ctx.strokeText(t.text, t.x, t.y - (kq < 0.09 ? 6 : 0));
        ctx.fillStyle = PAPER_INK[t.color] ?? t.color;
        ctx.fillText(t.text, t.x, t.y - (kq < 0.09 ? 6 : 0));
        continue;
      }
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.7 : k < 0.22 ? 1.3 - ((k - 0.12) / 0.1) * 0.3 : 1;
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const size = Math.round(t.size * pop);
      ctx.font = `900 italic ${size}px system-ui, sans-serif`;
      ctx.lineWidth = Math.max(3, size * 0.16);
      ctx.strokeStyle = t.outline;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}

function seg(ctx: CanvasRenderingContext2D, jn: Float32Array, a: number, b: number): void {
  ctx.moveTo(jn[a * 2], jn[a * 2 + 1]);
  ctx.lineTo(jn[b * 2], jn[b * 2 + 1]);
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r1: number, r2: number, n: number, rot: number): void {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    // stretch spikes along the hit direction for an anime look
    const a = rot + (i * Math.PI) / n;
    const stretch = 0.65 + 0.55 * Math.abs(Math.cos(a - rot));
    const r = (i & 1) === 0 ? r1 * stretch : r2;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

export const effects = new Effects();

/** Neon text colours -> pen colours on paper. */
const PAPER_INK: Record<string, string> = {
  '#ffffff': '#1b1a17', '#ffe14a': '#d42a2a', '#c9b6ff': '#2f55c8', '#7dff8a': '#2f55c8', '#6fe3ff': '#2f55c8', '#ff9af0': '#d42a2a',
};
