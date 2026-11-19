import { Game } from './game';
import { layout } from './core/layout';
import { SIM_DT } from './data/tuning';
import { loadSave, loadSettings } from './core/settings';

loadSettings();
loadSave();

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);
(window as unknown as { __jumpshot: Game }).__jumpshot = game;
(window as unknown as { __layout: typeof layout }).__layout = layout;

// Prevent page scrolling / pinch-zoom / context menus on mobile.
const stop = (e: Event) => e.preventDefault();
document.addEventListener('touchmove', stop, { passive: false });
document.addEventListener('gesturestart', stop);
document.addEventListener('contextmenu', stop);
document.addEventListener('dblclick', stop);

// Fixed-timestep simulation with interpolated rendering.
const MAX_STEPS = 6;
let acc = 0;
let last = performance.now();

function frame(now: number): void {
  let real = (now - last) / 1000;
  last = now;
  if (real > 0.1) real = 0.1;
  if (real < 0) real = 0;
  game.time.update(real);
  if (!game.paused) {
    acc += real * game.time.scale;
    let steps = 0;
    while (acc >= SIM_DT && steps < MAX_STEPS) {
      game.step();
      acc -= SIM_DT;
      steps++;
    }
    if (steps >= MAX_STEPS) acc = 0;
  }
  game.render(acc / SIM_DT, game.paused ? 0 : real);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
