import { Animator } from '../render/animator';
import type { MoveDef } from '../data/moves';
import type { EnemyAttack, EnemyDef, EnemyKind } from '../data/enemies';
import { WORLD } from '../data/tuning';
import { RIGS } from '../render/rig';
import { getAnim } from '../data/anims';

export type FState =
  | 'idle' | 'walk' | 'move' | 'dodge' | 'hitstun' | 'air' | 'knockdown' | 'getup'
  | 'stunned' | 'ko' | 'dead' | 'windup' | 'attack' | 'recover' | 'burst' | 'land'
  | 'jumpFollow' | 'fall' | 'guardbreak' | 'taunt' | 'hurt';

export const MAX_HITLIST = 12;

let nextId = 1;

export class Fighter {
  id = nextId++;
  team: 'player' | 'enemy';
  kind: EnemyKind | 'player';
  def: EnemyDef | null;

  // Physics (feet position).
  x = 0; y: number = WORLD.groundY; px = 0; py: number = WORLD.groundY;
  vx = 0; vy = 0;
  facing = 1;
  scale = 1;
  grounded = true;
  gravityScale = 1;
  stall = 0;
  /** Eased 0..1 blend of air-stall gravity (no on/off switching). */
  stallMix = 0;

  hp = 100; maxHp = 100;
  poise = 0; maxPoise = 0; poiseTimer = 0;
  alive = true;
  /** Remove from world when true. */
  remove = false;

  state: FState = 'idle';
  stateFrame = 0;
  /** Frames left in timed states (hitstun, knockdown, ...). */
  timer = 0;

  hitstop = 0;
  flash = 0;
  invuln = 0;
  /** Victim shake during hitstop (direction of hit). */
  hitDirX = 0; hitDirY = 0;

  // ---- Player move execution ----
  move: MoveDef | null = null;
  /** Increments on every move start (animation restarts its crossfade per instance). */
  moveSerial = 0;
  moveFrame = 0;
  effStartup = 0;
  /** Rhythm Mode: the move's startup before it was snapped to the beat grid (0 = not snapped; always 0 in Classic). */
  snapBase = 0;
  target: Fighter | null = null;
  dashFrames = 0;
  dashFromX = 0; dashFromY = 0; dashToX = 0; dashToY = 0;
  hitList = new Int32Array(MAX_HITLIST);
  hitCount = 0;
  multiHitDone = 0;
  moveHit = false;
  /** Which stroke id started this move (for heavy upgrades). */
  strokeId = -1;
  crossUp = false;

  // ---- Enemy attack execution ----
  attack: EnemyAttack | null = null;
  attackHit = false;
  telegraph = 0;
  hasToken = false;

  // ---- Reaction / juggle state ----
  juggleHits = 0;
  comboHits = 0;
  groundBounces = 0;
  wallBounces = 0;
  spiked = false;
  knockdownOnLand = false;
  impactShock: { radius: number; damage: number } | null = null;
  spinVel = 0;
  spinAngle = 0;
  bowlIds = new Int32Array(8);
  bowlCount = 0;
  lastHitBy = 0;
  koLaunched = false;
  deadTimer = 0;
  guardBroken = 0;
  blockFlash = 0;
  dizzy = 0;
  /** One off-the-ground hit per knockdown; cleared on get-up. */
  otgUsed = false;
  /** Ticks of hit-impact reaction (an intentional animation snap for the pop detector). */
  impact = 0;
  // ---- Presentation cues (written by the sim, read only by the animation layer) ----
  /** Increments on every hit taken (restarts the hit-react animation). */
  hitSerial = 0;
  hitHeavy = false;
  hitBehind = false;
  /** One-shot animation cue (e.g. 'parry', 'bounce') and its serial. */
  cue = '';
  cueSerial = 0;
  /** World point the head looks toward (set each tick). */
  lookX = 0; lookY = 0; hasLook = false;
  /** Frames to show the wall-splat pose after a wall bounce. */
  splat = 0;

  // ---- Player extras ----
  parryWindow = 0;
  critTimer = 0;
  stallCount = 0;
  followTarget: Fighter | null = null;
  dodgeFromX = 0; dodgeToX = 0;
  dodgeHit = 0;

  // ---- AI state ----
  ai = {
    cooldown: 60,
    think: 0,
    holdOff: 0,
    strafe: 1,
    tokenTime: 0,
    pattern: 0,
    meteorTimer: 0,
    summonTimer: 0,
    phase: 1,
    spawnWalk: 0,
    stagger: 0,
  };

  anim: Animator;
  color: string;
  accent: string;
  thickness: number;

  constructor(team: 'player' | 'enemy', def: EnemyDef | null) {
    this.team = team;
    this.def = def;
    this.kind = def ? def.kind : 'player';
    if (def) {
      this.hp = this.maxHp = def.hp;
      this.poise = this.maxPoise = def.poise;
      this.scale = def.scale;
      this.color = def.color;
      this.accent = def.accent;
      this.thickness = def.thickness;
    } else {
      this.color = '#f4f6ff';
      this.accent = '#ff3d5a';
      this.thickness = 6.5;
    }
    this.anim = new Animator(team === 'player' || !!def?.scarf);
    this.anim.rig = RIGS[this.kind] ?? RIGS.grunt;
    this.anim.show(getAnim(this.kind, 'idle'), 0, 0);
    this.anim.snap(1);
    this.anim.sfxEnabled = team === 'player';
  }

  /** Spawn/teleport: snap the animation to the current facing (intentional discontinuity). */
  snapAnim(): void { this.anim.snap(this.facing); this.px = this.x; this.py = this.y; }

  setState(s: FState, timer = 0): void {
    this.state = s;
    this.stateFrame = 0;
    this.timer = timer;
  }

  /** Height of the feet above the ground. */
  get height(): number { return WORLD.groundY - this.y; }
  get airborne(): boolean { return !this.grounded; }
  /** Center of the hurtbox. */
  get cx(): number { return this.x; }
  get cy(): number {
    if (this.state === 'knockdown') return this.y - 18 * this.scale;
    return this.y - 62 * this.scale;
  }
  get hurtR(): number { return (this.state === 'knockdown' ? 34 : 40) * this.scale; }

  /** True if the fighter is in a "being comboed" state. */
  get inHitState(): boolean {
    const s = this.state;
    return s === 'hitstun' || s === 'air' || s === 'knockdown' || s === 'stunned' || s === 'guardbreak';
  }
  get canBeHit(): boolean {
    if (this.state === 'knockdown' && this.otgUsed) return false;
    return this.alive && this.invuln <= 0 && this.state !== 'ko' && this.state !== 'dead' && this.state !== 'getup';
  }
  alreadyHit(id: number): boolean {
    for (let i = 0; i < this.hitCount; i++) if (this.hitList[i] === id) return true;
    return false;
  }
  markHit(id: number): void {
    if (this.hitCount < MAX_HITLIST) this.hitList[this.hitCount++] = id;
  }
  resetCombo(): void {
    this.juggleHits = 0;
    this.comboHits = 0;
    this.groundBounces = 0;
    this.wallBounces = 0;
  }
}
