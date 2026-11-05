/**
 * Player verbs as sim commands. The UI never touches the world: it enqueues
 * `{tick, action, args}` commands, the sim records them in the input log and
 * carries them out here. Verbs that need the player beside something are
 * queued as pending actions and performed on arrival, so a scripted log can
 * say "take the pills" without spelling out the walk.
 */
import {
  closeDoor,
  dropItem,
  emitSound,
  giveItem,
  hasKeyFor,
  hide,
  knock,
  lockDoor,
  moveItem,
  openDoor,
  takeItem,
  unhide,
  unlockDoor,
  useTarget,
} from './actions';
import { observe, tell } from './agents/beliefs';
import { adjustMood } from './agents/mood';
import { approachCell, moveToward, serviceRoomMask } from './agents/planner';
import { minutesToTick } from './clock';
import { sight } from './perception';
import { hasWeapon } from './query';
import { decide, emit, type Static } from './registry';
import { respondTo } from './storylets';
import type { AgentState, CharacterId, FactKey, ItemId, PendingAction, PlayerCommand, Scalar, World } from './types';
import type { Sim } from './sim';

const LOOK_RANGE = 2;

function str(args: Record<string, Scalar> | undefined, key: string): string | undefined {
  const v = args?.[key];
  return typeof v === 'string' ? v : undefined;
}

function num(args: Record<string, Scalar> | undefined, key: string): number | undefined {
  const v = args?.[key];
  return typeof v === 'number' ? v : undefined;
}

/** The player learns a fact: recorded on the world for this loop and emitted for the notebook. */
export function learn(w: World, fact: FactKey, source: string, text: string): boolean {
  const key = `known:${fact}`;
  if (w.flags[key]) return false;
  w.flags[key] = true;
  observe(w, 'player', fact, true, source);
  emit(w, { type: 'ClueFound', tick: w.tick, fact, source, text });
  return true;
}

export function playerKnows(w: World, fact: FactKey): boolean {
  return w.flags[`known:${fact}`] === true;
}

function moodCue(a: AgentState): string {
  const cues: string[] = [];
  if (!a.alive) return 'dead';
  if (a.incapacity === 'drowsy') cues.push('slumped and glassy-eyed');
  if (a.mood.fear >= 7) cues.push('terrified');
  else if (a.mood.fear >= 5) cues.push('frightened');
  if (a.mood.anger >= 7) cues.push('furious');
  else if (a.mood.anger >= 5) cues.push('angry');
  if (a.mood.suspicion >= 7) cues.push('watching you closely');
  else if (a.mood.suspicion >= 5) cues.push('wary');
  if (a.mood.drunk >= 6) cues.push('drunk');
  else if (a.mood.drunk >= 3) cues.push('a little drunk');
  if (a.flags.bloody) cues.push('there is blood on them');
  return cues.length ? cues.join(', ') : 'composed';
}

/** Prose for the Look verb, with clue facts learned when close. */
export function describeTarget(w: World, s: Static, target: string, close: boolean): { text: string; facts: { fact: FactKey; text: string }[] } {
  const facts: { fact: FactKey; text: string }[] = [];
  const agentDef = s.characters[target as CharacterId];
  if (agentDef && w.agents[target as CharacterId]) {
    const a = w.agents[target as CharacterId]!;
    const parts = [agentDef.blurb];
    if (close || !a.alive) {
      parts.push(`${agentDef.shortName} looks ${moodCue(a)}.`);
      const carried: string[] = [];
      for (const it of a.inventory) {
        const loc = w.items[it]!.loc;
        if (loc.kind === 'agent' && loc.concealed) continue;
        carried.push(s.items[it]!.name);
      }
      if (carried.length) parts.push(`Carrying: ${carried.join(', ')}.`);
      if (!a.alive) facts.push({ fact: `dead:${a.id}`, text: `${agentDef.name} is dead.` });
      if (a.flags.bloody && a.alive) facts.push({ fact: `bloody:${a.id}`, text: `${agentDef.name} has blood on them.` });
    } else {
      parts.push('Too far to make out more.');
    }
    return { text: parts.join(' '), facts };
  }
  const fixture = s.fixtures[target];
  if (fixture) {
    const parts = [fixture.description];
    if (close) {
      if (fixture.openContainer || w.fixtures[target]?.state.open === true) {
        const inside: string[] = [];
        for (const id of s.itemIds) {
          const loc = w.items[id]!.loc;
          if (loc.kind === 'fixture' && loc.fixture === target) inside.push(s.items[id]!.name);
        }
        if (inside.length) parts.push(`Here: ${inside.join(', ')}.`);
      }
      if (fixture.hidingSpot) parts.push('You could hide here.');
      if (fixture.proves) for (const f of fixture.proves) facts.push({ fact: f, text: fixture.clueText ?? fixture.description });
    } else {
      parts.push('You would have to get closer.');
    }
    return { text: parts.join(' '), facts };
  }
  const item = s.items[target];
  if (item) {
    const loc = w.items[target]!.loc;
    const parts = [item.description];
    if (loc.kind === 'agent' && loc.agent !== 'player') parts.push(`${s.characters[loc.agent]!.shortName} has it.`);
    if (close) {
      if (item.proves) for (const f of item.proves) facts.push({ fact: f, text: item.clueText ?? item.description });
    } else {
      parts.push('You cannot read it from here.');
    }
    return { text: parts.join(' '), facts };
  }
  const door = s.doors[target];
  if (door) {
    const d = w.doors[target]!;
    return { text: `The ${door.name}: ${d.locked ? 'locked' : d.open ? 'open' : 'closed'}.`, facts };
  }
  return { text: 'Nothing much to see.', facts };
}

function distanceTo(w: World, s: Static, target: string): number {
  const p = w.agents.player!;
  const nav = s.nav;
  const pc = nav.cellOf(p.pos);
  const other = w.agents[target as CharacterId];
  if (other) return nav.chebyshev(pc, nav.cellOf(other.pos));
  const fixture = s.fixtures[target];
  if (fixture) {
    const room = s.rooms[fixture.room]!;
    let best = Infinity;
    for (const t of fixture.tiles) best = Math.min(best, nav.chebyshev(pc, nav.cell(room.floor, t.x, t.y)));
    return best;
  }
  const item = w.items[target];
  if (item) {
    const loc = item.loc;
    if (loc.kind === 'agent') return loc.agent === 'player' ? 0 : nav.chebyshev(pc, nav.cellOf(w.agents[loc.agent]!.pos));
    if (loc.kind === 'tile') return nav.chebyshev(pc, nav.cell(loc.floor, loc.x, loc.y));
    if (loc.kind === 'fixture') return distanceTo(w, s, loc.fixture);
    return Infinity;
  }
  const di = nav.doorIndex[target];
  if (di !== undefined) {
    let best = Infinity;
    for (const c of nav.doorCells[di]!) best = Math.min(best, nav.chebyshev(pc, c));
    return best;
  }
  return Infinity;
}

function look(w: World, s: Static, target: string): void {
  const close = distanceTo(w, s, target) <= LOOK_RANGE;
  const { text, facts } = describeTarget(w, s, target, close);
  emit(w, { type: 'Looked', tick: w.tick, agent: 'player', target, text, close });
  for (const f of facts) learn(w, f.fact, target, f.text);
}

function fail(w: World, action: string, target: string | undefined, reason: string): void {
  emit(w, { type: 'ActionFailed', tick: w.tick, action, target, reason });
}

function done(w: World, action: string, target?: string): void {
  emit(w, { type: 'ActionDone', tick: w.tick, action, target });
}

function busy(w: World, a: AgentState, minutes: number): void {
  const until = w.tick + minutesToTick(minutes);
  if (a.busyUntil === undefined || until > a.busyUntil) a.busyUntil = until;
}

/** Approach target for a pending action: where to stand and how near. */
function approachFor(w: World, s: Static, p: AgentState, pa: PendingAction): { cell: number; near: number } | { fail: string } | undefined {
  const args = pa.args;
  switch (pa.action) {
    case 'take': {
      const item = str(args, 'item');
      if (!item || !w.items[item]) return { fail: `no such item ${item}` };
      const r = approachCell(w, s, p, { do: 'take', args: { item, near: 1 } });
      return 'fail' in r ? r : { cell: r.cell, near: 1 };
    }
    case 'use':
    case 'listen': {
      const target = str(args, 'target');
      if (!target) return { fail: 'no target' };
      if (s.doors[target]) {
        const r = approachCell(w, s, p, { do: 'goTo', args: { door: target } });
        return 'fail' in r ? r : { cell: r.cell, near: 0 };
      }
      if (s.fixtures[target]) {
        const r = approachCell(w, s, p, { do: 'goTo', args: { fixture: target } });
        return 'fail' in r ? r : { cell: r.cell, near: 0 };
      }
      if (w.items[target]) {
        const r = approachCell(w, s, p, { do: 'goTo', args: { item: target, near: 1 } });
        return 'fail' in r ? r : { cell: r.cell, near: 1 };
      }
      return { fail: `unknown target ${target}` };
    }
    case 'hide': {
      const target = str(args, 'fixture');
      if (!target || !s.fixtures[target]?.hidingSpot) return { fail: `${target} is not somewhere to hide` };
      const r = approachCell(w, s, p, { do: 'goTo', args: { fixture: target } });
      return 'fail' in r ? r : { cell: r.cell, near: 0 };
    }
    case 'give':
    case 'show':
    case 'talk':
    case 'tell':
    case 'accuse': {
      const to = str(args, 'to') as CharacterId | undefined;
      if (!to || !w.agents[to]) return { fail: `nobody called ${to}` };
      const near = pa.action === 'give' ? 1 : 2;
      const r = approachCell(w, s, p, { do: 'goTo', args: { agent: to, near } });
      return 'fail' in r ? r : { cell: r.cell, near };
    }
    case 'drop': {
      const into = str(args, 'into');
      if (!into) return undefined;
      if (!s.fixtures[into]) return { fail: `unknown fixture ${into}` };
      const r = approachCell(w, s, p, { do: 'goTo', args: { fixture: into } });
      return 'fail' in r ? r : { cell: r.cell, near: 0 };
    }
    default:
      return undefined;
  }
}

function pickpocket(w: World, s: Static, holder: AgentState, item: ItemId): boolean {
  const player = w.agents.player!;
  const watching = holder.alive && !holder.incapacity && sight(w, s, holder, player) > 0;
  if (watching) {
    emit(w, { type: 'PickpocketFailed', tick: w.tick, agent: 'player', holder: holder.id, item });
    adjustMood(w, holder.id, 'suspicion', 3, 'caught a hand in my pocket');
    adjustMood(w, holder.id, 'anger', 2, 'caught a hand in my pocket');
    observe(w, holder.id, 'pickpocketedBy:player', true, 'seen');
    decide(w, holder.id, 'the guest from Room 7 tried to pick my pocket');
    return false;
  }
  moveItem(w, item, { kind: 'agent', agent: 'player' }, 'player');
  emit(w, { type: 'Took', tick: w.tick, agent: 'player', item, from: { kind: 'agent', agent: holder.id }, room: player.room });
  return true;
}

function doUse(w: World, s: Static, pa: PendingAction): void {
  const target = str(pa.args, 'target')!;
  const item = str(pa.args, 'item');
  let action = str(pa.args, 'action');
  const player = w.agents.player!;
  if (s.doors[target]) {
    const d = w.doors[target]!;
    if (!action) action = d.locked ? (hasKeyFor(w, 'player', target) ? 'unlock' : 'knock') : d.open ? 'close' : 'open';
    if (action === 'apply' && item) action = d.locked ? 'unlock' : 'lock';
    let ok = false;
    switch (action) {
      case 'open':
        ok = openDoor(w, target, 'player');
        if (!ok) return fail(w, 'use', target, 'it is locked');
        break;
      case 'close':
        ok = closeDoor(w, target, 'player');
        break;
      case 'lock':
        ok = lockDoor(w, target, 'player');
        if (!ok) return fail(w, 'use', target, 'you have no key for it');
        break;
      case 'unlock':
        ok = unlockDoor(w, target, 'player');
        if (!ok) return fail(w, 'use', target, 'you have no key for it');
        break;
      case 'knock':
        knock(w, 'player', target);
        ok = true;
        break;
      default:
        return fail(w, 'use', target, `a door cannot be ${action}ed`);
    }
    if (ok) done(w, `${action}`, target);
    return;
  }
  const fixture = s.fixtures[target];
  const itemDef = s.items[target];
  if (!fixture && !itemDef) return fail(w, 'use', target, 'nothing to use');
  if (!action) action = fixture?.container ? 'search' : item ? 'apply' : fixture?.hidingSpot ? 'hide' : 'use';
  if (action === 'search') {
    if (!fixture?.container) return fail(w, 'search', target, 'nothing to search');
    const found: ItemId[] = [];
    for (const id of s.itemIds) {
      const loc = w.items[id]!.loc;
      if (loc.kind === 'fixture' && loc.fixture === target) {
        found.push(id);
        observe(w, 'player', `itemAt:${id}`, target, 'seen');
      }
    }
    emit(w, { type: 'Searched', tick: w.tick, agent: 'player', target, found });
    emit(w, { type: 'Used', tick: w.tick, agent: 'player', target, action: 'search', room: player.room });
    if (fixture.proves) for (const f of fixture.proves) learn(w, f, target, fixture.clueText ?? fixture.description);
    busy(w, player, 0.5);
    return done(w, 'search', target);
  }
  if (action === 'read' || action === 'look') {
    look(w, s, target);
    return done(w, 'look', target);
  }
  if (action === 'hide') {
    if (hide(w, 'player', target)) return done(w, 'hide', target);
    return fail(w, 'hide', target, 'you cannot hide there');
  }
  if (action === 'apply') {
    if (!item) return fail(w, 'use', target, 'use what on it?');
    // Find a use on the target that wants this item.
    const uses = fixture?.uses ?? itemDef?.uses ?? {};
    const match = Object.entries(uses).find(([, u]) => u.requiresItem === item);
    if (match) action = match[0];
    else if (fixture?.container) {
      // Put the item inside.
      dropItem(w, 'player', item, { kind: 'fixture', fixture: target });
      return done(w, 'put', target);
    } else {
      // Items with uses of their own (towel on blood, pills in a drink) are tried the other way round.
      const own = s.items[item]?.uses ?? {};
      const first = Object.keys(own)[0];
      if (first) {
        const r = useTarget(w, 'player', item, first);
        if (r.ok) {
          busy(w, player, r.minutes);
          return done(w, first, item);
        }
      }
      return fail(w, 'use', target, `${s.items[item]?.name ?? item} does nothing to that`);
    }
  }
  const r = useTarget(w, 'player', target, action, item);
  if (!r.ok) return fail(w, action, target, r.reason ?? 'that does not work');
  busy(w, player, r.minutes);
  done(w, action, target);
}

function execute(w: World, s: Static, pa: PendingAction): void {
  const player = w.agents.player!;
  const args = pa.args;
  switch (pa.action) {
    case 'take': {
      const item = str(args, 'item')!;
      const loc = w.items[item]!.loc;
      if (loc.kind === 'agent' && loc.agent !== 'player' && w.agents[loc.agent]!.alive) {
        if (pickpocket(w, s, w.agents[loc.agent]!, item)) done(w, 'take', item);
        else fail(w, 'take', item, `${s.characters[loc.agent]!.shortName} caught you`);
        return;
      }
      const r = takeItem(w, 'player', item);
      if (!r.ok) return fail(w, 'take', item, r.reason ?? 'you cannot take that');
      const def = s.items[item]!;
      if (def.proves) for (const f of def.proves) learn(w, f, item, def.clueText ?? def.description);
      return done(w, 'take', item);
    }
    case 'use':
      return doUse(w, s, pa);
    case 'listen': {
      const target = str(args, 'target')!;
      let beyond: string | undefined;
      if (s.doors[target]) beyond = s.doors[target]!.between.find((r) => r !== player.room);
      else if (s.fixtures[target]) {
        const f = s.fixtures[target]!;
        const link = s.content.map.thinWalls.find((t) => t.rooms.includes(f.room));
        beyond = link?.rooms.find((r) => r !== f.room);
      }
      if (!beyond) return fail(w, 'listen', target, 'you hear only the rain');
      player.flags.listeningRoom = beyond;
      player.flags.listeningAt = target;
      emit(w, { type: 'Listening', tick: w.tick, agent: 'player', at: target, room: beyond });
      return done(w, 'listen', target);
    }
    case 'hide': {
      const target = str(args, 'fixture')!;
      if (hide(w, 'player', target)) return done(w, 'hide', target);
      return fail(w, 'hide', target, 'you cannot hide there');
    }
    case 'give': {
      const to = str(args, 'to') as CharacterId;
      const item = str(args, 'item')!;
      const other = w.agents[to]!;
      if (!other.alive) return fail(w, 'give', to, `${s.characters[to]!.shortName} is dead`);
      if (other.incapacity) return fail(w, 'give', to, `${s.characters[to]!.shortName} is in no state to take it`);
      const r = giveItem(w, 'player', to, item);
      if (!r.ok) return fail(w, 'give', to, r.reason ?? 'refused');
      const res = respondTo(w, to, 'give', item, 'player');
      busy(w, player, res.minutes);
      busy(w, other, res.minutes);
      return done(w, 'give', to);
    }
    case 'show': {
      const to = str(args, 'to') as CharacterId;
      const item = str(args, 'item')!;
      const other = w.agents[to]!;
      if (!player.inventory.includes(item)) return fail(w, 'show', to, 'you do not have it');
      if (!other.alive || other.incapacity) return fail(w, 'show', to, `${s.characters[to]!.shortName} cannot look at it`);
      observe(w, to, `shown:${item}`, true, 'player');
      const res = respondTo(w, to, 'show', item, 'player');
      busy(w, player, res.minutes);
      busy(w, other, res.minutes);
      return done(w, 'show', to);
    }
    case 'talk': {
      const to = str(args, 'to') as CharacterId;
      const topic = str(args, 'topic') ?? 'tonight';
      const other = w.agents[to]!;
      if (!other.alive) return fail(w, 'talk', to, `${s.characters[to]!.shortName} is dead`);
      if (other.incapacity) return fail(w, 'talk', to, `${s.characters[to]!.shortName} cannot be roused`);
      const res = respondTo(w, to, 'ask', topic, 'player');
      busy(w, player, res.minutes);
      busy(w, other, res.minutes);
      return done(w, 'talk', to);
    }
    case 'tell': {
      const to = str(args, 'to') as CharacterId;
      const fact = str(args, 'fact')!;
      const value = args.value === undefined ? true : args.value;
      const other = w.agents[to]!;
      if (!other.alive || other.incapacity) return fail(w, 'tell', to, `${s.characters[to]!.shortName} is not listening`);
      w.flags.toldValue = value;
      tell(w, 'player', to, fact, value, 0.9);
      const res = respondTo(w, to, 'tell', fact, 'player');
      busy(w, player, res.minutes);
      busy(w, other, res.minutes);
      return done(w, 'tell', to);
    }
    case 'accuse': {
      const to = str(args, 'to') as CharacterId;
      const kind = str(args, 'kind') ?? 'killer';
      const who = str(args, 'who') ?? 'nobody';
      const other = w.agents[to]!;
      if (!other.alive || other.incapacity) return fail(w, 'accuse', to, `${s.characters[to]!.shortName} is not listening`);
      w.flags.accused = who;
      w.flags.accusation = kind;
      tell(w, 'player', to, kind === 'driver' ? 'driverOf1949' : 'killer', who, 0.6);
      const res = respondTo(w, to, 'accuse', kind, 'player');
      busy(w, player, res.minutes);
      busy(w, other, res.minutes);
      return done(w, 'accuse', to);
    }
    case 'drop': {
      const item = str(args, 'item')!;
      const into = str(args, 'into');
      const r = dropItem(w, 'player', item, into ? { kind: 'fixture', fixture: into } : undefined);
      if (!r.ok) return fail(w, 'drop', item, r.reason ?? 'you do not have it');
      return done(w, 'drop', item);
    }
    default:
      return fail(w, pa.action, undefined, 'unknown verb');
  }
}

function clearListening(player: AgentState): void {
  delete player.flags.listeningRoom;
  delete player.flags.listeningAt;
}

/** Queue or perform a command. Registered as the Sim's command handler. */
export function applyCommand(sim: Sim, cmd: PlayerCommand): void {
  const w = sim.world;
  const s = sim.s;
  const player = w.agents.player;
  if (!player || !player.alive) return;
  const args = cmd.args ?? {};
  switch (cmd.action) {
    case 'move': {
      const x = num(args, 'x');
      const y = num(args, 'y');
      const floor = num(args, 'floor') ?? player.pos.floor;
      if (x === undefined || y === undefined) return fail(w, 'move', undefined, 'no destination');
      const cell = s.nav.cell(floor, x, y);
      if (!s.nav.walkable[cell]) return fail(w, 'move', undefined, 'you cannot walk there');
      player.pending.length = 0;
      delete player.flags.following;
      clearListening(player);
      player.flags.moveTarget = cell;
      player.path.length = 0;
      player.pathTarget = -1;
      return;
    }
    case 'stop':
      player.pending.length = 0;
      delete player.flags.following;
      delete player.flags.moveTarget;
      player.path.length = 0;
      player.pathTarget = -1;
      return;
    case 'look': {
      const target = str(args, 'target');
      if (!target) return fail(w, 'look', undefined, 'look at what?');
      look(w, s, target);
      return;
    }
    case 'follow': {
      const who = str(args, 'agent') as CharacterId | undefined;
      if (!who || !w.agents[who] || who === 'player') return fail(w, 'follow', who, 'follow whom?');
      player.pending.length = 0;
      delete player.flags.moveTarget;
      clearListening(player);
      player.flags.following = who;
      decide(w, 'player', `follows ${who}`);
      return;
    }
    case 'unhide':
      unhide(w, 'player');
      return;
    case 'wait':
      // Fast-forwarding is the UI's business; the command is kept in the input log for replay.
      return;
    case 'take':
    case 'use':
    case 'listen':
    case 'hide':
    case 'give':
    case 'show':
    case 'talk':
    case 'tell':
    case 'accuse':
    case 'drop': {
      delete player.flags.following;
      delete player.flags.moveTarget;
      if (cmd.action !== 'listen') clearListening(player);
      player.pending.push({ action: cmd.action, args: { ...args }, queuedTick: w.tick });
      return;
    }
    default:
      return fail(w, cmd.action, undefined, 'unknown verb');
  }
}

/** Per tick: carry the player toward a destination or the next pending verb. */
export function playerTick(w: World, s: Static): void {
  const player = w.agents.player;
  if (!player || !player.alive) return;
  if (player.busyUntil !== undefined && w.tick < player.busyUntil) return;
  if (player.busyUntil !== undefined) player.busyUntil = undefined;
  const costly = serviceRoomMask(s);
  const next = player.pending[0];
  if (next) {
    const target = approachFor(w, s, player, next);
    if (target && 'fail' in target) {
      player.pending.shift();
      fail(w, next.action, str(next.args, 'target') ?? str(next.args, 'to') ?? str(next.args, 'item'), target.fail);
      return;
    }
    if (target) {
      const r = moveToward(w, s, player, target.cell, { near: target.near, costlyRooms: 0 });
      if (r === 'blocked') {
        player.pending.shift();
        fail(w, next.action, str(next.args, 'target') ?? str(next.args, 'to') ?? str(next.args, 'item'), 'no way to get there');
        return;
      }
      if (r === 'moving') return;
    }
    // Conversations wait for the other party to be free (up to three minutes).
    const to = str(next.args, 'to') as CharacterId | undefined;
    if (to && ['talk', 'tell', 'show', 'give', 'accuse'].includes(next.action)) {
      const other = w.agents[to];
      if (other && other.alive && other.busyUntil !== undefined && w.tick < other.busyUntil && w.tick - next.queuedTick < minutesToTick(3)) return;
    }
    player.pending.shift();
    execute(w, s, next);
    return;
  }
  const following = player.flags.following as CharacterId | undefined;
  if (following) {
    const other = w.agents[following];
    if (!other || !other.alive) {
      delete player.flags.following;
      return;
    }
    const cell = s.nav.cellOf(other.pos);
    const r = moveToward(w, s, player, cell, { near: 2, costlyRooms: costly });
    if (r === 'blocked') {
      delete player.flags.following;
      fail(w, 'follow', following, `you lost ${s.characters[following]!.shortName}`);
    }
    return;
  }
  const moveTarget = player.flags.moveTarget;
  if (typeof moveTarget === 'number') {
    const r = moveToward(w, s, player, moveTarget, { near: 0, costlyRooms: 0 });
    if (r !== 'moving') {
      delete player.flags.moveTarget;
      if (r === 'blocked') fail(w, 'move', undefined, 'no way through');
      else emit(w, { type: 'ActionDone', tick: w.tick, action: 'move' });
    }
  }
}

/** Convenience for scripted tests: a command at a clock time. */
export function at(time: string | number, action: string, args?: Record<string, Scalar>): PlayerCommand {
  const tick = typeof time === 'number' ? time : timeTick(time);
  return { tick, action, args };
}

function timeTick(t: string): number {
  // Local import avoided: clock parsing is cheap and already memoised.
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) throw new Error(`Bad time ${t}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  const hourOffset = h >= 10 ? h - 10 : h === 12 ? 2 : h + 2;
  return (hourOffset * 60 + min) * 25;
}

export function playerArmed(w: World): ItemId | undefined {
  return hasWeapon(w, 'player');
}

export function playerSound(w: World, s: Static, kind: 'knock' | 'scream', loudness: number): void {
  const p = w.agents.player!;
  emitSound(w, kind, p.room, s.nav.cellOf(p.pos), loudness, 'player');
}
