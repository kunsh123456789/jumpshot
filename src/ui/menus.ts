import { settings, saveSettings } from '../core/settings';
import { audio } from '../core/audio';
import { WEAPONS, activeDef, availableWeapons, type WeaponDef, type WeaponId } from '../data/weapons';
import { MOVES } from '../data/moves';
import { MovePreview } from './preview';
import { anyUnlocked, isUnlocked, enterCode } from './cheats';
import { STYLE } from '../data/tuning';
import { icon } from './icons';
import { roadNode, afterRoad, type RoadNode } from '../data/roadmap';
import { ARENA_ORDER } from '../render/background';

/**
 * DOM menus in the Arcade Fighter design system (revision pass 8 UI; styles in
 * style.css): title, loadout, pause, settings, results, banners, tutorial
 * prompts, the between-wave swap strip and the weapon tooltip. Every
 * interactive element is a real <button>/<input>, so ui/nav.ts can move focus
 * with the keyboard or a gamepad; each modal layer marks its "back" action
 * with data-back.
 */
export class Menus {
  private root: HTMLElement;
  private layers = new Map<string, HTMLElement>();
  pauseBtn: HTMLButtonElement;
  /** Cheat: in-game nuke button (only shown with Settings -> Cheats -> Nuke on). */
  nukeBtn: HTMLButtonElement;
  onPause: () => void = () => {};
  onNuke: () => void = () => {};

  constructor() {
    this.root = document.getElementById('ui')!;
    this.pauseBtn = document.createElement('button');
    this.pauseBtn.className = 'icon-btn';
    this.pauseBtn.innerHTML = icon('pause');
    this.pauseBtn.setAttribute('aria-label', 'Pause');
    this.pauseBtn.style.display = 'none';
    this.pauseBtn.addEventListener('click', () => { audio.ui('click'); this.onPause(); });
    this.root.appendChild(this.pauseBtn);
    this.nukeBtn = document.createElement('button');
    this.nukeBtn.className = 'icon-btn nuke-btn';
    this.nukeBtn.innerHTML = icon('nuke');
    this.nukeBtn.title = 'Nuke (N)';
    this.nukeBtn.setAttribute('aria-label', 'Nuke');
    this.nukeBtn.style.display = 'none';
    this.nukeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.onNuke(); });
    this.root.appendChild(this.nukeBtn);
    this.placePause();
    window.addEventListener('resize', () => this.placePause());
  }

  /** Show/hide the in-play buttons (pause, and the nuke when its cheat is on). */
  setPlayButtons(on: boolean): void {
    this.pauseBtn.style.display = on ? '' : 'none';
    this.nukeBtn.style.display = on && settings.cheatNuke ? '' : 'none';
  }

  placePause(): void {
    const st = this.pauseBtn.style;
    st.right = 'max(calc(var(--u) * 14px), env(safe-area-inset-right))';
    st.left = '';
  }

  private layer(id: string, cls = 'layer'): HTMLElement {
    this.close(id);
    if (cls.includes('dim')) audio.ui('select');
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

  /** An Arcade button: label (+ optional icon) in an un-skewed span; `back` marks the layer's Escape / B action. */
  private btn(parent: HTMLElement, label: string, onClick: () => void, cls = 'btn', ico = '', back = false): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = cls;
    b.type = 'button';
    b.innerHTML = `<span>${ico ? icon(ico) : ''}${label}</span>`;
    if (back) b.dataset.back = '1';
    b.addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); audio.ui(back ? 'back' : 'click'); onClick(); });
    parent.appendChild(b);
    return b;
  }
  private head(parent: HTMLElement, text: string, cls: string, tone = ''): void {
    const h = document.createElement('div');
    h.className = cls;
    h.innerHTML = `<span class="banner-band ${tone}"><span>${text}</span></span>`;
    parent.appendChild(h);
  }

  // ---------------- Title ----------------
  showTitle(high: number, onSettings: () => void, mode: { rhythm: boolean; onToggle: (rhythm: boolean) => void } | null = null,
    loadout: { name: string; open: () => void } | null = null, onStart: (() => void) | null = null,
    extra: { tutorial: () => void; roadmap: () => void; reset: () => void } | null = null): void {
    const el = this.layer('title', 'layer passthrough ttl');
    el.innerHTML = `<div class="ttl-scrim"></div><h1 class="ttl-logo">JUMPSHOT</h1><div class="ttl-sub">SWIPE · LAUNCH · JUGGLE · SPIKE</div>`;
    // Easter egg: tap the logo 5 times for a cheat-code box (touch devices; keyboards can just type).
    const logo = el.querySelector('.ttl-logo') as HTMLElement;
    let taps = 0, last = 0;
    logo.style.pointerEvents = 'auto';
    logo.addEventListener('click', (e) => {
      e.stopPropagation();
      const now = performance.now();
      taps = now - last < 600 ? taps + 1 : 1; last = now;
      if (taps >= 5) { taps = 0; this.codePrompt(); }
    });
    if (mode) {
      const tg = document.createElement('div');
      tg.className = 'seg2';
      tg.setAttribute('role', 'group');
      tg.setAttribute('aria-label', 'Game mode');
      const mk = (label: string, rhythm: boolean, ico: string) => {
        const b = this.btn(tg, label, () => {
          mode.rhythm = rhythm;
          for (const x of tg.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
          mode.onToggle(rhythm);
        }, 'btn', ico);
        b.id = rhythm ? 'mode-rhythm' : 'mode-classic';
        b.setAttribute('aria-pressed', String(mode.rhythm === rhythm));
      };
      mk('RHYTHM', true, 'music');
      mk('CLASSIC', false, '');
      el.appendChild(tg);
    }
    const acts = document.createElement('div');
    acts.className = 'ttl-actions';
    if (onStart) this.btn(acts, 'FIGHT!', onStart, 'btn primary ttl-fight', 'play').id = 'title-fight';
    const row = document.createElement('div');
    row.className = 'row2';
    if (loadout) this.btn(row, `WEAPON: ${loadout.name}`, loadout.open, 'btn', WEAPONS[settingsWeapon(loadout.name)]?.id ?? 'fists').id = 'title-weapon';
    this.btn(row, 'SETTINGS', onSettings, 'btn', 'gear').id = 'title-settings';
    acts.appendChild(row);
    el.appendChild(acts);
    if (extra) {
      const row3 = document.createElement('div');
      row3.className = 'row2 ttl-extra';
      this.btn(row3, 'TUTORIAL', extra.tutorial, 'btn small', 'target').id = 'title-tutorial';
      this.btn(row3, 'ROADMAP', extra.roadmap, 'btn small', 'target').id = 'title-roadmap';
      this.btn(row3, 'RESET GAME', () => this.confirmReset(extra.reset), 'btn small danger', 'retry').id = 'title-reset';
      el.appendChild(row3);
    }
    if (high > 0) {
      const hs = document.createElement('div');
      hs.className = 'plate ttl-best';
      hs.innerHTML = `<div class="in lbl">BEST <b>${high.toLocaleString()}</b></div>`;
      el.appendChild(hs);
    }
    const pr = document.createElement('div');
    pr.className = 'ttl-prompt';
    pr.textContent = 'TAP OR FLICK THE LOWER HALF TO START';
    const padTop = (window as unknown as { __padTop?: number }).__padTop ?? window.innerHeight * 0.5;
    pr.style.top = Math.max(padTop + 16, window.innerHeight - 70) + 'px';
    el.appendChild(pr);
  }

  // ---------------- Pause ----------------
  showPause(onResume: () => void, onSettings: () => void, onRestart: () => void, onQuit: () => void): void {
    const el = this.layer('pause', 'layer dim pz');
    this.head(el, 'PAUSED', 'pz-head');
    const col = document.createElement('div');
    col.className = 'pz-btns';
    this.btn(col, 'RESUME', onResume, 'btn primary', 'play', true);
    this.btn(col, 'SETTINGS', onSettings, 'btn', 'gear');
    this.btn(col, 'RESTART RUN', onRestart, 'btn', 'retry');
    this.btn(col, 'QUIT TO TITLE', onQuit, 'btn', 'home');
    el.appendChild(col);
    const jump = settings.tapAction === 'jump';
    const h = document.createElement('div');
    h.className = 'pz-help';
    h.innerHTML = `<h3>CONTROLS</h3>
      <p><b>Touch (lower half):</b> drag slowly to move · flick to attack that way · a long fast flick is HEAVY · flick ↑ = launcher · flick ↓ in the air = spike · slow drag ↑ = jump · ${jump ? 'tap = jump, double-tap = dodge / parry' : 'tap = dodge / parry'} · hold still = SPECIAL</p>
      <p><b>Keys:</b> A/D or ←/→ move · I/J/K/L attack (+Shift heavy) · W/↑ jump · ${jump ? 'Space jump · Shift+Space or F dodge' : 'Space dodge'} · X Special · Esc pause</p>
      <p><b>Gamepad:</b> stick / d-pad move · X attack toward the stick (Y heavy) · A jump · B or LB dodge · RT Special · Start pause</p>`;
    el.appendChild(h);
  }

  // ---------------- Settings ----------------
  showSettings(onClose: () => void, onTutorial: (() => void) | null, onCalibrate: (() => void) | null = null, onReset: (() => void) | null = null): void {
    const el = this.layer('settings', 'layer dim');
    const p = document.createElement('div');
    p.className = 'panel';
    p.innerHTML = `<h2>${icon('gear')} SETTINGS</h2>`;
    const sec = (t: string) => { const d = document.createElement('div'); d.className = 'sec'; d.textContent = t; p.appendChild(d); };
    const range = (label: string, id: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string) => {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span');
      span.innerHTML = `${label} <span class="val"></span>`;
      const val = span.querySelector('.val') as HTMLElement;
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = String(min); inp.max = String(max); inp.step = String(step); inp.value = String(get()); inp.id = id;
      const paint = () => { val.textContent = fmt(+inp.value); inp.style.setProperty('--fill', ((+inp.value - min) / (max - min) * 100) + '%'); };
      inp.addEventListener('input', () => { set(parseFloat(inp.value)); paint(); saveSettings(); });
      paint();
      row.appendChild(span); row.appendChild(inp);
      p.appendChild(row);
    };
    const pctOf = (v: number) => `${Math.round(v * 100)}%`;
    const slider = (label: string, key: 'masterVolume' | 'musicVolume' | 'shake' | 'hitstop' | 'sensitivity' | 'padRegion', min: number, max: number, step: number, after?: () => void) =>
      range(label, 'set-' + key, min, max, step, () => settings[key], (v) => { settings[key] = v; audio.applyVolume(); after?.(); }, pctOf);
    const check = (label: string, key: 'leftHanded' | 'debug' | 'reduceFlashes' | 'rhythmMode' | 'beatHud' | 'boil' | 'highContrast' | 'cheatGod' | 'cheatRayGun' | 'cheatNuke' | 'mobilePerf' | 'specialAssist', after?: () => void) => {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span');
      span.textContent = label;
      const inp = document.createElement('input');
      inp.type = 'checkbox'; inp.id = 'set-' + key;
      inp.checked = settings[key];
      inp.addEventListener('change', () => { settings[key] = inp.checked; audio.ui('click'); saveSettings(); after?.(); });
      row.appendChild(span); row.appendChild(inp);
      p.appendChild(row);
    };
    const select = (label: string, id: string, opts: [string, string][], get: () => string, set: (v: string) => void) => {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span'); span.textContent = label;
      const sel = document.createElement('select'); sel.id = id;
      for (const [v, t] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); }
      sel.value = get();
      sel.addEventListener('change', () => { set(sel.value); saveSettings(); window.dispatchEvent(new Event('jumpshot-look')); });
      row.appendChild(span); row.appendChild(sel);
      p.appendChild(row);
    };

    sec('PERFORMANCE');
    check('Mobile performance (less lag on phones)', 'mobilePerf', () => { applyPerfClass(); window.dispatchEvent(new Event('resize')); });
    sec('WEAPONS');
    select('Movesets', 'set-movesets', [['new', 'New (signature moves)'], ['original', 'Original']], () => settings.movesets, (v) => { settings.movesets = v as 'new' | 'original'; window.dispatchEvent(new Event('jumpshot-moveset')); });
    sec('CONTROLS');
    select('Tap / Space', 'set-tapAction', [['jump', 'Jump (double-tap = dodge)'], ['dodge', 'Dodge & parry (original)']], () => settings.tapAction, (v) => { settings.tapAction = v as 'jump' | 'dodge'; });
    slider('Flick sensitivity', 'sensitivity', 0.5, 1.6, 0.05);
    slider('Touch area height', 'padRegion', 0.35, 0.6, 0.01, () => window.dispatchEvent(new Event('resize')));
    check('Left-handed pad', 'leftHanded', () => { window.dispatchEvent(new Event('resize')); this.placePause(); });
    sec('SPECIAL');
    check('Special assist (wider path, longer timers)', 'specialAssist');
    sec('SOUND');
    slider('Master volume', 'masterVolume', 0, 1, 0.05);
    slider('Music volume', 'musicVolume', 0, 1, 0.05);
    select('Sounds & music', 'set-sfxStyle', [['recorded', 'Recorded (Freesound, CC0)'], ['synth', 'Synthesized (original)']], () => settings.sfxStyle, (v) => { settings.sfxStyle = v as 'recorded' | 'synth'; });
    sec('FEEL');
    slider('Screen shake', 'shake', 0, 1.5, 0.05);
    slider('Hit-stop strength', 'hitstop', 0, 1.5, 0.05);
    check('Reduce flashes', 'reduceFlashes', applyPerfClass);
    sec('LOOK & ANIMATION');
    select('Look', 'set-look', [['pixel', 'Pixel (ink page)'], ['crisp', 'Crisp (ink page)'], ['smooth', 'Smooth (neon)']], () => settings.look, (v) => { settings.look = v as 'pixel' | 'crisp' | 'smooth'; });
    range('Pixel Look resolution', 'set-pixelRes', 0.3, 0.55, 0.025, () => settings.pixelRes, (v) => { settings.pixelRes = v; window.dispatchEvent(new Event('jumpshot-look')); }, pctOf);
    select('Paper page', 'set-page', [['auto', 'Auto (by wave)'], ['blank', 'Blank'], ['lined', 'Lined'], ['graph', 'Graph'], ['sketch', 'Sketchbook'], ['kraft', 'Kraft']], () => settings.page, (v) => { settings.page = v as typeof settings.page; });
    select('Animation style', 'set-animStyle', [['drawn', 'Hand-Drawn'], ['smooth', 'Smooth']], () => settings.animStyle, (v) => { settings.animStyle = v as 'drawn' | 'smooth'; });
    range('Hand-Drawn step rate', 'set-stepRate', 8, 20, 1, () => settings.stepRate, (v) => { settings.stepRate = v; }, (v) => `${v} fps`);
    select('Attack smoothness', 'set-attackSmooth', [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']], () => settings.attackSmooth, (v) => { settings.attackSmooth = v as 'low' | 'normal' | 'high'; });
    select('Fists animation', 'set-fistAnims', [['v2', 'Reference v2'], ['legacy', 'Legacy']], () => settings.fistAnims, (v) => { settings.fistAnims = v as 'v2' | 'legacy'; });
    check('Line boil', 'boil');
    check('High contrast page', 'highContrast', () => window.dispatchEvent(new Event('jumpshot-look')));
    sec('RHYTHM MODE');
    check('Rhythm Mode (next run)', 'rhythmMode', () => window.dispatchEvent(new Event('jumpshot-mode')));
    check('Beat-track HUD', 'beatHud');
    range('Latency offset', 'set-rhythmOffset', -250, 250, 5, () => settings.rhythmOffset, (v) => { settings.rhythmOffset = v; window.dispatchEvent(new Event('jumpshot-mode')); }, (v) => `${v >= 0 ? '+' : ''}${Math.round(v)} ms`);
    if (onCalibrate) { const b = document.createElement('div'); b.className = 'pad'; this.btn(b, 'CALIBRATE LATENCY', () => { this.close('settings'); onCalibrate(); }, 'btn small', 'target'); p.appendChild(b); }
    // Easter-egg cheats: this section only appears once a code has unlocked something.
    if (anyUnlocked()) {
      sec('CHEATS · RUNS WITH CHEATS DON\'T SET RECORDS');
      if (isUnlocked('cheatGod')) check('Never die', 'cheatGod');
      if (isUnlocked('cheatRayGun')) check('Ray gun in the loadout', 'cheatRayGun');
      if (isUnlocked('cheatNuke')) check('Nuke button (also the N key)', 'cheatNuke');
    }
    sec('OTHER');
    check('Debug overlay', 'debug', () => window.dispatchEvent(new Event('jumpshot-debug')));
    if (onTutorial || onReset) {
      const b = document.createElement('div'); b.className = 'pad';
      if (onTutorial) this.btn(b, 'REPLAY TUTORIAL', () => { this.close('settings'); onTutorial(); }, 'btn small', 'target').id = 'set-tutorial';
      if (onReset) this.btn(b, 'RESET GAME', () => this.confirmReset(onReset), 'btn small danger', 'retry').id = 'set-reset';
      p.appendChild(b);
    }
    const foot = document.createElement('div');
    foot.className = 'sticky-foot';
    this.btn(foot, 'DONE', () => { this.close('settings'); onClose(); }, 'btn primary', 'check', true);
    p.appendChild(foot);
    el.appendChild(p);
  }

  // ---------------- Loadout ----------------
  /** Pre-run loadout: a character-select style grid (preview loops the weapon's moves on a dummy, plus its swipe sheet). */
  showLoadout(current: WeaponId, onPick: (id: WeaponId) => void, onClose: () => void): void {
    const el = this.layer('loadout', 'layer dim lo');
    this.head(el, 'SELECT YOUR WEAPON', 'lo-head');
    const det = document.createElement('div');
    det.className = 'panel lo-detail';
    det.innerHTML = `<div class="ph" data-k="name"></div>`;
    const cv = document.createElement('canvas');
    cv.className = 'lo-preview';
    const cap = document.createElement('div');
    cap.className = 'lo-cap';
    const desc = document.createElement('div');
    desc.className = 'lo-desc';
    const sheet = document.createElement('div');
    sheet.className = 'lo-sheet';
    det.append(cv, cap, desc, sheet);
    const preview = new MovePreview(cv, (l) => { cap.textContent = l; });
    const right = document.createElement('div');
    right.className = 'lo-right';
    const tiles = document.createElement('div');
    tiles.className = 'lo-tiles';
    tiles.setAttribute('role', 'listbox');
    tiles.setAttribute('aria-label', 'Weapons');
    let sel = current;
    const pick = (id: WeaponId) => {
      sel = id;
      for (const c of tiles.querySelectorAll<HTMLElement>('.tile')) { const on = c.dataset.id === id; c.classList.toggle('sel', on); c.setAttribute('aria-selected', String(on)); }
      const w = activeDef(WEAPONS[id]);
      (det.querySelector('[data-k=name]') as HTMLElement).innerHTML = `${icon(id)} ${w.name.toUpperCase()}`;
      desc.textContent = w.desc;
      preview.setWeapon(w);
      sheet.innerHTML = cheatSheet(w);
      onPick(id);
    };
    availableWeapons().forEach((id, i) => {
      const w = activeDef(WEAPONS[id]);
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'tile';
      c.dataset.id = id;
      c.setAttribute('role', 'option');
      c.innerHTML = `<span class="k">${i < 10 ? (i + 1) % 10 : ''}</span>${icon(id)}<small>${w.name.replace('Paper Plane Swarm', 'Paper Planes').replace('Boomerang ', '')}</small>`;
      c.addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); audio.ui('select'); pick(id); });
      tiles.appendChild(c);
    });
    const foot = document.createElement('div');
    foot.className = 'lo-foot sticky-foot';
    foot.style.position = 'static';
    foot.innerHTML = '<span class="keys">1–9 · 0 · Q / E</span>';
    this.btn(foot, 'DONE', () => { preview.stop(); this.close('loadout'); onClose(); }, 'btn primary', 'check', true);
    right.append(tiles, foot);
    el.append(det, right);
    pick(sel);
    preview.start();
  }

  /** Keyboard: number keys pick a weapon in the open loadout; Enter/Escape closes it. Returns true if handled. */
  loadoutKey(code: string): boolean {
    const el = this.layers.get('loadout');
    if (!el) return false;
    if (code === 'Escape') { el.querySelector<HTMLButtonElement>('[data-back]')?.click(); return true; }
    return pickByKey(code, [...el.querySelectorAll<HTMLButtonElement>('.tile')], (b) => b.classList.contains('sel'), false);
  }

  /** Between waves: a small non-blocking strip of weapon tiles; tap (or press 1-0 / Q / E) to swap instantly. */
  showSwap(current: WeaponId, onSwap: (id: WeaponId) => void): void {
    const el = this.layer('swap', 'layer passthrough');
    el.style.pointerEvents = 'none';
    const box = document.createElement('div');
    box.className = 'swap';
    box.innerHTML = '<span class="lbl">SWAP WEAPON</span>';
    const bar = document.createElement('div');
    bar.className = 'swap-tiles';
    availableWeapons().forEach((id, i) => {
      const w = activeDef(WEAPONS[id]);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tile swap-btn' + (id === current ? ' sel' : '');
      b.title = i < 10 ? `${(i + 1) % 10}: ${w.name}` : `Q / E: ${w.name}`;
      b.dataset.id = id;
      b.innerHTML = `<span class="k">${i < 10 ? (i + 1) % 10 : ''}</span>${icon(id)}`;
      b.addEventListener('click', (e) => {
        e.stopPropagation(); audio.unlock(); audio.ui('select');
        for (const x of bar.querySelectorAll('.swap-btn')) x.classList.toggle('sel', x === b);
        onSwap(id);
      });
      bar.appendChild(b);
    });
    box.appendChild(bar);
    el.appendChild(box);
  }

  /** Keyboard swap during the breather. */
  swapKey(code: string): boolean {
    const el = this.layers.get('swap');
    if (!el) return false;
    return pickByKey(code, [...el.querySelectorAll<HTMLButtonElement>('.swap-btn')], (b) => b.classList.contains('sel'), false);
  }

  /** First-time tooltip for a weapon: its directional moves, non-blocking. */
  weaponTip(w: WeaponDef, ms: number): void {
    const el = this.layer('wtip', 'layer passthrough');
    el.style.pointerEvents = 'none';
    const t = document.createElement('div');
    t.className = 'tut wtip';
    t.innerHTML = `<div class="in">${icon(w.id)} ${w.name.toUpperCase()}<small>${w.tips.join('<br>')}</small></div>`;
    el.appendChild(t);
    window.setTimeout(() => { if (this.layers.get('wtip') === el) this.close('wtip'); }, ms);
  }

  /** Secret code box (from 5 taps on the title logo). */
  // ---------------- Roadmap ----------------
  /**
   * The level roadmap: waves 1-40 as four stages of ten (each ends in a boss), built from the real
   * wave / enemy / page / arena tables. Tap, focus or arrow onto a wave for its details.
   */
  showRoadmap(bestWave: number, onClose: () => void): void {
    const el = this.layer('roadmap', 'layer dim');
    const p = document.createElement('div');
    p.className = 'panel rm';
    p.style.maxWidth = 'min(96vw, calc(var(--u) * 900px))';
    p.innerHTML = `<h2>${icon('target')} ROADMAP</h2>`;
    const body = document.createElement('div');
    body.className = 'pad rm-body';
    const detail = document.createElement('div');
    detail.className = 'rm-detail';
    detail.setAttribute('aria-live', 'polite');
    const bossNames = [10, 20, 30, 40].map((w) => roadNode(w, ARENA_ORDER).boss!);
    const show = (n: RoadNode) => {
      const state = n.wave < bestWave ? 'CLEARED' : n.wave === bestWave ? 'YOUR BEST' : 'AHEAD';
      detail.innerHTML = `<div class="rm-dh"><b>WAVE ${n.wave}</b><span class="rm-tag ${n.kind}">${n.kind === 'boss' ? 'BOSS' : n.kind === 'elite' ? 'ELITE' : 'WAVE'}</span><span class="rm-tag st">${state}</span></div>
        <div>${n.boss ? `<b>${n.boss.name}</b>${n.boss.sub !== 'BOSS' ? ' · ' + n.boss.sub : ''}: ${n.boss.note}` : n.enemies}</div>
        <div class="rm-meta">${n.newEnemy ? `NEW: ${n.newEnemy} · ` : ''}${n.arena} arena · ${n.page} page · enemies ${n.hp}% HP, ${n.dmg}% damage</div>`;
    };
    body.appendChild(detail);
    for (let s = 0; s < 4; s++) {
      const sec = document.createElement('div');
      sec.className = 'rm-stage';
      const b = bossNames[s];
      sec.innerHTML = `<div class="rm-sh"><b>STAGE ${s + 1}</b><span>waves ${s * 10 + 1}-${s * 10 + 10}</span><em>BOSS · ${b.name}</em></div>`;
      const row = document.createElement('div');
      row.className = 'rm-row';
      for (let i = 1; i <= 10; i++) {
        const n = roadNode(s * 10 + i, ARENA_ORDER);
        const done = n.wave < bestWave;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `rm-node ${n.kind}${done ? ' done' : ''}${n.wave === bestWave ? ' best' : ''}`;
        btn.innerHTML = `<span>${n.kind === 'boss' ? '☠' : n.kind === 'elite' ? '★' : n.wave}</span>${n.kind === 'wave' ? '' : `<small>${n.wave}</small>`}`;
        btn.setAttribute('aria-label', `Wave ${n.wave}${n.kind === 'boss' ? ', boss' : n.kind === 'elite' ? ', elite' : ''}${done ? ', cleared' : ''}`);
        btn.addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); audio.ui('move'); show(n); });
        btn.addEventListener('focus', () => show(n));
        btn.addEventListener('mouseenter', () => show(n));
        row.appendChild(btn);
      }
      sec.appendChild(row);
      body.appendChild(sec);
    }
    const foot = document.createElement('div');
    foot.className = 'hint rm-after';
    foot.textContent = afterRoad();
    body.appendChild(foot);
    p.appendChild(body);
    const bar = document.createElement('div');
    bar.className = 'sticky-foot';
    this.btn(bar, 'DONE', () => { this.close('roadmap'); onClose(); }, 'btn primary small', 'check', true).id = 'rm-done';
    p.appendChild(bar);
    el.appendChild(p);
    show(roadNode(Math.min(40, Math.max(1, bestWave)), ARENA_ORDER));
  }

  /** "Are you sure?" before wiping everything (the reset can't be undone). */
  confirmReset(onYes: () => void): void {
    const el = this.layer('reset', 'layer dim');
    const p = document.createElement('div');
    p.className = 'panel';
    p.style.maxWidth = 'min(94vw, calc(var(--u) * 520px))';
    p.innerHTML = `<h2>${icon('retry')} RESET THE GAME?</h2><div class="hint" style="padding:0 var(--s4) var(--s3)">This deletes your high score, best combo and wave, tutorial progress, unlocked codes, weapon choice and every setting, then restarts the game as if it were the first time. It can't be undone.</div>`;
    const row = document.createElement('div');
    row.className = 'sticky-foot';
    this.btn(row, 'RESET EVERYTHING', () => { this.close('reset'); onYes(); }, 'btn small danger', 'retry').id = 'reset-yes';
    this.btn(row, 'CANCEL', () => this.close('reset'), 'btn primary small', 'close', true).id = 'reset-no';
    p.appendChild(row);
    el.appendChild(p);
  }

  codePrompt(): void {
    const el = this.layer('code', 'layer dim');
    const p = document.createElement('div');
    p.className = 'panel';
    p.style.maxWidth = 'min(94vw, calc(var(--u) * 460px))';
    p.innerHTML = `<h2>${icon('lock')} ENTER CODE</h2>`;
    const inp = document.createElement('input');
    inp.type = 'text'; inp.autocomplete = 'off'; inp.className = 'code-input'; inp.id = 'code-input';
    inp.setAttribute('aria-label', 'Code');
    p.appendChild(inp);
    const msg = document.createElement('div');
    msg.className = 'hint';
    msg.style.padding = '0 var(--s4)';
    p.appendChild(msg);
    const submit = () => { const r = enterCode(inp.value); msg.textContent = r ?? 'Nothing happens…'; inp.value = ''; if (r) this.banner('UNLOCKED', r, 1400); };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') submit(); if (e.key === 'Escape') this.close('code'); });
    const row = document.createElement('div');
    row.className = 'sticky-foot';
    this.btn(row, 'OK', submit, 'btn primary small', 'check');
    this.btn(row, 'CLOSE', () => this.close('code'), 'btn small', 'close', true);
    p.appendChild(row);
    el.appendChild(p);
    setTimeout(() => inp.focus(), 50);
  }

  // ---------------- Results ----------------
  showResults(r: {
    score: number; high: number; newHigh: boolean; wave: number; bestHits: number; bestDamage: number; bestRank: number;
    kos: number; parries: number; finishers: number; maxRank: number;
    /** Rhythm Mode only. */
    rhythm?: { label: string; counts: number[]; bestStreak: number; accuracy: number } | null;
  }, onRetry: () => void, onTitle: () => void): void {
    const el = this.layer('results', 'layer dim');
    this.head(el, 'GAME OVER', 'res-head', 'red');
    const p = document.createElement('div');
    p.className = 'panel';
    p.style.maxWidth = 'min(94vw, calc(var(--u) * 760px))';
    const rows: [string, string | number][] = [
      ['Wave reached', r.wave], ['Best combo', `${r.bestHits} hits · ${r.bestDamage} dmg`], ['Best combo rank', STYLE.ranks[r.bestRank]], ['K.O.s', r.kos],
      ['Perfect parries', r.parries], ['Finishers', r.finishers],
    ];
    if (r.rhythm) {
      const c = r.rhythm.counts;
      rows.push(['Song', r.rhythm.label], ['Beat accuracy', `${Math.round(r.rhythm.accuracy * 100)}%`], ['Best streak', r.rhythm.bestStreak], ['Judgments', `${c[3]} P · ${c[2]} G · ${c[1]} OK · ${c[0]} miss`]);
    }
    p.innerHTML = `<div class="res-top"><div><div class="lbl" style="font-size:var(--fs-xs);color:var(--cyan)">FINAL SCORE</div><div class="res-score">${r.score.toLocaleString()}</div>
        <div class="res-best ${r.newHigh ? 'new' : ''}">${r.newHigh ? '★ NEW HIGH SCORE ★' : 'BEST ' + r.high.toLocaleString()}</div></div>
        <div style="text-align:center"><div class="rank-hex">${STYLE.ranks[r.maxRank]}</div><div class="lbl" style="font-size:var(--fs-xs);color:var(--steel2);margin-top:var(--s1)">TOP RANK</div></div></div>
      <div class="stats">${rows.map(([k, v], i) => `<div class="statrow${String(v).length > 22 ? ' wide' : ''}" style="animation-delay:${0.08 + i * 0.04}s"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
    const foot = document.createElement('div');
    foot.className = 'sticky-foot';
    this.btn(foot, 'FIGHT AGAIN', onRetry, 'btn primary', 'retry').id = 'res-retry';
    this.btn(foot, 'TITLE', onTitle, 'btn', 'home', true);
    p.appendChild(foot);
    el.appendChild(p);
  }

  // ---------------- Banners & tutorial text ----------------
  banner(text: string, sub: string, ms: number): void {
    const el = this.layer('banner', 'layer passthrough');
    el.style.pointerEvents = 'none';
    const b = document.createElement('div');
    b.className = 'banner';
    const red = /BOSS/.test(sub);
    b.innerHTML = `<span class="banner-band${red ? ' red' : ''}"><span>${text}</span></span>${sub ? `<small>${sub.toUpperCase()}</small>` : ''}`;
    el.appendChild(b);
    window.setTimeout(() => { if (this.layers.get('banner') === el) this.close('banner'); }, ms);
  }

  tutorialText(text: string, sub: string, topPx: number, onSkip: (() => void) | null): void {
    const el = this.layer('tutorial', 'layer passthrough');
    el.style.pointerEvents = 'none';
    const t = document.createElement('div');
    t.className = 'tut';
    t.style.top = topPx + 'px';
    t.innerHTML = `<div class="in">${text}${sub ? `<small>${sub}</small>` : ''}</div>`;
    el.appendChild(t);
    if (onSkip) {
      const b = this.btn(el, 'SKIP TUTORIAL', onSkip, 'btn small skip', 'close');
      b.style.pointerEvents = 'auto';
    }
  }

  closeAll(): void { for (const id of [...this.layers.keys()]) this.close(id); }
}

/** The weapon id for a loadout button label (the title passes the weapon's display name). */
function settingsWeapon(name: string): WeaponId {
  const e = Object.values(WEAPONS).find((w) => w.name === name);
  return (e?.id ?? 'fists') as WeaponId;
}

/** Swipe cheat-sheet for a weapon: direction -> light / heavy move names (ground, then air). */
function cheatSheet(w: WeaponDef): string {
  const nm = (id: string) => MOVES[id]?.name ?? id;
  const rows: [string, keyof WeaponDef['ground']][] = [['→ ←', 'side'], ['↗ ↖', 'upDiag'], ['↑', 'up'], ['↘ ↙', 'downDiag'], ['↓', 'down']];
  const tr = (set: WeaponDef['ground']) => rows.map(([d, k]) => `<tr><td>${d}</td><td>${nm(set[k].light)}</td><td>${nm(set[k].heavy)}</td></tr>`).join('');
  return `<table><tr><th>SWIPE</th><th>LIGHT</th><th>HEAVY</th></tr>${tr(w.ground)}<tr><th colspan="3">IN THE AIR</th></tr>${tr(w.air)}<tr><td>TAP</td><td colspan="2">${w.dodge.rope ? 'Hook-zip dodge' : 'Dodge'} / parry</td></tr></table>`;
}

/**
 * Weapon picking by key: 1-9 and 0 pick the first ten, Q / E step to the previous / next weapon.
 * (Arrow keys move the focus through the grid instead: ui/nav.ts.)
 */
function pickByKey(code: string, btns: HTMLButtonElement[], isSel: (b: HTMLButtonElement) => boolean, arrows: boolean): boolean {
  if (!btns.length) return false;
  let i = -1;
  if (code.startsWith('Digit')) { const n = parseInt(code.slice(5), 10); i = n === 0 ? 9 : n - 1; }
  else if (code === 'KeyQ' || code === 'KeyE' || (arrows && (code === 'ArrowLeft' || code === 'ArrowRight'))) {
    const cur = Math.max(0, btns.findIndex(isSel));
    const d = code === 'KeyQ' || code === 'ArrowLeft' ? -1 : 1;
    i = (cur + d + btns.length) % btns.length;
  } else return false;
  if (i < 0 || i >= btns.length) return false;
  btns[i].click();
  btns[i].scrollIntoView?.({ block: 'nearest' });
  return true;
}

/** Mobile Performance also drops costly CSS (glows, looping animations). */
export function applyPerfClass(): void {
  document.body.classList.toggle('perf', settings.mobilePerf);
  document.body.classList.toggle('calm', settings.reduceFlashes);
}
