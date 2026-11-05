/**
 * Seeded PRNG (mulberry32). The single 32-bit state lives in `World.rng`
 * so a world snapshot carries its randomness with it.
 */

export function seedState(seed: number): number {
  // Mix the seed so nearby seeds give unrelated streams.
  let s = (seed ^ 0x9e3779b9) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x85ebca6b) >>> 0;
  s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35) >>> 0;
  return (s ^ (s >>> 16)) >>> 0;
}

/** Advances the state and returns [nextState, float in [0,1)). */
export function nextRandom(state: number): [number, number] {
  let t = (state + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [next, r];
}

export interface RngHolder {
  rng: number;
}

export function random(w: RngHolder): number {
  const [s, r] = nextRandom(w.rng);
  w.rng = s;
  return r;
}

export function randomInt(w: RngHolder, maxExclusive: number): number {
  return Math.floor(random(w) * maxExclusive);
}

export function chance(w: RngHolder, p: number): boolean {
  return random(w) < p;
}
