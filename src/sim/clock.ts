import { DEFAULT_CONFIG, type GameTime, type SimConfig } from './types';

const parsed = new Map<string, number>();

/** Minutes since 10:00 PM for a 'h:mm' string (10:00..11:59 PM, then 12:00..2:00 AM). */
export function parseTime(t: GameTime): number {
  if (typeof t === 'number') return t;
  const hit = parsed.get(t);
  if (hit !== undefined) return hit;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) throw new Error(`Bad game time: ${t}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  // 10, 11 -> PM start; 12, 1, 2 -> after midnight
  const hourOffset = h >= 10 ? h - 10 : h === 12 ? 2 : h + 2;
  const out = hourOffset * 60 + min;
  parsed.set(t, out);
  return out;
}

export function minutesToTick(minutes: number, cfg: SimConfig = DEFAULT_CONFIG): number {
  return Math.round(minutes * cfg.ticksPerMinute);
}

export function timeToTick(t: GameTime, cfg: SimConfig = DEFAULT_CONFIG): number {
  return minutesToTick(parseTime(t), cfg);
}

export function tickToMinutes(tick: number, cfg: SimConfig = DEFAULT_CONFIG): number {
  return tick / cfg.ticksPerMinute;
}

export function loopTicks(cfg: SimConfig = DEFAULT_CONFIG): number {
  return cfg.loopMinutes * cfg.ticksPerMinute;
}

/** "12:47 AM" style clock for a tick. */
export function formatClock(tick: number, cfg: SimConfig = DEFAULT_CONFIG): string {
  const total = Math.floor(tickToMinutes(tick, cfg));
  const absMinutes = 22 * 60 + total; // from 10:00 PM
  const hh24 = Math.floor(absMinutes / 60) % 24;
  const mm = absMinutes % 60;
  const suffix = hh24 >= 12 ? 'PM' : 'AM';
  const hh12 = hh24 % 12 === 0 ? 12 : hh24 % 12;
  return `${hh12}:${mm.toString().padStart(2, '0')} ${suffix}`;
}

/** Short "01:12" style (24h-ish, minutes since 10pm formatted as clock without suffix). */
export function formatShort(tick: number, cfg: SimConfig = DEFAULT_CONFIG): string {
  const total = Math.floor(tickToMinutes(tick, cfg));
  const absMinutes = 22 * 60 + total;
  const hh24 = Math.floor(absMinutes / 60) % 24;
  const mm = absMinutes % 60;
  return `${hh24.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}
