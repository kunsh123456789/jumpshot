import { layout } from '../core/layout';
import { settings } from '../core/settings';
import { G_GOOD, G_NONE, G_OFF, GRADE_COLOR, GRADE_NAME, RHYTHM, type Grade } from '../data/rhythm';
import type { MusicManager } from '../music/music';
import type { World } from '../sim/world';

/**
 * Beat track: markers slide in from both sides and meet the target ring on
 * each beat (the moment you hear it). Judgements pop above the ring; the last
 * few timing errors show as ticks below it (early ← | → late). The on-beat
 * streak sits on the right, the tempo on the left.
 */
export class BeatHud {
  visible = false;
  private jT = -1;
  private jGrade: Grade = G_NONE;
  private ticks: { d: number; g: Grade; t: number }[] = [];
  private lastStreak = 0;
  private lostT = -1;
  private lostN = 0;
  private ringPulse = 0;
  private lastBeat = NaN;
  private streakPop = 0;

  judged(g: Grade, delta: number, now: number): void {
    if (g === G_NONE) return;
    if (g === G_OFF && this.lastStreak >= RHYTHM.streakBreakMin) { this.lostT = now; this.lostN = this.lastStreak; }
    this.jGrade = g; this.jT = now;
    this.ticks.push({ d: delta, g, t: now });
    if (this.ticks.length > 14) this.ticks.shift();
    if (g >= G_GOOD) this.streakPop = 1;
  }

  reset(): void { this.ticks.length = 0; this.jT = -1; this.lostT = -1; this.lastStreak = 0; }

  /** Returns the beat pulse (1 on the beat, decaying) for other visuals. */
  draw(ctx: CanvasRenderingContext2D, m: MusicManager, w: World, now: number, dt: number): number {
    const prev = m.prevBeat(now);
    let pulse = 0;
    if (isFinite(prev) && m.active) {
      pulse = Math.exp(-(now - prev) / 110);
      if (prev !== this.lastBeat) { this.lastBeat = prev; this.ringPulse = 1; }
    }
    this.ringPulse = Math.max(0, this.ringPulse - dt * 5);
    this.streakPop = Math.max(0, this.streakPop - dt * 6);
    this.lastStreak = w.rhythm.streak;
    if (!this.visible || !settings.beatHud) return pulse;

    const u = layout.ui;
    const r = layout.world;
    const cx = r.x + r.w / 2;
    // Under the score (and under a boss bar when one is up).
    const top = layout.portrait ? 8 : r.y + 12 * u;
    let boss = false;
    for (const e of w.enemies) if (e.def?.hpBar && e.alive) { boss = true; break; }
    const cy = top + (boss ? 92 : 64) * u;
    // Narrow screens: shorter track, tempo/streak tucked under its ends (clear of the pause button).
    const narrow = r.w < 640;
    const halfW = narrow ? r.w * 0.34 : Math.min(230 * u, r.w * 0.36);
    const look = RHYTHM.hudLookaheadMs;
    ctx.save();
    ctx.textBaseline = 'middle';

    // Track.
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = 'rgba(8,10,20,0.55)';
    roundRect(ctx, cx - halfW - 10 * u, cy - 13 * u, halfW * 2 + 20 * u, 26 * u, 13 * u);
    ctx.fill();
    ctx.globalAlpha = 1;

    const live = m.mode === 'mic' && !m.live.locked;
    if (m.active) {
      // Markers: walk beats from just behind "now" to the lookahead.
      let b = m.prevBeat(now - 120);
      const per = m.beatMs;
      const idx0 = m.beatIndex(b);
      for (let i = 0; i < 12 && isFinite(b); i++) {
        const dtB = b - now;
        if (dtB > look) break;
        const k = dtB / look; // 1 at the edge → 0 at the ring
        if (dtB > -120) {
          const accent = ((idx0 + i) % 4 + 4) % 4 === 0;
          const a = dtB < 0 ? Math.max(0, 1 + dtB / 120) : Math.min(1, (1 - k) * 2.2);
          const h = (accent ? 20 : 14) * u, bw = (accent ? 5 : 4) * u;
          ctx.globalAlpha = a;
          ctx.fillStyle = accent ? '#ffffff' : '#9fe8ff';
          for (const sgn of [-1, 1]) {
            const x = cx + sgn * Math.max(0, k) * halfW;
            roundRect(ctx, x - bw / 2, cy - h / 2, bw, h, bw / 2);
            ctx.fill();
          }
          // Half-beat dot (8th-note GOOD window) when the tempo allows it.
          if (per > 380) {
            const hk = (dtB + per / 2) / look;
            if (hk > 0 && hk < 1) {
              ctx.globalAlpha = a * 0.45;
              ctx.fillStyle = '#9fe8ff';
              for (const sgn of [-1, 1]) {
                ctx.beginPath(); ctx.arc(cx + sgn * hk * halfW, cy, 2 * u, 0, Math.PI * 2); ctx.fill();
              }
            }
          }
        }
        b = m.nextBeat(b + 1);
      }
      ctx.globalAlpha = 1;
    }

    // Target ring.
    const rr = (11 + this.ringPulse * 5) * u;
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = live ? 'rgba(255,255,255,0.35)' : `rgba(255,255,255,${0.6 + this.ringPulse * 0.4})`;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
    if (this.ringPulse > 0 && m.active) {
      ctx.fillStyle = `rgba(255,255,255,${this.ringPulse * 0.35})`;
      ctx.beginPath(); ctx.arc(cx, cy, rr - 2 * u, 0, Math.PI * 2); ctx.fill();
    }

    // Timing ticks (early left, late right), under the ring.
    for (const t of this.ticks) {
      const age = (now - t.t) / 2500;
      if (age > 1) continue;
      ctx.globalAlpha = (1 - age) * 0.9;
      ctx.fillStyle = GRADE_COLOR[t.g];
      const x = cx + Math.max(-1.6, Math.min(1.6, t.d / RHYTHM.goodMs)) * 40 * u;
      ctx.fillRect(x - 1 * u, cy + 15 * u, 2 * u, 7 * u);
    }
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 40 * u, cy + 18 * u, 80 * u, 1);
    ctx.globalAlpha = 1;

    // Judgement pop.
    const ja = (now - this.jT) / 520;
    if (this.jT > 0 && ja < 1) {
      const s = 1 + (1 - Math.min(1, ja * 4)) * 0.35;
      ctx.globalAlpha = 1 - ja * ja;
      ctx.font = `900 italic ${Math.round(17 * u * s)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      outline(ctx, GRADE_NAME[this.jGrade], cx, cy + 38 * u + ja * 8 * u, GRADE_COLOR[this.jGrade], 4 * u);
    }
    const la = (now - this.lostT) / 1100;
    if (this.lostT > 0 && la < 1) {
      ctx.globalAlpha = 1 - la;
      ctx.font = `900 italic ${Math.round(12 * u)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      outline(ctx, `STREAK LOST · ${this.lostN}`, cx, cy + 60 * u, '#ff6060', 3 * u);
    }
    ctx.globalAlpha = 1;

    // Tempo / status (left).
    ctx.textAlign = 'right';
    ctx.font = `900 italic ${Math.round(11 * u)}px system-ui, sans-serif`;
    const lx = narrow ? cx - halfW + 34 * u : cx - halfW - 18 * u;
    const ly = narrow ? cy + 26 * u : cy;
    if (m.mode === 'mic') {
      const lvl = m.live.level;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(lx - 40 * u, ly + 9 * u, 40 * u, 3 * u);
      ctx.fillStyle = '#7dff8a';
      ctx.fillRect(lx - 40 * u, ly + 9 * u, 40 * u * Math.min(1, lvl * 1.5), 3 * u);
      outline(ctx, m.live.locked ? `${Math.round(m.live.bpm)} BPM` : m.live.level < 0.02 ? 'PLAY MUSIC' : 'LISTENING…', lx, ly - 2 * u, m.live.locked ? '#ffffff' : '#ffe14a', 3 * u);
    } else {
      outline(ctx, `${Math.round(60000 / m.beatMs)} BPM`, lx, ly, 'rgba(255,255,255,0.8)', 3 * u);
    }

    // Streak (right).
    const st = w.rhythm.streak;
    const tier = w.rhythm.tier();
    ctx.textAlign = 'left';
    const sx = narrow ? cx + halfW - 44 * u : cx + halfW + 18 * u;
    const sy = narrow ? cy + 30 * u : cy;
    const colors = ['#ffffff', '#6fe3ff', '#7dff8a', '#ffe14a'];
    ctx.font = `900 italic ${Math.round((16 + this.streakPop * 4) * u)}px system-ui, sans-serif`;
    outline(ctx, `×${st}`, sx, sy - 3 * u, colors[tier], 3 * u);
    ctx.font = `800 ${Math.round(8 * u)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    const mult = RHYTHM.streakScoreMult[tier];
    ctx.fillText(tier > 0 ? `ON BEAT · SCORE ×${mult}` : 'ON BEAT', sx, sy + 11 * u);
    ctx.restore();
    return pulse;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function outline(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, fill: string, lw: number): void {
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}
