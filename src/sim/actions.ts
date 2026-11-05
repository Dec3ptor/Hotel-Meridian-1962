/**
 * Verbs as state transitions. Every function mutates the world and emits
 * typed events. Agents' plan steps and (from Phase 2) player commands both
 * go through these, so nothing changes the world without an event.
 */
import { observe, setBelief } from './agents/beliefs';
import { canSee } from './perception';
import { adjustMood } from './agents/mood';
import { minutesToTick } from './clock';
import { hasGun, itemRoom } from './query';
import { decide, emit, S } from './registry';
import type {
  AttackOutcome,
  CharacterId,
  DoorId,
  FixtureId,
  GestureKind,
  ItemId,
  ItemLoc,
  RoomId,
  Scalar,
  SoundKind,
  UseContext,
  World,
} from './types';

export function setFlag(w: World, key: string, value: Scalar): void {
  w.flags[key] = value;
}

// ---------------------------------------------------------------------------
// Sounds and gestures (perceived next tick)
// ---------------------------------------------------------------------------

export function emitSound(w: World, kind: SoundKind, room: RoomId, cell: number, loudness: number, by?: CharacterId, text?: string): void {
  w.pendingSounds.push({ kind, room, cell, loudness, by, text, tick: w.tick });
  if (kind !== 'speech') emit(w, { type: 'Sound', tick: w.tick, kind, room, loudness, by, text });
}

export function soundAtAgent(w: World, kind: SoundKind, by: CharacterId, loudness: number, text?: string): void {
  const a = w.agents[by]!;
  emitSound(w, kind, a.room, S().nav.cellOf(a.pos), loudness, by, text);
}

export function gesture(w: World, agentId: CharacterId, kind: GestureKind): void {
  w.pendingGestures.push({ agent: agentId, gesture: kind, tick: w.tick });
  emit(w, { type: 'Gesture', tick: w.tick, agent: agentId, gesture: kind });
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export function moveItem(w: World, item: ItemId, to: ItemLoc, by?: CharacterId): void {
  const it = w.items[item];
  if (!it) throw new Error(`Unknown item ${item}`);
  const from = it.loc;
  if (from.kind === 'agent') {
    const inv = w.agents[from.agent]!.inventory;
    const i = inv.indexOf(item);
    if (i >= 0) inv.splice(i, 1);
  }
  it.loc = { ...to };
  if (to.kind === 'agent') {
    const inv = w.agents[to.agent]!.inventory;
    if (!inv.includes(item)) inv.push(item);
  }
  emit(w, { type: 'ItemMoved', tick: w.tick, item, from, to: it.loc, by });
}

export function setItemState(w: World, item: ItemId, key: string, value: Scalar, by?: CharacterId): void {
  const it = w.items[item];
  if (!it) throw new Error(`Unknown item ${item}`);
  if (it.state[key] === value) return;
  it.state[key] = value;
  emit(w, { type: 'ItemChanged', tick: w.tick, item, key, value, by });
}

export function setFixtureState(w: World, fixture: FixtureId, key: string, value: Scalar, by?: CharacterId): void {
  const f = w.fixtures[fixture];
  if (!f) throw new Error(`Unknown fixture ${fixture}`);
  if (f.state[key] === value) return;
  f.state[key] = value;
  emit(w, { type: 'FixtureChanged', tick: w.tick, fixture, key, value, by });
}

export function bloody(w: World, agentId: CharacterId): void {
  const a = w.agents[agentId]!;
  if (a.flags.bloody) return;
  a.flags.bloody = true;
  emit(w, { type: 'Bloodied', tick: w.tick, agent: agentId });
}

/** Take a loose item, an item from a container, or an item from a corpse. */
export function takeItem(w: World, agentId: CharacterId, item: ItemId, conceal = false): { ok: boolean; reason?: string } {
  const it = w.items[item];
  if (!it) return { ok: false, reason: `no such item ${item}` };
  const def = S().items[item]!;
  if (!def.portable) return { ok: false, reason: `${item} is not portable` };
  const a = w.agents[agentId]!;
  const from = it.loc;
  if (from.kind === 'agent') {
    if (from.agent === agentId) return { ok: true };
    const holder = w.agents[from.agent]!;
    if (holder.alive) return { ok: false, reason: `${from.agent} is holding ${item}` };
    // Taking from a corpse stains you.
    if (holder.flags.bloody) bloody(w, agentId);
  } else if (from.kind === 'void') {
    return { ok: false, reason: `${item} is nowhere` };
  }
  moveItem(w, item, { kind: 'agent', agent: agentId, concealed: conceal || undefined }, agentId);
  emit(w, { type: 'Took', tick: w.tick, agent: agentId, item, from, room: a.room });
  observe(w, agentId, `itemAt:${item}`, 'me', 'seen');
  // Anyone watching saw who took it.
  const s = S();
  for (const id of s.characterOrder) {
    if (id === agentId) continue;
    const o = w.agents[id]!;
    if (o.room !== a.room && !canSee(w, s, o, a)) continue;
    if (o.room === a.room && !canSee(w, s, o, a)) continue;
    observe(w, id, `itemAt:${item}`, agentId, 'seen');
  }
  return { ok: true };
}

export function giveItem(w: World, from: CharacterId, to: CharacterId, item: ItemId): { ok: boolean; reason?: string } {
  const it = w.items[item];
  if (!it || it.loc.kind !== 'agent' || it.loc.agent !== from) return { ok: false, reason: `${from} does not have ${item}` };
  const receiver = w.agents[to]!;
  if (!receiver.alive) return { ok: false, reason: `${to} is dead` };
  moveItem(w, item, { kind: 'agent', agent: to }, from);
  emit(w, { type: 'Gave', tick: w.tick, from, to, item, room: w.agents[from]!.room });
  setBelief(w, to, `itemAt:${item}`, 'me', 1, 'seen');
  setBelief(w, from, `itemAt:${item}`, to, 1, 'seen');
  return { ok: true };
}

export function dropItem(w: World, agentId: CharacterId, item: ItemId, to?: ItemLoc): { ok: boolean; reason?: string } {
  const it = w.items[item];
  if (!it || it.loc.kind !== 'agent' || it.loc.agent !== agentId) return { ok: false, reason: `${agentId} does not have ${item}` };
  const a = w.agents[agentId]!;
  const dest: ItemLoc = to ?? { kind: 'tile', floor: a.pos.floor, x: a.pos.x, y: a.pos.y };
  moveItem(w, item, dest, agentId);
  emit(w, { type: 'Dropped', tick: w.tick, agent: agentId, item, to: dest, room: a.room });
  const room = itemRoom(w, item);
  setBelief(w, agentId, `itemAt:${item}`, dest.kind === 'fixture' ? dest.fixture : room ?? 'unknown', 1, 'seen');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Doors
// ---------------------------------------------------------------------------

export function hasKeyFor(w: World, agentId: CharacterId, door: DoorId): boolean {
  const a = w.agents[agentId];
  if (!a) return false;
  const s = S();
  for (const it of a.inventory) {
    const def = s.items[it];
    if (!def?.opens) continue;
    if (def.opens === 'all' || def.opens.includes(door)) return true;
  }
  return false;
}

/** Inside a lockable room you can work the latch without a key. */
export function canLatch(w: World, agentId: CharacterId, door: DoorId): boolean {
  const def = S().doors[door];
  const a = w.agents[agentId];
  if (!def || !a) return false;
  const s = S();
  const inside = def.between.find((r) => s.rooms[r]?.owners !== undefined);
  return inside !== undefined && a.room === inside;
}

export function openDoor(w: World, door: DoorId, by?: CharacterId): boolean {
  const d = w.doors[door];
  if (!d) throw new Error(`Unknown door ${door}`);
  if (d.open) return true;
  if (d.locked) {
    if (!by || !(hasKeyFor(w, by, door) || canLatch(w, by, door))) return false;
    d.locked = false;
    emit(w, { type: 'DoorUnlocked', tick: w.tick, door, by });
  }
  d.open = true;
  w.doorVersion++;
  emit(w, { type: 'DoorOpened', tick: w.tick, door, by });
  return true;
}

export function closeDoor(w: World, door: DoorId, by?: CharacterId): boolean {
  const d = w.doors[door];
  if (!d) throw new Error(`Unknown door ${door}`);
  const def = S().doors[door]!;
  if (def.kind === 'archway') return false;
  if (!d.open) return true;
  d.open = false;
  w.doorVersion++;
  emit(w, { type: 'DoorClosed', tick: w.tick, door, by });
  return true;
}

export function lockDoor(w: World, door: DoorId, by: CharacterId): boolean {
  const d = w.doors[door];
  if (!d) throw new Error(`Unknown door ${door}`);
  const def = S().doors[door]!;
  if (!def.lockable) return false;
  if (!(hasKeyFor(w, by, door) || canLatch(w, by, door))) return false;
  if (d.open) closeDoor(w, door, by);
  if (d.locked) return true;
  d.locked = true;
  emit(w, { type: 'DoorLocked', tick: w.tick, door, by });
  return true;
}

export function unlockDoor(w: World, door: DoorId, by: CharacterId): boolean {
  const d = w.doors[door];
  if (!d) throw new Error(`Unknown door ${door}`);
  if (!d.locked) return true;
  if (!(hasKeyFor(w, by, door) || canLatch(w, by, door))) return false;
  d.locked = false;
  emit(w, { type: 'DoorUnlocked', tick: w.tick, door, by });
  return true;
}

export function knock(w: World, agentId: CharacterId, door: DoorId): void {
  const s = S();
  const def = s.doors[door]!;
  const a = w.agents[agentId]!;
  const cell = s.nav.doorCells[s.nav.doorIndex[door]!]![0]!;
  // A knock is heard on both sides of the door.
  for (const room of def.between) {
    w.pendingSounds.push({ kind: 'knock', room, cell, loudness: 2, by: agentId, text: door, tick: w.tick });
  }
  emit(w, { type: 'Sound', tick: w.tick, kind: 'knock', room: a.room, loudness: 2, by: agentId, text: door });
  emit(w, { type: 'Used', tick: w.tick, agent: agentId, target: door, action: 'knock', room: a.room });
}

// ---------------------------------------------------------------------------
// Rooms and movement bookkeeping
// ---------------------------------------------------------------------------

export function setAgentRoom(w: World, agentId: CharacterId, room: RoomId, via?: string): void {
  const a = w.agents[agentId]!;
  if (a.room === room) return;
  const from = a.room;
  a.room = room;
  a.flags.roomChangedTick = w.tick;
  a.lastItemScanTick = -1000;
  emit(w, { type: 'Moved', tick: w.tick, agent: agentId, from, to: room, via });
  setBelief(w, agentId, `whereIs:${agentId}`, room, 1, 'seen');
}

export function hide(w: World, agentId: CharacterId, spot: FixtureId): boolean {
  const def = S().fixtures[spot];
  const a = w.agents[agentId]!;
  if (!def?.hidingSpot) return false;
  if (a.hiddenIn === spot) return true;
  a.hiddenIn = spot;
  emit(w, { type: 'Hid', tick: w.tick, agent: agentId, spot });
  return true;
}

export function unhide(w: World, agentId: CharacterId): void {
  const a = w.agents[agentId]!;
  if (!a.hiddenIn) return;
  const spot = a.hiddenIn;
  a.hiddenIn = undefined;
  emit(w, { type: 'Unhid', tick: w.tick, agent: agentId, spot });
}

// ---------------------------------------------------------------------------
// Uses
// ---------------------------------------------------------------------------

export interface UseResult {
  ok: boolean;
  minutes: number;
  reason?: string;
}

/** Use a fixture (or an item lying in the world) with a named action, optionally with an inventory item. */
export function useTarget(w: World, agentId: CharacterId, target: string, action: string, item?: ItemId): UseResult {
  const s = S();
  const a = w.agents[agentId]!;
  const fixture = s.fixtures[target];
  const itemDef = fixture ? undefined : s.items[target];
  const uses = fixture?.uses ?? itemDef?.uses;
  const use = uses?.[action];
  if (!use) return { ok: false, minutes: 0, reason: `${target} has no use '${action}'` };
  if (item && !a.inventory.includes(item)) return { ok: false, minutes: 0, reason: `${agentId} does not have ${item}` };
  if (use.requiresItem && !a.inventory.includes(use.requiresItem)) {
    return { ok: false, minutes: 0, reason: `${action} ${target} needs ${use.requiresItem}` };
  }
  const ctx: UseContext = { target, item, emit: (ev) => emit(w, ev) };
  emit(w, { type: 'Used', tick: w.tick, agent: agentId, target, action, item, room: a.room });
  if (use.effect) use.effect(w, agentId, ctx);
  if (use.loud) soundAtAgent(w, use.loud, agentId, use.loudness ?? 2, use.text);
  return { ok: true, minutes: use.minutes ?? 0.25 };
}

// ---------------------------------------------------------------------------
// Violence
// ---------------------------------------------------------------------------

export function kill(w: World, victimId: CharacterId, killer: CharacterId | undefined, cause: string): void {
  const v = w.agents[victimId]!;
  if (!v.alive) return;
  v.alive = false;
  v.incapacity = 'dead';
  v.hiddenIn = undefined;
  v.busyUntil = undefined;
  v.current = undefined;
  v.path = [];
  v.pathTarget = -1;
  const bloodyCause = cause === 'knife' || cause === 'gun' || cause === 'shot';
  if (bloodyCause) {
    w.rooms[v.room]!.blood = true;
    v.flags.bloody = true;
    if (killer && cause === 'knife') bloody(w, killer);
  }
  if (killer) {
    setBelief(w, killer, `dead:${victimId}`, true, 1, 'seen');
    w.agents[killer]!.flags[`killed:${victimId}`] = true;
  }
  v.flags.killedBy = killer ?? 'nobody';
  v.flags.causeOfDeath = cause;
  emit(w, { type: 'Died', tick: w.tick, agent: victimId, killer, cause, room: v.room });
  decide(w, victimId, `dies: ${cause}${killer ? ` (${killer})` : ''}`);
}

/**
 * Resolve an attack deterministically:
 *  - an incapacitated or sleeping target dies quietly;
 *  - an awake target holding a loaded gun shoots a non-gun attacker;
 *  - otherwise an armed attacker kills (noisily) and an unarmed one scuffles.
 */
export function attack(w: World, attackerId: CharacterId, targetId: CharacterId, weapon?: ItemId): AttackOutcome {
  const s = S();
  const a = w.agents[attackerId]!;
  const t = w.agents[targetId]!;
  const room = a.room;
  let outcome: AttackOutcome;
  if (!t.alive || t.hiddenIn) {
    outcome = 'failed';
  } else if (t.incapacity) {
    kill(w, targetId, attackerId, weapon ? s.items[weapon]!.weapon ?? 'blunt' : 'strangled');
    soundAtAgent(w, 'struggle', attackerId, 1);
    outcome = 'killed';
  } else {
    const weaponDef = weapon ? s.items[weapon] : undefined;
    const gun = hasGun(w, targetId);
    if (gun && weaponDef?.weapon !== 'gun') {
      kill(w, attackerId, targetId, 'shot');
      soundAtAgent(w, 'gunshot', targetId, 5);
      adjustMood(w, targetId, 'fear', 3, `shot ${attackerId} in self-defence`);
      t.flags[`shot:${attackerId}`] = true;
      outcome = 'shot_attacker';
    } else if (weaponDef) {
      kill(w, targetId, attackerId, weaponDef.weapon ?? 'blunt');
      if (weaponDef.weapon === 'gun') soundAtAgent(w, 'gunshot', attackerId, 5);
      else soundAtAgent(w, 'scream', attackerId, 4, `${targetId} cries out`);
      outcome = 'killed';
    } else {
      soundAtAgent(w, 'struggle', attackerId, 3);
      adjustMood(w, targetId, 'fear', 3, `attacked by ${attackerId}`);
      adjustMood(w, targetId, 'anger', 2, `attacked by ${attackerId}`);
      adjustMood(w, attackerId, 'anger', 1, `fought ${targetId}`);
      setBelief(w, targetId, `attackedBy:${attackerId}`, true, 1, 'seen');
      t.busyUntil = w.tick + minutesToTick(0.5);
      a.busyUntil = w.tick + minutesToTick(0.5);
      outcome = 'scuffle';
    }
  }
  emit(w, { type: 'Attacked', tick: w.tick, attacker: attackerId, target: targetId, weapon, outcome, room });
  return outcome;
}

/** An agent leaves the premises (drives off); they stay in the cast but are out of play. */
export function leave(w: World, agentId: CharacterId, how: string): void {
  const a = w.agents[agentId]!;
  a.flags.left = true;
  a.hiddenIn = undefined;
  a.current = undefined;
  a.path.length = 0;
  a.pathTarget = -1;
  a.busyUntil = undefined;
  emit(w, { type: 'Left', tick: w.tick, agent: agentId, how });
  decide(w, agentId, `leaves: ${how}`);
}

/** Sleeping pills in a drink: drowsy after a while, dead after a double dose. */
export function drug(w: World, agentId: CharacterId, doses: number): void {
  const a = w.agents[agentId]!;
  const total = Number(a.flags.doses ?? 0) + doses;
  a.flags.doses = total;
  if (a.flags.drowsyAt === undefined) a.flags.drowsyAt = w.tick + minutesToTick(12);
  if (total >= 2) a.flags.dieAt = Number(a.flags.drowsyAt) + minutesToTick(15);
  emit(w, { type: 'Drugged', tick: w.tick, agent: agentId, doses: total });
}

/** Per-tick progression of drugs. */
export function tickIncapacity(w: World, agentId: CharacterId): void {
  const a = w.agents[agentId]!;
  if (!a.alive) return;
  const drowsyAt = a.flags.drowsyAt;
  if (drowsyAt !== undefined && w.tick >= Number(drowsyAt) && !a.incapacity) {
    a.incapacity = 'drowsy';
    a.busyUntil = undefined;
    a.current = undefined;
    a.path = [];
    a.pathTarget = -1;
    emit(w, { type: 'Incapacitated', tick: w.tick, agent: agentId, state: 'drowsy' });
    decide(w, agentId, 'drowsy from the drugged nightcap; cannot act');
  }
  const dieAt = a.flags.dieAt;
  if (dieAt !== undefined && w.tick >= Number(dieAt)) {
    kill(w, agentId, undefined, 'overdose');
  }
}
