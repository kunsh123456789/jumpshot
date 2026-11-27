import type { World } from '../sim/world';
import { EYES } from '../sim/powers';
import { INK } from './ink';

/**
 * Laser Eyes visuals (Pixel ink look only): two red beams from the hero's eyes converging on the target, and a thin
 * fuel arc under the hero while hovering. Re-jittered per drawing step so it boils with the page.
 */
let sd = 1;
const rnd = () => ((sd = (Math.imul(sd, 1103515245) + 12345) | 0) >>> 8) / 16777216;

export function drawPowerFx(ctx: CanvasRenderingContext2D, w: World, alpha: number, time: number, wpp: number): void {
  if (w.traits.fly <= 0) return;
  const pw = w.powers, p = w.player;
  const step = Math.floor(time * 12);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const b = pw.beam;
  if (b) {
    sd = 77 + step * 11;
    const dx = b.x2 - b.x1, dy = b.y2 - b.y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    ctx.strokeStyle = INK.red; ctx.lineWidth = 4.5 * wpp + 1;
    for (const eye of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(b.x1 + nx * 5 * eye, b.y1 + ny * 5 * eye);
      for (let i = 1; i <= 5; i++) { const q = i / 5; ctx.lineTo(b.x1 + nx * 5 * eye * (1 - q) + dx * q + (rnd() - 0.5) * 3, b.y1 + ny * 5 * eye * (1 - q) + dy * q + (rnd() - 0.5) * 3); }
      ctx.stroke();
    }
    ctx.strokeStyle = INK.paper; ctx.lineWidth = 1.4 * wpp + 0.4;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
  }
  if (pw.hovering && p.alive) {
    // fuel arc under the feet
    const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha + 10;
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 3 * wpp + 0.6;
    ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.lineTo(x - 26 + 52 * (pw.fuel / EYES.fuelFrames), y); ctx.stroke();
  }
  ctx.restore();
}
