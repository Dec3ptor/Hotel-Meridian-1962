/**
 * The baseline: with the player doing nothing, each row of the Section 7
 * timeline happens within ±2 game minutes. Rows are detected from the event
 * log, never from agent internals, so the timeline must emerge from plans.
 */
import { describe, expect, it } from 'vitest';
import '../src/content';
import { formatShort, timeToTick } from '../src/sim/clock';
import { formatEventLine } from '../src/sim/events';
import { createSim } from '../src/sim/sim';
import type { World, WorldEvent } from '../src/sim/types';

const TOLERANCE_MINUTES = 2;

type Finder = (log: WorldEvent[], w: World) => number | undefined;

interface Row {
  time: string;
  what: string;
  find: Finder;
  /** The event must happen at or before `time` rather than near it. */
  by?: boolean;
}

function rowOk(row: Row, tick: number | undefined): boolean {
  if (tick === undefined) return false;
  const expected = T(row.time);
  if (row.by) return tick <= expected + TOLERANCE_MINUTES * 25;
  return Math.abs(tick - expected) <= TOLERANCE_MINUTES * 25;
}

function first<T extends WorldEvent['type']>(log: WorldEvent[], type: T, pred: (ev: Extract<WorldEvent, { type: T }>) => boolean, notBefore = 0): number | undefined {
  for (const ev of log) {
    if (ev.type !== type || ev.tick < notBefore) continue;
    if (pred(ev as Extract<WorldEvent, { type: T }>)) return ev.tick;
  }
  return undefined;
}

function last<T extends WorldEvent['type']>(log: WorldEvent[], type: T, pred: (ev: Extract<WorldEvent, { type: T }>) => boolean, notAfter = Infinity): number | undefined {
  let found: number | undefined;
  for (const ev of log) {
    if (ev.type !== type || ev.tick > notAfter) continue;
    if (pred(ev as Extract<WorldEvent, { type: T }>)) found = ev.tick;
  }
  return found;
}

const T = (s: string) => timeToTick(s);

const rows: Row[] = [
  { time: '10:05', what: 'bridge washes out', find: (log) => first(log, 'WorldEvent', (e) => e.id === 'bridge_out') },
  { time: '10:10', what: 'phones go dead', find: (log) => first(log, 'WorldEvent', (e) => e.id === 'phones_dead') },
  { time: '10:10', what: 'Walter tells the lobby nobody can leave', find: (log) => first(log, 'Said', (e) => e.speaker === 'walter' && e.topic === 'no_way_out' && e.room === 'lobby') },
  { time: '10:10', what: 'Walter tells the bar nobody can leave', find: (log) => first(log, 'Said', (e) => e.speaker === 'walter' && e.topic === 'no_way_out' && e.room === 'bar') },
  { time: '10:15', what: 'Voss puts the envelope in the safe', find: (log) => first(log, 'ItemMoved', (e) => e.item === 'voss_envelope' && e.to.kind === 'fixture' && e.to.fixture === 'safe') },
  { time: '10:15', what: 'Voss slips Walter cash in the office', find: (log) => first(log, 'Gave', (e) => e.from === 'voss' && e.to === 'walter' && e.item === 'voss_cash' && e.room === 'office') },
  { time: '10:30', what: 'Vivian comes down to the bar', find: (log) => first(log, 'Moved', (e) => e.agent === 'vivian' && e.to === 'bar') },
  { time: '10:30', what: 'Voss: "Suite 3. One o\'clock. Bring all of it."', find: (log) => first(log, 'Said', (e) => e.speaker === 'voss' && e.to === 'vivian' && e.topic === 'summons' && e.room === 'bar') },
  { time: '10:30', what: 'the Colonel watches from the lobby', find: (log) => first(log, 'Saw', (e) => e.agent === 'hale' && e.target === 'vivian' && e.room === 'bar', T('10:20')) },
  { time: '10:45', what: 'Ruth asks Walter for Mrs. Marsh\'s room', find: (log) => first(log, 'Said', (e) => e.speaker === 'ruth' && e.topic === 'mrs_marsh_room' && e.room === 'lobby') },
  { time: '10:45', what: 'Walter puts the earring in lost-and-found', find: (log) => first(log, 'ItemMoved', (e) => e.item === 'ruth_earring' && e.to.kind === 'fixture' && e.to.fixture === 'lost_and_found') },
  { time: '11:00', what: 'Voss orders photos at the Cadillac', find: (log) => first(log, 'Said', (e) => e.speaker === 'voss' && e.to === 'jimmy' && e.topic === 'order_photos' && e.room === 'lot') },
  { time: '11:15', what: 'radio bulletin', find: (log) => first(log, 'WorldEvent', (e) => e.id === 'radio_bulletin') },
  { time: '11:15', what: 'Vivian drops her glass', find: (log) => first(log, 'Gesture', (e) => e.agent === 'vivian' && e.gesture === 'drops_glass') },
  { time: '11:15', what: 'the Colonel watches Voss smile', find: (log) => first(log, 'SawGesture', (e) => e.agent === 'hale' && e.target === 'voss' && e.gesture === 'smile') },
  { time: '11:30', what: 'the Colonel returns to Suite 2', find: (log) => first(log, 'Moved', (e) => e.agent === 'hale' && e.to === 'suite2', T('11:20')) },
  { time: '11:30', what: 'Vivian returns to Suite 1', find: (log) => first(log, 'Moved', (e) => e.agent === 'vivian' && e.to === 'suite1', T('11:20')) },
  { time: '11:45', what: 'Voss writes the telegram', find: (log) => first(log, 'ItemChanged', (e) => e.item === 'telegram' && e.key === 'written' && e.value === true) },
  { time: '12:00', what: 'Ruth knocks on Suite 1', find: (log) => first(log, 'Sound', (e) => e.kind === 'knock' && e.by === 'ruth' && e.text === 'suite1_door') },
  { time: '12:00', what: 'Vivian: wrong room', find: (log) => first(log, 'Said', (e) => e.speaker === 'vivian' && e.to === 'ruth' && e.text.includes('wrong room')) },
  { time: '12:00', what: 'Jimmy photographs from the stairs', find: (log) => first(log, 'Used', (e) => e.agent === 'jimmy' && e.target === 'camera' && e.action === 'photograph' && e.room === 'corridor') },
  { time: '12:30', what: 'Jimmy and Ruth argue', find: (log) => first(log, 'Said', (e) => e.storylet === 'ruth_argument' && e.room === 'room6') },
  { time: '12:30', what: 'the argument is audible in Room 7', find: (log) => first(log, 'Heard', (e) => e.agent === 'player' && e.kind === 'argument' && e.room === 'room6') },
  { time: '12:40', what: 'the Colonel takes a knife from the block', find: (log) => first(log, 'Took', (e) => e.agent === 'hale' && e.item === 'kitchen_knife' && e.room === 'kitchen') },
  { time: '12:40', what: 'the Colonel came down the back stair', find: (log) => last(log, 'Moved', (e) => e.agent === 'hale' && e.to === 'laundry' && e.via === 'back_stair', T('12:42')) },
  { time: '12:50', what: 'the Colonel sits in his car', find: (log) => first(log, 'Used', (e) => e.agent === 'hale' && e.target === 'hale_car' && e.action === 'sit') },
  { time: '1:00', what: 'Vivian enters Suite 3', find: (log) => first(log, 'Moved', (e) => e.agent === 'vivian' && e.to === 'suite3') },
  { time: '1:00', what: 'Voss demands everything and mentions her daughter', find: (log) => first(log, 'Said', (e) => e.storylet === 'voss_settlement' && e.speaker === 'voss' && e.text.includes('daughter')) },
  { time: '1:08', what: 'Vivian leaves Suite 3 shaking', find: (log) => first(log, 'Moved', (e) => e.agent === 'vivian' && e.from === 'suite3' && e.to === 'corridor') },
  { time: '1:05', what: 'Walter prepares the nightcap tray', find: (log) => first(log, 'Used', (e) => e.agent === 'walter' && e.target === 'nightcap_tray' && e.action === 'prepare' && e.room === 'kitchen') },
  { time: '1:06', what: 'Ruth rings the desk bell', find: (log) => first(log, 'Sound', (e) => e.kind === 'bell' && e.by === 'ruth') },
  { time: '1:10', what: 'Vivian doses the nightcap in the kitchen', find: (log) => first(log, 'Used', (e) => e.agent === 'vivian' && e.target === 'nightcap_tray' && e.action === 'dose' && e.room === 'kitchen') },
  {
    time: '1:16',
    by: true,
    what: 'Vivian is back in Suite 1 after the kitchen',
    find: (log) => {
      const dosed = first(log, 'Used', (e) => e.agent === 'vivian' && e.action === 'dose');
      return dosed === undefined ? undefined : first(log, 'Moved', (e) => e.agent === 'vivian' && e.to === 'suite1', dosed);
    },
  },
  { time: '1:10', what: 'the Colonel returns to the lobby', find: (log) => first(log, 'Moved', (e) => e.agent === 'hale' && e.to === 'lobby', T('1:00')) },
  { time: '1:20', what: 'Walter delivers the tray to Suite 3', find: (log) => first(log, 'Gave', (e) => e.from === 'walter' && e.to === 'voss' && e.item === 'nightcap_tray' && e.room === 'suite3') },
  { time: '1:20', what: 'Voss: leave the door unlocked', find: (log) => first(log, 'Said', (e) => e.speaker === 'voss' && e.storylet === 'walter_nightcap_delivered') },
  { time: '1:25', what: 'Voss drinks the nightcap', find: (log) => first(log, 'Used', (e) => e.agent === 'voss' && e.target === 'nightcap_tray' && e.action === 'drink') },
  { time: '1:35', what: 'Voss is drowsy', find: (log) => first(log, 'Incapacitated', (e) => e.agent === 'voss' && e.state === 'drowsy') },
  { time: '1:30', what: 'the Colonel goes up the back stair to the corridor', find: (log) => first(log, 'Moved', (e) => e.agent === 'hale' && e.to === 'corridor' && e.via === 'back_stair', T('1:20')) },
  { time: '1:40', what: 'the murder', find: (log) => first(log, 'Died', (e) => e.agent === 'voss' && e.killer === 'hale' && e.cause === 'knife') },
  { time: '1:45', what: 'the bloodied towel goes into the laundry cart', find: (log) => first(log, 'ItemMoved', (e) => e.item === 'suite3_towel' && e.to.kind === 'fixture' && e.to.fixture === 'laundry_cart_1') },
  { time: '1:48', what: 'the main stair creaks under the Colonel', find: (log) => first(log, 'Sound', (e) => e.kind === 'creak' && e.by === 'hale', T('1:40')) },
  { time: '1:48', what: 'the Colonel is back in Suite 2', find: (log) => first(log, 'Moved', (e) => e.agent === 'hale' && e.to === 'suite2', T('1:40')) },
  { time: '1:50', what: 'Jimmy finds the body', find: (log) => first(log, 'SawBody', (e) => e.agent === 'jimmy' && e.body === 'voss') },
  { time: '1:50', what: 'Jimmy grabs the film', find: (log) => first(log, 'Took', (e) => e.agent === 'jimmy' && e.item === 'undeveloped_film') },
  { time: '1:52', what: 'Jimmy runs down the main stair', find: (log) => first(log, 'Moved', (e) => e.agent === 'jimmy' && e.to === 'lobby' && e.via === 'main_stair', T('1:45')) },
  { time: '1:55', what: 'Ruth sees Jimmy with blood on his cuff', find: (log) => first(log, 'Saw', (e) => e.agent === 'ruth' && e.target === 'jimmy' && e.detail === 'blood' && e.room === 'lobby') },
  { time: '1:55', what: 'Ruth screams', find: (log) => first(log, 'Sound', (e) => e.kind === 'scream' && e.by === 'ruth') },
  { time: '2:00', what: 'Walter finds the body', find: (log) => first(log, 'SawBody', (e) => e.agent === 'walter' && e.body === 'voss') },
  { time: '2:00', what: 'the loop ends', find: (log) => first(log, 'LoopEnded', () => true) },
];

function runNight(seed: number) {
  const sim = createSim({ seed });
  sim.runNight();
  return sim.world;
}

function report(w: World): string {
  const lines: string[] = [];
  for (const row of rows) {
    const tick = row.find(w.log, w);
    const ok = rowOk(row, tick);
    lines.push(`${ok ? 'ok  ' : 'FAIL'} ${row.time.padStart(5)} ${row.what.padEnd(52)} ${tick === undefined ? 'never' : formatShort(tick)}`);
  }
  return lines.join('\n');
}

describe('default night', () => {
  const world = runNight(1);

  it('starts everyone in their Section 7 positions', () => {
    const sim = createSim({ seed: 1 });
    const w = sim.world;
    expect(w.agents.player!.room).toBe('room7');
    expect(w.agents.voss!.room).toBe('bar');
    expect(w.agents.vivian!.room).toBe('suite1');
    expect(w.agents.hale!.room).toBe('lobby');
    expect(w.agents.jimmy!.room).toBe('room6');
    expect(w.agents.ruth!.room).toBe('room6');
    expect(w.agents.walter!.room).toBe('lobby');
  });

  for (const row of rows) {
    it(`${row.time} ${row.what}`, () => {
      const tick = row.find(world.log, world);
      const expected = T(row.time);
      if (!rowOk(row, tick)) {
        const ctx = world.log
          .filter((e) => Math.abs(e.tick - expected) <= 6 * 25 && !['Moved', 'Saw', 'SawItem', 'Heard', 'DoorOpened', 'DoorClosed', 'ItemChanged', 'MoodChanged'].includes(e.type))
          .map(formatEventLine)
          .join('\n');
        throw new Error(`${row.what}: expected ${row.by ? 'by ' : ''}${row.time}, got ${tick === undefined ? 'never' : formatShort(tick)}\n\n${report(world)}\n\nEvents near ${row.time}:\n${ctx}`);
      }
      expect(rowOk(row, tick)).toBe(true);
    });
  }

  it('ends with The Default', () => {
    expect(world.ended?.ending).toBe('the_default');
  });

  it('the player stayed in Room 7 all night', () => {
    expect(world.log.some((e) => e.type === 'Moved' && e.agent === 'player')).toBe(false);
  });

  it('leaves no stuck agents: every goal that failed did so with a reason', () => {
    for (const ev of world.log) {
      if (ev.type === 'GoalFailed') expect(ev.reason.length).toBeGreaterThan(0);
      if (ev.type === 'PlanAbandoned') expect(ev.reason.length).toBeGreaterThan(0);
    }
  });
});

describe('default night holds across seeds', () => {
  for (const seed of [2, 3, 17]) {
    it(`seed ${seed} reproduces the timeline`, () => {
      const w = runNight(seed);
      const failures = rows.filter((row) => !rowOk(row, row.find(w.log, w)));
      if (failures.length > 0) throw new Error(`seed ${seed}:\n${report(w)}`);
      expect(failures).toHaveLength(0);
    });
  }
});
