import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveDef, type MoveInput } from '../moves';
import { tplAnim } from './author';
import { forearm, stroke } from './heldArt';
import { J } from '../../render/rig';
import { PLAYER } from '../tuning';

/** TWIN DAGGERS: the fastest weapon. Blink-slashes land behind the target, every cut bleeds, and the dodge is a teleport. */
const C = '#e22424', tr = (w = 9) => ({ limb: 'handA' as const, color: C, width: w });
const bleed = (f = 120) => ({ kind: 'bleed' as const, frames: f });
const m: Record<string, MoveDef> = {};
const add = (x: MoveInput) => { m[x.id] = addMove(x); };
const cut = { hitbox: { x: 54, y: 90, r: 38 }, reach: 64, sound: 'slash' as const, status: bleed(), hitstop: 3, shake: 3 };
add({ ...cut, id: 'dg_cut1', family: 'dg_cut', name: 'Cut', tags: ['light', 'string'], startup: 3, active: 2, recovery: 9, damage: 4, hitstun: 18, kbX: 100, kbY: 0, hitstop: 2, shake: 2, next: 'dg_cut2', cancelInto: CANCEL.light, weight: 0.2, trail: tr() });
add({ ...cut, id: 'dg_cut2', family: 'dg_cut', name: 'Cut', tags: ['light', 'string'], startup: 3, active: 2, recovery: 9, damage: 4, hitstun: 18, kbX: 110, kbY: 0, hitstop: 2, shake: 2, next: 'dg_cut3', cancelInto: CANCEL.light, weight: 0.2, trail: { limb: 'handB', color: C, width: 9 } });
add({ ...cut, id: 'dg_cut3', family: 'dg_cut', name: 'X-Cut', tags: ['light', 'string'], startup: 4, active: 3, recovery: 12, damage: 7, hitstun: 24, kbX: 320, kbY: -80, hitstop: 4, shake: 4, next: 'dg_cut1', cancelInto: CANCEL.light, weight: 0.4, trail: tr(11) });
add({ ...cut, id: 'dg_blink', name: 'Blink Slash', tags: ['heavy'], startup: 6, active: 3, recovery: 12, damage: 9, hitstun: 30, kbX: -260, kbY: -120, hitstop: 5, shake: 6, zoom: 0.2, behind: true, status: bleed(180), cancelInto: CANCEL.light, weight: 0.6, afterimage: true, trail: tr(12) });
add({ ...cut, id: 'dg_rise', name: 'Rising Fangs', tags: ['launcher'], startup: 4, active: 3, recovery: 14, damage: 6, hitstun: 40, kbX: 40, launch: -1120, follow: true, hitstop: 5, shake: 5, cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'], weight: 0.5, afterimage: true, trail: tr(11), kbY: 0 });
add({ id: 'dg_fan', name: 'Knife Fan', tags: ['light'], startup: 5, active: 2, recovery: 12, damage: 4, hitstun: 22, kbX: 120, kbY: 0, hitstop: 2, shake: 2, hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 520, dash: false, aimCone: 80, shoot: { kind: 'shard', speed: 1400, count: 3, spread: 22, gravity: 0, homing: 0, pierce: 1, life: 40, radius: 10 }, status: bleed(90), cancelInto: CANCEL.light, sound: 'slash', weight: 0.3, trail: tr() });
add({ ...cut, id: 'dg_low', name: 'Hamstring', tags: ['light', 'sweep'], startup: 4, active: 3, recovery: 12, damage: 6, hitstun: 28, kbX: 140, kbY: -340, knockdown: true, behind: true, hitbox: { x: 50, y: 24, r: 40 }, cancelInto: CANCEL.light, weight: 0.35, trail: tr() });
add({ id: 'dg_storm', name: 'Blade Storm', tags: ['light', 'down'], startup: 5, active: 12, recovery: 12, damage: 3, hitstun: 22, kbX: 80, kbY: -120, hitstop: 1, shake: 2, hitbox: { x: 0, y: 70, r: 0 }, aoe: 140, reach: 60, maxTargets: 6, multiHit: { interval: 3, count: 4 }, status: bleed(120), cancelFrom: 12, cancelInto: CANCEL.light, sound: 'slash', weight: 0.3, trail: tr(), fx: { whirl: 110 } });
add({ ...cut, id: 'dg_acut', family: 'dg_cut', name: 'Air Cuts', tags: ['air', 'light'], startup: 3, active: 6, recovery: 10, damage: 4, hitstun: 30, kbX: 120, kbY: -320, selfVY: -160, multiHit: { interval: 3, count: 2 }, cancelFrom: 6, cancelInto: CANCEL.air, weight: 0.3, trail: tr() });
add({ ...cut, id: 'dg_arise', name: 'Air Fangs', tags: ['air', 'light', 'rising'], startup: 4, active: 3, recovery: 12, damage: 6, hitstun: 36, kbX: 40, kbY: -900, selfVY: -760, cancelInto: CANCEL.air, weight: 0.5, trail: tr() });
add({ ...cut, id: 'dg_dive', family: 'spike', name: 'Falling Fangs', tags: ['air', 'down', 'light'], startup: 5, active: 3, recovery: 16, damage: 9, hitstun: 40, kbX: 200, kbY: 1700, spike: true, selfVY: -380, cancelInto: ['dodge', 'special'], weight: 0.8, afterimage: true, trail: tr(12) });
const anims = [
  tplAnim('dg_cut1', m.dg_cut1, 'jab'), tplAnim('dg_cut2', m.dg_cut2, 'slash', { bU: 1.6, bL: 0 }), tplAnim('dg_cut3', m.dg_cut3, 'spin'),
  tplAnim('dg_blink', m.dg_blink, 'dash'), tplAnim('dg_rise', m.dg_rise, 'upper'), tplAnim('dg_fan', m.dg_fan, 'throw'), tplAnim('dg_low', m.dg_low, 'low'),
  tplAnim('dg_storm', m.dg_storm, 'twirl'), tplAnim('dg_acut', m.dg_acut, 'air'), tplAnim('dg_arise', m.dg_arise, 'airUp'), tplAnim('dg_dive', m.dg_dive, 'airDown'),
];
export const daggers: WeaponDef = {
  id: 'daggers', name: 'Twin Daggers', desc: 'The fastest weapon: bleeding cuts, blink-slashes behind them, a teleport dodge.',
  ground: { side: { light: 'dg_cut1', heavy: 'dg_blink' }, upDiag: { light: 'dg_fan', heavy: 'dg_fan' }, up: { light: 'dg_rise', heavy: 'dg_rise' }, downDiag: { light: 'dg_low', heavy: 'dg_blink' }, down: { light: 'dg_storm', heavy: 'dg_storm' } },
  air: { side: { light: 'dg_acut', heavy: 'dg_acut' }, upDiag: { light: 'dg_arise', heavy: 'dg_arise' }, up: { light: 'dg_arise', heavy: 'dg_arise' }, downDiag: { light: 'dg_dive', heavy: 'dg_dive' }, down: { light: 'dg_dive', heavy: 'dg_dive' } },
  dodge: { distance: 210, frames: PLAYER.dodgeFrames - 2, rope: false, blink: true }, anims, smears: { dg_cut3: { chain: 3 }, dg_blink: { chain: 3 } },
  tips: ['→ 3-cut string (every cut bleeds) · heavy: BLINK SLASH behind them', '↑ rising fangs launcher', '↗ knife fan · ↘ hamstring', '↓ blade storm · dodge = teleport'],
  icon(ctx, x, y, s, col) { stroke(ctx, col, Math.max(1.5, s * 0.07)); ctx.beginPath(); for (const k of [-1, 1]) { ctx.moveTo(x - k * s * 0.3, y + s * 0.3); ctx.lineTo(x + k * s * 0.25, y - s * 0.35); ctx.moveTo(x - k * s * 0.2, y + s * 0.12); ctx.lineTo(x - k * s * 0.05, y + s * 0.26); } ctx.stroke(); },
  held(ctx, f, j, col, wpp) {
    const s = f.scale;
    stroke(ctx, col, 1.8 * wpp + 0.5);
    for (const [h, e] of [[J.handA, J.elbA], [J.handB, J.elbB]] as [number, number][]) {
      const [hx, hy, dx, dy] = forearm(j, h, e);
      ctx.beginPath(); ctx.moveTo(hx - dx * 4 * s, hy - dy * 4 * s); ctx.lineTo(hx + dx * 22 * s, hy + dy * 22 * s);
      ctx.moveTo(hx - dy * 5 * s, hy + dx * 5 * s); ctx.lineTo(hx + dy * 5 * s, hy - dx * 5 * s); ctx.stroke();
    }
  },
};
