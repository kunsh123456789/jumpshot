import { settings } from '../core/settings';
import type { World } from '../sim/world';
import type { DrawPad } from './pad';
import type { Menus } from './menus';
import { layout } from '../core/layout';
import { audio } from '../core/audio';

interface Step { id: string; text: string; sub: string; hint: number; label: string; dummyAttacks?: boolean }

const STEPS: Step[] = [
  { id: 'move', text: 'DRAG SLOWLY TO MOVE', sub: 'touch the lower half of the screen and slide your thumb left or right', hint: -3, label: 'DRAG ← →' },
  { id: 'jump', text: 'DRAG UP SLOWLY TO JUMP', sub: 'a slow upward drag jumps — keep dragging for a higher jump (W / ↑ on keys). A FAST flick up is an attack instead', hint: 2, label: 'SLOW DRAG ↑' },
  { id: 'strike', text: 'FLICK RIGHT → TO STRIKE', sub: 'a quick flick attacks — your fighter dashes in automatically', hint: 0, label: 'FLICK →' },
  { id: 'launch', text: 'FLICK UP ↑ FAST — JUMPSHOT!', sub: 'the launcher sends them skyward and you leap after them', hint: 2, label: 'FLICK ↑' },
  { id: 'air', text: 'LAUNCH ↑ THEN SWIPE → IN THE AIR', sub: 'juggle them: each air hit keeps you both floating (3 air hits in one jump)', hint: 0, label: '↑  then  → → →' },
  { id: 'spike', text: 'LAUNCH ↑ THEN SWIPE DOWN ↓', sub: 'spike them into the ground from the air (after 5+ air hits a down swipe is the AIR FINISHER)', hint: 6, label: '↑  then  ↓' },
  { id: 'dodge', text: 'DODGE JUST BEFORE THE RED FLASH HITS', sub: 'tap = jump · double-tap (Shift+Space / F) = dodge · dodge at the last moment = PERFECT PARRY', hint: -2, label: 'DOUBLE-TAP', dummyAttacks: true },
  { id: 'zigzag', text: 'ZIG-ZAG FAST TO CHAIN A 10-HIT COMBO', sub: 'each sharp, fast turn fires another attack — no need to lift your finger. When the SPECIAL bar fills, HOLD STILL on the pad (or X) to unleash it', hint: -1, label: '' },
];

/** First-run interactive tutorial against a training dummy. */
export class Tutorial {
  step = 0;
  active = false;
  private get cur(): string { return STEPS[this.step]?.id ?? ''; }
  private progress = 0;
  private doneTimer = 0;
  private dodges = 0;
  private bound = false;
  private walked = 0;
  private lastX = 0;

  constructor(private pad: DrawPad, private menus: Menus, private onFinish: () => void) {}

  start(w: World): void {
    this.active = true;
    this.step = 0;
    this.progress = 0;
    this.doneTimer = 0;
    this.dodges = 0;
    this.walked = 0;
    this.lastX = w.player.x;
    w.spawnDummy(w.player.x + 220);
    this.show(w);
    if (this.bound) return;
    this.bound = true;
    w.events.on('hit', (e) => {
      if (!this.active || this.doneTimer > 0) return;
      const m = e.move;
      switch (this.cur) {
        case 'strike': if (m && (m.family === 'jab' || m.id === 'backfist')) this.advance(); break;
        case 'launch': if (e.kind === 'launch') this.advance(); break;
        case 'air': if (m && m.tags.includes('air') && !m.spike) { if (++this.progress >= 3) this.advance(); } break;
        case 'spike': if (m && m.spike) this.advance(); break;
      }
    });
    w.events.on('parry', () => { if (this.active && this.cur === 'dodge' && this.doneTimer === 0) this.advance(); });
    w.events.on('dodge', () => { if (this.active && this.cur === 'dodge') { this.dodges++; if (this.dodges >= 6 && this.doneTimer === 0) this.advance(); } });
    w.events.on('jump', (e) => { if (this.active && this.cur === 'jump' && !e.air && this.doneTimer === 0) this.advance(); });
  }

  private advance(): void {
    audio.ui('select');
    this.doneTimer = 0.7;
    this.menus.tutorialText('NICE!', '', this.textTop(), () => this.finish());
  }

  private textTop(): number { return layout.portrait ? layout.world.y + layout.world.h * 0.05 : layout.world.y + layout.world.h * 0.16; }

  private show(w: World): void {
    const s = STEPS[this.step];
    this.pad.hint = s.hint;
    // Original tap mode: the dodge step reads as a single tap again.
    const tapDodge = settings.tapAction === 'dodge' && s.label === 'DOUBLE-TAP';
    this.pad.hintLabel = tapDodge ? 'TAP' : s.label;
    w.dummyAttacks = !!s.dummyAttacks;
    this.menus.tutorialText(s.text, tapDodge ? 'tap = dodge · tap at the last moment = PERFECT PARRY' : s.sub, this.textTop(), () => this.finish());
  }

  update(w: World, dt: number): void {
    if (!this.active) return;
    // Keep the dummy alive and near the player.
    for (const e of w.enemies) {
      if (e.kind === 'dummy') { if (e.hp < 1000) e.hp = e.maxHp; }
    }
    if (this.cur === 'move' && this.doneTimer === 0) {
      this.walked += Math.abs(w.player.x - this.lastX);
      if (this.walked > 260) this.advance();
    }
    this.lastX = w.player.x;
    if (this.cur === 'zigzag' && this.doneTimer === 0 && w.combo.hits >= 10) this.advance();
    if (this.cur === 'air' && w.player.grounded && this.progress > 0 && w.player.state !== 'move') this.progress = 0;
    if (this.doneTimer > 0) {
      this.doneTimer -= dt;
      if (this.doneTimer <= 0) {
        this.doneTimer = 0;
        this.step++;
        this.progress = 0;
        if (this.step >= STEPS.length) { this.finish(); return; }
        this.show(w);
      }
    }
  }

  finish(): void {
    if (!this.active) return;
    this.active = false;
    this.pad.hint = -1;
    this.pad.hintLabel = '';
    this.menus.close('tutorial');
    this.onFinish();
  }
}
