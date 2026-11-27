import type { World } from '../sim/world';
import { DRAW } from './drawStyle';
import { INK } from './ink';
import { WORLD } from '../data/tuning';
import { settings } from '../core/settings';
import { effects } from './effects';

/**
 * Techniques from the third reference clip (REFERENCE_NOTES.md, "Clip 3"), Pixel look only.
 * Render-only: reads the world, never writes it, never touches the sim's RNG.
 *  - screen frames: red tear (blade finishers, 268), stipple flash (big blasts, 72), dither-to-black cut
 *    (wave clear, 168-170), dithered title card (game over, 10), VS card (boss waves, 278-298)
 *  - world marks: dither pillar on launchers (104), beam clash ring (208-210), thrown-body dither trail
 *    and spike-landing debris (196-202), KO slide pebbles (98), dodge scribble ball (120), floor X-slashes
 *    (160), dust mounds that stay (74)
 *  - weather: rain (48-50) and a starfield sky for the final boss (24-30)
 *  - a hard camera punch-in on finishers (142)
 * Stipples are drawn with an explicit 1-px checker pattern, so they hold up with Mobile Performance
 * (which skips the palette snap).
 */
const TAU = Math.PI * 2;
const BLADES = new Set(['staff', 'daggers', 'scythe']);
let sd = 1;
const rnd = (): number => { sd = (Math.imul(sd, 1103515245) + 12345) | 0; return ((sd >>> 8) & 0xffffff) / 16777216; };

interface Mark { x: number; y: number; t: number; life: number; seed: number; a: number }
const mk = (x: number, y: number, life: number, a = 0): Mark => ({ x, y, t: 0, life, seed: (Math.random() * 1e9) | 0, a });

export class Clip3Fx {
  // screen frames (seconds left)
  tear = { t: 0, life: 0, x: 0, y: 0, a: 0, seed: 1 };
  stipple = 0;
  cut = 0; private readonly cutLife = 0.5;
  title = 0; private readonly titleLife = 0.55;
  vs = { t: 0, life: 0, name: '', sub: '' };
  /** Hard (not eased) camera punch: zoom factor while it lasts. */
  private punchT = 0; private punchAmt = 0;
  // world marks
  private pillars: Mark[] = []; private rings: Mark[] = []; private balls: Mark[] = []; private debris: Mark[] = [];
  private pebbles: { x: number; y: number; vx: number; vy: number; t: number }[] = [];
  private trails = new Map<number, number[]>();
  private slideAcc = new Map<number, number>();
  private xs: Mark[] = []; private mounds: Mark[] = [];
  /** Indoor page (242-276): crates (broken = -1 timer), swinging lamps (angle, velocity), planted swords (154). */
  private crates = [{ x: 0, y: 0, broken: false }, { x: 0, y: 0, broken: false }, { x: 0, y: 0, broken: false }];
  private lamps = [{ x: 0, a: 0, v: 0 }, { x: 0, a: 0, v: 0 }, { x: 0, a: 0, v: 0 }];
  private planks: { x: number; y: number; vx: number; vy: number; a: number; va: number; t: number }[] = [];
  private swords: Mark[] = [];
  private wave = 0;
  private time = 0;
  private finalBoss = false;
  /** World -> low-res layer transform captured while drawing the world (for screen frames at a world point). */
  private m: DOMMatrix | null = null;
  private pats = new Map<string, CanvasPattern>();
  /** Cooldowns (s) so full-screen frames stay rare. */
  private tearCd = 0; private stippleCd = 0;
  /** Full-screen frames only exist in the Pixel look (drawScreen runs only there). */
  private get px(): boolean { return DRAW.ink && settings.look === 'pixel'; }

  bind(w: World): void {
    const ev = w.events;
    ev.on('hit', (e) => {
      if (!DRAW.ink || e.attacker.team !== 'player') return;
      const v = e.victim, m = e.move;
      if (this.px && e.kind === 'finisher' && v.hp <= 0 && this.tearCd <= 0 && BLADES.has(w.weapon.id) && !settings.reduceFlashes) {
        this.tearCd = 1;
        this.tear = { t: 0, life: 0.14, x: e.x, y: e.y, a: Math.atan2(e.dirY || -0.35, e.dirX || 1) - 0.5, seed: (Math.random() * 1e9) | 0 };
        effects.invert = 0; // the tear replaces the plain invert
      }
      if (e.kind === 'finisher') this.punch(0.16, 0.12);
      this.nudgeIndoor(e.x, e.y, e.weight);
      if (e.kind === 'launch') this.pillars.push(mk(v.x, WORLD.groundY, 0.16));
      if (m && (m.sound === 'slash' || BLADES.has(w.weapon.id)) && e.weight >= 0.7 && v.y > WORLD.groundY - 140 && this.xs.length < 24 && !this.xs.some((q) => Math.abs(q.x - v.x) < 40)) this.xs.push(mk(v.x, WORLD.groundY, 9999, (Math.random() - 0.5) * 0.4));
    });
    ev.on('ko', (e) => {
      if (!DRAW.ink) return;
      if (e.last) this.punch(0.22, 0.14);
      if (BLADES.has(w.weapon.id) && this.swords.length < 8) this.swords.push(mk(e.x + (Math.random() - 0.5) * 40, WORLD.groundY, 9999, (Math.random() - 0.5) * 0.5));
      this.nudgeIndoor(e.x, e.y, 1.2);
    });
    ev.on('beam', (e) => { if (DRAW.ink && e.hit && e.heavy) this.rings.push(mk(e.x2, e.y2, 0.3)); });
    ev.on('dodge', (e) => { if (DRAW.ink) this.balls.push(mk(e.x, e.y - 34, 0.3)); });
    ev.on('groundImpact', (e) => {
      if (!DRAW.ink || e.fighter.team === 'player') return;
      if (e.power > 0.55) this.debris.push(mk(e.x, WORLD.groundY, 0.22, e.power));
      if (e.power > 0.95) this.addMounds(e.x, 1);
    });
    const blast = (x: number, flash: boolean) => {
      if (!DRAW.ink) return;
      this.addMounds(x, 3);
      if (!flash) return;
      if (this.px && !settings.reduceFlashes && this.stippleCd <= 0) { this.stipple = 0.07; this.stippleCd = 1; effects.screenFlash = 0; }
    };
    ev.on('shockwave', (e) => blast(e.x, false));
    ev.on('meteor', (e) => blast(e.x, true));
    ev.on('bossPhase', () => { if (this.px && !settings.reduceFlashes) { this.stipple = 0.1; this.stippleCd = 1; } });
    ev.on('wallBreak', (e) => { if (DRAW.ink) { this.addMounds(e.x - e.dir * 60, 2); if (this.px && !settings.reduceFlashes) { this.stipple = 0.08; this.stippleCd = 1; } this.punch(0.14, 0.1); } });
    ev.on('clash', (e) => { if (this.px && !e.end && !settings.reduceFlashes) this.tear = { t: 0, life: 0.1, x: e.x, y: e.y, a: -0.2, seed: (Math.random() * 1e9) | 0 }; });
    ev.on('waveClear', () => { if (this.px) this.cut = this.cutLife; });
    ev.on('waveStart', (e) => {
      this.xs.length = 0; this.mounds.length = 0; this.trails.clear(); this.swords.length = 0; this.planks.length = 0;
      this.wave = e.wave;
      const A = WORLD.arenaW;
      [A * 0.6, A * 0.6 + 58, A * 0.6 + 29].forEach((x, i) => { this.crates[i].x = x; this.crates[i].y = i === 2 ? WORLD.groundY - 56 : WORLD.groundY; this.crates[i].broken = false; });
      [A * 0.28, A * 0.52, A * 0.78].forEach((x, i) => { this.lamps[i].x = x; this.lamps[i].a = 0; this.lamps[i].v = 0; });
      this.finalBoss = false;
      if (this.px && e.boss) this.vs = { t: 0, life: 1.6, name: 'YOU', sub: '' };
    });
    ev.on('spawn', (e) => {
      const b = e.enemy.def?.boss;
      if (!b) return;
      this.finalBoss = e.enemy.kind === 'shadow';
      if (this.vs.life > 0 && this.vs.t < 0.4) this.vs.sub = b.title;
    });
  }

  /** Indoor page on every fifth wave from wave 4 (not boss waves). */
  indoor(w: World): boolean { return DRAW.ink && this.wave >= 4 && this.wave % 5 === 4 && !w.enemies.some((e) => e.def?.boss); }
  /** A hit near a crate breaks it; any hit makes nearby lamps swing (render-only). */
  private nudgeIndoor(x: number, y: number, weight: number): void {
    for (const l of this.lamps) { const d = Math.abs(l.x - x); if (d < 260) l.v += (x < l.x ? 1 : -1) * weight * 0.06 * (1 - d / 260); }
    if (weight < 0.6) return;
    for (const c of this.crates) {
      if (c.broken || Math.abs(c.x - x) > 70 || y < c.y - 140) continue;
      c.broken = true;
      for (let i = 0; i < 7; i++) this.planks.push({ x: c.x + (Math.random() - 0.5) * 40, y: c.y - 28, vx: (Math.random() - 0.5) * 700, vy: -300 - Math.random() * 500, a: Math.random() * 6, va: (Math.random() - 0.5) * 18, t: 0 });
    }
  }
  /** Game over: a dithered card dissolve before the results (frame 10). */
  titleCard(): void { if (this.px) this.title = this.titleLife; }
  /** Rain on every fourth wave from wave 3 (not on boss waves). */
  raining(w: World): boolean { return DRAW.ink && !settings.mobilePerf && w.wave >= 3 && w.wave % 4 === 3 && !w.enemies.some((e) => e.def?.boss); }
  /** The extra zoom factor from the hard punch-in (1 = none). */
  zoomFactor(): number { return this.punchT > 0 ? 1 + this.punchAmt : 1; }
  private punch(amt: number, sec: number): void { if (settings.shake > 0) { this.punchAmt = Math.max(this.punchAmt * (this.punchT > 0 ? 1 : 0), amt); this.punchT = sec; } }
  private addMounds(x: number, n: number): void {
    for (let i = 0; i < n && this.mounds.length < 30; i++) this.mounds.push(mk(x + (Math.random() - 0.5) * 160, WORLD.groundY, 9999, 0.6 + Math.random() * 0.7));
  }

  update(dt: number, w: World): void {
    this.time += dt;
    const dec = (v: number) => Math.max(0, v - dt);
    this.stipple = dec(this.stipple); this.tearCd = dec(this.tearCd); this.stippleCd = dec(this.stippleCd); this.cut = dec(this.cut); this.title = dec(this.title); this.punchT = dec(this.punchT);
    if (this.tear.t < this.tear.life) this.tear.t += dt;
    if (this.vs.t < this.vs.life) this.vs.t += dt;
    for (const list of [this.pillars, this.rings, this.balls, this.debris]) {
      for (const k of list) k.t += dt;
      for (let i = list.length - 1; i >= 0; i--) if (list[i].t >= list[i].life) list.splice(i, 1);
    }
    for (const l of this.lamps) { l.v += -l.a * 30 * dt; l.v *= 1 - 1.6 * dt; l.a += l.v * 60 * dt; l.a = Math.max(-0.9, Math.min(0.9, l.a)); }
    for (const p of this.planks) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 1600 * dt; p.a += p.va * dt; if (p.y > WORLD.groundY - 3) { p.y = WORLD.groundY - 3; p.vy *= -0.25; p.vx *= 0.5; p.va *= 0.5; } }
    for (const p of this.pebbles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 1500 * dt; if (p.y > WORLD.groundY) { p.y = WORLD.groundY; p.vy *= -0.3; p.vx *= 0.6; } }
    for (let i = this.pebbles.length - 1; i >= 0; i--) if (this.pebbles[i].t > 0.7) this.pebbles.splice(i, 1);
    if (!DRAW.ink) return;
    // thrown bodies: sample a trail while they fly fast; KO'd bodies sliding on the floor kick up pebbles
    for (const e of w.enemies) {
      const sp = Math.hypot(e.vx, e.vy);
      if (!e.grounded && sp > 650) {
        let t = this.trails.get(e.id);
        if (!t) { t = []; this.trails.set(e.id, t); }
        t.push(e.cx, e.cy);
        if (t.length > 24) t.splice(0, 2);
      } else if (this.trails.has(e.id)) {
        const t = this.trails.get(e.id)!;
        t.splice(0, 2);
        if (!t.length) this.trails.delete(e.id);
      }
      if (!e.alive && e.grounded && Math.abs(e.vx) > 120 && this.pebbles.length < 60) {
        const acc = (this.slideAcc.get(e.id) ?? 0) + dt;
        if (acc > 0.05) {
          this.slideAcc.set(e.id, 0);
          for (let k = 0; k < 2; k++) this.pebbles.push({ x: e.x - Math.sign(e.vx) * 10, y: WORLD.groundY - 2, vx: -Math.sign(e.vx) * (40 + Math.random() * 120), vy: -120 - Math.random() * 220, t: 0 });
        } else this.slideAcc.set(e.id, acc);
      }
    }
  }

  private pattern(ctx: CanvasRenderingContext2D, color: string): CanvasPattern | null {
    const k = color;
    let p = this.pats.get(k);
    if (!p) {
      const c = document.createElement('canvas'); c.width = 2; c.height = 2;
      const g = c.getContext('2d')!;
      g.fillStyle = color; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1);
      p = ctx.createPattern(c, 'repeat') ?? undefined;
      if (p) this.pats.set(k, p);
    }
    return p ?? null;
  }

  /** World-space marks (inside the camera transform, before the palette snap). */
  drawWorld(ctx: CanvasRenderingContext2D, w: World, wpp: number): void {
    if (!DRAW.ink) return;
    this.m = ctx.getTransform();
    const G = WORLD.groundY, step = Math.floor(this.time * 12);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    this.drawSimBits(ctx, w, wpp, G, step);
    // dust mounds that stay: dithered humps along the floor
    for (const d of this.mounds) {
      const wd = 70 * d.a, h = 24 * d.a;
      ctx.fillStyle = this.pattern(ctx, INK.ink) ?? INK.ink;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      const p0 = this.m.transformPoint(new DOMPoint(d.x - wd, G)), p1 = this.m.transformPoint(new DOMPoint(d.x + wd, G - h));
      ctx.beginPath(); ctx.ellipse((p0.x + p1.x) / 2, p0.y, Math.abs(p1.x - p0.x) / 2, Math.abs(p1.y - p0.y), 0, Math.PI, TAU); ctx.fill();
      ctx.restore();
      sd = d.seed + step; ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.8 * wpp + 0.4; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const t = i / 5, x = d.x - wd + t * wd * 2, y = G - Math.sin(t * Math.PI) * h + (rnd() - 0.5) * 2; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
    // floor X-slashes (frame 160): two crossed cuts in the floor line, hatched
    ctx.strokeStyle = INK.ink;
    for (const x of this.xs) {
      ctx.lineWidth = 3 * wpp + 0.6; ctx.beginPath();
      for (const s of [-1, 1]) { const a = s * 0.55 + x.a; ctx.moveTo(x.x - Math.cos(a) * 36, G - 4 - Math.sin(a) * 16); ctx.lineTo(x.x + Math.cos(a) * 36, G + 6 + Math.sin(a) * 16); }
      ctx.stroke();
      ctx.lineWidth = 1 * wpp + 0.2; ctx.beginPath();
      for (let i = -2; i <= 2; i++) { ctx.moveTo(x.x + i * 7 - 4, G + 7); ctx.lineTo(x.x + i * 7 + 4, G + 1); }
      ctx.stroke();
    }
    // thrown-body trails (196-200): a dotted, dithered arc behind fast flyers
    for (const [, t] of this.trails) {
      for (let i = 0; i + 1 < t.length; i += 2) {
        const k = i / t.length, r = (3 + k * 9) * (1 + (i % 4 === 0 ? 0.3 : 0));
        ctx.fillStyle = this.pattern(ctx, INK.ink) ?? INK.ink;
        ctx.beginPath(); ctx.arc(t[i], t[i + 1], r, 0, TAU); ctx.fill();
      }
    }
    // spike landing debris (202): straight lines kicked up and out from the feet
    for (const d of this.debris) {
      const k = d.t / d.life; sd = d.seed;
      ctx.lineWidth = 1.8 * wpp + 0.4; ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4, L = (30 + rnd() * 50) * d.a, r0 = 16 + k * 40;
        ctx.moveTo(d.x + Math.cos(a) * r0, G + Math.sin(a) * r0 * 0.7); ctx.lineTo(d.x + Math.cos(a) * (r0 + L), G + Math.sin(a) * (r0 + L) * 0.7);
      }
      ctx.stroke();
    }
    // KO slide pebbles (98)
    ctx.fillStyle = INK.paper; ctx.lineWidth = 1.2 * wpp + 0.2;
    for (const p of this.pebbles) { ctx.beginPath(); ctx.arc(p.x, p.y - 3, 3.2, 0, TAU); ctx.fill(); ctx.stroke(); }
    // dodge scribble ball (120): tight loops tumbling where the hero dodged
    for (const b of this.balls) {
      const k = b.t / b.life; sd = b.seed + step;
      ctx.lineWidth = 1.4 * wpp + 0.3; ctx.beginPath();
      for (let i = 0; i < 26; i++) { const a = rnd() * TAU, r = (12 + rnd() * 16) * (1 - k * 0.4); const x = b.x + Math.cos(a) * r * 1.4, y = b.y + Math.sin(a) * r * 0.8; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
    // dither pillar (104): a tall black core with stippled edges on launchers
    for (const p of this.pillars) {
      const k = p.t / p.life, wd = 26 * (1 - k * 0.5), h = 420;
      ctx.fillStyle = INK.ink; ctx.fillRect(p.x - wd * 0.45, G - h, wd * 0.9, h);
      ctx.fillStyle = this.pattern(ctx, INK.ink) ?? INK.ink;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      const a = this.m.transformPoint(new DOMPoint(p.x - wd * 1.8, G - h)), b = this.m.transformPoint(new DOMPoint(p.x + wd * 1.8, G));
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.restore();
    }
    // beam clash ring (208-210): a dotted halo ring and a jagged glyph at the tip
    for (const r of this.rings) {
      const k = r.t / r.life, R = 30 + k * 110; sd = r.seed;
      ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.6 * wpp + 0.4; ctx.setLineDash([3 * wpp + 1, 4 * wpp + 2]);
      ctx.beginPath(); ctx.arc(r.x, r.y, R, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      if (k < 0.35) {
        ctx.lineWidth = 3 * wpp + 0.8; ctx.beginPath(); ctx.moveTo(r.x - 14, r.y - 18);
        for (let i = 1; i <= 5; i++) ctx.lineTo(r.x + (i % 2 ? 12 : -12) + (rnd() - 0.5) * 6, r.y - 18 + i * 8);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** Background pass (before the fighters): the indoor page's ceiling, lamps, stairs, table and crates. */
  drawBack(ctx: CanvasRenderingContext2D, w: World, wpp: number): void {
    if (!DRAW.ink) return;
    const G = WORLD.groundY;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // planted swords (154-166): blades left standing in the floor, hilts up
    ctx.strokeStyle = INK.ink;
    for (const s of this.swords) {
      const ux = Math.sin(s.a), uy = -Math.cos(s.a), x0 = s.x - ux * 14, y0 = G + 10;
      ctx.lineWidth = 2.4 * wpp + 0.6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + ux * 70, y0 + uy * 70); ctx.stroke();
      ctx.lineWidth = 3 * wpp + 0.6; ctx.beginPath(); ctx.moveTo(x0 + ux * 56 - uy * 10, y0 + uy * 56 + ux * 10); ctx.lineTo(x0 + ux * 56 + uy * 10, y0 + uy * 56 - ux * 10); ctx.stroke();
      ctx.strokeStyle = INK.red; ctx.lineWidth = 1.6 * wpp + 0.4; ctx.beginPath(); ctx.moveTo(x0 + ux * 60, y0 + uy * 60); ctx.lineTo(x0 + ux * 70, y0 + uy * 70); ctx.stroke(); ctx.strokeStyle = INK.ink;
    }
    if (!this.indoor(w)) { ctx.restore(); return; }
    const A = WORLD.arenaW, top = G - 560;
    // ceiling
    ctx.fillStyle = INK.ink; ctx.fillRect(-400, top - 6, A + 800, 6 * wpp + 4);
    // stairs up to a landing on the left, shaded with a stipple (background only: nobody climbs them)
    const sx = 60, landY = G - 150;
    ctx.save(); ctx.beginPath(); ctx.moveTo(sx, G); ctx.lineTo(sx, landY); ctx.lineTo(sx + 220, landY);
    for (let i = 0; i < 6; i++) { ctx.lineTo(sx + 220 + i * 26, landY + i * 25); ctx.lineTo(sx + 220 + (i + 1) * 26, landY + i * 25); }
    ctx.lineTo(sx + 220 + 6 * 26, G); ctx.closePath();
    ctx.fillStyle = INK.paper; ctx.fill();
    ctx.lineWidth = 2 * wpp + 0.4; ctx.strokeStyle = INK.ink; ctx.stroke();
    ctx.clip();
    if (this.m) { const m = this.m; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = this.pattern(ctx, INK.ink) ?? INK.ink; const a = m.transformPoint(new DOMPoint(sx, landY + 40)), b = m.transformPoint(new DOMPoint(sx + 420, G)); ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); }
    ctx.restore();
    // a railing post
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 2 * wpp + 0.4; ctx.beginPath(); ctx.moveTo(sx + 216, landY); ctx.lineTo(sx + 216, landY - 90); ctx.lineTo(sx + 392, G - 90); ctx.stroke();
    // table
    const tx = A * 0.38; ctx.lineWidth = 3 * wpp + 0.6; ctx.beginPath(); ctx.moveTo(tx - 70, G - 62); ctx.lineTo(tx + 70, G - 62); ctx.moveTo(tx - 60, G - 62); ctx.lineTo(tx - 60, G); ctx.moveTo(tx + 60, G - 62); ctx.lineTo(tx + 60, G); ctx.stroke();
    // hanging lamps
    for (const l of this.lamps) {
      const L = 120, hx = l.x + Math.sin(l.a) * L, hy = top + Math.cos(l.a) * L;
      ctx.lineWidth = 1.4 * wpp + 0.3; ctx.beginPath(); ctx.moveTo(l.x, top); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = INK.ink; ctx.save(); ctx.translate(hx, hy); ctx.rotate(-l.a);
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(22, 18); ctx.lineTo(-22, 18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = INK.paper; ctx.fillRect(-14, 18, 28, 3); ctx.restore();
    }
    // crates (hatched boxes) and their flying planks
    for (const c of this.crates) {
      if (c.broken) continue;
      const S = 56;
      ctx.fillStyle = INK.paper; ctx.fillRect(c.x - S / 2, c.y - S, S, S);
      ctx.lineWidth = 2 * wpp + 0.4; ctx.strokeRect(c.x - S / 2, c.y - S, S, S);
      ctx.lineWidth = 1.2 * wpp + 0.2; ctx.beginPath();
      for (let k = -2; k <= 2; k++) { ctx.moveTo(c.x - S / 2, c.y - S / 2 + k * 11); ctx.lineTo(c.x - S / 2 + S / 2 - k * 11, c.y - S); }
      ctx.moveTo(c.x - S / 2, c.y); ctx.lineTo(c.x + S / 2, c.y - S);
      ctx.stroke();
    }
    ctx.lineWidth = 2.2 * wpp + 0.4;
    for (const p of this.planks) { if (p.t > 2.5) continue; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = INK.paper; ctx.fillRect(-12, -3, 24, 6); ctx.strokeRect(-12, -3, 24, 6); ctx.restore(); }
    ctx.restore();
  }

  /** Breakable walls, the wrecking ball and the blade clash (sim/clip3Sim.ts). */
  private drawSimBits(ctx: CanvasRenderingContext2D, w: World, wpp: number, G: number, step: number): void {
    const c3 = w.c3, m = this.m!;
    // page edges: hairline cracks after one hard hit; a black, dithered hole once smashed (216-238)
    for (const side of [0, 1]) {
      const x = side === 0 ? WORLD.wallMargin : WORLD.arenaW - WORLD.wallMargin, out = side === 0 ? -1 : 1;
      if (c3.broken[side]) {
        sd = 501 + side;
        const pts: [number, number][] = [];
        for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([x - out * (10 + rnd() * 40) * Math.sin(t * Math.PI) - out * 6, G - t * 300]); }
        ctx.fillStyle = INK.ink; ctx.beginPath(); ctx.moveTo(x + out * 400, G);
        for (const [px, py] of pts) ctx.lineTo(px, py);
        ctx.lineTo(x + out * 400, G - 300); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = this.pattern(ctx, INK.ink) ?? INK.ink;
        const a = m.transformPoint(new DOMPoint(Math.min(x - out * 70, x + out * 10), G - 340)), b = m.transformPoint(new DOMPoint(Math.max(x - out * 70, x + out * 10), G));
        ctx.fillRect(Math.min(a.x, b.x), a.y, Math.abs(b.x - a.x), b.y - a.y);
        ctx.restore();
        ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.6 * wpp + 0.3; ctx.beginPath();
        for (let i = 0; i < 9; i++) { const yy = G - 30 - rnd() * 280, xx = x - out * (40 + rnd() * 50); ctx.rect(xx - 7, yy - 4, 14, 8); }
        ctx.stroke();
      } else if (c3.cracks[side] > 0) {
        sd = 601 + side; ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.6 * wpp + 0.3; ctx.beginPath();
        let yy = G - 220, xx = x;
        ctx.moveTo(xx, yy);
        for (let i = 0; i < 7; i++) { xx = x - out * rnd() * 26; yy += 26 + rnd() * 10; ctx.lineTo(xx, yy); }
        ctx.stroke();
      }
    }
    // the wrecking ball (184): a big dithered ball with hatched bands rolling along the floor, jagged dust behind
    for (const b of c3.balls) {
      const R = 70;
      if (b.t <= b.warn) {
        if ((step & 1) === 0) { ctx.fillStyle = INK.red; ctx.font = 'bold 56px monospace'; ctx.textAlign = 'center'; ctx.fillText('!', b.x + b.dir * 90, G - 40); }
        continue;
      }
      const cy = G - R, rot = (b.x / R) * b.dir;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = this.pattern(ctx, INK.ink) ?? INK.ink;
      const c = m.transformPoint(new DOMPoint(b.x, cy)), e = m.transformPoint(new DOMPoint(b.x + R, cy));
      ctx.beginPath(); ctx.arc(c.x, c.y, Math.abs(e.x - c.x), 0, TAU); ctx.fill(); ctx.restore();
      ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.4 * wpp + 0.6;
      ctx.beginPath(); ctx.arc(b.x, cy, R, 0, TAU); ctx.stroke();
      ctx.lineWidth = 3.2 * wpp + 0.6; ctx.beginPath();
      for (let i = 0; i < 3; i++) { const a = rot + (i * Math.PI) / 3; ctx.moveTo(b.x + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95); ctx.quadraticCurveTo(b.x + Math.cos(a + 1.2) * R * 0.2, cy + Math.sin(a + 1.2) * R * 0.2, b.x - Math.cos(a) * R * 0.95, cy - Math.sin(a) * R * 0.95); }
      ctx.stroke();
      sd = step * 7 + 3; ctx.lineWidth = 1.6 * wpp + 0.3; ctx.beginPath();
      for (let i = 0; i < 4; i++) { const x0 = b.x - b.dir * (R + 10 + i * 22), y0 = G - 10 - rnd() * 40; ctx.moveTo(x0, y0); ctx.lineTo(x0 - b.dir * 18, y0 - 12); ctx.lineTo(x0 - b.dir * 8, y0 - 4); ctx.lineTo(x0 - b.dir * 30, y0 - 20); }
      ctx.stroke();
    }
    // blade clash (114-116): red sparks spraying from the locked blades
    const cl = c3.clash;
    if (cl) {
      sd = step * 13 + cl.t; ctx.strokeStyle = INK.red; ctx.lineWidth = 2 * wpp + 0.5; ctx.beginPath();
      for (let i = 0; i < 12; i++) { const a = rnd() * TAU, r0 = 6 + rnd() * 10, r1 = r0 + 14 + rnd() * 30; ctx.moveTo(cl.x + Math.cos(a) * r0, cl.y + Math.sin(a) * r0); ctx.lineTo(cl.x + Math.cos(a) * r1, cl.y + Math.sin(a) * r1); }
      ctx.stroke();
      ctx.strokeStyle = INK.ink; ctx.lineWidth = 3 * wpp + 0.6; ctx.beginPath(); ctx.moveTo(cl.x - 46, cl.y); ctx.lineTo(cl.x + 46, cl.y); ctx.stroke();
    }
  }

  /** Screen frames, drawn on the low-res layer in pixels (before the palette snap). */
  drawScreen(ctx: CanvasRenderingContext2D, W: number, H: number, w: World): void {
    if (!DRAW.ink) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const step = Math.floor(this.time * 12);
    // weather
    if (this.finalBoss) this.drawStars(ctx, W, H, step);
    if (this.raining(w)) {
      sd = 77; ctx.strokeStyle = INK.ink; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 70; i++) {
        const x = rnd() * W, L = 6 + rnd() * 14, sp = 0.6 + rnd() * 0.6, y = ((rnd() * H + this.time * H * 1.6 * sp) % (H + 40)) - 20;
        ctx.moveTo(Math.round(x) + 0.5, y); ctx.lineTo(Math.round(x) + 0.5, y + L);
      }
      ctx.stroke();
    }
    // stipple flash (72): the whole frame goes to a checker
    if (this.stipple > 0) { ctx.fillStyle = this.pattern(ctx, INK.ink) ?? INK.ink; ctx.fillRect(0, 0, W, H); }
    // red tear (268)
    const t = this.tear;
    if (t.t < t.life && this.m) {
      const p = this.m.transformPoint(new DOMPoint(t.x, t.y));
      ctx.fillStyle = INK.ink; ctx.fillRect(0, 0, W, H);
      const ux = Math.cos(t.a), uy = Math.sin(t.a), nx = -uy, ny = ux, L = Math.hypot(W, H), wd = H * 0.09 * (1 - t.t / t.life * 0.5);
      sd = t.seed;
      const top: [number, number][] = [], bot: [number, number][] = [];
      for (let i = 0; i <= 18; i++) {
        const s = -L + (i / 18) * 2 * L, k = 1 - Math.abs(i / 18 - 0.5) * 1.6;
        const w1 = wd * (0.3 + rnd() * 0.9) * Math.max(0.1, k), w2 = wd * (0.3 + rnd() * 0.9) * Math.max(0.1, k);
        top.push([p.x + ux * s + nx * w1, p.y + uy * s + ny * w1]); bot.push([p.x + ux * s - nx * w2, p.y + uy * s - ny * w2]);
      }
      ctx.fillStyle = INK.paper; ctx.beginPath();
      top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK.red; ctx.lineWidth = 2; ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const s = (rnd() - 0.5) * L, o = (rnd() - 0.5) * wd; ctx.moveTo(p.x + ux * s + nx * o, p.y + uy * s + ny * o); ctx.lineTo(p.x + ux * (s + 20 + rnd() * 30) + nx * o, p.y + uy * (s + 20 + rnd() * 30) + ny * o); }
      ctx.stroke();
    }
    // dither-to-black cut (168-170) and the game-over card dissolve (10)
    const cutK = this.cut > 0 ? 1 - this.cut / this.cutLife : -1;
    if (cutK >= 0) {
      if (cutK < 0.45) { ctx.fillStyle = this.pattern(ctx, INK.ink) ?? INK.ink; ctx.fillRect(0, 0, W, H); if (cutK > 0.25) { ctx.fillStyle = INK.ink; ctx.fillRect(0, 0, W, H * ((cutK - 0.25) / 0.2)); } }
      else if (cutK < 0.75) { ctx.fillStyle = INK.ink; ctx.fillRect(0, 0, W, H); }
      else { ctx.fillStyle = this.pattern(ctx, INK.ink) ?? INK.ink; ctx.fillRect(0, 0, W, H); }
    }
    if (this.title > 0) {
      const k = 1 - this.title / this.titleLife;
      ctx.fillStyle = this.pattern(ctx, INK.ink) ?? INK.ink;
      ctx.fillRect(0, 0, W, H * Math.min(1, k * 1.6));
      if (k > 0.5) { ctx.fillStyle = INK.ink; ctx.fillRect(0, H * 0.4, W, H * 0.2); ctx.fillStyle = INK.paper; ctx.font = `bold ${Math.max(8, Math.round(H * 0.06))}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('GAME OVER', W / 2, H / 2); }
    }
    // VS card (278-298): the scene in white on black, a red slashed VS, flickering red pixel squares
    if (this.vs.t < this.vs.life) this.drawVS(ctx, W, H, step);
    ctx.restore();
  }

  private drawStars(ctx: CanvasRenderingContext2D, W: number, H: number, step: number): void {
    const band = H * 0.3;
    ctx.fillStyle = INK.ink; ctx.fillRect(0, 0, W, band);
    sd = 91;
    for (let i = 0; i < 26; i++) {
      const x = rnd() * W, y = rnd() * band * 0.9, r = rnd() < 0.15 ? 3 : 1;
      if ((step + i) % 7 === 0) continue;
      ctx.fillStyle = INK.blue; ctx.fillRect(Math.round(x) - r, Math.round(y) - r, r * 2 + 1, r * 2 + 1);
      ctx.fillStyle = INK.paper; ctx.fillRect(Math.round(x) - (r > 1 ? 1 : 0), Math.round(y) - (r > 1 ? 1 : 0), r > 1 ? 3 : 1, r > 1 ? 3 : 1);
    }
    // a planet rising at the edge (frame 30)
    ctx.fillStyle = INK.paper; ctx.strokeStyle = INK.blue; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W * 0.82, band + H * 0.18, H * 0.24, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK.paper; ctx.fillRect(0, band, W, 1);
  }

  private drawVS(ctx: CanvasRenderingContext2D, W: number, H: number, step: number): void {
    const k = this.vs.t / this.vs.life;
    if (!settings.reduceFlashes) {
      // white silhouettes on black: paint the drawn world white, then put black behind it
      ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = INK.paper; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = INK.ink; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    } else { ctx.fillStyle = INK.ink; ctx.fillRect(0, H * 0.3, W, H * 0.4); }
    // red pixel squares flickering in two corners
    const s = Math.max(4, Math.round(H * 0.035));
    sd = 13 + (step >> 1);
    for (const [cx, cy, dx, dy] of [[W - s, 0, -1, 1], [0, H - s, 1, -1]] as const) {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) {
        if (rnd() < 0.25) continue;
        ctx.fillStyle = rnd() < 0.3 ? this.pattern(ctx, INK.red) ?? INK.red : INK.red;
        ctx.fillRect(cx + dx * i * s, cy + dy * j * s, s - 1, s - 1);
      }
    }
    // red crosshair lines sweeping
    ctx.strokeStyle = INK.red; ctx.lineWidth = 1;
    const lx = Math.round(W * (0.15 + 0.7 * ((k * 1.7) % 1))), ly = Math.round(H * (0.25 + 0.5 * ((k * 1.3 + 0.4) % 1)));
    ctx.beginPath(); ctx.moveTo(lx + 0.5, 0); ctx.lineTo(lx + 0.5, H); ctx.moveTo(0, ly + 0.5); ctx.lineTo(W, ly + 0.5); ctx.stroke();
    // the slashed VS: two jagged red strokes, drawn on over the first 0.25 s
    const draw = Math.min(1, k / 0.16), cx = W / 2, cy = H * 0.48, sz = H * 0.2;
    ctx.fillStyle = INK.red;
    const stroke = (pts: [number, number][], wd: number) => {
      const n = Math.max(2, Math.ceil(pts.length * draw));
      ctx.beginPath();
      for (let i = 0; i < n; i++) ctx.lineTo(cx + pts[i][0] * sz, cy + pts[i][1] * sz - wd * sz);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(cx + pts[i][0] * sz + wd * sz * 0.6, cy + pts[i][1] * sz + wd * sz);
      ctx.closePath(); ctx.fill();
    };
    stroke([[-0.9, -0.6], [-0.7, -0.1], [-0.45, 0.55]], 0.11);
    stroke([[-0.45, 0.55], [-0.05, -0.2], [0.2, -0.75]], 0.1);
    stroke([[0.85, -0.6], [0.35, -0.3], [0.55, 0.05], [0.1, 0.5]], 0.1);
    // names
    ctx.fillStyle = INK.paper; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.max(8, Math.round(H * 0.06))}px monospace`;
    ctx.textAlign = 'left'; ctx.fillText(this.vs.name, Math.round(W * 0.08), Math.round(H * 0.3));
    ctx.textAlign = 'right'; ctx.fillText(this.vs.sub || '???', Math.round(W * 0.92), Math.round(H * 0.7));
  }
}

export const clip3Fx = new Clip3Fx();
