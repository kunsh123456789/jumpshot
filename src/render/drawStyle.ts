import { settings } from '../core/settings';
import { useHandDrawn } from '../data/anims';
import { SMOOTH, setAttackish } from './animPlayer';
import { SMOOTH_CHAIN } from './animator';
import { ATTACKISH, SMOOTHNESS, type SmoothLevel } from '../data/smears';

setAttackish((def) => def.contact >= 0 || ATTACKISH.has(def.id));
const LEVELS: SmoothLevel[] = ['low', 'normal', 'high'];

/**
 * Hand-Drawn presentation state shared by the animator, poser and renderer.
 * Updated once per sim tick from settings (and, in Rhythm Mode, the beat grid).
 */
export const DRAW = {
  /** Stepped drawings (Hand-Drawn) vs interpolated poses (Smooth). */
  stepped: true,
  /** Sim ticks between display steps (60 / step rate). */
  stepTicks: 5,
  /** Rhythm Mode: a 16th note started this tick, so every figure steps now (keeps drawings on the musical grid). */
  gridTick: false,
  /** Rhythm Mode live: steps follow the musical grid (gridTick) instead of a fixed tick count. */
  gridMode: false,
  /** Ink page look (pixel or crisp) vs the previous smooth neon look. */
  ink: true,
};

export function syncDrawStyle(): void {
  DRAW.stepped = settings.animStyle !== 'smooth';
  DRAW.stepTicks = Math.max(3, Math.min(8, Math.round(60 / Math.max(8, Math.min(20, settings.stepRate)))));
  DRAW.ink = settings.look !== 'smooth';
  useHandDrawn(DRAW.stepped);
  const lv = Math.max(0, LEVELS.indexOf(settings.attackSmooth));
  const cfg = SMOOTHNESS[LEVELS[lv]];
  SMOOTH.level = lv; SMOOTH.bonus = cfg.bonus; SMOOTH.strikeOnes = cfg.strikeOnes;
  SMOOTH_CHAIN.max = cfg.chain;
}
