import { DIR_NAMES } from '../data/moves';
import type { DrawPad } from './pad';
import type { PopDetector } from './popDetector';

const GRAPH_N = 120;

/** Debug overlay (backquote): timing, frame-time graph, pop detector, input state. */
export class DebugOverlay {
  visible = false;
  private fpsAcc = 0; private fpsFrames = 0; fps = 0;
  private tickAcc = 0; ticksPerSec = 0; private ticksSince = 0;
  private ft = new Float32Array(GRAPH_N); private ftHead = 0;
  private lines: string[] = [];

  tick(dt: number, simSteps: number): void {
    this.fpsAcc += dt; this.fpsFrames++;
    this.ticksSince += simSteps;
    this.tickAcc += dt;
    if (this.fpsAcc >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.ticksPerSec = Math.round(this.ticksSince / this.tickAcc);
      this.fpsAcc = 0; this.fpsFrames = 0; this.ticksSince = 0; this.tickAcc = 0;
    }
    this.ft[this.ftHead] = dt * 1000;
    this.ftHead = (this.ftHead + 1) % GRAPH_N;
  }

  draw(ctx: CanvasRenderingContext2D, pad: DrawPad, pops: PopDetector, extra: string[], x: number, y: number, alpha: number): void {
    if (!this.visible) return;
    const L = this.lines;
    L.length = 0;
    L.push(`render ${this.fps} fps · sim ${this.ticksPerSec} ticks/s · alpha ${alpha.toFixed(2)}`);
    L.push(`last: ${pad.lastKind} ${pad.lastDir >= 0 ? DIR_NAMES[pad.lastDir] : '-'} len ${pad.lastLen.toFixed(0)} spd ${pad.lastSpeed.toFixed(0)}px/s`);
    L.push(`input: ${pad.mode} drag (${pad.stickDX.toFixed(0)},${pad.stickDY.toFixed(0)}) move ${pad.moveX.toFixed(2)} recent ${pad.recentSpeed.toFixed(0)}px/s`);
    for (const e of extra) L.push(e);
    L.push(`POPS ${pops.total} / ${pops.ticks} ticks · max ang ${pops.maxAng.toFixed(2)}rad root ${pops.maxRoot.toFixed(0)}u`);
    for (let i = Math.max(0, pops.events.length - 4); i < pops.events.length; i++) {
      const p = pops.events[i];
      L.push(` ! f${p.frame} ${p.who} ${p.kind} ${p.value} ${p.state} [${p.transition}]`);
    }
    ctx.save();
    ctx.font = '12px ui-monospace, monospace';
    const w = 470, gh = 46, h = 16 * L.length + 16 + gh;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x, y, w, h);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < L.length; i++) {
      ctx.fillStyle = L[i].startsWith(' !') ? '#ff8080' : L[i].startsWith('POPS') ? (pops.total ? '#ffb060' : '#7dffb0') : '#7dffb0';
      ctx.fillText(L[i], x + 6, y + 6 + i * 16);
    }
    // Frame-time graph (ms); lines at 16.7 and 6.9 (144 Hz).
    const gy = y + h - gh - 4, gx = x + 6, gw = w - 12;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    const ms = (v: number) => gy + gh - Math.min(gh, (v / 40) * gh);
    ctx.moveTo(gx, ms(16.7)); ctx.lineTo(gx + gw, ms(16.7));
    ctx.moveTo(gx, ms(6.9)); ctx.lineTo(gx + gw, ms(6.9));
    ctx.stroke();
    const bw = gw / GRAPH_N;
    for (let i = 0; i < GRAPH_N; i++) {
      const v = this.ft[(this.ftHead + i) % GRAPH_N];
      ctx.fillStyle = v > 20 ? '#ff6060' : '#60c0ff';
      const top = ms(v);
      ctx.fillRect(gx + i * bw, top, Math.max(1, bw - 0.5), gy + gh - top);
    }
    ctx.restore();
  }
}
