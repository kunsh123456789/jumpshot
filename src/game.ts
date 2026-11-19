import { layout } from './core/layout';
import { Camera } from './core/camera';
import { TimeControl } from './core/time';
import { save, settings, writeSave } from './core/settings';
import { audio } from './core/audio';
import { World } from './sim/world';
import { Renderer } from './render/renderer';
import { effects } from './render/effects';
import { FxDirector } from './render/fx';
import { Hud } from './render/hud';
import { drawEntities } from './render/entityDraw';
import { ARENA_ORDER } from './render/background';
import { DrawPad, type SwipeEvent } from './ui/pad';
import { Keyboard } from './core/keyboard';
import { DebugOverlay } from './ui/debug';
import { Menus } from './ui/menus';
import { Tutorial } from './ui/tutorial';
import { CAMERA, WAVES_T, WORLD, SCORE } from './data/tuning';
import { UPGRADES, type UpgradeDef } from './data/upgrades';
import { fxRng } from './core/rng';
import { clamp } from './core/math';

type GState = 'title' | 'tutorial' | 'countdown' | 'playing' | 'clear' | 'upgrade' | 'gameover';

/** Top-level game: owns world, renderer, input, UI and the state machine. */
export class Game {
  readonly time = new TimeControl();
  readonly cam = new Camera();
  readonly pad = new DrawPad();
  readonly debug = new DebugOverlay();
  readonly keyboard: Keyboard;
  readonly renderer: Renderer;
  readonly menus = new Menus();
  readonly hud = new Hud();
  readonly world = new World();
  readonly fx: FxDirector;
  readonly tutorial: Tutorial;
  state: GState = 'title';
  paused = false;
  private inputs: SwipeEvent[] = [];
  private renderTime = 0;
  private stateTime = 0;
  private stacks: Record<string, number> = {};
  private nextWave = 1;
  private overTimer = 0;
  private breather = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.renderer.drawExtras = (ctx, alpha, time) => drawEntities(ctx, this.world, alpha, time);
    this.pad.attach(canvas);
    this.keyboard = new Keyboard(this.pad);
    this.keyboard.onToggleDebug = () => { this.debug.visible = !this.debug.visible; settings.debug = this.debug.visible; };
    this.keyboard.onPause = () => this.togglePause();
    this.menus.onPause = () => this.togglePause();
    window.addEventListener('jumpshot-debug', () => { this.debug.visible = settings.debug; });
    this.debug.visible = settings.debug;
    this.fx = new FxDirector(this.cam, this.time, this.pad);
    this.fx.bind(this.world);
    this.tutorial = new Tutorial(this.pad, this.menus, () => this.endTutorial());
    this.renderer.resize();
    this.renderer.bg.preload();
    window.addEventListener('resize', () => { this.renderer.resize(); this.publishPadTop(); });
    window.addEventListener('blur', () => { if ((this.state === 'playing' || this.state === 'tutorial') && !this.paused) this.togglePause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && (this.state === 'playing' || this.state === 'tutorial') && !this.paused) this.togglePause(); });
    this.world.events.on('waveClear', () => this.onWaveClear());
    this.publishPadTop();
    this.toTitle();
  }

  private publishPadTop(): void { (window as unknown as { __padTop: number }).__padTop = layout.pad.y; }

  // ------------------------------------------------------------ states
  private setState(s: GState): void { this.state = s; this.stateTime = 0; }

  toTitle(): void {
    this.menus.closeAll();
    this.world.reset();
    this.renderer.bg.set('dojo');
    this.setState('title');
    this.pad.demo = true;
    this.pad.hint = -1;
    this.menus.pauseBtn.style.display = 'none';
    this.hud.visible = false;
    this.menus.showTitle(save.highScore, () => this.menus.showSettings(() => {}, () => this.startTutorial()));
    this.cam.targetX = this.world.player.x;
    this.cam.snap();
    audio.stopMusic();
  }

  private startFromTitle(): void {
    audio.unlock();
    this.pad.demo = false;
    this.menus.close('title');
    this.menus.close('settings');
    if (!save.tutorialDone) this.startTutorial();
    else this.startRun();
  }

  startTutorial(): void {
    this.menus.closeAll();
    this.world.reset();
    this.effectsReset();
    this.renderer.bg.set('dojo');
    this.pad.demo = false;
    this.hud.visible = true;
    this.hud.waveLabel = 'TRAINING';
    this.setState('tutorial');
    this.menus.pauseBtn.style.display = '';
    this.tutorial.start(this.world);
    this.world.combo.superMeter = 100;
  }

  private endTutorial(): void {
    save.tutorialDone = true;
    writeSave();
    this.startRun();
    this.menus.banner('READY?', 'the real fight starts now', 1400);
  }

  startRun(): void {
    this.menus.closeAll();
    this.world.reset();
    this.stacks = {};
    this.nextWave = 1;
    this.hud.visible = true;
    this.menus.pauseBtn.style.display = '';
    this.effectsReset();
    audio.startMusic();
    this.beginCountdown();
  }

  private effectsReset(): void {
    effects.clear();
    this.time.reset();
    this.fx.popups.length = 0;
    this.fx.lastComboEnd = null;
  }

  /** Show the WAVE banner; the wave spawns 1.2 s later. */
  private beginCountdown(): void {
    const wave = this.nextWave;
    const arena = ARENA_ORDER[Math.floor((wave - 1) / WAVES_T.arenaRotateEvery) % ARENA_ORDER.length];
    if (arena !== this.renderer.bg.current) this.renderer.bg.set(arena);
    this.setState('countdown');
    const boss = wave % 10 === 0, elite = !boss && wave % 5 === 0;
    this.menus.banner(`WAVE ${wave}`, boss ? '⚠ BOSS INCOMING ⚠' : elite ? 'ELITE INCOMING' : '', 1400);
    this.hud.waveLabel = `WAVE ${wave}`;
    audio.ui('wave');
  }

  private onWaveClear(): void {
    if (this.state !== 'playing') return;
    this.world.combo.end(false);
    this.world.combo.score += SCORE.waveClear * this.nextWave;
    const p = this.world.player;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * WAVES_T.healFraction);
    save.bestWave = Math.max(save.bestWave, this.nextWave);
    this.menus.banner('WAVE CLEAR', `+${(SCORE.waveClear * this.nextWave).toLocaleString()}  ·  +${Math.round(WAVES_T.healFraction * 100)}% HP`, 1500);
    audio.ui('clear');
    this.setState('clear');
  }

  private showUpgradePicker(): void {
    this.setState('upgrade');
    const choices = this.rollUpgrades(3);
    this.menus.showUpgrades(choices, this.stacks, (u) => this.pickUpgrade(u), `WAVE ${this.nextWave} CLEARED`);
  }

  private rollUpgrades(n: number): UpgradeDef[] {
    const avail = UPGRADES.filter((u) => (this.stacks[u.id] ?? 0) < u.maxStacks);
    const out: UpgradeDef[] = [];
    while (out.length < n && avail.length > 0) {
      let total = 0;
      for (const u of avail) total += u.weight;
      let r = fxRng.next() * total;
      let idx = 0;
      for (; idx < avail.length - 1; idx++) { r -= avail[idx].weight; if (r <= 0) break; }
      out.push(avail[idx]);
      avail.splice(idx, 1);
    }
    return out;
  }

  private pickUpgrade(u: UpgradeDef): void {
    this.stacks[u.id] = (this.stacks[u.id] ?? 0) + 1;
    u.apply(this.world.stats);
    this.world.applyStats();
    const p = this.world.player;
    if (u.onPick === 'fullHeal') p.hp = p.maxHp;
    this.nextWave++;
    // Breather before the next wave (the WAVE banner covers the last 1.2 s).
    this.setState('upgrade');
    this.breather = WAVES_T.breatherSec - 1.2;
    this.menus.banner(u.icon + ' ' + u.name.toUpperCase(), 'next wave in 3…', 1300);
  }

  private toGameOver(): void {
    this.setState('gameover');
    this.overTimer = 0;
    audio.ui('gameover');
    audio.stopMusic();
    this.time.slowmo(0.3, 1.0);
  }

  private showResults(): void {
    const c = this.world.combo;
    c.end(true);
    const score = c.score;
    const newHigh = score > save.highScore;
    if (newHigh) save.highScore = score;
    save.bestCombo = Math.max(save.bestCombo, c.bestHits);
    save.bestWave = Math.max(save.bestWave, this.nextWave);
    writeSave();
    this.menus.pauseBtn.style.display = 'none';
    this.menus.showResults({
      score, high: save.highScore, newHigh, wave: this.nextWave, bestHits: c.bestHits, bestDamage: c.bestDamage,
      bestRank: c.bestRank, kos: c.totalKOs, parries: c.parries, finishers: c.finishers, maxRank: c.maxRankRun,
    }, () => this.startRun(), () => this.toTitle());
  }

  togglePause(): void {
    if (this.state === 'title' || this.state === 'gameover') return;
    if (this.menus.isOpen('upgrades')) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.menus.showPause(
        () => this.togglePause(),
        () => this.menus.showSettings(() => {}, null),
        () => { this.paused = false; this.tutorial.active = false; this.startRun(); },
        () => { this.paused = false; this.tutorial.active = false; this.toTitle(); },
      );
      audio.stopMusic();
    } else {
      this.menus.close('pause');
      this.menus.close('settings');
      if (this.state !== 'tutorial') audio.startMusic();
    }
  }

  // ------------------------------------------------------------ loop
  /** One fixed simulation step (1/60 s). */
  step(): void {
    this.inputs.length = 0;
    const ev = this.pad.events;
    if (this.state === 'title') {
      for (const e of ev) {
        if (e.kind === 'swipe' || e.kind === 'tap') { ev.length = 0; this.startFromTitle(); return; }
      }
    }
    const acceptInput = this.state === 'playing' || this.state === 'tutorial' || this.state === 'countdown' || this.state === 'clear';
    if (acceptInput) for (let i = 0; i < ev.length; i++) this.inputs.push(ev[i]);
    ev.length = 0;
    this.world.camLeft = this.cam.viewLeft();
    this.world.camRight = this.cam.viewRight();
    this.world.step(this.inputs);
    if ((this.state === 'playing' || this.state === 'countdown' || this.state === 'clear') && this.world.gameOver) this.toGameOver();
  }

  render(alpha: number, realDt: number): void {
    const dt = realDt * this.time.scale;
    this.renderTime += dt;
    this.stateTime += realDt;
    this.debug.tick(realDt);
    this.updateState(realDt);
    effects.update(dt);
    this.fx.update(realDt);
    this.updateCamera(alpha);
    this.cam.update(realDt);
    audio.updateMusic();
    this.renderer.render(this.world, this.cam, alpha, this.renderTime, dt);
    const ctx = this.renderer.ctx;
    this.renderer.cssTransform();
    this.hud.draw(ctx, this.world, this.fx, realDt, this.renderTime);
    if (this.state !== 'gameover') this.pad.draw(ctx, performance.now(), realDt);
    if (this.debug.visible) {
      const p = this.world.player;
      const c = this.world.ctrl;
      const cb = this.world.combo;
      this.debug.draw(ctx, this.pad, [
        `buffer [${c.bufDesc}]  latency ${c.latency}f`,
        `state ${p.state} f${p.stateFrame} move ${p.move?.id ?? '-'}:${p.moveFrame}/${p.effStartup}`,
        `pos ${p.x.toFixed(0)},${p.y.toFixed(0)} v ${p.vx.toFixed(0)},${p.vy.toFixed(0)} stall ${p.stall}`,
        `combo ${cb.hits} air ${cb.airJuggle} style ${cb.style.toFixed(0)} super ${cb.superMeter.toFixed(0)}`,
        `enemies ${this.world.enemies.length} tokens ${this.world.ai.tokens} particles ${effects.parts.count}`,
        `timescale ${this.time.scale.toFixed(2)} zoom ${this.cam.effectiveZoom().toFixed(2)} ${layout.portrait ? 'portrait' : 'landscape'}`,
      ], 8, layout.portrait ? layout.world.y + 40 : layout.world.y + 120);
    }
  }

  private updateState(dt: number): void {
    switch (this.state) {
      case 'countdown':
        if (this.stateTime >= 1.2) {
          this.world.wave = this.nextWave;
          this.world.waves.start(this.world, this.nextWave);
          this.setState('playing');
        }
        break;
      case 'clear':
        if (this.stateTime > 1.6) this.showUpgradePicker();
        break;
      case 'upgrade':
        if (this.breather > 0) {
          this.breather -= dt;
          if (this.breather <= 0) { this.breather = 0; this.beginCountdown(); }
        }
        break;
      case 'tutorial':
        this.tutorial.update(this.world, dt);
        break;
      case 'gameover':
        this.overTimer += dt;
        if (this.overTimer > 1.6 && !this.menus.isOpen('results')) this.showResults();
        break;
    }
  }

  private updateCamera(alpha: number): void {
    const w = this.world;
    const p = w.player;
    const px = p.px + (p.x - p.px) * alpha;
    const py = p.py + (p.y - p.py) * alpha;
    // Weighted centroid of the action: player weighted heavily, nearby enemies lightly.
    let sx = px * 3, sw = 3, minX = px, maxX = px, minY = py;
    for (const e of w.enemies) {
      if (!e.alive && e.state !== 'ko') continue;
      const d = Math.abs(e.x - px);
      if (d > 750) continue;
      const wt = e.inHitState ? 1.2 : 0.5;
      sx += e.x * wt; sw += wt;
      if (e.x < minX) minX = e.x;
      if (e.x > maxX) maxX = e.x;
      if (e.y < minY && d < 400 && e.state !== 'ko') minY = e.y;
    }
    this.cam.targetX = sx / sw + p.facing * CAMERA.lookAheadX;
    const spread = maxX - minX;
    let z = CAMERA.baseZoom - clamp((spread - CAMERA.crowdSpreadStart) / (CAMERA.crowdSpreadFull - CAMERA.crowdSpreadStart), 0, 1) * (CAMERA.baseZoom - CAMERA.minZoom);
    // Aerial: zoom out around the ground line (so the floor never slides under the pad).
    const height = WORLD.groundY - Math.min(py, minY);
    if (height > CAMERA.aerialHeightStart) {
      const zAir = clamp(WORLD.groundScreenY / (height + CAMERA.aerialHeadroom), CAMERA.minAerialZoom, 1);
      z = Math.min(z, zAir);
    }
    this.cam.targetZoom = z;
    const over = Math.max(0, height + CAMERA.aerialHeadroom - WORLD.groundScreenY / CAMERA.minAerialZoom);
    this.cam.targetY = WORLD.groundY - over * CAMERA.aerialFollowY;
    // Cinematic focus (finishers): pull the camera onto the player.
    if (this.cam.focusZoom > 0.01) {
      const k = clamp(this.cam.focusZoom / 0.25, 0, 1);
      const ez = this.cam.effectiveZoom();
      this.cam.targetX += (px - this.cam.targetX) * k;
      this.cam.targetY += (py - 60 + (WORLD.groundScreenY - 330) / ez - this.cam.targetY) * k;
    }
    if (this.state === 'title') { this.cam.targetZoom = 1.25; this.cam.targetY = WORLD.groundY - 40; }
  }
}
