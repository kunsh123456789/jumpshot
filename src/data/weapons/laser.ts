import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveDef, type BeamSpec } from '../moves';
import { strikeAnim, LOW, AIRP } from './author';
import { J, type PoseSpec } from '../../render/rig';
import { PLAYER } from '../tuning';

/**
 * LASER BLAST: safe ranged damage, limited by heat. Every swipe fires in that
 * direction, auto-aimed onto the nearest enemy inside the move's cone. Light =
 * a quick hitscan bolt; heavy = a charged, piercing scribble beam across the
 * arena. N blasts skyward (the juggle starter), S in the air beams downward
 * (spike). Firing builds heat; full heat overheats for a moment, during which
 * swipes become a blaster bash. Heat drains fast, and Perfect-timed shots in
 * Rhythm Mode vent it.
 */
const RED = '#e22424';
const tr = (w = 10) => ({ limb: 'handA' as const, color: RED, width: w });
const bolt = (len = 860): BeamSpec => ({ len, width: 16, pierce: false, color: RED });
const beam = (w = 48): BeamSpec => ({ len: 2200, width: w, pierce: true, color: RED });
/** Laser grid rule: light bolts snap to 16ths, charged beams and the starters land on the beat. */
const LIGHT_GRID = 4, HEAVY_GRID = 1;

// ------------------------------------------------------------------ moves
const m: Record<string, MoveDef> = {};
const add = (x: Parameters<typeof addMove>[0]) => { m[x.id] = addMove(x); };
const base = { ranged: 860, dash: false, sound: 'punch' as const, kbY: 0, shake: 3, hitstop: 3, hitbox: { x: 40, y: 96, r: 1 }, reach: 300 };

add({ ...base, id: 'lz_bolt', family: 'lz_bolt', name: 'Bolt', tags: ['light'], startup: 4, active: 2, recovery: 12,
  damage: 7, hitstun: 22, kbX: 170, beam: bolt(), aimCone: 30, heat: 0.12, grid: LIGHT_GRID, cancelInto: CANCEL.light, weight: 0.3, trail: tr() });
add({ ...base, id: 'lz_beam', family: 'lz_beam', name: 'Charged Beam', tags: ['heavy'], startup: 14, active: 4, recovery: 20,
  damage: 16, hitstun: 36, kbX: 900, kbY: -220, hitstop: 8, shake: 14, zoom: 0.4, poise: 2.4, maxTargets: 12, beam: beam(), aimCone: 22, fx: { crescent: true },
  heat: 0.45, grid: HEAVY_GRID, slowmo: { scale: 0.3, sec: 0.3 }, cancelInto: CANCEL.heavy, weight: 0.95, afterimage: true, trail: tr(16) });
add({ ...base, id: 'lz_sky', family: 'lz_sky', name: 'Sky Blast', tags: ['launcher'], startup: 6, active: 3, recovery: 16,
  damage: 9, hitstun: 40, kbX: 40, launch: -1180, maxTargets: 4, beam: { ...bolt(760), width: 26, pierce: true }, aimCone: 118,
  heat: 0.16, grid: HEAVY_GRID, cancelFrom: 2, cancelInto: ['air', 'light', 'heavy', 'dodge', 'special'], weight: 0.6, trail: tr(12) });
add({ ...base, id: 'lz_skyH', family: 'lz_sky', name: 'Sky Barrage', tags: ['launcher', 'heavy'], startup: 8, active: 15, recovery: 14,
  damage: 5, hitstun: 40, kbX: 30, launch: -900, maxTargets: 4, beam: { ...bolt(780), width: 30, pierce: true }, aimCone: 118,
  multiHit: { interval: 5, count: 3 }, heat: 0.09, grid: HEAVY_GRID, cancelFrom: 15, cancelInto: ['air', 'light', 'dodge', 'special'], weight: 0.6, trail: tr(14) });
add({ ...base, id: 'lz_rise', family: 'lz_diag', name: 'Rising Bolt', tags: ['light', 'rising'], startup: 5, active: 2, recovery: 13,
  damage: 7, hitstun: 30, kbX: 160, kbY: -460, beam: bolt(), aimCone: 72, heat: 0.12, grid: LIGHT_GRID, cancelInto: CANCEL.light, weight: 0.35, trail: tr() });
add({ ...base, id: 'lz_riseH', family: 'lz_diag', name: 'Rising Beam', tags: ['heavy', 'rising'], startup: 12, active: 4, recovery: 18,
  damage: 13, hitstun: 36, kbX: 380, kbY: -620, hitstop: 7, shake: 10, zoom: 0.3, poise: 2, maxTargets: 10, beam: beam(40), aimCone: 58,
  heat: 0.38, grid: HEAVY_GRID, cancelInto: CANCEL.heavy, weight: 0.85, trail: tr(14) });
add({ ...base, id: 'lz_low', family: 'lz_low', name: 'Leg Shot', tags: ['light', 'sweep'], startup: 5, active: 2, recovery: 13,
  damage: 7, hitstun: 30, kbX: 180, kbY: -320, knockdown: true, beam: bolt(), aimCone: 58, heat: 0.12, grid: LIGHT_GRID, cancelInto: CANCEL.light, weight: 0.35, trail: tr() });
add({ ...base, id: 'lz_lowH', family: 'lz_low', name: 'Floor Raker', tags: ['heavy', 'sweep', 'guardbreak'], startup: 12, active: 4, recovery: 18,
  damage: 12, hitstun: 34, kbX: 420, kbY: -420, knockdown: true, hitstop: 7, shake: 10, zoom: 0.3, poise: 2, maxTargets: 10, beam: beam(40), aimCone: 58,
  heat: 0.38, grid: HEAVY_GRID, cancelInto: CANCEL.heavy, weight: 0.85, trail: tr(14) });
add({ id: 'lz_blast', family: 'lz_blast', name: 'Ground Blast', tags: ['light', 'down'], startup: 7, active: 3, recovery: 17,
  damage: 9, hitstun: 30, kbX: 280, kbY: -420, hitstop: 6, shake: 9, zoom: 0.2, poise: 1.4, hitbox: { x: 0, y: 30, r: 0 }, aoe: 170, reach: 70,
  maxTargets: 8, knockdown: true, plant: { radius: 190, damage: 0, x: 24 }, heat: 0.2, grid: HEAVY_GRID, cancelInto: CANCEL.light, sound: 'stomp', weight: 0.6, trail: tr(12) });
add({ id: 'lz_blastH', family: 'lz_blast', name: 'Nova', tags: ['heavy', 'down'], startup: 12, active: 3, recovery: 22,
  damage: 13, hitstun: 36, kbX: 460, kbY: -520, hitstop: 8, shake: 14, zoom: 0.45, poise: 2.5, hitbox: { x: 0, y: 30, r: 0 }, aoe: 250, reach: 80,
  maxTargets: 10, knockdown: true, plant: { radius: 300, damage: 7, x: 24 }, fx: { lightning: true, crescent: true }, heat: 0.4, grid: HEAVY_GRID, cancelInto: CANCEL.heavy, sound: 'stomp', weight: 0.95, afterimage: true, trail: tr(16) });
// air
add({ ...base, id: 'lz_abolt', family: 'lz_bolt', name: 'Air Bolt', tags: ['air', 'light'], startup: 4, active: 2, recovery: 12,
  damage: 7, hitstun: 32, kbX: 140, kbY: -320, selfVY: -150, beam: bolt(), aimCone: 35, heat: 0.12, grid: LIGHT_GRID, cancelInto: CANCEL.air, weight: 0.3, trail: tr() });
add({ ...base, id: 'lz_abeam', family: 'lz_beam', name: 'Air Beam', tags: ['air', 'heavy'], startup: 12, active: 4, recovery: 16,
  damage: 14, hitstun: 36, kbX: 950, kbY: -180, selfVY: -100, hitstop: 8, shake: 13, zoom: 0.4, poise: 2.2, maxTargets: 12, beam: beam(), aimCone: 30,
  heat: 0.42, grid: HEAVY_GRID, slowmo: { scale: 0.3, sec: 0.3 }, cancelInto: CANCEL.air, weight: 0.95, afterimage: true, trail: tr(16) });
add({ ...base, id: 'lz_asky', family: 'lz_sky', name: 'Air Sky Blast', tags: ['air', 'light', 'rising'], startup: 5, active: 3, recovery: 14,
  damage: 8, hitstun: 36, kbX: 40, kbY: -920, selfVY: -300, maxTargets: 4, beam: { ...bolt(760), width: 26, pierce: true }, aimCone: 70,
  heat: 0.14, grid: LIGHT_GRID, cancelInto: CANCEL.air, weight: 0.5, trail: tr(12) });
add({ ...base, id: 'lz_adiag', family: 'lz_diag', name: 'Air Rising Bolt', tags: ['air', 'light'], startup: 4, active: 2, recovery: 12,
  damage: 7, hitstun: 32, kbX: 220, kbY: -480, selfVY: -220, beam: bolt(), aimCone: 72, heat: 0.12, grid: LIGHT_GRID, cancelInto: CANCEL.air, weight: 0.35, trail: tr() });
add({ ...base, id: 'lz_spike', family: 'spike', name: 'Down Beam', tags: ['air', 'down', 'light'], startup: 6, active: 3, recovery: 18,
  damage: 11, hitstun: 40, kbX: 200, kbY: 1650, spike: true, hitstop: 8, shake: 12, zoom: 0.45, poise: 2, selfVY: -380,
  beam: { ...bolt(900), width: 30 }, aimCone: 55, heat: 0.18, grid: HEAVY_GRID, cancelInto: ['dodge', 'special'], weight: 0.85, afterimage: true, trail: tr(14) });
add({ ...base, id: 'lz_spikeH', family: 'spike', name: 'Down Barrage', tags: ['air', 'down', 'heavy'], startup: 9, active: 4, recovery: 18,
  damage: 13, hitstun: 40, kbX: 200, kbY: 1750, spike: true, hitstop: 8, shake: 14, zoom: 0.5, poise: 2.2, selfVY: -420, maxTargets: 8,
  beam: beam(44), aimCone: 55, heat: 0.4, grid: HEAVY_GRID, cancelInto: ['dodge', 'special'], weight: 0.95, afterimage: true, trail: tr(16) });
// overheated: a blaster bash
add({ id: 'lz_bash', family: 'lz_bash', name: 'Blaster Bash', tags: ['light'], startup: 5, active: 3, recovery: 14,
  damage: 6, hitstun: 22, kbX: 240, kbY: 0, hitstop: 4, shake: 3, hitbox: { x: 58, y: 92, r: 38 }, reach: 72,
  cancelInto: CANCEL.light, sound: 'punch', weight: 0.35, trail: { limb: 'handA', color: '#bff4ff', width: 10 } });

// ------------------------------------------------------------------ drawings
/** Two-handed aim at upper-arm angle a (0 = down, 1.57 = forward, 3.1 = up). */
const aim = (a: number, extra: PoseSpec = {}): PoseSpec => ({ ...LOW, rootY: -24, aU: a, aL: 0.0, bU: a - 0.12, bL: 0.42, lean: 0.36 - (a - 1.57) * 0.12, head: -0.15 - (a - 1.57) * 0.25, ...extra });
const aimAir = (a: number, extra: PoseSpec = {}): PoseSpec => ({ ...AIRP, aU: a, aL: 0.0, bU: a - 0.12, bL: 0.42, lean: 0.2 - (a - 1.57) * 0.12, head: -0.1 - (a - 1.57) * 0.25, ...extra });
const shot = (id: string, a: number, air = false, heavy = false) => {
  const P = air ? aimAir : aim;
  const mv = m[id];
  return strikeAnim(id, mv, {
    base: air ? 'air' : 'ground', strike: 'arm', smear: heavy ? ['handA'] : undefined,
    antic: heavy
      ? [P(a - 0.5, { aL: 1.2, bL: 1.3, lean: -0.05, rootX: -6 }), P(a - 0.3, { aL: 0.6, bL: 0.9, lean: -0.1, rootX: -10, stretch: 0.94 }), P(a, { lean: -0.12, rootX: -12, stretch: 0.92 })]
      : [P(a - 0.4, { aL: 1.0, bL: 1.1, rootX: -3 })],
    hit: P(a, heavy ? { rootX: -18, lean: -0.25, stretch: 1.06, footA: 30, footB: -48 } : { rootX: -4 }),
    hit2: heavy ? P(a + 0.06, { rootX: -22, lean: -0.3 }) : undefined,
    follow: [P(a + 0.3, { rootX: heavy ? -16 : -6, aL: 0.3, lean: heavy ? -0.2 : 0.2 }), air ? AIRP : LOW],
  });
};
const anims = [
  shot('lz_bolt', 1.57), shot('lz_beam', 1.57, false, true),
  shot('lz_sky', 2.7), shot('lz_skyH', 2.75, false, true),
  shot('lz_rise', 2.3), shot('lz_riseH', 2.3, false, true),
  shot('lz_low', 0.85), shot('lz_lowH', 0.85, false, true),
  strikeAnim('lz_blast', m.lz_blast, { strike: 'arm', smear: ['handA'],
    antic: [aim(2.6, { rootY: -10, lean: 0.1 }), aim(2.9, { rootY: -4, lean: -0.05 })],
    hit: aim(0.35, { rootY: -50, lean: 0.85, footA: 48, footB: -44, stretch: 1.06 }),
    follow: [aim(0.4, { rootY: -46, lean: 0.8 }), LOW] }),
  strikeAnim('lz_blastH', m.lz_blastH, { strike: 'arm', smear: ['handA'], inbetweens: 1,
    antic: [aim(2.7, { rootY: -16, lean: 0.15 }), aim(3.05, { rootY: 6, lean: -0.2, liftA: 14, stretch: 1.05 })],
    hit: aim(0.25, { rootY: -58, lean: 0.95, footA: 54, footB: -48, stretch: 1.12 }),
    follow: [aim(0.3, { rootY: -54, lean: 0.9 }), aim(0.8, { rootY: -40, lean: 0.6 }), LOW] }),
  shot('lz_abolt', 1.57, true), shot('lz_abeam', 1.57, true, true), shot('lz_asky', 2.75, true), shot('lz_adiag', 2.3, true),
  shot('lz_spike', 0.45, true), shot('lz_spikeH', 0.4, true, true),
  strikeAnim('lz_bash', m.lz_bash, { reach: 'handA', smear: ['handA'],
    antic: [{ ...LOW, aU: 0.4, aL: 1.6, rootX: -6, lean: 0.1 }],
    hit: { ...LOW, lean: 0.55, rootX: 14, aU: 1.6, aL: 0.05, bU: 0.5, bL: 2.2, footA: 40, head: -0.2 },
    follow: [{ ...LOW, lean: 0.5, rootX: 12, aU: 1.45, aL: 0.4 }, LOW] }),
];

/** Held blaster: a short boxy body along the forearm with a barrel and a red energy cell. */
function heldBlaster(ctx: CanvasRenderingContext2D, f: { scale: number }, j: Float32Array, col: string, wpp: number): void {
  const hx = j[J.handA * 2], hy = j[J.handA * 2 + 1];
  let dx = hx - j[J.elbA * 2], dy = hy - j[J.elbA * 2 + 1];
  const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  const s = f.scale, nx = -dy, ny = dx;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = col; ctx.lineWidth = 2 * wpp + 0.6;
  ctx.beginPath();
  const b0x = hx - dx * 6 * s, b0y = hy - dy * 6 * s, b1x = hx + dx * 16 * s, b1y = hy + dy * 16 * s;
  ctx.moveTo(b0x + nx * 5 * s, b0y + ny * 5 * s); ctx.lineTo(b1x + nx * 5 * s, b1y + ny * 5 * s);
  ctx.lineTo(b1x - nx * 4 * s, b1y - ny * 4 * s); ctx.lineTo(b0x - nx * 4 * s, b0y - ny * 4 * s); ctx.closePath();
  ctx.moveTo(b1x, b1y); ctx.lineTo(hx + dx * 26 * s, hy + dy * 26 * s);
  ctx.stroke();
  ctx.fillStyle = RED;
  ctx.beginPath(); ctx.arc(hx + dx * 5 * s + nx * 1 * s, hy + dy * 5 * s + ny * 1 * s, 2.6 * s, 0, Math.PI * 2); ctx.fill();
}

export const laser: WeaponDef = {
  id: 'laser',
  name: 'Laser Blast',
  desc: 'Safe ranged damage: aimed bolts, a charged piercing beam. Watch the heat.',
  ground: {
    side: { light: 'lz_bolt', heavy: 'lz_beam' },
    upDiag: { light: 'lz_rise', heavy: 'lz_riseH' },
    up: { light: 'lz_sky', heavy: 'lz_skyH' },
    downDiag: { light: 'lz_low', heavy: 'lz_lowH' },
    down: { light: 'lz_blast', heavy: 'lz_blastH' },
  },
  air: {
    side: { light: 'lz_abolt', heavy: 'lz_abeam' },
    upDiag: { light: 'lz_adiag', heavy: 'lz_adiag' },
    up: { light: 'lz_asky', heavy: 'lz_asky' },
    downDiag: { light: 'lz_spike', heavy: 'lz_spikeH' },
    down: { light: 'lz_spike', heavy: 'lz_spikeH' },
  },
  dodge: { distance: PLAYER.dodgeDistance, frames: PLAYER.dodgeFrames, rope: false },
  range: 860,
  heat: { decayPerSec: 0.55, overheatSec: 1.1, resumeAt: 0.35, perfectVent: 0.25, bash: 'lz_bash' },
  anims,
  smears: { lz_beam: { chain: 2 }, lz_blast: { radius: 1.2 }, lz_blastH: { chain: 3, radius: 1.3 }, lz_bash: {} },
  tips: ['→ bolt · heavy: charged piercing beam', '↑ SKY BLAST launcher (keeps them aloft)', '↗ rising bolt · ↘ leg shot (trips)', '↓ ground blast · in the air: down beam', 'Firing builds heat: overheat = melee bash'],
  icon(ctx, x, y, s, col) {
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.rect(x - s * 0.36, y - s * 0.16, s * 0.42, s * 0.2);
    ctx.moveTo(x + s * 0.06, y - s * 0.06); ctx.lineTo(x + s * 0.2, y - s * 0.06);
    ctx.moveTo(x - s * 0.26, y + s * 0.04); ctx.lineTo(x - s * 0.3, y + s * 0.3);
    ctx.stroke();
    ctx.strokeStyle = RED;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.24, y - s * 0.06); ctx.lineTo(x + s * 0.44, y - s * 0.06);
    for (let i = 0; i < 3; i++) { const a = -0.6 + i * 0.6; ctx.moveTo(x + s * 0.3, y - s * 0.06); ctx.lineTo(x + s * 0.3 + Math.cos(a) * s * 0.14, y - s * 0.06 + Math.sin(a) * s * 0.14); }
    ctx.stroke();
  },
  held: heldBlaster,
};
