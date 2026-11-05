/**
 * Immediate reactions to percepts. Generic rules give every character a
 * sensible baseline (fear at a body, suspicion at an intruder); character
 * definitions add their own on top. Reactions may pre-empt the current plan
 * by changing moods and beliefs that goal priorities read.
 */
import { minutesToTick } from '../clock';
import { decide, emit, type Static } from '../registry';
import type { AgentState, Percept, ReactionDef, World } from '../types';
import { setBelief } from './beliefs';
import { adjustMood } from './mood';

function onCooldown(w: World, a: AgentState, key: string, minutes: number): boolean {
  const until = a.reactionCooldowns[key];
  if (until !== undefined && w.tick < until) return true;
  a.reactionCooldowns[key] = w.tick + minutesToTick(minutes);
  return false;
}

function matches(r: ReactionDef, p: Percept): boolean {
  return Array.isArray(r.on) ? r.on.includes(p.kind) : r.on === p.kind;
}

function describePercept(p: Percept): string {
  switch (p.kind) {
    case 'saw_agent':
      return `saw ${p.who}${p.blood ? ' (blood)' : ''}${p.weapon ? ` (${p.weapon})` : ''}${p.intruder ? ' (intruder)' : ''}`;
    case 'saw_body':
      return `saw ${p.who}'s body`;
    case 'saw_item':
      return `saw ${p.item}`;
    case 'item_missing':
      return `${p.item} missing`;
    case 'saw_gesture':
      return `saw ${p.who} ${p.gesture}`;
    case 'heard':
      return `heard ${p.sound}${p.by ? ` from ${p.by}` : ''}`;
    case 'threatened':
      return `threatened by ${p.by}`;
    case 'attacked':
      return `attacked by ${p.by}`;
  }
}

function genericReactions(w: World, s: Static, a: AgentState, p: Percept): void {
  switch (p.kind) {
    case 'saw_body': {
      if (a.flags[`killed:${p.who}`]) return;
      if (onCooldown(w, a, `body:${p.who}`, 30)) return;
      adjustMood(w, a.id, 'fear', 4, `found ${p.who}'s body`);
      setBelief(w, a.id, 'murderHappened', true, 1, 'seen');
      decide(w, a.id, `found ${p.who}'s body in ${p.room}`);
      return;
    }
    case 'saw_agent': {
      if (p.blood && !onCooldown(w, a, `blood:${p.who}`, 20)) {
        adjustMood(w, a.id, 'fear', 3, `${p.who} has blood on them`);
        adjustMood(w, a.id, 'suspicion', 2, `${p.who} has blood on them`);
      }
      if (p.weapon && !a.flags[`killed:${p.who}`]) {
        const nav = s.nav;
        const d = nav.chebyshev(nav.cellOf(a.pos), nav.cellOf(w.agents[p.who]!.pos));
        if (d <= 2 && !onCooldown(w, a, `weapon:${p.who}`, 5)) {
          adjustMood(w, a.id, 'fear', 2, `${p.who} is holding ${p.weapon}`);
        }
      }
      if (p.intruder && !onCooldown(w, a, `intruder:${p.who}`, 10)) {
        adjustMood(w, a.id, 'suspicion', 2, `${p.who} is in my room`);
        adjustMood(w, a.id, 'anger', 1, `${p.who} is in my room`);
        setBelief(w, a.id, `intruded:${p.who}`, true, 1, 'seen');
      }
      return;
    }
    case 'heard': {
      switch (p.sound) {
        case 'scream':
          if (!onCooldown(w, a, 'scream', 3)) {
            adjustMood(w, a.id, 'fear', 2, 'heard a scream');
            adjustMood(w, a.id, 'suspicion', 1, 'heard a scream');
            setBelief(w, a.id, 'heardScream', w.tick, 1, 'heard');
          }
          break;
        case 'gunshot':
          if (!onCooldown(w, a, 'gunshot', 3)) {
            adjustMood(w, a.id, 'fear', 3, 'heard a gunshot');
            setBelief(w, a.id, 'heardGunshot', w.tick, 1, 'heard');
          }
          break;
        case 'argument':
          if (!onCooldown(w, a, 'argument', 5)) adjustMood(w, a.id, 'suspicion', 0.5, 'heard an argument');
          break;
        case 'knock':
          if (p.text) setBelief(w, a.id, `knock:${p.text}`, w.tick, 1, 'heard');
          break;
        case 'bell':
          setBelief(w, a.id, 'bell:desk', w.tick, 1, 'heard');
          break;
        case 'creak':
          setBelief(w, a.id, 'creak:main_stair', w.tick, 1, 'heard');
          break;
        default:
          break;
      }
      return;
    }
    case 'item_missing': {
      const owners = s.rooms[p.room]?.owners;
      if (!owners || !owners.includes(a.id)) return;
      if (!onCooldown(w, a, `missing:${p.item}`, 30)) {
        adjustMood(w, a.id, 'suspicion', 1, `${p.item} is missing from my room`);
        decide(w, a.id, `${p.item} is gone from ${p.room}`);
      }
      return;
    }
    default:
      return;
  }
}

export function react(w: World, s: Static, a: AgentState, percepts: Percept[]): void {
  if (!a.alive || a.incapacity) return;
  const def = s.characters[a.id];
  if (!def) return;
  for (const p of percepts) {
    genericReactions(w, s, a, p);
    for (const r of def.reactions) {
      if (!matches(r, p)) continue;
      if (r.once && a.flags[`reacted:${r.id}`]) continue;
      if (r.when && !r.when(w, a, p)) continue;
      if (r.cooldownMinutes !== undefined && onCooldown(w, a, `def:${r.id}`, r.cooldownMinutes)) continue;
      a.flags[`reacted:${r.id}`] = true;
      emit(w, { type: 'Reaction', tick: w.tick, agent: a.id, reaction: r.id, percept: describePercept(p) });
      r.do(w, a, p, { emit: (ev) => emit(w, ev), decide: (text) => decide(w, a.id, text) });
    }
  }
}
