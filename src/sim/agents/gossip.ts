import { chance, randomInt } from '../rng';
import { decide, type Static } from '../registry';
import type { AgentState, FactKey, World } from '../types';
import { minutesToTick } from '../clock';
import { tell, trustFactor } from './beliefs';

const BOOKKEEPING = ['whereIs:', 'itemAt:', 'knock:', 'bell:', 'creak:', 'intruded:', 'attackedBy:', 'heard'];

/** Perception bookkeeping facts are not worth repeating. */
function gossipable(key: FactKey): boolean {
  for (const p of BOOKKEEPING) if (key.startsWith(p)) return false;
  return true;
}

function candidates(w: World, s: Static, speaker: AgentState, listener: AgentState, out: FactKey[]): FactKey[] {
  out.length = 0;
  const def = s.characters[speaker.id]!;
  const trust = speaker.relationships[listener.id]?.trust ?? 3;
  const loose = speaker.mood.drunk >= 6 && trust >= 5;
  for (const key of Object.keys(speaker.beliefs)) {
    if (!gossipable(key)) continue;
    const b = speaker.beliefs[key]!;
    if (b.confidence < 0.6) continue;
    if (def.secrets.includes(key) && !loose) continue;
    const theirs = listener.beliefs[key];
    const effective = b.confidence * 0.8 * trustFactor(w, listener.id, speaker.id);
    if (theirs && theirs.value === b.value && theirs.confidence >= effective * 0.9) continue;
    const last = speaker.flags[`gossiped:${key}:${listener.id}`];
    if (last !== undefined && w.tick - Number(last) < minutesToTick(30)) continue;
    out.push(key);
  }
  return out;
}

const scratch: FactKey[] = [];

/**
 * Once per game minute: idle agents sharing a room may swap a fact. Trust
 * and drink raise the odds; secrets only slip out when drunk and trusting.
 */
export function gossipPass(w: World, s: Static): void {
  const order = s.characterOrder;
  for (let i = 0; i < order.length; i++) {
    const a = w.agents[order[i]!]!;
    if (!a.alive || a.incapacity || a.hiddenIn || a.id === 'player') continue;
    if (a.busyUntil !== undefined && w.tick < a.busyUntil) continue;
    for (let j = 0; j < order.length; j++) {
      if (i === j) continue;
      const b = w.agents[order[j]!]!;
      if (!b.alive || b.incapacity || b.hiddenIn || b.id === 'player') continue;
      if (b.room !== a.room) continue;
      if (b.busyUntil !== undefined && w.tick < b.busyUntil) continue;
      const def = s.characters[a.id]!;
      const trust = a.relationships[b.id]?.trust ?? 3;
      const p = def.chattiness * 0.5 * (0.5 + trust / 10) + a.mood.drunk * 0.02;
      if (!chance(w, p)) continue;
      const facts = candidates(w, s, a, b, scratch);
      if (facts.length === 0) continue;
      const fact = facts[randomInt(w, facts.length)]!;
      const belief = a.beliefs[fact]!;
      a.flags[`gossiped:${fact}:${b.id}`] = w.tick;
      tell(w, a.id, b.id, fact, belief.value, belief.confidence * 0.8);
      decide(w, a.id, `gossips to ${b.id}: ${fact} = ${String(belief.value)}`);
    }
  }
}
