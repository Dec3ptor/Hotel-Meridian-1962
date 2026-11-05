/**
 * Cross-loop player knowledge. Items never carry over; facts, clues,
 * witnessed events and endings do. Phase 1 defines the structure and the
 * pure merge; Phase 5 adds storage and the notebook.
 */
import type { CharacterId, EndingId, FactKey, World, WorldEvent } from './types';

export interface ClueRecord {
  id: string;
  text: string;
  proves: FactKey[];
  loop: number;
  tick: number;
}

export interface WitnessedEvent {
  loop: number;
  tick: number;
  room: string;
  text: string;
}

export interface PersonRecord {
  id: CharacterId;
  met: boolean;
  said: Record<string, string[]>; // topic -> lines heard
}

export interface PlayerMemory {
  version: 1;
  loops: number;
  facts: Record<FactKey, { value: string | number | boolean; loop: number }>;
  clues: Record<string, ClueRecord>;
  witnessed: WitnessedEvent[];
  people: Record<string, PersonRecord>;
  endings: Record<EndingId, number>; // ending -> times reached
}

export function createMemory(): PlayerMemory {
  return { version: 1, loops: 0, facts: {}, clues: {}, witnessed: [], people: {}, endings: {} };
}

export function learnFact(mem: PlayerMemory, fact: FactKey, value: string | number | boolean, loop: number): boolean {
  if (mem.facts[fact]) return false;
  mem.facts[fact] = { value, loop };
  return true;
}

export function knows(mem: PlayerMemory, fact: FactKey): boolean {
  return mem.facts[fact] !== undefined;
}

export function addClue(mem: PlayerMemory, clue: Omit<ClueRecord, 'loop' | 'tick'>, loop: number, tick: number): boolean {
  if (mem.clues[clue.id]) return false;
  mem.clues[clue.id] = { ...clue, loop, tick };
  for (const f of clue.proves) learnFact(mem, f, true, loop);
  return true;
}

/** Events the player was present for, in prose, for the notebook timeline. */
export function playerWitnessed(w: World, ev: WorldEvent): boolean {
  const p = w.agents.player;
  if (!p) return false;
  switch (ev.type) {
    case 'Saw':
    case 'SawBody':
    case 'SawItem':
    case 'Heard':
    case 'SawGesture':
    case 'NoticedMissing':
      return ev.agent === 'player';
    case 'Said':
      return ev.room === p.room;
    case 'Told':
      return ev.to === 'player' || ev.from === 'player';
    default:
      return false;
  }
}

/** Fold a finished loop into memory. Pure: returns the same object mutated. */
export function absorbLoop(mem: PlayerMemory, w: World, describe: (ev: WorldEvent) => string): PlayerMemory {
  mem.loops = Math.max(mem.loops, w.loop);
  if (w.ended?.ending) mem.endings[w.ended.ending] = (mem.endings[w.ended.ending] ?? 0) + 1;
  const player = w.agents.player;
  if (player) {
    for (const [key, b] of Object.entries(player.beliefs)) {
      if (b.source === 'start') continue;
      if (key.startsWith('whereIs:') || key.startsWith('itemAt:')) continue;
      learnFact(mem, key, b.value, w.loop);
    }
  }
  for (const ev of w.log) {
    if (!playerWitnessed(w, ev)) continue;
    mem.witnessed.push({ loop: w.loop, tick: ev.tick, room: player?.room ?? '', text: describe(ev) });
    if (ev.type === 'Said' && ev.speaker !== 'player') {
      const person = (mem.people[ev.speaker] ??= { id: ev.speaker, met: true, said: {} });
      const topic = ev.topic ?? 'misc';
      const lines = (person.said[topic] ??= []);
      if (!lines.includes(ev.text)) lines.push(ev.text);
    }
  }
  return mem;
}

export function serializeMemory(mem: PlayerMemory): string {
  return JSON.stringify(mem);
}

export function deserializeMemory(text: string): PlayerMemory {
  const parsed = JSON.parse(text) as Partial<PlayerMemory>;
  if (parsed.version !== 1) return createMemory();
  return { ...createMemory(), ...parsed } as PlayerMemory;
}
