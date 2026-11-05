/**
 * Cross-loop player knowledge. Items never carry over; facts, clues,
 * witnessed events, what people said, theories and endings do. Pure data
 * and pure merge functions; storage lives in the game layer.
 */
import type { CharacterId, EndingId, FactKey, Scalar, World, WorldEvent } from './types';

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
  kind: string;
}

export interface PersonRecord {
  id: CharacterId;
  met: boolean;
  /** topic -> lines heard */
  said: Record<string, string[]>;
  lastSeenRoom?: string;
}

export interface Theories {
  killer?: CharacterId;
  driver?: CharacterId;
}

export interface PlayerMemory {
  version: 2;
  loops: number;
  facts: Record<FactKey, { value: Scalar; loop: number }>;
  clues: Record<string, ClueRecord>;
  witnessed: WitnessedEvent[];
  people: Record<string, PersonRecord>;
  endings: Record<EndingId, number>;
  endingOrder: EndingId[];
  theories: Theories;
}

export function createMemory(): PlayerMemory {
  return { version: 2, loops: 0, facts: {}, clues: {}, witnessed: [], people: {}, endings: {}, endingOrder: [], theories: {} };
}

export function learnFact(mem: PlayerMemory, fact: FactKey, value: Scalar, loop: number): boolean {
  if (mem.facts[fact] && mem.facts[fact]!.value === value) return false;
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

function person(mem: PlayerMemory, id: CharacterId): PersonRecord {
  return (mem.people[id] ??= { id, met: false, said: {} });
}

/** Which events the player was present for, and how to word them. */
export function witnessFilter(w: World, ev: WorldEvent): { room: string; kind: string } | undefined {
  const p = w.agents.player;
  if (!p) return undefined;
  switch (ev.type) {
    case 'SawBody':
    case 'NoticedMissing':
      return ev.agent === 'player' ? { room: ev.room, kind: ev.type } : undefined;
    case 'Saw':
      return ev.agent === 'player' && ev.detail ? { room: ev.room, kind: ev.type } : undefined;
    case 'Heard':
      return ev.agent === 'player' && ev.kind !== 'speech' && ev.kind !== 'thunder' ? { room: ev.room, kind: ev.type } : undefined;
    case 'Said':
      return ev.storylet !== 'fallback' && (ev.room === p.room || ev.to === 'player' || ev.speaker === 'player') ? { room: ev.room, kind: ev.type } : undefined;
    case 'ClueFound':
      return { room: p.room, kind: ev.type };
    case 'Looked':
      return ev.close ? { room: p.room, kind: ev.type } : undefined;
    case 'Attacked':
    case 'Died':
      return ev.room === p.room && !p.hiddenIn ? { room: ev.room, kind: ev.type } : p.hiddenIn && ev.room === p.room ? { room: ev.room, kind: ev.type } : undefined;
    case 'WorldEvent':
      return { room: p.room, kind: ev.type };
    default:
      return undefined;
  }
}

/** Fold a finished loop into memory. Returns the same object, mutated. */
export function absorbLoop(mem: PlayerMemory, w: World, describe: (ev: WorldEvent) => string): PlayerMemory {
  mem.loops = Math.max(mem.loops, w.loop);
  if (w.ended?.ending) {
    mem.endings[w.ended.ending] = (mem.endings[w.ended.ending] ?? 0) + 1;
    if (!mem.endingOrder.includes(w.ended.ending)) mem.endingOrder.push(w.ended.ending);
  }
  // Facts learned this loop are flagged on the world.
  for (const [key, v] of Object.entries(w.flags)) {
    if (!key.startsWith('known:') || v !== true) continue;
    learnFact(mem, key.slice('known:'.length), true, w.loop);
  }
  const player = w.agents.player;
  if (player) {
    for (const [key, b] of Object.entries(player.beliefs)) {
      if (b.source === 'start' || b.source === 'memory') continue;
      if (key.startsWith('whereIs:') || key.startsWith('itemAt:')) continue;
      learnFact(mem, key, b.value, w.loop);
    }
  }
  const seen = new Set(mem.witnessed.map((e) => `${e.loop}:${e.tick}:${e.text}`));
  for (const ev of w.log) {
    if (ev.type === 'ClueFound') addClue(mem, { id: `${ev.source}:${ev.fact}`, text: ev.text, proves: [ev.fact] }, w.loop, ev.tick);
    const wf = witnessFilter(w, ev);
    if (!wf) continue;
    const text = describe(ev);
    const key = `${w.loop}:${ev.tick}:${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    mem.witnessed.push({ loop: w.loop, tick: ev.tick, room: wf.room, text, kind: wf.kind });
    if (ev.type === 'Said' && ev.speaker !== 'player') {
      const rec = person(mem, ev.speaker);
      if (ev.to === 'player') rec.met = true;
      const topic = ev.topic ?? 'overheard';
      const lines = (rec.said[topic] ??= []);
      if (!lines.includes(ev.text) && lines.length < 6) lines.push(ev.text);
    }
    if (ev.type === 'Saw' && ev.agent === 'player') person(mem, ev.target).lastSeenRoom = ev.room;
  }
  for (const ev of w.log) {
    if (ev.type === 'Saw' && ev.agent === 'player') {
      const rec = person(mem, ev.target);
      rec.lastSeenRoom = ev.room;
    }
  }
  if (mem.witnessed.length > 600) mem.witnessed.splice(0, mem.witnessed.length - 600);
  return mem;
}

export function serializeMemory(mem: PlayerMemory): string {
  return JSON.stringify(mem);
}

export function deserializeMemory(text: string): PlayerMemory {
  const parsed = JSON.parse(text) as Partial<PlayerMemory>;
  if (parsed.version !== 2) return createMemory();
  return { ...createMemory(), ...parsed };
}
