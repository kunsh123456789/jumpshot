import { COMBO, SCORE, STYLE } from '../data/tuning';
import { SPECIAL } from '../data/special';
import type { EventBus } from '../core/events';
import type { SimEvents } from './events';

export interface HitFlags {
  air: boolean;
  multi: boolean;
  bounce: boolean;
  finisher: boolean;
  launcher: boolean;
  bowl: boolean;
  ko: boolean;
}

const RECENT_N = COMBO.repeatWindow;

/** Combo counter, damage scaling, style rank, super meter and score. */
export class ComboTracker {
  hits = 0;
  damage = 0;
  sinceHit = 0;
  idleFrames = 0;
  launcherUsed = false;
  finisherUsed = false;
  /** The Air Finisher was used in this air combo (reset on landing). */
  airFinisherUsed = false;
  airJuggle = 0;
  groundBouncesUsed = 0;
  wallBouncesUsed = 0;
  maxRank = 0;

  style = 0;
  rank = 0;
  /** Special Bar charge sink (set by the world; pass 8 replaced the super meter). */
  onCharge: ((amount: number) => void) | null = null;
  score = 0;

  // run stats
  bestHits = 0;
  bestDamage = 0;
  bestRank = 0;
  totalKOs = 0;
  parries = 0;
  finishers = 0;
  maxRankRun = 0;
  totalDamage = 0;

  private recent: string[] = new Array(RECENT_N).fill('');
  private recentHead = 0;
  private lastFamily = '';
  private lastHitFrame = -999;
  private multiThisFrame = 0;
  private frame = 0;

  constructor(private bus: EventBus<SimEvents>) {}

  /** Damage multiplier from hit count. */
  scale(): number {
    return Math.max(COMBO.scaleFloor, 1 - COMBO.scalePerHit * Math.max(0, this.hits - COMBO.scaleFreeHits));
  }
  /** Multiplier for repeating the same move family. */
  repeatMult(family: string): number {
    let n = 0;
    for (let i = 0; i < RECENT_N; i++) if (this.recent[i] === family) n++;
    return Math.max(COMBO.repeatFloor, Math.pow(COMBO.repeatPenalty, Math.max(0, n - 1)));
  }
  noteMove(family: string): void {
    this.recent[this.recentHead] = family;
    this.recentHead = (this.recentHead + 1) % RECENT_N;
  }

  registerHit(family: string, damage: number, f: HitFlags): void {
    const first = this.hits === 0;
    this.hits++;
    this.damage += damage;
    this.totalDamage += damage;
    this.sinceHit = 0;
    this.idleFrames = 0;
    if (f.air) this.airJuggle++;
    if (f.launcher) this.launcherUsed = true;
    if (f.finisher) this.finisherUsed = true;
    let st = STYLE.perHit;
    if (family !== this.lastFamily) st += STYLE.varietyBonus;
    if (f.air) st += STYLE.airBonus;
    if (this.lastHitFrame === this.frame) { this.multiThisFrame++; st += STYLE.multiBonus * Math.min(3, this.multiThisFrame); } else this.multiThisFrame = 0;
    if (f.bounce) st += STYLE.bounceBonus;
    if (f.launcher) st += STYLE.launcherBonus;
    if (f.finisher) st += STYLE.finisherBonus;
    if (f.ko) st += STYLE.koBonus;
    if (f.bowl) st += STYLE.multiBonus;
    // diminishing: early hits give more so that rank ramps up visibly
    if (first) st += 3;
    this.addStyle(st);
    this.lastFamily = family;
    this.lastHitFrame = this.frame;
    this.onCharge?.(SPECIAL.perHit * Math.min(SPECIAL.comboCap, 1 + this.hits * SPECIAL.perComboHit) + (f.air ? SPECIAL.airBonus : 0) + (f.multi ? SPECIAL.multiBonus : 0));
    this.score += Math.round(damage * SCORE.perDamage * STYLE.scoreMult[this.rank]);
  }

  addStyle(v: number): void {
    this.style = Math.min(STYLE.max, this.style + v);
    this.updateRank();
  }

  private updateRank(): void {
    let r = 0;
    for (let i = STYLE.thresholds.length - 1; i >= 0; i--) if (this.style >= STYLE.thresholds[i]) { r = i; break; }
    if (r > this.rank) this.bus.emit('rankUp', { rank: r });
    this.rank = r;
    if (r > this.maxRank) this.maxRank = r;
    if (r > this.maxRankRun) this.maxRankRun = r;
  }

  /** Fill fraction within current rank. */
  rankFill(): number {
    const t = STYLE.thresholds;
    const lo = t[this.rank], hi = this.rank + 1 < t.length ? t[this.rank + 1] : STYLE.max;
    return Math.max(0, Math.min(1, (this.style - lo) / Math.max(1, hi - lo)));
  }

  onParry(): void {
    this.parries++;
    this.addStyle(STYLE.parryBonus);
    this.onCharge?.(SPECIAL.parry);
    this.score += SCORE.parry;
    this.sinceHit = Math.min(this.sinceHit, 10);
  }

  onPlayerHurt(): void {
    this.end(true);
    this.style *= STYLE.hurtKeep;
    this.updateRankDown();
  }

  onPlayerLanded(): void { this.airJuggle = 0; this.airFinisherUsed = false; }

  /** Per-frame update. anyHitState = whether any enemy is still being comboed. */
  update(anyHitState: boolean): void {
    this.frame++;
    if (this.hits > 0) {
      this.sinceHit++;
      this.idleFrames = anyHitState ? 0 : this.idleFrames + 1;
      if (this.sinceHit > COMBO.timeoutFrames || this.idleFrames > COMBO.idleDropFrames) {
        this.end(false);
      }
    }
    // style decay
    if (this.hits === 0) {
      if (this.style > 0) { this.style = Math.max(0, this.style - STYLE.comboEndDecayPerFrame); this.updateRankDown(); }
    } else if (this.sinceHit > STYLE.passiveDelayFrames) {
      this.style = Math.max(0, this.style - STYLE.decayPerFrame);
      this.updateRankDown();
    }
  }

  private updateRankDown(): void {
    let r = 0;
    for (let i = STYLE.thresholds.length - 1; i >= 0; i--) if (this.style >= STYLE.thresholds[i]) { r = i; break; }
    this.rank = r;
  }

  end(dropped: boolean): void {
    if (this.hits === 0) return;
    const bonus = dropped ? 0 : Math.round(this.hits * this.hits * SCORE.comboBonusPerHitSq * STYLE.scoreMult[this.maxRank]);
    this.score += bonus;
    if (this.hits > this.bestHits || (this.hits === this.bestHits && this.damage > this.bestDamage)) {
      this.bestHits = this.hits; this.bestDamage = Math.round(this.damage); this.bestRank = this.maxRank;
    }
    if (this.hits >= COMBO.summaryMinHits) {
      this.bus.emit('comboEnd', { hits: this.hits, damage: Math.round(this.damage), maxRank: this.maxRank, bonus, finisher: this.finisherUsed, dropped });
    }
    this.hits = 0; this.damage = 0; this.sinceHit = 0; this.idleFrames = 0;
    this.launcherUsed = false; this.finisherUsed = false;
    this.groundBouncesUsed = 0; this.wallBouncesUsed = 0;
    this.maxRank = this.rank;
    this.lastFamily = '';
    for (let i = 0; i < RECENT_N; i++) this.recent[i] = '';
  }

  canGroundBounce(): boolean { return this.groundBouncesUsed < COMBO.groundBounces; }
  canWallBounce(): boolean { return this.wallBouncesUsed < COMBO.wallBounces; }
}
