import type { World } from '../sim/world';
import type { Camera } from '../core/camera';
import type { TimeControl } from '../core/time';
import type { DrawPad } from '../ui/pad';
import { effects } from './effects';
import { audio } from '../core/audio';
import { JUICE, STYLE } from '../data/tuning';
import { settings } from '../core/settings';
import type { Fighter } from '../sim/fighter';

export interface Popup { text: string; sub: string; color: string; t: number; life: number; big: boolean }

/**
 * Maps simulation events to juice: particles, shake, slow-mo, camera punch,
 * damage numbers and synthesized audio. Pure presentation.
 */
export class FxDirector {
  /** Centered popups (combo summary, PERFECT PARRY, finisher names). */
  popups: Popup[] = [];
  comboPop = 0;
  rankSlam = 0;
  lastComboEnd: { hits: number; damage: number; maxRank: number; bonus: number; dropped: boolean } | null = null;
  comboEndT = 0;
  bossBarFlash = 0;

  constructor(private cam: Camera, private time: TimeControl, private pad: DrawPad) {}

  bind(w: World): void {
    const ev = w.events;
    ev.on('hit', (e) => {
      const m = e.move;
      const weight = e.weight;
      const color = e.kind === 'armor' ? '#c9b6ff' : m ? m.trail.color : e.kind === 'bowl' ? '#ffd23f' : e.kind === 'shock' ? '#9fd8ff' : e.kind === 'reflect' ? '#3fe0ff' : '#ffffff';
      effects.hitSpark(e.x, e.y, e.dirX, e.dirY * 0.8, weight, color, e.crit);
      const heavy = weight >= 0.75;
      this.cam.shake(Math.min(JUICE.shakeMax, e.shake * (e.crit ? 1.3 : 1)), e.dirX, e.dirY, heavy ? weight * 0.6 : 0);
      if (e.zoom > 0) this.cam.punchZoom(e.zoom);
      e.victim.anim.impulseSquash(0.18 * weight + 0.08, -0.12 * weight - 0.04);
      if (e.dirY < -0.5) e.victim.anim.impulseSquash(-0.1, 0.22);
      // damage numbers
      const dmg = Math.max(1, Math.round(e.damage));
      const size = 20 + Math.min(26, dmg * 0.9) + (e.crit ? 12 : 0);
      effects.text(e.crit ? dmg + '!' : '' + dmg, e.victim.cx, e.victim.cy - 50 * e.victim.scale, e.crit ? '#ffe14a' : e.kind === 'armor' ? '#c9b6ff' : '#ffffff', size, JUICE.damageNumberLife, e.crit ? '#b8401a' : '#000');
      // audio: pitch climbs with combo
      const pitch = 1 + JUICE.comboPitchPerHit * Math.min(e.combo, JUICE.comboPitchCap);
      const kind = m ? (m.sound === 'kick' ? 'kick' : m.sound === 'slash' ? 'slash' : weight > 0.7 ? 'heavy' : 'punch') : 'punch';
      audio.hit(Math.min(1, weight), pitch, kind, e.crit);
      if (e.kind === 'launch') { audio.launch(); effects.dust(e.victim.x, e.victim.y, 0.5); }
      if (e.kind === 'finisher' && m?.multiHit === undefined) audio.boom();
      this.pad.onHit(weight);
      this.comboPop = 1;
      if (e.combo === 2) this.cam.punchZoom(0.05);
    });
    ev.on('block', (e) => {
      effects.hitSpark(e.x, e.y, -e.victim.facing, 0, 0.3, '#9fb8ff');
      effects.text('BLOCK', e.x, e.y - 50, '#9fb8ff', 22, 0.6);
      audio.block();
      this.cam.shake(3, -e.victim.facing, 0);
    });
    ev.on('guardBreak', (e) => {
      effects.text('GUARD BREAK!', e.x, e.y - 70, '#ffe14a', 28, 0.9);
      effects.hitSpark(e.x, e.y, 0, -1, 0.9, '#9fb8ff');
      audio.block();
    });
    ev.on('poiseBreak', (e) => {
      effects.text('BREAK!', e.x, e.y - 80 * e.enemy.scale, '#ff9a3a', 30, 0.9);
      effects.hitSpark(e.x, e.y, 0, -1, 1, '#ff9a3a');
      this.cam.shake(10, 0, -1, 0.4);
      audio.spike(0.5);
    });
    ev.on('whoosh', (e) => {
      audio.whoosh(e.weight);
    });
    ev.on('afterimage', (e) => {
      const f = e.fighter;
      effects.afterimage(f.anim.joints, f.team === 'player' ? '#7fe8ff' : f.color, f.thickness, f.scale);
    });
    ev.on('groundImpact', (e) => {
      if (e.fighter.team === 'player') { if (e.power > 0.2) effects.dust(e.x, e.y, 0.2); return; }
      effects.dust(e.x, e.y, e.power);
      if (e.bounce || e.power > 0.8) {
        effects.crater(e.x, e.y, e.power, '#ffffff');
        this.cam.shake(6 + e.power * 10, 0, 1, 0.3);
        audio.spike(e.power);
        if (e.bounce) effects.text('BOUNCE!', e.x, e.y - 90, '#ff9a3a', 26, 0.7);
      } else if (e.power > 0.35) {
        this.cam.shake(3 + e.power * 4, 0, 1);
        audio.hit(0.4, 0.7, 'heavy');
      }
    });
    ev.on('wallImpact', (e) => {
      effects.hitSpark(e.x, e.y, -e.dir, 0, e.power, '#ffffff');
      effects.dust(e.x, e.y, e.power * 0.6, e.dir);
      this.cam.shake(5 + e.power * 10, -e.dir, 0, 0.3);
      if (e.power > 0.6) { effects.text('WALL BOUNCE!', e.x + e.dir * 60, e.y - 60, '#ffd23f', 24, 0.8); audio.spike(0.6); }
    });
    ev.on('shockwave', (e) => {
      effects.shockwave(e.x, e.y, e.radius, e.color);
      effects.crater(e.x, e.y, e.power, e.color);
      this.cam.shake(10 + e.power * 12, 0, 1, 0.6);
      audio.boom();
      if (!settings.reduceFlashes) { effects.screenFlash = 0.6; effects.screenFlashColor = '#ffffff'; }
    });
    ev.on('ko', (e) => {
      effects.hitSpark(e.x, e.y, Math.sign(e.victim.vx) || 1, -0.6, 1.4, '#ffe14a', true);
      effects.embers(e.x, e.y, 18, e.victim.color);
      effects.text('K.O.', e.x, e.y - 90, '#ff4d6a', 40, 1.0, '#300');
      this.cam.shake(12, Math.sign(e.victim.vx), -0.5, 0.5);
      this.cam.punchZoom(0.6);
      audio.ko();
      if (e.last) {
        this.time.slowmo(JUICE.slowmoLastEnemyScale, JUICE.slowmoLastEnemySec);
        this.cam.focus(0.1, 0.7);
      }
    });
    ev.on('dissolve', (e) => {
      effects.embers(e.x, e.y, 22, e.victim.color);
      effects.dust(e.x, e.y + 20, 0.3);
    });
    ev.on('playerHurt', (e) => {
      effects.hitSpark(e.x, e.y, e.dirX, -0.3, 0.7, '#ff4040');
      effects.hurtVignette = 1;
      effects.text('-' + Math.round(e.damage), e.x, e.y - 60, '#ff5050', 26, 0.8);
      this.cam.shake(12, e.dirX, 0, 0.5);
      audio.hurt();
      if (!settings.reduceFlashes) { effects.screenFlash = 0.25; effects.screenFlashColor = '#ff2020'; }
    });
    ev.on('parry', (e) => {
      this.time.slowmo(0.22, 0.45);
      effects.hitSpark(e.x, e.y, 1, 0, 1.2, '#ffe14a', true);
      const r = effects.spawn(2, e.x, e.y, 0, 0, 0.5, 20, '#ffffff'); r.size2 = 240;
      this.cam.punchZoom(0.7);
      this.cam.shake(8, 0, 0, 0.3);
      if (!settings.reduceFlashes) { effects.screenFlash = 0.7; effects.screenFlashColor = '#fff6c0'; }
      audio.parry();
      this.popup(e.projectile ? 'REFLECT!' : 'PERFECT PARRY', 'next hit is CRITICAL', '#ffe14a', false);
    });
    ev.on('dodge', () => { audio.dodge(); });
    ev.on('telegraph', () => { audio.telegraph(); });
    ev.on('burst', (e) => {
      const r = effects.spawn(2, e.x, e.y, 0, 0, 0.4, 20, '#ff5050'); r.size2 = 200;
      effects.text('BURST!', e.x, e.y - 80, '#ff5050', 28, 0.8);
      this.cam.shake(8, 0, 0, 0.3);
      audio.spike(0.4);
    });
    ev.on('finisher', (e) => {
      if (e.kind === 'jumpshot') {
        this.time.slowmo(JUICE.slowmoFinisherScale, JUICE.slowmoFinisherSec);
        this.cam.focus(0.3, 0.6);
        this.popup('JUMPSHOT!', 'FINISHER', '#ff4dd2', true);
      } else {
        this.time.slowmo(0.4, 0.25);
        this.cam.focus(0.15, 0.8);
        this.popup('FLURRY!', 'FINISHER', '#ff4dd2', true);
      }
      effects.embers(e.x, e.y, 26, '#ff4dd2');
      audio.launch();
    });
    ev.on('rankUp', (e) => {
      this.rankSlam = 1;
      audio.rankUp(e.rank);
      audio.intensity = Math.min(1, e.rank / 5);
    });
    ev.on('comboEnd', (e) => {
      this.lastComboEnd = e;
      this.comboEndT = 2.2;
    });
    ev.on('pickup', (e) => {
      effects.embers(e.x, e.y, 6, e.kind === 'health' ? '#5dff8a' : '#5fc8ff');
      effects.text(e.kind === 'health' ? '+HP' : '+SUPER', e.x, e.y - 30, e.kind === 'health' ? '#5dff8a' : '#5fc8ff', 18, 0.6);
      audio.pickup(e.kind);
    });
    ev.on('projectile', (e) => {
      if (e.kind === 'throw') audio.throwDart();
      else { effects.hitSpark(e.x, e.y, 1, 0, 0.6, '#3fe0ff'); }
    });
    ev.on('meteorWarn', () => { audio.telegraph(); });
    ev.on('meteor', (e) => {
      effects.crater(e.x, e.y, 0.9, '#ff6a2a');
      effects.embers(e.x, e.y - 20, 20, '#ff8a3a');
      this.cam.shake(10, 0, 1, 0.3);
      audio.spike(0.8);
    });
    ev.on('bossPhase', (e) => {
      this.popup(e.phase === 2 ? 'THE COLOSSUS RAGES' : 'FINAL PHASE', e.phase === 2 ? 'meteors incoming' : 'it\'s faster now', '#ff4040', true);
      this.cam.shake(16, 0, 1, 0.6);
      audio.boom();
      this.bossBarFlash = 1;
    });
    ev.on('chain', (e) => {
      effects.bolt(e.x1, e.y1, e.x2, e.y2, '#9fd8ff');
      effects.bolt(e.x1, e.y1, e.x2, e.y2, '#ffffff');
    });
    ev.on('text', (e) => effects.text(e.text, e.x, e.y, e.color, e.size));
    ev.on('spawn', (e) => {
      const f: Fighter = e.enemy;
      if (f.kind === 'boss') { this.popup('THE COLOSSUS', 'BOSS', '#ff4040', true); this.cam.shake(14, 0, 1, 0.5); }
      if (f.kind === 'elite') this.popup('RONIN', 'ELITE', '#ff4dd2', true);
    });
  }

  popup(text: string, sub: string, color: string, big: boolean): void {
    this.popups.push({ text, sub, color, t: 0, life: big ? 1.4 : 1.0, big });
    if (this.popups.length > 3) this.popups.shift();
  }

  update(dt: number): void {
    this.comboPop = Math.max(0, this.comboPop - dt * 6);
    this.rankSlam = Math.max(0, this.rankSlam - dt * 3);
    this.comboEndT = Math.max(0, this.comboEndT - dt);
    this.bossBarFlash = Math.max(0, this.bossBarFlash - dt * 2);
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.t += dt;
      if (p.t >= p.life) this.popups.splice(i, 1);
    }
  }

  static rankColor(r: number): string {
    return ['#9aa0b4', '#5fc8ff', '#5dff8a', '#ffe14a', '#ff9a3a', '#ff4d6a', '#ff4dd2'][r] ?? '#fff';
  }
  static rankName(r: number): string { return STYLE.ranks[r]; }
}
