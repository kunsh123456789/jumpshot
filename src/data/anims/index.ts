import { dramatize, type AnimDef } from './types';
import * as loco from './locomotion';
import * as ground from './playerGround';
import * as air from './playerAir';
import * as react from './reactions';
import * as enemy from './enemies';
import * as hand from './handDrawn';

/** Registry of every authored animation, by id. */
export const ANIMS: Record<string, AnimDef> = {};
for (const mod of [loco, ground, air, react, enemy] as Record<string, unknown>[]) {
  for (const v of Object.values(mod)) {
    const d = v as AnimDef;
    if (d && typeof d === 'object' && 'keys' in d && 'id' in d && Array.isArray(d.keys)) ANIMS[d.id] = d;
  }
}

/** The Smooth originals, and the Hand-Drawn re-authored set (revision pass 5). */
const ORIGINAL: Record<string, AnimDef> = { ...ANIMS };
const HAND: Record<string, AnimDef> = {};
for (const v of Object.values(hand as Record<string, unknown>)) {
  const d = v as AnimDef;
  if (d && typeof d === 'object' && 'keys' in d && 'id' in d && Array.isArray(d.keys)) HAND[d.id] = d;
}
/** Ids re-authored by hand as drawings (the rest get the automatic dramatize pass). */
export const HAND_AUTHORED = Object.keys(HAND);
for (const id of Object.keys(ORIGINAL)) if (!HAND[id]) HAND[id] = dramatize(ORIGINAL[id]);
/** Ids that have a Hand-Drawn version (all of them). */
export const HAND_IDS = Object.keys(HAND);
let handActive = false;
/** Swap the registry between the Hand-Drawn drawings and the Smooth originals. */
export function useHandDrawn(on: boolean): void {
  if (on === handActive) return;
  handActive = on;
  for (const id of HAND_IDS) ANIMS[id] = on ? HAND[id] : ORIGINAL[id];
}

/** Kind-specific override -> enemy default -> shared -> idle. */
/** Kinds that borrow another kind's idle/walk/taunt drawings. */
const KIND_ALIAS: Record<string, string> = { juggernaut: 'brute', shadow: 'rusher' };
export function getAnim(kind: string, name: string): AnimDef {
  return ANIMS[`${kind}.${name}`]
    ?? (KIND_ALIAS[kind] ? ANIMS[`${KIND_ALIAS[kind]}.${name}`] : undefined)
    ?? (kind !== 'player' ? ANIMS[`enemy.${name}`] : undefined)
    ?? ANIMS[name]
    ?? (kind !== 'player' ? ANIMS['enemy.idle'] : ANIMS.idle);
}

/** Which file an animation lives in (for the lab's export header). */
export const ANIM_FILE: Record<string, string> = {};
for (const [file, mod] of [['locomotion', loco], ['playerGround', ground], ['playerAir', air], ['reactions', react], ['enemies', enemy]] as [string, Record<string, unknown>][]) {
  for (const v of Object.values(mod)) { const d = v as AnimDef; if (d && 'keys' in d && 'id' in d) ANIM_FILE[d.id] = file; }
}
for (const id of HAND_AUTHORED) ANIM_FILE[id] = 'handDrawn (Hand-Drawn) / ' + (ANIM_FILE[id] ?? '?') + ' (Smooth)';

/**
 * Alternate Hand-Drawn sets for some ids (the Fists "Reference v2" set vs the
 * Legacy drawings). `defineVariant` builds the alternate from the current
 * Hand-Drawn def; `useVariant` swaps it in or out.
 */
const LEGACY: Record<string, AnimDef> = {};
const VARIANT: Record<string, AnimDef> = {};
let variantOn = false;
export function defineVariant(ids: string[], make: (d: AnimDef) => AnimDef): void {
  for (const id of ids) {
    if (!HAND[id]) continue;
    LEGACY[id] = HAND[id];
    VARIANT[id] = make(HAND[id]);
  }
}
export function useVariant(on: boolean): void {
  if (on === variantOn) return;
  variantOn = on;
  for (const id of Object.keys(VARIANT)) {
    HAND[id] = on ? VARIANT[id] : LEGACY[id];
    if (handActive) ANIMS[id] = HAND[id];
  }
}
export function variantOf(id: string): AnimDef | undefined { return VARIANT[id]; }

/** Register animations owned by a weapon: one drawn set serves both styles; the Lab lists them under `file`. */
export function registerAnims(defs: AnimDef[], file: string): void {
  for (const d of defs) {
    ORIGINAL[d.id] = d; HAND[d.id] = d; ANIMS[d.id] = d; ANIM_FILE[d.id] = file;
    if (!HAND_IDS.includes(d.id)) HAND_IDS.push(d.id);
    if (!HAND_AUTHORED.includes(d.id)) HAND_AUTHORED.push(d.id);
  }
}
