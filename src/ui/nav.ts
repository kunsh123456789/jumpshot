import { audio } from '../core/audio';
import { classifyDir, type DrawPad } from './pad';

/**
 * Keyboard + gamepad navigation for the Arcade UI (revision pass 8 UI), and
 * gamepad gameplay controls.
 *
 * Menus: whenever a modal layer (or the title) is open, arrow keys / the
 * d-pad / the left stick move focus spatially between its buttons and
 * controls; Enter / Space / A activates; Escape / B presses the layer's
 * [data-back] button. Sliders and selects take Left / Right. The focused
 * element also gets a `.focus` class, so the focus ring shows for gamepads
 * too (no key events, so :focus-visible alone would not).
 *
 * Gameplay (gamepad, standard mapping): left stick / d-pad moves, X attacks
 * toward the stick (Y = heavy), A jumps, B / LB dodge, RT / RB Special,
 * Start pauses.
 */
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled])';

export class UiNav {
  private root = document.getElementById('ui')!;
  private focused: HTMLElement | null = null;
  private prevButtons: boolean[] = [];
  private stickT = 0;
  private stickDir = '';
  /** Gamepad movement axis for gameplay (-1..1). */
  moveX = 0;
  /** Gamepad is driving the game this frame. */
  padActive = false;
  /** Called by Start (pause toggle) and for the pad's Special etc. */
  onPause: () => void = () => {};

  constructor(private pad: DrawPad, private playing: () => boolean) {
    window.addEventListener('keydown', (e) => this.key(e), { capture: true });
    // Mouse / touch focus: drop the gamepad focus ring.
    window.addEventListener('pointerdown', () => this.setFocus(null, false), { capture: true });
  }

  /** The top-most interactive layer, or null when the game is being played. */
  private top(): HTMLElement | null {
    const layers = [...this.root.querySelectorAll<HTMLElement>(':scope > .layer')];
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (l.classList.contains('dim') || l.dataset.id === 'title' || l.dataset.id === 'rhythm-calib') return l;
    }
    return null;
  }
  private items(layer: HTMLElement): HTMLElement[] {
    return [...layer.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((e) => e.offsetParent !== null && e.getClientRects().length > 0);
  }

  private setFocus(e: HTMLElement | null, sound = true): void {
    if (this.focused === e) return;
    this.focused?.classList.remove('focus');
    this.focused = e;
    if (e) {
      e.classList.add('focus');
      e.focus({ preventScroll: true });
      e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (sound) audio.ui('move');
    }
  }

  /** Move focus toward a direction (spatial: nearest along the axis, penalising sideways offset). */
  move(dir: 'up' | 'down' | 'left' | 'right'): void {
    const layer = this.top();
    if (!layer) return;
    const list = this.items(layer);
    if (!list.length) return;
    const cur = this.focused && list.includes(this.focused) ? this.focused : null;
    if (!cur) { this.setFocus(layer.querySelector<HTMLElement>('.primary:not([disabled])') ?? list[0]); return; }
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best: HTMLElement | null = null, bs = Infinity;
    for (const e of list) {
      if (e === cur) continue;
      const b = e.getBoundingClientRect();
      const dx = b.left + b.width / 2 - ax, dy = b.top + b.height / 2 - ay;
      const along = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
      const side = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
      if (along <= 4) continue;
      const s = along + side * 2.2;
      if (s < bs) { bs = s; best = e; }
    }
    if (best) this.setFocus(best);
  }

  private activate(): void {
    const layer = this.top();
    if (!layer) return;
    const e = this.focused && layer.contains(this.focused) ? this.focused : null;
    if (!e) { this.move('down'); return; }
    if (e instanceof HTMLInputElement && e.type === 'checkbox') { e.checked = !e.checked; e.dispatchEvent(new Event('change', { bubbles: true })); return; }
    if (e instanceof HTMLInputElement && e.type === 'text') { e.focus(); return; }
    e.click();
  }
  private back(): boolean {
    const layer = this.top();
    const b = layer?.querySelector<HTMLElement>('[data-back]');
    if (b) { b.click(); return true; }
    return false;
  }
  /** Sliders and selects take Left / Right. Returns true if handled. */
  private adjust(dir: number): boolean {
    const e = this.focused;
    if (e instanceof HTMLInputElement && e.type === 'range') {
      const step = parseFloat(e.step) || 1;
      e.value = String(Math.min(parseFloat(e.max), Math.max(parseFloat(e.min), parseFloat(e.value) + dir * step)));
      e.dispatchEvent(new Event('input', { bubbles: true }));
      audio.ui('move');
      return true;
    }
    if (e instanceof HTMLSelectElement) {
      e.selectedIndex = (e.selectedIndex + dir + e.options.length) % e.options.length;
      e.dispatchEvent(new Event('change', { bubbles: true }));
      audio.ui('move');
      return true;
    }
    return false;
  }

  private key(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;
    const layer = this.top();
    if (!layer) return;
    const title = layer.dataset.id === 'title';
    const k = e.code;
    const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    // On the title, Space / WASD / IJKL still start the game through the pad; arrows and Enter navigate.
    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight' || (k === 'Tab' && !title)) {
      const dir = k === 'ArrowUp' ? 'up' : k === 'ArrowDown' ? 'down' : k === 'ArrowLeft' ? 'left' : k === 'ArrowRight' ? 'right' : e.shiftKey ? 'up' : 'down';
      if ((dir === 'left' || dir === 'right') && this.adjust(dir === 'left' ? -1 : 1)) { stop(); return; }
      this.move(dir as 'up' | 'down' | 'left' | 'right');
      stop();
    } else if (k === 'Enter' || (k === 'Space' && !title && this.focused)) {
      if (this.focused || !title) { this.activate(); stop(); }
    } else if (k === 'Escape' && !title) {
      if (this.back()) stop();
    }
  }

  /** Per frame: gamepad polling (menus, or gameplay when no menu is open). */
  update(dt: number): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp: Gamepad | null = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    this.moveX = 0;
    this.padActive = false;
    if (!gp) return;
    const btn = (i: number) => !!gp!.buttons[i] && (gp!.buttons[i].pressed || gp!.buttons[i].value > 0.5);
    const pressed = (i: number) => btn(i) && !this.prevButtons[i];
    const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
    const layer = this.top();
    if (pressed(9)) this.onPause();
    if (layer) {
      // menu navigation: d-pad / stick with auto-repeat, A confirm, B back, bumpers adjust
      let d = btn(12) ? 'up' : btn(13) ? 'down' : btn(14) ? 'left' : btn(15) ? 'right' : '';
      if (!d && Math.hypot(ax, ay) > 0.55) d = Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 'left' : 'right') : (ay < 0 ? 'up' : 'down');
      if (d) {
        this.stickT -= dt;
        if (d !== this.stickDir || this.stickT <= 0) {
          if ((d === 'left' || d === 'right') && this.adjust(d === 'left' ? -1 : 1)) { /* adjusted */ } else this.move(d as 'up');
          this.stickT = d !== this.stickDir ? 0.32 : 0.11;
        }
      }
      this.stickDir = d;
      if (pressed(0)) this.activate();
      if (pressed(1)) this.back();
    } else if (this.playing()) {
      // gameplay
      const dz = 0.25;
      const sx = Math.abs(ax) > dz ? ax : btn(14) ? -1 : btn(15) ? 1 : 0;
      const sy = Math.abs(ay) > dz ? ay : btn(12) ? -1 : btn(13) ? 1 : 0;
      this.moveX = Math.abs(sy) > 0.7 ? 0 : sx;
      this.padActive = sx !== 0 || sy !== 0;
      const dir = Math.hypot(sx, sy) > 0.4 ? classifyDir(sx, sy) : -1;
      const t = performance.now();
      if (pressed(2)) this.pad.inject('swipe', dir < 0 ? this.forward() : dir, false, t);
      if (pressed(3)) this.pad.inject('swipe', dir < 0 ? this.forward() : dir, true, t);
      if (pressed(0)) this.pad.inject('jump', 2, false, t);
      if (pressed(1) || pressed(4)) this.pad.inject('tap', -1, true, t);
      if (pressed(7) || pressed(5)) this.pad.inject('hold', -1, false, t);
    }
    this.prevButtons = gp.buttons.map((b) => b.pressed || b.value > 0.5);
  }
  /** Facing direction for a neutral-stick attack (set by the game each frame). */
  facing = 1;
  private forward(): number { return this.facing > 0 ? 0 : 4; }
}
