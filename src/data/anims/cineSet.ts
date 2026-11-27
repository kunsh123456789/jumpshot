import { drawn, type AnimDef } from './types';
import type { PoseSpec } from '../../render/rig';
import { registerAnims } from './index';

/**
 * Revision pass 8, A4 + B4: bespoke drawings for the finisher and Special
 * cinematics. Scripts (data/cines.ts) also reuse the weapons' own attack
 * drawings (staff spins, laser blasts, hook throws, throw grabs) so the held
 * weapon art stays consistent; these are the beats no attack covers.
 * Ids are prefixed `cine_` (the Lab lists them under "cineSet").
 */
const CROUCH: PoseSpec = { rootY: -30, lean: 0.46, head: -0.22, aU: 1.3, aL: 1.6, bU: 0.55, bL: 2.15, footA: 34, footB: -38, flex: -4 };

/** Meteor axe-kick, part 1: flipped over the target, kicking leg chambered straight up. */
export const axeWind = drawn({ id: 'cine_axeWind', base: 'air', drawings: [
  { hold: 4, p: { spin: -0.2, lean: -0.2, head: 0.2, laU: 2.7, laL: -0.4, lbU: -0.3, lbL: -0.6, aU: 2.2, aL: 0.6, bU: -1.6, bL: 0.4, stretch: 1.05 } },
  { hold: 6, p: { spin: -0.35, lean: -0.32, head: 0.3, laU: 3.05, laL: -0.05, lbU: -0.35, lbL: -0.5, aU: 2.5, aL: 0.4, bU: -1.9, bL: 0.3, stretch: 1.12 } },
  { hold: 30, p: { spin: -0.38, lean: -0.35, head: 0.32, laU: 3.1, laL: -0.02, lbU: -0.4, lbL: -0.5, aU: 2.55, aL: 0.4, bU: -1.95, bL: 0.3, stretch: 1.14 } },
] });
/** Meteor axe-kick, part 2: the heel comes down through the target. */
export const axeHit = drawn({ id: 'cine_axeHit', base: 'air', strike: 'leg', drawings: [
  { hold: 2, p: { spin: 0.1, lean: 0.3, head: -0.1, laU: 1.9, laL: -0.05, lbU: -0.5, lbL: -0.4, aU: 1.0, aL: 0.4, bU: -2.4, bL: 0.2, stretch: 1.12 }, smear: ['footA'] },
  { hold: 6, p: { spin: 0.25, lean: 0.62, head: -0.3, laU: 0.35, laL: 0.0, lbU: -0.6, lbL: -0.5, aU: -0.6, aL: 0.5, bU: -2.6, bL: 0.2, stretch: 1.16 }, smear: ['footA'], impact: true },
  { hold: 10, p: { spin: 0.2, lean: 0.55, head: -0.25, laU: 0.4, laL: -0.1, lbU: -0.4, lbL: -0.6, aU: -0.4, aL: 0.6, bU: -2.3, bL: 0.4 } },
  { hold: 12, p: { spin: 0.05, lean: 0.2, laU: 0.6, laL: -0.8, lbU: 0.0, lbL: -0.8, aU: 2.2, aL: 0.8, bU: 1.8, bL: 0.9 } },
] });
/** Spinning roundhouse KO: coil (back turned), then the leg sweeps through at head height. */
export const roundhouse = drawn({ id: 'cine_roundhouse', strike: 'leg', drawings: [
  { hold: 6, p: { ...CROUCH, spin: -0.5, rootY: -36, lean: 0.2, aU: 2.0, aL: 1.0, bU: 0.4, bL: 1.8, head: 0.1 } },
  { hold: 6, p: { spin: -1.1, plant: 0.4, rootY: -20, lean: -0.1, laU: 1.2, laL: -2.4, aU: 2.4, aL: 0.6, bU: -0.8, bL: 0.8, head: 0.3 } },
  { hold: 3, p: { spin: -0.4, plant: 0.3, rootY: -10, lean: -0.5, laU: 1.6, laL: -0.9, aU: -0.6, aL: 0.8, bU: 2.3, bL: 0.5, head: 0.1 }, smear: ['footA'] },
  { hold: 14, p: { spin: 0.3, plant: 0.3, rootY: -6, lean: -0.82, laU: 1.95, laL: 0.0, lbU: -0.3, lbL: -0.4, aU: -1.2, aL: 0.6, bU: 2.6, bL: 0.4, head: -0.1, stretch: 1.16 }, smear: ['footA'], impact: true },
  { hold: 8, p: { spin: 0.5, plant: 0.3, rootY: -14, lean: -0.5, laU: 1.6, laL: -0.5, aU: -0.8, aL: 0.7, bU: 2.0, bL: 0.6 } },
  { hold: 8, p: { spin: 0.2, rootY: -24, lean: 0.2, aU: 1.6, aL: 1.4, bU: 0.4, bL: 2.0, footA: 30, footB: -34 } },
  { hold: 16, p: { rootY: -12, lean: 0.0, head: -0.35, aU: 2.95, aL: 0.4, bU: 0.4, bL: 2.0, footA: 28, footB: -28 } },
] });
/** X-slash: two diagonal cuts crossing, ending turned away with the weapon held low. */
export const xslash = drawn({ id: 'cine_xslash', strike: 'arm', drawings: [
  { hold: 5, p: { ...CROUCH, rootY: -40, aU: 2.8, aL: 0.3, bU: 2.4, bL: 0.6, spin: -0.2, lean: 0.2 } },
  { hold: 3, p: { ...CROUCH, rootY: -52, lean: 1.0, rootX: 30, aU: 0.6, aL: 0.0, bU: 0.4, bL: 0.4, footA: 60, footB: -50, stretch: 1.12 }, smear: ['handA', 'handB'], impact: true },
  { hold: 4, p: { ...CROUCH, rootY: -40, lean: 0.4, rootX: 34, aU: -0.6, aL: 0.4, bU: -0.8, bL: 0.4, spin: 0.3 } },
  { hold: 3, p: { ...CROUCH, rootY: -50, lean: 0.9, rootX: 40, aU: 2.6, aL: 0.0, bU: 2.2, bL: 0.2, spin: -0.3, stretch: 1.1 }, smear: ['handA', 'handB'] },
  { hold: 24, p: { ...CROUCH, rootY: -56, lean: 0.7, rootX: 44, aU: 0.2, aL: 0.1, bU: -0.6, bL: 0.3, footA: 56, footB: -52, head: 0.2 } },
  { hold: 10, p: { ...CROUCH, rootX: 30 } },
] });
/**
 * Spinning in place with the victim held at arm's length (Hammer Swing / bowling toss). In a
 * side view a turn reads as the arms sweeping front -> foreshortened -> back -> front with the
 * body leaning back against the pull (the orbiting victim sells the rest); four drawings, looped.
 */
const SPIN: PoseSpec = { rootY: -26, lean: -0.28, head: 0.15, footA: 32, footB: -26, flex: 6 };
export const spinGrab = drawn({ id: 'cine_spin', loop: true, drawings: [
  { hold: 3, p: { ...SPIN, aU: 1.62, aL: 0.0, bU: 1.45, bL: 0.15 } },
  { hold: 3, p: { ...SPIN, aU: 1.0, aL: 0.6, bU: 0.8, bL: 0.7, lean: -0.18, head: 0.25 } },
  { hold: 3, p: { ...SPIN, aU: -1.55, aL: 0.05, bU: -1.4, bL: 0.15, lean: 0.1, head: -0.05, footA: 26, footB: -32 } },
  { hold: 3, p: { ...SPIN, aU: 0.6, aL: 0.3, bU: 0.4, bL: 0.4, lean: -0.2, head: 0.2 } },
] });
/** Release of the hurl: thrown forward, follow-through, recover. */
export const hurl = drawn({ id: 'cine_hurl', strike: 'arm', drawings: [
  { hold: 3, p: { rootY: -30, lean: -0.3, aU: -1.2, aL: 0.3, bU: -1.0, bL: 0.4, spin: -0.4, footA: 40, footB: -30, head: 0.2 } },
  { hold: 10, p: { rootY: -34, lean: 0.95, rootX: 18, aU: 1.9, aL: 0.0, bU: 1.7, bL: 0.1, footA: 56, footB: -50, head: -0.35, stretch: 1.12 }, smear: ['handA', 'handB'], impact: true },
  { hold: 10, p: { rootY: -32, lean: 0.75, rootX: 16, aU: 1.5, aL: 0.4, bU: 1.3, bL: 0.6, footA: 50, footB: -48 } },
  { hold: 8, p: CROUCH },
] });
/** Mid-air pile-driver: upside down, gripping the victim below, spinning (sim adds the turn). */
export const pileDrive = drawn({ id: 'cine_pile', base: 'air', drawings: [
  { hold: 40, p: { spin: 3.14, lean: 0.0, head: 0.2, aU: 0.25, aL: 0.5, bU: -0.25, bL: 0.5, laU: 0.3, laL: -0.3, lbU: -0.3, lbL: -0.3, stretch: 1.05 } },
] });
/** Fist into the floor: the ground eruption that starts the Mega Jumpshot. */
export const erupt = drawn({ id: 'cine_erupt', strike: 'arm', drawings: [
  { hold: 6, p: { rootY: -10, lean: -0.2, head: -0.3, aU: 3.1, aL: 0.4, bU: 2.4, bL: 0.6, footA: 30, footB: -30, stretch: 1.06 } },
  { hold: 3, p: { rootY: -50, lean: 0.9, head: 0.0, aU: 2.0, aL: 0.2, bU: 1.0, bL: 1.0, footA: 44, footB: -40 }, smear: ['handA'] },
  { hold: 18, p: { rootY: -66, lean: 1.15, head: 0.25, aU: 0.25, aL: 0.0, bU: -1.4, bL: 0.3, footA: 50, footB: -44, stretch: 0.9 }, smear: ['handA'], impact: true },
  { hold: 8, p: { rootY: -50, lean: 0.8, head: 0.0, aU: 0.6, aL: 0.6, bU: -0.6, bL: 0.6, footA: 46, footB: -40 } },
] });
/** Laser charge-up: braced low, both arms forward, shaking (two alternating drawings). */
export const charge = drawn({ id: 'cine_charge', loop: true, drawings: [
  { hold: 3, p: { rootY: -36, lean: 0.25, head: -0.2, aU: 1.52, aL: 0.08, bU: 1.42, bL: 0.3, footA: 44, footB: -46, stretch: 0.96 } },
  { hold: 3, p: { rootY: -38, lean: 0.28, head: -0.24, rootX: -2, aU: 1.56, aL: 0.05, bU: 1.45, bL: 0.28, footA: 44, footB: -46, stretch: 0.95 } },
] });
/** Laser mega-beam hold: recoil leaning back, arms locked forward. */
export const beamHold = drawn({ id: 'cine_beam', loop: true, drawings: [
  { hold: 3, p: { rootY: -34, lean: -0.15, head: 0.0, rootX: -6, aU: 1.57, aL: 0.0, bU: 1.48, bL: 0.2, footA: 50, footB: -52, stretch: 1.02 } },
  { hold: 3, p: { rootY: -36, lean: -0.2, head: 0.05, rootX: -9, aU: 1.6, aL: 0.0, bU: 1.5, bL: 0.18, footA: 50, footB: -52, stretch: 1.03 } },
] });
/** The Special's activation pose (inside the freeze bubble): arms crossed, then thrown wide. */
export const activate = drawn({ id: 'cine_activate', drawings: [
  { hold: 8, p: { rootY: -40, lean: 0.3, head: 0.2, aU: 1.9, aL: 2.4, bU: 1.7, bL: 2.5, footA: 36, footB: -38, flex: -6 } },
  { hold: 6, p: { rootY: -18, lean: -0.15, head: -0.35, aU: 2.6, aL: 0.2, bU: -2.4, bL: 0.2, footA: 40, footB: -40, stretch: 1.1 }, impact: true },
  { hold: 400, p: { rootY: -22, lean: -0.1, head: -0.3, aU: 2.5, aL: 0.3, bU: -2.3, bL: 0.3, footA: 40, footB: -40, stretch: 1.06 } },
] });
/** Air activation (specials started in the air): same beat, floating. */
export const activateAir = drawn({ id: 'cine_activateAir', base: 'air', drawings: [
  { hold: 8, p: { lean: 0.3, head: 0.2, aU: 1.9, aL: 2.4, bU: 1.7, bL: 2.5, laU: 1.6, laL: -2.2, lbU: 1.2, lbL: -2.1 } },
  { hold: 400, p: { lean: -0.15, head: -0.35, aU: 2.6, aL: 0.2, bU: -2.4, bL: 0.2, laU: 0.3, laL: -0.3, lbU: -0.3, lbL: -0.3, stretch: 1.1 }, impact: true },
] });
/** Staff planted in the floor, hero hanging off it: the Cyclone's floor split. */
export const plantSplit = drawn({ id: 'cine_plant', strike: 'arm', drawings: [
  { hold: 5, p: { rootY: 30, plant: 0, lean: -0.2, aU: 3.05, aL: 0.1, bU: 2.9, bL: 0.2, laU: 0.3, laL: -1.6, lbU: -0.2, lbL: -1.4, head: -0.3 } },
  { hold: 20, p: { rootY: -56, lean: 0.9, aU: 0.4, aL: 0.0, bU: 0.3, bL: 0.1, footA: 54, footB: -48, head: 0.15, stretch: 0.9 }, smear: ['handA', 'handB'], impact: true },
  { hold: 10, p: CROUCH },
] });

/**
 * Hammer KO finisher (from the player's own sketch): feet planted wide, both hands up gripping the
 * hammer high overhead, leaning back (held long), then the whole body drops into the slam.
 */
export const hammerUp = drawn({ id: 'cine_hammerUp', drawings: [
  { hold: 6, p: { rootY: -22, lean: 0.1, head: -0.1, aU: 2.3, aL: 0.9, bU: 2.1, bL: 1.1, footA: 26, footB: -28, flex: -3 } },
  { hold: 8, p: { rootY: -26, lean: -0.22, head: 0.12, aU: 2.95, aL: 0.25, bU: 2.8, bL: 0.35, footA: 30, footB: -32, flex: -5, stretch: 1.06 } },
  { hold: 30, p: { rootY: -28, lean: -0.3, head: 0.18, aU: 3.1, aL: 0.08, bU: 2.95, bL: 0.2, footA: 32, footB: -34, flex: -6, stretch: 1.1 } },
] });
export const hammerSlam = drawn({ id: 'cine_hammerSlam', strike: 'arm', drawings: [
  { hold: 2, p: { rootY: -34, lean: 0.35, head: -0.2, aU: 1.7, aL: 0.4, bU: 1.5, bL: 0.5, footA: 36, footB: -34, flex: -4, stretch: 1.08 }, smear: ['handA', 'handB'] },
  { hold: 6, p: { rootY: -50, lean: 0.85, head: -0.35, aU: 0.55, aL: 0.2, bU: 0.4, bL: 0.3, footA: 44, footB: -40, flex: -8, stretch: 0.95 }, smear: ['handA', 'handB'], impact: true },
  { hold: 18, p: { rootY: -48, lean: 0.8, head: -0.3, aU: 0.5, aL: 0.2, bU: 0.4, bL: 0.3, footA: 44, footB: -40, flex: -8 } },
  { hold: 12, p: CROUCH },
] });

/**
 * Ice Spear KO (from the player's sketch): coil back with the spear drawn behind, then a deep lunge, front knee bent,
 * back leg stretched out, both arms driving the spear straight through the target (held for the impact frame).
 */
export const iceLunge = drawn({ id: 'cine_lunge', strike: 'arm', drawings: [
  { hold: 10, p: { rootY: -36, lean: -0.12, head: 0.1, aU: 1.0, aL: 0.5, bU: 0.75, bL: 1.0, footA: 22, footB: -34, flex: -4 } },
  { hold: 4, p: { rootY: -48, lean: 0.35, head: -0.1, aU: 1.4, aL: 0.15, bU: 1.3, bL: 0.2, footA: 48, footB: -50, flex: -3, stretch: 1.06 }, smear: ['handA', 'handB'] },
  { hold: 8, p: { rootY: -56, lean: 0.72, head: -0.25, aU: 1.58, aL: 0.0, bU: 1.5, bL: 0.05, footA: 64, footB: -60, flex: -6, stretch: 1.1 }, smear: ['handA'], impact: true },
  { hold: 60, p: { rootY: -55, lean: 0.7, head: -0.22, aU: 1.56, aL: 0.0, bU: 1.48, bL: 0.06, footA: 63, footB: -59, flex: -6, stretch: 1.09 } },
] });

const ALL: AnimDef[] = [axeWind, axeHit, hammerUp, hammerSlam, iceLunge, roundhouse, xslash, spinGrab, hurl, pileDrive, erupt, charge, beamHold, activate, activateAir, plantSplit];
registerAnims(ALL, 'cineSet (pass 8)');
