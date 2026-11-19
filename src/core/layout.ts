import { PAD, WORLD } from '../data/tuning';
import { settings } from './settings';

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * Screen layout in CSS pixels. The world is a fixed 1280x720 logical view
 * scaled to fit `world` (letterboxed in landscape, horizontally cropped in
 * portrait). The pad is the full-width bottom band of the screen (settings
 * fraction, default 50%), transparent, drawn over the world.
 */
export class Layout {
  cssW = 1; cssH = 1; dpr = 1;
  portrait = false;
  world: Rect = { x: 0, y: 0, w: 1, h: 1 };
  /** world units -> css px */
  scale = 1;
  /** Logical (1280x720) sub-rectangle actually shown in the world rect. */
  viewX0 = 0; viewY0 = 0; viewW: number = WORLD.viewW; viewH: number = WORLD.viewH;
  pad: Rect = { x: 0, y: 0, w: 1, h: 1 };
  /** Safe-area insets (notches, home bars), css px. */
  safe = { top: 0, right: 0, bottom: 0, left: 0 };
  /** Scale factor for HUD/UI drawn in css px. */
  ui = 1;
  private probe: HTMLDivElement | null = null;

  private readSafe(): void {
    if (typeof document === 'undefined') return;
    if (!this.probe) {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
        'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      document.body.appendChild(d);
      this.probe = d;
    }
    const cs = getComputedStyle(this.probe);
    this.safe.top = parseFloat(cs.paddingTop) || 0;
    this.safe.right = parseFloat(cs.paddingRight) || 0;
    this.safe.bottom = parseFloat(cs.paddingBottom) || 0;
    this.safe.left = parseFloat(cs.paddingLeft) || 0;
  }

  update(cssW: number, cssH: number, dpr: number): void {
    this.cssW = cssW; this.cssH = cssH; this.dpr = dpr;
    this.readSafe();
    this.portrait = cssH > cssW * 1.05;
    const vw = WORLD.viewW, vh = WORLD.viewH;
    if (!this.portrait) {
      const s = Math.min(cssW / vw, cssH / vh);
      this.scale = s;
      this.viewX0 = 0; this.viewY0 = 0; this.viewW = vw; this.viewH = vh;
      this.world = { x: (cssW - vw * s) / 2, y: (cssH - vh * s) / 2, w: vw * s, h: vh * s };
      this.ui = Math.max(0.55, Math.min(1.3, Math.min(cssW / 1280, cssH / 720) * 1.05));
    } else {
      // Portrait: full-width, horizontally cropped view that runs down behind the pad.
      const hudStrip = Math.max(this.safe.top, 0) + Math.min(56, cssH * 0.065);
      const cropW = PAD.portraitViewW;
      const s = cssW / cropW;
      this.scale = s;
      this.viewX0 = (vw - cropW) / 2;
      this.viewY0 = PAD.portraitViewTop;
      this.viewW = cropW;
      this.viewH = (cssH - hudStrip) / s;
      this.world = { x: 0, y: hudStrip, w: cssW, h: cssH - hudStrip };
      this.ui = Math.max(0.55, Math.min(1, cssW / 640));
    }
    // Pad: the full-width bottom band, clear of the home bar / side insets.
    const frac = Math.min(PAD.regionMax, Math.max(PAD.regionMin, settings.padRegion));
    const top = cssH * (1 - frac);
    this.pad = {
      x: this.safe.left,
      y: top,
      w: cssW - this.safe.left - this.safe.right,
      h: cssH - top - this.safe.bottom,
    };
  }

  inPad(x: number, y: number): boolean {
    const p = this.pad;
    return y >= p.y && y <= p.y + p.h && x >= p.x && x <= p.x + p.w;
  }
}

export const layout = new Layout();
