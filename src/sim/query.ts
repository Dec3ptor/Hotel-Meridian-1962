/**
 * Read-only helpers for content conditions and the engine. All take the
 * world first and reach static content through the active registry.
 */
import { parseTime, tickToMinutes, timeToTick } from './clock';
import { S } from './registry';
import type { AgentState, BeliefValue, CharacterId, DoorState, FixtureId, GameTime, ItemId, ItemLoc, RoomId, TilePos, World } from './types';

export function now(w: World): number {
  return tickToMinutes(w.tick);
}

export function tickOf(t: GameTime): number {
  return timeToTick(t);
}

/** True once the clock has reached `t`. */
export function after(w: World, t: GameTime): boolean {
  return w.tick >= timeToTick(t);
}

export function before(w: World, t: GameTime): boolean {
  return w.tick < timeToTick(t);
}

export function minutesSince(w: World, tick: number): number {
  return tickToMinutes(w.tick - tick);
}

export function agent(w: World, id: CharacterId): AgentState {
  const a = w.agents[id];
  if (!a) throw new Error(`Unknown agent ${id}`);
  return a;
}

export function alive(w: World, id: CharacterId): boolean {
  return w.agents[id]?.alive === true;
}

export function dead(w: World, id: CharacterId): boolean {
  return w.agents[id]?.alive === false;
}

export function incapacitated(w: World, id: CharacterId): boolean {
  const a = w.agents[id];
  return !a || !a.alive || a.incapacity !== undefined;
}

export function drowsy(w: World, id: CharacterId): boolean {
  const a = w.agents[id];
  return !!a && a.alive && (a.incapacity === 'drowsy' || a.incapacity === 'asleep');
}

export function roomOf(w: World, id: CharacterId): RoomId {
  return agent(w, id).room;
}

export function inRoom(w: World, id: CharacterId, room: RoomId): boolean {
  const a = w.agents[id];
  return !!a && a.alive && a.room === room;
}

/** Number of living agents in a room other than `except`. */
export function othersIn(w: World, room: RoomId, except?: CharacterId): number {
  let n = 0;
  for (const id of S().characterOrder) {
    if (id === except) continue;
    const a = w.agents[id]!;
    if (a.alive && a.room === room && !a.hiddenIn) n++;
  }
  return n;
}

export function anyoneIn(w: World, room: RoomId, except?: CharacterId): boolean {
  return othersIn(w, room, except) > 0;
}

export function agentsIn(w: World, room: RoomId): CharacterId[] {
  const out: CharacterId[] = [];
  for (const id of S().characterOrder) {
    const a = w.agents[id]!;
    if (a.room === room) out.push(id);
  }
  return out;
}

export function has(w: World, id: CharacterId, item: ItemId): boolean {
  const a = w.agents[id];
  return !!a && a.inventory.includes(item);
}

export function hasWeapon(w: World, id: CharacterId): ItemId | undefined {
  const a = w.agents[id];
  if (!a) return undefined;
  for (const it of a.inventory) {
    if (S().items[it]?.weapon) return it;
  }
  return undefined;
}

export function hasGun(w: World, id: CharacterId): ItemId | undefined {
  const a = w.agents[id];
  if (!a) return undefined;
  for (const it of a.inventory) {
    const def = S().items[it];
    if (def?.weapon === 'gun' && (w.items[it]?.state.loaded ?? def.loaded ?? true)) return it;
  }
  return undefined;
}

export function itemLoc(w: World, item: ItemId): ItemLoc {
  const it = w.items[item];
  if (!it) throw new Error(`Unknown item ${item}`);
  return it.loc;
}

export function itemState(w: World, item: ItemId, key: string): BeliefValue | undefined {
  return w.items[item]?.state[key];
}

export function fixtureState(w: World, fixture: FixtureId, key: string): BeliefValue | undefined {
  return w.fixtures[fixture]?.state[key];
}

export function itemInFixture(w: World, item: ItemId, fixture: FixtureId): boolean {
  const loc = w.items[item]?.loc;
  return !!loc && loc.kind === 'fixture' && loc.fixture === fixture;
}

export function itemsInFixture(w: World, fixture: FixtureId): ItemId[] {
  const out: ItemId[] = [];
  for (const [id, it] of Object.entries(w.items)) {
    if (it.loc.kind === 'fixture' && it.loc.fixture === fixture) out.push(id);
  }
  return out;
}

/** The room an item physically occupies, following containers and carriers. */
export function itemRoom(w: World, item: ItemId): RoomId | undefined {
  const loc = w.items[item]?.loc;
  if (!loc) return undefined;
  const s = S();
  switch (loc.kind) {
    case 'tile':
      return s.nav.roomOfCell(s.nav.cell(loc.floor, loc.x, loc.y));
    case 'agent':
      return w.agents[loc.agent]?.room;
    case 'fixture':
      return s.fixtures[loc.fixture]?.room;
    default:
      return undefined;
  }
}

export function itemInRoom(w: World, item: ItemId, room: RoomId): boolean {
  return itemRoom(w, item) === room;
}

/** Item is carried by nobody and sits in a given room (on a tile or in a fixture). */
export function itemLooseInRoom(w: World, item: ItemId, room: RoomId): boolean {
  const loc = w.items[item]?.loc;
  if (!loc || loc.kind === 'agent' || loc.kind === 'void') return false;
  return itemRoom(w, item) === room;
}

export function carrier(w: World, item: ItemId): CharacterId | undefined {
  const loc = w.items[item]?.loc;
  return loc && loc.kind === 'agent' ? loc.agent : undefined;
}

export function door(w: World, id: string): DoorState {
  const d = w.doors[id];
  if (!d) throw new Error(`Unknown door ${id}`);
  return d;
}

export function doorLocked(w: World, id: string): boolean {
  return door(w, id).locked;
}

export function doorOpen(w: World, id: string): boolean {
  return door(w, id).open;
}

export function belief(w: World, id: CharacterId, fact: string): BeliefValue | undefined {
  return w.agents[id]?.beliefs[fact]?.value;
}

export function confidence(w: World, id: CharacterId, fact: string): number {
  return w.agents[id]?.beliefs[fact]?.confidence ?? 0;
}

export function believes(w: World, id: CharacterId, fact: string, value: BeliefValue, minConfidence = 0.5): boolean {
  const b = w.agents[id]?.beliefs[fact];
  return !!b && b.value === value && b.confidence >= minConfidence;
}

export function flag(w: World, key: string): BeliefValue | undefined {
  return w.flags[key];
}

export function agentFlag(w: World, id: CharacterId, key: string): BeliefValue | undefined {
  return w.agents[id]?.flags[key];
}

export function cellOf(p: TilePos): number {
  return S().nav.cellOf(p);
}

export function agentCell(w: World, id: CharacterId): number {
  return S().nav.cellOf(agent(w, id).pos);
}

/** Chebyshev tile distance between two agents (1000 across floors). */
export function dist(w: World, a: CharacterId, b: CharacterId): number {
  const nav = S().nav;
  return nav.chebyshev(nav.cellOf(agent(w, a).pos), nav.cellOf(agent(w, b).pos));
}

export function near(w: World, a: CharacterId, b: CharacterId, radius = 1): boolean {
  const other = w.agents[b];
  if (!other || !other.alive && radius < 2) {
    // bodies can still be near
  }
  return dist(w, a, b) <= radius;
}

export function spotPos(room: RoomId, spot: string): TilePos {
  const r = S().rooms[room];
  if (!r) throw new Error(`Unknown room ${room}`);
  const sp = r.spots[spot];
  if (!sp) throw new Error(`Unknown spot ${spot} in ${room}`);
  return { floor: r.floor, x: sp.x, y: sp.y };
}

export function fixturePos(fixture: FixtureId): TilePos {
  const s = S();
  const f = s.fixtures[fixture];
  if (!f) throw new Error(`Unknown fixture ${fixture}`);
  const room = s.rooms[f.room]!;
  return { floor: room.floor, x: f.at.x, y: f.at.y };
}

/** Approach tile for an item: where it lies, or the approach tile of its container. */
export function itemApproachCell(w: World, item: ItemId): number | undefined {
  const s = S();
  const loc = w.items[item]?.loc;
  if (!loc) return undefined;
  if (loc.kind === 'tile') return s.nav.cell(loc.floor, loc.x, loc.y);
  if (loc.kind === 'fixture') return s.nav.cellOf(fixturePos(loc.fixture));
  if (loc.kind === 'agent') return s.nav.cellOf(agent(w, loc.agent).pos);
  return undefined;
}

export function doorCells(door: string): number[] {
  const s = S();
  const i = s.nav.doorIndex[door];
  if (i === undefined) throw new Error(`Unknown door ${door}`);
  return s.nav.doorCells[i]!;
}

/** Distance from an agent to the nearest tile of a door. */
export function distToDoor(w: World, id: CharacterId, door: string): number {
  const nav = S().nav;
  const c = nav.cellOf(agent(w, id).pos);
  let best = Infinity;
  for (const dc of doorCells(door)) {
    const d = nav.chebyshev(c, dc);
    if (d < best) best = d;
  }
  return best;
}

export function isPlayer(id: CharacterId): boolean {
  return id === 'player';
}

export function minutesOf(t: GameTime): number {
  return parseTime(t);
}
