import { ANIMS, getAnim } from '../data/anims';
import type { AnimDef } from '../data/anims/types';
import { evalAnim, animFlags, type AnimFlags } from '../render/animPlayer';
import { DRAW, syncDrawStyle } from '../render/drawStyle';
import { computeJoints } from '../render/rig';
import { Fighter } from '../sim/fighter';
import { ENEMIES } from '../data/enemies';
import { MOVES } from '../data/moves';
import { drawFighter } from '../render/stickman';
import { drawInkFighter, INK } from '../render/ink';
import { INKLOOK } from '../data/inkLook';
import { WORLD } from '../data/tuning';
import type { WeaponDef } from '../data/weapons';

/**
 * Pose a fighter at time t of an animation, exactly as the Animation Lab shows
 * it (shared by the Lab and the loadout preview). Hand-Drawn replays the
 * drawing latches up to t, so smear chains and arcs match a real fight.
 */
export function placeFighter(f: Fighter, def: AnimDef, t: number, x: number, y: number, facing: number, flags: AnimFlags): void {
  const a = f.anim;
  f.x = f.px = x; f.y = f.py = y; f.facing = facing;
  f.grounded = y >= WORLD.groundY - 1;
  evalAnim(def, t, a.pose);
  evalAnim(def, Math.max(0, t - 1), a.prevPose);
  evalAnim(def, Math.max(0, t - 2), a.prev2Pose);
  a.prevPose.set(a.pose);
  animFlags(def, t, flags);
  a.smear = flags.smear;
  a.reachW = a.prevReachW = flags.reachW;
  a.reachLimb = def.reach;
  a.face = a.prevFace = facing;
  a.trailActive = false;
  a.cur = def;
  computeJoints(a.pose, x, y, facing, f.scale, WORLD.groundY, a.joints, a.rig);
  if (DRAW.stepped) {
    a.scrubTo(def, Math.floor(t), x, y, facing, f.scale);
    a.dReachW = flags.reachW;
    a.dEcho = 0;
  }
}

/**
 * Loadout preview: loops a weapon's moves on a dummy in a small canvas.
 * Framed by the Arcade loadout detail panel (.lo-detail in style.css).
 */
export class MovePreview {
  private hero = new Fighter('player', null);
  private dummy = new Fighter('enemy', ENEMIES.grunt);
  private flags: AnimFlags = { smear: 0, trail: 0, impact: false, reachW: 0, snapping: false };
  private list: string[] = [];
  private idx = 0;
  private t = 0;
  private pause = 0;
  private hitT = 99;
  private time = 0;
  private raf = 0;
  private last = 0;
  label = '';

  constructor(private canvas: HTMLCanvasElement, private onLabel: (s: string) => void = () => {}) {}

  setWeapon(w: WeaponDef): void {
    this.hero.weapon = w.id;
    const ids: string[] = [];
    const add = (id: string) => { if (ANIMS[MOVES[id]?.anim ?? id] && !ids.includes(id)) ids.push(id); };
    for (const k of ['up', 'side', 'upDiag', 'downDiag', 'down'] as const) { add(w.ground[k].light); add(w.ground[k].heavy); }
    this.list = ids;
    this.idx = 0; this.t = 0; this.pause = 0;
    this.showLabel();
  }

  start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.canvas.isConnected) { this.stop(); return; }
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop(): void { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }

  private showLabel(): void {
    const id = this.list[this.idx];
    this.label = id ? (MOVES[id]?.name ?? id) : '';
    this.onLabel(this.label);
  }

  private frame(dt: number): void {
    syncDrawStyle();
    const id = this.list[this.idx];
    const def = id ? ANIMS[MOVES[id]?.anim ?? id] : ANIMS.idle;
    this.time += dt;
    if (this.pause > 0) this.pause -= dt;
    else {
      const prev = this.t;
      this.t += dt * 60 * 0.7;
      if (def.contact >= 0 && prev < def.contact && this.t >= def.contact) this.hitT = 0;
      if (this.t >= def.len) { this.t = 0; this.pause = 0.35; this.idx = (this.idx + 1) % Math.max(1, this.list.length); this.showLabel(); }
    }
    this.hitT += dt * 60;
    const c = this.canvas, ctx = c.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth || 320, H = c.clientHeight || 160;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sc = H / 300;
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * W * 0.5, dpr * H * 0.86);
    ctx.translate(0, -WORLD.groundY);
    const wpp = 1 / (INKLOOK.refRes * INKLOOK.zoom);
    ctx.strokeStyle = DRAW.ink ? INK.ink : '#cfd6e6'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-W / sc, WORLD.groundY); ctx.lineTo(W / sc, WORLD.groundY); ctx.stroke();
    const air = def.base === 'air';
    const mv = MOVES[def.id];
    const reach = mv ? Math.min(mv.ranged ? 260 : 160, mv.reach + 40) : 80;
    const hx = -reach / 2 - 20, hy = air ? WORLD.groundY - 90 : WORLD.groundY;
    placeFighter(this.hero, def, Math.min(this.t, def.len - 0.01), hx, hy, 1, this.flags);
    const dDef = this.hitT < 22 ? ANIMS.hurtLight : getAnim('grunt', 'idle');
    const dt0 = this.hitT < 22 ? this.hitT : (this.time * 60) % dDef.len;
    placeFighter(this.dummy, dDef, dt0, hx + reach + 30, WORLD.groundY, -1, this.flags);
    this.dummy.flash = this.hitT < 4 ? 2 : 0;
    for (const f of [this.dummy, this.hero]) {
      if (DRAW.ink) drawInkFighter(ctx, f, 1, this.time, wpp);
      else drawFighter(ctx, f, 1, this.time, 0);
    }
  }
}
