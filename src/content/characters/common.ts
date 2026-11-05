/**
 * Shared condition helpers for character plans. Everything here reads the
 * world; nothing mutates it.
 */
import { minutesToTick } from '../../sim/clock';
import { itemLooseInRoom, itemRoom } from '../../sim/query';
import { S } from '../../sim/registry';
import type { AgentState, CharacterId, ItemId, PlanStep, RoomId, World } from '../../sim/types';

/** A knock at `door` heard since the agent last answered one. */
export function knockedRecently(w: World, a: AgentState, door: string, withinMinutes = 3): boolean {
  const b = a.beliefs[`knock:${door}`];
  if (!b) return false;
  const tick = Number(b.value);
  if (tick <= Number(a.flags.lastKnockAnswered ?? -1)) return false;
  return w.tick - tick <= minutesToTick(withinMinutes);
}

export function bellRecently(w: World, a: AgentState, withinMinutes = 4): boolean {
  const b = a.beliefs['bell:desk'];
  if (!b) return false;
  const tick = Number(b.value);
  if (tick <= Number(a.flags.lastBellAnswered ?? -1)) return false;
  return w.tick - tick <= minutesToTick(withinMinutes);
}

/** Sleeping pills still where Vivian keeps them, or on her. */
export function pillsAvailable(w: World, a: AgentState): boolean {
  const pills = w.items.sleeping_pills;
  if (!pills) return false;
  if (Number(pills.state.count ?? 0) < 6) return false;
  const loc = pills.loc;
  if (loc.kind === 'agent') return loc.agent === a.id;
  return loc.kind === 'fixture' && loc.fixture === 'vanity';
}

export function trayInKitchen(w: World): boolean {
  return itemLooseInRoom(w, 'nightcap_tray', 'kitchen');
}

export function trayPrepared(w: World): boolean {
  return w.items.nightcap_tray?.state.prepared === true;
}

export function trayConsumed(w: World): boolean {
  return w.items.nightcap_tray?.state.consumed === true;
}

/** Others this agent believes (from recent sight) to be in `room`. */
export function believedIn(w: World, a: AgentState, room: RoomId, except: CharacterId[] = [], withinMinutes = 2): CharacterId[] {
  const out: CharacterId[] = [];
  for (const key of Object.keys(a.beliefs)) {
    if (!key.startsWith('whereIs:')) continue;
    const who = key.slice('whereIs:'.length) as CharacterId;
    if (who === a.id || except.includes(who)) continue;
    const b = a.beliefs[key]!;
    if (b.value !== room) continue;
    if (w.tick - b.tick > minutesToTick(withinMinutes)) continue;
    out.push(who);
  }
  return out;
}

/** Seen with one's own eyes at or after `tick`. */
export function seenSince(a: AgentState, who: CharacterId, tick: number): boolean {
  const b = a.beliefs[`whereIs:${who}`];
  return !!b && b.source === 'seen' && b.tick >= tick;
}

export function sawRecently(w: World, a: AgentState, who: CharacterId, withinMinutes = 1): boolean {
  const b = a.beliefs[`whereIs:${who}`];
  return !!b && b.source === 'seen' && w.tick - b.tick <= minutesToTick(withinMinutes);
}

/** A portable item lying loose on a floor tile of `room` (not in a fixture). */
export function looseItemOnFloor(w: World, room: RoomId): ItemId | undefined {
  const s = S();
  const ids = s.itemIds;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    const it = w.items[id]!;
    if (it.loc.kind !== 'tile') continue;
    if (!s.items[id]!.portable) continue;
    if (itemRoom(w, id) === room) return id;
  }
  return undefined;
}

export function idlePlan(room: RoomId, spot: string): PlanStep[] {
  return [
    { do: 'goTo', args: { room, spot }, label: 'go home' },
    { do: 'wait', label: 'idle' },
  ];
}

export function hasItem(a: AgentState, item: ItemId): boolean {
  return a.inventory.includes(item);
}
