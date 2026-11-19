import type { World } from '../sim/world';
import { WORLD } from '../data/tuning';
import { BOSS, PROJECTILE } from '../data/enemies';
import { TAU } from '../core/math';

/** Draw projectiles, ground waves, meteor warnings and pickups (world space). */
export function drawEntities(ctx: CanvasRenderingContext2D, w: World, alpha: number, time: number): void {
  const E = w.ents;
  // Meteor warnings + falling pillars.
  for (let i = 0; i < E.meteors.count; i++) {
    const m = E.meteors.items[i];
    const mt = m.t + alpha; // sub-tick time so the falling pillar is smooth at any refresh rate
    const k = Math.min(1, mt / m.warn);
    ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(time * 18));
    ctx.fillStyle = '#ff3030';
    ctx.beginPath();
    ctx.ellipse(m.x, WORLD.groundY + 2, BOSS.meteorRadius * (0.4 + 0.6 * k), BOSS.meteorRadius * 0.22 * (0.4 + 0.6 * k), 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (mt > m.warn - 14 && mt < m.warn + 8) {
      const fall = Math.min(1, (mt - (m.warn - 14)) / 14);
      const y = WORLD.groundY - 700 + 700 * fall;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#ff8a3a';
      ctx.lineWidth = 26;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(m.x, y - 200); ctx.lineTo(m.x, y); ctx.stroke();
      ctx.lineWidth = 10; ctx.globalAlpha = 1; ctx.strokeStyle = '#ffe0a0';
      ctx.beginPath(); ctx.moveTo(m.x, y - 160); ctx.lineTo(m.x, y); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // Ground shockwaves.
  for (let i = 0; i < E.waves.count; i++) {
    const g = E.waves.items[i];
    const x = g.px + (g.x - g.px) * alpha;
    const k = 1 - g.life / g.max;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8 * k;
    ctx.fillStyle = '#ff4030';
    ctx.beginPath();
    ctx.moveTo(x - g.dir * 30, WORLD.groundY);
    ctx.quadraticCurveTo(x, WORLD.groundY - 70, x + g.dir * 22, WORLD.groundY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // Projectiles.
  for (let i = 0; i < E.projectiles.count; i++) {
    const p = E.projectiles.items[i];
    const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha;
    const col = p.team === 'enemy' ? '#3fe0ff' : '#ffe14a';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = PROJECTILE.radius * 2;
    ctx.beginPath(); ctx.moveTo(x - Math.sign(p.vx) * 40, y); ctx.lineTo(x, y); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, PROJECTILE.radius * 0.6, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  // Pickups.
  for (let i = 0; i < E.pickups.count; i++) {
    const u = E.pickups.items[i];
    const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha + Math.sin(time * 5 + i) * 3;
    const blink = u.life > 480 && ((u.life >> 3) & 1) === 0;
    if (blink) continue;
    const col = u.kind === 'health' ? '#5dff8a' : '#5fc8ff';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = col;
    ctx.strokeStyle = '#05060c';
    ctx.lineWidth = 2;
    if (u.kind === 'health') {
      ctx.fillRect(x - 3.5, y - 10, 7, 20);
      ctx.fillRect(x - 10, y - 3.5, 20, 7);
    } else {
      ctx.beginPath(); ctx.moveTo(x, y - 11); ctx.lineTo(x + 8, y); ctx.lineTo(x, y + 11); ctx.lineTo(x - 8, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
}
