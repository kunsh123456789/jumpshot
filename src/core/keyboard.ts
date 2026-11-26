import { INPUT } from '../data/tuning';
import { classifyDir, type DrawPad } from '../ui/pad';

/**
 * Keyboard fallback.
 *  - Move:   A / D  or  ← / →   (held; analog-style axis)
 *  - Attack: I / J / K / L = up / left / down / right; press two together for diagonals
 *  - Shift = heavy, Space = tap (jump; Shift+Space or F = dodge/parry)
 *  - W / ↑ = jump (hold for a higher jump), S / ↓ = low stance, X or Enter = Special
 *  - While a Special is open: arrows / WASD move the picker or follow the shown trace directions; Space / Enter / X pick
 *  - 1-5 = pick a weapon (loadout screen, or swap during the between-wave breather)
 *  - ` = debug overlay, Esc/P = pause, [ = 0.1x slow-mo, ] = freeze + step one frame, \ = resume
 * Diagonal chords are resolved by polling (no timers): poll() runs every sim tick.
 */
export class Keyboard {
  private held = { up: false, down: false, left: false, right: false };
  /** Any attack key (I / J / K / L) is held down. */
  get attackHeld(): boolean { return this.held.up || this.held.down || this.held.left || this.held.right; }
  private move = { left: false, right: false };
  private pendingSince = -1;
  private shift = false;
  onToggleDebug: () => void = () => {};
  onPause: () => void = () => {};
  onDebugSlow: () => void = () => {};
  onDebugStep: () => void = () => {};
  onDebugResume: () => void = () => {};
  /** Every key press (cheat-code listener). */
  onAnyKey: (code: string, key: string) => void = () => {};
  /** Menu keys (weapon loadout / swap): return true if handled. */
  onKey: (code: string) => boolean = () => false;
  enabled = true;
  /** Special input mode: arrows / WASD / Space go here instead of the game (trace + QTE). */
  specialSink: ((key: 'up' | 'down' | 'left' | 'right' | 'tap', down: boolean) => void) | null = null;
  private jumpDownT = -1;
  private crouchHeld = false;

  /** Jump charge from a held W / ↑ (0..1 over ~150 ms). */
  jumpCharge(now: number): number { return this.jumpDownT < 0 ? 0 : Math.min(1, (now - this.jumpDownT) / 150); }
  get crouching(): boolean { return this.crouchHeld; }

  constructor(private pad: DrawPad) {
    window.addEventListener('keydown', (e) => this.down(e));
    window.addEventListener('keyup', (e) => this.up(e));
    window.addEventListener('blur', () => {
      this.held = { up: false, down: false, left: false, right: false };
      this.move = { left: false, right: false };
    });
  }

  /** Horizontal movement axis from the keyboard (-1..1). */
  get moveAxis(): number { return (this.move.right ? 1 : 0) - (this.move.left ? 1 : 0); }

  private attackKey(code: string): keyof Keyboard['held'] | null {
    switch (code) {
      case 'KeyI': return 'up';
      case 'KeyK': return 'down';
      case 'KeyJ': return 'left';
      case 'KeyL': return 'right';
    }
    return null;
  }
  private moveKey(code: string): 'left' | 'right' | null {
    switch (code) {
      case 'KeyA': case 'ArrowLeft': return 'left';
      case 'KeyD': case 'ArrowRight': return 'right';
    }
    return null;
  }

  private down(e: KeyboardEvent): void {
    if (!e.repeat && !(e.target instanceof HTMLInputElement)) this.onAnyKey(e.code, e.key);
    if (!e.repeat && this.onKey(e.code)) { e.preventDefault(); return; }
    switch (e.code) {
      case 'Backquote': this.onToggleDebug(); e.preventDefault(); return;
      case 'Escape': case 'KeyP': this.onPause(); e.preventDefault(); return;
      case 'BracketLeft': this.onDebugSlow(); e.preventDefault(); return;
      case 'BracketRight': this.onDebugStep(); e.preventDefault(); return;
      case 'Backslash': this.onDebugResume(); e.preventDefault(); return;
    }
    this.shift = e.shiftKey;
    if (this.specialSink) {
      const sk = specialKey(e.code);
      if (sk) { e.preventDefault(); if (!e.repeat) this.specialSink(sk, true); return; }
    }
    if (!this.enabled) return;
    if (e.code === 'KeyW' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (!e.repeat) { this.jumpDownT = e.timeStamp || performance.now(); this.pad.inject('jump', 2, false, this.jumpDownT); }
      return;
    }
    if (e.code === 'KeyS' || e.code === 'ArrowDown') { e.preventDefault(); this.crouchHeld = true; return; }
    if (e.code === 'KeyX' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) this.pad.inject('hold', -1, false, e.timeStamp || performance.now()); return; }
    const m = this.moveKey(e.code);
    if (m) { this.move[m] = true; e.preventDefault(); return; }
    const k = this.attackKey(e.code);
    if (k) {
      e.preventDefault();
      if (e.repeat) return;
      this.held[k] = true;
      if (this.pendingSince < 0) this.pendingSince = e.timeStamp || performance.now();
      return;
    }
    if (e.code === 'KeyF') { e.preventDefault(); if (!e.repeat) this.pad.inject('tap', -1, true, e.timeStamp || performance.now()); return; }
    if (e.code === 'Space') {
      e.preventDefault();
      // Space = tap (jump by default); Shift+Space = dodge & parry.
      if (!e.repeat) this.pad.inject('tap', -1, e.shiftKey, e.timeStamp || performance.now());
    }
  }

  private up(e: KeyboardEvent): void {
    this.shift = e.shiftKey;
    if (this.specialSink) { const sk = specialKey(e.code); if (sk) { this.specialSink(sk, false); return; } }
    if (e.code === 'KeyW' || e.code === 'ArrowUp') { this.jumpDownT = -1; return; }
    if (e.code === 'KeyS' || e.code === 'ArrowDown') { this.crouchHeld = false; return; }
    const m = this.moveKey(e.code);
    if (m) { this.move[m] = false; return; }
    const k = this.attackKey(e.code);
    if (k) {
      if (this.pendingSince >= 0) this.fire(); // released before the chord window closed
      this.held[k] = false;
    }
  }

  /** Resolve a pending attack chord once the chord window has elapsed. */
  poll(now: number): void {
    if (this.pendingSince >= 0 && now - this.pendingSince >= INPUT.keyChordMs) this.fire();
  }

  private fire(): void {
    const t0 = this.pendingSince;
    this.pendingSince = -1;
    const h = this.held;
    const dx = (h.right ? 1 : 0) - (h.left ? 1 : 0);
    const dy = (h.down ? 1 : 0) - (h.up ? 1 : 0);
    if (dx === 0 && dy === 0) return;
    this.pad.inject('swipe', classifyDir(dx, dy), this.shift, t0);
  }
}

function specialKey(code: string): 'up' | 'down' | 'left' | 'right' | 'tap' | null {
  switch (code) {
    case 'ArrowUp': case 'KeyW': case 'KeyI': return 'up';
    case 'ArrowDown': case 'KeyS': case 'KeyK': return 'down';
    case 'ArrowLeft': case 'KeyA': case 'KeyJ': return 'left';
    case 'ArrowRight': case 'KeyD': case 'KeyL': return 'right';
    case 'Space': case 'Enter': case 'KeyX': return 'tap';
  }
  return null;
}
