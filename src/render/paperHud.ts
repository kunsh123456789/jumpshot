import { layout } from '../core/layout';
import { drawHeatBar } from './weaponFx';
import { settings } from '../core/settings';
import type { World } from '../sim/world';
import type { FxDirector } from './fx';
import { STYLE, SUPER } from '../data/tuning';
import { PAPER } from '../data/paper';
import { effects } from './effects';
import { HAND, MARKER } from './paper';
import { penCircle, penHatch, penLine, penRect, penScribble, seedSketch, srand } from './sketch';

/**
 * Paper-drawn HUD (revision pass 6, ink looks): ink and pencil on the page.
 * Shapes are seeded (stable), re-rolled at ~7 fps when Line boil is on.
 * Layout: health/super top-left, scoreboard top-centre, combo + rank
 * top-right below the pause button (measured, so they never overlap); the
 * lower half stays clear for the pad.
 */
export class PaperHud {
  visible = true;
  waveLabel = '';
  private hpLag = 1;
  private shown = 0;
  private bossLag = 1;
  private boil = 0;

  draw(ctx: CanvasRenderingContext2D, w: World, fx: FxDirector, dt: number, time: number): void {
    const u = Math.max(0.8, layout.ui);
    const r = layout.world;
    const p = w.player, c = w.combo;
    const hc = settings.highContrast;
    this.boil = settings.boil ? Math.floor(time * PAPER.boilFps) % 3 : 0;
    const ink = PAPER.ink, red = PAPER.red, blue = PAPER.blue;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // Damage: red pen hatching creeping in from the edges (stepped), not a pink wash.
    if (effects.hurtVignette > 0.05) {
      const k = Math.min(1, effects.hurtVignette);
      seedSketch(Math.floor(time * 10) * 17);
      ctx.strokeStyle = red; ctx.globalAlpha = 0.55 * k; ctx.lineWidth = 2;
      ctx.beginPath();
      const d = 40 * k * u;
      for (let x = 0; x < layout.cssW; x += 9) { penLine(ctx, x, 0, x + d * 0.6, d * (0.6 + srand() * 0.6), 0.5, 0); penLine(ctx, x, layout.cssH, x + d * 0.6, layout.cssH - d * (0.6 + srand() * 0.6), 0.5, 0); }
      for (let y = 0; y < layout.cssH; y += 9) { penLine(ctx, 0, y, d * (0.6 + srand() * 0.6), y + d * 0.5, 0.5, 0); penLine(ctx, layout.cssW, y, layout.cssW - d * (0.6 + srand() * 0.6), y + d * 0.5, 0.5, 0); }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (!this.visible) { ctx.restore(); return; }

    const top = Math.max(8, layout.portrait ? 8 : r.y + 10 * u);
    const left = r.x + 12 * u;

    // ---- Health: heart doodle + ink box + scribbled fill (blue -> red) ----
    const hpW = Math.min(250 * u, r.w * 0.34), hpH = 16 * u;
    const hpF = Math.max(0, p.hp / p.maxHp);
    this.hpLag += (hpF - this.hpLag) * Math.min(1, dt * (hpF < this.hpLag ? 2.5 : 12));
    const hx = left + 18 * u, hy = top + hpH / 2;
    seedSketch(11 + this.boil);
    ctx.strokeStyle = ink; ctx.lineWidth = 2;
    ctx.fillStyle = hpF < 0.35 ? red : '#e86a7a';
    heart(ctx, hx, hy, 9 * u); ctx.fill(); ctx.stroke();
    const bx = left + 34 * u;
    const fillCol = hpF > 0.6 ? blue : hpF > 0.35 ? '#7a45b8' : red;
    if (this.hpLag > hpF) { ctx.strokeStyle = 'rgba(120,115,105,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); penHatch(ctx, bx + hpW * hpF, top + 2, hpW * (this.hpLag - hpF), hpH - 4, 4); ctx.stroke(); }
    ctx.save(); ctx.beginPath(); ctx.rect(bx, top, hpW * hpF, hpH); ctx.clip();
    seedSketch(23 + this.boil);
    ctx.strokeStyle = fillCol; ctx.lineWidth = 3.2 * u;
    ctx.beginPath(); penScribble(ctx, bx + 1, top + 2, hpW, hpH - 4, 5 * u); ctx.stroke();
    if (hpF < 0.35) { ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.beginPath(); penHatch(ctx, bx, top, hpW, hpH, 5); ctx.stroke(); }
    ctx.restore();
    seedSketch(31 + this.boil);
    ctx.strokeStyle = ink; ctx.lineWidth = hc ? 3 : 2;
    ctx.beginPath(); penRect(ctx, bx, top, hpW, hpH, 1.2); ctx.stroke();
    ctx.font = `${Math.round(15 * u)}px ${HAND}`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = ink;
    ctx.fillText(`${Math.ceil(p.hp)}`, bx + hpW + 6 * u, top + hpH / 2 + 1);

    // ---- Super meter: two pencil boxes with tick marks, shaded with red pen when full ----
    const sy = top + hpH + 7 * u, sh = 10 * u, segW = (hpW - 6 * u) / 2;
    for (let i = 0; i < 2; i++) {
      const lo = i * SUPER.finisherCost;
      const f = Math.max(0, Math.min(1, (c.superMeter - lo) / SUPER.finisherCost));
      const x = bx + i * (segW + 6 * u);
      if (f > 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(x, sy, segW * f, sh); ctx.clip();
        seedSketch(41 + i + this.boil);
        ctx.strokeStyle = f >= 1 ? red : PAPER.pencil; ctx.lineWidth = f >= 1 ? 2 : 1.4;
        ctx.beginPath(); penHatch(ctx, x, sy, segW, sh, f >= 1 ? 3 : 4); ctx.stroke();
        ctx.restore();
      }
      seedSketch(51 + i + this.boil);
      ctx.strokeStyle = ink; ctx.lineWidth = 1.6;
      ctx.beginPath(); penRect(ctx, x, sy, segW, sh, 0.8);
      for (let t = 1; t < 5; t++) penLine(ctx, x + (segW * t) / 5, sy + sh, x + (segW * t) / 5, sy + sh - 4 * u, 0.3, 0);
      ctx.stroke();
    }
    if (c.superMeter >= SUPER.finisherCost && Math.floor(time * 4) % 2 === 0) {
      ctx.font = `${Math.round(14 * u)}px ${MARKER}`;
      ctx.fillStyle = red; ctx.textBaseline = 'top';
      ctx.fillText('SUPER READY!', bx, sy + sh + 5 * u);
    }
    drawHeatBar(ctx, w, bx, sy + sh + 24 * u, hpW * 0.5, 7 * u, u, ink, HAND);

    // ---- Scoreboard (top centre): wave, score, tally marks for K.O.s ----
    // narrow screens: slide right of the HP number so they never overlap
    const cx = Math.max(r.x + r.w / 2, bx + hpW + 78 * u);
    this.shown += (c.score - this.shown) * Math.min(1, dt * 10);
    if (Math.abs(c.score - this.shown) < 1) this.shown = c.score;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `${Math.round(15 * u)}px ${HAND}`;
    ctx.fillStyle = PAPER.pencil;
    ctx.fillText(this.waveLabel.toLowerCase(), cx, top - 2);
    ctx.font = `${Math.round(26 * u)}px ${MARKER}`;
    ctx.fillStyle = ink;
    ctx.fillText(Math.round(this.shown).toLocaleString(), cx, top + 14 * u);
    const kos = Math.min(25, c.totalKOs);
    if (kos > 0) {
      seedSketch(61 + this.boil);
      ctx.strokeStyle = ink; ctx.lineWidth = 1.6;
      ctx.beginPath();
      const groups = Math.ceil(kos / 5), gw = 22 * u;
      let x0 = cx - (groups * gw) / 2;
      for (let gi = 0; gi < groups; gi++) {
        const n = Math.min(5, kos - gi * 5), y0 = top + 48 * u;
        for (let k = 0; k < Math.min(4, n); k++) penLine(ctx, x0 + k * 4 * u, y0, x0 + k * 4 * u + 1, y0 + 12 * u, 0.4, 0.5);
        if (n === 5) penLine(ctx, x0 - 2 * u, y0 + 9 * u, x0 + 15 * u, y0 + 2 * u, 0.4, 0.5);
        x0 += gw;
      }
      ctx.stroke();
      if (c.totalKOs > 25) { ctx.font = `${Math.round(13 * u)}px ${HAND}`; ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.fillText(`+${c.totalKOs - 25}`, x0, top + 46 * u); }
    }

    // ---- Boss / elite HP ----
    let boss = null;
    for (const e of w.enemies) if (e.def?.hpBar && (e.alive || e.state === 'ko')) { boss = e; break; }
    if (boss) {
      const cx = r.x + r.w / 2; // the boss bar sits below the HP row, so it can stay centred
      const bw = Math.min(460 * u, r.w * 0.5), bh = 12 * u, by = top + 66 * u;
      const f = Math.max(0, boss.hp / boss.maxHp);
      this.bossLag += (f - this.bossLag) * Math.min(1, dt * (f < this.bossLag ? 2 : 10));
      ctx.save(); ctx.beginPath(); ctx.rect(cx - bw / 2, by, bw * f, bh); ctx.clip();
      seedSketch(71 + this.boil); ctx.strokeStyle = red; ctx.lineWidth = 3; ctx.beginPath(); penScribble(ctx, cx - bw / 2, by + 1, bw, bh - 2, 5); ctx.stroke();
      ctx.restore();
      seedSketch(73 + this.boil); ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.beginPath(); penRect(ctx, cx - bw / 2, by, bw, bh, 1); ctx.stroke();
      ctx.font = `${Math.round(15 * u)}px ${MARKER}`; ctx.fillStyle = fx.bossBarFlash > 0 ? red : ink; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(boss.def!.name + (boss.kind === 'boss' ? ` · phase ${boss.ai.phase}` : ''), cx, by + bh + 3 * u);
    } else this.bossLag = 1;

    // ---- Combo counter + rank (right, under the pause button; measured so they never overlap) ----
    const rx = r.x + r.w - 14 * u;
    const ry = top + 56 * u;
    if (c.hits > 0 || c.style > 0) {
      const rk = c.rank;
      const slam = fx.rankSlam;
      // rank: marker letter in a sketchy circle
      const rs = Math.round(40 * u * (1 + Math.round(slam * 3) / 3 * 0.5));
      const rcx = rx - 30 * u, rcy = ry + 26 * u;
      ctx.font = `${rs}px ${MARKER}`;
      const letter = STYLE.ranks[rk];
      const lw = ctx.measureText(letter).width;
      const rr = Math.max(26 * u, lw * 0.62);
      const rankCol = rk >= 4 ? red : rk >= 2 ? ink : rk >= 1 ? blue : PAPER.pencil;
      ctx.save(); ctx.translate(rcx, rcy); ctx.rotate(-0.12);
      ctx.fillStyle = rankCol; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(letter, 0, 2);
      seedSketch(81 + rk + this.boil);
      ctx.strokeStyle = rankCol; ctx.lineWidth = 2;
      ctx.beginPath(); penCircle(ctx, 0, 0, rr, rr * 0.82, 1.5); ctx.stroke();
      if (rk >= 6) sparkles(ctx, rr, time);
      ctx.restore();
      // fill: a pencil line under the circle
      seedSketch(91 + this.boil);
      ctx.strokeStyle = PAPER.pencil; ctx.lineWidth = 1.5;
      ctx.beginPath(); penLine(ctx, rcx - rr, rcy + rr + 6 * u, rcx + rr, rcy + rr + 6 * u, 0.5, 0); ctx.stroke();
      ctx.strokeStyle = rankCol; ctx.lineWidth = 3;
      ctx.beginPath(); penLine(ctx, rcx - rr, rcy + rr + 6 * u, rcx - rr + 2 * rr * c.rankFill(), rcy + rr + 6 * u, 0.5, 0); ctx.stroke();
      // combo: big hand-lettered number left of the rank, stepped squash pop, growing underline
      if (c.hits > 1) {
        const pop = 1 + Math.round(fx.comboPop * 3) / 3 * 0.3;
        const size = Math.round((38 + Math.min(26, c.hits * 0.8)) * u);
        ctx.save();
        const nx = rcx - rr - 12 * u, ny = ry + 30 * u;
        ctx.translate(nx, ny);
        ctx.scale(pop, 1 / pop);
        ctx.font = `${size}px ${MARKER}`;
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillStyle = c.hits >= 30 ? red : ink;
        ctx.fillText(String(c.hits), 0, 0);
        const tw = ctx.measureText(String(c.hits)).width;
        ctx.restore();
        seedSketch(101 + this.boil);
        ctx.strokeStyle = c.hits >= 30 ? red : blue; ctx.lineWidth = 2.5;
        const ul = Math.min(tw + 30 * u, (20 + c.hits * 3) * u);
        ctx.beginPath(); penLine(ctx, nx - ul, ny + size * 0.45, nx, ny + size * 0.42, 1.2, 1); ctx.stroke();
        ctx.font = `${Math.round(15 * u)}px ${HAND}`;
        ctx.fillStyle = ink; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText('hit combo', nx, ny + size * 0.5);
        const sc = Math.round(c.scale() * 100);
        if (sc < 100) { ctx.fillStyle = PAPER.pencil; ctx.fillText(`dmg ${sc}%`, nx, ny + size * 0.5 + 15 * u); }
      }
    }
    // finisher hints
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.font = `${Math.round(15 * u)}px ${HAND}`;
    if (c.superMeter >= SUPER.finisherCost && Math.floor(time * 4) % 2 === 0) {
      let line = 0;
      const hy0 = ry + 96 * u;
      if (!p.grounded && c.launcherUsed && c.airJuggle >= SUPER.jumpshotMinJuggle) { ctx.fillStyle = red; ctx.fillText('↓ jumpshot finisher!', rx, hy0 + line * 17 * u); line++; }
      if (c.hits >= SUPER.flurryMinCombo) { ctx.fillStyle = red; ctx.fillText('long swipe: FLURRY!', rx, hy0 + line * 17 * u); }
    }
    if (p.critTimer > 0) {
      ctx.textAlign = 'center'; ctx.font = `${Math.round(22 * u)}px ${MARKER}`; ctx.fillStyle = red;
      ctx.fillText('CRIT READY', r.x + r.w / 2, r.y + r.h * 0.36);
    }

    // ---- Combo summary: a sticky note ----
    const ce = fx.lastComboEnd;
    if (ce && fx.comboEndT > 0) {
      const k = fx.comboEndT;
      const slide = Math.max(0, (k - 1.9) * 3) * 60 * u;
      const bw = 170 * u, bh = 70 * u;
      const nx = rx - bw + slide, ny = ry + (c.hits > 1 ? 120 : 76) * u;
      ctx.save();
      ctx.translate(nx + bw / 2, ny + bh / 2); ctx.rotate(0.03);
      ctx.fillStyle = '#fff3a6'; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      ctx.fillStyle = 'rgba(235,225,180,0.85)'; ctx.fillRect(-22 * u, -bh / 2 - 7 * u, 44 * u, 13 * u);
      ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(18 * u)}px ${MARKER}`;
      ctx.fillText(`${ce.hits} hit combo`, -bw / 2 + 10 * u, -bh / 2 + 18 * u);
      ctx.font = `${Math.round(15 * u)}px ${HAND}`;
      ctx.fillText(`${ce.damage} dmg · max rank ${STYLE.ranks[ce.maxRank]}`, -bw / 2 + 10 * u, -bh / 2 + 39 * u);
      ctx.fillStyle = ce.dropped ? red : blue;
      ctx.fillText(ce.dropped ? 'combo broken :(' : `+${ce.bonus.toLocaleString()} style`, -bw / 2 + 10 * u, -bh / 2 + 57 * u);
      ctx.restore();
    }

    // ---- Popups (PERFECT PARRY, finisher names): marker lettering + scribbled underline ----
    for (let i = 0; i < fx.popups.length; i++) {
      const pp = fx.popups[i];
      const k = pp.t / pp.life;
      const scale = k < 0.12 ? 1.35 - Math.floor(k / 0.04) * 0.12 : 1; // stepped pop
      if (k > 0.85 && Math.floor(time * 12) % 2) continue;
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h * (pp.big ? 0.26 : 0.2) + i * 8);
      ctx.scale(scale, scale); ctx.rotate(-0.04);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `${Math.round((pp.big ? 46 : 32) * u)}px ${MARKER}`;
      const tw = ctx.measureText(pp.text).width;
      ctx.fillStyle = PAPER.highlighter; ctx.globalAlpha = 0.85;
      ctx.fillRect(-tw / 2 - 6, 4 * u, tw + 12, 12 * u);
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink;
      ctx.fillText(pp.text, 0, 0);
      if (pp.sub) { ctx.font = `${Math.round(16 * u)}px ${HAND}`; ctx.fillStyle = red; ctx.fillText(pp.sub, 0, 26 * u); }
      ctx.restore();
    }
    ctx.restore();
  }
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y + s * 0.1, x - s * 0.9, y - s * 1.0, x, y - s * 0.3);
  ctx.bezierCurveTo(x + s * 0.9, y - s * 1.0, x + s * 1.4, y + s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

/** Little doodle stars around the SSS circle (stepped twinkle). */
function sparkles(ctx: CanvasRenderingContext2D, r: number, time: number): void {
  const st = Math.floor(time * 8);
  ctx.strokeStyle = PAPER.red; ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    if ((st + i) % 3 === 0) continue;
    const a = (i / 5) * Math.PI * 2 + 0.4, d = r * 1.35, x = Math.cos(a) * d, y = Math.sin(a) * d * 0.85, s = 4 + (i % 2) * 2;
    ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
  }
  ctx.stroke();
}
