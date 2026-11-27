import { HERO_LOOK } from '../data/hero';
import { J } from './rig';

/**
 * The hero's cosmetics: headgear and hand gear, drawn by both pipelines (ink page and neon) from the
 * same shapes. `pal` is the pipeline's own colours (the Pixel look has only ink, paper, red and blue).
 * Render-only: nothing here touches the sim.
 */
export interface GearPalette { ink: string; paper: string; red: string; blue: string }
const TAU = Math.PI * 2;

export function drawHeroGear(
  ctx: CanvasRenderingContext2D, j: Float32Array, hx: number, hy: number, headR: number, face: number, s: number, wpp: number, pal: GearPalette,
): void {
  const g = HERO_LOOK.headgear, h = HERO_LOOK.hands;
  if (g === 'none' && h === 'none') return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const lw = 2.2 * wpp + 0.4;
  ctx.lineWidth = lw; ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink;
  const top = hy - headR;
  switch (g) {
    case 'cap': {
      ctx.fillStyle = pal.red;
      ctx.beginPath(); ctx.arc(hx, hy - headR * 0.1, headR * 1.08, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx + face * headR * 0.7, hy - headR * 0.12); ctx.lineTo(hx + face * headR * 2.0, hy - headR * 0.05); ctx.stroke();
      break;
    }
    case 'tophat': {
      ctx.beginPath(); ctx.moveTo(hx - headR * 1.5, top + headR * 0.15); ctx.lineTo(hx + headR * 1.5, top + headR * 0.15); ctx.stroke();
      ctx.fillStyle = pal.ink;
      ctx.beginPath(); ctx.rect(hx - headR * 0.8, top - headR * 1.55, headR * 1.6, headR * 1.7); ctx.fill();
      ctx.strokeStyle = pal.red; ctx.beginPath(); ctx.moveTo(hx - headR * 0.8, top - headR * 0.15); ctx.lineTo(hx + headR * 0.8, top - headR * 0.15); ctx.stroke();
      break;
    }
    case 'crown': {
      ctx.fillStyle = pal.red;
      ctx.beginPath();
      ctx.moveTo(hx - headR * 0.95, top + headR * 0.2); ctx.lineTo(hx - headR * 1.0, top - headR * 1.0); ctx.lineTo(hx - headR * 0.5, top - headR * 0.4);
      ctx.lineTo(hx, top - headR * 1.15); ctx.lineTo(hx + headR * 0.5, top - headR * 0.4); ctx.lineTo(hx + headR * 1.0, top - headR * 1.0);
      ctx.lineTo(hx + headR * 0.95, top + headR * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'halo': {
      ctx.strokeStyle = pal.blue; ctx.lineWidth = 2.6 * wpp + 0.5;
      ctx.beginPath(); ctx.ellipse(hx, top - headR * 0.75, headR * 1.0, headR * 0.28, 0, 0, TAU); ctx.stroke();
      break;
    }
    case 'ears': {
      ctx.fillStyle = pal.ink;
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(hx + sd * headR * 0.95, top + headR * 0.45); ctx.lineTo(hx + sd * headR * 0.85, top - headR * 0.85); ctx.lineTo(hx + sd * headR * 0.15, top + headR * 0.02);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      break;
    }
    case 'goggles': {
      ctx.beginPath(); ctx.moveTo(hx - headR * 1.05, hy - headR * 0.2); ctx.lineTo(hx + headR * 1.05, hy - headR * 0.2); ctx.stroke();
      ctx.fillStyle = pal.paper;
      for (const sd of [-0.42, 0.42]) { ctx.beginPath(); ctx.arc(hx + sd * headR + face * headR * 0.15, hy - headR * 0.2, headR * 0.36, 0, TAU); ctx.fill(); ctx.stroke(); }
      break;
    }
  }
  ctx.lineWidth = lw; ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink;
  if (h !== 'none') {
    for (const [hand, elbow] of [[J.handA, J.elbA], [J.handB, J.elbB]] as const) {
      const x = j[hand * 2], y = j[hand * 2 + 1], ex = j[elbow * 2], ey = j[elbow * 2 + 1];
      if (h === 'mitts') { ctx.beginPath(); ctx.arc(x, y, 5.5 * s, 0, TAU); ctx.fill(); continue; }
      // wraps: two short bands across the forearm, just above the hand
      const dx = x - ex, dy = y - ey, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      ctx.strokeStyle = pal.red; ctx.lineWidth = 2.6 * wpp + 0.6; ctx.beginPath();
      for (const k of [0.62, 0.84]) { const px = ex + dx * k, py = ey + dy * k; ctx.moveTo(px + nx * 5.5 * s, py + ny * 5.5 * s); ctx.lineTo(px - nx * 5.5 * s, py - ny * 5.5 * s); }
      ctx.stroke();
    }
  }
  ctx.restore();
}
