import { Animator } from '../render/animator';
import type { MoveDef } from '../data/moves';
import type { EnemyAttack, EnemyDef, EnemyKind } from '../data/enemies';
import { WORLD } from '../data/tuning';
import { RIGS } from '../render/rig';
import { getAnim } from '../data/anims';

export type FState =
  | 'idle' | 'walk' | 'move' | 'dodge' | 'hitstun' | 'air' | 'knockdown' | 'getup'
  | 'stunned' | 'ko' | 'dead' | 'windup' | 'attack' | 'recover' | 'burst' | 'land'
  | 'jumpFollow' | 'fall' | 'guardbreak' | 'taunt' | 'hurt'
  /** Weapon reactions: held by a grab, reeled in by a hook. Driven by the weapon sim (no AI, no physics). */
  | 'held' | 'pulled'
  /** Player: the jump's anticipation crouch (a few frames before take-off). */
  | 'jumpSquat'
  /** Scripted cinematic (finishers, specials): position and drawing driven by the cinematic player. */
  | 'cine'
  /** Player, grappling hook (New moveset): on a roof rope / zipping to a wall, or stuck to a wall (sim/grapple.ts). */
  | 'swing' | 'cling';

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
  /** Which stroke id started this move (for heavy promotion). */
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
  /** Thrown body: bowling damage multiplier while it flies (0 = not thrown). */
  thrown = 0;
  /** Weapon statuses (frames left): bleed, frozen in ice, floating in a bubble, snared in ink. */
  bleed = 0; frozen = 0; bubble = 0; snare = 0;
  /** New movesets (sim/moveset2.ts): scythe doom marks + the reaping countdown, grave hands (frames),
   *  the hero's vanish (daggers smoke bomb) and phase (scythe dodge) frames. */
  doom = 0; doomT = 0; grave = 0; vanish = 0; phase = 0;
  bowlCount = 0;
  lastHitBy = 0;
  koLaunched = false;
  deadTimer = 0;
  guardBroken = 0;
  /** Training targets: which drawn sprite this dummy wears ('' = the stick figure) and its swing / lean (render only). */
  /** Laser Eyes: frames left burning (a small damage over time, drawn as flames). */
  burn = 0;
  sprite: '' | 'dummy' | 'bag' = '';
  spriteAng = 0; spriteVel = 0;
  /** Shield enemies: hits blocked since the guard last broke. */
  blocks = 0;
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
  /** The last hit came from above (meteors, slams, airborne attackers). */
  hitAbove = false;
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
  /** Length of the current dodge (frames; weapons can change it). */
  dodgeLen = 0;
  /** Equipped weapon id (drives the held-object drawing). */
  weapon = 'fists';
  /** The weapon has been thrown and is out of the hero's hands (staff toss). */
  weaponOut = false;
  // ---- Jump / air presentation (revision pass 8) ----
  /** What put the hero in the air: a jump, an air jump, a launcher leap, a vault, a dodge hop. */
  jumpKind: 'none' | 'jump' | 'air' | 'leap' | 'hop' = 'none';
  /** Frames of low air drag after letting go of a grapple (the swing's momentum carries). */
  fling = 0;
  /** Grapple drawing (0 hang, 1 swing, 2 zip, 3 cling) and the body turn toward the rope (world radians). */
  grapPose = 0; grapSpin = 0;
  /** Frames since leaving the ground (or since the last air jump). */
  airFrames = 0;
  /** Variable-height boost frames left (drag / held key). */
  jumpBoost = 0;
  /** Falling speed at the last landing (hard landing when fast). */
  landVy = 0;
  /** Presentation: low stance (pad dragged down / S key) and air drift input (-1..1, facing-relative). */
  crouch = false;
  drift = 0;
  /** Frames since the last player input (bored idle). */
  idleFrames = 0;
  /** Scripted cinematic drawing (state 'cine'): animation id and time. */
  cineAnim = '';
  cineT = 0;
  /** Extra whole-body turn during a cinematic (pile-driver spin). */
  cineSpin = 0;
  /** Spawn-in fade (enemies): frames left of the dithered fade from gray to solid. */
  spawnFade = -1;
  /** Death variant (0 flat collapse, 1 launched off-screen, 2 scribbled out) and its timer. */
  deathStyle = 0;

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
    /** Boss blink cooldown (frames). */
    blinkCd: 0,
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
    return s === 'hitstun' || s === 'air' || s === 'knockdown' || s === 'stunned' || s === 'guardbreak' || s === 'held' || s === 'pulled';
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
