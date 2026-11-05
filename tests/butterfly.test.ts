/**
 * Phase 2 butterfly tests: scripted player input logs change the night
 * through the agents' own rules. No test here is special-cased in the engine
 * or the content; each outcome falls out of preconditions, beliefs and
 * alternative plans.
 */
import { describe, expect, it } from 'vitest';
import '../src/content';
import { formatShort, timeToTick } from '../src/sim/clock';
import { at } from '../src/sim/commands';
import { formatEventLine } from '../src/sim/events';
import { createSim } from '../src/sim/sim';
import type { PlayerCommand, World, WorldEvent } from '../src/sim/types';

const T = (s: string) => timeToTick(s);

function run(commands: PlayerCommand[], seed = 1, until?: string) {
  const sim = createSim({ seed });
  for (const c of commands) sim.enqueue(c);
  if (until) sim.runUntil(T(until));
  else sim.runNight();
  return sim;
}

function has(w: World, pred: (e: WorldEvent) => boolean): boolean {
  return w.log.some(pred);
}

function explain(w: World, filter: (e: WorldEvent) => boolean): string {
  return w.log.filter(filter).map(formatEventLine).join('\n');
}

const GET_MASTER_KEY: PlayerCommand[] = [at('10:18', 'use', { target: 'office_desk', action: 'search' }), at('10:18', 'take', { item: 'spare_master_key' })];

describe('butterfly effects', () => {
  it('pocketing Vivian\'s pills at 11:40 means Voss is not drugged at 1:35', () => {
    const sim = run([...GET_MASTER_KEY, at('11:38', 'take', { item: 'sleeping_pills' }), at('11:41', 'move', { x: 38, y: 25, floor: 0 })]);
    const w = sim.world;
    const took = w.log.find((e) => e.type === 'Took' && e.agent === 'player' && e.item === 'sleeping_pills');
    expect(took, explain(w, (e) => e.type === 'ActionFailed' || e.type === 'Took')).toBeDefined();
    expect(Math.abs(took!.tick - T('11:40'))).toBeLessThanOrEqual(2 * 25);
    expect(has(w, (e) => e.type === 'Drugged' && e.agent === 'voss')).toBe(false);
    expect(w.agents.voss!.incapacity === 'drowsy' || w.agents.voss!.flags.doses !== undefined).toBe(false);
    // Vivian's plan failed on its precondition, with the reason logged.
    expect(has(w, (e) => e.type === 'PlanAbandoned' && e.agent === 'vivian' && e.plan === 'DoseNightcap' && e.reason === 'the sleeping pills are gone')).toBe(true);
    // She fell back on the bar.
    expect(has(w, (e) => e.type === 'PlanStarted' && e.agent === 'vivian' && e.plan === 'DrinkItOff')).toBe(true);
    // An undrugged Voss shoots the Colonel.
    expect(w.ended?.ending, explain(w, (e) => e.type === 'Attacked' || e.type === 'Died' || e.type === 'LoopEnded')).toBe('self_defence');
  });

  it('showing the Colonel the blackmail letters before 12:40 changes his target to Vivian', () => {
    const sim = run([
      at('10:34', 'use', { target: 'vivian_suitcase', action: 'search' }),
      at('10:34', 'take', { item: 'blackmail_letters' }),
      at('10:58', 'show', { to: 'hale', item: 'blackmail_letters' }),
    ]);
    const w = sim.world;
    const shown = w.log.find((e) => e.type === 'Said' && e.storylet === 'hale_shown_letters');
    expect(shown, explain(w, (e) => e.type === 'ActionFailed' || e.type === 'Said')).toBeDefined();
    expect(shown!.tick).toBeLessThan(T('12:40'));
    expect(w.agents.hale!.beliefs.driverOf1949?.value).toBe('vivian');
    // He never goes after Voss; he goes to her door instead.
    expect(has(w, (e) => e.type === 'Died' && e.agent === 'voss' && e.killer === 'hale')).toBe(false);
    expect(has(w, (e) => e.type === 'PlanStarted' && e.agent === 'hale' && e.goal === 'confront_driver')).toBe(true);
    expect(has(w, (e) => e.type === 'Said' && e.speaker === 'hale' && e.to === 'vivian' && e.text.includes('Clara Hale'))).toBe(true);
    expect(w.ended?.ending).not.toBe('the_default');
  });

  it('locking the kitchen\'s back-stair door at 12:30 forces the Colonel to re-plan his route to the knife', () => {
    const sim = run([...GET_MASTER_KEY, at('12:27', 'use', { target: 'laundry_door', action: 'lock' })]);
    const w = sim.world;
    const locked = w.log.find((e) => e.type === 'DoorLocked' && e.door === 'laundry_door' && e.by === 'player');
    expect(locked, explain(w, (e) => e.type === 'ActionFailed' || e.type === 'DoorLocked')).toBeDefined();
    expect(Math.abs(locked!.tick - T('12:30'))).toBeLessThanOrEqual(3 * 25);
    const abandoned = w.log.find((e) => e.type === 'PlanAbandoned' && e.agent === 'hale' && e.plan === 'KnifeViaBackStair');
    expect(abandoned, explain(w, (e) => e.type === 'PlanAbandoned' || e.type === 'PlanStarted')).toBeDefined();
    expect(abandoned!.type === 'PlanAbandoned' && abandoned.reason).toContain('no path');
    expect(has(w, (e) => e.type === 'PlanStarted' && e.agent === 'hale' && e.plan === 'KnifeViaLobby')).toBe(true);
    // He still arms himself, by the long way round through the bar.
    const took = w.log.find((e) => e.type === 'Took' && e.agent === 'hale' && e.item === 'kitchen_knife');
    expect(took).toBeDefined();
    const route = w.log.filter((e) => e.type === 'Moved' && e.agent === 'hale' && e.tick > T('12:36') && e.tick < took!.tick).map((e) => (e.type === 'Moved' ? e.to : ''));
    expect(route).toContain('bar');
    expect(route).not.toContain('laundry');
  });

  it('telling Ruth that Jimmy works for Voss leads to a confrontation in Room 6', () => {
    const sim = run([at('10:41', 'tell', { to: 'ruth', fact: 'jimmyWorksForVoss', value: true })]);
    const w = sim.world;
    const told = w.log.find((e) => e.type === 'Told' && e.from === 'player' && e.to === 'ruth' && e.fact === 'jimmyWorksForVoss');
    expect(told, explain(w, (e) => e.type === 'ActionFailed' || e.type === 'Told')).toBeDefined();
    const row = w.log.find((e) => e.type === 'Said' && e.storylet === 'ruth_confronts_jimmy_voss');
    expect(row, explain(w, (e) => (e.type === 'GoalChanged' && e.agent === 'ruth') || e.type === 'PlanAbandoned')).toBeDefined();
    expect(row!.type === 'Said' && row.room).toBe('room6');
    expect(has(w, (e) => e.type === 'Sound' && e.kind === 'argument' && e.room === 'room6' && e.tick === row!.tick)).toBe(true);
  });

  it('staying in Suite 3 with Voss from 1:30 changes the outcome', () => {
    const sim = run([at('1:27', 'move', { x: 38, y: 11, floor: 1 })]);
    const w = sim.world;
    const arrived = w.log.find((e) => e.type === 'Moved' && e.agent === 'player' && e.to === 'suite3');
    expect(arrived, explain(w, (e) => e.type === 'ActionFailed' || (e.type === 'Moved' && e.agent === 'player'))).toBeDefined();
    expect(arrived!.tick).toBeLessThanOrEqual(T('1:31'));
    expect(w.agents.player!.room).toBe('suite3');
    // Voss objects, then the Colonel will not strike in front of a witness.
    expect(has(w, (e) => e.type === 'Said' && e.speaker === 'voss' && e.storylet === 'voss_get_out')).toBe(true);
    expect(has(w, (e) => e.type === 'PlanAbandoned' && e.agent === 'hale' && e.reason.includes('someone else is in Suite 3'))).toBe(true);
    expect(w.agents.voss!.alive).toBe(true);
    expect(w.ended?.ending, explain(w, (e) => e.type === 'Died' || e.type === 'LoopEnded')).not.toBe('the_default');
  });

  it('a player who does nothing leaves the default night untouched', () => {
    const sim = run([]);
    expect(sim.world.ended?.ending).toBe('the_default');
    expect(sim.world.commands).toHaveLength(0);
  });

  it('the input log is replayable: the same commands give the same night', () => {
    const commands = [...GET_MASTER_KEY, at('11:38', 'take', { item: 'sleeping_pills' })];
    const a = run(commands, 3);
    const b = run(commands, 3);
    expect(JSON.stringify(a.world.log)).toBe(JSON.stringify(b.world.log));
    expect(a.world.commands.map((c) => `${formatShort(c.tick)} ${c.action}`)).toEqual(b.world.commands.map((c) => `${formatShort(c.tick)} ${c.action}`));
  });
});
