/**
 * Ending detection from world state. The content supplies the conditions
 * (src/content/endings.ts); this module only evaluates them. Conditions must
 * look at state, never at the path that led there.
 */
import type { Static } from './registry';
import type { EndingDef, EndingId, World } from './types';

export function detectEnding(w: World, s: Static): EndingId | undefined {
  for (const e of s.endings) {
    if (e.when(w)) return e.id;
  }
  return undefined;
}

/** Endings that stop the loop the moment they hold. */
export function checkImmediateEndings(w: World, s: Static): EndingId | undefined {
  for (const e of s.endings) {
    if (e.immediate && e.when(w)) return e.id;
  }
  return undefined;
}

export function endingDef(s: Static, id: EndingId): EndingDef | undefined {
  return s.endings.find((e) => e.id === id);
}
