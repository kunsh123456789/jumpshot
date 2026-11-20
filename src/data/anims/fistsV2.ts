import { anim, type AnimDef, type KeySpec } from './types';
import { defineVariant } from './index';
import { SMEAR_VARIANT } from '../smears';
import type { PoseSpec } from '../../render/rig';
import { MOVES } from '../moves';

/**
 * FISTS "Reference v2" drawings (after the second reference upload). Built
 * from the Legacy hand-drawn Fists set by applying what the references do
 * consistently, plus per-move touches:
 *  - crouches are deeper and wider (sheet_000-024 / gif2 0-12: the fighter
 *    lives almost on the floor between actions)
 *  - the drawing before contact is the coiled extreme: more twist, more flex
 *  - the contact drawing is the most stretched, leaning harder into the hit
 *  - the contact drawing is held 1-2 ticks longer (taken from the following
 *    drawing), so it reads through hit-stop like the reference's held impacts;
 *    the contact frame itself and every move's length are unchanged
 *  - heavies and kicks get crescent smears (the swept area of the limb)
 * The Legacy drawings stay available (Settings -> Fists animation).
 */
export const FIST_IDS = [
  'jab1', 'jab2', 'cross', 'backfist', 'hook', 'knee', 'launcher', 'launcherH', 'sweep', 'slide', 'stomp', 'stompH',
  'akick1', 'akick2', 'akick3', 'aheavy', 'aslash', 'aslashH', 'arise', 'spike', 'jumpshotFinisher', 'flurry', 'flurryEnd',
];

/** Per-move touches on top of the generic pass (applied to the contact drawing). */
const CONTACT: Record<string, PoseSpec> = {
  // jabs and the cross: a longer, rubbery reach on contact (gif2 212-230 stretched arms)
  jab1: { stretch: 1.2 }, jab2: { stretch: 1.2 }, cross: { stretch: 1.22, lean: 1.1 },
  backfist: { stretch: 1.2, spin: 0.16 },
  launcher: { stretch: 1.3, rootY: 36 }, launcherH: { stretch: 1.34, rootY: 42 },
  spike: { stretch: 1.22, spin: 0.75 }, aheavy: { stretch: 1.22 }, akick3: { stretch: 1.2, spin: 0.85 },
  flurryEnd: { stretch: 1.24 },
};

const CRESCENT = ['backfist', 'knee', 'slide', 'stompH', 'akick3', 'aheavy', 'aslashH', 'spike', 'jumpshotFinisher', 'flurryEnd', 'launcherH', 'hook'];

function refine(def: AnimDef): AnimDef {
  const keys: KeySpec[] = def.spec.keys.map((k) => ({ ...k, p: { ...k.p } }));
  const ground = def.base === 'ground';
  const ci = keys.findIndex((k) => k.impact);
  keys.forEach((k, i) => {
    const p = k.p;
    // deeper, wider crouches on the ground
    if (ground && (p.plant ?? 1) > 0.5) {
      if ((p.rootY ?? 0) < 0) p.rootY = (p.rootY as number) * 1.16 - 4;
      if (p.footA !== undefined) p.footA *= 1.1;
      if (p.footB !== undefined) p.footB *= 1.1;
    }
    if (ci < 0) return;
    if (i === ci - 1) {
      // the coiled extreme before contact
      if (p.flex !== undefined) p.flex *= 1.25;
      if (p.spin !== undefined) p.spin *= 1.25;
      if (p.lean !== undefined) p.lean -= 0.08 * Math.sign(p.lean || 1);
      p.stretch = Math.min(p.stretch ?? 1, 0.9);
    } else if (i === ci) {
      p.stretch = Math.min(1.3, (p.stretch ?? 1) + 0.06);
      if (p.lean !== undefined) p.lean += 0.08 * Math.sign(p.lean || 1);
      if (p.head !== undefined) p.head *= 1.15;
      Object.assign(p, CONTACT[def.id] ?? {});
    }
  });
  // hold the contact drawing longer: borrow up to 2 ticks from the next drawing
  if (ci >= 0 && ci + 2 < keys.length) {
    const gap = keys[ci + 2].f - keys[ci + 1].f;
    const take = Math.min(2, Math.max(0, gap - 2));
    keys[ci + 1].f += take;
  }
  const out = anim({ ...def.spec, keys });
  const drawnHolds = (def.spec as { drawn?: number[] }).drawn;
  if (drawnHolds) out.spec = { ...out.spec, drawn: keys.map((k, i) => (i + 1 < keys.length ? keys[i + 1].f : def.len) - k.f) } as typeof out.spec;
  return out;
}

defineVariant(FIST_IDS, refine);
for (const id of CRESCENT) SMEAR_VARIANT[id] = { crescent: true, chain: 4 };

/** Reference FX on Fists moves while the v2 set is active (presentation only; Legacy has none). */
const FIST_FX: Record<string, { lightning?: boolean; whirl?: number; crescent?: boolean }> = {
  jumpshotFinisher: { lightning: true, crescent: true }, flurry: { whirl: 90 }, flurryEnd: { crescent: true }, launcherH: { crescent: true },
};
let fxOn = false;
export function useFistFx(on: boolean): void {
  if (on === fxOn) return;
  fxOn = on;
  for (const id of Object.keys(FIST_FX)) if (MOVES[id]) MOVES[id].fx = on ? FIST_FX[id] : undefined;
}
