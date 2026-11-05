import type { AgentState, Belief, CharacterId, ItemLoc, World } from './types';
import type { Static } from './registry';
import { seedState } from './rng';

function cloneLoc(loc: ItemLoc): ItemLoc {
  return { ...loc };
}

/** Builds the initial world for a loop from static content. Pure: same inputs, same world. */
export function createWorld(s: Static, seed: number, loop = 1): World {
  const { content, nav } = s;
  const w: World = {
    seed,
    rng: seedState(seed + loop * 7919),
    tick: 0,
    loop,
    rooms: {},
    doors: {},
    fixtures: {},
    items: {},
    agents: {} as Record<CharacterId, AgentState>,
    flags: {},
    scheduleFired: {},
    log: [],
    decisions: [],
    commands: [],
    pendingSounds: [],
    pendingGestures: [],
    doorVersion: 0,
  };
  for (const r of content.map.rooms) {
    w.rooms[r.id] = { lit: r.lit ?? true, blood: false };
  }
  for (const d of content.map.doors) {
    w.doors[d.id] = {
      open: d.kind === 'archway' ? true : d.startOpen ?? false,
      locked: d.startLocked ?? false,
    };
  }
  for (const f of content.fixtures) {
    w.fixtures[f.id] = { state: { ...(f.state ?? {}) } };
  }
  for (const it of content.items) {
    w.items[it.id] = { loc: cloneLoc(it.start), state: { ...(it.state ?? {}) } };
  }
  content.characters.forEach((def) => {
    const room = s.rooms[def.startRoom];
    if (!room) throw new Error(`${def.id}: unknown start room ${def.startRoom}`);
    const spot = room.spots[def.startSpot];
    if (!spot) throw new Error(`${def.id}: unknown spot ${def.startSpot} in ${def.startRoom}`);
    const beliefs: Record<string, Belief> = {};
    for (const [k, b] of Object.entries(def.beliefs)) {
      beliefs[k] = { value: b.value, confidence: b.confidence, source: 'start', tick: 0 };
    }
    const relationships: Record<string, { trust: number; knowsSecret: boolean }> = {};
    for (const [k, r] of Object.entries(def.relationships)) relationships[k] = { ...r };
    const goalStates: AgentState['goalStates'] = {};
    for (const g of def.goals) goalStates[g.id] = { status: 'idle', planIndex: -1, step: 0, stepStartedTick: 0 };
    const inventory: string[] = [];
    for (const itemId of def.inventory) {
      const item = w.items[itemId];
      if (!item) throw new Error(`${def.id}: unknown inventory item ${itemId}`);
      if (item.loc.kind !== 'agent' || item.loc.agent !== def.id) {
        throw new Error(`${def.id}: item ${itemId} is listed in inventory but starts elsewhere`);
      }
      inventory.push(itemId);
    }
    for (const it of content.items) {
      if (it.start.kind === 'agent' && it.start.agent === def.id && !inventory.includes(it.id)) {
        throw new Error(`${def.id}: item ${it.id} starts on this character but is missing from inventory`);
      }
    }
    const pos = { floor: room.floor, x: spot.x, y: spot.y };
    if (!nav.walkable[nav.cellOf(pos)]) throw new Error(`${def.id}: start spot is not walkable`);
    w.agents[def.id] = {
      id: def.id,
      pos,
      room: def.startRoom,
      facing: 2,
      speed: def.speed,
      goalStates,
      beliefs,
      mood: { ...def.mood },
      relationships,
      inventory,
      alive: true,
      flags: { ...(def.flags ?? {}) },
      path: [],
      pathTarget: -1,
      moveProgress: 0,
      visibleMask: 0,
      reactionCooldowns: {},
      lastItemScanTick: -1000,
    };
  });
  w.log.push({ type: 'LoopStarted', tick: 0, seed, loop });
  return w;
}

/** Deep JSON clone; the world is plain data so this is a faithful copy. */
export function cloneWorld(w: World): World {
  return JSON.parse(JSON.stringify(w)) as World;
}
