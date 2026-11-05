import { decide, emit, S } from '../registry';
import type { CharacterId, MoodKey, World } from '../types';

const MOOD_KEYS: MoodKey[] = ['fear', 'anger', 'suspicion', 'drunk', 'resolve'];

/** Per game minute, each mood drifts back toward the character's baseline. */
const DECAY_PER_MINUTE: Record<MoodKey, number> = {
  fear: 0.1,
  anger: 0.08,
  suspicion: 0.03,
  drunk: 0.06,
  resolve: 0.0,
};

export function adjustMood(w: World, agentId: CharacterId, key: MoodKey, delta: number, reason: string): void {
  const a = w.agents[agentId];
  if (!a || delta === 0) return;
  const from = a.mood[key];
  const to = Math.max(0, Math.min(10, from + delta));
  if (to === from) return;
  a.mood[key] = to;
  if (Math.floor(from) !== Math.floor(to)) {
    emit(w, { type: 'MoodChanged', tick: w.tick, agent: agentId, key, from: Math.round(from * 10) / 10, to: Math.round(to * 10) / 10, reason });
    decide(w, agentId, `${key} ${from.toFixed(1)} -> ${to.toFixed(1)}: ${reason}`);
  }
}

/** Called once per game minute. */
export function decayMoods(w: World): void {
  const s = S();
  for (const id of s.characterOrder) {
    const a = w.agents[id]!;
    if (!a.alive) continue;
    const base = s.characters[id]!.mood;
    for (const key of MOOD_KEYS) {
      const rate = DECAY_PER_MINUTE[key];
      if (rate === 0) continue;
      const cur = a.mood[key];
      const target = base[key];
      if (cur > target) a.mood[key] = Math.max(target, cur - rate);
      else if (cur < target) a.mood[key] = Math.min(target, cur + rate * 0.5);
    }
  }
}
