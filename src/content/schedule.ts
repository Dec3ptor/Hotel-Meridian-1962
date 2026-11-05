/**
 * World events on the clock: the storm, the dead phones, the radio bulletin.
 * These are the only things in the night that happen "because it is time".
 */
import { emitSound, setFlag } from '../sim/actions';
import { setBelief } from '../sim/agents/beliefs';
import type { ScheduleDef } from '../sim/types';

export const BULLETIN_TEXT =
  'This is KMER news at a quarter past. The county attorney announced today that the 1949 coast road hit-and-run, in which nineteen-year-old Clara Hale lost her life, is being reopened in light of new evidence.';

export const schedule: ScheduleDef[] = [
  {
    id: 'bridge_out',
    at: '10:05',
    text: 'The creek takes the bridge. Thunder; the lights flicker.',
    sound: { kind: 'thunder', room: 'lot', loudness: 5, text: 'thunder' },
    run: (w) => {
      setFlag(w, 'bridgeOut', true);
      setFlag(w, 'lightsFlickeredAt', w.tick);
    },
  },
  {
    id: 'phones_dead',
    at: '10:10',
    text: 'The switchboard goes dark. The lines are down.',
    run: (w) => {
      setFlag(w, 'phonesDead', true);
      setBelief(w, 'walter', 'phonesDead', true, 1, 'seen');
    },
  },
  {
    id: 'radio_bulletin',
    at: '11:15',
    text: 'The radio in the bar: the 1949 hit-and-run is being reopened.',
    run: (w) => {
      if (w.fixtures.radio?.state.on !== true) return;
      emitSound(w, 'radio', 'bar', 0, 3, undefined, BULLETIN_TEXT);
    },
  },
];
