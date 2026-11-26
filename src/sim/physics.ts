import type { World } from './world';
import { V2 } from '../data/weapons/tuning';
import type { Fighter } from './fighter';
import { ANIM, DEATH, PHYS, WORLD } from '../data/tuning';
import { WEAPON_T } from '../data/weapons/tuning';
import { isBoss } from '../data/enemies';

/**
 * Gravity multiplier with eased air-stall (blends in over stallEaseIn frames and
 * out over stallEaseOut) and an apex hang that softens the top of every arc.
 * Also decrements the stall counter.
 */
export function airGravity(f: Fighter): number {
  if (f.stall > 0) { f.stall--; f.stallMix = Math.min(1, f.stallMix + 1 / ANIM.stallEaseIn); }
  else f.stallMix = Math.max(0, f.stallMix - 1 / ANIM.stallEaseOut);
  const m = f.stallMix * f.stallMix * (3 - 2 * f.stallMix);
  let g = 1 + (PHYS.stallGravity - 1) * m;
  if (m > 0 && f.vy > 60) f.vy *= 1 - 0.2 * m;
  const av = Math.abs(f.vy);
  if (av < ANIM.apexBand) g *= ANIM.apexGravity + (1 - ANIM.apexGravity) * (av / ANIM.apexBand);
  return g;
}
import { shockwave, sideHit } from './combat';

const WALL_L = WORLD.wallMargin;
const WALL_R = WORLD.arenaW - WORLD.wallMargin;

/** Enemy physics: gravity, juggle stall, ground/wall bounces, landings, reaction timers. */
export function enemyPhysics(w: World, e: Fighter): void {
  // Launched-off-the-page KO: gone (with a star) once it leaves the page.
  if (e.state === 'ko' && e.deathStyle === 1 && (WORLD.groundY - e.y > DEATH.exitHeight || e.x < -40 || e.x > WORLD.arenaW + 40)) {
    w.events.emit('koStar', { x: Math.max(40, Math.min(WORLD.arenaW - 40, e.x)), y: Math.max(WORLD.groundY - DEATH.exitHeight, e.y) });
    e.remove = true; e.y = WORLD.groundY; w.dropLoot(e);
    return;
  }
  if (e.splat > 0) e.splat--;
  const airState = e.state === 'air' || e.state === 'ko';
  if (airState || !e.grounded) {
    const g = PHYS.gravity * e.gravityScale * airGravity(e);
    e.vy = Math.min(PHYS.maxFall * 1.4, e.vy + g / 60);
    e.vx *= PHYS.airDrag;
    e.x += e.vx / 60;
    e.y += e.vy / 60;
    // No wrapping here: a 2*pi jump in the target would make the pose spring
    // chase it backwards. The animator unwinds spin on clip changes instead.
    e.spinAngle += e.spinVel * (0.4 + 0.6 * (1 - e.stallMix));

    // Walls.
    if (e.x < WALL_L || e.x > WALL_R) {
      const dir = e.x < WALL_L ? 1 : -1;
      e.x = e.x < WALL_L ? WALL_L : WALL_R;
      const speed = Math.abs(e.vx);
      if (speed > PHYS.wallBounceMinVx && e.state === 'air' && w.combo.hits > 0 && w.combo.canWallBounce()) {
        w.combo.wallBouncesUsed++;
        e.vx = dir * speed * PHYS.wallBounceVxFactor;
        e.vy = Math.min(e.vy, PHYS.wallBounceVy);
        e.stall = 8;
        e.spinVel = -e.spinVel;
        e.hitstop = 5;
        e.flash = 3;
        e.splat = 12;
        e.facing = dir;
        w.combo.registerHit('wall', 4, { air: true, multi: false, bounce: true, finisher: false, launcher: false, bowl: false, ko: false });
        e.hp -= 4;
        w.events.emit('wallImpact', { x: e.x - dir * 10, y: e.cy, power: Math.min(1.5, speed / 900), dir });
      } else {
        e.vx = dir * speed * 0.25;
        if (speed > 400) w.events.emit('wallImpact', { x: e.x - dir * 10, y: e.cy, power: 0.3, dir });
      }
    }

    // Landing.
    if (e.y >= WORLD.groundY && e.vy >= 0) {
      e.y = WORLD.groundY;
      const vy = e.vy;
      e.thrown = 0;
      if (e.impactShock) {
        const sh = e.impactShock;
        e.impactShock = null;
        shockwave(w, e.x, e.y, sh.radius, sh.damage, e, '#ff4dd2');
      }
      if (e.state === 'ko') {
        if (vy > 500) {
          e.vy = -vy * 0.35; e.vx *= 0.6;
          w.events.emit('groundImpact', { x: e.x, y: e.y, power: 0.6, fighter: e, bounce: true });
          return;
        }
        e.grounded = true;
        e.vy = 0; e.vx = 0;
        e.setState('dead');
        e.deadTimer = 0;
        w.events.emit('groundImpact', { x: e.x, y: e.y, power: 0.5, fighter: e, bounce: false });
        return;
      }
      if (e.spiked && vy > PHYS.groundBounceMinVy && w.combo.hits > 0 && w.combo.canGroundBounce() && e.alive) {
        w.combo.groundBouncesUsed++;
        e.cue = 'bounce'; e.cueSerial++;
        e.spiked = false;
        e.vy = PHYS.groundBounceVy * Math.min(1.15, vy / 1600 + 0.4);
        e.vx *= 0.5;
        e.stall = 6;
        e.juggleHits = Math.max(0, e.juggleHits - 3);
        e.gravityScale = Math.max(1, e.gravityScale - 0.15);
        e.hitstop = 4;
        w.combo.registerHit('bounce', 0, { air: true, multi: false, bounce: true, finisher: false, launcher: false, bowl: false, ko: false });
        w.events.emit('groundImpact', { x: e.x, y: e.y, power: Math.min(1.6, vy / 1300), fighter: e, bounce: true });
        return;
      }
      e.spiked = false;
      e.grounded = true;
      e.vy = 0;
      e.stall = 0;
      e.spinAngle = 0;
      const hard = vy > 650 || e.knockdownOnLand || e.state === 'air';
      e.knockdownOnLand = false;
      if (hard) {
        e.vx *= 0.35;
        e.setState('knockdown', isBoss(e) ? 50 : 42);
        w.events.emit('groundImpact', { x: e.x, y: e.y, power: Math.min(1.4, vy / 1400 + 0.2), fighter: e, bounce: false });
      } else {
        e.setState('idle');
      }
      return;
    }
    e.grounded = false;
  } else {
    // Grounded.
    e.y = WORLD.groundY;
    if (e.state === 'hitstun' || e.state === 'burst' || e.state === 'stunned' || e.state === 'guardbreak' || e.state === 'knockdown' || e.state === 'dead') {
      e.x += e.vx / 60;
      e.vx *= w.v2.onIce(e.x) ? V2.iceFriction : PHYS.groundFriction;
      if (Math.abs(e.vx) < 4) e.vx = 0;
    }
    if (e.x < WALL_L) { e.x = WALL_L; if (e.vx < -300 && e.state === 'hitstun' && w.combo.canWallBounce()) wallPop(w, e, 1); else e.vx = 0; }
    if (e.x > WALL_R) { e.x = WALL_R; if (e.vx > 300 && e.state === 'hitstun' && w.combo.canWallBounce()) wallPop(w, e, -1); else e.vx = 0; }
  }

  // Timed reaction states.
  switch (e.state) {
    case 'hitstun':
      if (--e.timer <= 0) e.setState('idle');
      break;
    case 'knockdown':
      if (--e.timer <= 0) { e.setState('getup', isBoss(e) ? 26 : 20); }
      break;
    case 'getup':
      if (--e.timer <= 0) { e.setState('idle'); e.juggleHits = 0; e.gravityScale = 1; e.comboHits = Math.min(e.comboHits, 4); e.invuln = 4; e.otgUsed = false; }
      break;
    case 'stunned': case 'burst': case 'guardbreak':
      if (--e.timer <= 0) e.setState('idle');
      break;
    case 'dead':
      e.deadTimer++;
      if (e.deadTimer === 18) w.events.emit('dissolve', { x: e.x, y: e.y - 20, victim: e });
      if (e.deadTimer >= (e.deathStyle === 2 ? DEATH.scribbleFrames + 6 : 36)) { e.remove = true; w.dropLoot(e); }
      break;
  }
  if (e.state === 'idle' && e.juggleHits > 0) { e.juggleHits = 0; e.gravityScale = 1; }
}

function wallPop(w: World, e: Fighter, dir: number): void {
  w.combo.wallBouncesUsed++;
  e.vx = dir * 420;
  e.vy = PHYS.wallBounceVy;
  e.grounded = false;
  e.setState('air');
  e.stall = 8;
  e.hitstop = 5;
  w.combo.registerHit('wall', 4, { air: true, multi: false, bounce: true, finisher: false, launcher: false, bowl: false, ko: false });
  w.events.emit('wallImpact', { x: e.x - dir * 10, y: e.cy, power: 0.8, dir });
}

/** Flying enemies bowl into others: damages both and keeps the combo alive. */
export function bowling(w: World): void {
  const es = w.enemies;
  for (let i = 0; i < es.length; i++) {
    const a = es[i];
    if (!(a.state === 'air' || a.state === 'ko' || a.state === 'hitstun' || a.state === 'pulled')) { a.bowlCount = 0; continue; }
    if (a.hitstop > 0) continue;
    const sp2 = a.vx * a.vx + a.vy * a.vy;
    if (sp2 < PHYS.bowlMinSpeed * PHYS.bowlMinSpeed) continue;
    for (let j = 0; j < es.length; j++) {
      if (i === j) continue;
      const b = es[j];
      if (!b.canBeHit || b.state === 'knockdown') continue;
      let seen = false;
      for (let k = 0; k < a.bowlCount; k++) if (a.bowlIds[k] === b.id) { seen = true; break; }
      if (seen) continue;
      const dx = b.cx - a.cx, dy = b.cy - a.cy;
      const r = (a.hurtR + b.hurtR) * 0.85;
      if (dx * dx + dy * dy > r * r) continue;
      if (a.bowlCount < a.bowlIds.length) a.bowlIds[a.bowlCount++] = b.id;
      const dir = Math.sign(a.vx) || Math.sign(dx) || 1;
      // A thrown body (Throw weapon) hits harder, falling off per collision.
      const mult = a.thrown > 0 ? a.thrown * Math.pow(WEAPON_T.thrownFalloff, a.bowlCount - 1) : 1;
      sideHit(w, b, PHYS.bowlDamage * mult, dir, -500, 'bowl', PHYS.bowlKnockback * (a.thrown > 0 ? 1.2 : 1));
      if (b.bowlCount < b.bowlIds.length) b.bowlIds[b.bowlCount++] = a.id;
      if (a.alive) { a.hp -= PHYS.bowlDamage * 0.5; a.flash = 2; }
      a.vx *= 0.65;
    }
  }
}

/** Keep grounded, non-reacting fighters from stacking on top of each other. */
export function separate(w: World): void {
  const es = w.enemies;
  for (let i = 0; i < es.length; i++) {
    const a = es[i];
    if (!a.grounded || !a.alive || a.inHitState) continue;
    for (let j = i + 1; j < es.length; j++) {
      const b = es[j];
      if (!b.grounded || !b.alive || b.inHitState) continue;
      const dx = b.x - a.x;
      const min = 34 * (a.scale + b.scale);
      if (Math.abs(dx) < min) {
        const push = (min - Math.abs(dx)) * PHYS.separationPush * 0.5 * (Math.sign(dx) || 1);
        a.x -= push; b.x += push;
      }
    }
    // Don't overlap the player while standing.
    const p = w.player;
    if (p.grounded && a.state !== 'attack') {
      const dx = a.x - p.x;
      const min = 40 * a.scale;
      if (Math.abs(dx) < min) a.x += (min - Math.abs(dx)) * 0.3 * (Math.sign(dx) || 1);
    }
  }
}
