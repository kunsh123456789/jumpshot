import type { World } from '../sim/world';
import type { Fighter } from '../sim/fighter';
import type { SwipeEvent } from '../ui/pad';

/**
 * The only surface the simulation sees of Rhythm Mode. `world.rhythm` is null
 * in Classic Mode, and every call site is guarded by it, so Classic runs
 * exactly the code it always did.
 */
export interface RhythmSim {
  /** Heard AudioContext time (s) of the current sim step. */
  now: number;
  /** A move just started (ev = the input that started it, null for chained/auto moves). */
  onMoveStart(w: World, p: Fighter, ev: SwipeEvent | null, resnap: boolean): void;
  /** Called every tick of a player move before its frame is processed (re-syncs startup to the clock). */
  onMoveTick(w: World, p: Fighter): void;
  /** A tap started a dodge (parry window). */
  onTap(w: World, ev: SwipeEvent): void;
  /** Damage multiplier for the player's current move. */
  damageMult(w: World): number;
  /** The player's move connected. */
  onPlayerHit(w: World, v: Fighter, damage: number): void;
  /** The player parried. */
  onParry(w: World): void;
  /** May this attack-ready enemy start its wind-up now? (enemies start on beats) */
  enemyCanStart(w: World, e: Fighter): boolean;
  /** Wind-up length (frames) so the strike lands on a beat. */
  enemyWindup(w: World, e: Fighter, wind: number): number;
  /** Per wind-up tick: re-derive the remaining frames from the clock. */
  enemyWindupTick(w: World, e: Fighter): void;
  /** Beat phase/count for beat-locked idle animation (null = free-running). */
  poseBeat(): { phase: number; count: number } | null;
  /** Extra attack tokens from the song section. */
  tokenBonus(): number;
  /** Enemy cooldown multiplier from the song section. */
  cooldownMult(): number;
}
