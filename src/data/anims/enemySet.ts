import { drawn, type AnimDef } from './types';
import type { PoseSpec } from '../../render/rig';
import { registerAnims } from './index';

/**
 * Revision pass 8, A5: enemy personality drawings (Hand-Drawn, held drawings).
 * Each type gets its own silhouette and attitude in idle / movement / taunt:
 * the Grunt bobs on its heels, the Rusher fidgets and twitches, the Brute
 * stomps and heaves, the Kicker bounces on its toes, the Shield hunkers
 * behind its guard, the Thrower tosses a dart in its hand, the Elite stands
 * cocky. Attack telegraphs stay in enemies.ts (stretched wind-ups).
 */

// ---- Grunt ----
const GR: PoseSpec = { rootY: -12, lean: 0.24, head: -0.05, aU: 1.15, aL: 1.85, bU: 0.6, bL: 2.0, footA: 22, footB: -22 };
export const gruntIdle = drawn({ id: 'grunt.idle', loop: true, drawings: [
  { hold: 10, p: GR }, { hold: 10, p: { ...GR, rootY: -15, lean: 0.27 } }, { hold: 10, p: { ...GR, rootX: 2, head: 0.05 } }, { hold: 10, p: { ...GR, rootY: -14 } },
] });
export const gruntTaunt = drawn({ id: 'grunt.taunt', drawings: [
  { hold: 8, p: { ...GR, aU: 2.6, aL: 2.2, bU: 2.4, bL: 2.3, head: 0.25, lean: 0.0 } },
  { hold: 6, p: { ...GR, aU: 2.9, aL: 0.4, bU: 2.7, bL: 0.4, head: 0.35, lean: -0.1, stretch: 1.05 } },
  { hold: 8, p: { ...GR, aU: 2.6, aL: 2.2, bU: 2.4, bL: 2.3, head: 0.25, lean: 0.0 } },
  { hold: 6, p: { ...GR, aU: 2.9, aL: 0.4, bU: 2.7, bL: 0.4, head: 0.35, lean: -0.1, stretch: 1.05 } },
  { hold: 10, p: GR },
] });

// ---- Rusher: coiled and twitchy, never still ----
const RU: PoseSpec = { rootY: -22, lean: 0.55, head: -0.25, aU: -0.25, aL: 1.6, bU: -0.55, bL: 1.4, footA: 26, footB: -30 };
export const rusherIdle = drawn({ id: 'rusher.idle', loop: true, drawings: [
  { hold: 5, p: RU }, { hold: 3, p: { ...RU, rootX: 3, head: -0.4 } }, { hold: 5, p: { ...RU, rootY: -26, lean: 0.6 } },
  { hold: 3, p: { ...RU, aU: 0.1, aL: 1.9, head: 0.1 } }, { hold: 5, p: { ...RU, rootX: -2 } }, { hold: 3, p: { ...RU, footA: 32, liftA: 8 } },
] });
export const rusherWalk = drawn({ id: 'rusher.walk', loop: true, drawings: [
  { hold: 4, p: { ...RU, footA: 30, footB: -26, liftB: 12 }, sfx: 'step' },
  { hold: 4, p: { ...RU, rootY: -26, footA: 2, footB: 4, liftB: 26, lean: 0.62 } },
  { hold: 4, p: { ...RU, footB: 30, footA: -26, liftA: 12 }, sfx: 'step' },
  { hold: 4, p: { ...RU, rootY: -26, footB: 2, footA: 4, liftA: 26, lean: 0.62 } },
] });
export const rusherTaunt = drawn({ id: 'rusher.taunt', drawings: [
  { hold: 6, p: { ...RU, lean: 0.2, aU: 1.6, aL: 0.2, head: -0.1 } },
  { hold: 5, p: { ...RU, lean: 0.2, aU: 1.7, aL: 1.6, head: -0.1 } },
  { hold: 5, p: { ...RU, lean: 0.2, aU: 1.6, aL: 0.2, head: -0.1 } },
  { hold: 5, p: { ...RU, lean: 0.2, aU: 1.7, aL: 1.6, head: -0.1 } },
  { hold: 10, p: RU },
] });

// ---- Brute: wide, heavy; every step is a stomp ----
const BR: PoseSpec = { rootY: -18, lean: 0.34, head: 0.0, aU: 0.7, aL: 1.4, bU: 0.25, bL: 1.6, footA: 32, footB: -34 };
export const bruteIdle = drawn({ id: 'brute.idle', loop: true, drawings: [
  { hold: 18, p: BR }, { hold: 18, p: { ...BR, rootY: -23, lean: 0.4, aU: 0.78, bU: 0.32, head: 0.08, stretch: 1.03 } },
] });
export const bruteWalk = drawn({ id: 'brute.walk', loop: true, drawings: [
  { hold: 5, p: { ...BR, rootY: -26, footA: 34, footB: -22, liftB: 6, lean: 0.42, stretch: 0.96 }, sfx: 'step' },
  { hold: 7, p: { ...BR, rootY: -14, footA: 10, footB: 2, liftB: 30, lean: 0.3 } },
  { hold: 5, p: { ...BR, rootY: -26, footB: 34, footA: -22, liftA: 6, lean: 0.42, stretch: 0.96 }, sfx: 'step' },
  { hold: 7, p: { ...BR, rootY: -14, footB: 10, footA: 2, liftA: 30, lean: 0.3 } },
] });
export const bruteTaunt = drawn({ id: 'brute.taunt', drawings: [
  { hold: 6, p: { ...BR, lean: -0.1, aU: 1.6, aL: 2.4, bU: 1.4, bL: 2.4, head: -0.3 } },
  { hold: 5, p: { ...BR, lean: -0.1, aU: 1.2, aL: 2.7, bU: 1.6, bL: 2.0, head: -0.35 } },
  { hold: 5, p: { ...BR, lean: -0.1, aU: 1.6, aL: 2.0, bU: 1.2, bL: 2.7, head: -0.35 } },
  { hold: 5, p: { ...BR, lean: -0.1, aU: 1.2, aL: 2.7, bU: 1.6, bL: 2.0, head: -0.35 } },
  { hold: 8, p: { ...BR, rootY: -8, lean: -0.25, aU: 2.9, aL: 0.6, bU: 2.7, bL: 0.6, head: -0.5, stretch: 1.05 } },
  { hold: 10, p: BR },
] });

// ---- Kicker: upright, bouncing on its toes ----
const KI: PoseSpec = { rootY: -4, lean: 0.06, head: -0.05, aU: 1.3, aL: 1.7, bU: 0.7, bL: 2.0, footA: 22, footB: -22 };
export const kickerIdle = drawn({ id: 'kicker.idle', loop: true, drawings: [
  { hold: 6, p: { ...KI, rootY: -12, stretch: 0.97 } }, { hold: 6, p: { ...KI, rootY: 4, liftA: 6, liftB: 6 } },
  { hold: 6, p: { ...KI, rootY: -12, stretch: 0.97 } }, { hold: 6, p: { ...KI, rootY: 6, liftA: 14, footA: 28 } },
] });
export const kickerWalk = drawn({ id: 'kicker.walk', loop: true, drawings: [
  { hold: 5, p: { ...KI, rootY: -10, footA: 26, footB: -18 } },
  { hold: 5, p: { ...KI, rootY: 8, footA: 10, footB: -6, liftA: 12, liftB: 14 } },
  { hold: 5, p: { ...KI, rootY: -10, footB: 26, footA: -18 } },
  { hold: 5, p: { ...KI, rootY: 8, footB: 10, footA: -6, liftA: 14, liftB: 12 } },
] });
export const kickerTaunt = drawn({ id: 'kicker.taunt', drawings: [
  { hold: 5, p: { ...KI, plant: 0.3, laU: 2.0, laL: -0.1, lean: -0.6, aU: -0.5, bU: 1.8 } },
  { hold: 5, p: KI },
  { hold: 5, p: { ...KI, plant: 0.3, laU: 2.2, laL: -0.1, lean: -0.7, aU: -0.5, bU: 1.9 } },
  { hold: 5, p: KI },
  { hold: 8, p: { ...KI, aU: 2.5, aL: 1.5, head: 0.2 } },
  { hold: 8, p: KI },
] });

// ---- Shield: hunkered behind its guard ----
const SH: PoseSpec = { rootY: -24, lean: 0.4, head: 0.05, aU: 1.5, aL: 1.25, bU: 0.3, bL: 1.8, footA: 30, footB: -32 };
export const shieldIdle = drawn({ id: 'shield.idle', loop: true, drawings: [
  { hold: 14, p: SH }, { hold: 14, p: { ...SH, rootY: -27, head: 0.12 } },
] });
export const shieldWalk = drawn({ id: 'shield.walk', loop: true, drawings: [
  { hold: 6, p: { ...SH, footA: 34, footB: -26, liftB: 8 }, sfx: 'step' },
  { hold: 6, p: { ...SH, rootY: -28, footA: 12, footB: -6, liftB: 16 } },
  { hold: 6, p: { ...SH, footB: 34, footA: -26, liftA: 8 }, sfx: 'step' },
  { hold: 6, p: { ...SH, rootY: -28, footB: 12, footA: -6, liftA: 16 } },
] });
export const shieldTaunt = drawn({ id: 'shield.taunt', drawings: [
  { hold: 5, p: { ...SH, bU: 1.6, bL: 1.0 } }, { hold: 5, p: { ...SH, bU: 1.2, bL: 1.6 } },
  { hold: 5, p: { ...SH, bU: 1.6, bL: 1.0 } }, { hold: 5, p: { ...SH, bU: 1.2, bL: 1.6 } }, { hold: 10, p: SH },
] });

// ---- Thrower: tossing a dart in the hand ----
const TH: PoseSpec = { rootY: -10, lean: 0.12, head: -0.1, aU: 1.0, aL: 1.6, bU: 0.3, bL: 1.9, footA: 20, footB: -24 };
export const throwerIdle = drawn({ id: 'thrower.idle', loop: true, drawings: [
  { hold: 8, p: TH }, { hold: 6, p: { ...TH, aU: 1.3, aL: 2.2, head: -0.35 } }, { hold: 8, p: { ...TH, aU: 0.9, aL: 1.4, head: -0.15 } }, { hold: 8, p: { ...TH, rootY: -13 } },
] });
export const throwerTaunt = drawn({ id: 'thrower.taunt', drawings: [
  { hold: 6, p: { ...TH, aU: -1.0, aL: 1.0, lean: -0.2 } }, { hold: 6, p: { ...TH, aU: 2.6, aL: 0.6, head: -0.4 } },
  { hold: 6, p: { ...TH, aU: -1.0, aL: 1.0, lean: -0.2 } }, { hold: 6, p: { ...TH, aU: 2.6, aL: 0.6, head: -0.4 } }, { hold: 10, p: TH },
] });

// ---- Elite: cocky, upright, one hand beckoning ----
const EL: PoseSpec = { rootY: -8, lean: 0.1, head: -0.15, aU: 1.4, aL: 1.9, bU: -0.3, bL: 0.4, footA: 24, footB: -24 };
export const eliteIdle = drawn({ id: 'elite.idle', loop: true, drawings: [
  { hold: 12, p: EL }, { hold: 12, p: { ...EL, rootY: -11, head: -0.05 } }, { hold: 12, p: { ...EL, aU: 1.5, aL: 1.6, head: -0.25 } },
] });
export const eliteTaunt = drawn({ id: 'elite.taunt', drawings: [
  { hold: 8, p: { ...EL, aU: 1.6, aL: 0.4, lean: 0.0 } }, { hold: 6, p: { ...EL, aU: 1.7, aL: 1.9, lean: 0.0 } },
  { hold: 6, p: { ...EL, aU: 1.6, aL: 0.4, lean: 0.0 } }, { hold: 6, p: { ...EL, aU: 1.7, aL: 1.9, lean: 0.0 } }, { hold: 10, p: EL },
] });

// ---- Shared spawn-in pose (drawn while the figure fades in from dithered gray) ----
export const enemySpawn = drawn({ id: 'enemy.spawn', drawings: [
  { hold: 8, p: { rootY: -40, lean: 0.6, head: 0.3, aU: 0.4, aL: 1.0, bU: 0.0, bL: 1.0, footA: 30, footB: -30 } },
  { hold: 8, p: { rootY: -22, lean: 0.3, head: -0.1, aU: 1.1, aL: 1.8, bU: 0.6, bL: 2.0, footA: 24, footB: -24 } },
  { hold: 8, p: GR },
] });

const ALL: AnimDef[] = [gruntIdle, gruntTaunt, rusherIdle, rusherWalk, rusherTaunt, bruteIdle, bruteWalk, bruteTaunt, kickerIdle, kickerWalk, kickerTaunt,
  shieldIdle, shieldWalk, shieldTaunt, throwerIdle, throwerTaunt, eliteIdle, eliteTaunt, enemySpawn];
registerAnims(ALL, 'enemySet (pass 8)');
