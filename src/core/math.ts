// Small, allocation-free math helpers.

export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function invLerp(a: number, b: number, v: number): number {
  return b === a ? 0 : clamp((v - a) / (b - a), 0, 1);
}
/** Frame-rate independent exponential smoothing factor. */
export function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}
export function sign(v: number): number {
  return v < 0 ? -1 : 1;
}
export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
export function angleDiff(a: number, b: number): number {
  return Math.abs(wrapAngle(a - b));
}
export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---- Easing ----
export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => t * (2 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  outCubic: (t: number) => { const u = t - 1; return u * u * u + 1; },
  inCubic: (t: number) => t * t * t,
  outQuart: (t: number) => { const u = t - 1; return 1 - u * u * u * u; },
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  /** Overshoots then settles: the "snap" on strike frames. */
  outBack: (t: number) => { const c1 = 2.2, c3 = c1 + 1; const u = t - 1; return 1 + c3 * u * u * u + c1 * u * u; },
  outElastic: (t: number) => {
    if (t <= 0) return 0; if (t >= 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1;
  },
} as const;
export type EaseName = keyof typeof ease;
