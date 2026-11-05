import { describe, expect, it } from 'vitest';
import '../src/content';
import { createSim } from '../src/sim/sim';
import { cloneWorld } from '../src/sim/world';

describe('determinism', () => {
  it('the same seed gives byte-identical event and decision logs', () => {
    const a = createSim({ seed: 42 });
    a.runNight();
    const b = createSim({ seed: 42 });
    b.runNight();
    expect(JSON.stringify(a.world.log)).toBe(JSON.stringify(b.world.log));
    expect(JSON.stringify(a.world.decisions)).toBe(JSON.stringify(b.world.decisions));
    expect(JSON.stringify(a.world.agents)).toBe(JSON.stringify(b.world.agents));
  });

  it('stepping tick by tick matches running in one go', () => {
    const a = createSim({ seed: 5 });
    a.runNight();
    const b = createSim({ seed: 5 });
    while (!b.world.ended) b.step();
    expect(JSON.stringify(a.world)).toBe(JSON.stringify(b.world));
  });

  it('the world is plain serialisable data', () => {
    const sim = createSim({ seed: 9 });
    sim.runUntil(1000);
    const copy = cloneWorld(sim.world);
    expect(copy).toEqual(sim.world);
    expect(JSON.stringify(copy)).toBe(JSON.stringify(sim.world));
  });

  it('different seeds still produce the default ending', () => {
    for (const seed of [11, 12]) {
      const sim = createSim({ seed });
      sim.runNight();
      expect(sim.world.ended?.ending).toBe('the_default');
    }
  });
});
