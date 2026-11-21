import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveDef, type MoveInput } from '../moves';
import { tplAnim } from './author';
import { pole, stroke } from './heldArt';
import { PLAYER } from '../tuning';

/** INK BRUSH (magic): flick ink blobs, paint a line that erupts into spikes, an ink geyser launcher, a circle that snares. */
const C = '#1b1a17', tr = (w = 12) => ({ limb: 'handA' as const, color: C, width: w });
const blob = (count = 1, spread = 0, speed = 1050) => ({ kind: 'blob' as const, speed, count, spread, gravity: 700, homing: 0, pierce: 1, life: 70, radius: 14 });
const m: Record<string, MoveDef> = {};
const add = (x: MoveInput) => { m[x.id] = addMove(x); };
const R = { hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 640, dash: false, aimCone: 45, sound: 'slash' as const };
add({ ...R, id: 'br_flick', family: 'br_flick', name: 'Ink Flick', tags: ['light'], startup: 4, active: 2, recovery: 12, damage: 10, hitstun: 24, kbX: 260, kbY: -120, shoot: blob(), cancelInto: CANCEL.light, weight: 0.35, trail: tr() });
add({ ...R, id: 'br_line', name: 'Spike Line', tags: ['heavy'], startup: 10, active: 3, recovery: 18, damage: 11, hitstun: 34, kbX: 160, kbY: -700, hitstop: 5, shake: 7, poise: 2, spikes: { count: 6, spacing: 70, start: 60, delay: 4 }, grid: 1, cancelInto: CANCEL.heavy, weight: 0.8, trail: tr(16) });
add({ ...R, id: 'br_geyser', family: 'br_geyser', name: 'Ink Geyser', tags: ['launcher'], startup: 7, active: 3, recovery: 16, damage: 9, hitstun: 40, kbX: 30, launch: -1220, kbY: 0, spikes: { count: 1, spacing: 0, start: 90, delay: 0 }, grid: 1, cancelFrom: 2, cancelInto: ['air', 'light', 'heavy', 'dodge', 'special'], weight: 0.6, trail: tr() });
add({ ...R, id: 'br_geyserH', family: 'br_geyser', name: 'Geyser Field', tags: ['launcher', 'heavy'], startup: 11, active: 3, recovery: 18, damage: 9, hitstun: 42, kbX: 30, launch: -1300, kbY: 0, spikes: { count: 3, spacing: 80, start: 70, delay: 3 }, grid: 1, cancelFrom: 3, cancelInto: ['air', 'dodge', 'special'], weight: 0.8, trail: tr(14) });
add({ ...R, id: 'br_splash', name: 'Splash', tags: ['light'], startup: 6, active: 2, recovery: 14, damage: 6, hitstun: 26, kbX: 220, kbY: -260, aimCone: 80, shoot: blob(3, 40, 950), cancelInto: CANCEL.light, weight: 0.4, trail: tr() });
add({ id: 'br_circle', name: 'Ink Circle', tags: ['heavy', 'sweep'], startup: 10, active: 4, recovery: 18, damage: 6, hitstun: 30, kbX: 60, kbY: 0, hitstop: 5, shake: 5, hitbox: { x: 0, y: 40, r: 0 }, aoe: 220, reach: 60, maxTargets: 10, status: { kind: 'snare', frames: 110 }, cancelInto: CANCEL.heavy, sound: 'slash', weight: 0.6, trail: tr(), fx: { whirl: 160 } });
add({ ...R, id: 'br_sweep', name: 'Brush Stroke', tags: ['light', 'down'], startup: 6, active: 3, recovery: 14, damage: 8, hitstun: 30, kbX: 240, kbY: -360, knockdown: true, maxTargets: 6, aimCone: 70, beam: { len: 360, width: 54, pierce: true, color: '#1b1a17', style: 'ink' }, cancelInto: CANCEL.light, weight: 0.5, trail: tr() });
add({ id: 'br_dab', name: 'Ink Splat', tags: ['light', 'down'], startup: 7, active: 3, recovery: 16, damage: 8, hitstun: 28, kbX: 260, kbY: -380, hitstop: 5, shake: 6, hitbox: { x: 0, y: 30, r: 0 }, aoe: 160, reach: 70, maxTargets: 8, knockdown: true, plant: { radius: 170, damage: 0, x: 40 }, cancelInto: CANCEL.light, sound: 'stomp', weight: 0.55, trail: tr() });
add({ ...R, id: 'br_ablob', family: 'br_flick', name: 'Air Flick', tags: ['air', 'light'], startup: 4, active: 2, recovery: 12, damage: 8, hitstun: 30, kbX: 200, kbY: -300, selfVY: -150, shoot: blob(), cancelInto: CANCEL.air, weight: 0.35, trail: tr() });
add({ ...R, id: 'br_arise', name: 'Air Stroke', tags: ['air', 'light', 'rising'], startup: 5, active: 3, recovery: 14, damage: 8, hitstun: 36, kbX: 40, kbY: -900, selfVY: -700, hitbox: { x: 40, y: 104, r: 56 }, reach: 56, ranged: undefined, dash: true, cancelInto: CANCEL.air, weight: 0.5, trail: tr() });
add({ ...R, id: 'br_drip', family: 'spike', name: 'Ink Drip', tags: ['air', 'down', 'light'], startup: 6, active: 3, recovery: 18, damage: 11, hitstun: 40, kbX: 200, kbY: 1700, spike: true, selfVY: -380, aimCone: 60, beam: { len: 900, width: 40, pierce: false, color: '#1b1a17', style: 'ink' }, cancelInto: ['dodge', 'special'], weight: 0.85, trail: tr(14) });
const anims = [
  tplAnim('br_flick', m.br_flick, 'throw'), tplAnim('br_line', m.br_line, 'low', {}, 1), tplAnim('br_geyser', m.br_geyser, 'upper'), tplAnim('br_geyserH', m.br_geyserH, 'slam'),
  tplAnim('br_splash', m.br_splash, 'throw', { aU: 2.2 }), tplAnim('br_circle', m.br_circle, 'spin'), tplAnim('br_sweep', m.br_sweep, 'low'),
  tplAnim('br_dab', m.br_dab, 'slam'), tplAnim('br_ablob', m.br_ablob, 'airShoot'), tplAnim('br_arise', m.br_arise, 'airUp'), tplAnim('br_drip', m.br_drip, 'airDown'),
];
const seg = new Float32Array(6);
export const brush: WeaponDef = {
  id: 'brush', name: 'Ink Brush', desc: 'Magic: ink blobs, a painted line of spikes, an ink geyser, a snaring circle.',
  ground: { side: { light: 'br_flick', heavy: 'br_line' }, upDiag: { light: 'br_splash', heavy: 'br_splash' }, up: { light: 'br_geyser', heavy: 'br_geyserH' }, downDiag: { light: 'br_sweep', heavy: 'br_circle' }, down: { light: 'br_dab', heavy: 'br_circle' } },
  air: { side: { light: 'br_ablob', heavy: 'br_ablob' }, upDiag: { light: 'br_arise', heavy: 'br_arise' }, up: { light: 'br_arise', heavy: 'br_arise' }, downDiag: { light: 'br_drip', heavy: 'br_drip' }, down: { light: 'br_drip', heavy: 'br_drip' } },
  dodge: { distance: PLAYER.dodgeDistance, frames: PLAYER.dodgeFrames, rope: false }, range: 640, anims, smears: {},
  tips: ['→ ink blob · heavy: SPIKE LINE along the floor', '↑ INK GEYSER launcher', '↗ splash · ↘ brush stroke (trips)', '↓ ink splat · heavy: ink circle snares everyone around'],
  icon(ctx, x, y, s, col) { stroke(ctx, col, Math.max(1.5, s * 0.07)); ctx.beginPath(); ctx.moveTo(x - s * 0.3, y + s * 0.3); ctx.lineTo(x + s * 0.15, y - s * 0.15); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x + s * 0.24, y - s * 0.24, s * 0.08, s * 0.16, -0.8, 0, Math.PI * 2); ctx.fill(); },
  sweep(j, scale, out) { pole(j, 90 * scale, 0.8, seg); out[0] = seg[0]; out[1] = seg[1]; out[2] = seg[2]; out[3] = seg[3]; },
  held(ctx, f, j, col, wpp) {
    pole(j, 90 * f.scale, 0.8, seg);
    stroke(ctx, col, 2 * wpp + 0.6); ctx.beginPath(); ctx.moveTo(seg[4], seg[5]); ctx.lineTo(seg[2], seg[3]); ctx.stroke();
    const dx = seg[2] - seg[0], dy = seg[3] - seg[1], L = Math.hypot(dx, dy) || 1;
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(seg[2] + (dx / L) * 8, seg[3] + (dy / L) * 8, 5 * f.scale, 12 * f.scale, Math.atan2(dy, dx) + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
  },
};
