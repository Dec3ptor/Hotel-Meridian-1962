/**
 * "What changed" after a loop: the night just played, compared with the
 * default night for the same seed. Sentences come from differences in where
 * people were, which plans they abandoned, and who died.
 */
import { formatClock } from './clock';
import { createSim } from './sim';
import type { Static } from './registry';
import type { CharacterId, World } from './types';

const baselines = new Map<string, World>();

/** The night with no player input, for a seed and loop; cached. */
export function defaultNight(seed: number, loop: number): World {
  const key = `${seed}:${loop}`;
  const hit = baselines.get(key);
  if (hit) return hit;
  const sim = createSim({ seed, loop });
  sim.runNight();
  baselines.set(key, sim.world);
  return sim.world;
}

interface Stay {
  room: string;
  from: number;
  to: number;
}

function stays(w: World, id: CharacterId): Stay[] {
  const out: Stay[] = [];
  const start = w.log.find((e) => e.type === 'LoopStarted');
  let room = w.agents[id]!.room;
  let from = start ? start.tick : 0;
  // Reconstruct from Moved events; the agent's starting room is the first "from".
  const moves = w.log.filter((e) => e.type === 'Moved' && e.agent === id);
  if (moves.length && moves[0]!.type === 'Moved') room = moves[0].from;
  for (const ev of moves) {
    if (ev.type !== 'Moved') continue;
    out.push({ room, from, to: ev.tick });
    room = ev.to;
    from = ev.tick;
  }
  out.push({ room, from, to: w.tick });
  return out;
}

function inRoomDuring(st: Stay[], room: string, from: number, to: number): boolean {
  return st.some((s) => s.room === room && s.to >= from && s.from <= to);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function whatChanged(w: World, base: World, s: Static, limit = 7): string[] {
  const out: string[] = [];
  const name = (id: CharacterId) => cap(s.characters[id]!.shortName);
  const roomName = (r: string) => (s.rooms[r]?.name ?? r).toLowerCase();
  const cast = s.characterOrder.filter((id) => id !== 'player');
  // Deaths and departures.
  for (const id of cast) {
    const a = w.agents[id]!;
    const b = base.agents[id]!;
    if (!a.alive && b.alive) {
      const died = w.log.find((e) => e.type === 'Died' && e.agent === id);
      out.push(`${name(id)} died${died ? ` at ${formatClock(died.tick)}` : ''}.`);
    } else if (a.alive && !b.alive) {
      out.push(`${name(id)} lived.`);
    }
    if (a.flags.left && !b.flags.left) out.push(`${name(id)} left the hotel.`);
  }
  // Abandoned plans that did not happen in the baseline.
  const baseAbandoned = new Set(base.log.filter((e) => e.type === 'PlanAbandoned').map((e) => (e.type === 'PlanAbandoned' ? `${e.agent}:${e.plan}` : '')));
  const seen = new Set<string>();
  for (const ev of w.log) {
    if (ev.type !== 'PlanAbandoned' || ev.agent === 'player') continue;
    const key = `${ev.agent}:${ev.plan}`;
    if (baseAbandoned.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(`${name(ev.agent)} gave up on "${ev.plan.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}" at ${formatClock(ev.tick)}: ${ev.reason}.`);
    if (out.length >= limit) return out;
  }
  // Rooms never reached, and long stays somewhere new.
  for (const id of cast) {
    const mine = stays(w, id);
    const theirs = stays(base, id);
    for (const st of theirs) {
      if (st.to - st.from < 125) continue; // five minutes
      if (!inRoomDuring(mine, st.room, st.from - 375, st.to + 375)) {
        out.push(`${name(id)} never reached the ${roomName(st.room)} around ${formatClock(st.from)}.`);
        break;
      }
    }
    for (const st of mine) {
      if (st.to - st.from < 500) continue; // twenty minutes
      if (!inRoomDuring(theirs, st.room, st.from, st.to)) {
        out.push(`${name(id)} spent ${formatClock(st.from)} to ${formatClock(st.to)} in the ${roomName(st.room)}.`);
        break;
      }
    }
    if (out.length >= limit) return out;
  }
  if (w.ended?.ending !== base.ended?.ending) out.push('The night ended differently.');
  return out.slice(0, limit);
}
