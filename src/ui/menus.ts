import { settings, saveSettings } from '../core/settings';
import { audio } from '../core/audio';
import type { UpgradeDef } from '../data/upgrades';
import { STYLE } from '../data/tuning';

/** DOM overlays for menus (title, pause, settings, upgrades, results, banners). */
export class Menus {
  private root: HTMLElement;
  private layers = new Map<string, HTMLElement>();
  pauseBtn: HTMLButtonElement;
  onPause: () => void = () => {};

  constructor() {
    this.root = document.getElementById('ui')!;
    this.pauseBtn = document.createElement('button');
    this.pauseBtn.className = 'icon-btn';
    this.pauseBtn.textContent = 'II';
    this.pauseBtn.setAttribute('aria-label', 'Pause');
    this.pauseBtn.style.display = 'none';
    this.pauseBtn.addEventListener('click', () => { audio.ui('click'); this.onPause(); });
    this.root.appendChild(this.pauseBtn);
    this.placePause();
    window.addEventListener('resize', () => this.placePause());
  }

  placePause(): void {
    const st = this.pauseBtn.style;
    // Always top-right: the HP bar owns the top-left corner in both handedness modes.
    st.right = 'max(10px, env(safe-area-inset-right))';
    st.left = '';
  }

  private layer(id: string, cls = 'layer'): HTMLElement {
    this.close(id);
    const el = document.createElement('div');
    el.className = cls;
    el.dataset.id = id;
    this.root.appendChild(el);
    this.layers.set(id, el);
    return el;
  }
  close(id: string): void {
    const el = this.layers.get(id);
    if (el) { el.remove(); this.layers.delete(id); }
  }
  isOpen(id: string): boolean { return this.layers.has(id); }

  private btn(parent: HTMLElement, label: string, onClick: () => void, cls = 'btn'): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); audio.ui('click'); onClick(); });
    parent.appendChild(b);
    return b;
  }

  // ---------------- Title ----------------
  showTitle(high: number, onSettings: () => void, mode: { rhythm: boolean; onToggle: (rhythm: boolean) => void } | null = null): void {
    const el = this.layer('title', 'layer passthrough');
    el.style.justifyContent = 'flex-start';
    el.style.paddingTop = '7vh';
    el.innerHTML = `<h1 class="title-logo">JUMPSHOT</h1><div class="subtitle">SWIPE · LAUNCH · JUGGLE · SPIKE</div>`;
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    el.appendChild(spacer);
    const pr = document.createElement('div');
    pr.className = 'prompt';
    pr.textContent = 'TAP OR FLICK THE LOWER HALF TO START';
    pr.style.marginBottom = '2vh';
    el.appendChild(pr);
    const row = document.createElement('div');
    row.style.position = 'absolute'; row.style.top = '12px'; row.style.left = '12px';
    row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '10px';
    this.btn(row, '⚙ SETTINGS', onSettings, 'btn small');
    if (mode) {
      // Rhythm / Classic switch.
      const tg = document.createElement('div');
      tg.className = 'mode-toggle';
      tg.setAttribute('role', 'group');
      tg.setAttribute('aria-label', 'Game mode');
      const mk = (label: string, rhythm: boolean) => {
        const b = document.createElement('button');
        b.innerHTML = label.replace(' MODE', '<span class="mt-full"> MODE</span>');
        b.id = rhythm ? 'mode-rhythm' : 'mode-classic';
        b.className = mode.rhythm === rhythm ? 'on' : '';
        b.setAttribute('aria-pressed', String(mode.rhythm === rhythm));
        b.addEventListener('click', (e) => {
          e.stopPropagation(); audio.unlock(); audio.ui('click');
          mode.rhythm = rhythm;
          for (const x of tg.querySelectorAll('button')) { const on = x === b; x.className = on ? 'on' : ''; x.setAttribute('aria-pressed', String(on)); }
          mode.onToggle(rhythm);
        });
        tg.appendChild(b);
      };
      mk('♪ RHYTHM MODE', true);
      mk('⚔ CLASSIC MODE', false);
      row.appendChild(tg);
    }
    if (high > 0) {
      const hs = document.createElement('div');
      hs.style.fontWeight = '900'; hs.style.fontStyle = 'italic'; hs.style.opacity = '0.8';
      hs.textContent = `BEST ${high.toLocaleString()}`;
      row.appendChild(hs);
    }
    el.appendChild(row);
    // keep the prompt above the pad
    const padTop = (window as unknown as { __padTop?: number }).__padTop;
    if (padTop) { pr.style.position = 'absolute'; pr.style.top = (padTop + 18) + 'px'; pr.style.marginBottom = '0'; }
  }

  // ---------------- Pause ----------------
  showPause(onResume: () => void, onSettings: () => void, onRestart: () => void, onQuit: () => void): void {
    const el = this.layer('pause', 'layer dim');
    const p = document.createElement('div');
    p.className = 'panel';
    p.innerHTML = '<h2>PAUSED</h2>';
    this.btn(p, 'RESUME', onResume, 'btn primary');
    p.appendChild(document.createElement('br'));
    this.btn(p, 'SETTINGS', onSettings);
    p.appendChild(document.createElement('br'));
    this.btn(p, 'RESTART RUN', onRestart);
    p.appendChild(document.createElement('br'));
    this.btn(p, 'QUIT TO TITLE', onQuit);
    const h = document.createElement('div');
    h.className = 'hint';
    h.innerHTML = 'Lower half of the screen: drag slowly = move · flick = attack in that direction · long fast flick = HEAVY<br>Flick ↑ = JUMPSHOT launcher · flick ↓ in air = SPIKE · tap = dodge / parry<br>Keyboard: A/D or ←/→ move · I/J/K/L attack (+Shift heavy) · Space = tap · ` = debug';
    p.appendChild(h);
    el.appendChild(p);
  }

  // ---------------- Settings ----------------
  showSettings(onClose: () => void, onTutorial: (() => void) | null, onCalibrate: (() => void) | null = null): void {
    const el = this.layer('settings', 'layer dim');
    const p = document.createElement('div');
    p.className = 'panel';
    p.innerHTML = '<h2>SETTINGS</h2>';
    const slider = (label: string, key: 'masterVolume' | 'musicVolume' | 'shake' | 'hitstop' | 'sensitivity' | 'padRegion', min: number, max: number, step: number, after?: () => void) => {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span');
      const fmt = () => `${label}: ${Math.round(settings[key] * 100)}%`;
      span.textContent = fmt();
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = String(min); inp.max = String(max); inp.step = String(step);
      inp.value = String(settings[key]);
      inp.id = 'set-' + key;
      inp.addEventListener('input', () => { settings[key] = parseFloat(inp.value); span.textContent = fmt(); audio.applyVolume(); saveSettings(); after?.(); });
      row.appendChild(span); row.appendChild(inp);
      p.appendChild(row);
    };
    const check = (label: string, key: 'leftHanded' | 'debug' | 'reduceFlashes' | 'rhythmMode' | 'beatHud', after?: () => void) => {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span');
      span.textContent = label;
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.checked = settings[key];
      inp.addEventListener('change', () => { settings[key] = inp.checked; saveSettings(); after?.(); });
      row.appendChild(span); row.appendChild(inp);
      p.appendChild(row);
    };
    // ---- Look & animation (revision pass 5) ----
    const select = (label: string, id: string, opts: [string, string][], get: () => string, set: (v: string) => void) => {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span'); span.textContent = label;
      const sel = document.createElement('select'); sel.id = id;
      sel.style.cssText = 'font:inherit;font-weight:800;background:#141a30;color:#fff;border:1px solid rgba(160,220,255,.4);border-radius:8px;padding:4px 6px';
      for (const [v, t] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); }
      sel.value = get();
      sel.addEventListener('change', () => { set(sel.value); saveSettings(); window.dispatchEvent(new Event('jumpshot-look')); });
      row.appendChild(span); row.appendChild(sel);
      p.appendChild(row);
    };
    select('Animation style', 'set-animStyle', [['drawn', 'Hand-Drawn (stepped)'], ['smooth', 'Smooth (interpolated)']], () => settings.animStyle, (v) => { settings.animStyle = v as 'drawn' | 'smooth'; });
    {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span');
      const fmt = () => `Hand-Drawn step rate: ${settings.stepRate} fps`;
      span.textContent = fmt();
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = '8'; inp.max = '20'; inp.step = '1'; inp.value = String(settings.stepRate); inp.id = 'set-stepRate';
      inp.addEventListener('input', () => { settings.stepRate = parseInt(inp.value, 10); span.textContent = fmt(); saveSettings(); });
      row.appendChild(span); row.appendChild(inp);
      p.appendChild(row);
    }
    select('Attack smoothness (Hand-Drawn)', 'set-attackSmooth', [['low', 'Low (key drawings only)'], ['normal', 'Normal (+1 in-between)'], ['high', 'High (+2, strikes on ones)']], () => settings.attackSmooth, (v) => { settings.attackSmooth = v as 'low' | 'normal' | 'high'; });
    select('Look', 'set-look', [['pixel', 'Pixel (ink page, 1-bit)'], ['crisp', 'Crisp (ink page, full res)'], ['smooth', 'Smooth (previous neon look)']], () => settings.look, (v) => { settings.look = v as 'pixel' | 'crisp' | 'smooth'; });
    {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span');
      const fmt = () => `Pixel Look resolution: ${Math.round(settings.pixelRes * 100)}%`;
      span.textContent = fmt();
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = '0.3'; inp.max = '0.55'; inp.step = '0.025'; inp.value = String(settings.pixelRes); inp.id = 'set-pixelRes';
      inp.addEventListener('input', () => { settings.pixelRes = parseFloat(inp.value); span.textContent = fmt(); saveSettings(); window.dispatchEvent(new Event('jumpshot-look')); });
      row.appendChild(span); row.appendChild(inp);
      p.appendChild(row);
    }
    slider('Master volume', 'masterVolume', 0, 1, 0.05);
    slider('Music volume', 'musicVolume', 0, 1, 0.05);
    slider('Screen shake', 'shake', 0, 1.5, 0.05);
    slider('Hit-stop strength', 'hitstop', 0, 1.5, 0.05);
    slider('Flick sensitivity', 'sensitivity', 0.5, 1.6, 0.05);
    slider('Touch area (screen height)', 'padRegion', 0.35, 0.6, 0.01, () => window.dispatchEvent(new Event('resize')));
    check('Left-handed pad', 'leftHanded', () => { window.dispatchEvent(new Event('resize')); this.placePause(); });
    check('Reduce flashes', 'reduceFlashes');
    check('Rhythm Mode (off = Classic; applies to the next run)', 'rhythmMode', () => window.dispatchEvent(new Event('jumpshot-mode')));
    check('Beat-track HUD (Rhythm Mode)', 'beatHud');
    {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span');
      const fmt = () => `Rhythm latency offset: ${settings.rhythmOffset >= 0 ? '+' : ''}${Math.round(settings.rhythmOffset)} ms`;
      span.textContent = fmt();
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = '-250'; inp.max = '250'; inp.step = '5'; inp.value = String(settings.rhythmOffset); inp.id = 'set-rhythmOffset';
      inp.addEventListener('input', () => { settings.rhythmOffset = parseFloat(inp.value); span.textContent = fmt(); saveSettings(); window.dispatchEvent(new Event('jumpshot-mode')); });
      row.appendChild(span); row.appendChild(inp);
      p.appendChild(row);
    }
    if (onCalibrate) this.btn(p, 'CALIBRATE RHYTHM LATENCY', () => { this.close('settings'); onCalibrate(); });
    check('Show debug overlay', 'debug', () => window.dispatchEvent(new Event('jumpshot-debug')));
    if (onTutorial) this.btn(p, 'REPLAY TUTORIAL', () => { this.close('settings'); onTutorial(); });
    this.btn(p, 'DONE', () => { this.close('settings'); onClose(); }, 'btn primary');
    el.appendChild(p);
  }

  // ---------------- Upgrade picker ----------------
  showUpgrades(choices: UpgradeDef[], stacks: Record<string, number>, onPick: (u: UpgradeDef) => void, title: string): void {
    const el = this.layer('upgrades', 'layer dim');
    const h = document.createElement('div');
    h.className = 'big';
    h.textContent = title;
    h.style.marginBottom = '6px';
    el.appendChild(h);
    const sub = document.createElement('div');
    sub.className = 'subtitle';
    sub.textContent = 'CHOOSE AN UPGRADE';
    sub.style.marginBottom = '18px';
    el.appendChild(sub);
    const cards = document.createElement('div');
    cards.className = 'cards';
    choices.forEach((u, i) => {
      const c = document.createElement('button');
      c.className = 'card';
      c.style.animationDelay = `${i * 0.08}s`;
      const st = stacks[u.id] ?? 0;
      c.innerHTML = `<div class="ic">${u.icon}</div><div class="nm">${u.name}${st > 0 ? ` <span style="opacity:.6;font-size:13px">LV${st + 1}</span>` : ''}</div><div class="ds">${u.desc}</div><div class="tg">${u.tag}</div>`;
      let picked = false;
      c.addEventListener('click', (e) => {
        e.stopPropagation();
        if (picked) return;
        picked = true;
        audio.ui('select');
        this.close('upgrades');
        onPick(u);
      });
      cards.appendChild(c);
    });
    el.appendChild(cards);
  }

  // ---------------- Results ----------------
  showResults(r: {
    score: number; high: number; newHigh: boolean; wave: number; bestHits: number; bestDamage: number; bestRank: number;
    kos: number; parries: number; finishers: number; maxRank: number;
    /** Rhythm Mode only. */
    rhythm?: { label: string; counts: number[]; bestStreak: number; accuracy: number } | null;
  }, onRetry: () => void, onTitle: () => void): void {
    const el = this.layer('results', 'layer dim');
    const p = document.createElement('div');
    p.className = 'panel';
    p.innerHTML = `<h2>DEFEATED</h2>
      <div class="big">${r.score.toLocaleString()}</div>
      <div class="subtitle" style="margin-bottom:8px">${r.newHigh ? '★ NEW HIGH SCORE ★' : 'BEST ' + r.high.toLocaleString()}</div>
      <div class="stats">
        <span>Wave reached</span><span class="v">${r.wave}</span>
        <span>Best combo</span><span class="v">${r.bestHits} hits · ${r.bestDamage} dmg · ${STYLE.ranks[r.bestRank]}</span>
        <span>Highest style rank</span><span class="v">${STYLE.ranks[r.maxRank]}</span>
        <span>K.O.s</span><span class="v">${r.kos}</span>
        <span>Perfect parries</span><span class="v">${r.parries}</span>
        <span>Finishers</span><span class="v">${r.finishers}</span>
      </div>`;
    if (r.rhythm) {
      const c = r.rhythm.counts;
      const d = document.createElement('div');
      d.className = 'stats';
      d.style.marginTop = '8px';
      d.innerHTML = `<span>Song</span><span class="v">${r.rhythm.label}</span>
        <span>Beat accuracy</span><span class="v">${Math.round(r.rhythm.accuracy * 100)}%</span>
        <span>Best streak</span><span class="v">${r.rhythm.bestStreak}</span>
        <span>Judgements</span><span class="v">${c[3]} perfect · ${c[2]} great · ${c[1]} good · ${c[0]} miss</span>`;
      p.appendChild(d);
    }
    this.btn(p, 'FIGHT AGAIN', onRetry, 'btn primary');
    this.btn(p, 'TITLE', onTitle);
    el.appendChild(p);
  }

  // ---------------- Banners & tutorial text ----------------
  banner(text: string, sub: string, ms: number): void {
    const el = this.layer('banner', 'layer passthrough');
    el.style.pointerEvents = 'none';
    const b = document.createElement('div');
    b.className = 'banner';
    b.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    el.appendChild(b);
    window.setTimeout(() => { if (this.layers.get('banner') === el) this.close('banner'); }, ms);
  }

  tutorialText(text: string, sub: string, topPx: number, onSkip: (() => void) | null): void {
    const el = this.layer('tutorial', 'layer passthrough');
    el.style.pointerEvents = 'none';
    const t = document.createElement('div');
    t.className = 'tut';
    t.style.top = topPx + 'px';
    t.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    el.appendChild(t);
    if (onSkip) {
      const b = this.btn(el, 'SKIP TUTORIAL ›', onSkip, 'btn small');
      b.style.position = 'absolute';
      b.style.top = '62px';
      b.style.right = '10px';
      b.style.pointerEvents = 'auto';
    }
  }

  closeAll(): void { for (const id of [...this.layers.keys()]) this.close(id); }
}
