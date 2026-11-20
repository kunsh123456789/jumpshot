import { layout } from '../core/layout';
import type { World } from '../sim/world';
import { FxDirector } from './fx';
import { STYLE, SUPER } from '../data/tuning';
import { effects } from './effects';
import { roundRect } from '../ui/pad';
import { DRAW } from './drawStyle';

/** Heads-up display drawn in CSS-pixel space. */
export class Hud {
  private hpLag = 1;
  private shownScore = 0;
  private bossLag = 1;
  visible = true;
  wave = 0;
  waveLabel = '';

  draw(ctx: CanvasRenderingContext2D, w: World, fx: FxDirector, dt: number, time: number): void {
    const u = layout.ui;
    const r = layout.world;
    const p = w.player;
    const c = w.combo;

    // Hurt vignette.
    if (effects.hurtVignette > 0) {
      const g = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.35, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.75);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, `rgba(255,20,30,${0.55 * effects.hurtVignette})`);
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    if (!this.visible) return;

    const top = layout.portrait ? 8 : r.y + 12 * u;
    const left = r.x + 14 * u;

    // ---- HP bar ----
    const hpW = Math.min(300 * u, r.w * 0.36), hpH = 16 * u;
    const hpF = Math.max(0, p.hp / p.maxHp);
    this.hpLag += (hpF - this.hpLag) * Math.min(1, dt * (hpF < this.hpLag ? 2.5 : 12));
    bar(ctx, left, top, hpW, hpH, this.hpLag, hpF, hpF > 0.35 ? '#5dff8a' : '#ff5050', '#ffffff');
    ctx.font = `900 italic ${Math.round(11 * u)}px system-ui, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, left + 8 * u, top + hpH / 2 + 0.5);

    // ---- Super meter (two segments) ----
    const sy = top + hpH + 6 * u;
    const sh = 10 * u;
    const segW = (hpW - 6 * u) / 2;
    for (let i = 0; i < 2; i++) {
      const lo = i * SUPER.finisherCost;
      const f = Math.max(0, Math.min(1, (c.superMeter - lo) / SUPER.finisherCost));
      const full = f >= 1;
      const col = full ? (Math.sin(time * 10) > 0 ? '#ff4dd2' : '#ff9af0') : '#b04aff';
      bar(ctx, left + i * (segW + 6 * u), sy, segW, sh, f, f, col, col);
    }
    if (c.superMeter >= SUPER.finisherCost) {
      ctx.font = `900 italic ${Math.round(11 * u)}px system-ui, sans-serif`;
      ctx.fillStyle = '#ff9af0';
      ctx.fillText('SUPER READY', left, sy + sh + 10 * u);
    }

    // ---- Wave / score ----
    const cx = r.x + r.w / 2;
    this.shownScore += (c.score - this.shownScore) * Math.min(1, dt * 10);
    if (Math.abs(c.score - this.shownScore) < 1) this.shownScore = c.score;
    ctx.textAlign = 'center';
    ctx.font = `900 italic ${Math.round(13 * u)}px system-ui, sans-serif`;
    ctx.fillStyle = DRAW.ink ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.75)';
    ctx.fillText(this.waveLabel, cx, top + 6 * u);
    ctx.font = `900 italic ${Math.round(24 * u)}px system-ui, sans-serif`;
    outlineText(ctx, Math.round(this.shownScore).toLocaleString(), cx, top + 26 * u, '#ffffff', 4 * u);

    // ---- Boss / elite HP ----
    let boss = null;
    for (const e of w.enemies) if (e.def?.hpBar && (e.alive || e.state === 'ko')) { boss = e; break; }
    if (boss) {
      const bw = Math.min(520 * u, r.w * 0.5), bh = 12 * u;
      const by = top + 46 * u;
      const f = Math.max(0, boss.hp / boss.maxHp);
      this.bossLag += (f - this.bossLag) * Math.min(1, dt * (f < this.bossLag ? 2 : 10));
      bar(ctx, cx - bw / 2, by, bw, bh, this.bossLag, f, boss.color, '#ffffff');
      if (boss.maxPoise > 0) {
        const pf = Math.max(0, boss.poise / boss.maxPoise);
        ctx.fillStyle = '#c9b6ff';
        ctx.fillRect(cx - bw / 2, by + bh + 2, bw * pf, 3 * u);
      }
      ctx.font = `900 italic ${Math.round(12 * u)}px system-ui, sans-serif`;
      outlineText(ctx, boss.def!.name + (boss.kind === 'boss' ? `  ·  PHASE ${boss.ai.phase}` : ''), cx, by + bh + 14 * u, fx.bossBarFlash > 0 ? '#ffe14a' : '#ffffff', 3);
    } else this.bossLag = 1;

    // ---- Combo counter + style rank (right side) ----
    const rx = r.x + r.w - 18 * u;
    const ry = (layout.portrait ? r.y + 10 : top + 70 * u);
    if (c.hits > 0 || c.style > 0) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      if (c.hits > 1) {
        const pop = 1 + fx.comboPop * 0.35;
        const size = Math.round((44 + Math.min(30, c.hits)) * u * pop);
        const hue = Math.min(c.hits * 6, 330);
        ctx.font = `900 italic ${size}px system-ui, sans-serif`;
        const col = c.hits >= 30 ? `hsl(${(time * 200) % 360},100%,70%)` : `hsl(${50 - hue * 0.15},100%,${Math.max(55, 85 - c.hits)}%)`;
        outlineText(ctx, String(c.hits), rx - 66 * u, ry + size * 0.8, col, 6 * u, 'right');
        ctx.font = `900 italic ${Math.round(18 * u)}px system-ui, sans-serif`;
        outlineText(ctx, 'HITS', rx - 66 * u, ry + size * 0.8 + 18 * u, '#ffffff', 4 * u, 'right');
        // damage scaling indicator
        const sc = Math.round(c.scale() * 100);
        if (sc < 100) {
          ctx.font = `800 ${Math.round(11 * u)}px system-ui, sans-serif`;
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillText(`DMG ${sc}%`, rx - 66 * u, ry + size * 0.8 + 34 * u);
        }
      }
      // rank letter
      const rk = c.rank;
      const slam = fx.rankSlam;
      const ls = Math.round(58 * u * (1 + slam * slam * 1.2));
      ctx.save();
      ctx.translate(rx - 26 * u, ry + 48 * u);
      ctx.rotate(-0.12 - slam * 0.3);
      ctx.font = `900 italic ${ls}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      const rcol = rk === 6 ? `hsl(${(time * 300) % 360},100%,70%)` : FxDirector.rankColor(rk);
      outlineText(ctx, STYLE.ranks[rk], 0, 0, rcol, 6 * u, 'center');
      ctx.restore();
      // fill bar under the letter
      const fw = 60 * u;
      bar(ctx, rx - 26 * u - fw / 2, ry + 58 * u, fw, 6 * u, c.rankFill(), c.rankFill(), FxDirector.rankColor(rk), '#fff');
    }

    // Finisher hints.
    const hintY = ry + 92 * u;
    ctx.textAlign = 'right';
    ctx.font = `900 italic ${Math.round(13 * u)}px system-ui, sans-serif`;
    const blink = Math.sin(time * 9) > -0.3;
    if (c.superMeter >= SUPER.finisherCost && blink) {
      let line = 0;
      if (!p.grounded && c.launcherUsed && c.airJuggle >= SUPER.jumpshotMinJuggle) {
        outlineText(ctx, '↓ JUMPSHOT FINISHER', rx, hintY + line * 18 * u, '#ff4dd2', 4, 'right'); line++;
      }
      if (c.hits >= SUPER.flurryMinCombo) {
        outlineText(ctx, 'LONG SWIPE: FLURRY', rx, hintY + line * 18 * u, '#ff4dd2', 4, 'right');
      }
    }
    if (p.critTimer > 0) {
      ctx.textAlign = 'center';
      outlineText(ctx, 'CRIT READY', r.x + r.w / 2, r.y + r.h * 0.42, '#ffe14a', 4, 'center');
    }

    // ---- Combo summary ----
    const ce = fx.lastComboEnd;
    if (ce && fx.comboEndT > 0) {
      const k = fx.comboEndT;
      const a = Math.min(1, k * 2.5);
      const slide = Math.max(0, (k - 1.9) * 3) * 60 * u;
      ctx.globalAlpha = a;
      const bw = 200 * u, bh = 74 * u;
      const bx = rx - bw + slide, by = ry + (c.hits > 1 ? 130 : 80) * u;
      ctx.fillStyle = 'rgba(8,10,24,0.78)';
      ctx.beginPath(); roundRect(ctx, bx, by, bw, bh, 10 * u); ctx.fill();
      ctx.strokeStyle = FxDirector.rankColor(ce.maxRank); ctx.lineWidth = 2; ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = `900 italic ${Math.round(17 * u)}px system-ui, sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.fillText(`${ce.hits} HIT COMBO`, bx + 12 * u, by + 16 * u);
      ctx.font = `700 ${Math.round(12 * u)}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(`${ce.damage} DMG  ·  MAX RANK `, bx + 12 * u, by + 36 * u);
      const tw = ctx.measureText(`${ce.damage} DMG  ·  MAX RANK `).width;
      ctx.fillStyle = FxDirector.rankColor(ce.maxRank);
      ctx.font = `900 italic ${Math.round(14 * u)}px system-ui, sans-serif`;
      ctx.fillText(STYLE.ranks[ce.maxRank], bx + 12 * u + tw, by + 36 * u);
      ctx.fillStyle = ce.dropped ? '#ff5050' : '#ffe14a';
      ctx.font = `900 italic ${Math.round(13 * u)}px system-ui, sans-serif`;
      ctx.fillText(ce.dropped ? 'COMBO BROKEN' : `+${ce.bonus.toLocaleString()} STYLE`, bx + 12 * u, by + 56 * u);
      ctx.globalAlpha = 1;
    }

    // ---- Popups ----
    for (let i = 0; i < fx.popups.length; i++) {
      const pp = fx.popups[i];
      const k = pp.t / pp.life;
      const scale = k < 0.1 ? 2 - k * 10 : 1;
      const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      ctx.globalAlpha = a;
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h * (pp.big ? 0.3 : 0.24) + i * 8);
      ctx.scale(scale, scale);
      ctx.rotate(-0.05);
      ctx.textAlign = 'center';
      ctx.font = `900 italic ${Math.round((pp.big ? 54 : 36) * u)}px system-ui, sans-serif`;
      outlineText(ctx, pp.text, 0, 0, pp.color, 7 * u, 'center');
      ctx.font = `800 italic ${Math.round(14 * u)}px system-ui, sans-serif`;
      outlineText(ctx, pp.sub, 0, 26 * u, '#ffffff', 4, 'center');
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lag: number, f: number, col: string, lagCol: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x, y, w, h);
  if (lag > f) { ctx.fillStyle = lagCol; ctx.globalAlpha *= 0.6; ctx.fillRect(x, y, w * lag, h); ctx.globalAlpha = Math.min(1, ctx.globalAlpha / 0.6); }
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w * f, h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x, y, w * f, Math.max(1, h * 0.3));
}

export function outlineText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, col: string, ow: number, align: CanvasTextAlign = 'center'): void {
  ctx.textAlign = align;
  ctx.lineJoin = 'round';
  ctx.lineWidth = ow;
  ctx.strokeStyle = '#05060c';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = col;
  ctx.fillText(s, x, y);
}
