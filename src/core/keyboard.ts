import { INPUT } from '../data/tuning';
import { classifyDir, type DrawPad } from '../ui/pad';

/**
 * Keyboard fallback: WASD/arrows (with diagonals) = light swipes,
 * hold Shift = heavy, Space = tap. A short chord window lets two keys
 * pressed together form a diagonal.
 */
export class Keyboard {
  private held = { up: false, down: false, left: false, right: false };
  private pending = 0;
  private shift = false;
  onToggleDebug: () => void = () => {};
  onPause: () => void = () => {};
  enabled = true;

  constructor(private pad: DrawPad) {
    window.addEventListener('keydown', (e) => this.down(e));
    window.addEventListener('keyup', (e) => this.up(e));
    window.addEventListener('blur', () => { this.held = { up: false, down: false, left: false, right: false }; });
  }

  private dirKey(code: string): keyof Keyboard['held'] | null {
    switch (code) {
      case 'KeyW': case 'ArrowUp': return 'up';
      case 'KeyS': case 'ArrowDown': return 'down';
      case 'KeyA': case 'ArrowLeft': return 'left';
      case 'KeyD': case 'ArrowRight': return 'right';
    }
    return null;
  }

  private down(e: KeyboardEvent): void {
    if (e.code === 'Backquote') { this.onToggleDebug(); e.preventDefault(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') { this.onPause(); e.preventDefault(); return; }
    this.shift = e.shiftKey;
    if (!this.enabled) return;
    const k = this.dirKey(e.code);
    if (k) {
      e.preventDefault();
      if (e.repeat) return;
      this.held[k] = true;
      if (!this.pending) {
        this.pending = window.setTimeout(() => this.fire(), INPUT.keyChordMs);
      }
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) this.pad.inject('tap', -1, false);
    }
  }

  private up(e: KeyboardEvent): void {
    this.shift = e.shiftKey;
    const k = this.dirKey(e.code);
    if (k) {
      // If released before the chord timer fires, still count it.
      if (this.pending) { this.fire(); }
      this.held[k] = false;
    }
  }

  private fire(): void {
    if (this.pending) { clearTimeout(this.pending); this.pending = 0; }
    const h = this.held;
    const dx = (h.right ? 1 : 0) - (h.left ? 1 : 0);
    const dy = (h.down ? 1 : 0) - (h.up ? 1 : 0);
    if (dx === 0 && dy === 0) return;
    this.pad.inject('swipe', classifyDir(dx, dy), this.shift);
  }
}
