/**
 * Shared condition helpers for character plans. Everything here reads the
 * world; nothing mutates it.
 */
import { minutesToTick } from '../../sim/clock';
import { itemLooseInRoom, itemRoom } from '../../sim/query';
import { S } from '../../sim/registry';
import type { AgentState, CharacterId, GoalDef, ItemId, PlanDef, PlanStep, RoomId, World } from '../../sim/types';

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

/** The player was seen in my room within the last minute and is still there. */
export function intruderPresent(w: World, a: AgentState, room: RoomId): boolean {
  const b = a.beliefs['intruded:player'];
  if (!b || w.tick - b.tick > minutesToTick(1)) return false;
  const where = a.beliefs['whereIs:player'];
  return a.room === room && !!where && where.value === room && w.tick - where.tick <= minutesToTick(0.5);
}

/** Confront a guest who is where they should not be. */
export function confrontIntruderGoal(room: RoomId): GoalDef {
  return {
    id: 'confront_intruder',
    name: 'see off an intruder',
    priority: 86,
    persistent: true,
    repeatAfter: 1.5,
    active: (w, a) => intruderPresent(w, a, room),
  };
}

export function confrontIntruderPlans(): PlanDef[] {
  return [
    {
      id: 'TellThemToLeave',
      steps: [{ do: 'talk', args: { to: 'player', topic: 'get_out', near: 2, interrupt: true }, deadline: undefined, label: 'tell them to get out' }],
    },
  ];
}

export function confrontFollowerGoal(): GoalDef {
  return {
    id: 'confront_follower',
    name: 'shake off a tail',
    priority: 70,
    persistent: true,
    repeatAfter: 10,
    active: (w, a) => a.beliefs['followedBy:player']?.value === true && !!w.agents.player && w.agents.player.alive && w.agents.player.room === a.room,
  };
}

export function confrontFollowerPlans(): PlanDef[] {
  return [
    {
      id: 'AskWhyFollowing',
      steps: [{ do: 'talk', args: { to: 'player', topic: 'being_followed', near: 2 }, label: 'ask why they are following' }],
      onComplete: (w, a) => {
        delete a.beliefs['followedBy:player'];
      },
      onFail: (w, a) => {
        delete a.beliefs['followedBy:player'];
      },
    },
  ];
}

/** Answer a knock at my door: unlock, open, listen, close and lock again. */
export function answerDoorGoal(room: RoomId, door: string): GoalDef {
  return {
    id: 'answer_door',
    name: 'answer the door',
    priority: 80,
    persistent: true,
    active: (w, a) => a.room === room && knockedRecently(w, a, door),
  };
}

export function answerDoorPlans(room: RoomId, door: string, minutes = 1.5): PlanDef[] {
  return [
    {
      id: 'OpenUp',
      steps: [
        { do: 'goTo', args: { room, spot: 'door_inside' }, label: 'go to the door' },
        { do: 'use', args: { target: door, action: 'unlock' }, label: 'unlock' },
        { do: 'use', args: { target: door, action: 'open' }, label: 'open' },
        { do: 'wait', minutes, label: 'see who it is' },
        { do: 'use', args: { target: door, action: 'close' }, label: 'close the door', skipIf: (w, a) => a.flags.leaveDoorOpen === true },
        { do: 'use', args: { target: door, action: 'lock' }, label: 'lock it', skipIf: (w, a) => a.flags.leaveDoorOpen === true },
      ],
      onComplete: (w, a) => {
        a.flags.lastKnockAnswered = Number(a.beliefs[`knock:${door}`]?.value ?? w.tick);
      },
      onFail: (w, a) => {
        a.flags.lastKnockAnswered = Number(a.beliefs[`knock:${door}`]?.value ?? w.tick);
      },
    },
  ];
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
