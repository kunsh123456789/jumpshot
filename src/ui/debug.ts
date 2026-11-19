import { DIR_NAMES } from '../data/moves';
import type { DrawPad } from './pad';

/** Debug overlay toggled with the backquote key. Lines are provided by the game each frame. */
export class DebugOverlay {
  visible = false;
  private fpsAcc = 0; private fpsFrames = 0; fps = 0;
  private lines: string[] = [];

  tick(dt: number): void {
    this.fpsAcc += dt; this.fpsFrames++;
    if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsFrames / this.fpsAcc); this.fpsAcc = 0; this.fpsFrames = 0; }
  }

  draw(ctx: CanvasRenderingContext2D, pad: DrawPad, extra: string[], x: number, y: number): void {
    if (!this.visible) return;
    const L = this.lines;
    L.length = 0;
    L.push(`FPS ${this.fps}`);
    L.push(`last: ${pad.lastKind} ${pad.lastDir >= 0 ? DIR_NAMES[pad.lastDir] : '-'} len ${pad.lastLen.toFixed(0)} spd ${pad.lastSpeed.toFixed(2)}`);
    for (const e of extra) L.push(e);
    ctx.save();
    ctx.font = '12px ui-monospace, monospace';
    const w = 330, h = 16 * L.length + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#7dffb0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < L.length; i++) ctx.fillText(L[i], x + 6, y + 6 + i * 16);
    ctx.restore();
  }
}
