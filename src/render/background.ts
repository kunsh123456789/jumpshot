import { WORLD } from '../data/tuning';
import { Rng, fxRng } from '../core/rng';
import type { Camera } from '../core/camera';

export type ArenaId = 'dojo' | 'rooftop' | 'neon' | 'volcano';
export const ARENA_ORDER: ArenaId[] = ['dojo', 'rooftop', 'neon', 'volcano'];

interface Layer { canvas: HTMLCanvasElement; factor: number; y: number }
interface Arena {
  sky: [string, string, string];
  floor: [string, string];
  line: string;
  layers: Layer[];
  ambient: { color: string; rate: number; vy: number; vx: number; size: number; glow: boolean };
  skyGrad?: CanvasGradient;
  floorGrad?: CanvasGradient;
}

const LAYER_W = 2400;
const LAYER_H = 520;

function mk(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = LAYER_W; c.height = LAYER_H;
  return [c, c.getContext('2d')!];
}

function buildDojo(): Arena {
  const r = new Rng(11);
  const [far, f] = mk();
  // paper screens with wooden frames
  for (let x = 0; x < LAYER_W; x += 220) {
    f.fillStyle = '#3a2a22'; f.fillRect(x, 120, 200, 400);
    f.fillStyle = '#e8d6b0'; f.globalAlpha = 0.16; f.fillRect(x + 10, 130, 180, 380); f.globalAlpha = 1;
    f.strokeStyle = '#2a1c16'; f.lineWidth = 5;
    for (let gx = 1; gx < 4; gx++) { f.beginPath(); f.moveTo(x + 10 + gx * 45, 130); f.lineTo(x + 10 + gx * 45, 510); f.stroke(); }
    for (let gy = 1; gy < 6; gy++) { f.beginPath(); f.moveTo(x + 10, 130 + gy * 64); f.lineTo(x + 190, 130 + gy * 64); f.stroke(); }
  }
  f.fillStyle = '#21150f'; f.fillRect(0, 90, LAYER_W, 40);
  const [near, n] = mk();
  for (let x = 80; x < LAYER_W; x += 600) {
    n.fillStyle = '#1a100c'; n.fillRect(x, 0, 46, LAYER_H);
    // lantern
    n.fillStyle = '#ff9a40'; n.globalAlpha = 0.18;
    n.beginPath(); n.arc(x + 200, 150, 70, 0, Math.PI * 2); n.fill();
    n.globalAlpha = 1; n.fillStyle = '#ffb060';
    n.beginPath(); n.ellipse(x + 200, 150, 20, 28, 0, 0, Math.PI * 2); n.fill();
    n.strokeStyle = '#1a100c'; n.lineWidth = 3; n.beginPath(); n.moveTo(x + 200, 0); n.lineTo(x + 200, 122); n.stroke();
  }
  void r;
  return {
    sky: ['#2a1a14', '#3c271c', '#4a3022'], floor: ['#5a3b26', '#2e1d13'], line: '#9a6a44',
    layers: [{ canvas: far, factor: 0.35, y: -40 }, { canvas: near, factor: 0.7, y: -60 }],
    ambient: { color: '#ffd9a0', rate: 6, vy: -8, vx: 6, size: 2, glow: true },
  };
}

function skyline(ctx: CanvasRenderingContext2D, r: Rng, base: number, minH: number, maxH: number, color: string, windows: string | null, wProb: number): void {
  let x = 0;
  while (x < LAYER_W) {
    const w = r.range(70, 180), h = r.range(minH, maxH);
    ctx.fillStyle = color;
    ctx.fillRect(x, base - h, w, h + 400);
    if (r.chance(0.3)) ctx.fillRect(x + w * 0.4, base - h - r.range(20, 60), 4, 60);
    if (windows) {
      ctx.fillStyle = windows;
      for (let wy = base - h + 14; wy < base - 10; wy += 22) {
        for (let wx = x + 10; wx < x + w - 12; wx += 18) {
          if (r.chance(wProb)) ctx.fillRect(wx, wy, 8, 10);
        }
      }
    }
    x += w + r.range(4, 30);
  }
}

function buildRooftop(): Arena {
  const r = new Rng(22);
  const [far, f] = mk();
  // stars + moon
  for (let i = 0; i < 180; i++) { f.fillStyle = `rgba(255,255,255,${r.range(0.2, 0.8)})`; f.fillRect(r.range(0, LAYER_W), r.range(0, 260), 2, 2); }
  f.fillStyle = 'rgba(220,230,255,0.12)'; f.beginPath(); f.arc(1500, 120, 110, 0, Math.PI * 2); f.fill();
  f.fillStyle = '#dfe6ff'; f.beginPath(); f.arc(1500, 120, 52, 0, Math.PI * 2); f.fill();
  skyline(f, r, 470, 120, 280, '#141a33', 'rgba(255,220,140,0.35)', 0.25);
  const [near, n] = mk();
  skyline(n, r, 500, 60, 170, '#0b0f22', 'rgba(255,240,180,0.55)', 0.18);
  return {
    sky: ['#070a1c', '#141a3c', '#2a2350'], floor: ['#2b2f44', '#11131f'], line: '#5a6290',
    layers: [{ canvas: far, factor: 0.25, y: -60 }, { canvas: near, factor: 0.55, y: -40 }],
    ambient: { color: '#9fb4ff', rate: 18, vy: 260, vx: -90, size: 1.2, glow: false },
  };
}

function buildNeon(): Arena {
  const r = new Rng(33);
  const [far, f] = mk();
  skyline(f, r, 470, 160, 360, '#1a0f33', 'rgba(255,80,220,0.35)', 0.2);
  const [near, n] = mk();
  skyline(n, r, 500, 80, 220, '#0d0820', null, 0);
  const cols = ['#ff3df0', '#3dfff2', '#ffe23d', '#7a5bff'];
  for (let i = 0; i < 16; i++) {
    const x = r.range(0, LAYER_W), y = r.range(260, 420), w = r.range(60, 160), h = r.range(18, 40);
    const c = r.pick(cols);
    n.globalAlpha = 0.25; n.fillStyle = c; n.fillRect(x - 10, y - 10, w + 20, h + 20);
    n.globalAlpha = 1; n.strokeStyle = c; n.lineWidth = 4; n.strokeRect(x, y, w, h);
  }
  return {
    sky: ['#12052a', '#2c0b4a', '#5a1460'], floor: ['#25123d', '#0d0618'], line: '#ff3df0',
    layers: [{ canvas: far, factor: 0.3, y: -50 }, { canvas: near, factor: 0.6, y: -40 }],
    ambient: { color: '#ff7af5', rate: 8, vy: -20, vx: 10, size: 2, glow: true },
  };
}

function buildVolcano(): Arena {
  const r = new Rng(44);
  const [far, f] = mk();
  f.fillStyle = '#2a0b08';
  f.beginPath(); f.moveTo(0, 520);
  for (let x = 0; x <= LAYER_W; x += 60) f.lineTo(x, 300 - Math.abs(Math.sin(x * 0.0021)) * 180 + r.range(-20, 20));
  f.lineTo(LAYER_W, 520); f.fill();
  f.fillStyle = 'rgba(255,90,20,0.35)';
  for (let i = 0; i < 6; i++) { const x = r.range(0, LAYER_W); f.fillRect(x, 200, r.range(3, 8), 320); }
  const [near, n] = mk();
  n.fillStyle = '#160403';
  n.beginPath(); n.moveTo(0, 520);
  for (let x = 0; x <= LAYER_W; x += 40) n.lineTo(x, 420 - r.range(0, 120));
  n.lineTo(LAYER_W, 520); n.fill();
  return {
    sky: ['#1a0302', '#4a0d05', '#a8300c'], floor: ['#3a1208', '#140503'], line: '#ff6a2a',
    layers: [{ canvas: far, factor: 0.3, y: -40 }, { canvas: near, factor: 0.6, y: -30 }],
    ambient: { color: '#ff8a3a', rate: 22, vy: -70, vx: 20, size: 2.4, glow: true },
  };
}

const AMB_N = 90;

export class Background {
  private arenas = new Map<ArenaId, Arena>();
  current: ArenaId = 'dojo';
  private ax = new Float32Array(AMB_N); private ay = new Float32Array(AMB_N);
  private al = new Float32Array(AMB_N); private ap = new Float32Array(AMB_N);
  private spawnAcc = 0;
  private lavaT = 0;

  set(id: ArenaId): void {
    this.current = id;
    for (let i = 0; i < AMB_N; i++) this.al[i] = 0;
  }

  private get(id: ArenaId): Arena {
    let a = this.arenas.get(id);
    if (!a) {
      a = id === 'dojo' ? buildDojo() : id === 'rooftop' ? buildRooftop() : id === 'neon' ? buildNeon() : buildVolcano();
      this.arenas.set(id, a);
    }
    return a;
  }

  /** Pre-build all arenas (avoids hitching mid-run). */
  preload(): void { for (const id of ARENA_ORDER) this.get(id); }

  update(dt: number, cam: Camera): void {
    const a = this.get(this.current);
    this.lavaT += dt;
    this.spawnAcc += dt * a.ambient.rate;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      for (let i = 0; i < AMB_N; i++) {
        if (this.al[i] <= 0) {
          this.ax[i] = cam.viewLeft() + fxRng.range(-100, 1500);
          this.ay[i] = a.ambient.vy > 0 ? WORLD.groundY - 560 : WORLD.groundY + fxRng.range(-200, 40);
          if (a.ambient.vy < 0 && a.ambient.vy > -30) this.ay[i] = WORLD.groundY - fxRng.range(0, 420);
          this.al[i] = fxRng.range(2, 6);
          this.ap[i] = fxRng.range(0, 10);
          break;
        }
      }
    }
    for (let i = 0; i < AMB_N; i++) {
      if (this.al[i] <= 0) continue;
      this.al[i] -= dt;
      this.ax[i] += (a.ambient.vx + Math.sin(this.ap[i] + this.lavaT) * 12) * dt;
      this.ay[i] += a.ambient.vy * dt;
      if (this.ay[i] > WORLD.groundY + 40) this.al[i] = 0;
    }
  }

  /** Draw in view space (logical 1280x720 transform already applied). */
  drawSky(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const a = this.get(this.current);
    if (!a.skyGrad) {
      const g = ctx.createLinearGradient(0, 0, 0, WORLD.viewH);
      g.addColorStop(0, a.sky[0]); g.addColorStop(0.55, a.sky[1]); g.addColorStop(1, a.sky[2]);
      a.skyGrad = g;
    }
    ctx.fillStyle = a.skyGrad;
    ctx.fillRect(-40, -40, WORLD.viewW + 80, WORLD.viewH + 80);
    const z = cam.effectiveZoom();
    for (const l of a.layers) {
      const lz = 1 + (z - 1) * l.factor;
      const off = -((cam.x * l.factor) % LAYER_W);
      const y = WORLD.groundScreenY - (LAYER_H + l.y) * lz + (cam.y - WORLD.groundY) * -0.2 * z;
      const w = LAYER_W * lz;
      const x0 = WORLD.viewW / 2 + (off - WORLD.viewW / 2) * lz;
      for (let x = x0 - w; x < WORLD.viewW + w; x += w) ctx.drawImage(l.canvas, x, y, w, LAYER_H * lz);
    }
  }

  /** Floor + ambient particles in world space. */
  drawFloor(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const a = this.get(this.current);
    const left = cam.viewLeft() - 50, right = cam.viewRight() + 50;
    if (!a.floorGrad) {
      const g = ctx.createLinearGradient(0, WORLD.groundY, 0, WORLD.groundY + 380);
      g.addColorStop(0, a.floor[0]); g.addColorStop(1, a.floor[1]);
      a.floorGrad = g;
    }
    ctx.fillStyle = a.floorGrad;
    ctx.fillRect(left, WORLD.groundY, right - left, 1600);
    // floor perspective lines
    ctx.strokeStyle = a.line;
    ctx.globalAlpha = 0.14;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = Math.floor(left / 120) * 120; x < right; x += 120) {
      ctx.moveTo(x, WORLD.groundY); ctx.lineTo(x + (x - cam.x) * 0.6, WORLD.groundY + 300);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(left, WORLD.groundY); ctx.lineTo(right, WORLD.groundY); ctx.stroke();
    ctx.globalAlpha = 1;
    if (this.current === 'volcano') {
      const p = 0.15 + 0.08 * Math.sin(this.lavaT * 2);
      ctx.fillStyle = `rgba(255,90,20,${p})`;
      ctx.fillRect(left, WORLD.groundY + 40, right - left, 1500);
    }
    // walls
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-400, -1000, 400 + WORLD.wallMargin * 0.3, 2000);
    ctx.fillRect(WORLD.arenaW - WORLD.wallMargin * 0.3, -1000, 400, 2000);
    ctx.strokeStyle = a.line; ctx.globalAlpha = 0.6; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(WORLD.wallMargin * 0.3, -1000); ctx.lineTo(WORLD.wallMargin * 0.3, WORLD.groundY);
    ctx.moveTo(WORLD.arenaW - WORLD.wallMargin * 0.3, -1000); ctx.lineTo(WORLD.arenaW - WORLD.wallMargin * 0.3, WORLD.groundY);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawAmbient(ctx: CanvasRenderingContext2D): void {
    const a = this.get(this.current);
    const amb = a.ambient;
    if (amb.glow) ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = amb.color;
    ctx.strokeStyle = amb.color;
    for (let i = 0; i < AMB_N; i++) {
      if (this.al[i] <= 0) continue;
      ctx.globalAlpha = Math.min(1, this.al[i]) * 0.6;
      if (amb.vy > 100) {
        ctx.lineWidth = amb.size;
        ctx.beginPath(); ctx.moveTo(this.ax[i], this.ay[i]); ctx.lineTo(this.ax[i] + amb.vx * 0.04, this.ay[i] + amb.vy * 0.04); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(this.ax[i], this.ay[i], amb.size, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
