import type { DirClass } from '../moves';
import type { AnimDef } from '../anims/types';
import type { SmearCfg } from '../smears';
import type { Fighter } from '../../sim/fighter';

/**
 * Weapons (revision pass 7). A weapon is pure data plus two small draw
 * routines: the player equips one, and its moveset replaces the move lookup.
 * Every move is an ordinary MoveDef in the shared MOVES registry, resolved by
 * the shared combat code; weapon behaviour comes from the generic hooks on
 * MoveDef (ranged, aimCone, beam, grab, tether, plant, deflect, heat). Add a
 * weapon by adding a file here and listing it in index.ts.
 */
export type WeaponId = 'fists' | 'hook' | 'throw' | 'staff' | 'laser' | 'raygun';

export interface MovePair { light: string; heavy: string }
/**
 * Moveset by swipe direction class. Directions are relative to the swipe, and
 * mirrored pairs share a move (E/W = side, NE/NW = upDiag, SE/SW = downDiag):
 * the swipe's horizontal sign picks the facing, so all 8 directions are covered.
 */
export type MoveSet = Record<DirClass, MovePair>;

export interface DodgeSpec {
  /** Travel distance (world units) and length (frames). */
  distance: number;
  frames: number;
  /** Draw a rope to the wall while dodging (grappling hook). */
  rope: boolean;
}

export interface HeatSpec {
  /** Heat lost per second (heat is 0..1). */
  decayPerSec: number;
  /** Overheat lockout (s), and the heat left when it ends. */
  overheatSec: number;
  resumeAt: number;
  /** Rhythm Mode: heat vented by a Perfect-timed shot. */
  perfectVent: number;
  /** Move used for every swipe while overheated (a melee bash). */
  bash: string;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** One line for the loadout screen. */
  desc: string;
  ground: MoveSet;
  air: MoveSet;
  dodge: DodgeSpec;
  /** How the tether is drawn: a sketchy chain (hook) or a stretched arm (throw's long-arm grab). */
  ropeStyle?: 'chain' | 'arm';
  /** Auto-targeting range (world units); default PLAYER.targetRange. Ranged weapons reach further. */
  range?: number;
  /** Heat limiter instead of ammo (laser): firing adds MoveDef.heat; full heat overheats. */
  heat?: HeatSpec;
  /** Animations owned by the weapon (registered for both animation styles; listed per weapon in the Lab). */
  anims: AnimDef[];
  /** Per-animation smear configs (merged into SMEAR_BY_ANIM). */
  smears: Record<string, Partial<SmearCfg>>;
  /** First-time tooltip: the directional moves in short form. */
  tips: string[];
  /** Procedural sketch icon centred on (x, y), about s px across. */
  icon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, col: string): void;
  /** The weapon's striking segment for a joint set ([baseX, baseY, tipX, tipY] into out). When set,
   *  smeared drawings also fill the area the weapon swept with a hatched crescent (reference 2-30). */
  sweep?: (j: Float32Array, scale: number, out: Float32Array) => void;
  /** The held object, drawn over the hero from its joints (null = bare hands). */
  held: ((ctx: CanvasRenderingContext2D, f: Fighter, j: Float32Array, col: string, wpp: number) => void) | null;
}
