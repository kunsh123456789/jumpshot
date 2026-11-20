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
export function getAnim(kind: string, name: string): AnimDef {
  return ANIMS[`${kind}.${name}`]
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

/** Register animations owned by a weapon: one drawn set serves both styles; the Lab lists them under `file`. */
export function registerAnims(defs: AnimDef[], file: string): void {
  for (const d of defs) {
    ORIGINAL[d.id] = d; HAND[d.id] = d; ANIMS[d.id] = d; ANIM_FILE[d.id] = file;
    if (!HAND_IDS.includes(d.id)) HAND_IDS.push(d.id);
    if (!HAND_AUTHORED.includes(d.id)) HAND_AUTHORED.push(d.id);
  }
}
