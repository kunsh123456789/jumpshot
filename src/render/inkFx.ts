import type { World } from '../sim/world';

/**
 * Hand-drawn FX for the ink look (filled in by revision 5 step 5): floor
 * damage, impact specks, splatter, scribble energy. Draw order: floor marks
 * under the figures, everything else over them.
 */
export class InkFx {
  bind(_w: World): void {}
  update(_dt: number): void {}
  clearFloor(): void {}
  drawFloor(_ctx: CanvasRenderingContext2D, _wpp: number): void {}
  drawFront(_ctx: CanvasRenderingContext2D, _wpp: number): void {}
}
export const inkFx = new InkFx();
