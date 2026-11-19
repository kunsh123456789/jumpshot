import { PAD, WORLD } from '../data/tuning';
import { settings } from './settings';

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * Screen layout in CSS pixels. The world is a fixed 1280x720 logical view
 * scaled to fit `world` (letterboxed). The pad is a separate rect; in
 * landscape it overlays the floor area below the ground line, in portrait it
 * sits under the world view.
 */
export class Layout {
  cssW = 1; cssH = 1; dpr = 1;
  portrait = false;
  world: Rect = { x: 0, y: 0, w: 1, h: 1 };
  /** world units -> css px */
  scale = 1;
  /** Logical (1280x720) sub-rectangle actually shown in the world rect (portrait crops it). */
  viewX0 = 0; viewY0 = 0; viewW: number = WORLD.viewW; viewH: number = WORLD.viewH;
  pad: Rect = { x: 0, y: 0, w: 1, h: 1 };
  /** Scale factor for HUD/UI drawn in css px. */
  ui = 1;
  hudTop = 0;

  update(cssW: number, cssH: number, dpr: number): void {
    this.cssW = cssW; this.cssH = cssH; this.dpr = dpr;
    this.portrait = cssH > cssW * 1.05;
    const vw = WORLD.viewW, vh = WORLD.viewH;
    if (!this.portrait) {
      const s = Math.min(cssW / vw, cssH / vh);
      this.scale = s;
      this.viewX0 = 0; this.viewY0 = 0; this.viewW = vw; this.viewH = vh;
      this.world = { x: (cssW - vw * s) / 2, y: (cssH - vh * s) / 2, w: vw * s, h: vh * s };
      const ph = cssH * PAD.landscapeHeight;
      const pw = Math.min(cssW * PAD.landscapeWidth, ph * 2.6);
      const margin = Math.max(10, cssH * 0.02);
      const groundScreen = this.world.y + (WORLD.groundScreenY + 22) * s;
      const top = Math.max(groundScreen, cssH - ph - margin);
      const h = cssH - top - margin;
      let x = (cssW - pw) / 2;
      if (settings.leftHanded) x = Math.max(margin, cssW * 0.04);
      else x = Math.min(cssW - pw - margin, x + cssW * 0.12);
      this.pad = { x, y: top, w: pw, h: Math.max(80, h) };
      this.ui = Math.max(0.55, Math.min(1.3, Math.min(cssW / 1280, cssH / 720) * 1.05));
      this.hudTop = this.world.y;
    } else {
      // Portrait: world on top (full width, horizontally cropped so fighters stay
      // readable), pad below and large.
      const hudStrip = Math.min(64, cssH * 0.07);
      const cropW = PAD.portraitViewW;
      const s = cssW / cropW;
      this.scale = s;
      this.viewX0 = (vw - cropW) / 2;
      this.viewY0 = PAD.portraitViewTop;
      this.viewW = cropW;
      this.viewH = PAD.portraitViewBottom - PAD.portraitViewTop;
      this.world = { x: 0, y: hudStrip, w: cssW, h: this.viewH * s };
      const margin = 12;
      const floorTop = hudStrip + (WORLD.groundScreenY + 30 - this.viewY0) * s;
      const minPadH = cssH * PAD.portraitMinHeight;
      const top = Math.min(floorTop, cssH - minPadH - margin);
      this.pad = { x: margin, y: top, w: cssW - margin * 2, h: cssH - top - margin };
      this.ui = Math.max(0.55, Math.min(1, cssW / 640));
      this.hudTop = 0;
    }
  }

  inPad(x: number, y: number): boolean {
    const p = this.pad;
    return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
  }
}

export const layout = new Layout();
