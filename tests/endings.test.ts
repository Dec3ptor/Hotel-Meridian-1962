/**
 * Every ending in Section 9 is reachable from an input log. The conditions
 * are checked from state, never from the path, so these scripts are one
 * route each, not the only route.
 */
import { describe, expect, it } from 'vitest';
import '../src/content';
import { at } from '../src/sim/commands';
import { formatEventLine } from '../src/sim/events';
import { createSim } from '../src/sim/sim';
import type { PlayerCommand, World, WorldEvent } from '../src/sim/types';

function run(commands: PlayerCommand[], seed = 1): World {
  const sim = createSim({ seed });
  for (const c of commands) sim.enqueue(c);
  sim.runNight();
  return sim.world;
}

function why(w: World): string {
  const keep = (e: WorldEvent) => ['Died', 'Attacked', 'ActionFailed', 'LoopEnded', 'Left', 'PlanAbandoned', 'GoalFailed', 'Drugged', 'Told', 'Gave', 'DoorLocked'].includes(e.type) || (e.type === 'Said' && (e.to === 'player' || e.speaker === 'player' || e.storylet.includes('confess') || e.storylet.includes('meets')));
  return w.log.filter(keep).map(formatEventLine).join('\n');
}

const GET_MASTER_KEY: PlayerCommand[] = [at('10:18', 'use', { target: 'office_desk', action: 'search' }), at('10:18', 'take', { item: 'spare_master_key' })];
const GET_LETTERS: PlayerCommand[] = [at('10:34', 'use', { target: 'vivian_suitcase', action: 'search' }), at('10:34', 'take', { item: 'blackmail_letters' })];
const GET_LEDGER: PlayerCommand[] = [at('10:14', 'use', { target: 'briefcase', action: 'search' }), at('10:14', 'take', { item: 'blackmail_ledger' })];
const LOCK_SUITE3: PlayerCommand[] = [at('1:28', 'use', { target: 'suite3_door', action: 'lock' }), at('1:33', 'move', { x: 38, y: 25, floor: 0 })];
const GO_HOME = (time: string) => at(time, 'move', { x: 38, y: 25, floor: 0 });

describe('endings', () => {
  it('The Default: the player does nothing', () => {
    const w = run([]);
    expect(w.ended?.ending, why(w)).toBe('the_default');
  });

  it('Self-Defence: pocket the pills and an undrugged Voss shoots the Colonel', () => {
    const w = run([...GET_MASTER_KEY, at('11:38', 'take', { item: 'sleeping_pills' }), GO_HOME('11:41')]);
    expect(w.ended?.ending, why(w)).toBe('self_defence');
  });

  it('Wrong Target: show the Colonel the letters and he turns on Vivian', () => {
    const w = run([...GET_LETTERS, at('10:58', 'show', { to: 'hale', item: 'blackmail_letters' }), GO_HOME('11:02')]);
    expect(w.ended?.ending, why(w)).toBe('wrong_target');
    expect(w.agents.vivian!.alive).toBe(false);
    expect(w.agents.voss!.alive).toBe(true);
  });

  it('Two Bodies: the Colonel kills Vivian and a double-dosed nightcap kills Voss', () => {
    const w = run([
      ...GET_LETTERS,
      at('10:58', 'show', { to: 'hale', item: 'blackmail_letters' }),
      at('11:02', 'take', { item: 'sleeping_pills' }),
      GO_HOME('11:06'),
      at('1:05', 'use', { target: 'nightcap_tray', action: 'apply', item: 'sleeping_pills' }),
      at('1:05', 'use', { target: 'nightcap_tray', action: 'apply', item: 'sleeping_pills' }),
      GO_HOME('1:10'),
    ]);
    expect(w.ended?.ending, why(w)).toBe('two_bodies');
  });

  it('Overdose: double the dose yourself and keep the Colonel out', () => {
    const w = run([
      ...GET_MASTER_KEY,
      at('11:02', 'take', { item: 'sleeping_pills' }),
      GO_HOME('11:06'),
      at('1:05', 'use', { target: 'nightcap_tray', action: 'apply', item: 'sleeping_pills' }),
      at('1:05', 'use', { target: 'nightcap_tray', action: 'apply', item: 'sleeping_pills' }),
      GO_HOME('1:10'),
      ...LOCK_SUITE3,
    ]);
    expect(w.ended?.ending, why(w)).toBe('overdose');
    expect(w.agents.voss!.flags.causeOfDeath).toBe('overdose');
  });

  it('The Getaway: a witness who runs sends the killer to the Cadillac', () => {
    const w = run([at('1:29', 'hide', { fixture: 'wardrobe' }), at('1:40', 'unhide'), GO_HOME('1:40')]);
    expect(w.ended?.ending, why(w)).toBe('the_getaway');
    expect(w.flags.cadillacDrivenBy).toBe('hale');
    expect(w.agents.player!.alive).toBe(true);
  });

  it('Lights Out: a witness who stays is silenced', () => {
    const w = run([at('1:29', 'hide', { fixture: 'wardrobe' }), at('1:40', 'unhide')]);
    expect(w.ended?.ending, why(w)).toBe('lights_out');
    expect(w.agents.player!.alive).toBe(false);
  });

  it('The Patsy: found standing over the body', () => {
    const w = run([at('1:44', 'move', { x: 37, y: 12, floor: 1 })]);
    expect(w.ended?.ending, why(w)).toBe('the_patsy');
  });

  it('Reckoning: the ledger goes round and Voss is held for the police', () => {
    const w = run([
      ...GET_LEDGER,
      ...GET_MASTER_KEY,
      at('10:24', 'show', { to: 'walter', item: 'blackmail_ledger' }),
      at('10:26', 'show', { to: 'hale', item: 'blackmail_ledger' }),
      at('10:40', 'show', { to: 'vivian', item: 'blackmail_ledger' }),
      GO_HOME('10:46'),
      ...LOCK_SUITE3,
    ]);
    expect(w.ended?.ending, why(w)).toBe('reckoning');
  });

  it('The Fixer Walks: keep the Colonel out and let the night pass', () => {
    const w = run([...GET_MASTER_KEY, GO_HOME('10:22'), ...LOCK_SUITE3]);
    expect(w.ended?.ending, why(w)).toBe('the_fixer_walks');
  });

  it('Mother and Daughter: tell each of them where the other is', () => {
    const w = run([
      ...GET_MASTER_KEY,
      at('10:44', 'tell', { to: 'vivian', fact: 'ruthIsYourDaughter', value: true }),
      at('11:00', 'tell', { to: 'ruth', fact: 'vivianIsInSuite1', value: true }),
      at('11:00', 'tell', { to: 'ruth', fact: 'vivianIsMrsMarsh', value: true }),
      GO_HOME('11:04'),
      ...LOCK_SUITE3,
    ]);
    expect(w.ended?.ending, why(w)).toBe('mother_and_daughter');
  });

  it('The Truth: proof for the Colonel, a confession from Vivian, the ledger to the law', () => {
    const w = run([
      ...GET_LEDGER,
      ...GET_LETTERS,
      at('10:58', 'show', { to: 'hale', item: 'blackmail_letters' }),
      at('11:03', 'tell', { to: 'vivian', fact: 'haleIsClarasFather', value: true }),
      at('11:20', 'give', { to: 'walter', item: 'blackmail_ledger' }),
      GO_HOME('11:24'),
    ]);
    expect(w.ended?.ending, why(w)).toBe('the_truth');
    expect(w.agents.voss!.alive && w.agents.vivian!.alive && w.agents.hale!.alive).toBe(true);
  });
});
