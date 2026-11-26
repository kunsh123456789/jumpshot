import type { PoseSpec } from '../../render/rig';
import { Ch, POSE_N } from '../../render/rig';

/**
 * Weapon grip layer (revision pass 8, A0). Body animations (idle, run, jump,
 * fall, landing, crouch) are authored once; each weapon lays a grip pose for
 * the ARMS on top, per locomotion state, so the held object reads correctly
 * (a staff across the body on the run, a pistol raised at idle, a hammer on
 * the shoulder). The held drawing is solved from the hand joints every frame
 * (heldArt.ts: a pole is drawn THROUGH both hands, single-hand objects hang
 * off the lead hand along the forearm), so the hands always stay on the
 * weapon. `w` is the blend weight: 1 = the grip owns the arms, lower keeps
 * some of the body's arm swing.
 */
export type GripState = 'idle' | 'run' | 'air' | 'crouch' | 'land';
export interface GripSet { idle?: PoseSpec; run?: PoseSpec; air?: PoseSpec; crouch?: PoseSpec; land?: PoseSpec; w?: number; runW?: number }

const POLE: GripSet = {
  idle: { aU: 1.25, aL: 0.9, bU: 0.5, bL: 1.65 },
  run: { aU: 0.95, aL: 1.35, bU: 0.3, bL: 1.95 },
  air: { aU: 1.85, aL: 0.55, bU: 1.05, bL: 1.2 },
  crouch: { aU: 1.5, aL: 0.8, bU: 0.75, bL: 1.6 },
  land: { aU: 1.0, aL: 1.0, bU: 0.35, bL: 1.7 },
  w: 1, runW: 1,
};
const PISTOL: GripSet = {
  idle: { aU: 1.48, aL: 0.12, bU: 0.45, bL: 2.1 },
  run: { aU: 0.95, aL: 0.85, bU: 0.3, bL: 2.0 },
  air: { aU: 1.35, aL: 0.3, bU: 0.6, bL: 1.6 },
  crouch: { aU: 1.55, aL: 0.1, bU: 1.3, bL: 0.5 },
  w: 1, runW: 0.8,
};
const HEAVY: GripSet = {
  idle: { aU: 2.0, aL: 1.65, bU: 1.75, bL: 1.6 },
  run: { aU: 2.05, aL: 1.7, bU: 1.8, bL: 1.6 },
  air: { aU: 2.7, aL: 1.0, bU: 2.5, bL: 1.1 },
  crouch: { aU: 1.9, aL: 1.7, bU: 1.6, bL: 1.6 },
  land: { aU: 0.6, aL: 0.3, bU: 0.4, bL: 0.4 },
  w: 1, runW: 1,
};
const BLADES: GripSet = {
  idle: { aU: 0.85, aL: 2.3, bU: 1.4, bL: 2.0 },
  run: { aU: -0.6, aL: 1.2, bU: -0.9, bL: 1.1 },
  air: { aU: 0.6, aL: 2.2, bU: -0.6, bL: 1.6 },
  crouch: { aU: 1.0, aL: 2.4, bU: 1.6, bL: 2.1 },
  w: 1, runW: 0.7,
};
const ROPE: GripSet = {
  idle: { aU: 0.45, aL: 1.4, bU: 1.0, bL: 1.8 },
  run: { aU: 0.2, aL: 1.6 },
  air: { aU: 2.2, aL: 0.9 },
  w: 0.8, runW: 0.5,
};
/** Grip set per weapon (fists-type weapons have none: the body's own arms are the weapon). */
export const WEAPON_GRIP: Record<string, GripSet | null> = {
  fists: null,
  staff: POLE, ice: POLE, scythe: POLE,
  laser: PISTOL, raygun: PISTOL,
  hammer: HEAVY,
  daggers: BLADES,
  hook: ROPE, whip: ROPE,
};

/** Wave-clear victory drawing per weapon (data/anims/heroSet.ts). */
export const WEAPON_VICTORY: Record<string, string> = {
  fists: 'victory_pump',
  staff: 'victory_twirl', ice: 'victory_twirl', scythe: 'victory_shoulder',
  laser: 'victory_aim', raygun: 'victory_aim',
  hammer: 'victory_shoulder', daggers: 'victory_twirl',
  hook: 'victory_twirl', whip: 'victory_pump',
};

// Compiled channel arrays (NaN = not overridden), built once.
const cache = new Map<string, Float32Array>();
const ARM = [Ch.aU, Ch.aL, Ch.bU, Ch.bL] as const;
export function gripPose(weapon: string, st: GripState): Float32Array | null {
  const g = WEAPON_GRIP[weapon];
  if (!g) return null;
  const spec = g[st] ?? (st === 'land' || st === 'crouch' ? g.idle : undefined);
  if (!spec) return null;
  const key = weapon + ':' + st;
  let a = cache.get(key);
  if (!a) {
    a = new Float32Array(POSE_N).fill(NaN);
    for (const c of ARM) { const name = (Object.keys(Ch) as (keyof typeof Ch)[]).find((k) => Ch[k] === c)!; const v = spec[name]; if (v !== undefined) a[c] = v; }
    cache.set(key, a);
  }
  return a;
}
export function gripWeight(weapon: string, st: GripState): number {
  const g = WEAPON_GRIP[weapon];
  if (!g) return 0;
  return st === 'run' ? g.runW ?? g.w ?? 1 : g.w ?? 1;
}
