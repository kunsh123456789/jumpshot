import type { World } from '../sim/world';
import type { Camera } from '../core/camera';
import type { TimeControl } from '../core/time';
import type { DrawPad } from '../ui/pad';
import { effects } from './effects';
import { audio } from '../core/audio';
import { ANIM, JUICE, PLAYER, STYLE, WORLD } from '../data/tuning';
import { setAnimSfx } from './animator';
import { crescentFlash, lightning } from './weaponFx';
import { settings } from '../core/settings';
import type { Fighter } from '../sim/fighter';

export interface Popup { text: string; sub: string; color: string; t: number; life: number; big: boolean }

/**
 * Maps simulation events to juice: particles, shake, slow-mo, camera punch,
 * damage numbers and synthesized audio. Pure presentation.
 */
export class FxDirector {
  /** Centered popups (combo summary, PERFECT PARRY, finisher names). */
  /** Rhythm Mode: hit pitch from the song's scale (null in Classic = the combo pitch climb). */
  pitchFn: ((combo: number) => number) | null = null;
  popups: Popup[] = [];
  comboPop = 0;
  rankSlam = 0;
  lastComboEnd: { hits: number; damage: number; maxRank: number; bonus: number; dropped: boolean } | null = null;
  comboEndT = 0;
  bossBarFlash = 0;

  constructor(private cam: Camera, private time: TimeControl, private pad: DrawPad) {}

  bind(w: World): void {
    const ev = w.events;
    // Keyframe sound cues (player only: footsteps, landings).
    setAnimSfx((sfx) => { if (sfx === 'step') audio.step(); else if (sfx === 'land') audio.step(true); });
    ev.on('hit', (e) => {
      const m = e.move;
      // Reference FX: lightning strikes, the white-crescent impact frame.
      if (m?.fx?.lightning && e.attacker.team === 'player') { lightning(e.victim.cx, e.victim.cy, e.victim.id * 97 + e.combo); audio.weapon('thunder'); if (!settings.reduceFlashes) effects.invert = ANIM.invertSec; this.cam.shake(10, 0, 1, 0.3); }
      if ((m?.fx?.crescent || e.kind === 'finisher') && e.attacker.team === 'player' && !settings.reduceFlashes) { crescentFlash(e.x, e.y, e.dirX); effects.invert = Math.max(effects.invert, ANIM.invertSec * 1.5); }
      const weight = e.weight;
      const color = e.kind === 'armor' ? '#c9b6ff' : m ? m.trail.color : e.kind === 'bowl' ? '#ffd23f' : e.kind === 'shock' ? '#9fd8ff' : e.kind === 'reflect' ? '#3fe0ff' : '#ffffff';
      effects.hitSpark(e.x, e.y, e.dirX, e.dirY * 0.8, weight, color, e.crit);
      // Impact frame: speed lines on every hit; inverted flash reserved for heavy hits, launchers, spikes, finishers.
      const big = weight >= 0.75 || e.kind === 'launch' || e.kind === 'spike' || e.kind === 'finisher';
      effects.speedLines(e.x, e.y, e.dirX, e.dirY, big);
      if (big && !settings.reduceFlashes) effects.invert = ANIM.invertSec;
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
      const pitch = this.pitchFn ? this.pitchFn(e.combo) : 1 + JUICE.comboPitchPerHit * Math.min(e.combo, JUICE.comboPitchCap);
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
      // Afterimages are emitted at render rate from interpolated poses (see drawFighter).
      e.fighter.anim.ghostTime = Math.max(e.fighter.anim.ghostTime, 0.09);
    });
    ev.on('groundImpact', (e) => {
      if (e.fighter.team === 'player') { if (e.power > 0.2) effects.dust(e.x, e.y, 0.2); return; }
      effects.dust(e.x, e.y, e.power);
      e.fighter.anim.impulseSquash(0.25 * e.power, -0.3 * e.power);
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
      this.time.slowmo(PLAYER.parrySlowmoScale, PLAYER.parrySlowmoSec);
      effects.hitSpark(e.x, e.y, 1, 0, 1.2, '#ffe14a', true);
      const r = effects.spawn(2, e.x, e.y, 0, 0, 0.5, 20, '#ffffff'); r.size2 = 240;
      this.cam.punchZoom(0.7);
      this.cam.shake(8, 0, 0, 0.3);
      if (!settings.reduceFlashes) { effects.screenFlash = 0.7; effects.screenFlashColor = '#fff6c0'; }
      audio.parry();
      this.popup(e.projectile ? 'REFLECT!' : 'PERFECT PARRY', 'next hit is CRITICAL', '#ffe14a', false);
    });
    ev.on('dodge', () => { audio.dodge(); });
    // New movesets (sim/moveset2.ts): sound, particles and pop-up words per mechanic.
    ev.on('v2fx', (e) => {
      switch (e.kind) {
        case 'wave': audio.spike(Math.min(1, e.a)); this.cam.shake(7 * e.a * settings.shake, 0, 1, 0.3); effects.dust(e.x, e.y, 0.7); break;
        case 'smoke': audio.dodge(); effects.dust(e.x, e.y + 60, 0.6); break;
        case 'backstab': effects.text('BACKSTAB!', e.x, e.y - 100, '#e22424', 22, 0.7); break;
        case 'crack': effects.text('CRACK!', e.x, e.y - 90, '#ffd23f', 24, 0.6); audio.weapon('deflect'); break;
        case 'fury': effects.text('FURY!', e.x, e.y - 130, '#ff3b1f', 30, 1); audio.ready(); this.cam.shake(6, 0, 1, 0.2); break;
        case 'doom': effects.text('DOOMED', e.x, e.y, '#7a2aa8', 20, 0.8); break;
        case 'reap': effects.text('REAPED!', e.x, e.y - 90, '#7a2aa8', 24, 0.8); effects.embers(e.x, e.y, 16, '#9b5cff'); audio.spike(0.5); break;
        case 'soul': effects.text('+HP', e.x, e.y - 110, '#9b5cff', 16, 0.6); audio.pickup('orb'); break;
        case 'grave': audio.spike(0.6); effects.dust(e.x, e.y, 0.9); break;
        case 'tie': audio.weapon('hookHit'); effects.text('TIED!', e.x, e.y - 60, '#ffd23f', 18, 0.6); break;
        case 'execute': effects.text('EXECUTE!', e.x, e.y - 100, '#e22424', 24, 0.8); effects.embers(e.x, e.y, 18, '#e22424'); audio.hit(0.9, 1, 'slash'); break;
        case 'cut': audio.hit(0.5, 1.2, 'slash'); break;
        case 'shatter': effects.embers(e.x, e.y, 14, '#3fb8ff'); effects.text('SHATTER!', e.x, e.y - 80, '#2a9be0', 20, 0.7); audio.weapon('deflect'); this.cam.shake(6, 0, 0, 0.2); break;
        case 'iceWall': case 'iceBreak': audio.weapon('deflect'); effects.embers(e.x, e.y, 10, '#bfeeff'); break;
        case 'vent': audio.weapon('overheat'); effects.dust(e.x, e.y + 60, 0.8); break;
        case 'puff': effects.embers(e.x, e.y, 10, '#ff4040'); break;
      }
    });
    ev.on('telegraph', () => { audio.telegraph(); });
    // ---- Weapons (revision pass 7) ----
    ev.on('beam', (e) => {
      if (e.heavy) {
        audio.weapon('beam');
        this.cam.shake(Math.min(JUICE.shakeMax, 16), Math.sign(e.x2 - e.x1), 0, 0.5);
        if (e.hit && !settings.reduceFlashes) effects.invert = ANIM.invertSec;
        effects.dust(e.x1, WORLD.groundY, 0.4);
      } else audio.weapon('zap');
    });
    ev.on('overheat', (e) => { audio.weapon('overheat'); effects.text('OVERHEAT', e.x, e.y - 120, '#ff5050', 22, 0.9); });
    ev.on('grab', () => audio.weapon('grab'));
    ev.on('throw', (e) => { audio.weapon('throw'); if (e.heavy) this.cam.shake(6, 0, -1, 0.2); });
    ev.on('hookFire', (e) => { if (w.weapon.ropeStyle === 'arm') { audio.weapon('throw'); if (e.hit) audio.weapon('grab'); return; } audio.weapon('hookFire'); if (e.hit) audio.weapon('hookHit'); });
    ev.on('pullArrive', () => audio.weapon('reel'));
    ev.on('deflect', (e) => { audio.weapon('deflect'); effects.text('DEFLECT', e.x, e.y - 60, '#9fd8ff', 16, 0.6); });
    ev.on('weaponSwap', () => audio.weapon('swap'));
    ev.on('shatter', (e) => { effects.embers(e.x, e.y, 14, '#2436e6'); effects.text('SHATTER!', e.x, e.y - 90, '#2436e6', 20, 0.7); audio.weapon('deflect'); audio.boom(); this.cam.shake(8, 0, 0, 0.3); });
    ev.on('pop', (e) => { effects.embers(e.x, e.y, 10, '#2436e6'); effects.text('POP!', e.x, e.y - 90, '#2436e6', 18, 0.6); audio.weapon('deflect'); });
    ev.on('chainArc', () => audio.weapon('zap'));
    ev.on('jump', (e) => { if (!e.air) effects.dust(e.x, e.y, 0.35); audio.whoosh(e.air ? 0.4 : 0.25); });
    ev.on('splat', (e) => { if (e.kind === 'blob') effects.dust(e.x, e.y, 0.3); if (e.kind === 'fist') audio.hit(0.6, 1, 'heavy'); });
    ev.on('bossBlink', (e) => {
      // Ink poof at both ends of the teleport.
      for (const x of [e.x1, e.x2]) { effects.dust(x, WORLD.groundY, 0.7); effects.embers(x, e.y, 10, '#2436e6'); }
      audio.weapon('zap'); audio.dodge();
    });
    ev.on('nuke', (e) => {
      // Cheat nuke: white-out, crescent, thunder from every side, a big shockwave.
      if (!settings.reduceFlashes) { effects.invert = ANIM.invertSec * 3; crescentFlash(e.x, e.y - 60, 1); }
      for (let i = 0; i < 5; i++) lightning(e.x + (i - 2) * 260, WORLD.groundY - 40, i * 131 + 7);
      effects.shockwave(e.x, WORLD.groundY - 20, 900, '#e22424');
      this.cam.shake(JUICE.shakeMax, 0, 1, 1);
      this.popup('NUKE!', 'cheat', '#e22424', true);
      audio.boom(); audio.weapon('thunder');
    });
    // Each weapon's signature moment gets the slow-mo treatment (TimeControl; locked off in Rhythm Mode).
    ev.on('weaponMoment', (e) => { this.time.slowmo(e.scale, e.sec); this.cam.focus(0.2, 0.5); if (!settings.reduceFlashes) { crescentFlash(e.x, e.y, 1); effects.invert = Math.max(effects.invert, ANIM.invertSec * 1.5); } });
    ev.on('burst', (e) => {
      const r = effects.spawn(2, e.x, e.y, 0, 0, 0.4, 20, '#ff5050'); r.size2 = 200;
      effects.text('BURST!', e.x, e.y - 80, '#ff5050', 28, 0.8);
      this.cam.shake(8, 0, 0, 0.3);
      audio.spike(0.4);
    });
    ev.on('finisher', (e) => {
      // Cinematics (pass 8): the script drives slow-mo / focus through cineFx; this is the name card.
      this.cam.focus(e.kind === 'ko' ? 0.25 : 0.3, 0.6);
      this.popup(e.name + '!', e.kind === 'air' ? 'AIR FINISHER' : e.kind === 'ko' ? 'K.O.' : 'SPECIAL', '#ff4dd2', true);
      effects.embers(e.x, e.y, 26, '#ff4dd2');
      audio.launch();
    });
    ev.on('cineFx', (e) => {
      const flash = !settings.reduceFlashes;
      switch (e.kind) {
        case 'slowmo': this.time.slowmo(e.a, 0.5); break;
        case 'focus': this.cam.focus(e.a, 0.7); break;
        case 'invert': if (flash) { effects.invert = Math.max(effects.invert, ANIM.invertSec * 2); crescentFlash(e.x, e.y, 1); } audio.boom(); break;
        case 'shake': this.cam.shake(10 * e.a * settings.shake, 0, 1, 0.4 * e.a); this.cam.punchZoom(0.05 * e.a); break;
        case 'whoosh': audio.launch(); break;
        case 'bigCrack': this.cam.shake(16 * e.a * settings.shake, 0, 1, 0.5); audio.spike(Math.min(1, e.a / 2)); effects.dust(e.x, e.y, 0.8); break;
        case 'stars': if (e.a >= 0.5) audio.ui('select'); break;
        case 'laserCharge': audio.laser('charge'); break;
        case 'laserFire': audio.laser('fire', e.a); break;
        case 'laserEnd': audio.laser('end'); break;
      }
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
      effects.text(e.kind === 'health' ? '+HP' : '+SPECIAL', e.x, e.y - 30, e.kind === 'health' ? '#5dff8a' : '#5fc8ff', 18, 0.6);
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
    ev.on('text', (e) => effects.text(e.text, e.x, e.y, e.color, e.size));
    ev.on('spawn', (e) => {
      const f: Fighter = e.enemy;
      const bs = f.def?.boss;
      if (bs) { this.popup(bs.title, bs.sub, '#ff4040', true); this.cam.shake(14, 0, 1, 0.5); }
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
