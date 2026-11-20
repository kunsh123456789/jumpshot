import { layout } from './core/layout';
import { Camera } from './core/camera';
import { TimeControl } from './core/time';
import { save, saveSettings, settings, writeSave } from './core/settings';
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
import { PopDetector } from './ui/popDetector';
import { AnimLab } from './ui/lab';
import { CAMERA, WAVES_T, WORLD, SCORE } from './data/tuning';
import { UPGRADES, type UpgradeDef } from './data/upgrades';
import { fxRng } from './core/rng';
import { clamp } from './core/math';
import { music } from './music/music';
import { BeatHud } from './render/beatHud';
import type { CalibView } from './ui/menus';
import { G_NONE, TRACKS } from './data/rhythm';

const CALIB_NEED = 12;

type GState = 'title' | 'select' | 'tutorial' | 'countdown' | 'playing' | 'clear' | 'upgrade' | 'gameover';

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
  readonly pops = new PopDetector();
  readonly lab = new AnimLab();
  readonly beatHud = new BeatHud();
  /** Perf-time (ms) the current sim step advances to; set by the main loop. */
  simNow = 0;
  private calib: { view: CalibView; deltas: number[]; done: boolean; prevDemo: boolean; onDone: () => void } | null = null;
  state: GState = 'title';
  paused = false;
  /** Debug time controls: [ toggles 0.1x, ] freezes and steps one frame, \ resumes. */
  debugScale = 1;
  debugFrozen = false;
  stepRequests = 0;
  private labelTime = 0;
  private lastAlpha = 0;
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
    this.keyboard.onDebugSlow = () => { this.debugScale = this.debugScale < 1 ? 1 : 0.1; this.debugFrozen = false; };
    this.keyboard.onDebugStep = () => { this.debugFrozen = true; this.stepRequests++; };
    this.keyboard.onDebugResume = () => { this.debugFrozen = false; this.debugScale = 1; };
    this.menus.onPause = () => this.togglePause();
    window.addEventListener('jumpshot-debug', () => { this.debug.visible = settings.debug; });
    // Animation Lab: #lab route or F2.
    window.addEventListener('keydown', (e) => {
      if (this.lab.onKey(e)) return;
      if (e.code === 'F2') { e.preventDefault(); if (this.lab.active) this.lab.exit(); else this.openLab(); }
    }, { capture: true });
    window.addEventListener('hashchange', () => { if (location.hash === '#lab') this.openLab(); else if (this.lab.active) this.lab.exit(); });
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
    const mc = settings.musicChoice;
    if (mc === 'classic') music.selectClassic();
    else { const t = TRACKS.find((x) => 'builtin:' + x.id === mc); if (t) music.selectBuiltin(t); }
    this.toTitle();
  }

  openLab(): void {
    if (this.state === 'playing' && !this.paused) this.togglePause();
    this.menus.closeAll();
    this.lab.onExit = () => { this.menus.closeAll(); this.paused = false; this.toTitle(); };
    this.lab.enter();
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
    this.menus.showTitle(save.highScore, () => this.openSettings(null));
    this.cam.targetX = this.world.player.x;
    this.cam.snap();
    music.shutdown();
    this.time.locked = false;
    this.beatHud.visible = false;
  }

  private startFromTitle(): void {
    audio.unlock();
    this.pad.demo = false;
    this.menus.close('title');
    this.menus.close('settings');
    if (!save.tutorialDone) this.startTutorial();
    else this.chooseMusic(() => this.startRun(), () => this.toTitle());
  }

  /** Settings panel (title or pause) with the calibration entry point. */
  private openSettings(after: (() => void) | null): void {
    this.menus.showSettings(() => after?.(), after ? null : () => this.startTutorial(), () => this.startCalibration(() => this.openSettings(after)));
  }

  private musicKey(): string {
    return music.mode === 'builtin' ? 'builtin:' + music.track.id : music.mode;
  }

  /** Music select; `then` runs once something playable was chosen. */
  /** Dev: preselect music and skip the picker. */
  forceMusic(id: string): void {
    if (id === 'classic') music.selectClassic();
    else { const t = TRACKS.find((x) => x.id === id); if (t) music.selectBuiltin(t); }
    this.skipPicker = true;
  }
  private skipPicker = false;

  chooseMusic(then: () => void, back: (() => void) | null): void {
    if (this.skipPicker) { then(); return; }
    if (this.state === 'title') this.setState('select');
    this.pad.demo = false;
    const close = () => this.menus.close('music');
    this.menus.showMusic({
      current: this.musicKey(),
      songName: music.song?.name ?? null,
      offsetMs: settings.rhythmOffset,
      onTrack: (t) => { music.selectBuiltin(t); settings.musicChoice = 'builtin:' + t.id; saveSettings(); close(); then(); },
      onClassic: () => { music.selectClassic(); settings.musicChoice = 'classic'; saveSettings(); close(); then(); },
      onLastSong: music.song ? () => { music.selectSong(music.song!); close(); then(); } : null,
      onFile: (f, st) => {
        st.busy(true);
        st.set('Loading…');
        music.loadFile(f, (fr, label) => { st.progress(fr); st.set(`Finding the beat… ${label} ${Math.round(fr * 100)}%`); })
          .then((song) => {
            st.progress(1);
            st.set(`✓ ${song.name} — ${Math.round(song.map.bpm)} BPM${song.map.grid ? '' : ' (live tempo)'}`);
            music.selectSong(song);
            window.setTimeout(() => { if (this.menus.isOpen('music')) { close(); then(); } }, 700);
          })
          .catch((e: unknown) => { st.progress(-1); st.set(e instanceof Error ? e.message : String(e), true); })
          .finally(() => st.busy(false));
      },
      onMic: (st) => {
        st.busy(true);
        st.set('Asking for the microphone…');
        music.selectMic().then((ok) => {
          st.busy(false);
          if (!ok) { st.set(music.live.error || 'Microphone unavailable', true); return; }
          settings.musicChoice = 'mic'; saveSettings();
          close(); then();
        });
      },
      onCalibrate: () => { close(); this.startCalibration(() => this.chooseMusic(then, back)); },
      onBack: back ? () => { close(); back(); } : null,
    });
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
    this.tutorial.active = false;
    this.chooseMusic(() => { this.startRun(); this.menus.banner('READY?', 'the real fight starts now', 1400); }, null);
  }

  /** Dev helper: jump straight into a run at a given wave. */
  devStart(wave: number): void {
    this.startRun();
    this.nextWave = wave;
    this.beginCountdown();
  }

  startRun(): void {
    this.menus.closeAll();
    this.world.reset();
    this.stacks = {};
    this.nextWave = 1;
    this.pad.demo = false;
    this.pad.hint = -1;
    this.pad.hintLabel = '';
    this.hud.visible = true;
    this.menus.pauseBtn.style.display = '';
    this.effectsReset();
    music.start();
    this.time.locked = music.rhythmMode;
    this.beatHud.visible = music.rhythmMode;
    this.beatHud.reset();
    this.pops.reset();
    if (!save.padHintSeen) { this.pad.labelAlpha = 1; this.labelTime = 7; }
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
    const tune = wave === 1 && music.rhythmMode ? (music.mode === 'mic' ? '♪ play music out loud · hit on the beat' : `♪ ${music.label()} · hit on the beat`) : '';
    this.menus.banner(`WAVE ${wave}`, boss ? '⚠ BOSS INCOMING ⚠' : elite ? 'ELITE INCOMING' : tune, 1400);
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
    music.stop();
    this.time.locked = false;
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
      rhythm: music.rhythmMode && this.world.rhythm.total() > 0 ? {
        label: music.label(), counts: this.world.rhythm.counts, bestStreak: this.world.rhythm.bestStreak, accuracy: this.world.rhythm.accuracy(),
      } : null,
    }, () => this.startRun(), () => this.toTitle());
    save.bestStreak = Math.max(save.bestStreak, this.world.rhythm.bestStreak);
    writeSave();
  }

  togglePause(): void {
    if (this.state === 'title' || this.state === 'select' || this.state === 'gameover') return;
    if (this.menus.isOpen('upgrades')) return;
    if (this.calib) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.showPauseMenu();
      music.pause();
    } else {
      this.menus.close('pause');
      this.menus.close('settings');
      this.menus.close('music');
      music.resume();
    }
  }

  private showPauseMenu(): void {
    const inRun = this.state !== 'tutorial';
    this.menus.showPause(
      () => this.togglePause(),
      () => this.openSettings(() => {}),
      () => { this.paused = false; this.tutorial.active = false; this.startRun(); },
      () => { this.paused = false; this.tutorial.active = false; this.toTitle(); },
      inRun ? () => {
        this.menus.close('pause');
        this.chooseMusic(() => {
          // New music mid-run: start it and resume the fight.
          music.start();
          this.time.locked = music.rhythmMode;
          this.beatHud.visible = music.rhythmMode;
          this.paused = false;
          this.menus.close('pause');
        }, () => this.showPauseMenu());
      } : null,
      music.label(),
    );
  }

  // ------------------------------------------------------------ calibration
  startCalibration(onDone: () => void): void {
    this.menus.close('settings');
    const view = this.menus.showCalibration(() => this.endCalibration());
    this.calib = { view, deltas: [], done: false, prevDemo: this.pad.demo, onDone };
    this.pad.demo = false;
    music.pause();
    music.startCalibration();
    view.onRetry = () => {
      music.stopCalibration(); music.startCalibration();
      if (this.calib) { this.calib.deltas = []; this.calib.done = false; }
      view.reset();
    };
  }

  private endCalibration(): void {
    const c = this.calib;
    if (!c) return;
    music.stopCalibration();
    this.menus.close('calib');
    this.pad.demo = c.prevDemo;
    this.calib = null;
    c.onDone();
  }

  /** Route pad input to the calibration (instead of the game). */
  private calibInput(): void {
    const c = this.calib!;
    const ev = this.pad.events;
    for (const e of ev) {
      if (c.done || (e.kind !== 'swipe' && e.kind !== 'tap')) continue;
      const d = music.calibDelta(e.time);
      if (d.index < 4 || Math.abs(d.delta) > 250) continue; // count-in / wild
      c.deltas.push(d.delta);
      const med = median(c.deltas);
      c.view.value(med, c.deltas.length, CALIB_NEED);
      if (c.deltas.length >= CALIB_NEED) {
        c.done = true;
        const ms = clamp(Math.round(med / 5) * 5, -200, 200);
        c.view.done(ms, (v) => { settings.rhythmOffset = v; saveSettings(); this.endCalibration(); });
      }
    }
    ev.length = 0;
    const now = performance.now();
    const k = music.calibDelta(now);
    if (k.index >= 0) c.view.beat(k.delta >= 0 ? k.index : k.index - 1);
  }

  // ------------------------------------------------------------ loop
  /** One fixed simulation step (1/60 s). */
  step(): void {
    this.inputs.length = 0;
    this.keyboard.poll(performance.now());
    if (this.calib) { this.calibInput(); return; }
    const ev = this.pad.events;
    if (this.state === 'title') {
      for (const e of ev) {
        if (e.kind === 'swipe' || e.kind === 'tap') { ev.length = 0; this.startFromTitle(); return; }
      }
    }
    const acceptInput = this.state === 'playing' || this.state === 'tutorial' || this.state === 'countdown' || this.state === 'clear';
    // Rhythm: the sim's clock and beat oracle, then judge this tick's inputs.
    const r = this.world.rhythm;
    const inFight = this.state === 'playing' || this.state === 'countdown' || this.state === 'clear';
    r.active = inFight && music.rhythmMode && music.active;
    r.now = this.simNow || performance.now();
    r.beatMs = music.beatMs;
    r.beatAfter = this.beatAfter;
    if (r.active) {
      const pb = music.prevBeat(r.now);
      r.beatPhase = isFinite(pb) ? clamp((r.now - pb) / r.beatMs, 0, 0.999) : -1;
      r.beatCount = isFinite(pb) ? music.beatIndex(pb + 1) : 0;
    } else r.beatPhase = -1;
    if (acceptInput) {
      for (let i = 0; i < ev.length; i++) {
        const e = ev[i];
        e.beat = G_NONE;
        if (r.active && (e.kind === 'swipe' || e.kind === 'tap')) {
          const j = music.judge(e.time);
          e.beat = j.grade;
          this.beatHud.judged(j.grade, j.delta, performance.now());
        }
        this.inputs.push(e);
      }
    }
    ev.length = 0;
    this.world.camLeft = this.cam.viewLeft();
    this.world.camRight = this.cam.viewRight();
    const axis = acceptInput ? clamp(this.pad.moveX + this.keyboard.moveAxis, -1, 1) : 0;
    this.world.step(this.inputs, axis);
    this.pops.log = this.debug.visible;
    this.pops.check(this.world);
    if ((this.state === 'playing' || this.state === 'countdown' || this.state === 'clear') && this.world.gameOver) this.toGameOver();
  }

  private readonly beatAfter = (t: number): number => music.nextBeat(t);

  render(alpha: number, realDt: number, simSteps = 0, frameDt = realDt): void {
    if (this.calib) this.calibInput();
    music.update(performance.now());
    const dt = realDt * this.time.scale;
    this.lastAlpha = alpha;
    this.renderTime += dt;
    this.stateTime += realDt;
    this.debug.tick(frameDt, simSteps);
    if (this.labelTime > 0) {
      this.labelTime -= realDt;
      if (this.labelTime < 1.5) this.pad.labelAlpha = Math.max(0, this.labelTime / 1.5);
      if (this.labelTime <= 0) { this.pad.labelAlpha = 0; save.padHintSeen = true; writeSave(); }
    }
    this.updateState(realDt);
    effects.update(dt);
    this.fx.update(realDt);
    this.updateCamera(alpha);
    this.cam.update(realDt);
    this.renderer.render(this.world, this.cam, alpha, this.renderTime, dt);
    const ctx = this.renderer.ctx;
    this.renderer.cssTransform();
    this.hud.draw(ctx, this.world, this.fx, realDt, this.renderTime);
    const showBeat = this.hud.visible && this.state !== 'tutorial' && this.state !== 'gameover';
    this.beatHud.visible = showBeat && music.rhythmMode;
    this.pad.beatPulse = this.beatHud.draw(ctx, music, this.world, performance.now(), realDt) * (music.rhythmMode && showBeat ? 1 : 0);
    if (this.state !== 'gameover') this.pad.draw(ctx, performance.now(), realDt);
    if (this.debug.visible) {
      const p = this.world.player;
      const c = this.world.ctrl;
      const cb = this.world.combo;
      this.debug.draw(ctx, this.pad, this.pops, [
        `buffer [${c.bufDesc}]  latency ${c.latency}f  ${this.debugFrozen ? 'FROZEN ( ] step, \\ resume)' : this.debugScale < 1 ? 'SLOW-MO 0.1x' : ''}`,
        `state ${p.state} f${p.stateFrame} move ${p.move?.id ?? '-'}:${p.moveFrame}/${p.effStartup}`,
        `pos ${p.x.toFixed(0)},${p.y.toFixed(0)} v ${p.vx.toFixed(0)},${p.vy.toFixed(0)} stall ${p.stall}`,
        `combo ${cb.hits} air ${cb.airJuggle} style ${cb.style.toFixed(0)} super ${cb.superMeter.toFixed(0)}`,
        `enemies ${this.world.enemies.length} tokens ${this.world.ai.tokens} particles ${effects.parts.count}`,
        `timescale ${this.time.scale.toFixed(2)} zoom ${this.cam.effectiveZoom().toFixed(2)} ${layout.portrait ? 'portrait' : 'landscape'}`,
      ], 8, layout.portrait ? layout.world.y + 40 : layout.world.y + 100, this.lastAlpha);
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
      const ex = e.px + (e.x - e.px) * alpha, ey = e.py + (e.y - e.py) * alpha;
      const d = Math.abs(ex - px);
      if (d > 750) continue;
      const wt = e.inHitState ? 1.2 : 0.5;
      sx += ex * wt; sw += wt;
      if (ex < minX) minX = ex;
      if (ex > maxX) maxX = ex;
      if (ey < minY && d < 400 && e.state !== 'ko') minY = ey;
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
    if (this.state === 'title') { this.cam.targetZoom = 1.25; this.cam.targetY = WORLD.groundY; }
  }
}

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const n = s.length;
  return n === 0 ? NaN : n % 2 ? s[(n - 1) >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
