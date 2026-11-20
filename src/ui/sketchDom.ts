/**
 * Hand-drawn borders for DOM UI (revision pass 6). Watches #ui and gives every
 * panel, button, tile and card an SVG overlay with a wobbly pen rectangle
 * (four separate strokes with overshoot), seeded from the element's text and
 * size so it is stable between frames and re-generated only on resize.
 * Cards and tiles also get a red pen circle that shows on hover.
 */
const SEL = '.panel, .btn, .mtile, .card, .icon-btn';
const NS = 'http://www.w3.org/2000/svg';

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let s = seed | 0 || 1;
  return () => { s = (Math.imul(s, 1103515245) + 12345) | 0; return ((s >>> 8) & 0xffffff) / 16777216; };
}

/** Wobbly rectangle path in a (w+8) x (h+8) box (4 px margin). */
export function wobblyRectPath(w: number, h: number, seed: number, wob = 2): string {
  const r = rng(seed), j = (a: number) => (r() - 0.5) * 2 * a;
  const m = 4, o = Math.min(5, Math.min(w, h) * 0.06);
  const pts: [number, number][] = [[m, m], [m + w, m], [m + w, m + h], [m, m + h]];
  let d = '';
  for (let i = 0; i < 4; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % 4];
    const L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    const sx = x0 - ux * r() * o + j(wob * 0.5), sy = y0 - uy * r() * o + j(wob * 0.5);
    const ex = x1 + ux * r() * o + j(wob * 0.5), ey = y1 + uy * r() * o + j(wob * 0.5);
    const bow = j(wob) * Math.min(1, L / 80);
    d += `M${sx.toFixed(1)} ${sy.toFixed(1)}Q${((sx + ex) / 2 - uy * bow).toFixed(1)} ${((sy + ey) / 2 + ux * bow).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  }
  return d;
}

/** Loose pen ellipse that overshoots its start (hover circle). */
function wobblyEllipsePath(w: number, h: number, seed: number): string {
  const r = rng(seed);
  const cx = w / 2 + 4, cy = h / 2 + 4, rx = w / 2 + 6, ry = h / 2 + 8;
  const n = 22, a0 = r() * 6.28, sweep = 6.28 * 1.08;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = a0 + (sweep * i) / n, k = 1 + (r() - 0.5) * 0.04;
    const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
    d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  return d;
}

const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((entries) => { for (const e of entries) draw(e.target as HTMLElement); }) : null;

function draw(el: HTMLElement): void {
  const svg = el.querySelector(':scope > svg.sk') as SVGSVGElement | null;
  if (!svg) return;
  const w = el.offsetWidth, h = el.offsetHeight;
  if (w < 2 || h < 2) return;
  const seed = hash((el.textContent ?? '').slice(0, 40) + el.className) + Math.round(w / 8) * 31 + Math.round(h / 8);
  svg.setAttribute('viewBox', `0 0 ${w + 8} ${h + 8}`);
  const paths = svg.querySelectorAll('path');
  const isPanel = el.classList.contains('panel');
  paths[0].setAttribute('d', wobblyRectPath(w, h, seed, isPanel ? 3 : 2));
  if (paths[1]) paths[1].setAttribute('d', wobblyRectPath(w, h, seed ^ 0x5bd1e995, isPanel ? 4 : 2.5));
  const hov = el.querySelector(':scope > svg.sk-hover') as SVGSVGElement | null;
  if (hov) { hov.setAttribute('viewBox', `0 0 ${w + 8} ${h + 8}`); hov.querySelector('path')!.setAttribute('d', wobblyEllipsePath(w, h, seed ^ 77)); }
}

function decorate(el: HTMLElement): void {
  if (el.dataset.sk) return;
  el.dataset.sk = '1';
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sk');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('preserveAspectRatio', 'none');
  const p1 = document.createElementNS(NS, 'path');
  svg.appendChild(p1);
  if (el.classList.contains('panel')) {
    // a second, lighter pass: drawn twice with a pen
    const p2 = document.createElementNS(NS, 'path');
    p2.setAttribute('style', 'stroke-width:1;opacity:.55');
    svg.appendChild(p2);
  }
  el.insertBefore(svg, el.firstChild);
  if (el.classList.contains('card') || el.classList.contains('mtile')) {
    const hov = document.createElementNS(NS, 'svg');
    hov.setAttribute('class', 'sk sk-hover');
    hov.setAttribute('aria-hidden', 'true');
    hov.setAttribute('preserveAspectRatio', 'none');
    hov.appendChild(document.createElementNS(NS, 'path'));
    el.insertBefore(hov, el.firstChild);
  }
  draw(el);
  ro?.observe(el);
}

/** Start decorating everything that appears under #ui. */
export function initSketchDom(): void {
  const root = document.getElementById('ui');
  if (!root) return;
  const scan = (n: ParentNode) => {
    if (n instanceof HTMLElement && n.matches(SEL)) decorate(n);
    n.querySelectorAll?.(SEL).forEach((e) => decorate(e as HTMLElement));
  };
  scan(root);
  new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach((n) => { if (n instanceof HTMLElement) scan(n); });
  }).observe(root, { childList: true, subtree: true });
  // fonts change text metrics: redraw once they load
  document.fonts?.ready.then(() => root.querySelectorAll(SEL).forEach((e) => draw(e as HTMLElement)));
}
