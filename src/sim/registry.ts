import { buildNav, type Nav } from './nav';
import type {
  CharacterDef,
  CharacterId,
  Content,
  DoorDef,
  EndingDef,
  FixtureDef,
  GoalDef,
  ItemDef,
  RoomDef,
  ScheduleDef,
  StoryletDef,
} from './types';
import { timeToTick } from './clock';
import type { EventBus } from './events';
import type { World, WorldEvent } from './types';

/**
 * Static, derived views of the content: indexes by id, the nav grid,
 * storylets bucketed by trigger. Built once per content object and shared
 * by every world created from it. Nothing here is mutated during a night.
 */
export interface Static {
  content: Content;
  nav: Nav;
  rooms: Record<string, RoomDef>;
  doors: Record<string, DoorDef>;
  fixtures: Record<string, FixtureDef>;
  items: Record<string, ItemDef>;
  characters: Record<string, CharacterDef>;
  characterOrder: CharacterId[];
  agentIndex: Record<string, number>;
  storyletsByKey: Record<string, StoryletDef[]>;
  schedule: (ScheduleDef & { tick: number })[];
  endings: EndingDef[];
  /** Fixtures per room id. */
  fixturesInRoom: Record<string, FixtureDef[]>;
  /** Door ids per room id. */
  doorsOfRoom: Record<string, DoorDef[]>;
  /** Item ids in content order (items are never created or destroyed). */
  itemIds: string[];
  /** Goal definitions by character and goal id. */
  goalById: Record<string, Record<string, GoalDef>>;
  /** Precomputed belief keys, so the per-tick loops do no string building. */
  keys: {
    whereIs: Record<string, string>;
    dead: Record<string, string>;
    bloody: Record<string, string>;
    armed: Record<string, string>;
    expecting: Record<string, string>;
    itemAt: Record<string, string>;
  };
}

const cache = new WeakMap<Content, Static>();

export function storyletKey(s: StoryletDef): string {
  const t = s.trigger;
  if ('topic' in t) return `${s.speaker}|topic|${t.topic}`;
  if ('ask' in t) return `${s.speaker}|ask|${t.ask}`;
  if ('tell' in t) return `${s.speaker}|tell|${t.tell}`;
  if ('show' in t) return `${s.speaker}|show|${t.show}`;
  if ('give' in t) return `${s.speaker}|give|${t.give}`;
  if ('accuse' in t) return `${s.speaker}|accuse|${t.accuse}`;
  return `${s.speaker}|scene|${t.scene}`;
}

export function buildStatic(content: Content): Static {
  const existing = cache.get(content);
  if (existing) return existing;
  const nav = buildNav(content);
  const rooms: Record<string, RoomDef> = {};
  for (const r of content.map.rooms) rooms[r.id] = r;
  const doors: Record<string, DoorDef> = {};
  for (const d of content.map.doors) doors[d.id] = d;
  const fixtures: Record<string, FixtureDef> = {};
  const fixturesInRoom: Record<string, FixtureDef[]> = {};
  for (const f of content.fixtures) {
    if (fixtures[f.id]) throw new Error(`Duplicate fixture ${f.id}`);
    fixtures[f.id] = f;
    (fixturesInRoom[f.room] ??= []).push(f);
  }
  const items: Record<string, ItemDef> = {};
  for (const it of content.items) {
    if (items[it.id]) throw new Error(`Duplicate item ${it.id}`);
    if (fixtures[it.id]) throw new Error(`Item and fixture share id ${it.id}`);
    items[it.id] = it;
  }
  const characters: Record<string, CharacterDef> = {};
  const characterOrder: CharacterId[] = [];
  const agentIndex: Record<string, number> = {};
  const goalById: Record<string, Record<string, GoalDef>> = {};
  content.characters.forEach((c, i) => {
    characters[c.id] = c;
    characterOrder.push(c.id);
    agentIndex[c.id] = i;
    goalById[c.id] = {};
    for (const g of c.goals) {
      goalById[c.id]![g.id] = g;
      g.nbTick = g.notBefore === undefined ? -1 : timeToTick(g.notBefore);
      g.dlTick = g.deadline === undefined ? Infinity : timeToTick(g.deadline);
    }
    for (const plans of Object.values(c.plans)) {
      for (const p of plans) {
        for (const st of p.steps) {
          st.nbTick = st.notBefore === undefined ? -1 : timeToTick(st.notBefore);
          st.dlTick = st.deadline === undefined ? Infinity : timeToTick(st.deadline);
        }
      }
    }
  });
  const storyletsByKey: Record<string, StoryletDef[]> = {};
  for (const s of content.storylets) {
    (storyletsByKey[storyletKey(s)] ??= []).push(s);
  }
  for (const list of Object.values(storyletsByKey)) list.sort((a, b) => b.priority - a.priority);
  const schedule = content.schedule
    .map((s) => ({ ...s, tick: timeToTick(s.at) }))
    .sort((a, b) => a.tick - b.tick);
  const doorsOfRoom: Record<string, DoorDef[]> = {};
  for (const d of content.map.doors) {
    (doorsOfRoom[d.between[0]] ??= []).push(d);
    (doorsOfRoom[d.between[1]] ??= []).push(d);
  }
  const endings = [...content.endings].sort((a, b) => b.priority - a.priority);
  const keys: Static['keys'] = { whereIs: {}, dead: {}, bloody: {}, armed: {}, expecting: {}, itemAt: {} };
  for (const id of characterOrder) {
    keys.whereIs[id] = `whereIs:${id}`;
    keys.dead[id] = `dead:${id}`;
    keys.bloody[id] = `bloody:${id}`;
    keys.armed[id] = `armed:${id}`;
    keys.expecting[id] = `expecting:${id}`;
  }
  const itemIds = content.items.map((it) => it.id);
  for (const id of itemIds) keys.itemAt[id] = `itemAt:${id}`;
  const s: Static = {
    content,
    nav,
    rooms,
    doors,
    fixtures,
    items,
    characters,
    characterOrder,
    agentIndex,
    storyletsByKey,
    schedule,
    endings,
    fixturesInRoom,
    doorsOfRoom,
    itemIds,
    goalById,
    keys,
  };
  cache.set(content, s);
  return s;
}

let active: Static | undefined;
let activeBus: EventBus | undefined;

/**
 * Content conditions receive only (world, agent); the static data is reached
 * through here. The Sim re-activates its own static and bus on every step, so
 * several sims may be stepped in turn without confusion.
 */
export function activate(s: Static, bus?: EventBus): void {
  active = s;
  activeBus = bus;
}

export function S(): Static {
  if (!active) throw new Error('No active content. Create a Sim first.');
  return active;
}

/** Appends to the world log (state) and notifies bus listeners (side channel). */
export function emit(w: World, ev: WorldEvent): void {
  w.log.push(ev);
  if (activeBus) activeBus.dispatch(ev);
}

/** Decision log entry with a reason string. */
export function decide(w: World, agent: CharacterId, text: string): void {
  w.decisions.push({ tick: w.tick, agent, text });
}
