import type { World } from '../sim/world';
import { WORLD } from '../data/tuning';
import { BOSS } from '../data/enemies';
import { TAU } from '../core/math';

/**
 * Boss meteor warnings (the Colossus and the others that call strikes): WHERE (the exact hit
 * zone on the floor plus a sky-high column over it) and WHEN (the zone fills up and the "!"
 * blinks faster until the strike lands). The zone's half-width is the real hit test in
 * sim/entities.ts (meteorRadius + 20), and it only hurts a hero below 120 units: jump it.
 * Render-only; both the colour and the ink pipelines call it.
 */
export const METEOR_HALF = BOSS.meteorRadius + 20;

export function drawMeteorWarnings(
  ctx: CanvasRenderingContext2D, w: World, alpha: number, time: number, wpp: number,
  col: { red: string; ink: string; pale: string }, wobble: boolean,
): void {
  const E = w.ents;
  const G = WORLD.groundY;
  const H = METEOR_HALF;
  for (let i = 0; i < E.meteors.count; i++) {
    const m = E.meteors.items[i];
    const mt = m.t + alpha;
    if (mt >= m.warn + 6) continue; // already struck
    const k = Math.min(1, mt / m.warn);
    const frames = Math.max(0, Math.ceil(m.warn - mt));
    const blink = Math.sin(time * (10 + 34 * k)) > -0.2; // faster and faster
    const j = wobble ? Math.sin(time * 40 + i * 3) * 1.2 : 0;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // ---- the exact hit zone on the floor ----
    ctx.globalAlpha = 0.16 + 0.1 * k;
    ctx.fillStyle = col.red;
    ctx.fillRect(m.x - H, G - 16, H * 2, 16);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = col.red; ctx.lineWidth = 2.6 * wpp + 0.8;
    ctx.setLineDash([10, 7]);
    ctx.strokeRect(m.x - H, G - 16, H * 2, 16);
    ctx.setLineDash([]);
    // ---- the fill: how close the strike is (the inner bar grows from the middle) ----
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = col.red;
    ctx.fillRect(m.x - H * k, G - 13, H * 2 * k, 10);
    // ---- column to the sky: where it will come from ----
    ctx.globalAlpha = 0.18 + 0.3 * k;
    ctx.strokeStyle = col.red; ctx.lineWidth = 2.2 * wpp + 0.6;
    ctx.setLineDash([14, 12]);
    for (const dx of [-H, H]) { ctx.beginPath(); ctx.moveTo(m.x + dx + j, G - 18); ctx.lineTo(m.x + dx - j, G - 640); ctx.stroke(); }
    ctx.setLineDash([]);
    // ---- the blinking "!" sign over the zone, with a countdown bar under it ----
    if (blink) {
      const sy = G - 118 + j, sx = m.x;
      ctx.globalAlpha = 1;
      ctx.fillStyle = col.pale; ctx.strokeStyle = col.red; ctx.lineWidth = 3.4 * wpp + 1;
      ctx.beginPath(); ctx.moveTo(sx, sy - 34); ctx.lineTo(sx + 34, sy + 22); ctx.lineTo(sx - 34, sy + 22); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col.ink;
      ctx.fillRect(sx - 3, sy - 16, 6, 22);
      ctx.beginPath(); ctx.arc(sx, sy + 13, 3.6, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // a down arrow ring that shrinks onto the zone center (timing at a glance)
    ctx.strokeStyle = col.red; ctx.lineWidth = 3 * wpp + 0.8;
    ctx.beginPath(); ctx.ellipse(m.x, G - 8, H * (1.5 - 0.5 * k), 11 * (1.5 - 0.5 * k), 0, 0, TAU); ctx.globalAlpha = 0.55 * (1 - k * 0.4); ctx.stroke();
    ctx.restore();
    void frames;
  }
}
