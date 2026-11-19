import type { AnimDef } from './types';
import * as loco from './locomotion';
import * as ground from './playerGround';
import * as air from './playerAir';
import * as react from './reactions';
import * as enemy from './enemies';

/** Registry of every authored animation, by id. */
export const ANIMS: Record<string, AnimDef> = {};
for (const mod of [loco, ground, air, react, enemy] as Record<string, unknown>[]) {
  for (const v of Object.values(mod)) {
    const d = v as AnimDef;
    if (d && typeof d === 'object' && 'keys' in d && 'id' in d && Array.isArray(d.keys)) ANIMS[d.id] = d;
  }
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
