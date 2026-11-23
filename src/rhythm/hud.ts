import { layout } from '../core/layout';
import { settings } from '../core/settings';
import { GOOD, MISS, RHYTHM, type Grade } from '../data/rhythm';
import type { World } from '../sim/world';
import type { RhythmDirector } from './director';
import type { Judgement } from './judge';
import { getUiScale } from '../ui/arcadeHud';

/**
 * Beat track under the score: markers slide in from both sides and meet the
 * ring on each beat as it is heard. Bar downbeats are taller, 8th-note dots
 * mark the off-beat GOOD window. Judgements pop under the ring; recent timing
 * errors show as ticks (early ← | → late). Tempo + section on the left, the
 * streak on the right. Also draws the beat pulse along the pad's top edge.
 */
export class RhythmHud {
  private jT = -1;
  private jGrade: Grade = MISS;
  private ticks: { d: number; g: Grade; t: number }[] = [];
  private lostT = -1;
  private lostN = 0;
  private ring = 0;
  private lastBeat = -1;
  private streakPop = 0;
  private sectionName = '';
  private sectionT = -10;
  /** 1 on every heard beat, decaying (shared with other groove visuals). */
  pulse = 0;
  downbeat = false;
  /** Set on the frame a new section (e.g. a drop) starts being heard. */
  sectionChanged = false;
  sectionKind = '';

  judged(j: Judgement, broke: number, now: number): void {
    if (j.grade === MISS && broke >= RHYTHM.streakBreakShowMin) { this.lostT = now; this.lostN = broke; }
    this.jGrade = j.grade; this.jT = now;
    this.ticks.push({ d: j.deltaMs, g: j.grade, t: now });
    if (this.ticks.length > 14) this.ticks.shift();
    if (j.grade >= GOOD) this.streakPop = 1;
  }

  reset(): void { this.ticks.length = 0; this.jT = -1; this.lostT = -1; this.lastBeat = -1; this.sectionName = ''; }

  /** Advance groove state at heard time `now` (s). Returns true on a new beat. */
  update(r: RhythmDirector, now: number, dt: number): boolean {
    let newBeat = false;
    if (r.live) {
      const c = r.clock;
      const b = c.beat(now);
      if (b !== this.lastBeat) {
        newBeat = this.lastBeat >= 0 || b >= 0;
        this.lastBeat = b;
        this.ring = 1;
        this.downbeat = c.barInfo(now).beatInBar === 0;
      }
      this.pulse = Math.exp(-(c.phase(now) * c.beatLen(now)) / 0.11);
      const sec = c.section(now);
      this.sectionChanged = false;
      if (sec.name !== this.sectionName) { this.sectionChanged = this.sectionName !== ''; this.sectionName = sec.name; this.sectionKind = sec.kind; this.sectionT = now; }
    } else this.pulse = 0;
    this.ring = Math.max(0, this.ring - dt * 5);
    this.streakPop = Math.max(0, this.streakPop - dt * 6);
    return newBeat;
  }

  draw(ctx: CanvasRenderingContext2D, r: RhythmDirector, w: World, now: number): void {
    const R = layout.world;
    const c = r.clock;
    // Pad edge pulse (the touch area breathes with the groove).
    if (r.live && this.pulse > 0.02) {
      const P = layout.pad;
      const I = c.section(now).intensity;
      ctx.fillStyle = `rgba(46,230,255,${(0.3 + 0.4 * I) * this.pulse})`;
      ctx.fillRect(P.x, P.y - 1, P.w, 2 + (this.downbeat ? 1 : 0));
    }
    // Groove flash over the arena on beats (stronger on downbeats and in loud sections).
    if (r.live && !settings.reduceFlashes && this.pulse > 0.05) {
      const I = c.section(now).intensity;
      ctx.fillStyle = `rgba(255,240,220,${RHYTHM.beatFlash * I * this.pulse * (this.downbeat ? 1.6 : 1)})`;
      ctx.fillRect(R.x, R.y, R.w, layout.pad.y - R.y);
    }
    if (!settings.beatHud) return;
    this.drawArcade(ctx, r, w, now);
  }

  /**
   * Arcade Fighter beat lane (pass 8 UI), under the Special Bar: a navy capsule, a cyan lane,
   * magenta beat diamonds sliding in from both sides onto a white diamond marker, the judgment
   * in italic display lettering (with a shape, so it reads without color), timing ticks,
   * BPM on the left and the streak + GROOVE meter (progress to the next streak bonus) on the right.
   */
  private drawArcade(ctx: CanvasRenderingContext2D, r: RhythmDirector, w: World, now: number): void {
    const u = getUiScale();
    const c = r.clock;
    const W = innerWidth;
    const portrait = innerHeight > innerWidth * 1.25;
    const top = Math.max(12 * u, safeTop());
    let boss = false;
    for (const e of w.enemies) if (e.def?.hpBar && e.alive) { boss = true; break; }
    const cy = top + (portrait ? 158 : 84) * u + (boss ? 50 * u : 0);
    const cx = W / 2;
    const halfW = Math.min(180 * u, W * 0.3);
    const look = RHYTHM.hudLookaheadMs / 1000;
    const cyan = '#2ee6ff', magenta = '#ff2e88', gold = '#ffd23f';
    ctx.save();
    // capsule
    ctx.fillStyle = 'rgba(11,16,38,0.78)';
    rr(ctx, cx - halfW - 12 * u, cy - 11 * u, halfW * 2 + 24 * u, 22 * u, 11 * u); ctx.fill();
    const lg = ctx.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
    lg.addColorStop(0, 'rgba(46,230,255,0)'); lg.addColorStop(0.3, 'rgba(46,230,255,0.55)'); lg.addColorStop(0.7, 'rgba(46,230,255,0.55)'); lg.addColorStop(1, 'rgba(46,230,255,0)');
    ctx.fillStyle = lg; ctx.fillRect(cx - halfW, cy - 1.5 * u, halfW * 2, 3 * u);
    const dia = (x: number, y: number, s: number) => { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); };
    if (r.live) {
      const b0 = Math.floor(c.beatAt(now - 0.12)) + 1;
      ctx.fillStyle = magenta; ctx.shadowColor = magenta; ctx.shadowBlur = 6 * u;
      for (let b = b0, i = 0; i < 16; b++, i++) {
        const tb = c.timeOfBeat(b), dtB = tb - now;
        if (dtB > look) break;
        if (dtB < -0.12) continue;
        const k = Math.max(0, dtB / look);
        const accent = c.barInfo(tb + 1e-4).beatInBar === 0;
        for (const sg of [-1, 1]) { dia(cx + sg * k * halfW, cy, (accent ? 7 : 5) * u); ctx.fill(); }
      }
      ctx.shadowBlur = 0;
    }
    // marker
    const ring = this.ring;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * u; ctx.shadowColor = cyan; ctx.shadowBlur = (8 + ring * 14) * u;
    dia(cx, cy, (10 + ring * 4) * u); ctx.stroke(); ctx.shadowBlur = 0;
    // timing ticks (early left | late right)
    for (const t of this.ticks) {
      const age = (now - t.t) / 2.5;
      if (age > 1 || age < 0) continue;
      ctx.fillStyle = t.g === 3 ? cyan : t.g === 2 ? gold : t.g === 1 ? '#e9eef8' : '#ff3b3b';
      ctx.fillRect(cx + Math.max(-1.6, Math.min(1.6, t.d / RHYTHM.goodMs)) * 34 * u - 1, cy + 13 * u, 2.5 * u, 6 * u);
    }
    // judgment
    const ja = (now - this.jT) / 0.52;
    if (this.jT > 0 && ja >= 0 && ja < 1) {
      const g = this.jGrade;
      const pop = ja < 0.12 ? 1.3 - ja * 2.5 : 1;
      const col = g === 3 ? cyan : g === 2 ? gold : g === 1 ? '#e9eef8' : '#ff3b3b';
      const label = (g === 3 ? '★ PERFECT' : g === 2 ? '◆ GREAT' : g === 1 ? '● GOOD' : '✕ OFF');
      const y = cy + 34 * u;
      ctx.globalAlpha = ja > 0.8 ? (1 - ja) * 5 : 1;
      italic(ctx, label, cx, y, 22 * u * pop, col, g === 3);
      ctx.globalAlpha = 1;
    }
    const la = (now - this.lostT) / 1.1;
    if (this.lostT > 0 && la >= 0 && la < 1) plateText(ctx, `STREAK LOST · ${this.lostN}`, cx, cy + 58 * u, 12 * u, '#ff3b3b');
    const sa = now - this.sectionT;
    if (r.live && sa >= 0 && sa < 2.2 && this.sectionName) plateText(ctx, '♪ ' + this.sectionName.toUpperCase(), cx, cy - 24 * u, 12 * u, gold);
    // BPM (left) and streak + GROOVE (right)
    const lx = cx - halfW - 22 * u, rx = cx + halfW + 22 * u;
    if (r.live) plateText(ctx, `${Math.round(c.bpm(now))} BPM`, lx - 34 * u, cy, 12 * u, cyan);
    else plateText(ctx, r.statusText().toUpperCase(), lx - 50 * u, cy, 12 * u, '#ff3b3b');
    const tier = r.streakTier();
    const tiers = RHYTHM.streakTiers;
    const nextT = tiers[Math.min(tiers.length - 1, tier + 1)], curT = tiers[tier];
    const gf = tier >= tiers.length - 1 ? 1 : Math.max(0, Math.min(1, (r.stats.streak - curT) / Math.max(1, nextT - curT)));
    italic(ctx, `×${r.stats.streak}`, rx + 22 * u, cy - 6 * u, (18 + this.streakPop * 6) * u, tier >= 2 ? magenta : '#fff', false);
    const gw = 64 * u;
    ctx.save(); ctx.translate(rx - 10 * u, cy + 10 * u); ctx.transform(1, 0, -0.25, 1, 0, 0);
    ctx.fillStyle = '#20263f'; ctx.fillRect(0, 0, gw, 6 * u);
    const gg = ctx.createLinearGradient(0, 0, gw, 0); gg.addColorStop(0, cyan); gg.addColorStop(1, magenta);
    ctx.fillStyle = gg; ctx.fillRect(0, 0, gw * gf, 6 * u);
    ctx.restore();
    ctx.font = `700 ${Math.round(9 * u)}px "Oswald", sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = cyan; ctx.fillText(tier > 0 ? `GROOVE ×${RHYTHM.streakMult[tier]}` : 'GROOVE', rx - 10 * u, cy + 18 * u);
    ctx.restore();
  }
}

/**
 * World-space telegraph: pips above each winding-up enemy count the beats to
 * its strike ("ta · ta · HIT"); the last pip is red and the ring pulses on
 * every beat, so the enemy's rhythm can be read and answered.
 */
export function drawRhythmWorld(ctx: CanvasRenderingContext2D, r: RhythmDirector, w: World, alpha: number, now: number, pulse: number): void {
  if (!r.live) return;
  for (const e of w.enemies) {
    if (e.state !== 'windup' || !e.alive) continue;
    const left = r.enemyBeatsLeft(e, now);
    if (left < 0) continue;
    const x = e.px + (e.x - e.px) * alpha;
    const y = e.py + (e.y - e.py) * alpha - 175 * e.scale;
    const n = Math.max(1, left);
    ctx.save();
    for (let i = 0; i < n; i++) {
      const last = i === n - 1 && left <= 1;
      const px = x + (i - (n - 1) / 2) * 16;
      const rad = (last ? 6 : 4.5) * (1 + pulse * 0.35);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = last ? '#ff2e88' : '#2ee6ff';
      ctx.beginPath(); ctx.arc(px, y, rad, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#0b1026'; ctx.stroke();
    }
    ctx.restore();
  }
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function safeTop(): number { return layout.safe.top; }
/** Italic display lettering with a navy outline (Arcade judgments, streak). */
function italic(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, col: string, glow: boolean): void {
  ctx.font = `italic ${Math.round(size)}px "Russo One", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.2); ctx.strokeStyle = '#0b1026';
  ctx.strokeText(s, x, y);
  if (glow) { ctx.shadowColor = col; ctx.shadowBlur = size * 0.6; }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
  ctx.shadowBlur = 0;
}
/** Small caps label on a skewed navy plate. */
function plateText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, col: string): void {
  ctx.font = `700 ${Math.round(size)}px "Oswald", sans-serif`;
  const tw = ctx.measureText(s).width + size * 1.2;
  ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, -0.25, 1, 0, 0);
  ctx.fillStyle = 'rgba(11,16,38,0.85)'; ctx.fillRect(-tw / 2, -size * 0.8, tw, size * 1.6); ctx.restore();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(s, x, y + 0.5);
}
