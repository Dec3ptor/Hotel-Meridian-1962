/**
 * Goal-driven planning. Each tick, after perception and reactions:
 *   3. re-rank goals from priority functions (mood and beliefs feed in);
 *   4. check the active step's precondition and deadline, abandoning the
 *      plan with a logged reason and falling through to the next plan or goal;
 *   5. act: move a step along the path or perform the step's verb.
 *
 * Interrupted goals restart their plan from step 0 when resumed; steps use
 * `skipIf` to pass over work already done.
 */
import {
  attack,
  closeDoor,
  dropItem,
  emitSound,
  gesture,
  giveItem,
  hasKeyFor,
  hide,
  knock,
  lockDoor,
  openDoor,
  setAgentRoom,
  takeItem,
  unhide,
  unlockDoor,
  useTarget,
} from '../actions';
import { minutesToTick, timeToTick } from '../clock';
import { fixturePos, hasWeapon, itemApproachCell, spotPos } from '../query';
import { decide, emit, S, type Static } from '../registry';
import { converse } from '../storylets';
import type { AgentState, ArgValue, CharacterDef, CharacterId, GameTime, GestureKind, GoalDef, ItemId, PlanDef, PlanStep, World } from '../types';
import { setBelief } from './beliefs';

type StepResult = 'done' | 'continue' | { fail: string };

function resolveArg(w: World, a: AgentState, v: ArgValue): string | number | boolean | string[] | undefined {
  return typeof v === 'function' ? v(w, a) : v;
}

function argStr(w: World, a: AgentState, step: PlanStep, name: string): string | undefined {
  const v = resolveArg(w, a, step.args?.[name]);
  return typeof v === 'string' ? v : undefined;
}

function argNum(w: World, a: AgentState, step: PlanStep, name: string): number | undefined {
  const v = resolveArg(w, a, step.args?.[name]);
  return typeof v === 'number' ? v : undefined;
}

function argBool(w: World, a: AgentState, step: PlanStep, name: string): boolean {
  return resolveArg(w, a, step.args?.[name]) === true;
}

function argList(w: World, a: AgentState, step: PlanStep, name: string): string[] | undefined {
  const v = resolveArg(w, a, step.args?.[name]);
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return [v];
  return undefined;
}

function priorityOf(w: World, a: AgentState, g: GoalDef): number {
  return typeof g.priority === 'function' ? g.priority(w, a) : g.priority;
}

function timeOk(w: World, o: { nbTick?: number; dlTick?: number }): boolean {
  return w.tick >= (o.nbTick ?? -1) && w.tick <= (o.dlTick ?? Infinity);
}

function stepLabel(step: PlanStep, index: number): string {
  return step.label ?? `${step.do}#${index}`;
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

export interface MoveOpts {
  avoidRooms?: string[];
  avoidPortals?: string[];
  near: number;
  /** Rooms crossed only at a cost (guests keep out of service areas). */
  costlyRooms?: number;
}

let serviceMaskCache: { s: Static; mask: number } | undefined;

/** Bitmask of service rooms, which guests route around when they can. */
export function serviceRoomMask(s: Static): number {
  if (serviceMaskCache && serviceMaskCache.s === s) return serviceMaskCache.mask;
  const ids = s.content.map.rooms.filter((r) => r.service).map((r) => r.id);
  const mask = s.nav.roomMask(ids);
  serviceMaskCache = { s, mask };
  return mask;
}

/** Doors currently locked that this agent cannot open: a bitmask over door indexes. */
function blockedDoorMask(w: World, s: Static, a: AgentState): number {
  let mask = 0;
  const nav = s.nav;
  for (let i = 0; i < nav.doorIds.length; i++) {
    const id = nav.doorIds[i]!;
    const d = w.doors[id]!;
    if (!d.locked) continue;
    if (hasKeyFor(w, a.id, id)) continue;
    // A latch can be worked from inside the private room.
    const def = nav.doors[i]!;
    const inside = def.between.find((r) => s.rooms[r]?.owners !== undefined);
    if (inside && a.room === inside) continue;
    mask |= 1 << i;
  }
  return mask;
}

function stepOnto(w: World, s: Static, a: AgentState, next: number): boolean {
  const nav = s.nav;
  const cur = nav.cellOf(a.pos);
  const curDoor = nav.doorIdx[cur]!;
  const nextDoor = nav.doorIdx[next]!;
  if (nextDoor >= 0) {
    const id = nav.doorIds[nextDoor]!;
    const d = w.doors[id]!;
    if (!d.open && !openDoor(w, id, a.id)) return false;
  }
  const curFloor = nav.floorOf(cur);
  const nextFloor = nav.floorOf(next);
  let via: string | undefined;
  if (curFloor !== nextFloor) {
    const pi = nav.portalAt[cur]!;
    const portal = nav.portals[pi]!;
    via = portal.id;
    if (portal.creaks) {
      const creakCell = nav.cellOf(portal.a);
      emitSound(w, 'creak', portal.roomA, creakCell, 3, a.id, portal.id);
    }
  }
  const dx = nav.xOf(next) - nav.xOf(cur);
  const dy = nav.yOf(next) - nav.yOf(cur);
  if (curFloor === nextFloor) a.facing = dx > 0 ? 1 : dx < 0 ? 3 : dy > 0 ? 2 : 0;
  a.pos.floor = nextFloor;
  a.pos.x = nav.xOf(next);
  a.pos.y = nav.yOf(next);
  const room = nav.roomOfCell(next);
  if (room !== undefined) setAgentRoom(w, a.id, room, via);
  // Auto-closing doors shut once the agent has stepped off them into a room.
  if (curDoor >= 0 && nextDoor < 0) {
    const def = nav.doors[curDoor]!;
    if (def.autoClose) closeDoor(w, def.id, a.id);
  }
  return true;
}

/** Move toward a cell. Returns the state of the journey this tick. */
export function moveToward(w: World, s: Static, a: AgentState, target: number, opts: MoveOpts): 'arrived' | 'moving' | 'blocked' {
  const nav = s.nav;
  const cur = nav.cellOf(a.pos);
  if (nav.floorOf(cur) === nav.floorOf(target) && nav.chebyshev(cur, target) <= opts.near) {
    a.path.length = 0;
    a.pathTarget = -1;
    return 'arrived';
  }
  if (a.pathTarget !== target || a.path.length === 0) {
    const path = nav.findPath(cur, target, blockedDoorMask(w, s, a), nav.roomMask(opts.avoidRooms), nav.portalMask(opts.avoidPortals), opts.costlyRooms ?? 0);
    if (!path) {
      a.path.length = 0;
      a.pathTarget = -1;
      return 'blocked';
    }
    a.path.length = 0;
    for (let i = 0; i < path.length; i++) a.path.push(path[i]!);
    a.pathTarget = target;
    a.moveProgress = 0;
  }
  if (a.hiddenIn) unhide(w, a.id);
  a.moveProgress += a.speed;
  while (a.moveProgress >= 1 && a.path.length > 0) {
    const next = a.path[0]!;
    if (!stepOnto(w, s, a, next)) {
      a.path.length = 0;
      a.pathTarget = -1;
      return 'blocked';
    }
    a.path.shift();
    a.moveProgress -= 1;
    const c = nav.cellOf(a.pos);
    if (nav.floorOf(c) === nav.floorOf(target) && nav.chebyshev(c, target) <= opts.near) {
      a.path.length = 0;
      a.pathTarget = -1;
      a.moveProgress = 0;
      return 'arrived';
    }
  }
  return a.path.length === 0 ? 'arrived' : 'moving';
}

// ---------------------------------------------------------------------------
// Goal selection
// ---------------------------------------------------------------------------

function goalAvailable(w: World, a: AgentState, g: GoalDef, isCurrent: boolean): boolean {
  const gs = a.goalStates[g.id]!;
  if (gs.status === 'done') return false;
  if (!isCurrent && gs.restUntil !== undefined && w.tick < gs.restUntil) return false;
  if (gs.status === 'failed') {
    if (g.retryAfter === undefined) return false;
    if (w.tick < (gs.failedTick ?? 0) + minutesToTick(g.retryAfter)) return false;
    gs.status = 'idle';
    gs.planIndex = -1;
    gs.step = 0;
  }
  if (!timeOk(w, g)) return false;
  if (g.done && g.done(w, a)) {
    if (!g.persistent) {
      gs.status = 'done';
      gs.completedTick = w.tick;
      return false;
    }
    return false;
  }
  // `active` is a start condition; a goal already under way runs until it completes, fails or is outranked.
  if (!isCurrent && g.active && !g.active(w, a)) return false;
  return true;
}

let currentLapsed = false;

function pickGoal(w: World, a: AgentState, def: CharacterDef, busy: boolean): GoalDef | undefined {
  let best: GoalDef | undefined;
  let bestP = 0;
  const currentId = a.current?.goal;
  let currentStillValid = false;
  let currentP = 0;
  currentLapsed = false;
  for (const g of def.goals) {
    if (!goalAvailable(w, a, g, g.id === currentId)) continue;
    const p = priorityOf(w, a, g);
    if (p <= 0) continue;
    if (g.id === currentId) {
      currentStillValid = true;
      currentP = p;
    }
    if (p > bestP) {
      bestP = p;
      best = g;
    }
  }
  if (currentId !== undefined && !currentStillValid) currentLapsed = true;
  if (busy && currentStillValid && best && best.id !== currentId) {
    // Only urgent goals may interrupt a conversation or a task in progress.
    if (!best.urgent || bestP <= currentP) return currentId ? S().goalById[a.id]?.[currentId] : undefined;
  }
  return best;
}

function switchGoal(w: World, a: AgentState, to: GoalDef | undefined, reason: string): void {
  const from = a.current?.goal;
  if (from) {
    const gs = a.goalStates[from]!;
    if (gs.status === 'active') {
      gs.status = 'idle';
      gs.step = 0; // restart the plan when resumed; skipIf steps pass over done work
    }
  }
  a.path.length = 0;
  a.pathTarget = -1;
  if (to) {
    const gs = a.goalStates[to.id]!;
    gs.status = 'active';
    gs.step = 0;
    gs.stepStartedTick = w.tick;
    a.current = { goal: to.id, plan: '', step: 0 };
  } else {
    a.current = undefined;
  }
  emit(w, { type: 'GoalChanged', tick: w.tick, agent: a.id, from, to: to?.id, reason });
  decide(w, a.id, `goal ${from ?? '-'} -> ${to?.id ?? '-'}: ${reason}`);
}

// ---------------------------------------------------------------------------
// Plan execution
// ---------------------------------------------------------------------------

function choosePlan(w: World, a: AgentState, def: CharacterDef, goal: GoalDef, fromIndex: number): PlanDef | undefined {
  const plans = def.plans[goal.id] ?? [];
  const gs = a.goalStates[goal.id]!;
  for (let i = Math.max(0, fromIndex); i < plans.length; i++) {
    const p = plans[i]!;
    if (p.if && !p.if(w, a)) {
      decide(w, a.id, `skips plan ${p.id}: ${p.ifReason ?? 'not applicable'}`);
      continue;
    }
    gs.planIndex = i;
    gs.step = 0;
    gs.stepStartedTick = w.tick;
    gs.planStartedTick = w.tick;
    a.current = { goal: goal.id, plan: p.id, step: 0 };
    emit(w, { type: 'PlanStarted', tick: w.tick, agent: a.id, goal: goal.id, plan: p.id });
    decide(w, a.id, `starts ${goal.name} via ${p.id}`);
    return p;
  }
  return undefined;
}

function failGoal(w: World, a: AgentState, goal: GoalDef, reason: string): void {
  const gs = a.goalStates[goal.id]!;
  gs.status = 'failed';
  gs.failedTick = w.tick;
  gs.planIndex = -1;
  gs.step = 0;
  a.current = undefined;
  a.path.length = 0;
  a.pathTarget = -1;
  emit(w, { type: 'GoalFailed', tick: w.tick, agent: a.id, goal: goal.id, reason });
  decide(w, a.id, `gives up on ${goal.name}: ${reason}`);
}

function abandonPlan(w: World, a: AgentState, def: CharacterDef, goal: GoalDef, plan: PlanDef, reason: string): void {
  const gs = a.goalStates[goal.id]!;
  emit(w, { type: 'PlanAbandoned', tick: w.tick, agent: a.id, goal: goal.id, plan: plan.id, reason });
  decide(w, a.id, `abandoned ${plan.id}: ${reason}`);
  if (plan.onFail) plan.onFail(w, a);
  a.path.length = 0;
  a.pathTarget = -1;
  const next = choosePlan(w, a, def, goal, gs.planIndex + 1);
  if (!next) failGoal(w, a, goal, 'no more plans');
}

function completePlan(w: World, a: AgentState, goal: GoalDef, plan: PlanDef): void {
  const gs = a.goalStates[goal.id]!;
  emit(w, { type: 'PlanCompleted', tick: w.tick, agent: a.id, goal: goal.id, plan: plan.id });
  decide(w, a.id, `completed ${goal.name} via ${plan.id}`);
  if (plan.onComplete) plan.onComplete(w, a);
  gs.step = 0;
  gs.planIndex = -1;
  gs.completedTick = w.tick;
  gs.status = goal.persistent ? 'idle' : 'done';
  if (goal.persistent) {
    if (goal.repeatAfter !== undefined) gs.restUntil = w.tick + minutesToTick(goal.repeatAfter);
    else if (gs.planStartedTick === w.tick) gs.restUntil = w.tick + minutesToTick(1);
    else gs.restUntil = undefined;
  }
  a.current = undefined;
  a.path.length = 0;
  a.pathTarget = -1;
}

function setBusy(w: World, a: AgentState, minutes: number, what: string): void {
  if (minutes <= 0) return;
  const until = w.tick + minutesToTick(minutes);
  if (a.busyUntil === undefined || until > a.busyUntil) a.busyUntil = until;
  a.busyWith = what;
}

interface Approach {
  cell: number;
  near: number;
  what: string;
}

const approachScratch: Approach = { cell: -1, near: 0, what: '' };

function target(cell: number, near: number, what: string): Approach {
  approachScratch.cell = cell;
  approachScratch.near = near;
  approachScratch.what = what;
  return approachScratch;
}

/** Resolve a goTo-style target. The returned object is a shared scratch: use it before the next call. */
export function approachCell(w: World, s: Static, a: AgentState, step: PlanStep): Approach | { fail: string } {
  const fixture = argStr(w, a, step, 'fixture');
  if (fixture) {
    if (!s.fixtures[fixture]) return { fail: `unknown fixture ${fixture}` };
    return target(s.nav.cellOf(fixturePos(fixture)), argNum(w, a, step, 'near') ?? 0, fixture);
  }
  const agentId = argStr(w, a, step, 'agent') as CharacterId | undefined;
  if (agentId) {
    const other = w.agents[agentId];
    if (!other) return { fail: `unknown agent ${agentId}` };
    return target(s.nav.cellOf(other.pos), argNum(w, a, step, 'near') ?? 1, agentId);
  }
  const item = argStr(w, a, step, 'item');
  if (item) {
    const cell = itemApproachCell(w, item);
    if (cell === undefined) return { fail: `${item} is nowhere` };
    return target(cell, argNum(w, a, step, 'near') ?? 1, item);
  }
  const room = argStr(w, a, step, 'room');
  if (room) {
    const spot = argStr(w, a, step, 'spot') ?? 'default';
    return target(s.nav.cellOf(spotPos(room, spot)), argNum(w, a, step, 'near') ?? 0, room);
  }
  const door = argStr(w, a, step, 'door');
  if (door) {
    const di = s.nav.doorIndex[door];
    if (di === undefined) return { fail: `unknown door ${door}` };
    const cells = s.nav.doorCells[di]!;
    // Stand on the side named by `side` (a room id), else nearest tile next to the door.
    const side = argStr(w, a, step, 'side');
    const nav = s.nav;
    const dc = cells[0]!;
    const nbrs: number[] = [];
    nav.neighbours(dc, nbrs);
    let bestCell = -1;
    let bestD = Infinity;
    const cur = nav.cellOf(a.pos);
    for (const n of nbrs) {
      const r = nav.roomOfCell(n);
      if (side && r !== side) continue;
      const d = nav.dist(cur, n);
      if (d < bestD) {
        bestD = d;
        bestCell = n;
      }
    }
    if (bestCell < 0) return { fail: `no standing tile beside ${door}` };
    return target(bestCell, 0, door);
  }
  const x = argNum(w, a, step, 'x');
  const y = argNum(w, a, step, 'y');
  const floor = argNum(w, a, step, 'floor') ?? a.pos.floor;
  if (x !== undefined && y !== undefined) return target(s.nav.cell(floor, x, y), argNum(w, a, step, 'near') ?? 0, 'a tile');
  return { fail: 'goTo has no target' };
}

function approach(w: World, s: Static, a: AgentState, step: PlanStep, cell: number, near: number, what: string): StepResult {
  const staff = s.characters[a.id]?.staff === true;
  const r = moveToward(w, s, a, cell, {
    avoidRooms: argList(w, a, step, 'avoid'),
    avoidPortals: argList(w, a, step, 'avoidPortals'),
    near,
    costlyRooms: staff || argBool(w, a, step, 'sneak') ? 0 : serviceRoomMask(s),
  });
  if (r === 'arrived') return 'done';
  if (r === 'blocked') return { fail: `no path to ${what}${step.args?.avoid ? ` avoiding ${String(resolveArg(w, a, step.args.avoid))}` : ''}` };
  return 'continue';
}

function execute(w: World, s: Static, a: AgentState, def: CharacterDef, step: PlanStep, startedTick: number): StepResult {
  switch (step.do) {
    case 'goTo': {
      const t = approachCell(w, s, a, step);
      if ('fail' in t) return t;
      return approach(w, s, a, step, t.cell, t.near, t.what);
    }
    case 'wait': {
      if (step.until && step.until(w, a, startedTick)) return 'done';
      const minutes = step.minutes ?? argNum(w, a, step, 'minutes');
      if (minutes !== undefined && w.tick - startedTick >= minutesToTick(minutes)) return 'done';
      return 'continue';
    }
    case 'take': {
      const item = argStr(w, a, step, 'item');
      if (!item) return { fail: 'take: no item' };
      if (a.inventory.includes(item)) return 'done';
      const cell = itemApproachCell(w, item);
      if (cell === undefined) return { fail: `${item} is nowhere to be found` };
      const r = approach(w, s, a, step, cell, 1, item);
      if (r !== 'done') return r;
      const res = takeItem(w, a.id, item, argBool(w, a, step, 'conceal'));
      if (!res.ok) return { fail: res.reason ?? `could not take ${item}` };
      setBusy(w, a, argNum(w, a, step, 'minutes') ?? 0.2, `take ${item}`);
      return 'done';
    }
    case 'use': {
      const target = argStr(w, a, step, 'target');
      const action = argStr(w, a, step, 'action') ?? 'use';
      const item = argStr(w, a, step, 'item');
      if (!target) return { fail: 'use: no target' };
      if (s.doors[target]) {
        const t = approachCell(w, s, a, { ...step, args: { ...step.args, door: target } });
        if ('fail' in t) return t;
        const r = approach(w, s, a, step, t.cell, 0, target);
        if (r !== 'done') return r;
        let ok = true;
        switch (action) {
          case 'knock':
            knock(w, a.id, target);
            break;
          case 'open':
            ok = openDoor(w, target, a.id);
            break;
          case 'close':
            ok = closeDoor(w, target, a.id);
            break;
          case 'lock':
            ok = lockDoor(w, target, a.id);
            break;
          case 'unlock':
            ok = unlockDoor(w, target, a.id);
            break;
          default:
            return { fail: `doors cannot be ${action}ed` };
        }
        if (!ok) return { fail: `cannot ${action} ${target}` };
        setBusy(w, a, 0.2, `${action} ${target}`);
        return 'done';
      }
      let cell: number | undefined;
      let near = 0;
      if (s.fixtures[target]) cell = s.nav.cellOf(fixturePos(target));
      else {
        cell = itemApproachCell(w, target);
        near = 1;
      }
      if (cell === undefined) return { fail: `${target} is nowhere` };
      const r = approach(w, s, a, step, cell, near, target);
      if (r !== 'done') return r;
      const res = useTarget(w, a.id, target, action, item);
      if (!res.ok) return { fail: res.reason ?? `could not ${action} ${target}` };
      setBusy(w, a, argNum(w, a, step, 'minutes') ?? res.minutes, `${action} ${target}`);
      return 'done';
    }
    case 'give': {
      const to = argStr(w, a, step, 'to') as CharacterId | undefined;
      const item = argStr(w, a, step, 'item');
      if (!to || !item) return { fail: 'give: missing to/item' };
      if (!a.inventory.includes(item)) return { fail: `does not have ${item}` };
      const other = w.agents[to];
      if (!other || !other.alive) return { fail: `${to} cannot receive ${item}` };
      const r = approach(w, s, a, step, s.nav.cellOf(other.pos), 1, to);
      if (r !== 'done') return r;
      const res = giveItem(w, a.id, to, item);
      if (!res.ok) return { fail: res.reason ?? 'could not give' };
      setBusy(w, a, 0.2, `give ${item}`);
      return 'done';
    }
    case 'talk': {
      const to = argStr(w, a, step, 'to');
      const topic = argStr(w, a, step, 'topic');
      if (!topic) return { fail: 'talk: no topic' };
      if (!to || to === 'all') {
        const res = converse(w, a.id, undefined, topic);
        setBusy(w, a, res.minutes, `talk ${topic}`);
        return 'done';
      }
      const other = w.agents[to as CharacterId];
      if (!other) return { fail: `unknown agent ${to}` };
      if (!other.alive) return { fail: `${to} is dead` };
      if (other.incapacity) return { fail: `${to} cannot talk (${other.incapacity})` };
      if (other.hiddenIn) return { fail: `${to} is nowhere to be seen` };
      const r = approach(w, s, a, step, s.nav.cellOf(other.pos), argNum(w, a, step, 'near') ?? 2, to);
      if (r !== 'done') return r;
      if (other.busyUntil !== undefined && w.tick < other.busyUntil && !argBool(w, a, step, 'interrupt')) return 'continue';
      const res = converse(w, a.id, other.id, topic);
      setBusy(w, a, res.minutes, `talk ${topic}`);
      setBusy(w, other, res.minutes, `listen ${topic}`);
      return 'done';
    }
    case 'search': {
      const target = argStr(w, a, step, 'target');
      if (!target || !s.fixtures[target]) return { fail: `search: unknown fixture ${target}` };
      const r = approach(w, s, a, step, s.nav.cellOf(fixturePos(target)), 0, target);
      if (r !== 'done') return r;
      const found: ItemId[] = [];
      for (const [id, it] of Object.entries(w.items)) {
        if (it.loc.kind === 'fixture' && it.loc.fixture === target) {
          setBelief(w, a.id, `itemAt:${id}`, target, 1, 'seen');
          found.push(id);
        }
      }
      emit(w, { type: 'Used', tick: w.tick, agent: a.id, target, action: 'search', room: a.room });
      const want = argStr(w, a, step, 'item');
      if (want) {
        if (!found.includes(want)) return { fail: `${want} is not in ${target}` };
        const res = takeItem(w, a.id, want, argBool(w, a, step, 'conceal'));
        if (!res.ok) return { fail: res.reason ?? `could not take ${want}` };
      }
      setBusy(w, a, argNum(w, a, step, 'minutes') ?? 1, `search ${target}`);
      return 'done';
    }
    case 'hide': {
      const spot = argStr(w, a, step, 'fixture');
      if (!spot || !s.fixtures[spot]?.hidingSpot) return { fail: `hide: ${spot} is not a hiding spot` };
      const r = approach(w, s, a, step, s.nav.cellOf(fixturePos(spot)), 0, spot);
      if (r !== 'done') return r;
      hide(w, a.id, spot);
      return 'done';
    }
    case 'lock':
    case 'unlock': {
      const door = argStr(w, a, step, 'door');
      if (!door) return { fail: `${step.do}: no door` };
      const di = s.nav.doorIndex[door];
      if (di === undefined) return { fail: `unknown door ${door}` };
      const dc = s.nav.doorCells[di]![0]!;
      const cur = s.nav.cellOf(a.pos);
      if (s.nav.chebyshev(cur, dc) > 1) {
        const t = approachCell(w, s, a, { ...step, args: { ...step.args, door } });
        if ('fail' in t) return t;
        const r = approach(w, s, a, step, t.cell, 0, door);
        if (r !== 'done') return r;
      }
      const ok = step.do === 'lock' ? lockDoor(w, door, a.id) : unlockDoor(w, door, a.id);
      if (!ok) return { fail: `cannot ${step.do} ${door}` };
      return 'done';
    }
    case 'attack': {
      const target = argStr(w, a, step, 'target') as CharacterId | undefined;
      if (!target) return { fail: 'attack: no target' };
      const other = w.agents[target];
      if (!other) return { fail: `unknown agent ${target}` };
      if (!other.alive) return { fail: `${target} is already dead` };
      const r = approach(w, s, a, step, s.nav.cellOf(other.pos), 1, target);
      if (r !== 'done') return r;
      const weapon = argStr(w, a, step, 'weapon') ?? hasWeapon(w, a.id);
      const outcome = attack(w, a.id, target, weapon);
      if (outcome === 'failed') return { fail: `attack on ${target} failed` };
      setBusy(w, a, 0.5, `attack ${target}`);
      return 'done';
    }
    case 'flee': {
      const room = argStr(w, a, step, 'room') ?? def.homeRoom;
      const spot = argStr(w, a, step, 'spot') ?? (room === def.homeRoom ? def.homeSpot : 'default');
      return approach(w, s, a, step, s.nav.cellOf(spotPos(room, spot)), 0, room);
    }
    case 'drop': {
      const item = argStr(w, a, step, 'item');
      if (!item) return { fail: 'drop: no item' };
      if (!a.inventory.includes(item)) return 'done';
      const into = argStr(w, a, step, 'into');
      if (into) {
        if (!s.fixtures[into]) return { fail: `unknown fixture ${into}` };
        const r = approach(w, s, a, step, s.nav.cellOf(fixturePos(into)), 0, into);
        if (r !== 'done') return r;
        dropItem(w, a.id, item, { kind: 'fixture', fixture: into });
      } else {
        dropItem(w, a.id, item);
      }
      return 'done';
    }
    case 'gesture': {
      const kind = argStr(w, a, step, 'kind') as GestureKind | undefined;
      if (!kind) return { fail: 'gesture: no kind' };
      gesture(w, a.id, kind);
      return 'done';
    }
  }
}

function stepPlan(w: World, s: Static, a: AgentState, def: CharacterDef, goal: GoalDef): void {
  const gs = a.goalStates[goal.id]!;
  const plans = def.plans[goal.id] ?? [];
  let plan: PlanDef | undefined = gs.planIndex >= 0 ? plans[gs.planIndex] : undefined;
  if (plan && gs.step === 0 && a.current?.plan !== plan.id && plan.if && !plan.if(w, a)) {
    // Resuming an interrupted plan whose applicability has lapsed: choose afresh.
    decide(w, a.id, `drops resumed plan ${plan.id}: ${plan.ifReason ?? 'no longer applicable'}`);
    plan = undefined;
    gs.planIndex = -1;
  }
  if (!plan) {
    plan = choosePlan(w, a, def, goal, 0);
    if (!plan) {
      failGoal(w, a, goal, 'no applicable plan');
      return;
    }
  } else if (a.current) {
    a.current.plan = plan.id;
  }
  for (let guard = 0; guard < 12; guard++) {
    if (gs.step >= plan.steps.length) {
      completePlan(w, a, goal, plan);
      return;
    }
    const step = plan.steps[gs.step]!;
    const label = stepLabel(step, gs.step);
    if (step.skipIf && step.skipIf(w, a)) {
      gs.step++;
      gs.stepStartedTick = w.tick;
      a.current!.step = gs.step;
      continue;
    }
    if (w.tick > (step.dlTick ?? Infinity)) {
      abandonPlan(w, a, def, goal, plan, `deadline passed at ${label}`);
      return;
    }
    if (step.if && !step.if(w, a)) {
      abandonPlan(w, a, def, goal, plan, step.ifReason ?? `precondition failed at ${label}`);
      return;
    }
    if (w.tick < (step.nbTick ?? -1)) return;
    const result = execute(w, s, a, def, step, gs.stepStartedTick);
    // The step may have killed, incapacitated or removed this very agent.
    if (!a.alive || a.incapacity || !a.current || a.current.goal !== goal.id) return;
    if (result === 'continue') return;
    if (result === 'done') {
      gs.step++;
      gs.stepStartedTick = w.tick;
      a.current.step = gs.step;
      if (a.busyUntil !== undefined && w.tick < a.busyUntil) return;
      continue;
    }
    abandonPlan(w, a, def, goal, plan, result.fail);
    return;
  }
}

/** One agent's turn: re-rank goals, check the active step, act. */
export function think(w: World, s: Static, a: AgentState): void {
  if (!a.alive || a.incapacity || a.flags.left) return;
  const def = s.characters[a.id];
  if (!def || def.goals.length === 0) return;
  let busy = a.busyUntil !== undefined && w.tick < a.busyUntil;
  if (!busy && a.busyUntil !== undefined) {
    a.busyUntil = undefined;
    a.busyWith = undefined;
    busy = false;
  }
  // A plan whose last step just finished completes before goals are re-ranked,
  // so a `done` condition never swallows its completion.
  if (!busy && a.current) {
    const goal = s.goalById[a.id]?.[a.current.goal];
    const gs = a.goalStates[a.current.goal];
    const plan = goal && gs && gs.planIndex >= 0 ? def.plans[goal.id]?.[gs.planIndex] : undefined;
    if (goal && gs && plan && gs.step >= plan.steps.length) completePlan(w, a, goal, plan);
  }
  const chosen = pickGoal(w, a, def, busy);
  if (chosen?.id !== a.current?.goal) {
    const reason = !a.current
      ? chosen
        ? `${chosen.name} is the best thing to do now`
        : 'nothing to do'
      : currentLapsed
        ? `${a.current.goal} is finished or no longer applies${chosen ? `; ${chosen.name} is next` : ''}`
        : `${chosen!.name} outranks ${a.current.goal}`;
    switchGoal(w, a, chosen, reason);
  }
  if (!a.current || !chosen) return;
  // Plan preconditions are checked even while busy so a doomed plan is dropped early.
  if (busy) {
    const gs = a.goalStates[chosen.id]!;
    const plans = def.plans[chosen.id] ?? [];
    const plan = gs.planIndex >= 0 ? plans[gs.planIndex] : undefined;
    if (plan) {
      const step = plan.steps[gs.step];
      if (step?.if && !(step.skipIf && step.skipIf(w, a)) && !step.if(w, a)) {
        abandonPlan(w, a, def, chosen, plan, step.ifReason ?? `precondition failed at ${stepLabel(step, gs.step)}`);
      }
    } else {
      choosePlan(w, a, def, chosen, 0);
    }
    return;
  }
  stepPlan(w, s, a, def, chosen);
}
