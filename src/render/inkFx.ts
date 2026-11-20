import type { World } from '../sim/world';
import type { Fighter } from '../sim/fighter';
import { J, JOINT_N, POSE_N, computeJoints, lerpPose } from './rig';
import { TAU } from '../core/math';
import { WORLD } from '../data/tuning';
import { PROJECTILE } from '../data/enemies';
import { INKFX } from '../data/inkLook';
import { DRAW } from './drawStyle';
import { INK, inkColor, inkHooks, burst } from './ink';
import { settings } from '../core/settings';
import { weaponById } from '../data/weapons';

/**
 * Hand-drawn FX for the ink look (revision pass 5, step 5), all pooled
 * (struct-of-arrays, no per-frame allocation) and advanced on the drawing
 * step so they move in the same held rhythm as the figures:
 *  - impact specks, starburst strokes, victim-colour splatter
 *  - persistent floor damage (cracks + debris marks) that accumulates during
 *    a wave and clears when the next wave starts
 *  - scribble energy: chaotic looping fills that break into drifting fragments
 *  - scribble-hatch smears for the fighters (via inkHooks.smear)
 *  - ink versions of projectiles, ground waves, meteors and pickups
 */

let seed = 1;
const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) | 0) >>> 8) / 16777216;

// ------------------------------------------------------------ particles
const PN = 700;
const pX = new Float32Array(PN), pY = new Float32Array(PN), pVX = new Float32Array(PN), pVY = new Float32Array(PN);
const pLife = new Float32Array(PN), pMax = new Float32Array(PN), pSize = new Float32Array(PN), pAng = new Float32Array(PN);
const pKind = new Uint8Array(PN); // 0 speck, 1 stroke, 2 fragment (curl)
const pCol = new Uint8Array(PN); // 0 ink, 1 blue, 2 red
const COLS = [INK.ink, INK.blue, INK.red];
let pHead = 0;

function colIdx(c: string): number { return c === INK.blue ? 1 : c === INK.red ? 2 : 0; }

function spawn(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number, col: number, ang = 0): void {
  const i = pHead; pHead = (pHead + 1) % PN;
  pX[i] = x; pY[i] = y; pVX[i] = vx; pVY[i] = vy; pLife[i] = life; pMax[i] = life; pSize[i] = size; pKind[i] = kind; pCol[i] = col; pAng[i] = ang;
}

// ------------------------------------------------------------ floor marks (persistent)
const FN = 260;
const fX = new Float32Array(FN), fSize = new Float32Array(FN), fSeed = new Int32Array(FN);
let fHead = 0, fCount = 0;

// ------------------------------------------------------------ scribble bursts
const SN = 16;
const sX = new Float32Array(SN), sY = new Float32Array(SN), sR = new Float32Array(SN), sT = new Float32Array(SN), sMax = new Float32Array(SN);
const sSeed = new Int32Array(SN), sCol = new Uint8Array(SN), sOn = new Uint8Array(SN);
let sHead = 0;

export class InkFx {
  private acc = 0;
  private stepClock = 0;

  bind(w: World): void {
    const ev = w.events;
    ev.on('hit', (e) => {
      if (!DRAW.ink) return;
      const v = e.victim;
      const heavy = e.weight >= 0.7 || e.kind === 'launch' || e.kind === 'spike' || e.kind === 'finisher';
      const c = colIdx(inkColor(v));
      this.impact(e.x, e.y, e.dirX, e.dirY, e.weight, c, e.attacker.team === 'player' ? 0 : 2);
      if (heavy && v.y > WORLD.groundY - 120) this.floorMark(v.x, 0.6 + e.weight * 0.6, 4);
      if (e.kind === 'finisher') this.scribble(e.x, e.y, 120, 2);
    });
    ev.on('groundImpact', (e) => { if (DRAW.ink && e.power > 0.25) this.floorMark(e.x, 0.5 + e.power * 1.2, Math.round(4 + e.power * 10)); });
    ev.on('wallImpact', (e) => { if (DRAW.ink) for (let i = 0; i < 10; i++) spawn(0, e.x, e.y + (rnd() - 0.5) * 60, -e.dir * (80 + rnd() * 220), -rnd() * 260, 0.6, 2, 0); });
    ev.on('ko', (e) => { if (DRAW.ink) { this.splatter(e.x, e.y, colIdx(inkColor(e.victim)), 22); this.floorMark(e.x, 1.1, 8); } });
    ev.on('shockwave', (e) => { if (DRAW.ink) this.scribble(e.x, e.y - 30, Math.min(140, e.radius * 0.5), e.color === '#ff4040' || e.color === '#ff3030' ? 2 : 0); });
    ev.on('finisher', (e) => { if (DRAW.ink) this.scribble(e.x, e.y, 150, 2); });
    ev.on('meteor', (e) => { if (DRAW.ink) { this.scribble(e.x, WORLD.groundY - 40, 110, 2); this.floorMark(e.x, 1.8, 14); } });
    ev.on('parry', (e) => { if (DRAW.ink) for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; spawn(1, e.x, e.y, Math.cos(a) * 420, Math.sin(a) * 420, 0.25, 14, 0, a); } });
    ev.on('playerHurt', (e) => { if (DRAW.ink) this.splatter(e.x, e.y, 0, 10); });
    ev.on('waveStart', () => this.clearFloor());
  }

  /** Starburst strokes + specks + splatter in the victim's colour. */
  impact(x: number, y: number, dx: number, dy: number, weight: number, victimCol: number, strokeCol: number): void {
    const n = 5 + Math.round(weight * 7);
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dy, dx) + (rnd() - 0.5) * 2.6;
      const sp = 260 + rnd() * 520 * (0.6 + weight);
      spawn(1, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.12 + rnd() * 0.1, 8 + rnd() * 10 + weight * 8, strokeCol, a);
    }
    for (let i = 0; i < 6 + weight * 10; i++) {
      const a = Math.atan2(dy, dx) + (rnd() - 0.5) * 2.2;
      const sp = 120 + rnd() * 480;
      spawn(0, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 120, 0.4 + rnd() * 0.5, 1.5 + rnd() * 1.5, 0);
    }
    this.splatter(x, y, victimCol, 5 + Math.round(weight * 8));
  }

  /** Pixels in the victim's colour flung out (reference 87-89). */
  splatter(x: number, y: number, col: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, sp = 80 + rnd() * 380;
      spawn(0, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 160, 0.5 + rnd() * 0.6, 1.5 + rnd() * 2.5, col);
    }
  }

  /** A crack/debris mark on the floor; size ~0.5-2. Also kicks up speck debris. */
  floorMark(x: number, size: number, debris: number): void {
    const i = fHead; fHead = (fHead + 1) % FN; if (fCount < FN) fCount++;
    fX[i] = x + (rnd() - 0.5) * 20; fSize[i] = size; fSeed[i] = (rnd() * 1e9) | 0;
    for (let k = 0; k < debris; k++) spawn(0, x + (rnd() - 0.5) * 40, WORLD.groundY - 2, (rnd() - 0.5) * 360, -120 - rnd() * 380 * size, 0.5 + rnd() * 0.4, 1.5 + rnd() * 1.5, 0);
  }

  /** Scribble energy: a chaotic looping mass that breaks into drifting fragments. */
  scribble(x: number, y: number, r: number, col: number): void {
    const i = sHead; sHead = (sHead + 1) % SN;
    sX[i] = x; sY[i] = y; sR[i] = r; sT[i] = 0; sMax[i] = INKFX.scribbleSec; sSeed[i] = (rnd() * 1e9) | 0; sCol[i] = col; sOn[i] = 1;
  }

  clearFloor(): void { fCount = 0; fHead = 0; }

  /** Advance on the drawing step (Hand-Drawn) or every frame (Smooth). */
  update(dt: number): void {
    this.acc += dt;
    const step = DRAW.stepped ? DRAW.stepTicks / 60 : 0;
    if (step > 0 && this.acc < step) return;
    const h = step > 0 ? this.acc : dt;
    this.acc = 0;
    this.stepClock++;
    for (let i = 0; i < PN; i++) {
      if (pLife[i] <= 0) continue;
      pLife[i] -= h;
      pX[i] += pVX[i] * h; pY[i] += pVY[i] * h;
      if (pKind[i] === 0 || pKind[i] === 2) {
        pVY[i] += 1400 * h;
        if (pY[i] > WORLD.groundY - 1 && pVY[i] > 0) { pY[i] = WORLD.groundY - 1; pVY[i] *= -0.25; pVX[i] *= 0.5; }
      } else { pVX[i] *= 0.6; pVY[i] *= 0.6; }
    }
    for (let i = 0; i < SN; i++) {
      if (!sOn[i]) continue;
      sT[i] += h;
      if (sT[i] >= sMax[i]) {
        // Break into drifting fragments (reference 54-56).
        sOn[i] = 0;
        seed = sSeed[i];
        for (let k = 0; k < INKFX.fragments; k++) {
          const a = rnd() * TAU, d = rnd() * sR[i];
          spawn(2, sX[i] + Math.cos(a) * d, sY[i] + Math.sin(a) * d * 0.7, Math.cos(a) * (40 + rnd() * 160), -60 - rnd() * 160, 0.5 + rnd() * 0.5, 6 + rnd() * 10, sCol[i], rnd() * TAU);
        }
      }
    }
  }

  /** Floor damage, under the figures. */
  drawFloor(ctx: CanvasRenderingContext2D, wpp: number): void {
    if (fCount === 0) return;
    const G = WORLD.groundY;
    ctx.strokeStyle = INK.ink;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5 * wpp;
    ctx.beginPath();
    for (let i = 0; i < fCount; i++) {
      seed = fSeed[i];
      const s = fSize[i], x = fX[i];
      const n = 3 + Math.round(s * 5);
      for (let k = 0; k < n; k++) {
        // scratchy V and slash marks hugging the floor line, above and below it
        const x0 = x + (rnd() - 0.5) * 50 * s;
        const up = rnd() < 0.45;
        const l = (5 + rnd() * 12) * s;
        const a = (up ? -1 : 1) * (0.5 + rnd() * 1.1) * (rnd() < 0.5 ? 1 : -1);
        const y0 = G + (up ? -1 : 1) * rnd() * 2;
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + Math.sin(a) * l, y0 + Math.cos(a) * l * (up ? -0.7 : 0.9));
        if (rnd() < 0.4) { ctx.moveTo(x0 + 3, y0); ctx.lineTo(x0 + 3 + Math.sin(-a) * l * 0.6, y0 + Math.cos(a) * l * 0.5 * (up ? -0.7 : 0.9)); }
      }
    }
    ctx.stroke();
    // a few debris dots sitting on the floor
    ctx.fillStyle = INK.ink;
    for (let i = 0; i < fCount; i++) {
      seed = fSeed[i] ^ 0x5bd1e995;
      for (let k = 0; k < 2 + fSize[i] * 2; k++) ctx.fillRect(fX[i] + (rnd() - 0.5) * 70 * fSize[i], G - 3 * wpp - rnd() * 3, 1.5 * wpp, 1.5 * wpp);
    }
  }

  /** Particles and scribble energy, over the figures. */
  drawFront(ctx: CanvasRenderingContext2D, wpp: number): void {
    ctx.lineCap = 'round';
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = COLS[c]; ctx.strokeStyle = COLS[c];
      ctx.lineWidth = 2 * wpp;
      ctx.beginPath();
      for (let i = 0; i < PN; i++) {
        if (pLife[i] <= 0 || pCol[i] !== c) continue;
        const k = pKind[i];
        if (k === 1) {
          const l = pSize[i] * (pLife[i] / pMax[i] + 0.3);
          ctx.moveTo(pX[i], pY[i]); ctx.lineTo(pX[i] - Math.cos(pAng[i]) * l, pY[i] - Math.sin(pAng[i]) * l);
        } else if (k === 2) {
          const r = pSize[i] * 0.5, a = pAng[i] + (pMax[i] - pLife[i]) * 4;
          ctx.moveTo(pX[i] + Math.cos(a) * r, pY[i] + Math.sin(a) * r);
          ctx.quadraticCurveTo(pX[i], pY[i] - r, pX[i] - Math.cos(a) * r, pY[i] - Math.sin(a) * r);
        }
      }
      ctx.stroke();
      for (let i = 0; i < PN; i++) {
        if (pLife[i] <= 0 || pCol[i] !== c || pKind[i] !== 0) continue;
        const s = pSize[i] * wpp * 0.75;
        ctx.fillRect(pX[i] - s / 2, pY[i] - s / 2, s, s);
      }
    }
    for (let i = 0; i < SN; i++) if (sOn[i]) this.drawScribble(ctx, i, wpp);
  }

  /** Chaotic looping arcs, filled in the colour, re-drawn per step (boiling). */
  private drawScribble(ctx: CanvasRenderingContext2D, i: number, wpp: number): void {
    const k = sT[i] / sMax[i];
    const R = sR[i] * (0.45 + 0.55 * Math.min(1, k * 3));
    seed = sSeed[i] + this.stepClock * 7919;
    const col = COLS[sCol[i]];
    // fill blobs
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let b = 0; b < 5; b++) {
      const a = rnd() * TAU, d = rnd() * R * 0.5, r = R * (0.25 + rnd() * 0.3);
      ctx.moveTo(sX[i] + Math.cos(a) * d + r, sY[i] + Math.sin(a) * d * 0.75);
      ctx.ellipse(sX[i] + Math.cos(a) * d, sY[i] + Math.sin(a) * d * 0.75, r, r * 0.75, rnd(), 0, TAU);
    }
    ctx.fill();
    // looping scribble lines in ink
    ctx.strokeStyle = INK.ink;
    ctx.lineWidth = 1.5 * wpp;
    ctx.beginPath();
    let x = sX[i] + (rnd() - 0.5) * R, y = sY[i] + (rnd() - 0.5) * R * 0.7;
    ctx.moveTo(x, y);
    for (let s = 0; s < INKFX.scribbleLoops; s++) {
      const cx = sX[i] + (rnd() - 0.5) * 2 * R, cy = sY[i] + (rnd() - 0.5) * 1.5 * R;
      const nx = sX[i] + (rnd() - 0.5) * 2 * R, ny = sY[i] + (rnd() - 0.5) * 1.4 * R;
      ctx.quadraticCurveTo(cx, cy, nx, ny);
      x = nx; y = ny;
    }
    ctx.stroke();
    // spiky rim strokes
    burst(ctx, sX[i], sY[i], R * 1.15, 14, sSeed[i] + this.stepClock, INK.ink, 1.5 * wpp);
  }
}
export const inkFx = new InkFx();

// ------------------------------------------------------------ weapon crescent smears
const CS = 10;
const cBX = new Float32Array(CS), cBY = new Float32Array(CS), cTX = new Float32Array(CS), cTY = new Float32Array(CS);
const seg4 = new Float32Array(4);
/**
 * Weapon crescent (reference frames 2-30): the area the weapon itself swept
 * between the previous drawing and this one, filled with dense hatch strokes
 * running from the grip to the tip, with a heavy outer edge. Thins out over
 * the smear chain like the limb smears.
 */
function weaponCrescent(ctx: CanvasRenderingContext2D, f: Fighter, j: Float32Array, col: string, wpp: number): void {
  const wd = weaponById(f.weapon);
  if (wd.sweep) { crescent(ctx, f, j, col, wpp, wd.sweep, 0); return; }
  // Limb crescents (Fists Reference v2): the swept area from the elbow/knee to past the fist/foot.
  if (!f.anim.smearCfg.crescent) return;
  for (const [bit, endJ, midJ] of LIMBS) {
    if (!(f.anim.dSmear & bit)) continue;
    limbEnd = endJ; limbMid = midJ;
    crescent(ctx, f, j, col, wpp, limbSeg, bit);
  }
}
let limbEnd = 0, limbMid = 0;
function limbSeg(jj: Float32Array, _s: number, out: Float32Array): void {
  const ex = jj[limbEnd * 2], ey = jj[limbEnd * 2 + 1], mx = jj[limbMid * 2], my = jj[limbMid * 2 + 1];
  out[0] = mx; out[1] = my; out[2] = ex + (ex - mx) * 0.35; out[3] = ey + (ey - my) * 0.35;
}
function crescent(ctx: CanvasRenderingContext2D, f: Fighter, j: Float32Array, col: string, wpp: number, seg: (j: Float32Array, s: number, out: Float32Array) => void, salt: number): void {
  const a = f.anim, sc = f.scale;
  for (let i = 0; i < CS; i++) {
    if (i === CS - 1) seg(j, sc, seg4);
    else { lerpPose(a.arcFrom, a.arcTo, i / (CS - 1), smPose); computeJoints(smPose, a.dX, a.dY, a.dFace, sc, WORLD.groundY, smJ, a.rig); seg(smJ, sc, seg4); }
    cBX[i] = seg4[0]; cBY[i] = seg4[1]; cTX[i] = seg4[2]; cTY[i] = seg4[3];
  }
  const sweep = Math.hypot(cTX[CS - 1] - cTX[0], cTY[CS - 1] - cTY[0]);
  if (sweep < 30 * sc) return;
  const step = a.chainStep;
  const dens = [1, 0.6, 0.35, 0.2][Math.min(3, step)];
  const k0 = step === 0 ? 0 : 0.15 * step;
  seed = a.dSeed ^ 0x9e3779b1 ^ (step * 7919) ^ (salt * 31337);
  ctx.strokeStyle = col; ctx.lineCap = 'round';
  // hatch: radial strokes across the swept band (denser toward the tip, like a brushed crescent)
  const n = Math.round((16 + Math.min(40, sweep / (6 * sc))) * dens);
  ctx.lineWidth = 1.6 * wpp;
  ctx.beginPath();
  for (let s = 0; s < n; s++) {
    const k = k0 + (1 - k0) * rnd();
    const fi = k * (CS - 1), i0 = Math.min(CS - 2, Math.floor(fi)), t = fi - i0;
    const bx = cBX[i0] + (cBX[i0 + 1] - cBX[i0]) * t, by = cBY[i0] + (cBY[i0 + 1] - cBY[i0]) * t;
    const tx = cTX[i0] + (cTX[i0 + 1] - cTX[i0]) * t, ty = cTY[i0] + (cTY[i0 + 1] - cTY[i0]) * t;
    const u0 = 0.35 + rnd() * 0.35, u1 = 0.85 + rnd() * 0.2;
    ctx.moveTo(bx + (tx - bx) * u0, by + (ty - by) * u0);
    ctx.lineTo(bx + (tx - bx) * u1, by + (ty - by) * u1);
  }
  ctx.stroke();
  // heavy outer edge along the tip path (the crescent's rim), thinning with the chain
  ctx.lineWidth = (3.2 - step * 0.7) * wpp;
  ctx.beginPath();
  const i1 = Math.floor(k0 * (CS - 1));
  ctx.moveTo(cTX[i1], cTY[i1]);
  for (let i = i1 + 1; i < CS; i++) ctx.lineTo(cTX[i], cTY[i]);
  ctx.stroke();
}

// ------------------------------------------------------------ scribble-hatch smear chains
const SMP = 8;
const smPose = new Float32Array(POSE_N);
const smJ = new Float32Array(JOINT_N * 2);
const eX = new Float32Array(SMP), eY = new Float32Array(SMP), mX = new Float32Array(SMP), mY = new Float32Array(SMP);
const LIMBS: [number, number, number, number][] = [[1, J.handA, J.elbA, J.shA], [2, J.handB, J.elbB, J.shB], [4, J.footA, J.kneeA, J.hipA], [8, J.footB, J.kneeB, J.hipB]];

/**
 * Smear chain drawing. The arc swept by the striking limb (between the pose
 * before the strike and the latest strike pose, body-local at the current
 * root) is filled with jittered hatch strokes. Chain step 0 (the fastest
 * drawing) is the densest and adds a limb-stretch wedge and a swoosh line;
 * later steps (contact, follow-through) thin out along the same arc so the
 * swing visibly sweeps through and dissipates. Seeded per animation +
 * drawing + step: repeats are identical. Flips/tumbles add a rotating hatch
 * arc around the hips.
 */
inkHooks.smear = (ctx: CanvasRenderingContext2D, f: Fighter, j: Float32Array, col: string, wpp: number): void => {
  const a = f.anim;
  if (a.dSmear && f.team === 'player') weaponCrescent(ctx, f, j, col, wpp);
  const cfg = a.smearCfg;
  const sc = f.scale;
  const step = a.chainStep;
  const dens = cfg.density[Math.min(step, cfg.density.length - 1)];
  const c = cfg.color ?? col;
  if (a.dSmear) {
    for (const [bit, endJ, midJ, rootJ] of LIMBS) {
      if (!(a.dSmear & bit)) continue;
      for (let i = 0; i < SMP; i++) {
        lerpPose(a.arcFrom, a.arcTo, i / (SMP - 1), smPose);
        computeJoints(smPose, a.dX, a.dY, a.dFace, sc, WORLD.groundY, smJ, a.rig);
        eX[i] = smJ[endJ * 2]; eY[i] = smJ[endJ * 2 + 1]; mX[i] = smJ[midJ * 2]; mY[i] = smJ[midJ * 2 + 1];
      }
      if (step === 0 || a.chainLen === 1) { eX[SMP - 1] = j[endJ * 2]; eY[SMP - 1] = j[endJ * 2 + 1]; mX[SMP - 1] = j[midJ * 2]; mY[SMP - 1] = j[midJ * 2 + 1]; }
      const sweep = Math.hypot(eX[SMP - 1] - eX[0], eY[SMP - 1] - eY[0]);
      if (sweep < cfg.minSweep * sc) continue;
      seed = a.dSeed ^ (bit * 2654435761) ^ (step * 40503);
      const n = Math.round((INKFX.smearMin + (INKFX.smearMax - INKFX.smearMin) * Math.min(1, sweep / (120 * sc))) * dens);
      // Later chain steps keep only the older part of the arc (the trail behind the limb).
      const kMin = 1 - cfg.sweep, kMax = step === 0 ? 1 : 1 - step * 0.12;
      ctx.strokeStyle = c;
      ctx.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        ctx.lineWidth = (pass === 0 ? 1.2 : 2.1) * wpp * (step === 0 ? 1 : 0.85);
        ctx.beginPath();
        for (let s = 0; s < n; s++) {
          const k = kMin + (kMax - kMin) * (1 - Math.pow(rnd(), pass === 0 ? 1.0 : 2.4));
          if ((pass === 1) !== (k > 0.6)) continue;
          const fi = k * (SMP - 1), i0 = Math.min(SMP - 2, Math.floor(fi)), t = fi - i0;
          const ex = eX[i0] + (eX[i0 + 1] - eX[i0]) * t, ey = eY[i0] + (eY[i0 + 1] - eY[i0]) * t;
          const mx = mX[i0] + (mX[i0 + 1] - mX[i0]) * t, my = mY[i0] + (mY[i0 + 1] - mY[i0]) * t;
          const u = 0.2 + rnd() * 0.95 * cfg.radius;
          const px = mx + (ex - mx) * u, py = my + (ey - my) * u;
          let tx = eX[i0 + 1] - eX[i0], ty = eY[i0 + 1] - eY[i0];
          const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
          const ang = Math.atan2(ty, tx) + (rnd() - 0.5) * cfg.jitter;
          const l = (6 + rnd() * 14 * cfg.lenJitter) * sc * (0.5 + k);
          ctx.moveTo(px - Math.cos(ang) * l * 0.5, py - Math.sin(ang) * l * 0.5);
          ctx.lineTo(px + Math.cos(ang) * l * 0.5, py + Math.sin(ang) * l * 0.5);
        }
        ctx.stroke();
      }
      // Swoosh: one thin line along the path of the limb end (fastest two drawings).
      if (cfg.swoosh && step <= 1) {
        ctx.lineWidth = 1 * wpp;
        ctx.beginPath();
        ctx.moveTo(eX[0], eY[0]);
        for (let i = 1; i < SMP; i++) ctx.lineTo(eX[i] + (eX[i] - mX[i]) * 0.12, eY[i] + (eY[i] - mY[i]) * 0.12);
        ctx.stroke();
      }
      // Limb stretch: a tapered wedge of hatch fanning from the joint past the end, along the motion.
      if (cfg.stretch && step === 0) {
        const ex = eX[SMP - 1], ey = eY[SMP - 1], mx = mX[SMP - 1], my = mY[SMP - 1];
        const dx = ex - eX[SMP - 3], dy = ey - eY[SMP - 3];
        const dl = Math.hypot(dx, dy) || 1;
        const lx = ex - mx, ly = ey - my, ll = Math.hypot(lx, ly) || 1;
        ctx.lineWidth = 1.2 * wpp;
        ctx.beginPath();
        for (let w = 0; w < 6; w++) {
          const v = w / 5;
          const ox = mx + lx * (0.4 + 0.6 * v), oy = my + ly * (0.4 + 0.6 * v);
          const ext = (8 + 18 * v) * sc;
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + (lx / ll) * ext * 0.6 + (dx / dl) * ext * 0.5, oy + (ly / ll) * ext * 0.6 + (dy / dl) * ext * 0.5);
        }
        ctx.stroke();
      }
      // Flurry: ghost arms fanned around the punch ("a hundred fists").
      if (cfg.multiArm > 0 && bit <= 2) {
        const rx = j[rootJ * 2], ry = j[rootJ * 2 + 1];
        const hx = j[endJ * 2], hy = j[endJ * 2 + 1];
        const base = Math.atan2(hy - ry, hx - rx), L = Math.hypot(hx - rx, hy - ry);
        ctx.lineWidth = 2 * wpp;
        ctx.beginPath();
        for (let g = 0; g < cfg.multiArm; g++) {
          const da = (g - (cfg.multiArm - 1) / 2) * 0.32 + (rnd() - 0.5) * 0.12;
          if (Math.abs(da) < 0.05) continue;
          const L2 = L * (0.85 + rnd() * 0.25);
          const gx = rx + Math.cos(base + da) * L2, gy = ry + Math.sin(base + da) * L2;
          ctx.moveTo(rx, ry); ctx.lineTo(gx, gy);
          ctx.moveTo(gx + 3 * sc, gy); ctx.arc(gx, gy, 3 * sc, 0, TAU);
        }
        ctx.stroke();
      }
    }
  }
  // Flips and spins: a rotating hatch arc around the body.
  if (a.dSpin) {
    const hx = j[J.hip * 2], hy = j[J.hip * 2 + 1];
    const R = (a.rig.torso + a.rig.thigh + a.rig.shin * 0.6) * sc * 0.75;
    seed = a.dSeed ^ 0x2f6b;
    const dir = a.dFace < 0 ? -1 : 1;
    const a0 = a.dSpinFrom * dir - Math.PI / 2, a1 = (a.dSpinFrom + a.dSpin) * dir - Math.PI / 2;
    ctx.strokeStyle = c; ctx.lineWidth = 1.3 * wpp; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let s = 0; s < 16; s++) {
      const k = Math.pow(rnd(), 0.6);
      const an = a0 + (a1 - a0) * k;
      const r = R * (0.75 + rnd() * 0.4);
      const tang = an + (a1 > a0 ? Math.PI / 2 : -Math.PI / 2) + (rnd() - 0.5) * 0.6;
      const l = (6 + rnd() * 10) * sc;
      const px = hx + Math.cos(an) * r, py = hy + Math.sin(an) * r;
      ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(tang) * l, py + Math.sin(tang) * l);
    }
    ctx.stroke();
  }
};

// ------------------------------------------------------------ entities in ink
/** Projectiles as tapered flame scribbles, ground waves as scribble humps, meteors as falling scribble balls, pickups as outlines. */
export function drawEntitiesInk(ctx: CanvasRenderingContext2D, w: World, alpha: number, time: number, wpp: number): void {
  const E = w.ents;
  const step = DRAW.stepped ? Math.floor(time * 60 / DRAW.stepTicks) : Math.floor(time * 30);
  ctx.lineCap = 'round';
  for (let i = 0; i < E.meteors.count; i++) {
    const m = E.meteors.items[i];
    const k = Math.min(1, (m.t + alpha) / m.warn);
    seed = (m.x | 0) + step;
    ctx.strokeStyle = INK.red; ctx.lineWidth = 2 * wpp;
    ctx.beginPath();
    for (let s = 0; s < 6; s++) { const x = m.x + (rnd() - 0.5) * 90; ctx.moveTo(x, WORLD.groundY - 2); ctx.lineTo(x + (rnd() - 0.5) * 16, WORLD.groundY - 6 - rnd() * 14); }
    ctx.stroke();
    if (k > 0.55) {
      const y = WORLD.groundY - 700 * (1 - (k - 0.55) / 0.45);
      burst(ctx, m.x, y, 46, 12, step + i, INK.ink, 2 * wpp);
      ctx.fillStyle = INK.red; ctx.beginPath(); ctx.arc(m.x, y, 26, 0, TAU); ctx.fill();
    }
  }
  for (let i = 0; i < E.waves.count; i++) {
    const g = E.waves.items[i];
    const x = g.px + (g.x - g.px) * alpha;
    seed = i * 977 + step;
    ctx.strokeStyle = INK.red; ctx.lineWidth = 2 * wpp;
    ctx.beginPath();
    for (let s = 0; s < 9; s++) {
      const x0 = x - g.dir * rnd() * 40;
      ctx.moveTo(x0, WORLD.groundY);
      ctx.quadraticCurveTo(x0 + g.dir * 10, WORLD.groundY - 30 - rnd() * 40, x0 + g.dir * (14 + rnd() * 14), WORLD.groundY);
    }
    ctx.stroke();
  }
  for (let i = 0; i < E.projectiles.count; i++) {
    const p = E.projectiles.items[i];
    const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha;
    const dir = Math.sign(p.vx) || 1;
    const col = p.team === 'enemy' ? INK.red : INK.ink;
    seed = i * 131 + step;
    // tapered flame scribble (reference 63-65): a head blob and flicking tail strokes
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x, y, PROJECTILE.radius * 0.9, PROJECTILE.radius * 0.6, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2 * wpp;
    ctx.beginPath();
    for (let s = 0; s < 5; s++) {
      const l = 22 + rnd() * 26, off = (rnd() - 0.5) * 12;
      ctx.moveTo(x, y + off * 0.4);
      ctx.quadraticCurveTo(x - dir * l * 0.5, y + off, x - dir * l, y + off * 1.6);
    }
    ctx.stroke();
  }
  for (let i = 0; i < E.pickups.count; i++) {
    const u = E.pickups.items[i];
    if (u.life > 480 && ((u.life >> 3) & 1) === 0) continue;
    const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha + (step & 1 ? -2 : 2);
    ctx.lineWidth = 2 * wpp;
    if (u.kind === 'health') {
      ctx.strokeStyle = INK.red; ctx.fillStyle = INK.paper;
      ctx.beginPath(); ctx.rect(x - 4, y - 11, 8, 22); ctx.rect(x - 11, y - 4, 22, 8); ctx.fill(); ctx.stroke();
    } else {
      ctx.strokeStyle = INK.blue;
      ctx.beginPath(); ctx.moveTo(x, y - 11); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 11); ctx.lineTo(x - 8, y); ctx.closePath(); ctx.stroke();
    }
  }
  void settings;
}
