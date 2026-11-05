/**
 * Never say "you can't do that": every verb on every target gets a real
 * response. Asks, claims, shows, gifts and accusations go through the
 * storylet matcher per character; looks go through the describer; uses
 * fail with a reason rather than silence.
 */
import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { CLAIMS, TOPICS, ACCUSATIONS } from '../src/content/dialogue/topics';
import { describeTarget } from '../src/sim/commands';
import { buildStatic } from '../src/sim/registry';
import { createSim } from '../src/sim/sim';
import { respondTo } from '../src/sim/storylets';
import type { CharacterId } from '../src/sim/types';

const CAST: CharacterId[] = ['walter', 'voss', 'vivian', 'hale', 'jimmy', 'ruth'];

describe('response coverage', () => {
  const s = buildStatic(content);

  it('every character answers every topic, claim, item and accusation with authored lines', () => {
    const gaps: string[] = [];
    for (const id of CAST) {
      const sim = createSim({ seed: 1 });
      const w = sim.world;
      const before = w.log.length;
      const check = (kind: 'ask' | 'tell' | 'show' | 'give' | 'accuse', key: string) => {
        const mark = w.log.length;
        const r = respondTo(w, id, kind, key, 'player');
        const lines = w.log.slice(mark).filter((e) => e.type === 'Said' || e.type === 'Narration');
        if (!r.ok || r.storylet === 'fallback' || lines.length === 0) gaps.push(`${id} ${kind} ${key}`);
      };
      for (const t of TOPICS) check('ask', t.id);
      for (const c of CLAIMS) {
        w.flags.toldValue = c.value;
        check('tell', c.fact);
      }
      for (const item of s.itemIds) {
        check('show', item);
        check('give', item);
      }
      for (const a of ACCUSATIONS) {
        w.flags.accused = 'voss';
        check('accuse', a.kind);
      }
      expect(w.log.length).toBeGreaterThan(before);
    }
    expect(gaps, gaps.join('\n')).toEqual([]);
  });

  it('every item, fixture, door and person has a description to look at', () => {
    const sim = createSim({ seed: 1 });
    const w = sim.world;
    const empty: string[] = [];
    const targets = [...s.itemIds, ...content.fixtures.map((f) => f.id), ...content.map.doors.map((d) => d.id), ...CAST];
    for (const t of targets) {
      for (const close of [true, false]) {
        const { text } = describeTarget(w, s, t, close);
        if (!text || text.trim().length < 8) empty.push(`${t} (${close ? 'close' : 'far'})`);
      }
    }
    expect(empty, empty.join(', ')).toEqual([]);
  });

  it('every fixture and door has at least one verb beyond Look', () => {
    const bare: string[] = [];
    for (const f of content.fixtures) {
      const verbs = (f.container ? 1 : 0) + (f.hidingSpot ? 1 : 0) + (f.id.startsWith('thin_wall') ? 1 : 0) + Object.keys(f.uses ?? {}).length + (f.proves ? 1 : 0);
      if (verbs === 0) bare.push(f.id);
    }
    expect(bare, `fixtures with nothing to do: ${bare.join(', ')}`).toEqual([]);
    for (const d of content.map.doors) expect(d.kind === 'archway' || d.tiles.length > 0).toBe(true);
  });

  it('storylet variants keep repeated answers from feeling canned', () => {
    const sim = createSim({ seed: 1 });
    const w = sim.world;
    const first: string[] = [];
    const second: string[] = [];
    const collect = (into: string[]) => {
      const mark = w.log.length;
      respondTo(w, 'walter', 'ask', 'no_such_topic_xyz', 'player');
      into.push(...w.log.slice(mark).filter((e) => e.type === 'Said').map((e) => (e.type === 'Said' ? e.text : '')));
    };
    collect(first);
    collect(second);
    expect(first.length).toBeGreaterThan(0);
    expect(first[0]).not.toBe(second[0]);
  });
});
