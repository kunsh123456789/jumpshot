import { drawn, LYING_BASE, type AnimDef, type DrawingSpec } from './types';
import type { PoseSpec } from '../../render/rig';
import { registerAnims } from './index';

/**
 * Revision pass 8, PART A: the hero's jump set and the missing movement /
 * reaction drawings. Authored once on the body; weapons layer their grip pose
 * on top (data/weapons/grips.ts), so every drawing works with every weapon.
 * Same language as handDrawn.ts: low anticipation, committed extremes, long
 * holds on the floaty apex, squash on landings, held breakdowns between.
 */

/** Ground fighting crouch (same as the Hand-Drawn idle). */
const CROUCH: PoseSpec = { rootY: -30, lean: 0.46, head: -0.22, aU: 1.3, aL: 1.6, bU: 0.55, bL: 2.15, footA: 34, footB: -38, flex: -4 };

// ======================================================================= JUMP (A1)
/** Anticipation: 2 drawings over the jump squat; arms swing back, knees fold, body squashes. */
export const jumpSquat: AnimDef = drawn({
  id: 'jumpSquat',
  drawings: [
    { hold: 1, p: { rootY: -40, lean: 0.55, head: -0.05, aU: 0.2, aL: 0.9, bU: -0.3, bL: 0.8, footA: 30, footB: -30, flex: -6, stretch: 0.95 } },
    { hold: 2, p: { rootY: -44, lean: 0.58, head: 0.1, aU: -1.0, aL: 0.35, bU: -1.25, bL: 0.3, footA: 28, footB: -26, flex: -9, stretch: 0.9 } },
  ],
});
/** Launch stretch: body elongated, arms thrown up, legs snapped straight under. */
export const jumpLaunch: AnimDef = drawn({
  id: 'jumpLaunch', base: 'air',
  drawings: [
    { hold: 4, p: { lean: -0.06, head: -0.35, aU: 2.95, aL: 0.15, bU: 2.6, bL: 0.3, laU: 0.08, laL: -0.05, lbU: -0.2, lbL: -0.15, stretch: 1.2, flex: 6 } },
    { hold: 4, p: { lean: 0.02, head: -0.25, aU: 2.75, aL: 0.35, bU: 2.35, bL: 0.5, laU: 0.5, laL: -0.7, lbU: -0.15, lbL: -0.3, stretch: 1.1, flex: 3 } },
  ],
});
/** Rise: knee drives up, arms reaching. Loops while still climbing. */
export const jumpRise: AnimDef = drawn({
  id: 'jumpRise', base: 'air', loop: true,
  drawings: [
    { hold: 6, p: { lean: 0.12, head: -0.2, aU: 2.45, aL: 0.55, bU: 1.85, bL: 0.75, laU: 1.25, laL: -1.7, lbU: -0.1, lbL: -0.55, stretch: 1.04 } },
    { hold: 6, p: { lean: 0.1, head: -0.18, aU: 2.35, aL: 0.65, bU: 1.95, bL: 0.7, laU: 1.15, laL: -1.75, lbU: -0.05, lbL: -0.6, stretch: 1.03 } },
  ],
});
/** Apex hang: arms opened wide, legs loosely tucked, one long held drawing then a slight drift. */
export const jumpApex: AnimDef = drawn({
  id: 'jumpApex', base: 'air', loop: true,
  drawings: [
    { hold: 16, p: { lean: 0.16, head: 0.12, aU: 1.75, aL: 0.45, bU: -1.55, bL: 0.4, laU: 0.95, laL: -1.45, lbU: 0.35, lbL: -1.25, flex: -2 } },
    { hold: 12, p: { lean: 0.12, head: 0.16, aU: 1.85, aL: 0.5, bU: -1.45, bL: 0.45, laU: 0.9, laL: -1.5, lbU: 0.4, lbL: -1.3, flex: -2 } },
  ],
});
/** Fall: limbs flail upward, legs reach for the floor. Three drawings on fives. */
export const jumpFall: AnimDef = drawn({
  id: 'jumpFall', base: 'air', loop: true,
  drawings: [
    { hold: 5, p: { lean: -0.08, head: 0.2, aU: 2.85, aL: 0.8, bU: 2.3, bL: 1.0, laU: 0.35, laL: -0.55, lbU: -0.2, lbL: -0.35, flex: 4 } },
    { hold: 5, p: { lean: -0.04, head: 0.26, aU: 2.5, aL: 1.25, bU: 2.85, bL: 0.55, laU: 0.25, laL: -0.4, lbU: -0.3, lbL: -0.5, flex: 5 } },
    { hold: 5, p: { lean: -0.1, head: 0.18, aU: 2.95, aL: 0.6, bU: 2.45, bL: 1.1, laU: 0.4, laL: -0.65, lbU: -0.15, lbL: -0.3, flex: 4 } },
  ],
});
/** Landing squash: deep crouch with a dust puff (FX), arms thrown forward for balance. */
export const jumpLand: AnimDef = drawn({
  id: 'jumpLand',
  drawings: [
    { hold: 3, p: { rootY: -46, lean: 0.55, head: 0.2, aU: 0.6, aL: 0.5, bU: -0.5, bL: 0.4, footA: 40, footB: -36, flex: -8, stretch: 0.88 }, sfx: 'land' },
    { hold: 4, p: { rootY: -38, lean: 0.5, head: 0.05, aU: 1.0, aL: 1.1, bU: 0.1, bL: 1.4, footA: 38, footB: -36, flex: -6, stretch: 0.95 } },
    { hold: 5, p: CROUCH },
  ],
});
/** Hard landing (long fall or slam): three-point superhero landing, held, then rising. */
export const jumpHardLand: AnimDef = drawn({
  id: 'jumpHardLand',
  drawings: [
    { hold: 3, p: { rootY: -58, lean: 0.82, head: 0.35, aU: 0.15, aL: 0.25, bU: -1.55, bL: 0.2, footA: 48, footB: -44, flex: -10, stretch: 0.84 }, sfx: 'land' },
    { hold: 9, p: { rootY: -55, lean: 0.78, head: 0.3, aU: 0.2, aL: 0.3, bU: -1.45, bL: 0.25, footA: 48, footB: -44, flex: -9, stretch: 0.88 } },
    { hold: 5, p: { rootY: -48, lean: 0.7, head: -0.05, aU: 0.9, aL: 1.0, bU: -0.4, bL: 1.0, footA: 42, footB: -40, flex: -6 } },
    { hold: 5, p: CROUCH },
  ],
});
/** Double jump: tuck, then a burst kick-out (the FX adds echo copies). */
export const airJump: AnimDef = drawn({
  id: 'airJump', base: 'air',
  drawings: [
    { hold: 3, p: { lean: 0.35, head: 0.1, aU: 1.2, aL: 1.9, bU: 0.95, bL: 2.0, laU: 1.95, laL: -2.35, lbU: 1.65, lbL: -2.25, spin: -0.25, stretch: 0.9 } },
    { hold: 4, p: { lean: -0.08, head: -0.35, aU: 2.95, aL: 0.1, bU: 2.65, bL: 0.25, laU: 0.05, laL: -0.05, lbU: -0.45, lbL: -0.2, stretch: 1.16, flex: 6 } },
    { hold: 5, p: { lean: 0.1, head: -0.2, aU: 2.5, aL: 0.5, bU: 1.9, bL: 0.7, laU: 1.1, laL: -1.6, lbU: -0.1, lbL: -0.5 } },
  ],
});
/** Air drift: lean into the steering direction (forward) or brake against it (back). */
export const airDriftF: AnimDef = drawn({
  id: 'airDriftF', base: 'air', loop: true,
  drawings: [
    { hold: 7, p: { lean: 0.6, head: -0.35, aU: -0.55, aL: 0.6, bU: -0.85, bL: 0.5, laU: -0.35, laL: -0.9, lbU: -0.7, lbL: -0.6, flex: -4 } },
    { hold: 7, p: { lean: 0.55, head: -0.3, aU: -0.45, aL: 0.7, bU: -0.95, bL: 0.45, laU: -0.3, laL: -1.0, lbU: -0.75, lbL: -0.55, flex: -4 } },
  ],
});
export const airDriftB: AnimDef = drawn({
  id: 'airDriftB', base: 'air', loop: true,
  drawings: [
    { hold: 7, p: { lean: -0.45, head: 0.3, aU: 1.6, aL: 0.5, bU: 1.95, bL: 0.4, laU: 0.95, laL: -0.4, lbU: 0.6, lbL: -0.65, flex: 5 } },
    { hold: 7, p: { lean: -0.5, head: 0.35, aU: 1.7, aL: 0.45, bU: 2.05, bL: 0.35, laU: 1.0, laL: -0.35, lbU: 0.55, lbL: -0.7, flex: 5 } },
  ],
});
/** Tuck-spin flip for the Jumpshot leap / staff vault: one full forward turn, tucked tight. */
const TUCK: PoseSpec = { lean: 0.3, head: -0.1, aU: 1.0, aL: 2.1, bU: 0.75, bL: 2.15, laU: 2.05, laL: -2.45, lbU: 1.8, lbL: -2.35, stretch: 0.92 };
export const jumpFlip: AnimDef = drawn({
  id: 'jumpFlip', base: 'air',
  drawings: [
    { hold: 3, p: { lean: -0.1, head: -0.45, aU: 3.05, aL: 0.1, bU: 2.75, bL: 0.2, laU: 0.0, laL: -0.05, lbU: -0.3, lbL: -0.1, stretch: 1.18, flex: 8 } },
    { hold: 3, p: { ...TUCK, spin: 1.1 } },
    { hold: 3, p: { ...TUCK, spin: 2.3 } },
    { hold: 3, p: { ...TUCK, spin: 3.5 } },
    { hold: 3, p: { ...TUCK, spin: 4.7 } },
    { hold: 3, p: { ...TUCK, spin: 5.8, laU: 1.6, lbU: 1.2 } },
    { hold: 4, p: { lean: 0.15, head: 0.0, aU: 1.8, aL: 0.6, bU: -1.3, bL: 0.5, laU: 1.0, laL: -1.5, lbU: 0.3, lbL: -1.2, spin: 6.28 } },
  ],
});
/** Dodge hop (air dodge): tuck backward away from the threat. */
export const airDodge: AnimDef = drawn({
  id: 'airDodge', base: 'air',
  drawings: [
    { hold: 3, p: { lean: -0.55, head: 0.4, aU: 0.9, aL: 2.1, bU: 0.6, bL: 2.2, laU: 1.7, laL: -2.1, lbU: 1.35, lbL: -2.1, spin: -0.25, flex: 8 } },
    { hold: 4, p: { lean: -0.6, head: 0.45, aU: 0.8, aL: 2.2, bU: 0.5, bL: 2.3, laU: 1.8, laL: -2.2, lbU: 1.45, lbL: -2.2, spin: -0.5, flex: 9 } },
    { hold: 3, p: { lean: -0.3, head: 0.2, aU: 1.4, aL: 1.3, bU: 0.8, bL: 1.5, laU: 1.0, laL: -1.5, lbU: 0.5, lbL: -1.3, spin: -0.4 } },
    { hold: 3, p: { lean: 0.05, aU: 2.2, aL: 0.8, bU: 1.8, bL: 0.9, laU: 0.6, laL: -1.0, lbU: -0.1, lbL: -0.7 } },
  ],
});

// ======================================================================= MOVEMENT & REACTIONS (A2)
/** Bored idle (after 5 s without input): straightens up, looks around, rolls a shoulder, scratches the head. */
const STAND: PoseSpec = { rootY: -6, lean: 0.06, head: 0.0, aU: 0.25, aL: 0.4, bU: -0.15, bL: 0.35, footA: 18, footB: -18, flex: 0 };
export const idleBored: AnimDef = drawn({
  id: 'idleBored', loop: true,
  drawings: [
    { hold: 14, p: STAND },
    { hold: 16, p: { ...STAND, head: 0.45, lean: 0.0 } },
    { hold: 16, p: { ...STAND, head: -0.4, lean: 0.02 } },
    { hold: 6, p: { ...STAND, aU: 2.75, aL: 2.4, head: 0.25, lean: -0.04 } },
    { hold: 8, p: { ...STAND, aU: 2.6, aL: 2.6, head: 0.3, lean: -0.06 } },
    { hold: 6, p: { ...STAND, aU: 2.75, aL: 2.4, head: 0.25, lean: -0.04 } },
    { hold: 10, p: { ...STAND, aU: 2.9, aL: 0.2, bU: 2.7, bL: 0.25, head: -0.35, stretch: 1.04, lean: -0.1 } },
    { hold: 12, p: { ...STAND, rootY: -10 } },
  ],
});
/** Low stance (pad dragged down / S): squat behind a high guard. */
export const crouch: AnimDef = drawn({
  id: 'crouch', loop: true,
  drawings: [
    { hold: 14, p: { rootY: -46, lean: 0.6, head: -0.1, aU: 1.55, aL: 1.95, bU: 1.15, bL: 2.15, footA: 42, footB: -44, flex: -6 } },
    { hold: 14, p: { rootY: -47, lean: 0.62, head: -0.12, aU: 1.5, aL: 2.0, bU: 1.1, bL: 2.2, footA: 42, footB: -44, flex: -6 } },
  ],
});
/** The perfect-parry flash pose: a bold deflecting thrust, held on the impact frame. */
export const parryFlash: AnimDef = drawn({
  id: 'parryFlash',
  drawings: [
    { hold: 2, p: { rootY: -36, lean: -0.2, head: 0.25, aU: 2.3, aL: 1.6, bU: 0.4, bL: 2.2, footA: 30, footB: -46, flex: 8 } },
    { hold: 10, p: { rootY: -40, lean: 0.75, head: -0.35, aU: 1.75, aL: 0.05, bU: -0.9, bL: 0.6, footA: 52, footB: -50, flex: -8, stretch: 1.1 }, impact: true, smear: ['handA'] },
    { hold: 6, p: { rootY: -36, lean: 0.6, head: -0.25, aU: 1.55, aL: 0.6, bU: -0.4, bL: 1.2, footA: 46, footB: -46 } },
    { hold: 6, p: CROUCH },
  ],
});
/** Weapon swap: holster the old weapon at the hip, then draw the new one with a flourish. */
export const weaponSwap: AnimDef = drawn({
  id: 'weaponSwap',
  drawings: [
    { hold: 4, p: { ...CROUCH, rootY: -20, aU: -0.2, aL: 1.6, bU: -0.4, bL: 1.4, head: 0.3, lean: 0.2 } },
    { hold: 5, p: { ...CROUCH, rootY: -22, aU: -0.5, aL: 1.9, bU: -0.6, bL: 1.6, head: 0.35, lean: 0.25 } },
    { hold: 3, p: { ...CROUCH, rootY: -16, aU: 1.2, aL: 0.6, bU: 0.4, bL: 1.0, head: -0.1, lean: 0.1 } },
    { hold: 6, p: { ...CROUCH, rootY: -26, aU: 2.6, aL: 0.25, bU: 0.6, bL: 1.6, head: -0.3, lean: 0.05, stretch: 1.06 }, smear: ['handA'] },
    { hold: 6, p: CROUCH },
  ],
});
/** Hit from above (meteors, slams): crushed down, arms over the head. */
export const hurtAbove: AnimDef = drawn({
  id: 'hurtAbove',
  drawings: [
    { hold: 4, p: { rootY: -60, lean: 0.75, head: 0.7, aU: 2.6, aL: 1.9, bU: 2.3, bL: 2.0, footA: 40, footB: -40, flex: -10, stretch: 0.84 } },
    { hold: 6, p: { rootY: -54, lean: 0.7, head: 0.5, aU: 2.4, aL: 2.1, bU: 2.1, bL: 2.1, footA: 38, footB: -40, stretch: 0.9 } },
    { hold: 8, p: CROUCH },
  ],
});
/** Hit while airborne: knocked into a short spill (the hero isn't juggled, but reads as launched). */
export const hurtAir: AnimDef = drawn({
  id: 'hurtAir', base: 'air',
  drawings: [
    { hold: 5, p: { lean: -0.7, head: 0.9, flex: 13, aU: -1.6, aL: 0.4, bU: 2.6, bL: 0.4, laU: 0.9, laL: -0.3, lbU: -0.4, lbL: -0.5, stretch: 1.1 } },
    { hold: 6, p: { lean: -0.4, head: 0.5, aU: 2.4, aL: 0.9, bU: -1.8, bL: 0.6, laU: 1.3, laL: -1.2, lbU: 0.2, lbL: -1.0, flex: 6 } },
    { hold: 6, p: { lean: -0.1, head: 0.2, aU: 2.2, aL: 0.8, bU: 1.8, bL: 0.9, laU: 0.6, laL: -0.9, lbU: -0.1, lbL: -0.6 } },
  ],
});
/** Quick get-up (kip-up): legs swing up, then a pop to the feet. */
export const getupQuick: AnimDef = drawn({
  id: 'getupQuick',
  drawings: [
    { hold: 3, p: { ...LYING_BASE, plant: 0, rootY: -46, lean: -1.9, head: 0.4, aU: -2.9, aL: 0.6, bU: -2.7, bL: 0.6, laU: 2.9, laL: -0.4, lbU: 2.7, lbL: -0.6 } },
    { hold: 3, p: { plant: 0, rootY: -30, lean: -0.6, head: 0.2, aU: -2.6, aL: 1.6, bU: -2.4, bL: 1.6, laU: 0.6, laL: -1.6, lbU: 0.3, lbL: -1.8, stretch: 1.06 } },
    { hold: 4, p: { rootY: -50, lean: 0.6, head: -0.2, aU: 1.0, aL: 1.2, bU: 0.0, bL: 1.4, footA: 38, footB: -36, flex: -6 } },
    { hold: 4, p: CROUCH },
  ],
});
/**
 * Spawn-in entrance: the hero drops in from above the page (drawn with the root raised: pure
 * presentation, the sim body is already standing there), lands in a three-point landing and
 * comes up with a fist pump.
 */
export const entrance: AnimDef = drawn({
  id: 'entrance',
  drawings: [
    { hold: 4, p: { plant: 0, rootY: 560, lean: 0.05, head: -0.3, aU: 2.9, aL: 0.4, bU: 2.6, bL: 0.5, laU: 0.2, laL: -0.3, lbU: -0.2, lbL: -0.2, stretch: 1.12 } },
    { hold: 3, p: { plant: 0, rootY: 340, lean: 0.1, head: -0.2, aU: 2.95, aL: 0.6, bU: 2.4, bL: 0.8, laU: 0.3, laL: -0.5, lbU: -0.2, lbL: -0.3, stretch: 1.18 } },
    { hold: 2, p: { plant: 0, rootY: 130, lean: 0.3, head: 0.0, aU: 2.6, aL: 0.4, bU: 2.2, bL: 0.6, laU: 0.6, laL: -0.9, lbU: 0.1, lbL: -0.7, stretch: 1.2 } },
    { hold: 4, p: { rootY: -58, lean: 0.82, head: 0.3, aU: 0.2, aL: 0.3, bU: -1.5, bL: 0.2, footA: 48, footB: -44, flex: -10, stretch: 0.85 }, sfx: 'land' },
    { hold: 10, p: { rootY: -55, lean: 0.78, head: 0.25, aU: 0.25, aL: 0.3, bU: -1.4, bL: 0.25, footA: 48, footB: -44, flex: -9 } },
    { hold: 4, p: { rootY: -30, lean: 0.3, head: -0.2, aU: 1.4, aL: 1.6, bU: 0.4, bL: 2.0, footA: 34, footB: -36 } },
    { hold: 12, p: { rootY: -20, lean: 0.1, head: -0.35, aU: 2.9, aL: 0.9, bU: 0.4, bL: 2.1, footA: 30, footB: -30, stretch: 1.05 } },
    { hold: 6, p: CROUCH },
  ],
});
/** Game over: knees buckle, a stagger, a forward collapse face-down, a last twitch. */
export const deathCollapse: AnimDef = drawn({
  id: 'deathCollapse',
  drawings: [
    { hold: 8, p: { rootY: -22, lean: -0.35, head: 0.7, aU: -0.3, aL: 0.4, bU: -0.6, bL: 0.3, footA: 24, footB: -30, flex: 8 } },
    { hold: 10, p: { rootY: -52, lean: 0.4, head: 0.9, aU: 0.1, aL: 0.2, bU: -0.2, bL: 0.2, footA: 22, footB: -26, flex: 4 } },
    { hold: 8, p: { rootY: -66, lean: 0.9, head: 0.8, aU: 0.6, aL: 0.6, bU: 0.3, bL: 0.4, footA: 30, footB: -18, flex: -4, plant: 0.6 } },
    { hold: 6, p: { ...LYING_BASE, plant: 0, rootY: -58, lean: 1.55, head: -0.2, aU: 2.6, aL: 0.4, bU: 2.9, bL: 0.2, laU: -1.62, laL: 0.05, lbU: -1.5, lbL: 0.1 }, sfx: 'land' },
    { hold: 4, p: { ...LYING_BASE, plant: 0, rootY: -54, lean: 1.5, head: -0.1, aU: 2.4, aL: 0.6, bU: 2.8, bL: 0.4, laU: -1.4, laL: -0.4, lbU: -1.6, lbL: 0.0 } },
    { hold: 40, p: { ...LYING_BASE, plant: 0, rootY: -56, lean: 1.57, head: -0.15, aU: 2.55, aL: 0.4, bU: 2.85, bL: 0.2, laU: -1.6, laL: 0.05, lbU: -1.52, lbL: 0.1 } },
  ],
});

// ======================================================================= VICTORY POSES (one per weapon)
/** Wave-clear poses. Each weapon names one in WEAPON_VICTORY; its grip layer and held drawing make it its own. */
const V = (id: string, d: DrawingSpec[]): AnimDef => drawn({ id, drawings: d });
export const victoryPump = V('victory_pump', [
  { hold: 6, p: { ...CROUCH, rootY: -40, aU: 0.4, aL: 2.4, head: 0.2 } },
  { hold: 22, p: { rootY: -14, lean: 0.0, head: -0.45, aU: 3.05, aL: 0.1, bU: 0.3, bL: 2.3, footA: 30, footB: -30, stretch: 1.08 }, smear: ['handA'] },
  { hold: 12, p: { rootY: -16, lean: 0.02, head: -0.4, aU: 2.95, aL: 0.5, bU: 0.3, bL: 2.3, footA: 30, footB: -30 } },
  { hold: 8, p: CROUCH },
]);
export const victoryTwirl = V('victory_twirl', [
  { hold: 5, p: { ...CROUCH, aU: 2.5, aL: 0.4, bU: 2.2, bL: 0.6, spin: -0.2 } },
  { hold: 5, p: { ...CROUCH, rootY: -16, aU: 3.0, aL: 0.1, bU: 2.4, bL: 0.6, spin: 0.3 }, smear: ['handA', 'handB'] },
  { hold: 5, p: { ...CROUCH, rootY: -16, aU: 2.3, aL: 0.2, bU: 3.0, bL: 0.1, spin: -0.1 }, smear: ['handA', 'handB'] },
  { hold: 20, p: { rootY: -8, lean: -0.05, head: -0.3, aU: 0.15, aL: 0.2, bU: 2.4, bL: 1.9, footA: 26, footB: -22, stretch: 1.04 } },
  { hold: 8, p: CROUCH },
]);
export const victoryAim = V('victory_aim', [
  { hold: 6, p: { ...CROUCH, aU: 1.2, aL: 0.8, bU: 1.0, bL: 1.0 } },
  { hold: 14, p: { rootY: -18, lean: 0.15, head: -0.55, aU: 2.75, aL: 0.0, bU: 2.6, bL: 0.4, footA: 30, footB: -30, stretch: 1.04 } },
  { hold: 6, p: { rootY: -18, lean: 0.12, head: -0.3, aU: 2.2, aL: 1.4, bU: 0.3, bL: 2.2, footA: 30, footB: -30 } },
  { hold: 14, p: { rootY: -14, lean: 0.05, head: -0.2, aU: 1.6, aL: 2.3, bU: 0.4, bL: 2.2, footA: 30, footB: -30 } },
  { hold: 8, p: CROUCH },
]);
export const victoryShoulder = V('victory_shoulder', [
  { hold: 6, p: { ...CROUCH, aU: 2.6, aL: 0.4, bU: 2.4, bL: 0.5 } },
  { hold: 10, p: { rootY: -8, lean: -0.15, head: -0.25, aU: 3.2, aL: 2.4, bU: 2.9, bL: 2.3, footA: 32, footB: -32 } },
  { hold: 20, p: { rootY: -10, lean: -0.12, head: -0.3, aU: 3.1, aL: 2.5, bU: 0.4, bL: 1.0, footA: 34, footB: -34, stretch: 1.04 } },
  { hold: 8, p: CROUCH },
]);
export const victoryBow = V('victory_bow', [
  { hold: 8, p: { rootY: -10, lean: 0.05, head: 0.0, aU: 0.3, aL: 0.4, bU: -0.2, bL: 0.4, footA: 16, footB: -16 } },
  { hold: 16, p: { rootY: -14, lean: 0.85, head: 0.35, aU: 1.2, aL: 2.3, bU: -0.5, bL: 1.6, footA: 16, footB: -16 } },
  { hold: 12, p: { rootY: -10, lean: 0.05, head: -0.15, aU: 1.5, aL: 1.5, bU: 1.3, bL: 1.6, footA: 16, footB: -16 } },
  { hold: 8, p: CROUCH },
]);
export const victoryFlex = V('victory_flex', [
  { hold: 6, p: { ...CROUCH, rootY: -42, aU: 0.5, aL: 1.0, bU: 0.3, bL: 1.0 } },
  { hold: 22, p: { rootY: -24, lean: 0.0, head: -0.4, aU: 1.6, aL: 2.4, bU: -1.6, bL: -2.4, footA: 40, footB: -40, stretch: 1.06 } },
  { hold: 8, p: { rootY: -24, lean: 0.05, head: -0.25, aU: 1.7, aL: 2.2, bU: -1.5, bL: -2.2, footA: 40, footB: -40 } },
  { hold: 8, p: CROUCH },
]);

registerAnims([
  jumpSquat, jumpLaunch, jumpRise, jumpApex, jumpFall, jumpLand, jumpHardLand, airJump, airDriftF, airDriftB, jumpFlip, airDodge,
  idleBored, crouch, parryFlash, weaponSwap, hurtAbove, hurtAir, getupQuick, entrance, deathCollapse,
  victoryPump, victoryTwirl, victoryAim, victoryShoulder, victoryBow, victoryFlex,
], 'heroSet (pass 8)');
