import type { WeaponDef } from './types';
import { PLAYER } from '../tuning';

/** FISTS: the original moveset, unchanged (balanced and fast). */
export const fists: WeaponDef = {
  id: 'fists',
  name: 'Fists',
  desc: 'Balanced and fast: strings, a launcher, air kicks and spikes.',
  ground: {
    side: { light: 'jab1', heavy: 'backfist' },
    upDiag: { light: 'hook', heavy: 'knee' },
    up: { light: 'launcher', heavy: 'launcherH' },
    downDiag: { light: 'sweep', heavy: 'slide' },
    down: { light: 'stomp', heavy: 'stompH' },
  },
  air: {
    side: { light: 'akick1', heavy: 'aheavy' },
    upDiag: { light: 'aslash', heavy: 'aslashH' },
    up: { light: 'arise', heavy: 'arise' },
    downDiag: { light: 'spike', heavy: 'spike' },
    down: { light: 'spike', heavy: 'spike' },
  },
  dodge: { distance: PLAYER.dodgeDistance, frames: PLAYER.dodgeFrames, rope: false },
  anims: [],
  smears: {},
  tips: ['→ jab string · heavy: spinning backfist', '↑ JUMPSHOT launcher', '↗ rising hook · ↘ leg sweep', '↓ quake stomp · in the air: spike'],
  icon(ctx, x, y, s, col) {
    // A fist: knuckle bumps over a rounded block.
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const w = s * 0.5, h = s * 0.42, x0 = x - w / 2, y0 = y - h / 2;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) ctx.arc(x0 + w * (0.125 + i * 0.25), y0, w * 0.125, Math.PI, 0);
    ctx.moveTo(x0 + w, y0); ctx.lineTo(x0 + w, y0 + h); ctx.lineTo(x0 + w * 0.15, y0 + h); ctx.quadraticCurveTo(x0 - w * 0.12, y0 + h * 0.6, x0, y0);
    ctx.moveTo(x0 - w * 0.05, y0 + h * 0.35); ctx.lineTo(x0 + w * 0.45, y0 + h * 0.45);
    ctx.stroke();
  },
  held: null,
};
