import { emit } from '../registry';
import type { BeliefValue, CharacterId, FactKey, World } from '../types';

/**
 * Beliefs are single-valued per fact with a confidence. Agreeing evidence
 * reinforces; conflicting evidence either replaces the belief (when at least
 * as confident) or erodes the existing confidence. Sources are kept so a lie
 * can be traced back through gossip.
 */
export function setBelief(w: World, agentId: CharacterId, fact: FactKey, value: BeliefValue, confidence: number, source: string): void {
  const a = w.agents[agentId];
  if (!a) throw new Error(`Unknown agent ${agentId}`);
  const c = Math.max(0, Math.min(1, confidence));
  const existing = a.beliefs[fact];
  if (!existing) {
    a.beliefs[fact] = { value, confidence: c, source, tick: w.tick };
    return;
  }
  if (existing.value === value) {
    existing.confidence = Math.min(1, Math.max(existing.confidence, c));
    existing.source = source;
    existing.tick = w.tick;
    return;
  }
  if (c >= existing.confidence) {
    a.beliefs[fact] = { value, confidence: c, source, tick: w.tick };
  } else {
    existing.confidence = Math.max(0, existing.confidence - c * 0.6);
  }
}

/** Direct observation replaces whatever was believed before. */
export function observe(w: World, agentId: CharacterId, fact: FactKey, value: BeliefValue, source: string, confidence = 1): void {
  const a = w.agents[agentId];
  if (!a) throw new Error(`Unknown agent ${agentId}`);
  const existing = a.beliefs[fact];
  if (existing) {
    existing.value = value;
    existing.confidence = confidence;
    existing.source = source;
    existing.tick = w.tick;
  } else {
    a.beliefs[fact] = { value, confidence, source, tick: w.tick };
  }
}

export function getBelief(w: World, agentId: CharacterId, fact: FactKey): BeliefValue | undefined {
  return w.agents[agentId]?.beliefs[fact]?.value;
}

export function forgetBelief(w: World, agentId: CharacterId, fact: FactKey): void {
  const a = w.agents[agentId];
  if (a) delete a.beliefs[fact];
}

/** Trust-weighted factor applied to what `from` says, as heard by `to`. */
export function trustFactor(w: World, to: CharacterId, from: CharacterId): number {
  const trust = w.agents[to]?.relationships[from]?.trust ?? 3;
  return 0.4 + trust * 0.06;
}

/** One agent tells another a fact. The listener weighs it by trust. */
export function tell(w: World, from: CharacterId, to: CharacterId, fact: FactKey, value: BeliefValue, confidence: number): void {
  if (from === to) return;
  const effective = Math.min(1, confidence * trustFactor(w, to, from));
  setBelief(w, to, fact, value, effective, from);
  emit(w, { type: 'Told', tick: w.tick, from, to, fact, value, confidence: effective });
}
