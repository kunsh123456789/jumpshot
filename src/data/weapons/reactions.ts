import { drawn, type AnimDef } from '../anims/types';

/**
 * Enemy reactions to weapons (revision pass 7), shared by every enemy kind
 * (getAnim falls back to these). Thrown bodies reuse launched/tumble, whose
 * spin draws the rotating hatch smear; laser hits reuse the hurt reactions.
 */

/** Held by a grab: dangling, loose but authored: arms up, legs hanging, a little kick. */
export const held: AnimDef = drawn({
  id: 'held', base: 'air', loop: true,
  drawings: [
    { hold: 6, p: { lean: -0.2, head: 0.35, aU: 2.6, aL: 0.5, bU: 2.3, bL: 0.8, laU: 0.25, laL: -0.5, lbU: -0.15, lbL: -0.9, spin: 0 } },
    { hold: 6, p: { lean: -0.12, head: 0.28, aU: 2.75, aL: 0.35, bU: 2.1, bL: 1.0, laU: 0.05, laL: -0.9, lbU: 0.2, lbL: -0.4, spin: 0 } },
    { hold: 6, p: { lean: -0.24, head: 0.4, aU: 2.5, aL: 0.6, bU: 2.4, bL: 0.6, laU: 0.3, laL: -0.35, lbU: -0.25, lbL: -1.1, spin: 0 } },
  ],
});

/** Reeled in by the hook: pitched hard toward the player, arms flung back, feet dragging. */
export const pulled: AnimDef = drawn({
  id: 'pulled', base: 'ground', loop: true,
  drawings: [
    { hold: 4, p: { rootY: -14, lean: -0.75, head: 0.4, aU: -1.9, aL: 0.4, bU: -2.2, bL: 0.3, footA: -10, footB: -46, liftB: 10, flex: 8 } },
    { hold: 4, p: { rootY: -10, lean: -0.82, head: 0.45, aU: -2.1, aL: 0.25, bU: -1.95, bL: 0.5, footA: -20, footB: -40, liftA: 8, flex: 9 } },
  ],
});


/** Hero: a quick draw-weapon flourish after a between-wave swap. */
export const drawWeapon: AnimDef = drawn({
  id: 'drawWeapon',
  drawings: [
    { hold: 4, p: { rootY: -26, lean: 0.3, aU: -0.6, aL: 1.6, bU: -0.3, bL: 1.8, footA: 30, footB: -34, head: 0.1 } },
    { hold: 4, p: { rootY: -34, lean: 0.5, aU: 1.9, aL: 0.4, bU: 1.2, bL: 1.2, footA: 36, footB: -38, head: -0.2 }, smear: ['handA'] },
    { hold: 6, p: { rootY: -30, lean: 0.46, head: -0.22, aU: 1.3, aL: 1.6, bU: 0.55, bL: 2.15, footA: 34, footB: -38, flex: -4 } },
  ],
});

export const reactionAnims: AnimDef[] = [held, pulled, drawWeapon];
