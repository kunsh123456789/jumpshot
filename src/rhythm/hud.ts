import { layout } from '../core/layout';
import { settings } from '../core/settings';
import { GOOD, GRADE_COLOR, GRADE_NAME, MISS, RHYTHM, type Grade } from '../data/rhythm';
import type { World } from '../sim/world';
import type { RhythmDirector } from './director';
import type { Judgement } from './judge';
import { DRAW } from '../render/drawStyle';
import { HAND, MARKER } from '../render/paper';
import { penCircle, penLine, seedSketch } from '../render/sketch';
import { PAPER } from '../data/paper';

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
    if (DRAW.ink) { this.drawPaper(ctx, r, w, now); return; }
    const u = layout.ui;
    const R = layout.world;
    const c = r.clock;
    // Pad edge pulse (the touch area breathes with the groove).
    if (r.live && this.pulse > 0.02) {
      const P = layout.pad;
      const I = c.section(now).intensity;
      ctx.fillStyle = `rgba(190,235,255,${(0.25 + 0.35 * I) * this.pulse})`;
      ctx.fillRect(P.x, P.y - 1, P.w, 2 + (this.downbeat ? 1 : 0));
    }
    // Groove flash over the arena on beats (stronger on downbeats and in loud sections).
    if (r.live && !settings.reduceFlashes && this.pulse > 0.05) {
      const I = c.section(now).intensity;
      ctx.fillStyle = `rgba(255,240,220,${RHYTHM.beatFlash * I * this.pulse * (this.downbeat ? 1.6 : 1)})`;
      ctx.fillRect(R.x, R.y, R.w, layout.pad.y - R.y);
    }
    if (!settings.beatHud) return;
    const narrow = R.w < 640;
    const cx = R.x + R.w / 2;
    const top = layout.portrait ? 8 : R.y + 12 * u;
    let boss = false;
    for (const e of w.enemies) if (e.def?.hpBar && e.alive) { boss = true; break; }
    const cy = top + (boss ? 92 : 64) * u;
    const halfW = narrow ? R.w * 0.34 : Math.min(230 * u, R.w * 0.36);
    const look = RHYTHM.hudLookaheadMs / 1000;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = 'rgba(8,10,20,0.55)';
    rr(ctx, cx - halfW - 10 * u, cy - 13 * u, halfW * 2 + 20 * u, 26 * u, 13 * u);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (r.live) {
      // Beats from just behind "now" to the lookahead (tempo changes are respected: positions use real times).
      const b0 = Math.floor(c.beatAt(now - 0.12)) + 1;
      for (let b = b0, i = 0; i < 16; b++, i++) {
        const tb = c.timeOfBeat(b);
        const dtB = tb - now;
        if (dtB > look) break;
        const k = Math.max(0, dtB / look);
        const accent = c.barInfo(tb + 1e-4).beatInBar === 0;
        const a = dtB < 0 ? Math.max(0, 1 + dtB / 0.12) : Math.min(1, (1 - k) * 2.2);
        const h = (accent ? 20 : 14) * u, bw = (accent ? 5 : 4) * u;
        ctx.globalAlpha = a;
        ctx.fillStyle = accent ? '#ffffff' : '#9fe8ff';
        for (const sgn of [-1, 1]) { rr(ctx, cx + sgn * k * halfW - bw / 2, cy - h / 2, bw, h, bw / 2); ctx.fill(); }
        const th = c.timeOfBeat(b - 0.5) - now;
        if (th > 0 && th < look) {
          ctx.globalAlpha = a * 0.45;
          for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sgn * (th / look) * halfW, cy, 2 * u, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      ctx.globalAlpha = 1;
    }
    // Ring.
    const rad = (11 + this.ring * 5) * u;
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = r.live ? `rgba(255,255,255,${0.6 + this.ring * 0.4})` : 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
    if (this.ring > 0 && r.live) { ctx.fillStyle = `rgba(255,255,255,${this.ring * 0.35})`; ctx.beginPath(); ctx.arc(cx, cy, rad - 2 * u, 0, Math.PI * 2); ctx.fill(); }

    // Timing ticks.
    for (const t of this.ticks) {
      const age = (now - t.t) / 2.5;
      if (age > 1 || age < 0) continue;
      ctx.globalAlpha = (1 - age) * 0.9;
      ctx.fillStyle = GRADE_COLOR[t.g];
      ctx.fillRect(cx + Math.max(-1.6, Math.min(1.6, t.d / RHYTHM.goodMs)) * 40 * u - u, cy + 15 * u, 2 * u, 7 * u);
    }
    ctx.globalAlpha = 0.4; ctx.fillStyle = '#fff'; ctx.fillRect(cx - 40 * u, cy + 18 * u, 80 * u, 1); ctx.globalAlpha = 1;

    // Judgement pop.
    const ja = (now - this.jT) / 0.52;
    if (this.jT > 0 && ja >= 0 && ja < 1) {
      const s = 1 + (1 - Math.min(1, ja * 4)) * 0.35;
      ctx.globalAlpha = 1 - ja * ja;
      ctx.font = `900 italic ${Math.round(17 * u * s)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      outline(ctx, GRADE_NAME[this.jGrade], cx, cy + 38 * u + ja * 8 * u, GRADE_COLOR[this.jGrade], 4 * u);
    }
    const la = (now - this.lostT) / 1.1;
    if (this.lostT > 0 && la >= 0 && la < 1) {
      ctx.globalAlpha = 1 - la;
      ctx.font = `900 italic ${Math.round(12 * u)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      outline(ctx, `STREAK LOST · ${this.lostN}`, cx, cy + 60 * u, '#ff6060', 3 * u);
    }
    // Section banner (fades in on change).
    const sa = now - this.sectionT;
    if (r.live && sa >= 0 && sa < 2.2 && this.sectionName) {
      ctx.globalAlpha = Math.min(1, sa * 6) * Math.min(1, (2.2 - sa) * 2);
      ctx.font = `900 italic ${Math.round(14 * u)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      outline(ctx, '♪ ' + this.sectionName, cx, cy - 24 * u, '#ff9af0', 3 * u);
    }
    ctx.globalAlpha = 1;

    // Tempo (left) and streak (right).
    const lx = narrow ? cx - halfW + 34 * u : cx - halfW - 18 * u;
    const ly = narrow ? cy + 26 * u : cy;
    ctx.textAlign = 'right';
    ctx.font = `900 italic ${Math.round(11 * u)}px system-ui, sans-serif`;
    if (r.live) {
      outline(ctx, `${Math.round(c.bpm(now))} BPM`, lx, ly - 5 * u, 'rgba(255,255,255,0.85)', 3 * u);
      const bi = c.barInfo(now);
      ctx.font = `800 ${Math.round(8 * u)}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(`${bi.bpb}/4 · ${c.section(now).name}`, lx, ly + 8 * u);
    } else outline(ctx, r.statusText(), lx, ly, '#ffe14a', 3 * u);
    const tier = r.streakTier();
    const sx = narrow ? cx + halfW - 44 * u : cx + halfW + 18 * u;
    const sy = narrow ? cy + 30 * u : cy;
    ctx.textAlign = 'left';
    ctx.font = `900 italic ${Math.round((16 + this.streakPop * 4) * u)}px system-ui, sans-serif`;
    outline(ctx, `×${r.stats.streak}`, sx, sy - 3 * u, ['#ffffff', '#6fe3ff', '#7dff8a', '#ffe14a'][tier], 3 * u);
    ctx.font = `800 ${Math.round(8 * u)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(tier > 0 ? `STREAK · BONUS ×${RHYTHM.streakMult[tier]}` : 'STREAK', sx, sy + 11 * u);
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
      ctx.fillStyle = last ? '#ff4040' : '#ffd0d0';
      ctx.beginPath(); ctx.arc(px, y, rad, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------ paper look
const SHAPE = ['cross', 'dot', 'circle', 'star'] as const;
export interface RhythmHud { drawPaper(ctx: CanvasRenderingContext2D, r: RhythmDirector, w: World, now: number): void }
RhythmHud.prototype.drawPaper = function (this: RhythmHud & Record<string, unknown>, ctx: CanvasRenderingContext2D, r: RhythmDirector, w: World, now: number): void {
  const self = this as unknown as { ticks: { d: number; g: Grade; t: number }[]; jT: number; jGrade: Grade; lostT: number; lostN: number; ring: number; sectionName: string; sectionT: number; streakPop: number; pulse: number };
  const u = Math.max(0.8, layout.ui);
  const R = layout.world;
  const c = r.clock;
  const ink = PAPER.ink, pencil = PAPER.pencil;
  if (!settings.beatHud) return;
  const narrow = R.w < 640;
  const cx = R.x + R.w / 2;
  const top = layout.portrait ? 8 : R.y + 10 * u;
  let boss = false;
  for (const e of w.enemies) if (e.def?.hpBar && e.alive) { boss = true; break; }
  const cy = top + (boss ? 104 : 84) * u;
  const halfW = narrow ? R.w * 0.3 : Math.min(200 * u, R.w * 0.3);
  const look = RHYTHM.hudLookaheadMs / 1000;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // pencil track
  seedSketch(5);
  ctx.strokeStyle = pencil; ctx.lineWidth = 1.5;
  ctx.beginPath(); penLine(ctx, cx - halfW, cy, cx + halfW, cy, 0.8, 0); ctx.stroke();
  if (r.live) {
    const b0 = Math.floor(c.beatAt(now - 0.12)) + 1;
    ctx.beginPath();
    for (let b = b0, i = 0; i < 16; b++, i++) {
      const tb = c.timeOfBeat(b), dtB = tb - now;
      if (dtB > look) break;
      if (dtB < -0.12) continue;
      const k = Math.max(0, dtB / look);
      const accent = c.barInfo(tb + 1e-4).beatInBar === 0;
      const h = (accent ? 9 : 6) * u;
      for (const sg of [-1, 1]) { const x = cx + sg * k * halfW; ctx.moveTo(x, cy - h); ctx.lineTo(x + 1, cy + h); }
    }
    ctx.strokeStyle = ink; ctx.lineWidth = 2;
    ctx.stroke();
  }
  // ring
  seedSketch(9 + Math.floor(now * 7) % 3);
  ctx.strokeStyle = r.live ? ink : pencil; ctx.lineWidth = 2 + self.ring * 1.5;
  const rad = (10 + Math.round(self.ring * 2) * 2) * u;
  ctx.beginPath(); penCircle(ctx, cx, cy, rad, rad, 1.2); ctx.stroke();
  // timing ticks (early left | late right)
  for (const t of self.ticks) {
    const age = (now - t.t) / 2.5;
    if (age > 1 || age < 0) continue;
    ctx.fillStyle = t.g >= 2 ? PAPER.blue : t.g === 0 ? pencil : ink;
    ctx.fillRect(cx + Math.max(-1.6, Math.min(1.6, t.d / RHYTHM.goodMs)) * 34 * u - 1, cy + 14 * u, 2, 6 * u);
  }
  // judgement: marker lettering + scribbled underline + shape icon (colour-blind safe)
  const ja = (now - self.jT) / 0.52;
  if (self.jT > 0 && ja >= 0 && ja < 1 && !(ja > 0.8 && Math.floor(now * 20) % 2)) {
    const pop = ja < 0.12 ? 1.25 : 1;
    const g = self.jGrade;
    const col = g === 3 ? PAPER.red : g === 2 ? PAPER.blue : g === 1 ? ink : pencil;
    const y = cy + 36 * u;
    ctx.font = `${Math.round(19 * u * pop)}px ${MARKER}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = col;
    const label = g === 3 ? 'PERFECT!' : g === 2 ? 'GREAT' : g === 1 ? 'GOOD' : 'OFF';
    ctx.fillText(label, cx, y);
    const tw = ctx.measureText(label).width;
    seedSketch(13);
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); penLine(ctx, cx - tw / 2, y + 12 * u, cx + tw / 2, y + 11 * u, 1, 1);
    // shape icon to the left
    const ix = cx - tw / 2 - 14 * u, iy = y;
    const shape = SHAPE[g];
    if (shape === 'star') { for (let k = 0; k < 5; k++) { const a1 = -Math.PI / 2 + (k * 4 * Math.PI) / 5, a2 = -Math.PI / 2 + ((k + 1) * 4 * Math.PI) / 5; ctx.moveTo(ix + Math.cos(a1) * 7 * u, iy + Math.sin(a1) * 7 * u); ctx.lineTo(ix + Math.cos(a2) * 7 * u, iy + Math.sin(a2) * 7 * u); } }
    else if (shape === 'circle') penCircle(ctx, ix, iy, 6 * u, 6 * u, 0.6);
    else if (shape === 'cross') { ctx.moveTo(ix - 5 * u, iy - 5 * u); ctx.lineTo(ix + 5 * u, iy + 5 * u); ctx.moveTo(ix + 5 * u, iy - 5 * u); ctx.lineTo(ix - 5 * u, iy + 5 * u); }
    ctx.stroke();
    if (shape === 'dot') { ctx.beginPath(); ctx.arc(ix, iy, 3.5 * u, 0, Math.PI * 2); ctx.fill(); }
    if (g === 3) { // doodle stars for PERFECT
      ctx.beginPath();
      for (const [dx, dy] of [[tw / 2 + 10, -10], [tw / 2 + 18, 6]]) { const x = cx + dx * u, yy = y + dy * u; ctx.moveTo(x - 4, yy); ctx.lineTo(x + 4, yy); ctx.moveTo(x, yy - 4); ctx.lineTo(x, yy + 4); }
      ctx.stroke();
    }
  }
  const la = (now - self.lostT) / 1.1;
  if (self.lostT > 0 && la >= 0 && la < 1) {
    ctx.font = `${Math.round(15 * u)}px ${HAND}`; ctx.fillStyle = PAPER.red; ctx.textAlign = 'center';
    ctx.fillText(`streak lost · ${self.lostN}`, cx, cy + 58 * u);
  }
  const sa = now - self.sectionT;
  if (r.live && sa >= 0 && sa < 2.2 && self.sectionName) {
    ctx.font = `${Math.round(16 * u)}px ${MARKER}`; ctx.fillStyle = PAPER.red; ctx.textAlign = 'center';
    ctx.fillText('♪ ' + self.sectionName.toLowerCase(), cx, cy - 20 * u);
  }
  // tempo + a doodled metronome pendulum (left), streak (right)
  const lx = narrow ? cx - halfW + 10 * u : cx - halfW - 30 * u;
  const ly = narrow ? cy + 22 * u : cy;
  ctx.textBaseline = 'middle';
  if (r.live) {
    const ph = c.phase(now), swing = (Math.floor(c.beat(now)) % 2 ? 1 : -1) * (1 - 2 * ph);
    const ang = Math.round(swing * 3) / 3 * 0.45;
    seedSketch(17);
    ctx.strokeStyle = ink; ctx.lineWidth = 1.6;
    ctx.beginPath();
    const mx = lx + 2 * u, my = ly + 9 * u;
    penLine(ctx, mx - 9 * u, my, mx + 9 * u, my, 0.4, 0); penLine(ctx, mx - 9 * u, my, mx - 4 * u, my - 22 * u, 0.4, 0); penLine(ctx, mx + 9 * u, my, mx + 4 * u, my - 22 * u, 0.4, 0);
    ctx.moveTo(mx, my - 2 * u); ctx.lineTo(mx + Math.sin(ang) * 20 * u, my - 2 * u - Math.cos(ang) * 20 * u);
    ctx.stroke();
    ctx.font = `${Math.round(14 * u)}px ${HAND}`; ctx.fillStyle = ink; ctx.textAlign = narrow ? 'left' : 'right';
    ctx.fillText(`${Math.round(c.bpm(now))} bpm`, narrow ? mx + 14 * u : mx - 14 * u, my - 8 * u);
  } else {
    ctx.font = `${Math.round(14 * u)}px ${HAND}`; ctx.fillStyle = PAPER.red; ctx.textAlign = 'right';
    ctx.fillText(r.statusText().toLowerCase(), lx, ly);
  }
  const tier = r.streakTier();
  const sx = narrow ? cx + halfW - 40 * u : cx + halfW + 16 * u, sy = narrow ? cy + 24 * u : cy;
  ctx.textAlign = 'left';
  ctx.font = `${Math.round((17 + self.streakPop * 4) * u)}px ${MARKER}`;
  ctx.fillStyle = tier >= 2 ? PAPER.red : ink;
  ctx.fillText(`×${r.stats.streak}`, sx, sy - 2 * u);
  ctx.font = `${Math.round(12 * u)}px ${HAND}`; ctx.fillStyle = pencil;
  ctx.fillText(tier > 0 ? `streak · bonus ×${RHYTHM.streakMult[tier]}` : 'streak', sx, sy + 13 * u);
  ctx.restore();
};

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
