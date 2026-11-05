import { describe, expect, it } from 'vitest';
import '../src/content';
import { createSim } from '../src/sim/sim';

describe('performance', () => {
  it('simulates a full night in under 200ms', () => {
    // Warm up the JIT and the path cache on a throwaway night.
    const warm = createSim({ seed: 1 });
    warm.runNight();
    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      const sim = createSim({ seed: 1 });
      const t0 = performance.now();
      sim.runNight();
      times.push(performance.now() - t0);
      expect(sim.world.tick).toBe(6000);
    }
    const best = Math.min(...times);
    // eslint-disable-next-line no-console
    console.log(`full night: best ${best.toFixed(1)} ms of ${times.map((t) => t.toFixed(1)).join(', ')}`);
    // Shared CI runners are slower and noisier than a developer machine or a phone.
    expect(best).toBeLessThan(process.env.CI ? 400 : 200);
  });
});
