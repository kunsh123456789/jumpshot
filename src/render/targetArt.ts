import type { Fighter } from '../sim/fighter';
import { WORLD } from '../data/tuning';
import { INKLOOK } from '../data/inkLook';
import { DRAW } from './drawStyle';
import { INK } from './ink';

/**
 * Training-room targets, drawn in the game's ink style from the player's sketches (Pixel look only):
 *  - the DUMMY: big round head with X eyes, a stubby-sleeved shirt torso with a red bullseye, one post and a base plate;
 *  - the BAG: a tapered punching bag on a short rope with X eyes and red tape wraps, swinging from the top.
 * Paper fill with ink outlines at the enemies' line weight, re-jittered per drawing step so they boil like the
 * figures. Visual only: hit detection stays on the dummy's rig.
 */
let sd = 1;
const rnd = () => ((sd = (Math.imul(sd, 1103515245) + 12345) | 0) >>> 8) / 16777216;
const TAU = Math.PI * 2;

type Pt = [number, number];
function poly(ctx: CanvasRenderingContext2D, pts: Pt[], j: number): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => { const jx = x + (rnd() - 0.5) * j, jy = y + (rnd() - 0.5) * j; if (i) ctx.lineTo(jx, jy); else ctx.moveTo(jx, jy); });
  ctx.closePath();
}
function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, j: number): void {
  ctx.moveTo(x1 + (rnd() - 0.5) * j, y1 + (rnd() - 0.5) * j); ctx.lineTo(x2 + (rnd() - 0.5) * j, y2 + (rnd() - 0.5) * j);
}
function xEye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, j: number): void {
  line(ctx, x - r, y - r, x + r, y + r, j); line(ctx, x + r, y - r, x - r, y + r, j);
}

/** Draw the target for fighter `f`; returns false when it has no target art (the caller draws the stick figure). */
export function drawTarget(ctx: CanvasRenderingContext2D, f: Fighter, alpha: number, time: number, wpp: number): boolean {
  const id = f.sprite;
  if (id !== 'dummy' && id !== 'bag') return false;
  const x = f.px + (f.x - f.px) * alpha, y = f.py + (f.y - f.py) * alpha;
  const step = DRAW.stepped ? Math.floor((time * 60) / DRAW.stepTicks) : Math.floor(time * 30);
  const flash = f.flash > 0;
  const fill = flash ? INK.ink : INK.paper, ink = flash ? INK.paper : INK.ink;
  const lw = INKLOOK.enemyLimbPx * wpp, j = 1.6;
  sd = f.id * 7919 + step * 31;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (id === 'bag') {
    // hangs by its rope from a fixed point above the floor and swings about it
    const H = 182, rope = 30, top = WORLD.groundY - 16 - H;
    ctx.translate(x, top);
    ctx.rotate(f.spriteAng);
    ctx.strokeStyle = INK.ink; ctx.lineWidth = lw * 0.8;
    ctx.beginPath(); line(ctx, 0, -40, 0, rope - 4, 0.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, rope - 2, 5, 0, TAU); ctx.stroke(); // the ring
    // the bag body: wider at the top, a soft taper, rounded bottom
    const body: Pt[] = [[-33, rope + 4], [33, rope + 4], [36, rope + 40], [31, H - 18], [24, H - 4], [-22, H - 4], [-29, H - 18], [-35, rope + 40]];
    ctx.fillStyle = fill; ctx.strokeStyle = ink; ctx.lineWidth = lw;
    poly(ctx, body, j); ctx.fill(); ctx.stroke();
    // top cap seam
    ctx.lineWidth = lw * 0.7; ctx.beginPath(); line(ctx, -33, rope + 14, 33, rope + 14, j); ctx.stroke();
    // X eyes, up near the top like the sketch
    ctx.lineWidth = lw * 0.8; ctx.beginPath(); xEye(ctx, -13, rope + 34, 5, 0.8); xEye(ctx, 11, rope + 38, 5, 0.8); ctx.stroke();
    // red tape wraps across the middle, rising to the right
    ctx.strokeStyle = flash ? INK.paper : INK.red; ctx.lineWidth = lw * 0.85;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) { const yy = rope + 70 + k * 20; line(ctx, -31, yy + 14, 33, yy - 4, j); }
    ctx.stroke();
  } else {
    // stands on its base plate: leans back when hit, tumbles in the air, lies flat when knocked down
    const H = 178;
    ctx.translate(x, y);
    let ang = f.spriteAng + (f.grounded ? 0 : f.spinAngle);
    if (f.state === 'knockdown' || f.state === 'ko' || f.state === 'dead') ang = (f.hitDirX || -f.facing || 1) * Math.PI / 2;
    ctx.rotate(ang);
    ctx.strokeStyle = ink; ctx.fillStyle = fill; ctx.lineWidth = lw;
    // base plate and the post
    ctx.beginPath(); line(ctx, -36, -1, 36, -1, 0.8); ctx.stroke();
    ctx.beginPath(); line(ctx, 0, -2, 0, -50, j); ctx.stroke();
    // the shirt torso with stub sleeves (as in the sketch)
    const shirt: Pt[] = [[-40, -126], [40, -126], [56, -92], [42, -84], [28, -100], [28, -50], [-28, -50], [-28, -100], [-42, -84], [-56, -92]];
    poly(ctx, shirt, j); ctx.fill(); ctx.stroke();
    // red bullseye on the chest: the training target
    ctx.strokeStyle = flash ? INK.paper : INK.red; ctx.lineWidth = lw * 0.8;
    ctx.beginPath(); ctx.arc((rnd() - 0.5) * 0.8, -86, 11, 0, TAU); ctx.stroke();
    ctx.fillStyle = flash ? INK.paper : INK.red; ctx.beginPath(); ctx.arc(0, -86, 3.5, 0, TAU); ctx.fill();
    // neck and the big round head with X eyes
    ctx.strokeStyle = ink; ctx.fillStyle = fill; ctx.lineWidth = lw;
    ctx.beginPath(); line(ctx, 0, -126, 0, -134, 0.6); ctx.stroke();
    ctx.beginPath(); ctx.ellipse((rnd() - 0.5) * j, -H + 26 + (rnd() - 0.5) * j, 27, 26, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.lineWidth = lw * 0.8; ctx.beginPath(); xEye(ctx, -10, -H + 24, 5, 0.8); xEye(ctx, 10, -H + 24, 5, 0.8); ctx.stroke();
  }
  ctx.restore();
  return true;
}
