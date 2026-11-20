import { GOOD, GREAT, MISS, PERFECT, RHYTHM, type Grade } from '../data/rhythm';
import type { BeatClock } from './beatClock';

export interface Judgement {
  grade: Grade;
  /** Signed ms from the nearest beat (+ = late). */
  deltaMs: number;
  /** Beat number the input was judged against. */
  beat: number;
}

/**
 * Judge an input heard-time t (context seconds, calibration already applied)
 * against the nearest quarter-note beat. An input close to the off-beat 8th
 * note still counts as GOOD so fast strings keep the streak. Anything else is
 * a MISS, which in this game only means "no bonus" (never a penalty).
 */
export function judgeAt(clock: BeatClock, t: number): Judgement {
  const b = clock.beatAt(t);
  const near = Math.round(b);
  const deltaMs = (t - clock.timeOfBeat(near)) * 1000;
  const ad = Math.abs(deltaMs);
  let grade: Grade = MISS;
  if (ad <= RHYTHM.perfectMs) grade = PERFECT;
  else if (ad <= RHYTHM.greatMs) grade = GREAT;
  else if (ad <= RHYTHM.goodMs) grade = GOOD;
  else {
    const half = Math.floor(b) + 0.5;
    if (Math.abs(t - clock.timeOfBeat(half)) * 1000 <= RHYTHM.eighthGoodMs) grade = GOOD;
  }
  return { grade, deltaMs, beat: near };
}
