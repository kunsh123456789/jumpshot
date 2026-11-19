import { layout } from './core/layout';
import { Camera } from './core/camera';
import { TimeControl } from './core/time';
import { settings } from './core/settings';
import { World } from './sim/world';
import { Renderer } from './render/renderer';
import { effects } from './render/effects';
import { DrawPad, type SwipeEvent } from './ui/pad';
import { Keyboard } from './core/keyboard';
import { DebugOverlay } from './ui/debug';
import { WORLD } from './data/tuning';

/** Top-level game: owns world, renderer, input and the state machine. */
export class Game {
  readonly time = new TimeControl();
  readonly cam = new Camera();
  readonly pad = new DrawPad();
  readonly debug = new DebugOverlay();
  readonly keyboard: Keyboard;
  readonly renderer: Renderer;
  world = new World();
  paused = false;
  private inputs: SwipeEvent[] = [];
  private renderTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.pad.attach(canvas);
    this.keyboard = new Keyboard(this.pad);
    this.keyboard.onToggleDebug = () => { this.debug.visible = !this.debug.visible; settings.debug = this.debug.visible; };
    this.debug.visible = settings.debug;
    this.renderer.resize();
    window.addEventListener('resize', () => this.renderer.resize());
    this.cam.targetX = WORLD.arenaW / 2;
    this.cam.snap();
  }

  /** One fixed simulation step (1/60 s). */
  step(): void {
    this.inputs.length = 0;
    const ev = this.pad.events;
    for (let i = 0; i < ev.length; i++) this.inputs.push(ev[i]);
    ev.length = 0;
    this.world.step(this.inputs);
  }

  render(alpha: number, realDt: number): void {
    const dt = realDt * this.time.scale;
    this.renderTime += dt;
    this.debug.tick(realDt);
    effects.update(dt);
    this.updateCamera();
    this.cam.update(realDt);
    this.renderer.render(this.world, this.cam, alpha, this.renderTime, dt);
    const ctx = this.renderer.ctx;
    this.renderer.cssTransform();
    this.pad.draw(ctx, performance.now(), realDt);
    const p = this.world.player;
    this.debug.draw(ctx, this.pad, [
      `state ${p.state} f${p.stateFrame} move ${p.move?.id ?? '-'}:${p.moveFrame}`,
      `pos ${p.x.toFixed(0)},${p.y.toFixed(0)} v ${p.vx.toFixed(0)},${p.vy.toFixed(0)}`,
      `particles ${effects.parts.count} enemies ${this.world.enemies.length}`,
      `timescale ${this.time.scale.toFixed(2)} layout ${layout.portrait ? 'portrait' : 'landscape'}`,
    ], 8, layout.world.y + 60);
  }

  private updateCamera(): void {
    const p = this.world.player;
    this.cam.targetX = p.x;
    this.cam.targetY = WORLD.groundY;
    this.cam.targetZoom = 1;
  }
}
