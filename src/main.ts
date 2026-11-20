import { Game } from './game';
import { layout } from './core/layout';
import { audio } from './core/audio';
import { SIM_DT } from './data/tuning';
import { loadSave, loadSettings } from './core/settings';

loadSettings();
loadSave();

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);
const W = window as unknown as Record<string, unknown>;
W.__jumpshot = game;
W.__layout = layout;

const qs = new URLSearchParams(location.search);
// Dev/testing: ?wave=N starts a run at wave N (skips the tutorial).
// ?song=dojo|neon|volcano: Rhythm Mode with that song, no picker. ?classic: Classic Mode (dev/tests).
if (qs.has('classic')) game.forceMode(null);
else if (qs.get('song')) game.forceMode(qs.get('song'));
const startWave = parseInt(qs.get('wave') ?? '', 10);
if (startWave > 0) game.devStart(startWave);
if (location.hash === '#lab') game.openLab();

// Audio must be unlocked inside a real user-gesture handler (iOS/Android policy).
const unlock = () => audio.unlock();
for (const t of ['pointerdown', 'touchend', 'keydown', 'click']) document.addEventListener(t, unlock, { capture: true, passive: true });

// Prevent page scrolling / pinch-zoom / context menus on mobile.
const stop = (e: Event) => e.preventDefault();
document.addEventListener('touchmove', stop, { passive: false });
document.addEventListener('gesturestart', stop);
document.addEventListener('contextmenu', stop);
document.addEventListener('dblclick', stop);

/**
 * Fixed 60 Hz simulation with an accumulator; rendering interpolates with
 * alpha = acc / SIM_DT. Delta time comes only from the rAF timestamp and is
 * clamped (tab switches). Slow-mo scales how fast the accumulator fills.
 */
const MAX_STEPS = 6;
let acc = 0;
let last = -1;

function frame(now: number): void {
  if (last < 0) last = now;
  let real = (now - last) / 1000;
  last = now;
  if (real > 0.1) real = 0.1;
  if (real < 0) real = 0;
  const dbg = game.debugScale;
  game.time.update(real * dbg);
  let steps = 0;
  if (!game.paused && !game.lab.active) {
    if (game.debugFrozen) {
      while (game.stepRequests > 0) { game.step(); game.stepRequests--; steps++; }
      acc = 0;
    } else {
      acc += real * dbg * game.time.scale;
      const pnow = qs.has('manual') ? performance.now() : now;
      while (acc >= SIM_DT && steps < MAX_STEPS) {
        // performance.now()-domain time this step advances the sim to (Rhythm Mode maps it onto the audio clock).
        game.simNow = pnow - ((acc - SIM_DT) * 1000) / Math.max(1e-6, dbg * game.time.scale);
        game.step();
        acc -= SIM_DT;
        steps++;
      }
      if (steps >= MAX_STEPS) acc = 0;
    }
  }
  if (game.lab.active) { game.lab.frame(game.renderer.ctx, real); return; }
  const frozen = game.paused || game.debugFrozen;
  game.render(frozen && game.debugFrozen ? 1 : acc / SIM_DT, frozen ? 0 : real * dbg, steps, real);
}

if (qs.has('manual')) {
  // Test harness: drive frames with synthetic timestamps (e.g. emulate 144 Hz).
  let t = 0;
  W.__advance = (ms: number) => { t += ms; frame(t); };
} else {
  const loop = (now: number) => { frame(now); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
