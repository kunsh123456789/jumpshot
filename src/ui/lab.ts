import { layout } from '../core/layout';
import { ANIMS, ANIM_FILE, getAnim } from '../data/anims';
import { CHANNELS, rebuild, type AnimDef, type EaseId } from '../data/anims/types';
import { evalAnim, animFlags, type AnimFlags } from '../render/animPlayer';
import { Ch, J, JOINT_N, POSE_N, computeJoints, type ChName, type PoseSpec } from '../render/rig';
import { Fighter } from '../sim/fighter';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import { MOVES } from '../data/moves';
import { drawFighter } from '../render/stickman';
import { effects } from '../render/effects';
import { WORLD } from '../data/tuning';
import { audio } from '../core/audio';

/** Which rig/kind previews an animation. */
const KIND_FOR: Record<string, EnemyKind> = {
  punch: 'grunt', lunge: 'rusher', slam: 'brute', kick: 'kicker', throw: 'thrower', bash: 'shield',
  ePunch: 'elite', eLunge: 'elite', eKick: 'elite', hammer: 'boss', bSweep: 'boss', bRush: 'boss',
};
function kindFor(id: string): EnemyKind | 'player' {
  if (id.startsWith('enemy.')) return 'grunt';
  const dot = id.indexOf('.');
  if (dot > 0) return id.slice(0, dot) as EnemyKind;
  return KIND_FOR[id] ?? 'player';
}

const RANGES: Partial<Record<ChName, [number, number, number]>> = {
  rootX: [-60, 60, 1], rootY: [-60, 40, 1], footA: [-70, 70, 1], footB: [-70, 70, 1], liftA: [0, 40, 1], liftB: [0, 40, 1],
  plant: [0, 1, 0.05], flex: [-16, 16, 0.5], stretch: [0.8, 1.3, 0.01], spin: [-6.6, 6.6, 0.01],
};
const EASES: EaseId[] = ['inOut', 'snapIn', 'snapOut', 'out', 'in', 'overshoot', 'hold'];

/**
 * Animation Lab: pick any animation, play/loop/scrub/step it, see onion-skinned
 * key poses and limb arcs, edit key poses live and export them in the exact
 * data-file format, and check contact timing against a reacting dummy.
 */
export class AnimLab {
  active = false;
  onExit: () => void = () => {};
  private root: HTMLDivElement | null = null;
  private def: AnimDef = ANIMS.jab1;
  private t = 0;
  private playing = true;
  private loop = true;
  private speed = 0.5;
  private holdContact = true;
  private onion = true;
  private arcs = true;
  private side = true;
  private holdLeft = 0;
  private keyIdx = 0;
  private time = 0;
  private fighter = new Fighter('player', null);
  private dummy = new Fighter('enemy', ENEMIES.grunt);
  private flags: AnimFlags = { smear: 0, trail: 0, impact: false, reachW: 0, snapping: false };
  private buf = new Float32Array(POSE_N);
  private jn = new Float32Array(JOINT_N * 2);
  private ui: Record<string, HTMLElement> = {};
  private lastContactT = -1;

  enter(): void {
    if (this.active) return;
    this.active = true;
    effects.clear();
    this.build();
    this.select(this.def.id);
  }
  exit(): void {
    this.active = false;
    this.root?.remove();
    this.root = null;
    if (location.hash === '#lab') history.replaceState(null, '', location.pathname + location.search);
    this.onExit();
  }

  // ---------------------------------------------------------------- UI
  private build(): void {
    const r = document.createElement('div');
    r.id = 'lab';
    r.style.cssText = 'position:absolute;inset:0;pointer-events:none;font:12px ui-monospace,monospace;color:#dfe8ff';
    const panel = (css: string) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;pointer-events:auto;background:rgba(8,10,20,.88);border:1px solid rgba(160,200,255,.25);border-radius:10px;padding:8px;' + css; r.appendChild(d); return d; };
    // top bar
    const top = panel('left:8px;top:8px;right:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center');
    top.innerHTML = '<b style="font:900 italic 15px system-ui;color:#ffe14a">ANIMATION LAB</b>';
    const sel = document.createElement('select');
    sel.style.cssText = 'background:#111829;color:#fff;border:1px solid #456;padding:3px;max-width:180px';
    const groups: Record<string, string[]> = {};
    for (const id of Object.keys(ANIMS)) (groups[ANIM_FILE[id] ?? 'other'] ??= []).push(id);
    for (const [g, ids] of Object.entries(groups)) {
      const og = document.createElement('optgroup'); og.label = g;
      for (const id of ids) { const o = document.createElement('option'); o.value = id; o.textContent = id; og.appendChild(o); }
      sel.appendChild(og);
    }
    sel.addEventListener('change', () => this.select(sel.value));
    top.appendChild(sel);
    this.ui.sel = sel;
    const btn = (label: string, fn: () => void) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'background:#1b2540;color:#fff;border:1px solid #456;border-radius:6px;padding:3px 8px;cursor:pointer'; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); top.appendChild(b); return b; };
    const chk = (label: string, get: () => boolean, set: (v: boolean) => void) => {
      const l = document.createElement('label'); l.style.cssText = 'display:flex;gap:3px;align-items:center';
      const i = document.createElement('input'); i.type = 'checkbox'; i.checked = get(); i.addEventListener('change', () => set(i.checked));
      l.appendChild(i); l.append(label); top.appendChild(l);
    };
    this.ui.play = btn('❚❚', () => { this.playing = !this.playing; this.syncUi(); });
    btn('◀ frame', () => this.stepFrame(-1));
    btn('frame ▶', () => this.stepFrame(1));
    chk('loop', () => this.loop, (v) => { this.loop = v; });
    chk('hold on contact', () => this.holdContact, (v) => { this.holdContact = v; });
    chk('onion skin', () => this.onion, (v) => { this.onion = v; });
    chk('arcs', () => this.arcs, (v) => { this.arcs = v; });
    chk('vs dummy', () => this.side, (v) => { this.side = v; });
    const spd = document.createElement('input'); spd.type = 'range'; spd.min = '0.1'; spd.max = '2'; spd.step = '0.05'; spd.value = String(this.speed);
    const spdL = document.createElement('span');
    spd.addEventListener('input', () => { this.speed = parseFloat(spd.value); spdL.textContent = this.speed.toFixed(2) + 'x'; });
    spdL.textContent = this.speed.toFixed(2) + 'x';
    top.append('speed', spd, spdL);
    btn('export ⧉', () => this.exportAnim());
    btn('exit ✕', () => this.exit());
    // timeline
    const bot = panel('left:8px;right:330px;bottom:8px;display:flex;flex-direction:column;gap:4px');
    const scrub = document.createElement('input'); scrub.type = 'range'; scrub.min = '0'; scrub.step = '0.05'; scrub.style.width = '100%';
    scrub.addEventListener('input', () => { this.playing = false; this.t = parseFloat(scrub.value); this.holdLeft = 0; this.syncUi(); });
    bot.appendChild(scrub);
    this.ui.scrub = scrub;
    const keysRow = document.createElement('div'); keysRow.style.cssText = 'position:relative;height:22px';
    bot.appendChild(keysRow);
    this.ui.keys = keysRow;
    const info = document.createElement('div');
    bot.appendChild(info);
    this.ui.info = info;
    // editor
    const ed = panel('right:8px;top:56px;bottom:8px;width:310px;overflow-y:auto');
    this.ui.editor = ed;
    document.getElementById('ui')!.appendChild(r);
    this.root = r;
  }

  private select(id: string): void {
    const def = ANIMS[id];
    if (!def) return;
    this.def = def;
    this.t = 0;
    this.keyIdx = Math.max(0, def.keys.findIndex((k) => k.impact));
    const kind = kindFor(id);
    this.fighter = kind === 'player' ? new Fighter('player', null) : new Fighter('enemy', ENEMIES[kind]);
    this.dummy = new Fighter('enemy', ENEMIES.grunt);
    (this.ui.sel as HTMLSelectElement).value = id;
    (this.ui.scrub as HTMLInputElement).max = String(def.len);
    this.buildKeys();
    this.buildEditor();
    this.syncUi();
  }

  private buildKeys(): void {
    const row = this.ui.keys;
    row.innerHTML = '';
    this.def.keys.forEach((k, i) => {
      const b = document.createElement('button');
      b.textContent = String(k.f);
      b.title = `key ${i}: f${k.f} ${k.e}${k.impact ? ' IMPACT' : ''}${k.smear ? ' smear' : ''}${k.hold ? ' hold' : ''}`;
      b.style.cssText = `position:absolute;left:calc(${(k.f / Math.max(1, this.def.len)) * 100}% - 10px);top:0;width:22px;height:20px;padding:0;font:10px monospace;border-radius:4px;border:1px solid #567;cursor:pointer;color:#fff;background:${k.impact ? '#a02838' : k.smear ? '#285aa0' : '#2a3350'}`;
      b.addEventListener('click', (e) => { e.stopPropagation(); this.keyIdx = i; this.playing = false; this.t = k.f; this.buildEditor(); this.syncUi(); });
      row.appendChild(b);
    });
  }

  private buildEditor(): void {
    const ed = this.ui.editor;
    const spec = this.def.spec.keys.slice().sort((a, b) => a.f - b.f)[this.keyIdx];
    if (!spec) { ed.innerHTML = ''; return; }
    const base = this.def.keys[this.keyIdx].pose;
    ed.innerHTML = `<div style="font:900 13px system-ui;color:#ffe14a;margin-bottom:4px">${this.def.id} · key ${this.keyIdx} · frame ${spec.f}</div>`;
    const es = document.createElement('select');
    for (const e of EASES) { const o = document.createElement('option'); o.value = e; o.textContent = 'ease into: ' + e; es.appendChild(o); }
    es.value = spec.e ?? 'inOut';
    es.style.cssText = 'width:100%;background:#111829;color:#fff;margin-bottom:6px';
    es.addEventListener('change', () => { spec.e = es.value as EaseId; rebuild(this.def); this.buildKeys(); });
    ed.appendChild(es);
    for (const ch of CHANNELS) {
      const [lo, hi, st] = RANGES[ch] ?? [-3.5, 3.5, 0.01];
      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:52px 1fr 48px;gap:4px;align-items:center;margin:1px 0';
      const own = spec.p[ch] !== undefined;
      const val = base[Ch[ch]];
      row.innerHTML = `<span style="color:${own ? '#ffe96a' : '#8796b8'}">${ch}</span>`;
      const inp = document.createElement('input'); inp.type = 'range'; inp.min = String(lo); inp.max = String(hi); inp.step = String(st); inp.value = String(val);
      const num = document.createElement('span'); num.textContent = val.toFixed(2);
      inp.addEventListener('input', () => {
        const v = parseFloat(inp.value);
        spec.p = { ...spec.p, [ch]: v } as PoseSpec;
        num.textContent = v.toFixed(2);
        (row.firstChild as HTMLElement).style.color = '#ffe96a';
        rebuild(this.def);
      });
      row.appendChild(inp); row.appendChild(num);
      ed.appendChild(row);
    }
    const note = document.createElement('div');
    note.style.cssText = 'margin-top:8px;opacity:.7;line-height:1.4';
    note.textContent = 'Yellow = set on this key, grey = inherited from the base pose. Edits apply live; "export" copies the animation in data-file format (and logs it to the console).';
    ed.appendChild(note);
  }

  private syncUi(): void {
    (this.ui.play as HTMLButtonElement).textContent = this.playing ? '❚❚ pause' : '▶ play';
    (this.ui.scrub as HTMLInputElement).value = String(this.t);
    const def = this.def;
    animFlags(def, this.t, this.flags);
    this.ui.info.textContent = `frame ${this.t.toFixed(1)} / ${def.len}  ·  contact ${def.contact}  ·  ${def.loop ? 'loop' : 'one-shot'}  ·  strike ${def.strike}` +
      `${this.flags.smear ? '  ·  SMEAR' : ''}${this.flags.impact ? '  ·  IMPACT' : ''}${MOVES[def.id] ? `  ·  move S${MOVES[def.id].startup} A${MOVES[def.id].active} R${MOVES[def.id].recovery} hitstop ${MOVES[def.id].hitstop}` : ''}`;
  }

  private stepFrame(d: number): void {
    this.playing = false;
    this.t = Math.max(0, Math.min(this.def.len, Math.round(this.t) + d));
    this.syncUi();
  }

  private exportAnim(): void {
    const s = this.def.spec;
    const fmt = (p: PoseSpec) => '{ ' + Object.entries(p).map(([k, v]) => `${k}: ${Math.round((v as number) * 100) / 100}`).join(', ') + ' }';
    const keys = s.keys.slice().sort((a, b) => a.f - b.f).map((k) => {
      const parts = [`f: ${k.f}`, `p: ${fmt(k.p)}`];
      if (k.e) parts.push(`e: '${k.e}'`);
      if (k.hold) parts.push('hold: true');
      if (k.smear) parts.push(`smear: [${k.smear.map((x) => `'${x}'`).join(', ')}]`);
      if (k.impact) parts.push('impact: true');
      if (k.trail) parts.push(`trail: '${k.trail}'`);
      if (k.sfx) parts.push(`sfx: '${k.sfx}'`);
      return `    { ${parts.join(', ')} },`;
    }).join('\n');
    const head = [`id: '${s.id}'`, `len: ${s.len}`];
    if (s.loop) head.push('loop: true');
    if (s.base && s.base !== 'ground') head.push(`base: '${s.base}'`);
    if (s.strike) head.push(`strike: '${s.strike}'`);
    if (s.reach) head.push(`reach: '${s.reach}'`);
    const name = s.id.replace(/\.(\w)/g, (_m, c: string) => c.toUpperCase());
    const text = `// data/anims/${ANIM_FILE[s.id] ?? 'enemies'}.ts\nexport const ${name}: AnimDef = anim({\n  ${head.join(', ')},\n  keys: [\n${keys}\n  ],\n});\n`;
    console.log(text);
    navigator.clipboard?.writeText(text).then(() => { this.ui.info.textContent = 'Exported: copied to clipboard and logged to the console.'; }, () => { this.ui.info.textContent = 'Exported to the console (clipboard unavailable).'; });
  }

  // ---------------------------------------------------------------- frame
  frame(ctx: CanvasRenderingContext2D, dt: number): void {
    const def = this.def;
    const prevT = this.t;
    if (this.playing) {
      if (this.holdLeft > 0) this.holdLeft -= dt * 60 * this.speed;
      else this.t += dt * 60 * this.speed;
      if (this.t >= def.len) { if (this.loop || def.loop) this.t = def.loop ? this.t % def.len : 0; else { this.t = def.len; this.playing = false; } }
      if (this.holdContact && def.contact >= 0 && prevT < def.contact && this.t >= def.contact) {
        this.t = def.contact;
        this.holdLeft = MOVES[def.id]?.hitstop ?? 6;
      }
      this.syncUi();
    }
    this.time += dt;
    effects.update(dt * this.speed);
    const d = layout.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = '#0d1020';
    ctx.fillRect(0, 0, layout.cssW, layout.cssH);
    // stage transform: center the fighter, big
    const sc = Math.min((layout.cssW - 320) / 520, layout.cssH / 420) * 1.0;
    const cx = (layout.cssW - 320) / 2 + 30, gy = layout.cssH * 0.74;
    ctx.setTransform(d * sc, 0, 0, d * sc, d * cx, d * gy);
    ctx.translate(0, -WORLD.groundY);
    // grid + ground
    ctx.strokeStyle = 'rgba(160,200,255,0.07)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -400; x <= 400; x += 40) { ctx.moveTo(x, WORLD.groundY - 400); ctx.lineTo(x, WORLD.groundY); }
    for (let y = WORLD.groundY - 400; y <= WORLD.groundY; y += 40) { ctx.moveTo(-400, y); ctx.lineTo(400, y); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,220,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-420, WORLD.groundY); ctx.lineTo(420, WORLD.groundY); ctx.stroke();

    const f = this.fighter;
    const air = def.base === 'air';
    const fx = -40, fy = air ? WORLD.groundY - 70 : WORLD.groundY;
    // dummy target in front (side-by-side contact check)
    const mv = MOVES[def.id];
    if (this.side) {
      const reach = (mv ? mv.reach : 60) * f.scale;
      const dmy = this.dummy;
      dmy.x = dmy.px = fx + reach + 10; dmy.y = dmy.py = fy;
      dmy.facing = -1;
      let react: AnimDef = getAnim('grunt', 'idle'), rt = this.time * 60;
      if (def.contact >= 0 && this.t >= def.contact) {
        react = mv && (mv.weight >= 0.7 || mv.launch || mv.spike) ? ANIMS.hurtHeavy : ANIMS.hurtLight;
        rt = this.t - def.contact - (this.holdLeft > 0 ? 0 : 0);
        if (this.lastContactT < 0 || prevT < def.contact) { effects.hitSpark(dmy.x - 14, fy - 70, 1, 0, mv?.weight ?? 0.5, mv?.trail.color ?? '#fff'); effects.speedLines(dmy.x - 14, fy - 70, 1, 0, (mv?.weight ?? 0) >= 0.75); audio.hit(mv?.weight ?? 0.5, 1, 'punch'); }
      }
      this.lastContactT = this.t >= def.contact ? this.t : -1;
      this.place(dmy, react, rt, dmy.x, fy, -1);
      dmy.flash = def.contact >= 0 && this.t >= def.contact && this.t < def.contact + 2 ? 1 : 0;
      dmy.hitstop = this.holdLeft > 0 ? 1 : 0;
      drawFighter(ctx, dmy, 1, this.time, 0);
      f.hasLook = true; f.lookX = dmy.x; f.lookY = fy - 62 * dmy.scale - 30;
    } else f.hasLook = false;

    // arcs: limb paths over the whole animation
    if (this.arcs) {
      const cols = ['#7fd8ff', '#5f9fff', '#ffb070', '#ff8a5a'];
      const limbs = [J.handA, J.handB, J.footA, J.footB];
      for (let li = 0; li < 4; li++) {
        ctx.fillStyle = cols[li];
        for (let tt = 0; tt <= def.len; tt += 1) {
          evalAnim(def, tt, this.buf);
          computeJoints(this.buf, fx, fy, 1, f.scale, WORLD.groundY, this.jn, f.anim.rig);
          ctx.globalAlpha = 0.5;
          ctx.fillRect(this.jn[limbs[li] * 2] - 1.5, this.jn[limbs[li] * 2 + 1] - 1.5, 3, 3);
        }
      }
      ctx.globalAlpha = 1;
    }
    // onion skin: every key pose, previous keys blue, next keys orange, contact red
    if (this.onion) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const k of def.keys) {
        evalAnim(def, k.f, this.buf);
        computeJoints(this.buf, fx, fy, 1, f.scale, WORLD.groundY, this.jn, f.anim.rig);
        ctx.strokeStyle = k.impact ? '#ff4060' : k.f <= this.t ? '#4aa0ff' : '#ffa040';
        ctx.globalAlpha = k.impact ? 0.3 : 0.18;
        ctx.lineWidth = 4;
        ctx.beginPath();
        const jn = this.jn;
        const seg = (a: number, b: number) => { ctx.moveTo(jn[a * 2], jn[a * 2 + 1]); ctx.lineTo(jn[b * 2], jn[b * 2 + 1]); };
        seg(J.hip, J.chest); seg(J.chest, J.neck);
        seg(J.shA, J.elbA); seg(J.elbA, J.handA); seg(J.shB, J.elbB); seg(J.elbB, J.handB);
        seg(J.hipA, J.kneeA); seg(J.kneeA, J.footA); seg(J.hipB, J.kneeB); seg(J.kneeB, J.footB);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(jn[J.head * 2], jn[J.head * 2 + 1], f.anim.rig.headR * f.scale, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // the fighter at time t (with smear from t-2)
    this.place(f, def, this.t, fx, fy, 1);
    drawFighter(ctx, f, 1, this.time, 0);
    effects.drawParticles(ctx, false);
    effects.drawParticles(ctx, true);
    effects.drawSpeedLines(ctx, 0.12 / Math.max(0.1, this.speed), 18);
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }

  /** Put a fighter in the exact pose at time t (no blending), with smear source t-2. */
  private place(f: Fighter, def: AnimDef, t: number, x: number, y: number, facing: number): void {
    const a = f.anim;
    f.x = f.px = x; f.y = f.py = y; f.facing = facing;
    f.grounded = y >= WORLD.groundY - 1;
    evalAnim(def, t, a.pose);
    evalAnim(def, Math.max(0, t - 1), a.prevPose);
    evalAnim(def, Math.max(0, t - 2), a.prev2Pose);
    a.prevPose.set(a.pose);
    animFlags(def, t, this.flags);
    a.smear = this.flags.smear;
    a.reachW = a.prevReachW = this.flags.reachW;
    a.reachLimb = def.reach;
    a.face = a.prevFace = facing;
    a.trailActive = false;
    a.cur = def;
    computeJoints(a.pose, x, y, facing, f.scale, WORLD.groundY, a.joints, a.rig);
  }

  onKey(e: KeyboardEvent): boolean {
    if (!this.active) return false;
    if (e.code === 'Space') { this.playing = !this.playing; this.syncUi(); }
    else if (e.code === 'ArrowLeft' || e.code === 'Comma') this.stepFrame(-1);
    else if (e.code === 'ArrowRight' || e.code === 'Period') this.stepFrame(1);
    else if (e.code === 'Escape') this.exit();
    else return false;
    e.preventDefault();
    e.stopImmediatePropagation();
    return true;
  }
}
