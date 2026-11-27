import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveDef, type MoveInput } from '../moves';
import { tplAnim } from './author';
import { forearm, stroke } from './heldArt';
import { PLAYER } from '../tuning';
import { J } from '../../render/rig';

/**
 * Three weapons from the third reference clip (Pixel look only: offered in the loadout only in that look).
 *  - CAPE (186-198): a matador's cloak. Wide swipes, wrap-and-hurl grabs, an over-the-shoulder toss and a
 *    pass-through "Veronica" that sends you behind them.
 *  - WAR FAN (118-122): a parasol/fan. Quick cuts, a gust that blows the line away, an open-fan dart
 *    shield, an updraft launcher and a slow drifting air stance.
 *  - EARTH (134-144): rock gauntlets. Boulders to kick, rock spikes along the floor, a dust dome that
 *    churns everything around you, and a meteor drop.
 * All three are built from the existing move parts (grabs, beams, projectiles, spikes, waves, deflect).
 */
const m: Record<string, MoveDef> = {};
const add = (x: MoveInput) => { m[x.id] = addMove(x); };
const tr = (c: string, w = 12, limb: 'handA' | 'footA' = 'handA') => ({ limb, color: c, width: w });
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- CAPE
const CC = '#e22424';
add({ id: 'cp_swipe', family: 'cp_swipe', name: 'Cape Swipe', tags: ['light', 'string'], startup: 4, active: 4, recovery: 11, damage: 7, hitstun: 24, kbX: 220, kbY: -60, hitstop: 3, shake: 3, hitbox: { x: 70, y: 96, r: 70 }, reach: 90, maxTargets: 4, next: 'cp_swipe2', cancelInto: CANCEL.light, sound: 'slash', weight: 0.35, trail: tr(CC, 16) });
add({ id: 'cp_swipe2', family: 'cp_swipe', name: 'Cape Swipe', tags: ['light', 'string'], startup: 4, active: 4, recovery: 12, damage: 8, hitstun: 26, kbX: 300, kbY: -140, hitstop: 4, shake: 4, hitbox: { x: 70, y: 96, r: 70 }, reach: 90, maxTargets: 4, next: 'cp_swipe', cancelInto: CANCEL.light, sound: 'slash', weight: 0.4, trail: tr(CC, 16) });
add({ id: 'cp_wrap', name: 'Wrap & Hurl', tags: ['heavy'], startup: 9, active: 4, recovery: 18, damage: 14, hitstun: 40, kbX: 980, kbY: -320, hitstop: 8, shake: 11, zoom: 0.3, hitbox: { x: 60, y: 92, r: 52 }, reach: 74, maxTargets: 1, grab: { bowl: 1.5, respectPoise: true, hold: 26 }, cancelInto: CANCEL.heavy, sound: 'heavy', weight: 0.9, afterimage: true, trail: tr(CC, 18) });
add({ id: 'cp_flourish', name: 'Flourish', tags: ['light'], startup: 5, active: 12, recovery: 12, damage: 4, hitstun: 26, kbX: 200, kbY: -260, hitstop: 2, shake: 3, hitbox: { x: 0, y: 100, r: 130 }, reach: 60, maxTargets: 8, multiHit: { interval: 4, count: 3 }, cancelFrom: 12, cancelInto: CANCEL.light, sound: 'slash', weight: 0.4, trail: tr(CC, 14), fx: { whirl: 130 } });
add({ id: 'cp_toss', name: 'Shoulder Toss', tags: ['heavy'], startup: 10, active: 4, recovery: 18, damage: 13, hitstun: 40, kbX: 700, kbY: -900, hitstop: 7, shake: 10, hitbox: { x: 60, y: 92, r: 52 }, reach: 74, maxTargets: 1, grab: { bowl: 1.3, respectPoise: true, hold: 22, behind: true }, cancelInto: CANCEL.heavy, sound: 'heavy', weight: 0.85, trail: tr(CC, 16) });
add({ id: 'cp_rise', family: 'cp_rise', name: 'Rising Cloak', tags: ['launcher'], startup: 7, active: 3, recovery: 15, damage: 9, hitstun: 40, kbX: 30, kbY: 0, launch: -1250, follow: true, hitbox: { x: 50, y: 110, r: 60 }, reach: 70, grid: 1, cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'], sound: 'kick', weight: 0.6, trail: tr(CC, 14) });
add({ id: 'cp_sweep', name: 'Low Sweep', tags: ['light', 'sweep'], startup: 5, active: 4, recovery: 13, damage: 7, hitstun: 30, kbX: 160, kbY: -340, knockdown: true, hitbox: { x: 70, y: 24, r: 60 }, reach: 80, maxTargets: 5, cancelInto: CANCEL.light, sound: 'slash', weight: 0.4, trail: tr(CC, 14) });
add({ id: 'cp_veronica', name: 'Veronica', tags: ['heavy', 'sweep'], startup: 6, active: 4, recovery: 14, damage: 10, hitstun: 34, kbX: -320, kbY: -260, hitstop: 5, shake: 6, behind: true, travel: 240, hitbox: { x: 40, y: 96, r: 60 }, reach: 200, maxTargets: 4, cancelInto: CANCEL.heavy, sound: 'slash', weight: 0.7, afterimage: true, trail: tr(CC, 16) });
add({ id: 'cp_drop', name: 'Cloak Drop', tags: ['light', 'down'], startup: 8, active: 3, recovery: 16, damage: 9, hitstun: 30, kbX: 260, kbY: -380, hitstop: 5, shake: 7, hitbox: { x: 0, y: 30, r: 0 }, aoe: 150, reach: 70, maxTargets: 8, knockdown: true, cancelInto: CANCEL.light, sound: 'stomp', weight: 0.6, trail: tr(CC, 14) });
add({ id: 'cp_aswipe', family: 'cp_swipe', name: 'Air Swipe', tags: ['air', 'light'], startup: 4, active: 4, recovery: 12, damage: 7, hitstun: 32, kbX: 200, kbY: -320, selfVY: -160, hitbox: { x: 60, y: 90, r: 66 }, reach: 80, maxTargets: 4, cancelInto: CANCEL.air, sound: 'slash', weight: 0.35, trail: tr(CC, 14) });
add({ id: 'cp_aup', family: 'cp_rise', name: 'Air Cloak', tags: ['air', 'light', 'rising'], startup: 5, active: 3, recovery: 14, damage: 8, hitstun: 36, kbX: 40, kbY: -900, selfVY: -560, hitbox: { x: 40, y: 120, r: 60 }, reach: 60, cancelInto: CANCEL.air, sound: 'kick', weight: 0.5, trail: tr(CC, 14) });
add({ id: 'cp_aspike', family: 'spike', name: 'Cloak Spike', tags: ['air', 'down', 'light'], startup: 6, active: 3, recovery: 18, damage: 11, hitstun: 40, kbX: 200, kbY: 1650, spike: true, selfVY: -360, hitbox: { x: 40, y: 40, r: 62 }, reach: 70, cancelInto: ['dodge', 'special'], sound: 'spike', weight: 0.85, trail: tr(CC, 16) });
const capeAnims = [
  tplAnim('cp_swipe', m.cp_swipe, 'slash'), tplAnim('cp_swipe2', m.cp_swipe2, 'slash', { aU: 1.5 }), tplAnim('cp_wrap', m.cp_wrap, 'throw'),
  tplAnim('cp_flourish', m.cp_flourish, 'twirl'), tplAnim('cp_toss', m.cp_toss, 'throw', { spin: 0.4 }), tplAnim('cp_rise', m.cp_rise, 'upper'),
  tplAnim('cp_sweep', m.cp_sweep, 'low'), tplAnim('cp_veronica', m.cp_veronica, 'dash'), tplAnim('cp_drop', m.cp_drop, 'slam'),
  tplAnim('cp_aswipe', m.cp_aswipe, 'air'), tplAnim('cp_aup', m.cp_aup, 'airUp'), tplAnim('cp_aspike', m.cp_aspike, 'airDown'),
];
export const cape: WeaponDef = {
  id: 'cape', name: 'Cape', desc: 'A matador’s cloak: wide swipes, wrap-and-hurl grabs and a pass that leaves you behind them.',
  ground: { side: { light: 'cp_swipe', heavy: 'cp_wrap' }, upDiag: { light: 'cp_flourish', heavy: 'cp_toss' }, up: { light: 'cp_rise', heavy: 'cp_rise' }, downDiag: { light: 'cp_sweep', heavy: 'cp_veronica' }, down: { light: 'cp_drop', heavy: 'cp_drop' } },
  air: { side: { light: 'cp_aswipe', heavy: 'cp_aswipe' }, upDiag: { light: 'cp_aup', heavy: 'cp_aup' }, up: { light: 'cp_aup', heavy: 'cp_aup' }, downDiag: { light: 'cp_aspike', heavy: 'cp_aspike' }, down: { light: 'cp_aspike', heavy: 'cp_aspike' } },
  dodge: { distance: PLAYER.dodgeDistance * 1.15, frames: PLAYER.dodgeFrames, rope: false }, anims: capeAnims, smears: {},
  tips: ['→ cape swipes · heavy: WRAP & HURL', '↗ flourish · heavy: shoulder toss', '↘ low sweep · heavy: VERONICA (pass behind them)', '↑ rising cloak launcher'],
  icon(ctx, x, y, s, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - s * 0.25, y - s * 0.4); ctx.lineTo(x + s * 0.25, y - s * 0.4);
    ctx.quadraticCurveTo(x + s * 0.45, y + s * 0.1, x + s * 0.4, y + s * 0.42); ctx.lineTo(x - s * 0.4, y + s * 0.42); ctx.quadraticCurveTo(x - s * 0.45, y + s * 0.1, x - s * 0.25, y - s * 0.4); ctx.fill();
  },
  // the cloak, held out from the lead hand and draped down (black, red lining at the edge)
  held(ctx, f, j, col, wpp) {
    const [hx, hy] = forearm(j); const s = f.scale, face = f.facing || 1;
    const bx = j[J.handB * 2], by = j[J.handB * 2 + 1];
    const sway = Math.sin((f.stateFrame || 0) * 0.18) * 4 * s;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(bx, by);
    ctx.quadraticCurveTo(bx - face * 6 * s, by + 40 * s, bx - face * 4 * s + sway, by + 62 * s);
    ctx.lineTo(hx + face * 14 * s + sway, hy + 66 * s); ctx.quadraticCurveTo(hx + face * 12 * s, hy + 30 * s, hx, hy); ctx.fill();
    stroke(ctx, CC, 1.8 * wpp + 0.4); ctx.beginPath(); ctx.moveTo(bx - face * 4 * s + sway, by + 62 * s); ctx.lineTo(hx + face * 14 * s + sway, hy + 66 * s); ctx.stroke();
  },
};

// ---------------------------------------------------------------- WAR FAN
const FC = '#2436e6';
add({ id: 'fn_cut', family: 'fn_cut', name: 'Fan Cut', tags: ['light', 'string'], startup: 3, active: 3, recovery: 10, damage: 6, hitstun: 22, kbX: 160, kbY: -40, hitstop: 2, shake: 2, hitbox: { x: 60, y: 100, r: 50 }, reach: 80, maxTargets: 3, next: 'fn_cut2', cancelInto: CANCEL.light, sound: 'slash', weight: 0.3, trail: tr(FC) });
add({ id: 'fn_cut2', family: 'fn_cut', name: 'Fan Cut', tags: ['light', 'string'], startup: 3, active: 3, recovery: 10, damage: 7, hitstun: 24, kbX: 220, kbY: -100, hitstop: 3, shake: 3, hitbox: { x: 60, y: 100, r: 50 }, reach: 80, maxTargets: 3, next: 'fn_cut', cancelInto: CANCEL.light, sound: 'slash', weight: 0.35, trail: tr(FC) });
add({ id: 'fn_gust', name: 'Gust', tags: ['heavy'], startup: 12, active: 4, recovery: 18, damage: 8, hitstun: 36, kbX: 1100, kbY: -260, knockdown: true, hitstop: 5, shake: 9, zoom: 0.2, hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 480, dash: false, aimCone: 40, maxTargets: 10, beam: { len: 480, width: 90, pierce: true, color: '#1b1a17', style: 'ink' }, cancelInto: CANCEL.heavy, sound: 'heavy', weight: 0.8, trail: tr(FC, 18) });
add({ id: 'fn_lift', name: 'Rising Fan', tags: ['light'], startup: 5, active: 3, recovery: 12, damage: 7, hitstun: 30, kbX: 120, kbY: -640, hitbox: { x: 50, y: 120, r: 56 }, reach: 70, maxTargets: 3, cancelInto: CANCEL.light, sound: 'slash', weight: 0.4, trail: tr(FC) });
add({ id: 'fn_cyclone', name: 'Cyclone', tags: ['heavy'], startup: 8, active: 18, recovery: 14, damage: 4, hitstun: 26, kbX: 260, kbY: -420, hitstop: 2, shake: 4, hitbox: { x: 0, y: 100, r: 150 }, reach: 60, maxTargets: 10, multiHit: { interval: 4, count: 5 }, cancelFrom: 18, cancelInto: CANCEL.heavy, sound: 'slash', weight: 0.6, trail: tr(FC, 16), fx: { whirl: 160 } });
add({ id: 'fn_updraft', family: 'fn_updraft', name: 'Updraft', tags: ['launcher'], startup: 7, active: 3, recovery: 15, damage: 9, hitstun: 40, kbX: 30, kbY: 0, launch: -1320, follow: true, hitbox: { x: 50, y: 110, r: 60 }, reach: 70, grid: 1, cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'], sound: 'kick', weight: 0.6, trail: tr(FC, 14) });
add({ id: 'fn_sweep', name: 'Low Fan', tags: ['light', 'sweep'], startup: 5, active: 3, recovery: 12, damage: 6, hitstun: 28, kbX: 140, kbY: -320, knockdown: true, hitbox: { x: 60, y: 24, r: 50 }, reach: 70, maxTargets: 4, cancelInto: CANCEL.light, sound: 'slash', weight: 0.35, trail: tr(FC) });
add({ id: 'fn_shield', name: 'Open Fan', tags: ['heavy'], startup: 4, active: 40, recovery: 10, damage: 3, hitstun: 20, kbX: 300, kbY: -100, hitbox: { x: 50, y: 100, r: 70 }, reach: 60, maxTargets: 6, multiHit: { interval: 10, count: 4 }, deflect: true, cancelFrom: 10, cancelInto: ['dodge', 'special'], sound: 'slash', weight: 0.4, trail: tr(FC, 14) });
add({ id: 'fn_slam', name: 'Fan Slam', tags: ['light', 'down'], startup: 8, active: 3, recovery: 16, damage: 9, hitstun: 30, kbX: 380, kbY: -300, hitstop: 5, shake: 7, hitbox: { x: 0, y: 30, r: 0 }, aoe: 160, reach: 70, maxTargets: 8, knockdown: true, cancelInto: CANCEL.light, sound: 'stomp', weight: 0.6, trail: tr(FC) });
add({ id: 'fn_acut', family: 'fn_cut', name: 'Air Cut', tags: ['air', 'light'], startup: 3, active: 3, recovery: 11, damage: 6, hitstun: 30, kbX: 180, kbY: -300, selfVY: -140, hitbox: { x: 56, y: 90, r: 54 }, reach: 74, maxTargets: 3, cancelInto: CANCEL.air, sound: 'slash', weight: 0.3, trail: tr(FC) });
add({ id: 'fn_drift', name: 'Parasol Drift', tags: ['air', 'light'], startup: 4, active: 6, recovery: 18, damage: 5, hitstun: 28, kbX: 160, kbY: -200, selfVY: -520, hitbox: { x: 0, y: 140, r: 70 }, reach: 40, maxTargets: 4, cancelInto: CANCEL.air, sound: 'kick', weight: 0.3, trail: tr(FC) });
add({ id: 'fn_aspike', family: 'spike', name: 'Fan Spike', tags: ['air', 'down', 'light'], startup: 5, active: 3, recovery: 18, damage: 10, hitstun: 40, kbX: 200, kbY: 1650, spike: true, selfVY: -360, hitbox: { x: 40, y: 40, r: 56 }, reach: 70, cancelInto: ['dodge', 'special'], sound: 'spike', weight: 0.8, trail: tr(FC, 14) });
const fanAnims = [
  tplAnim('fn_cut', m.fn_cut, 'slash'), tplAnim('fn_cut2', m.fn_cut2, 'slash', { aU: 1.5 }), tplAnim('fn_gust', m.fn_gust, 'shoot'),
  tplAnim('fn_lift', m.fn_lift, 'upper'), tplAnim('fn_cyclone', m.fn_cyclone, 'twirl'), tplAnim('fn_updraft', m.fn_updraft, 'shootUp'),
  tplAnim('fn_sweep', m.fn_sweep, 'low'), tplAnim('fn_shield', m.fn_shield, 'shoot', { aU: 1.7, aL: 0.1 }), tplAnim('fn_slam', m.fn_slam, 'slam'),
  tplAnim('fn_acut', m.fn_acut, 'air'), tplAnim('fn_drift', m.fn_drift, 'airUp'), tplAnim('fn_aspike', m.fn_aspike, 'airDown'),
];
export const fan: WeaponDef = {
  id: 'fan', name: 'War Fan', desc: 'Quick cuts, a gust that blows the whole line away, an open-fan dart shield and an updraft.',
  ground: { side: { light: 'fn_cut', heavy: 'fn_gust' }, upDiag: { light: 'fn_lift', heavy: 'fn_cyclone' }, up: { light: 'fn_updraft', heavy: 'fn_updraft' }, downDiag: { light: 'fn_sweep', heavy: 'fn_shield' }, down: { light: 'fn_slam', heavy: 'fn_slam' } },
  air: { side: { light: 'fn_acut', heavy: 'fn_acut' }, upDiag: { light: 'fn_drift', heavy: 'fn_drift' }, up: { light: 'fn_drift', heavy: 'fn_drift' }, downDiag: { light: 'fn_aspike', heavy: 'fn_aspike' }, down: { light: 'fn_aspike', heavy: 'fn_aspike' } },
  dodge: { distance: PLAYER.dodgeDistance, frames: PLAYER.dodgeFrames, rope: false }, anims: fanAnims, smears: {},
  tips: ['→ fan cuts · heavy: GUST (blows the line away)', '↘ heavy: OPEN FAN (blocks darts)', '↗ rising fan · heavy: cyclone', '↑ updraft launcher · air ↑: parasol drift'],
  icon(ctx, x, y, s, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y + s * 0.35); ctx.arc(x, y + s * 0.35, s * 0.6, -Math.PI * 0.85, -Math.PI * 0.15); ctx.closePath(); ctx.fill();
  },
  // a black folding fan opened from the lead hand, ribs in paper, a red scribble edge (frames 118 / 122)
  held(ctx, f, j, col, wpp) {
    const [hx, hy, dx, dy] = forearm(j); const s = f.scale, a0 = Math.atan2(dy, dx);
    const open = f.state === 'move' ? 0.75 : 0.45, R = 30 * s;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.arc(hx, hy, R, a0 - open, a0 + open); ctx.closePath(); ctx.fill();
    stroke(ctx, '#ffffff', 1 * wpp + 0.2); ctx.beginPath();
    for (let i = -2; i <= 2; i++) { const a = a0 + (i / 2) * open * 0.85; ctx.moveTo(hx + Math.cos(a) * 4 * s, hy + Math.sin(a) * 4 * s); ctx.lineTo(hx + Math.cos(a) * R * 0.9, hy + Math.sin(a) * R * 0.9); }
    ctx.stroke();
    stroke(ctx, '#e22424', 1.4 * wpp + 0.3); ctx.beginPath(); ctx.arc(hx, hy, R, a0 - open, a0 + open); ctx.stroke();
  },
};

// ---------------------------------------------------------------- EARTH
const EC = '#1b1a17';
const rock = (n: number, sp: number, sz: number, g: number) => ({ kind: 'blob' as const, speed: sp, count: n, spread: 26, gravity: g, homing: 0, pierce: 2, life: 60, radius: sz });
add({ id: 'ea_jab', family: 'ea_jab', name: 'Rock Fist', tags: ['light', 'string'], startup: 4, active: 3, recovery: 12, damage: 8, hitstun: 24, kbX: 240, kbY: -40, hitstop: 4, shake: 4, hitbox: { x: 56, y: 100, r: 44 }, reach: 74, next: 'ea_jab2', cancelInto: CANCEL.light, sound: 'punch', weight: 0.45, trail: tr(EC) });
add({ id: 'ea_jab2', family: 'ea_jab', name: 'Rock Fist', tags: ['light', 'string'], startup: 4, active: 3, recovery: 13, damage: 9, hitstun: 26, kbX: 320, kbY: -120, hitstop: 5, shake: 5, hitbox: { x: 56, y: 100, r: 44 }, reach: 74, next: 'ea_jab', cancelInto: CANCEL.light, sound: 'heavy', weight: 0.5, trail: tr(EC) });
add({ id: 'ea_boulder', name: 'Boulder Kick', tags: ['heavy'], startup: 12, active: 3, recovery: 20, damage: 16, hitstun: 36, kbX: 700, kbY: -360, hitstop: 7, shake: 10, hitbox: { x: 40, y: 80, r: 1 }, reach: 300, ranged: 620, dash: false, aimCone: 40, shoot: rock(1, 820, 30, 420), cancelInto: CANCEL.heavy, sound: 'heavy', weight: 0.85, trail: tr(EC, 18, 'footA') });
add({ id: 'ea_pebbles', name: 'Pebble Toss', tags: ['light'], startup: 6, active: 2, recovery: 14, damage: 5, hitstun: 22, kbX: 120, kbY: -160, hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 520, dash: false, aimCone: 80, shoot: rock(3, 900, 12, 900), cancelInto: CANCEL.light, sound: 'slash', weight: 0.3, trail: tr(EC) });
add({ id: 'ea_dome', name: 'Dust Dome', tags: ['heavy'], startup: 12, active: 30, recovery: 16, damage: 5, hitstun: 30, kbX: 420, kbY: -380, hitstop: 3, shake: 6, zoom: 0.25, hitbox: { x: 0, y: 90, r: 0 }, aoe: 240, reach: 60, maxTargets: 12, multiHit: { interval: 7, count: 4 }, cancelFrom: 30, cancelInto: CANCEL.heavy, sound: 'stomp', weight: 0.8, trail: tr(EC, 16) });
add({ id: 'ea_pillar', family: 'ea_pillar', name: 'Rock Pillar', tags: ['launcher'], startup: 7, active: 3, recovery: 16, damage: 9, hitstun: 40, kbX: 30, kbY: 0, launch: -1260, hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 520, dash: false, aimCone: 60, spikes: { count: 1, spacing: 0, start: 100, delay: 0 }, grid: 1, cancelFrom: 2, cancelInto: ['air', 'light', 'heavy', 'dodge', 'special'], sound: 'launch', weight: 0.6, trail: tr(EC) });
add({ id: 'ea_spikes', name: 'Rock Spikes', tags: ['light', 'sweep'], startup: 8, active: 3, recovery: 16, damage: 7, hitstun: 30, kbX: 120, kbY: -620, hitbox: { x: 40, y: 30, r: 1 }, reach: 80, maxTargets: 6, spikes: { count: 5, spacing: 64, start: 80, delay: 3 }, cancelInto: CANCEL.light, sound: 'stomp', weight: 0.5, trail: tr(EC) });
add({ id: 'ea_quake', name: 'Quake Line', tags: ['heavy', 'down'], startup: 14, active: 3, recovery: 22, damage: 11, hitstun: 36, kbX: 160, kbY: -900, knockdown: true, hitstop: 7, shake: 13, zoom: 0.3, hitbox: { x: 90, y: 30, r: 60 }, reach: 96, maxTargets: 8, spikes: { count: 7, spacing: 70, start: 90, delay: 3 }, cancelInto: CANCEL.heavy, sound: 'stomp', weight: 0.95, trail: tr(EC, 18) });
add({ id: 'ea_stomp', name: 'Tremor', tags: ['light', 'down'], startup: 9, active: 3, recovery: 16, damage: 8, hitstun: 30, kbX: 300, kbY: -420, hitstop: 5, shake: 8, hitbox: { x: 0, y: 30, r: 0 }, aoe: 180, reach: 70, maxTargets: 8, knockdown: true, cancelInto: CANCEL.light, sound: 'stomp', weight: 0.6, trail: tr(EC, 14, 'footA') });
add({ id: 'ea_akick', family: 'ea_jab', name: 'Air Rock', tags: ['air', 'light'], startup: 4, active: 3, recovery: 12, damage: 8, hitstun: 32, kbX: 220, kbY: -300, selfVY: -150, hitbox: { x: 56, y: 90, r: 50 }, reach: 74, maxTargets: 3, cancelInto: CANCEL.air, sound: 'kick', weight: 0.4, trail: tr(EC) });
add({ id: 'ea_aup', name: 'Rock Uppercut', tags: ['air', 'light', 'rising'], startup: 5, active: 3, recovery: 14, damage: 8, hitstun: 36, kbX: 40, kbY: -900, selfVY: -560, hitbox: { x: 40, y: 120, r: 56 }, reach: 60, cancelInto: CANCEL.air, sound: 'kick', weight: 0.5, trail: tr(EC) });
add({ id: 'ea_meteor', family: 'spike', name: 'Meteor Drop', tags: ['air', 'down', 'light'], startup: 6, active: 3, recovery: 20, damage: 12, hitstun: 40, kbX: 200, kbY: 1750, spike: true, selfVY: -300, hitbox: { x: 40, y: 40, r: 60 }, reach: 70, impactShock: { radius: 170, damage: 8 }, cancelInto: ['dodge', 'special'], sound: 'spike', weight: 0.9, trail: tr(EC, 16) });
const earthAnims = [
  tplAnim('ea_jab', m.ea_jab, 'jab'), tplAnim('ea_jab2', m.ea_jab2, 'jab', { stretch: 1.12 }), tplAnim('ea_boulder', m.ea_boulder, 'stomp'),
  tplAnim('ea_pebbles', m.ea_pebbles, 'throw'), tplAnim('ea_dome', m.ea_dome, 'slam'), tplAnim('ea_pillar', m.ea_pillar, 'slam'),
  tplAnim('ea_spikes', m.ea_spikes, 'low'), tplAnim('ea_quake', m.ea_quake, 'slam'), tplAnim('ea_stomp', m.ea_stomp, 'stomp'),
  tplAnim('ea_akick', m.ea_akick, 'air'), tplAnim('ea_aup', m.ea_aup, 'airUp'), tplAnim('ea_meteor', m.ea_meteor, 'airDown'),
];
export const earth: WeaponDef = {
  id: 'earth', name: 'Earth', desc: 'Rock gauntlets: kick boulders, raise rock spikes, and churn a dust dome around you.',
  ground: { side: { light: 'ea_jab', heavy: 'ea_boulder' }, upDiag: { light: 'ea_pebbles', heavy: 'ea_dome' }, up: { light: 'ea_pillar', heavy: 'ea_pillar' }, downDiag: { light: 'ea_spikes', heavy: 'ea_quake' }, down: { light: 'ea_stomp', heavy: 'ea_quake' } },
  air: { side: { light: 'ea_akick', heavy: 'ea_akick' }, upDiag: { light: 'ea_aup', heavy: 'ea_aup' }, up: { light: 'ea_aup', heavy: 'ea_aup' }, downDiag: { light: 'ea_meteor', heavy: 'ea_meteor' }, down: { light: 'ea_meteor', heavy: 'ea_meteor' } },
  dodge: { distance: PLAYER.dodgeDistance * 0.9, frames: PLAYER.dodgeFrames, rope: false }, anims: earthAnims, smears: {}, range: PLAYER.targetRange * 1.1,
  tips: ['→ rock fists · heavy: BOULDER KICK', '↗ pebble toss · heavy: DUST DOME', '↘ rock spikes · heavy: quake line', '↑ rock pillar launcher · air ↓ meteor drop'],
  icon(ctx, x, y, s, col) {
    ctx.fillStyle = col; ctx.beginPath();
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, r = s * (0.34 + (i % 2) * 0.08); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  },
  // rock gauntlets: a jagged stone over each fist
  held(ctx, f, j, col, wpp) {
    const s = f.scale;
    for (const [hd] of [[J.handA], [J.handB]]) {
      const x = j[hd * 2], y = j[hd * 2 + 1];
      ctx.fillStyle = col; ctx.beginPath();
      for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.3, r = (7 + (i % 2) * 2.2) * s; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
      stroke(ctx, '#ffffff', 1 * wpp + 0.2); ctx.beginPath(); ctx.moveTo(x - 3 * s, y - 2 * s); ctx.lineTo(x + 2 * s, y + 1 * s); ctx.stroke();
    }
  },
};
