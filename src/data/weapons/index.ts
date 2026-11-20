import type { WeaponDef, WeaponId } from './types';
import { registerAnims } from '../anims';
import { SMEAR_BY_ANIM } from '../smears';
import { fists } from './fists';
import { staff } from './staff';
import { laser } from './laser';
import { reactionAnims } from './reactions';

/** Every weapon, in loadout order. All are unlocked from the start. */
export const WEAPON_ORDER: WeaponId[] = ['fists', 'staff', 'laser'];
export const WEAPONS: Record<WeaponId, WeaponDef> = {} as Record<WeaponId, WeaponDef>;
for (const w of [fists, staff, laser]) {
  WEAPONS[w.id] = w;
  registerAnims(w.anims, `weapon: ${w.name}`);
  Object.assign(SMEAR_BY_ANIM, w.smears);
}

registerAnims(reactionAnims, 'weapon: enemy reactions');

export function weaponById(id: string): WeaponDef {
  return WEAPONS[id as WeaponId] ?? WEAPONS.fists;
}
export type { WeaponDef, WeaponId } from './types';
