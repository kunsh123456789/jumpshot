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
import { clamp } from './core/math';
import { RhythmDirector } from './rhythm/director';
import { RhythmHud, drawRhythmWorld } from './rhythm/hud';
import { RhythmUI, type CalibView } from './rhythm/ui';
import { DRAW, syncDrawStyle } from './render/drawStyle';
import { INKLOOK } from './data/inkLook';
import { inkFx, drawEntitiesInk } from './render/inkFx';
import { paper } from './render/paper';
import { PaperHud } from './render/paperHud';
import { PAGE_ORDER, type PageId } from './data/paper';
import { RHYTHM } from './data/rhythm';
import { SONGS } from './data/songs';
import { weaponById } from './data/weapons';
import { WEAPON_T } from './data/weapons/tuning';
import { updateRefFx } from './render/weaponFx';

type GState = 'title' | 'tutorial' | 'countdown' | 'playing' | 'breather' | 'gameover';

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
  // ---- Rhythm Mode (src/rhythm). Inert in Classic Mode: world.rhythm stays null. ----
  readonly rhythm = new RhythmDirector();
  readonly rhud = new RhythmHud();
  readonly phud = new PaperHud();
  readonly rui = new RhythmUI();
  /** performance.now()-domain time the current sim step advances to (set by the main loop). */
  simNow = 0;
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
  private nextWave = 1;
  private overTimer = 0;
  /** Rhythm Mode: the bar the next wave starts on (-1 = not chosen yet). */
  private waitBar = -1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.renderer.drawExtras = (ctx, alpha, time) => {
      if (DRAW.ink) drawEntitiesInk(ctx, this.world, alpha, time, 1 / ((settings.look === 'pixel' ? settings.pixelRes : INKLOOK.refRes) * this.cam.effectiveZoom()));
      else drawEntities(ctx, this.world, alpha, time);
      if (this.world.rhythm) drawRhythmWorld(ctx, this.rhythm, this.world, alpha, this.rhythm.heardAt(performance.now()), this.rhud.pulse);
    };
    this.pad.attach(canvas);
    this.keyboard = new Keyboard(this.pad);
    this.keyboard.onToggleDebug = () => { this.debug.visible = !this.debug.visible; settings.debug = this.debug.visible; };
    this.keyboard.onPause = () => this.togglePause();
    this.keyboard.onKey = (code) => this.menus.loadoutKey(code) || this.menus.swapKey(code);
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
    inkFx.bind(this.world);
    // Pages bake handwriting into their doodles: re-bake once the bundled fonts are ready.
    document.fonts?.ready.then(() => paper.invalidate());
    window.addEventListener('jumpshot-look', () => { paper.invalidate(); if (this.state === 'title') paper.setPage(this.pageFor(1)); });
    this.rhythm.onJudge = (j, broke) => this.rhud.judged(j, broke, this.rhythm.now);
    window.addEventListener('jumpshot-mode', () => { this.rhythm.clock.inputOffsetMs = settings.rhythmOffset; });
    this.publishPadTop();
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
    this.menus.showTitle(save.highScore, () => this.openSettings(true),
      { rhythm: settings.rhythmMode, onToggle: (r) => { settings.rhythmMode = r; saveSettings(); } },
      { name: weaponById(save.weapon).name, open: () => this.openLoadout() });
    this.cam.targetX = this.world.player.x;
    this.cam.snap();
    audio.stopMusic();
    this.endRhythm();
    this.rhythm.stopMic();
    this.rui.closeAll();
    paper.resetTransitions();
    paper.setPage(this.pageFor(1));
  }

  /** Pre-run loadout (from the title). */
  private openLoadout(): void {
    this.menus.close('title');
    this.menus.showLoadout(weaponById(save.weapon).id, (id) => { save.weapon = id; writeSave(); this.world.setWeapon(id); }, () => this.toTitle());
  }

  /** Equip a weapon for this run (loadout choice or a between-wave swap); first time: show its tooltip. */
  private equip(id: string, swap: boolean): void {
    this.world.setWeapon(id);
    save.weapon = this.world.weapon.id;
    const p = this.world.player;
    if (swap) { p.cue = 'draw'; p.cueSerial++; }
    if (!save.weaponTips.includes(save.weapon)) {
      save.weaponTips.push(save.weapon);
      this.menus.weaponTip(this.world.weapon, WEAPON_T.tipMs);
    }
    writeSave();
  }

  private startFromTitle(): void {
    audio.unlock();
    this.pad.demo = false;
    this.menus.close('title');
    this.menus.close('settings');
    if (!save.tutorialDone) this.startTutorial();
    else this.beginRun(null);
  }

  /** Settings panel; Rhythm calibration entry point. */
  private openSettings(fromTitle: boolean): void {
    this.menus.showSettings(() => {}, fromTitle ? () => this.startTutorial() : null, () => this.startCalibration(() => this.openSettings(fromTitle)));
  }

  /** Dev/tests: force a mode (null = Classic) and skip the song picker. */
  forceMode(songId: string | null): void {
    settings.rhythmMode = !!songId;
    const s = SONGS.find((x) => x.id === songId);
    if (s) this.rhythm.selectSong(s);
    this.skipPicker = true;
  }
  private skipPicker = false;

  /** Start a run: Classic goes straight in; Rhythm Mode picks a song first. */
  private beginRun(after: (() => void) | null): void {
    if (!settings.rhythmMode || this.skipPicker) { this.startRun(); after?.(); return; }
    const go = () => { this.rui.close('picker'); this.startRun(); after?.(); };
    this.rui.showPicker({
      current: this.rhythm.source === 'song' ? 'song:' + this.rhythm.song.id : this.rhythm.source,
      onSong: (s) => { this.rhythm.selectSong(s); saveSettings(); go(); },
      onFile: (f, st) => {
        st.busy(true);
        st.set('Loading…');
        this.rhythm.loadFile(f, (fr, label) => { st.progress(fr); st.set(`Finding the beat… ${label} ${Math.round(fr * 100)}%`); })
          .then((song) => {
            st.progress(1);
            st.set(`✓ ${song.name} — ${Math.round(song.map.bpm)} BPM${song.map.grid ? '' : ' (live tempo)'}`);
            this.rhythm.selectFile(song);
            window.setTimeout(() => { if (this.rui.isOpen('picker')) go(); }, 700);
          })
          .catch((e: unknown) => { st.progress(-1); st.set(e instanceof Error ? e.message : String(e), true); })
          .finally(() => st.busy(false));
      },
      onMic: (st) => {
        st.busy(true);
        st.set('Asking for the microphone…');
        this.rhythm.selectMic().then((ok) => {
          st.busy(false);
          if (!ok) { st.set(this.rhythm.tracker.error || 'Microphone unavailable', true); return; }
          go();
        });
      },
      onCalibrate: () => { this.rui.close('picker'); this.startCalibration(() => this.beginRun(after)); },
      onBack: () => { this.rui.close('picker'); this.toTitle(); },
    });
  }

  /** Rhythm Mode run start: music + clock + sim hooks. */
  private startRhythm(): void {
    this.rhythm.startRun();
    this.world.rhythm = this.rhythm;
    this.time.locked = true;
    this.fx.pitchFn = (combo) => this.rhythm.hitPitch(combo);
    this.rhud.reset();
  }

  private endRhythm(): void {
    this.rhythm.stop();
    this.world.rhythm = null;
    this.time.locked = false;
    this.fx.pitchFn = null;
  }

  /**
   * Ink look camera: a locked wide shot. Fixed zoom (small figures), floor at
   * ~79 % of the view height, and a slow drift only when the player leaves the
   * central dead zone. Punch-ins stay small; finishers may still focus.
   */
  private inkCamera(alpha: number): void {
    const cam = this.cam, p = this.world.player;
    const px = p.px + (p.x - p.px) * alpha;
    cam.groundScreen = layout.viewY0 + INKLOOK.groundScreenFrac * layout.viewH;
    cam.followOmega = INKLOOK.driftOmega;
    cam.punchScale = INKLOOK.punchScale;
    cam.targetZoom = INKLOOK.zoom;
    cam.targetY = WORLD.groundY;
    const half = layout.viewW / 2 / INKLOOK.zoom;
    const dz = half * INKLOOK.deadzoneFrac;
    if (px > cam.targetX + dz) cam.targetX = px - dz;
    else if (px < cam.targetX - dz) cam.targetX = px + dz;
    if (cam.focusZoom > 0.01) cam.targetX += (px - cam.targetX) * Math.min(1, cam.focusZoom / 0.25);
    if (this.state === 'title') { cam.targetX = p.x; }
  }

  // ------------------------------------------------------------ rhythm latency calibration
  private calib: { view: CalibView; deltas: number[]; done: boolean; prevDemo: boolean; onDone: () => void } | null = null;

  /** Metronome + live pad: flick on each click; the median offset becomes the input latency offset. */
  startCalibration(onDone: () => void): void {
    this.menus.close('settings');
    const view = this.rui.showCalibration(() => this.endCalibration());
    this.calib = { view, deltas: [], done: false, prevDemo: this.pad.demo, onDone };
    this.pad.demo = false;
    this.rhythm.startMetronome(RHYTHM.calibrateBpm);
    view.onRetry = () => {
      this.rhythm.startMetronome(RHYTHM.calibrateBpm);
      if (this.calib) { this.calib.deltas = []; this.calib.done = false; }
      view.reset();
    };
  }

  private endCalibration(): void {
    const c = this.calib;
    if (!c) return;
    this.rui.close('calib');
    this.pad.demo = c.prevDemo;
    this.calib = null;
    this.rhythm.stopMetronome();
    c.onDone();
  }

  /** Route pad input to the calibration instead of the game. */
  private calibInput(): void {
    const c = this.calib!;
    const clock = this.rhythm.metro.clock;
    const ev = this.pad.events;
    for (const e of ev) {
      if (c.done || (e.kind !== 'swipe' && e.kind !== 'tap') || !clock.ready) continue;
      // Raw (uncalibrated) offset from the nearest click, in ms.
      const t = clock.heardAt(e.time);
      const b = clock.beatAt(t);
      const k = Math.round(b);
      if (k < RHYTHM.calibrateCountIn) continue;
      const d = (t - clock.timeOfBeat(k)) * 1000;
      if (Math.abs(d) > 250) continue;
      c.deltas.push(d);
      const med = median(c.deltas);
      c.view.value(med, c.deltas.length, RHYTHM.calibrateTaps);
      if (c.deltas.length >= RHYTHM.calibrateTaps) {
        c.done = true;
        const ms = clamp(Math.round(med / 5) * 5, RHYTHM.offsetMin, RHYTHM.offsetMax);
        c.view.done(ms, (v) => { settings.rhythmOffset = v; saveSettings(); this.rhythm.clock.inputOffsetMs = v; this.endCalibration(); });
      }
    }
    ev.length = 0;
    if (clock.ready) { const now = clock.heardAt(performance.now()); c.view.beat(clock.beat(now)); }
  }

  startTutorial(): void {
    this.menus.closeAll();
    this.world.reset();
    this.world.setWeapon('fists'); // the tutorial teaches the base moveset
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
    this.beginRun(() => this.menus.banner('READY?', 'the real fight starts now', 1400));
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
    this.nextWave = 1;
    this.pad.demo = false;
    this.pad.hint = -1;
    this.pad.hintLabel = '';
    this.hud.visible = true;
    this.menus.pauseBtn.style.display = '';
    this.effectsReset();
    this.equip(save.weapon, false);
    if (settings.rhythmMode) this.startRhythm();
    else { this.endRhythm(); audio.startMusic(); }
    this.pops.reset();
    if (!save.padHintSeen) { this.pad.labelAlpha = 1; this.labelTime = 7; }
    this.beginCountdown();
  }

  private effectsReset(): void {
    effects.clear();
    paper.resetTransitions();
    inkFx.clearFloor();
    this.time.reset();
    this.fx.popups.length = 0;
    this.fx.lastComboEnd = null;
  }

  /** Show the WAVE banner; the wave spawns WAVES_T.countdownSec later (on a bar line in Rhythm Mode). */
  private beginCountdown(): void {
    const wave = this.nextWave;
    const arena = ARENA_ORDER[Math.floor((wave - 1) / WAVES_T.arenaRotateEvery) % ARENA_ORDER.length];
    if (arena !== this.renderer.bg.current) this.renderer.bg.set(arena);
    this.setState('countdown');
    this.waitBar = -1;
    const boss = wave % 10 === 0, elite = !boss && wave % 5 === 0;
    // Paper world: turn to this wave's page.
    paper.flipTo(this.pageFor(wave));
    this.menus.banner(`WAVE ${wave}`, boss ? '⚠ BOSS INCOMING ⚠' : elite ? 'ELITE INCOMING' : '', 1400);
    this.hud.waveLabel = `WAVE ${wave}`;
    audio.ui('wave');
  }

  /** Rhythm Mode: hold the wave start until the next bar line after the countdown. */
  private onBarLine(): boolean {
    if (!this.world.rhythm || !this.rhythm.live) return true;
    const bar = this.rhythm.clock.barInfo(this.rhythm.now).bar;
    if (this.waitBar < 0) this.waitBar = bar + 1;
    return bar >= this.waitBar;
  }

  /** The page for a wave: the chosen page, or rotate pages every few waves with kraft for bosses. */
  private pageFor(wave: number): PageId {
    if (settings.page !== 'auto') return settings.page;
    if (wave % 10 === 0) return 'kraft';
    return PAGE_ORDER[Math.floor((Math.max(1, wave) - 1) / WAVES_T.arenaRotateEvery) % PAGE_ORDER.length];
  }

  private onWaveClear(): void {
    if (this.state !== 'playing') return;
    paper.cleared();
    this.world.combo.end(false);
    this.world.combo.score += SCORE.waveClear * this.nextWave;
    const p = this.world.player;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * WAVES_T.healFraction);
    save.bestWave = Math.max(save.bestWave, this.nextWave);
    this.menus.banner('WAVE CLEAR', `+${(SCORE.waveClear * this.nextWave).toLocaleString()}  ·  +${Math.round(WAVES_T.healFraction * 100)}% HP`, 1500);
    audio.ui('clear');
    // Breather: the arena is already empty; reset the floor cracks, then the
    // next wave's title comes up and it auto-continues. Nothing blocks on a choice.
    inkFx.clearFloor();
    this.nextWave++;
    this.setState('breather');
    this.menus.showSwap(this.world.weapon.id, (id) => this.equip(id, true));
  }

  private toGameOver(): void {
    this.setState('gameover');
    this.overTimer = 0;
    audio.ui('gameover');
    audio.stopMusic();
    paper.crumple();
    if (this.world.rhythm) this.endRhythm();
    this.time.slowmo(0.3, 1.0);
  }

  private showResults(): void {
    const c = this.world.combo;
    c.end(true);
    const score = c.score;
    const newHigh = score > save.highScore;
    if (newHigh) save.highScore = score;
    save.bestCombo = Math.max(save.bestCombo, c.bestHits);
    save.bestWave = Math.max(save.bestWave, this.world.wave);
    writeSave();
    this.menus.pauseBtn.style.display = 'none';
    this.menus.showResults({
      score, high: save.highScore, newHigh, wave: Math.max(1, this.world.wave), bestHits: c.bestHits, bestDamage: c.bestDamage,
      bestRank: c.bestRank, kos: c.totalKOs, parries: c.parries, finishers: c.finishers, maxRank: c.maxRankRun,
      rhythm: settings.rhythmMode && this.rhythm.stats.judged > 0
        ? { label: this.rhythm.label(), counts: this.rhythm.stats.counts, bestStreak: this.rhythm.stats.bestStreak, accuracy: this.rhythm.accuracy() } : null,
    }, () => this.startRun(), () => this.toTitle());
  }

  togglePause(): void {
    if (this.state === 'title' || this.state === 'gameover') return;
    if (this.calib) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.menus.showPause(
        () => this.togglePause(),
        () => this.openSettings(false),
        () => { this.paused = false; this.tutorial.active = false; this.startRun(); },
        () => { this.paused = false; this.tutorial.active = false; this.toTitle(); },
      );
      if (this.world.rhythm) this.rhythm.pause(); else audio.stopMusic();
    } else {
      this.menus.close('pause');
      this.menus.close('settings');
      if (this.world.rhythm) this.rhythm.resume();
      else if (this.state !== 'tutorial') audio.startMusic();
    }
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
    const acceptInput = this.state === 'playing' || this.state === 'tutorial' || this.state === 'countdown' || this.state === 'breather';
    if (acceptInput) for (let i = 0; i < ev.length; i++) this.inputs.push(ev[i]);
    ev.length = 0;
    syncDrawStyle();
    DRAW.gridTick = false;
    DRAW.gridMode = false;
    if (this.world.rhythm) {
      // Rhythm Mode: this step's time on the audio clock, then judge its inputs.
      this.rhythm.now = this.rhythm.heardAt(this.simNow || performance.now());
      this.rhythm.judgeInputs(this.inputs);
      DRAW.gridTick = this.rhythm.drawGridTick();
      DRAW.gridMode = this.rhythm.live;
    }
    this.world.camLeft = this.cam.viewLeft();
    this.world.camRight = this.cam.viewRight();
    const axis = acceptInput ? clamp(this.pad.moveX + this.keyboard.moveAxis, -1, 1) : 0;
    this.world.step(this.inputs, axis);
    if (this.world.rhythm) this.rhythm.afterStep(this.world);
    this.pops.log = this.debug.visible;
    this.pops.check(this.world);
    if ((this.state === 'playing' || this.state === 'countdown' || this.state === 'breather') && this.world.gameOver) this.toGameOver();
  }

  render(alpha: number, realDt: number, simSteps = 0, frameDt = realDt): void {
    if (this.world.rhythm || this.rhythm.conductor.playing || this.rhythm.metro.playing) this.rhythm.frame(performance.now());
    if (this.calib) this.calibInput();
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
    updateRefFx(dt);
    effects.paperText = DRAW.ink;
    inkFx.update(dt);
    paper.update(realDt);
    this.renderer.beatPulse = this.world.rhythm ? this.rhud.pulse : 0;
    this.fx.update(realDt);
    this.updateCamera(alpha);
    this.cam.update(realDt);
    audio.updateMusic();
    this.renderer.render(this.world, this.cam, alpha, this.renderTime, dt);
    const ctx = this.renderer.ctx;
    this.renderer.cssTransform();
    if (DRAW.ink) {
      // Paper-drawn HUD (ink looks); the previous HUD stays for the Smooth look.
      this.phud.visible = this.hud.visible; this.phud.waveLabel = this.hud.waveLabel;
      this.phud.draw(ctx, this.world, this.fx, realDt, this.renderTime);
    } else this.hud.draw(ctx, this.world, this.fx, realDt, this.renderTime);
    if (this.world.rhythm && this.hud.visible && this.state !== 'gameover') {
      const now = this.rhythm.heardAt(performance.now());
      // On each heard beat: a soft count tick while any enemy is winding up.
      if (this.rhud.update(this.rhythm, now, realDt)) {
        for (const e of this.world.enemies) if (e.state === 'windup' && this.rhythm.enemyBeatsLeft(e, now) > 0) { audio.telegraph(); break; }
        // Groove: the camera breathes on every beat, harder on downbeats and in loud sections.
        const I = this.rhythm.clock.section(now).intensity;
        if (settings.shake > 0) this.cam.punchZoom(RHYTHM.beatZoomPulse * I * (this.rhud.downbeat ? 1.6 : 1));
      }
      if (this.rhud.sectionChanged && this.rhud.sectionKind === 'drop') {
        this.cam.shake(9 * settings.shake, 0, 1);
        this.cam.punchZoom(0.05);
        if (!settings.reduceFlashes) { effects.screenFlash = Math.max(effects.screenFlash, 0.35); effects.screenFlashColor = '#ff9af0'; }
      }
      this.rhud.draw(ctx, this.rhythm, this.world, now);
    }
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
        if (this.stateTime >= WAVES_T.countdownSec && this.onBarLine()) {
          this.world.wave = this.nextWave;
          this.world.waves.start(this.world, this.nextWave);
          this.menus.close('swap');
          this.setState('playing');
        }
        break;
      case 'breather':
        if (this.stateTime >= WAVES_T.breatherSec - WAVES_T.countdownSec) this.beginCountdown();
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
    syncDrawStyle();
    if (DRAW.ink) { this.inkCamera(alpha); return; }
    this.cam.groundScreen = WORLD.groundScreenY;
    this.cam.followOmega = 0;
    this.cam.punchScale = 1;
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
