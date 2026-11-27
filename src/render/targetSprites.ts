import type { Fighter } from '../sim/fighter';
import { WORLD } from '../data/tuning';

/**
 * Training-room targets drawn by the player (the Dummy and the Punching Bag): a trimmed, transparent
 * sprite per target. Visual only: hit detection stays on the dummy's rig. The Pixel look snaps the sprite to
 * ink and paper like everything else. Pixel (ink page) look only: the neon look keeps the stick figure.
 */
const URLS = import.meta.glob('../assets/targets/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export type TargetSprite = '' | 'dummy' | 'bag';
interface Sheet { img: HTMLImageElement; ready: boolean }
const sheets: Record<string, Sheet> = {};
for (const [path, url] of Object.entries(URLS)) {
  const name = path.replace(/^.*\//, '').replace(/\.png$/, '');
  const img = new Image();
  const sh: Sheet = { img, ready: false };
  img.onload = () => { sh.ready = true; };
  img.src = url;
  sheets[name] = sh;
}
export const hasTargetSprite = (id: TargetSprite): boolean => !!sheets[id];

/** Sprite height in world units (the standing dummy; the bag hangs from a rope above the floor). */
const HEIGHT: Record<string, number> = { dummy: 175, bag: 175 };
const BAG_LIFT = 14;

/** Draw a target sprite for fighter `f`; returns false when it has none (or it has not loaded), so the caller draws the stick figure. */
export function drawTargetSprite(ctx: CanvasRenderingContext2D, f: Fighter, alpha: number, time: number): boolean {
  const id = f.sprite;
  if (!id) return false;
  const sh = sheets[id];
  if (!sh || !sh.ready) return false;
  const src = sh.img;
  const x = f.px + (f.x - f.px) * alpha, y = f.py + (f.y - f.py) * alpha;
  const H = HEIGHT[id] ?? 175, W = H * sh.img.naturalWidth / sh.img.naturalHeight;
  ctx.save();
  if (f.flash > 0) ctx.translate((Math.sin(time * 90) * 3), 0); // a hit shakes it
  if (id === 'bag') {
    // hangs by its rope: swings about the top
    const topY = WORLD.groundY - BAG_LIFT - H;
    ctx.translate(x, topY);
    ctx.rotate(f.spriteAng);
    ctx.drawImage(src, -W / 2, 0, W, H);
  } else {
    // stands on its base: leans, tumbles about the feet, lies flat when knocked down
    ctx.translate(x, y);
    let ang = f.spriteAng + (f.grounded ? 0 : f.spinAngle);
    if (f.state === 'knockdown' || f.state === 'ko' || f.state === 'dead') ang = (f.hitDirX || -f.facing || 1) * Math.PI / 2;
    ctx.rotate(ang);
    ctx.drawImage(src, -W / 2, -H, W, H);
  }
  ctx.restore();
  return true;
}
