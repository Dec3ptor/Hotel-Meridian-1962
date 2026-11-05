/**
 * Endings, detected from state at loop end (or immediately when marked).
 * Conditions never look at how the state was reached.
 */
import { alive, believes, dead, flag } from '../sim/query';
import { storyletRan } from '../sim/storylets';
import type { CharacterId, EndingDef, World } from '../sim/types';

const CAST: CharacterId[] = ['voss', 'vivian', 'hale', 'jimmy', 'ruth', 'walter'];

function deadCount(w: World): number {
  let n = 0;
  for (const id of CAST) if (dead(w, id)) n++;
  return n;
}

function nobodyDied(w: World): boolean {
  return deadCount(w) === 0 && alive(w, 'player');
}

function killerOf(w: World, victim: CharacterId): string | undefined {
  const k = w.agents[victim]?.flags.killedBy;
  return typeof k === 'string' ? k : undefined;
}

function anyoneBelieves(w: World, fact: string, value: string | boolean | number): boolean {
  for (const id of CAST) if (id !== 'voss' && believes(w, id, fact, value, 0.5)) return true;
  return false;
}

export const endings: EndingDef[] = [
  {
    id: 'lights_out',
    title: 'Lights Out',
    epilogue: 'The rain goes on without you. Somebody will find Room 7 empty in the morning, and the ledger will say you checked out.',
    priority: 100,
    when: (w) => dead(w, 'player'),
  },
  {
    id: 'the_truth',
    title: 'The Truth',
    epilogue:
      'Nobody dies at the Meridian tonight. Vivian tells the Colonel what happened on the coast road, and he lets the knife stay in the block. By dawn the ledger is in a county envelope, and Leonard Voss is a man with a great deal to explain.',
    priority: 95,
    when: (w) => nobodyDied(w) && storyletRan(w, 'vivian_confesses') && believes(w, 'hale', 'driverOf1949', 'vivian', 0.7) && flag(w, 'ledgerToPolice') === true,
  },
  {
    id: 'two_bodies',
    title: 'Two Bodies',
    epilogue: 'Two sheets on two beds. The county sends one deputy, who is not enough.',
    priority: 90,
    when: (w) => dead(w, 'voss') && deadCount(w) >= 2,
  },
  {
    id: 'wrong_target',
    title: 'Wrong Target',
    epilogue: 'The Colonel got the name right, thirteen years late. Voss checks out at dawn with his briefcase and a story worth more than ever.',
    priority: 85,
    when: (w) => dead(w, 'vivian') && killerOf(w, 'vivian') === 'hale',
  },
  {
    id: 'self_defence',
    title: 'Self-Defence',
    epilogue: 'One shot, close. Voss tells it the same way every time: an old man with a knife, a locked door, no choice. Nobody argues.',
    priority: 85,
    when: (w) => dead(w, 'hale') && killerOf(w, 'hale') === 'voss' && alive(w, 'voss'),
  },
  {
    id: 'overdose',
    title: 'Overdose',
    epilogue: 'The doctor calls it his heart. Vivian keeps her letters and her silence, and never sleeps well again.',
    priority: 80,
    when: (w) => dead(w, 'voss') && w.agents.voss?.flags.causeOfDeath === 'overdose',
  },
  {
    id: 'the_getaway',
    title: 'The Getaway',
    epilogue: 'The Cadillac is gone by first light, and so is the one person who could say why.',
    priority: 80,
    when: (w) => {
      const driver = flag(w, 'cadillacDrivenBy');
      return typeof driver === 'string' && dead(w, 'voss') && killerOf(w, 'voss') === driver;
    },
  },
  {
    id: 'reckoning',
    title: 'Reckoning',
    epilogue: 'Page by page, the ledger goes round the lobby. By the time the bridge is passable, the guests have a prisoner and a story they all agree on.',
    priority: 75,
    when: (w) => {
      if (!alive(w, 'voss') || w.agents.voss?.flags.left) return false;
      let believers = 0;
      for (const id of CAST) if (id !== 'voss' && alive(w, id) && believes(w, id, 'vossBlackmailer', true, 0.6)) believers++;
      return believers >= 3;
    },
  },
  {
    id: 'the_patsy',
    title: 'The Patsy',
    epilogue: 'You, in the wrong room, holding the wrong thing. The deputy writes it up before his coffee cools.',
    priority: 75,
    when: (w) => flag(w, 'playerBlamed') === true || (deadCount(w) > 0 && CAST.some((id) => alive(w, id) && believes(w, id, 'playerSuspect', true, 0.5))),
  },
  {
    id: 'mother_and_daughter',
    title: 'Mother and Daughter',
    epilogue: 'In a suite at the end of a corridor, two women sit on a bed and talk until the rain stops. Nobody else matters tonight.',
    priority: 70,
    when: (w) => nobodyDied(w) && storyletRan(w, 'ruth_meets_vivian'),
  },
  {
    id: 'the_default',
    title: 'The Default',
    epilogue:
      'Leonard Voss is found at two with a kitchen knife in him. A young man was seen running from the stairs with blood on his cuff. The Colonel reads about the arrest in the morning paper and says nothing to anyone.',
    priority: 60,
    when: (w) => dead(w, 'voss') && killerOf(w, 'voss') === 'hale' && (anyoneBelieves(w, 'bloody:jimmy', true) || w.agents.jimmy?.flags.bloody === true),
  },
  {
    id: 'the_fixer_walks',
    title: 'The Fixer Walks',
    epilogue: 'At dawn the Cadillac noses out onto the washed road with everything Voss came for. Nobody at the Meridian says a word, which is what he counts on.',
    priority: 10,
    when: (w) => nobodyDied(w),
  },
  {
    id: 'a_strange_night',
    title: 'A Strange Night',
    epilogue: 'Something happened at the Meridian tonight that nobody can quite explain, and the morning does not help.',
    priority: 1,
    when: () => true,
  },
];
