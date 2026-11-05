/**
 * Who sees and hears what. Sight follows per-room sightline rules: the same
 * lit room, archways, open doorways near the door, windows and stair heads.
 * Sound propagates across the room graph with attenuation per link type.
 */
import { observe } from './agents/beliefs';
import { emit, S, type Static } from './registry';
import type { AgentState, CharacterId, ItemId, Percept, RoomId, SoundRecord, World } from './types';

const OPEN_DOOR_OBSERVER_RANGE = 3;
const OPEN_DOOR_TARGET_RANGE = 5;
const STAIR_RANGE = 2;

function lit(w: World, room: RoomId): boolean {
  return w.rooms[room]?.lit !== false;
}

/** 0: unseen. 1: a glimpse (window, stairwell): presence only. 2: a clear view: details such as blood or a weapon. */
export type Sight = 0 | 1 | 2;

/** Can `observer` see `target` right now, and how well? */
export function sight(w: World, s: Static, observer: AgentState, target: AgentState): Sight {
  if (observer === target) return 0;
  if (!observer.alive || observer.incapacity === 'asleep') return 0;
  if (target.hiddenIn || target.flags.left || observer.flags.left) return 0;
  if (observer.hiddenIn && observer.room !== target.room) return 0;
  const nav = s.nav;
  if (observer.room !== target.room) {
    const ri0 = nav.roomIndex[observer.room];
    const rj0 = nav.roomIndex[target.room];
    if (ri0 === undefined || rj0 === undefined || nav.linkTable[ri0]![rj0]!.length === 0) return 0;
  }
  const oc = nav.cellOf(observer.pos);
  const tc = nav.cellOf(target.pos);
  if (observer.room === target.room) {
    const def = s.rooms[observer.room]!;
    const d = nav.chebyshev(oc, tc);
    if (!lit(w, observer.room)) return d <= 1 ? 2 : 0;
    if (def.visibility !== undefined) return d <= def.visibility ? (d <= 3 ? 2 : 1) : 0;
    return 2;
  }
  const ri = nav.roomIndex[observer.room];
  const rj = nav.roomIndex[target.room];
  if (ri === undefined || rj === undefined) return 0;
  const links = nav.linkTable[ri]![rj]!;
  for (const link of links) {
    switch (link.kind) {
      case 'archway': {
        if (!lit(w, target.room)) continue;
        const def = s.rooms[target.room]!;
        if (def.visibility !== undefined) {
          const cells = nav.doorCells[link.door!]!;
          if (nav.chebyshev(cells[0]!, tc) > def.visibility) continue;
        }
        return 2;
      }
      case 'door': {
        const doorId = nav.doorIds[link.door!]!;
        if (!w.doors[doorId]!.open) continue;
        if (!lit(w, target.room)) continue;
        for (const dc of nav.doorCells[link.door!]!) {
          if (nav.chebyshev(oc, dc) <= OPEN_DOOR_OBSERVER_RANGE && nav.chebyshev(tc, dc) <= OPEN_DOOR_TARGET_RANGE) return 2;
        }
        continue;
      }
      case 'portal': {
        const pc = nav.portalCells[link.portal!]!;
        const nearEnd = nav.floorOf(pc.a) === observer.pos.floor ? pc.a : pc.b;
        const farEnd = nearEnd === pc.a ? pc.b : pc.a;
        if (nav.chebyshev(oc, nearEnd) <= STAIR_RANGE && nav.chebyshev(tc, farEnd) <= STAIR_RANGE && lit(w, target.room)) return 1;
        continue;
      }
      case 'window': {
        // A window shows people on their feet, not a body on the floor.
        if (!target.alive) continue;
        const win = nav.windows[link.window!]!;
        const inside = nav.cellOf(win.inside);
        const outside = nav.cellOf(win.outside);
        if (observer.room === win.outsideRoom && target.room === win.insideRoom) {
          if (nav.chebyshev(oc, outside) <= win.radiusOutside && nav.chebyshev(tc, inside) <= win.radiusInside && lit(w, win.insideRoom)) return 1;
        } else if (observer.room === win.insideRoom && target.room === win.outsideRoom) {
          const outDef = s.rooms[win.outsideRoom]!;
          const reach = outDef.visibility ?? win.radiusOutside;
          if (nav.chebyshev(oc, inside) <= win.radiusInside && nav.chebyshev(tc, outside) <= reach) return 1;
        }
        continue;
      }
      default:
        continue;
    }
  }
  return 0;
}

export function canSee(w: World, s: Static, observer: AgentState, target: AgentState): boolean {
  return sight(w, s, observer, target) > 0;
}

/** Sound attenuation between rooms: a tiny Dijkstra over the room graph. */
export function roomAttenuation(w: World, s: Static, from: RoomId, to: RoomId, scratch: Float64Array): number {
  const nav = s.nav;
  const n = nav.roomIds.length;
  const src = nav.roomIndex[from];
  const dst = nav.roomIndex[to];
  if (src === undefined || dst === undefined) return Infinity;
  if (src === dst) return 0;
  // scratch holds n distances followed by n "done" flags (0/1).
  for (let i = 0; i < n; i++) {
    scratch[i] = Infinity;
    scratch[n + i] = 0;
  }
  scratch[src] = 0;
  // Dense Dijkstra, n <= 16.
  for (let iter = 0; iter < n; iter++) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      if (scratch[n + i] === 0 && scratch[i]! < bestD) {
        bestD = scratch[i]!;
        best = i;
      }
    }
    if (best < 0) break;
    if (best === dst) return bestD;
    scratch[n + best] = 1;
    for (let j = 0; j < n; j++) {
      if (j === best) continue;
      const links = nav.linkTable[best]![j]!;
      for (const link of links) {
        let cost: number;
        switch (link.kind) {
          case 'archway':
            cost = 0;
            break;
          case 'door':
            cost = w.doors[nav.doorIds[link.door!]!]!.open ? 1 : 2;
            break;
          case 'thinwall':
            cost = 1;
            break;
          case 'portal':
            cost = 1;
            break;
          case 'window':
            cost = 2;
            break;
        }
        if (bestD + cost < scratch[j]!) scratch[j] = bestD + cost;
      }
    }
  }
  return scratch[dst]!;
}

export function canHear(w: World, s: Static, listener: AgentState, sound: SoundRecord, scratch: PerceiveScratch): boolean {
  if (!listener.alive || listener.incapacity === 'asleep') return false;
  if (sound.by === listener.id) return false;
  const nav = s.nav;
  if (listener.room === sound.room) {
    const def = s.rooms[sound.room]!;
    if (def.visibility !== undefined) {
      return nav.chebyshev(nav.cellOf(listener.pos), sound.cell) <= def.visibility + sound.loudness * 2;
    }
    return true;
  }
  if (listener.flags.listeningRoom === sound.room) return true;
  const att = cachedAttenuation(w, s, sound.room, listener.room, scratch);
  return sound.loudness - att >= 1;
}

/** Room-to-room attenuation, memoised until a door changes state. */
function cachedAttenuation(w: World, s: Static, from: RoomId, to: RoomId, scratch: PerceiveScratch): number {
  const n = s.nav.roomIds.length;
  if (scratch.attVersion !== w.doorVersion) {
    scratch.attVersion = w.doorVersion;
    scratch.attCache.fill(-1);
  }
  const i = s.nav.roomIndex[from];
  const j = s.nav.roomIndex[to];
  if (i === undefined || j === undefined) return Infinity;
  const idx = i * n + j;
  const hit = scratch.attCache[idx]!;
  if (hit >= 0) return hit;
  const v = roomAttenuation(w, s, from, to, scratch.attenuation);
  scratch.attCache[idx] = v;
  return v;
}

function visibleWeapon(w: World, s: Static, holder: AgentState): ItemId | undefined {
  for (const it of holder.inventory) {
    const def = s.items[it];
    if (!def?.weapon) continue;
    const loc = w.items[it]!.loc;
    if (loc.kind === 'agent' && loc.concealed) continue;
    return it;
  }
  return undefined;
}

export interface PerceiveScratch {
  attenuation: Float64Array;
  attCache: Float64Array;
  attVersion: number;
}

export function createScratch(s: Static): PerceiveScratch {
  const n = s.nav.roomIds.length;
  return { attenuation: new Float64Array(n * 2), attCache: new Float64Array(n * n).fill(-1), attVersion: -1 };
}

/**
 * Fill `out` with everything `a` perceives this tick and update beliefs
 * about who and what is where. Sounds and gestures come from the pending
 * queues (produced last tick).
 */
export function perceive(w: World, s: Static, a: AgentState, out: Percept[], scratch: PerceiveScratch): void {
  out.length = 0;
  if (!a.alive || a.incapacity === 'asleep') return;
  const nav = s.nav;
  let mask = 0;
  const renotice = w.tick % 25 === 0;
  const K = s.keys;
  for (let i = 0; i < s.characterOrder.length; i++) {
    const id = s.characterOrder[i]!;
    if (id === a.id) continue;
    const b = w.agents[id]!;
    const bit = 1 << i;
    const whereKey = K.whereIs[id]!;
    const quality = sight(w, s, a, b);
    if (quality === 0) {
      // Lost sight of someone last believed to be in my own room: they have left.
      if ((a.visibleMask & bit) !== 0) {
        const where = a.beliefs[whereKey];
        if (where && where.value === a.room && b.room !== a.room) observe(w, a.id, whereKey, 'unknown', 'inferred', 0.8);
      }
      continue;
    }
    mask |= bit;
    const isNew = (a.visibleMask & bit) === 0;
    if (!b.alive) {
      const known = a.beliefs[K.dead[id]!];
      observe(w, a.id, K.dead[id]!, true, 'seen');
      observe(w, a.id, whereKey, b.room, 'seen');
      if (!known || isNew) {
        emit(w, { type: 'SawBody', tick: w.tick, agent: a.id, body: id, room: b.room });
        out.push({ kind: 'saw_body', who: id, room: b.room });
      }
      continue;
    }
    const where = a.beliefs[whereKey];
    const roomChanged = !!where && where.source === 'seen' && where.value !== b.room;
    if (!where || where.value !== b.room || where.source !== 'seen') observe(w, a.id, whereKey, b.room, 'seen');
    else where.tick = w.tick;
    const blood = quality === 2 && b.flags.bloody === true;
    const weapon = quality === 2 ? visibleWeapon(w, s, b) : undefined;
    if (blood) observe(w, a.id, K.bloody[id]!, true, 'seen');
    if (weapon) observe(w, a.id, K.armed[id]!, weapon, 'seen');
    const owners = s.rooms[a.room]!.owners;
    const ownRoom = owners !== undefined && owners.includes(a.id);
    const coOwner = owners !== undefined && owners.includes(id);
    const intruder = ownRoom && !coOwner && b.room === a.room && !a.flags[K.expecting[id]!] && !b.flags[`invitedTo:${a.room}`];
    const detail = blood ? 'blood' : weapon ? `carrying ${weapon}` : undefined;
    const detailNew = detail !== undefined && a.flags[`sawDetail:${id}`] !== detail;
    if (isNew || roomChanged || detailNew) {
      emit(w, { type: 'Saw', tick: w.tick, agent: a.id, target: id, room: b.room, detail });
      if (detail !== undefined) a.flags[`sawDetail:${id}`] = detail;
    }
    if (isNew || renotice || detailNew) {
      out.push({ kind: 'saw_agent', who: id, room: b.room, blood, weapon, intruder, isNew });
    }
  }
  a.visibleMask = mask;

  // Items: on room entry and once a game minute.
  if (w.tick - a.lastItemScanTick >= 25) {
    a.lastItemScanTick = w.tick;
    if (lit(w, a.room) && !a.hiddenIn) {
      const roomIdx = nav.roomIndex[a.room]!;
      const itemIds = s.itemIds;
      for (let k = 0; k < itemIds.length; k++) {
        const itemId = itemIds[k]!;
        const it = w.items[itemId]!;
        const loc = it.loc;
        let here = false;
        let where: string = a.room;
        if (loc.kind === 'tile') {
          here = nav.roomIdx[nav.cell(loc.floor, loc.x, loc.y)] === roomIdx;
        } else if (loc.kind === 'fixture') {
          const f = s.fixtures[loc.fixture]!;
          here = f.room === a.room && f.openContainer === true;
          where = loc.fixture;
        }
        const itemKey = K.itemAt[itemId]!;
        const belief = a.beliefs[itemKey];
        if (here) {
          if (!belief || belief.value !== where) {
            emit(w, { type: 'SawItem', tick: w.tick, agent: a.id, item: itemId, room: a.room });
            out.push({ kind: 'saw_item', item: itemId, room: a.room });
            observe(w, a.id, itemKey, where, 'seen');
          } else {
            belief.tick = w.tick;
          }
        } else if (belief && belief.source === 'seen' && !a.inventory.includes(itemId)) {
          // Expected here (loose in this room, or in an open container here) but gone.
          const expectedHere =
            belief.value === a.room || (typeof belief.value === 'string' && s.fixtures[belief.value]?.room === a.room && s.fixtures[belief.value]?.openContainer);
          if (expectedHere) {
            emit(w, { type: 'NoticedMissing', tick: w.tick, agent: a.id, item: itemId, room: a.room });
            out.push({ kind: 'item_missing', item: itemId, room: a.room });
            observe(w, a.id, itemKey, 'missing', 'inferred', 0.9);
          }
        }
      }
    }
  }

  // Gestures from last tick.
  for (const g of w.pendingGestures) {
    if (g.agent === a.id) continue;
    const b = w.agents[g.agent]!;
    if (!canSee(w, s, a, b)) continue;
    emit(w, { type: 'SawGesture', tick: w.tick, agent: a.id, target: g.agent, gesture: g.gesture });
    out.push({ kind: 'saw_gesture', who: g.agent, gesture: g.gesture });
  }

  // Sounds from last tick.
  for (const snd of w.pendingSounds) {
    if (!canHear(w, s, a, snd, scratch)) continue;
    if (snd.kind !== 'speech' || snd.room !== a.room) {
      emit(w, { type: 'Heard', tick: w.tick, agent: a.id, kind: snd.kind, room: snd.room, by: snd.by, text: snd.text });
    }
    out.push({ kind: 'heard', sound: snd.kind, room: snd.room, by: snd.by, text: snd.text, loudness: snd.loudness });
  }
}

export function agentIndexOf(s: Static, id: CharacterId): number {
  return s.agentIndex[id] ?? -1;
}
