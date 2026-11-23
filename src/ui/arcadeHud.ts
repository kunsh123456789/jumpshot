import type { World } from '../sim/world';
import type { FxDirector } from '../render/fx';
import { CINE, STYLE } from '../data/tuning';
import { SPECIAL } from '../data/special';
import { effects } from '../render/effects';
import { icon } from './icons';

/**
 * The Arcade Fighter HUD (revision pass 8, UI): a DOM layer over the canvas, so
 * text is crisp and styling lives in the design system (style.css). Built once;
 * update() writes only what changed (cached), so it costs a handful of style
 * writes per frame. In-world pops (damage numbers, rhythm judgments) stay on
 * the canvas. Layout: health + weapon top-left, Special Bar top-centre (the
 * fighting game's round-timer slot), score + wave top-right next to pause,
 * combo + rank under the health; the bottom half is the pad and stays clear.
 */

/** Viewport-based UI scale shared by the DOM UI (--u) and the canvas HUD parts. */
export function computeUiScale(): number {
  const w = window.innerWidth, h = window.innerHeight;
  return Math.max(0.6, Math.min(1.2, Math.min(w / 1280, h / 720)));
}
let uiScale = 1;
export function getUiScale(): number { return uiScale; }
export function applyUiScale(): void {
  uiScale = computeUiScale();
  document.documentElement.style.setProperty('--u', uiScale.toFixed(3));
}

type El = HTMLElement;
const q = (root: El, sel: string) => root.querySelector(sel) as El;

export class ArcadeHud {
  readonly el: El;
  private hurt: El;
  visible = false;
  waveLabel = '';
  private cache = new Map<string, string>();
  private shownScore = 0;
  private hpLag = 1;
  private bossLag = 1;
  private weapon = '';
  private popEls = new Map<object, El>();
  private cardShown = false;
  private lastPop = 0;
  private lastSlam = 0;
  private specialState = '';
  private hitsShown = 0;

  constructor(root: El) {
    applyUiScale();
    window.addEventListener('resize', applyUiScale);
    this.hurt = document.createElement('div');
    this.hurt.className = 'hurt';
    root.prepend(this.hurt);
    const el = document.createElement('div');
    el.className = 'hud';
    el.hidden = true;
    el.innerHTML = `
      <div class="tl">
        <div class="portrait" data-k="portrait"></div>
        <div class="hpbar"><i class="lag"></i><i class="fill"></i><div class="shine"></div></div>
        <div class="hptag"><span class="chip"><span><b>P1</b><span data-k="hp">100 / 100</span></span></span><span class="chip" data-k="weapon"></span></div>
        <div class="heat" hidden><span class="chip"><span data-k="heatlbl">HEAT</span></span><div class="bar"><i></i></div></div>
      </div>
      <div class="sp"><div class="flame"></div><div class="bar"></div><div class="t" data-k="sptxt">SPECIAL</div></div>
      <div class="plate tr"><div class="in"><div class="score" data-k="score">0</div><div class="wave" data-k="wave"></div></div></div>
      <div class="boss" hidden><div class="bar"><i class="lag"></i><i class="fill"></i></div><span class="chip nm"><span data-k="bossnm"></span></span></div>
      <div class="combo" hidden>
        <div class="cl"><span class="n" data-k="hits">0</span><span class="h">HITS</span>
          <span class="chip d"><span data-k="dmg">DAMAGE 100%</span></span>
          <span class="chip hint2" hidden><span>↓ AIR FINISHER!</span></span></div>
        <div class="rankwrap" style="position:relative;margin-left:calc(var(--u)*30px);margin-top:calc(var(--u)*-4px)"><div class="rank" data-k="rank" style="position:static">D</div><div class="rankbar"><i></i></div></div>
      </div>
      <div class="card" hidden></div>
      <div class="crit" hidden><span class="banner-band"><span>CRIT READY</span></span></div>
      <div class="pops"></div>`;
    root.prepend(el);
    this.el = el;
    const combo = q(el, '.combo');
    combo.style.display = 'flex';
    combo.style.alignItems = 'flex-start';
    q(el, '.hint2').style.position = 'static';
  }

  private set(key: string, val: string, apply: (v: string) => void): void {
    if (this.cache.get(key) === val) return;
    this.cache.set(key, val);
    apply(val);
  }
  private restart(e: El, cls: string): void { e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); }

  update(w: World, fx: FxDirector, dt: number): void {
    // Hurt vignette (always, even with the HUD hidden).
    const hv = Math.min(1, effects.hurtVignette);
    this.set('hurt', hv.toFixed(2), (v) => { this.hurt.style.opacity = v; });
    this.set('vis', String(this.visible), (v) => { this.el.hidden = v !== 'true'; });
    if (!this.visible) return;
    const el = this.el, p = w.player, c = w.combo, sp = w.special;
    // Special input phases: the combo block and pop-ups step aside for the trace / QTE overlay.
    this.set('spmode', String(sp.phase === 'intro' || sp.phase === 'input'), (v) => { el.classList.toggle('spmode', v === 'true'); });

    // ---- health ----
    const hpF = Math.max(0, p.hp / p.maxHp);
    this.hpLag += (hpF - this.hpLag) * Math.min(1, dt * (hpF < this.hpLag ? 2.5 : 12));
    this.set('hpw', hpF.toFixed(3), (v) => { q(el, '.hpbar .fill').style.width = (+v * 100) + '%'; });
    this.set('hpl', this.hpLag.toFixed(3), (v) => { q(el, '.hpbar .lag').style.width = (+v * 100) + '%'; });
    this.set('hplow', String(hpF < 0.3), (v) => { q(el, '.hpbar .fill').classList.toggle('low', v === 'true'); });
    this.set('hpt', `${Math.ceil(p.hp)} / ${p.maxHp}`, (v) => { q(el, '[data-k=hp]').textContent = v; });
    // ---- weapon + heat ----
    if (this.weapon !== w.weapon.id) {
      this.weapon = w.weapon.id;
      q(el, '[data-k=portrait]').innerHTML = icon(w.weapon.id);
      q(el, '[data-k=weapon]').innerHTML = `<span>${icon(w.weapon.id)}${w.weapon.name}</span>`;
    }
    const heat = w.weapon.heat;
    this.set('heatOn', String(!!heat), (v) => { q(el, '.heat').hidden = v !== 'true'; });
    if (heat) {
      const over = w.wpn.overheat > 0;
      const f = over ? w.wpn.overheat / Math.max(1, heat.overheatSec * 60) : w.wpn.heat;
      this.set('heatF', f.toFixed(2), (v) => { q(el, '.heat .bar i').style.width = (+v * 100) + '%'; });
      this.set('heatHot', String(over), (v) => { q(el, '.heat').classList.toggle('hot', v === 'true'); q(el, '[data-k=heatlbl]').textContent = v === 'true' ? 'OVERHEAT!' : 'HEAT'; });
    }
    // ---- score + wave ----
    this.shownScore += (c.score - this.shownScore) * Math.min(1, dt * 10);
    if (Math.abs(c.score - this.shownScore) < 1) this.shownScore = c.score;
    this.set('score', Math.round(this.shownScore).toLocaleString(), (v) => { q(el, '[data-k=score]').textContent = v; });
    this.set('wave', `${this.waveLabel} · KO ${c.totalKOs}`, (v) => { q(el, '[data-k=wave]').textContent = v; });
    // ---- special bar ----
    const segs = SPECIAL.segments;
    this.set('segs', String(segs), (v) => { q(el, '.sp .bar').innerHTML = Array.from({ length: +v }, () => '<div class="seg"><i></i></div>').join(''); });
    const st = sp.busy ? 'active' : sp.ready ? 'ready' : 'charging';
    const segEls = el.querySelectorAll<El>('.sp .seg i');
    for (let i = 0; i < segEls.length; i++) {
      const f = sp.busy ? 1 : Math.max(0, Math.min(1, (sp.charge - i * SPECIAL.full) / SPECIAL.full));
      this.set('seg' + i, f.toFixed(2), (v) => { segEls[i].style.width = (+v * 100) + '%'; });
    }
    if (st !== this.specialState) {
      const spEl = q(el, '.sp');
      spEl.classList.toggle('ready', st === 'ready');
      spEl.classList.toggle('active', st === 'active');
      if (st === 'ready') this.restart(spEl, 'flash');
      this.specialState = st;
    }
    this.set('sptxt', st === 'ready' ? 'SPECIAL READY · HOLD!' : st === 'active' ? 'SPECIAL!' : `SPECIAL ${Math.floor(Math.min(1, sp.charge / SPECIAL.full) * 100)}%`, (v) => { q(el, '[data-k=sptxt]').textContent = v; });
    // ---- boss ----
    let boss = null;
    for (const e of w.enemies) if (e.def?.hpBar && (e.alive || e.state === 'ko')) { boss = e; break; }
    this.set('bossOn', String(!!boss), (v) => { q(el, '.boss').hidden = v !== 'true'; });
    if (boss) {
      const f = Math.max(0, boss.hp / boss.maxHp);
      this.bossLag += (f - this.bossLag) * Math.min(1, dt * (f < this.bossLag ? 2 : 10));
      this.set('bossF', f.toFixed(3), (v) => { q(el, '.boss .fill').style.width = (+v * 100) + '%'; });
      this.set('bossL', this.bossLag.toFixed(3), (v) => { q(el, '.boss .lag').style.width = (+v * 100) + '%'; });
      this.set('bossN', boss.def!.name.toUpperCase() + (boss.def?.boss ? ` · PHASE ${boss.ai.phase}` : ''), (v) => { q(el, '[data-k=bossnm]').textContent = v; });
      this.set('bossFl', String(fx.bossBarFlash > 0), (v) => { q(el, '.boss').classList.toggle('flash', v === 'true'); });
    } else this.bossLag = 1;
    // ---- combo + rank ----
    const showCombo = c.hits > 1 || c.style > 0;
    const combo = q(el, '.combo');
    this.set('comboOn', String(showCombo), (v) => { combo.hidden = v !== 'true'; });
    if (showCombo) {
      const hitsVisible = c.hits > 1;
      this.set('hitsVis', String(hitsVisible), (v) => { q(el, '.cl').style.visibility = v === 'true' ? '' : 'hidden'; });
      if (c.hits !== this.hitsShown) { this.hitsShown = c.hits; q(el, '[data-k=hits]').textContent = String(c.hits); q(el, '[data-k=hits]').classList.toggle('hot', c.hits >= 30); }
      if (fx.comboPop > 0.9 && fx.comboPop !== this.lastPop) this.restart(combo, 'pop');
      this.lastPop = fx.comboPop;
      this.set('dmg', `DAMAGE ${Math.round(c.scale() * 100)}%`, (v) => { q(el, '[data-k=dmg]').textContent = v; });
      this.set('rank', String(c.rank), (v) => { const r = q(el, '[data-k=rank]'); r.textContent = STYLE.ranks[+v]; r.className = `rank r${v}`; });
      if (fx.rankSlam > 0.95 && fx.rankSlam !== this.lastSlam) this.restart(q(el, '[data-k=rank]'), 'slam');
      this.lastSlam = fx.rankSlam;
      this.set('rankF', c.rankFill().toFixed(2), (v) => { q(el, '.rankbar i').style.width = (+v * 100) + '%'; });
      const fin = !p.grounded && c.airJuggle >= CINE.airMinJuggle && !c.airFinisherUsed;
      this.set('fin', String(fin), (v) => { q(el, '.hint2').hidden = v !== 'true'; });
    }
    // ---- combo summary card ----
    const ce = fx.lastComboEnd;
    const card = q(el, '.card');
    if (ce && fx.comboEndT > 0) {
      if (!this.cardShown) {
        this.cardShown = true;
        card.className = 'card' + (ce.dropped ? ' dropped' : '');
        card.innerHTML = `<div class="h">${ce.hits} HIT COMBO</div><div class="s">${ce.damage} DMG · MAX RANK ${STYLE.ranks[ce.maxRank]}</div><div class="b">${ce.dropped ? 'COMBO BROKEN' : '+' + ce.bonus.toLocaleString() + ' STYLE'}</div>`;
        card.hidden = false;
      }
      if (fx.comboEndT < 0.3) card.classList.add('out');
    } else if (this.cardShown) { this.cardShown = false; card.hidden = true; }
    // ---- crit ----
    this.set('crit', String(p.critTimer > 0), (v) => { q(el, '.crit').hidden = v !== 'true'; });
    // ---- popups (PERFECT PARRY, finisher names, boss intros) ----
    const pops = q(el, '.pops');
    for (const pp of fx.popups) {
      let e = this.popEls.get(pp);
      if (!e) {
        e = document.createElement('div');
        e.className = 'pop' + (pp.big ? ' big' : '');
        const tone = pp.color === '#ff4040' || pp.color === '#e22424' ? ' red' : pp.color === '#ffe14a' ? ' cyan' : '';
        e.innerHTML = `<span class="banner-band${tone}"><span>${pp.text}</span></span>${pp.sub ? `<small>${pp.sub.toUpperCase()}</small>` : ''}`;
        pops.appendChild(e);
        this.popEls.set(pp, e);
      }
      if (pp.t / pp.life > 0.82) e.classList.add('out');
    }
    for (const [k, e] of this.popEls) if (!fx.popups.includes(k as never)) { e.remove(); this.popEls.delete(k); }
  }

  reset(): void {
    this.shownScore = 0; this.hpLag = 1; this.cache.clear(); this.weapon = ''; this.specialState = ''; this.hitsShown = -1;
    for (const e of this.popEls.values()) e.remove();
    this.popEls.clear();
    this.cardShown = false;
    q(this.el, '.card').hidden = true;
  }
}
