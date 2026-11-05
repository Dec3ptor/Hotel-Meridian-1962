/**
 * Storylets for the player's verbs: what each character says when asked,
 * told, shown or handed something, or accused; what they say to a guest in
 * their room or on their heels. Every character has a fallback for every
 * verb so nothing ever fails silently.
 */
import { moveItem, setFlag } from '../../sim/actions';
import { setBelief } from '../../sim/agents/beliefs';
import { adjustMood } from '../../sim/agents/mood';
import { believes, has } from '../../sim/query';
import { emit } from '../../sim/registry';
import type { CharacterId, StoryletDef, StoryletLine } from '../../sim/types';

const L = (who: CharacterId, text: string): StoryletLine => ({ who, text });

function ask(speaker: CharacterId, topic: string, lines: StoryletLine[], extra: Partial<StoryletDef> = {}): StoryletDef {
  return { id: `${speaker}_ask_${topic}`, speaker, trigger: { ask: topic }, lines, priority: 10, ...extra };
}

function fallbackAsk(speaker: CharacterId, lines: string[]): StoryletDef {
  return {
    id: `${speaker}_ask_fallback`,
    speaker,
    trigger: { ask: '*' },
    lines: [L(speaker, lines[0]!)],
    variants: lines.slice(1).map((t) => [L(speaker, t)]),
    priority: 0,
  };
}

function fallbackTell(speaker: CharacterId, lines: string[]): StoryletDef {
  return {
    id: `${speaker}_tell_fallback`,
    speaker,
    trigger: { tell: '*' },
    lines: [L(speaker, lines[0]!)],
    variants: lines.slice(1).map((t) => [L(speaker, t)]),
    priority: 0,
  };
}

function fallbackShow(speaker: CharacterId, lines: string[]): StoryletDef {
  return {
    id: `${speaker}_show_fallback`,
    speaker,
    trigger: { show: '*' },
    lines: [L(speaker, lines[0]!)],
    variants: lines.slice(1).map((t) => [L(speaker, t)]),
    priority: 0,
  };
}

/** Refusing a gift hands it straight back. */
function fallbackGive(speaker: CharacterId, text: string): StoryletDef {
  return {
    id: `${speaker}_give_fallback`,
    speaker,
    trigger: { give: '*' },
    lines: [L(speaker, text)],
    effects: (w, sp) => {
      const given = sp.inventory.find((i) => w.items[i]!.loc.kind === 'agent' && w.log.some((e) => e.type === 'Gave' && e.item === i && e.from === 'player' && e.tick === w.tick));
      if (given) moveItem(w, given, { kind: 'agent', agent: 'player' }, sp.id);
    },
    priority: 0,
  };
}

function fallbackAccuse(speaker: CharacterId, killer: string, driver: string): StoryletDef[] {
  return [
    { id: `${speaker}_accuse_killer_fallback`, speaker, trigger: { accuse: 'killer' }, lines: [L(speaker, killer)], priority: 0 },
    { id: `${speaker}_accuse_driver_fallback`, speaker, trigger: { accuse: 'driver' }, lines: [L(speaker, driver)], priority: 0 },
  ];
}

function getOut(speaker: CharacterId, first: string, again: string): StoryletDef {
  return {
    id: `${speaker}_get_out`,
    speaker,
    listener: 'player',
    trigger: { topic: 'get_out' },
    lines: [L(speaker, first)],
    variants: [[L(speaker, again)]],
    effects: (w, sp, li) => {
      adjustMood(w, sp.id, 'suspicion', 1, 'a guest in my room');
      if (li && Number(w.flags[`storyletCount:${sp.id}_get_out`] ?? 0) >= 2) {
        adjustMood(w, li.id, 'fear', 1, `${sp.id} means it`);
      }
    },
    minutes: 0.4,
    priority: 10,
  };
}

function beingFollowed(speaker: CharacterId, text: string): StoryletDef {
  return {
    id: `${speaker}_being_followed`,
    speaker,
    listener: 'player',
    trigger: { topic: 'being_followed' },
    lines: [L(speaker, text)],
    effects: (w, sp) => adjustMood(w, sp.id, 'suspicion', 1, 'being followed'),
    minutes: 0.4,
    priority: 10,
  };
}

export const playerStorylets: StoryletDef[] = [
  // =========================================================================
  // Walter
  // =========================================================================
  ask('walter', 'tonight', [L('walter', 'A bad night to be stranded, sir. The bridge is out and the lines are down. There is brandy at the bar and a fire in the lobby, which is more than the road has.')]),
  ask('walter', 'the_hotel', [L('walter', 'Opened in \'26. I came in \'31, the year the highway did. Then the highway moved and we stayed. Mr. Voss is our only regular these days.')]),
  ask('walter', 'the_storm', [L('walter', 'The creek takes the bridge every few years. It will be passable by noon, if the rain stops.')]),
  ask('walter', 'voss', [L('walter', 'Mr. Voss travels in sales. He is generous with the staff.'), 'He straightens the ledger that does not need straightening.']),
  ask('walter', 'vivian', [L('walter', 'The lady in Suite 1 is Mrs. Marsh. I know nothing more about her, and I would say the same if I did.')]),
  ask('walter', 'mrs_marsh', [L('walter', 'I can\'t give out guests\' rooms, sir. Or their business.')], {
    variants: [[L('walter', 'Mrs. Marsh keeps to herself. I would be obliged if everyone let her.')]],
  }),
  ask('walter', 'hale', [L('walter', 'The Colonel arrived this afternoon, an hour behind Mr. Voss. He reads the paper and he watches the bar. Old soldiers like to watch a room.')]),
  ask('walter', 'ruth', [L('walter', 'The young lady in Room 6. Nervous. She asked after Mrs. Marsh, which is not for me to pass on.')]),
  ask('walter', 'jimmy', [L('walter', 'Mr. Doyle, Room 6. Sales, he says. He went out to the lot in the rain; you do not do that for cigarettes.')]),
  ask('walter', 'crash_1949', [L('walter', 'The coast road. Nineteen forty-nine.'), 'He looks at the party photographs on the office wall, and then he does not.', L('walter', 'There was a party here that night. That is all I know.')], {
    effects: (w, sp) => adjustMood(w, sp.id, 'fear', 1, 'the coast road, again'),
  }),
  ask('walter', 'the_safe', [L('walter', 'The hotel safe is for guests\' valuables, sir. The combination stays with me.')]),
  ask('walter', 'the_nightcap', [L('walter', 'Mr. Voss takes a brandy at twenty past one, every night he stays. I make it up at five past. It is the one thing in this hotel that runs to time.')], {
    tells: [{ fact: 'vossTakesANightcap', value: true, confidence: 1 }],
  }),
  ask('walter', 'the_murder', [L('walter', 'Murder? Sir, please. Not in this house.')], {
    when: (w, sp) => !believes(w, sp.id, 'murderHappened', true, 0.5),
  }),
  ask('walter', 'the_murder', [L('walter', 'Mr. Voss is dead in Suite 3. The deputy will want everyone where he can see them, and that includes you.')], {
    when: (w, sp) => believes(w, sp.id, 'murderHappened', true, 0.5),
    priority: 20,
  }),
  fallbackAsk('walter', ['I couldn\'t say, sir. I only work nights.', 'That is not something the desk has an opinion on, sir.', 'You would have to ask the day man, and he is on the far side of the bridge.']),
  {
    id: 'walter_tell_vossBlackmailsVivian',
    speaker: 'walter',
    trigger: { tell: 'vossBlackmailsVivian' },
    lines: ['He does not ask how you know.', L('walter', 'I will not discuss a guest. Not that one, not ever.')],
    effects: (w, sp) => adjustMood(w, sp.id, 'fear', 1, 'someone else knows about Voss and Vivian'),
    priority: 10,
  },
  {
    id: 'walter_tell_troubleUpstairs',
    speaker: 'walter',
    trigger: { tell: 'troubleUpstairs' },
    lines: [L('walter', 'Upstairs? I will go and look. Stay here, sir.')],
    priority: 10,
  },
  fallbackTell('walter', ['Is that so, sir. I will bear it in mind.', 'I hear a great many things at this desk. Most of them keep till morning.']),
  {
    id: 'walter_shown_ledger',
    speaker: 'walter',
    trigger: { show: 'blackmail_ledger' },
    lines: ['He reads page two without touching it. His face goes the colour of the ledger.', L('walter', 'Put that away. Put it away before he sees you with it.')],
    effects: (w, sp) => {
      setBelief(w, sp.id, 'vossBlackmailer', true, 1, 'player');
      adjustMood(w, sp.id, 'fear', 2, 'my name is in his book');
    },
    priority: 10,
  },
  {
    id: 'walter_shown_letters',
    speaker: 'walter',
    trigger: { show: 'blackmail_letters' },
    lines: [L('walter', 'I know the hand. God forgive me, I know the hand.')],
    effects: (w, sp) => adjustMood(w, sp.id, 'fear', 2, 'the letters'),
    priority: 10,
  },
  {
    id: 'walter_shown_earring',
    speaker: 'walter',
    trigger: { show: 'ruth_earring' },
    lines: [L('walter', 'That is the young lady\'s. Lost property, if you would.')],
    priority: 10,
  },
  fallbackShow('walter', ['Very good, sir.', 'I see it, sir. I am not sure what you would like me to do about it.']),
  {
    id: 'walter_given_ledger',
    speaker: 'walter',
    trigger: { give: 'blackmail_ledger' },
    lines: [L('walter', 'I will see the deputy gets this when the water is down. God help us all, including me.')],
    effects: (w, sp) => {
      setFlag(w, 'ledgerToPolice', true);
      setBelief(w, sp.id, 'vossBlackmailer', true, 1, 'player');
      adjustMood(w, sp.id, 'resolve', 2, 'thirty years of silence, done with');
    },
    priority: 10,
  },
  {
    id: 'walter_given_earring',
    speaker: 'walter',
    trigger: { give: 'ruth_earring' },
    lines: [L('walter', 'Lost property. Thank you, sir.')],
    effects: (w) => moveItem(w, 'ruth_earring', { kind: 'fixture', fixture: 'lost_and_found' }, 'walter'),
    priority: 10,
  },
  fallbackGive('walter', 'I could not take that, sir. Hotel policy.'),
  ...fallbackAccuse('walter', 'Nobody has been killed in this hotel, sir, and I would thank you not to start.', 'I was at this desk in 1949, sir. I will not say who was driving. Not for you, not for anyone.'),
  getOut('walter', 'The office is staff only, sir. The desk is through there, if you need something.', 'Sir. Out, please. I will not ask a third time.'),
  beingFollowed('walter', 'Can I help you with something, sir? You seem to be everywhere I turn tonight.'),

  // =========================================================================
  // Voss
  // =========================================================================
  ask('voss', 'tonight', [L('voss', 'Rain, rye and a captive audience. I have had worse nights.')]),
  ask('voss', 'the_hotel', [L('voss', 'The Meridian. I stayed here in \'49 when it was somewhere. Now it is nowhere, which has its uses.')]),
  ask('voss', 'vivian', [L('voss', 'Mrs. Marsh? Never met the lady.'), 'He smiles the way a man smiles at a joke only he has heard.']),
  ask('voss', 'mrs_marsh', [L('voss', 'A lady travelling alone. One respects that.')]),
  ask('voss', 'hale', [L('voss', 'The old boy with the paper? Army, by the shoes. They never learn to sit still.')]),
  ask('voss', 'jimmy', [L('voss', 'The kid in Room 6? Salesman, I\'d say. We are a brotherhood.')]),
  ask('voss', 'ruth', [L('voss', 'Pretty girl. Nervous. Somebody should tell her the world is not as big as she thinks.')]),
  ask('voss', 'crash_1949', [L('voss', 'Before my time, friend. I read the papers like everybody else.')], {
    effects: (w, sp) => adjustMood(w, sp.id, 'suspicion', 1, 'a guest asking about 1949'),
  }),
  ask('voss', 'the_ledger', [L('voss', 'Every salesman keeps a book. Mine is more interesting than most.')], {
    effects: (w, sp) => adjustMood(w, sp.id, 'suspicion', 2, 'a guest asking about my book'),
  }),
  ask('voss', 'the_safe', [L('voss', 'A man puts his samples in the hotel safe. Nothing to see.')]),
  ask('voss', 'the_telegram', [L('voss', 'Business. All parties present, you might say.')]),
  fallbackAsk('voss', ['I am in sales. Everything is for sale, friend. Even the weather.', 'You ask a lot of questions for a man with a wet suitcase.', 'Buy me a drink and I will think of an answer.']),
  {
    id: 'voss_told_hale_is_father',
    speaker: 'voss',
    trigger: { tell: 'haleIsClarasFather' },
    lines: [L('voss', 'Is he now.'), 'He does not look at the lobby. He makes a point of not looking.'],
    effects: (w, sp) => {
      adjustMood(w, sp.id, 'suspicion', 2, 'the Colonel is Clara Hale\'s father');
      setBelief(w, sp.id, 'haleIsAThreat', true, 0.8, 'player');
    },
    priority: 10,
  },
  {
    id: 'voss_told_hale_has_knife',
    speaker: 'voss',
    trigger: { tell: 'haleHasAKnife' },
    lines: [L('voss', 'Then he is a fool, and I have met fools before.'), 'His hand rests, a moment, on the pocket of his coat.'],
    effects: (w, sp) => adjustMood(w, sp.id, 'suspicion', 2, 'the Colonel has a knife'),
    priority: 10,
  },
  fallbackTell('voss', ['Noted.', 'You are a font of information, friend. Who else have you told?']),
  {
    id: 'voss_shown_ledger',
    speaker: 'voss',
    trigger: { show: 'blackmail_ledger' },
    lines: [L('voss', 'Where did you get that?'), 'His hand closes on your wrist, and the ledger is his again.'],
    effects: (w, sp, li) => {
      if (li && has(w, li.id, 'blackmail_ledger')) moveItem(w, 'blackmail_ledger', { kind: 'agent', agent: sp.id }, sp.id);
      adjustMood(w, sp.id, 'anger', 3, 'my ledger in a stranger\'s hand');
      adjustMood(w, sp.id, 'suspicion', 3, 'my ledger in a stranger\'s hand');
      if (li) emit(w, { type: 'Threatened', tick: w.tick, agent: li.id, by: sp.id, weapon: 'voss_pistol' });
      if (li) adjustMood(w, li.id, 'fear', 2, 'Voss means it');
    },
    priority: 10,
  },
  {
    id: 'voss_shown_letters',
    speaker: 'voss',
    trigger: { show: 'blackmail_letters' },
    lines: [L('voss', 'She kept them. Sentimental.'), L('voss', 'Keep them if you like. They are only worth something to her.')],
    effects: (w, sp) => adjustMood(w, sp.id, 'suspicion', 2, 'the letters are loose'),
    priority: 10,
  },
  fallbackShow('voss', ['Very nice.', 'And what do you want for it?']),
  {
    id: 'voss_given_ledger',
    speaker: 'voss',
    trigger: { give: 'blackmail_ledger' },
    lines: [L('voss', 'Sensible. We will say no more about it.')],
    effects: (w, sp) => adjustMood(w, sp.id, 'suspicion', 1, 'the stranger had my ledger'),
    priority: 10,
  },
  fallbackGive('voss', 'I do not take gifts from strangers. Bad for business.'),
  ...fallbackAccuse('voss', 'Nobody is dead, friend. Have another drink.', 'You are smarter than you look. Keep it to yourself and you will stay that way.'),
  getOut('voss', 'This is a private room, friend. Out.', 'I will not ask twice.'),
  beingFollowed('voss', 'You are on my heels, friend. Lose the habit.'),

  // =========================================================================
  // Vivian
  // =========================================================================
  ask('vivian', 'tonight', [L('vivian', 'I am waiting for the rain to stop. Like everyone.')]),
  ask('vivian', 'the_hotel', [L('vivian', 'I have never been here before.'), 'Her eyes go to the piano in the bar, and come back.']),
  ask('vivian', 'voss', [L('vivian', 'The salesman? I do not know him.')], {
    effects: (w, sp) => adjustMood(w, sp.id, 'fear', 1, 'someone noticed me with Voss'),
  }),
  ask('vivian', 'mrs_marsh', [L('vivian', 'That is my name. Mrs. Marsh.')]),
  ask('vivian', 'ruth', [L('vivian', 'The girl in Room 6? I do not know her.')], {
    when: (w, sp) => !believes(w, sp.id, 'daughterIsHere', true, 0.5),
  }),
  ask('vivian', 'ruth', [L('vivian', 'Please. Please do not.')], {
    when: (w, sp) => believes(w, sp.id, 'daughterIsHere', true, 0.5),
    priority: 20,
  }),
  ask('vivian', 'hale', [L('vivian', 'The Colonel. He looks at me as if he is trying to remember something.')]),
  ask('vivian', 'crash_1949', [L('vivian', 'I do not listen to the news.')], {
    effects: (w, sp) => adjustMood(w, sp.id, 'fear', 2, 'they know about 1949'),
  }),
  ask('vivian', 'the_letters', [L('vivian', 'What letters?'), 'She says it too fast.']),
  fallbackAsk('vivian', ['I am afraid I do not know anyone here. I am only passing through.', 'I would rather not talk, if it is all the same to you.', 'Ask the clerk. He knows everything about this place.']),
  {
    id: 'vivian_told_hale_is_father',
    speaker: 'vivian',
    trigger: { tell: 'haleIsClarasFather' },
    lines: [L('vivian', 'Clara\'s... The Colonel is Clara Hale\'s father.'), 'She sits down because her legs decide it.'],
    effects: (w, sp) => {
      adjustMood(w, sp.id, 'fear', 3, 'Clara Hale\'s father is in the hotel');
      setBelief(w, sp.id, 'haleIsClarasFather', true, 0.9, 'player');
    },
    priority: 10,
  },
  {
    id: 'vivian_told_ruth_is_daughter',
    speaker: 'vivian',
    trigger: { tell: 'ruthIsYourDaughter' },
    lines: [L('vivian', 'Don\'t. Don\'t say that to me.'), 'But she does not say it is untrue.'],
    effects: (w, sp) => {
      setBelief(w, sp.id, 'daughterIsHere', true, 0.9, 'player');
      adjustMood(w, sp.id, 'fear', 1, 'she is here');
      adjustMood(w, sp.id, 'resolve', 2, 'she is here');
    },
    priority: 10,
  },
  {
    id: 'vivian_told_hale_has_knife',
    speaker: 'vivian',
    trigger: { tell: 'haleHasAKnife' },
    lines: [L('vivian', 'A knife. For Voss, or for me?')],
    effects: (w, sp) => adjustMood(w, sp.id, 'fear', 2, 'the Colonel has a knife'),
    priority: 10,
  },
  {
    id: 'vivian_told_voss_has_photographer',
    speaker: 'vivian',
    trigger: { tell: 'jimmyWorksForVoss' },
    lines: [L('vivian', 'A photographer. Of course he would.')],
    effects: (w, sp) => adjustMood(w, sp.id, 'fear', 1, 'Voss has a photographer here'),
    priority: 10,
  },
  fallbackTell('vivian', ['I see.', 'Why are you telling me this?']),
  {
    id: 'vivian_shown_letters',
    speaker: 'vivian',
    trigger: { show: 'blackmail_letters' },
    lines: [L('vivian', 'Where did you... give those to me. Give them to me!')],
    effects: (w, sp) => {
      adjustMood(w, sp.id, 'fear', 3, 'a stranger has the letters');
      adjustMood(w, sp.id, 'anger', 2, 'a stranger has the letters');
    },
    priority: 10,
  },
  {
    id: 'vivian_shown_certificate',
    speaker: 'vivian',
    trigger: { show: 'birth_certificate' },
    lines: ['She reads it twice.', L('vivian', 'She is here. She is in this hotel.')],
    effects: (w, sp) => {
      setBelief(w, sp.id, 'daughterIsHere', true, 1, 'player');
      adjustMood(w, sp.id, 'fear', 1, 'Ruth is here');
      adjustMood(w, sp.id, 'resolve', 2, 'Ruth is here');
    },
    priority: 10,
  },
  fallbackShow('vivian', ['I do not want to see it.', 'Put it away. Please.']),
  {
    id: 'vivian_given_letters',
    speaker: 'vivian',
    trigger: { give: 'blackmail_letters' },
    lines: [L('vivian', 'Thank you. Thank you.'), 'She holds them against her coat as if they could still burn.'],
    effects: (w, sp) => {
      adjustMood(w, sp.id, 'fear', -1, 'the letters are back');
      const rel = sp.relationships.player;
      if (rel) rel.trust = Math.min(10, rel.trust + 3);
    },
    priority: 10,
  },
  {
    id: 'vivian_given_pills',
    speaker: 'vivian',
    trigger: { give: 'sleeping_pills' },
    lines: [L('vivian', 'Those are mine. I will not ask how you came by them.')],
    priority: 10,
  },
  fallbackGive('vivian', 'No. I could not.'),
  ...fallbackAccuse('vivian', 'I was in my room. I was in my room all night.', 'Get away from me. Get away from me!'),
  getOut('vivian', 'Get out. Get out of my room or I will scream the house down.', 'I mean it. I will scream.'),
  beingFollowed('vivian', 'Why are you following me? What do you want?'),

  // =========================================================================
  // Colonel Hale
  // =========================================================================
  ask('hale', 'tonight', [L('hale', 'A night for staying indoors, and for keeping one\'s own counsel.')]),
  ask('hale', 'voss', [L('hale', 'The salesman.'), 'He folds the newspaper very precisely.', L('hale', 'I have no opinion of salesmen.')]),
  ask('hale', 'vivian', [L('hale', 'The lady in Suite 1? Just a guest, I should think. Like you.')], {
    when: (w, sp) => !believes(w, sp.id, 'driverOf1949', 'vivian', 0.6),
  }),
  ask('hale', 'vivian', [L('hale', 'Vivian Lane. The name was on the bill at every picture house on the coast, in 1949.')], {
    when: (w, sp) => believes(w, sp.id, 'driverOf1949', 'vivian', 0.6),
    priority: 20,
  }),
  ask('hale', 'crash_1949', [L('hale', 'My daughter was nineteen. She was walking home along the coast road.'), L('hale', 'A deputy wrote it up as an accident with no car. There is no such thing.')], {
    tells: [{ fact: 'haleIsClarasFather', value: true, confidence: 1 }],
    effects: (w, sp) => adjustMood(w, sp.id, 'anger', 1, 'saying her name'),
  }),
  ask('hale', 'clara_hale', [L('hale', 'You know her name. Then you know more than the county did.')], {
    tells: [{ fact: 'haleIsClarasFather', value: true, confidence: 1 }],
  }),
  ask('hale', 'the_hotel', [L('hale', 'It was a fashionable place once. Fashion is a kind of weather.')]),
  ask('hale', 'walter', [L('hale', 'The clerk was here in 1949. He will not say so, but it is in the way he looks at the stairs.')]),
  fallbackAsk('hale', ['I keep to myself. I would advise the same.', 'That is not a subject I discuss with strangers.', 'Read the paper. It is all in the paper, if you know how to read it.']),
  {
    id: 'hale_told_driver',
    speaker: 'hale',
    trigger: { tell: 'driverOf1949' },
    when: (w) => w.flags.toldValue === 'vivian',
    lines: [L('hale', 'Words. Show me something I can hold in my hand.')],
    effects: (w, sp) => adjustMood(w, sp.id, 'suspicion', 1, 'a stranger naming the driver'),
    priority: 10,
  },
  {
    id: 'hale_told_voss_has_pistol',
    speaker: 'hale',
    trigger: { tell: 'vossHasAPistol' },
    lines: [L('hale', 'Then I will not knock.')],
    effects: (w, sp) => adjustMood(w, sp.id, 'resolve', 1, 'Voss is armed'),
    priority: 10,
  },
  fallbackTell('hale', ['Noted.', 'You seem very well informed for a man who arrived in the rain.']),
  {
    id: 'hale_shown_letters',
    speaker: 'hale',
    trigger: { show: 'blackmail_letters' },
    when: (w, sp) => !believes(w, sp.id, 'driverOf1949', 'vivian', 0.9),
    lines: ['He stares at the signature a long time.', L('hale', '"Lane. Vivian Lane was driving."')],
    effects: (w, sp) => {
      setBelief(w, sp.id, 'driverOf1949', 'vivian', 0.9, 'player');
      adjustMood(w, sp.id, 'anger', 3, 'thirteen years at the wrong door');
    },
    priority: 90,
  },
  {
    id: 'hale_shown_letters_again',
    speaker: 'hale',
    trigger: { show: 'blackmail_letters' },
    lines: [L('hale', 'I have read them. I will not read them again.')],
    priority: 10,
  },
  {
    id: 'hale_shown_envelope',
    speaker: 'hale',
    trigger: { show: 'voss_envelope' },
    when: (w, sp) => !believes(w, sp.id, 'driverOf1949', 'vivian', 0.9),
    lines: ['Three letters in a young woman\'s hand. He reads them standing very straight.', L('hale', 'Lane. She wrote this the week after. She knew.')],
    effects: (w, sp) => {
      setBelief(w, sp.id, 'driverOf1949', 'vivian', 0.95, 'player');
      adjustMood(w, sp.id, 'anger', 3, 'she wrote it down and he kept it');
    },
    priority: 90,
  },
  {
    id: 'hale_shown_ledger',
    speaker: 'hale',
    trigger: { show: 'blackmail_ledger' },
    lines: [L('hale', 'Blackmail. Of course. He did not make it disappear; he kept it, and sold it back to her by the month.')],
    effects: (w, sp) => setBelief(w, sp.id, 'vossBlackmailer', true, 1, 'player'),
    priority: 10,
  },
  {
    id: 'hale_shown_clippings',
    speaker: 'hale',
    trigger: { show: 'hale_clippings' },
    lines: [L('hale', 'Those are mine. Give them here.')],
    effects: (w, sp, li) => {
      if (li && has(w, li.id, 'hale_clippings')) moveItem(w, 'hale_clippings', { kind: 'agent', agent: sp.id }, sp.id);
      adjustMood(w, sp.id, 'anger', 1, 'my clippings in a stranger\'s hand');
    },
    priority: 10,
  },
  fallbackShow('hale', ['I see it.', 'And?']),
  {
    id: 'hale_given_ledger',
    speaker: 'hale',
    trigger: { give: 'blackmail_ledger' },
    lines: [L('hale', 'This goes to the county attorney. You have my word, for what it has been worth.')],
    effects: (w, sp) => {
      setFlag(w, 'ledgerToPolice', true);
      setBelief(w, sp.id, 'vossBlackmailer', true, 1, 'player');
    },
    priority: 10,
  },
  fallbackGive('hale', 'I have no use for that.'),
  ...fallbackAccuse('hale', 'Nobody has been killed. Yet.', 'If I believed that, I would... No. I have followed the right man across three states.'),
  getOut('hale', 'You have the wrong room. Leave it.', 'Out. Now.'),
  beingFollowed('hale', 'You have been behind me since the lobby. State your business or stop.'),
  {
    id: 'vivian_confesses',
    speaker: 'hale',
    listener: 'vivian',
    trigger: { topic: 'clara_hale' },
    when: (w, sp, li) => !!li && believes(w, li.id, 'haleIsClarasFather', true, 0.5) && li.mood.fear < 9,
    lines: [
      L('hale', 'Clara Hale. The coast road. Nineteen forty-nine.'),
      'A long silence, with the rain in it.',
      L('vivian', 'I was driving. I had been drinking, and I was driving, and I did not stop.'),
      L('vivian', 'I have paid a man every month for thirteen years to keep that sentence from you. I would rather have said it.'),
      'He does not move for a long time. When he does, it is to sit down on the edge of her bed like an old man.',
      L('hale', 'She was walking home.'),
    ],
    effects: (w, sp, li) => {
      setBelief(w, sp.id, 'vivianConfessed', true, 1, 'vivian');
      setBelief(w, sp.id, 'driverOf1949', 'vivian', 1, 'vivian');
      adjustMood(w, sp.id, 'anger', -5, 'she said it to my face');
      adjustMood(w, sp.id, 'resolve', -3, 'there is nothing left to do');
      if (li) {
        adjustMood(w, li.id, 'fear', -3, 'it is said');
        adjustMood(w, li.id, 'resolve', 3, 'it is said');
        setBelief(w, li.id, 'confessedToHale', true, 1, 'seen');
      }
    },
    minutes: 6,
    priority: 50,
  },
  {
    id: 'hale_confronts_vivian_denial',
    speaker: 'hale',
    listener: 'vivian',
    trigger: { topic: 'clara_hale' },
    lines: [
      L('hale', 'Clara Hale. The coast road. Nineteen forty-nine.'),
      L('vivian', 'I don\'t know what you mean. I don\'t know who that is.'),
      L('hale', 'You were driving.'),
      L('vivian', 'Get away from my door.'),
    ],
    effects: (w, sp, li) => {
      adjustMood(w, sp.id, 'anger', 3, 'she lied to my face');
      if (li) adjustMood(w, li.id, 'fear', 3, 'he knows');
    },
    minutes: 2,
    priority: 10,
  },

  // =========================================================================
  // Jimmy
  // =========================================================================
  ask('jimmy', 'tonight', [L('jimmy', 'Romantic getaway. Rain, a dead phone and a bar with no ice. I pick \'em.')]),
  ask('jimmy', 'ruth', [L('jimmy', 'Ruthie? She\'s swell. Bit of a worrier.')]),
  ask('jimmy', 'voss', [L('jimmy', 'Never met the guy.')], {
    effects: (w, sp) => adjustMood(w, sp.id, 'fear', 1, 'someone asking about Voss'),
  }),
  ask('jimmy', 'the_hotel', [L('jimmy', 'Got a deal on the room. Guy knew a guy.')]),
  ask('jimmy', 'vivian', [L('jimmy', 'The dame in Suite 1? Classy. Out of my league, out of yours.')]),
  ask('jimmy', 'the_camera', [L('jimmy', 'Hobby. Everybody needs a hobby.')], {
    effects: (w, sp) => adjustMood(w, sp.id, 'suspicion', 1, 'who told them about the camera'),
  }),
  fallbackAsk('jimmy', ['Hell of a night, huh? You want a cigarette?', 'Beats me, pal.', 'Ask the old guy at the desk. He loves to talk.']),
  {
    id: 'jimmy_told_ruth_is_daughter',
    speaker: 'jimmy',
    trigger: { tell: 'ruthIsVivianDaughter' },
    lines: [L('jimmy', 'Who told you that?'), 'He looks at the door to Room 6 and back.'],
    effects: (w, sp) => adjustMood(w, sp.id, 'fear', 2, 'they know about Ruth'),
    priority: 10,
  },
  {
    id: 'jimmy_told_voss_dead',
    speaker: 'jimmy',
    trigger: { tell: 'dead:voss' },
    lines: [L('jimmy', 'Dead? Voss?'), L('jimmy', 'Then I\'m not waiting around to be the guy who found him.')],
    effects: (w, sp) => {
      setBelief(w, sp.id, 'dead:voss', true, 0.6, 'player');
      adjustMood(w, sp.id, 'fear', 3, 'Voss is dead');
    },
    priority: 10,
  },
  fallbackTell('jimmy', ['Yeah? Huh.', 'Sure, pal. Sure.']),
  {
    id: 'jimmy_shown_press_pass',
    speaker: 'jimmy',
    trigger: { show: 'press_pass' },
    lines: [L('jimmy', 'So I take pictures. So what. Give it here.')],
    effects: (w, sp, li) => {
      if (li && has(w, li.id, 'press_pass')) moveItem(w, 'press_pass', { kind: 'agent', agent: sp.id }, sp.id);
      adjustMood(w, sp.id, 'anger', 1, 'my pass in a stranger\'s hand');
    },
    priority: 10,
  },
  {
    id: 'jimmy_shown_film',
    speaker: 'jimmy',
    trigger: { show: 'undeveloped_film' },
    lines: [L('jimmy', 'Where did you get that?'), L('jimmy', 'Keep it. Burn it. I don\'t care any more.')],
    effects: (w, sp) => adjustMood(w, sp.id, 'fear', 1, 'the film is loose'),
    priority: 10,
  },
  fallbackShow('jimmy', ['Nice.', 'What am I looking at?']),
  fallbackGive('jimmy', 'Keep it, pal. I travel light.'),
  ...fallbackAccuse('jimmy', 'Whoa. Whoa. I found him, I didn\'t do it.', 'Nineteen forty-nine? I was fifteen, pal.'),
  getOut('jimmy', 'Hey. Hey! This is our room, pal.', 'I said out. You deaf?'),
  beingFollowed('jimmy', 'You got a problem, buddy? You\'re everywhere I look.'),

  // =========================================================================
  // Ruth
  // =========================================================================
  ask('ruth', 'tonight', [L('ruth', 'Jimmy said it would be romantic. It\'s just rain.')]),
  ask('ruth', 'jimmy', [L('ruth', 'He\'s in sales. He\'s... he goes out a lot.')]),
  ask('ruth', 'mrs_marsh', [L('ruth', 'Do you know which room she\'s in? The clerk won\'t say.')], {
    when: (w, sp) => !believes(w, sp.id, 'vivianIsInSuite1', true, 0.5),
  }),
  ask('ruth', 'mrs_marsh', [L('ruth', 'Suite 1. I know where she is. I just have to knock.')], {
    when: (w, sp) => believes(w, sp.id, 'vivianIsInSuite1', true, 0.5),
    priority: 20,
  }),
  ask('ruth', 'vivian', [L('ruth', 'Vivian Lane? The actress? Why would you ask me that?')], {
    effects: (w, sp) => adjustMood(w, sp.id, 'fear', 1, 'they know the name'),
  }),
  ask('ruth', 'voss', [L('ruth', 'The man at the bar? He looked at me like he knew me.')]),
  ask('ruth', 'the_hotel', [L('ruth', 'It\'s beautiful, under the dust. Someone should love it.')]),
  fallbackAsk('ruth', ['I\'m sorry, I don\'t... I\'m just here with my boyfriend.', 'I don\'t know. I don\'t know anything about this place.', 'Could you ask Jimmy? He\'s better at talking.']),
  {
    id: 'ruth_told_jimmy_works_for_voss',
    speaker: 'ruth',
    trigger: { tell: 'jimmyWorksForVoss' },
    lines: [L('ruth', 'Jimmy? Works for... no. No, he\'s in sales.'), 'She says it again, quieter, and does not believe it the second time either.'],
    effects: (w, sp) => {
      adjustMood(w, sp.id, 'suspicion', 2, 'Jimmy works for Voss');
      adjustMood(w, sp.id, 'anger', 1, 'Jimmy works for Voss');
    },
    priority: 10,
  },
  {
    id: 'ruth_told_vivian_in_suite1',
    speaker: 'ruth',
    trigger: { tell: 'vivianIsInSuite1' },
    lines: [L('ruth', 'Suite 1.'), L('ruth', 'Thank you. I... thank you.')],
    effects: (w, sp) => {
      setBelief(w, sp.id, 'vivianIsInSuite1', true, 0.9, 'player');
      adjustMood(w, sp.id, 'resolve', 2, 'I know where she is');
    },
    priority: 10,
  },
  {
    id: 'ruth_told_vivian_is_mrs_marsh',
    speaker: 'ruth',
    trigger: { tell: 'vivianIsMrsMarsh' },
    lines: [L('ruth', 'Mrs. Marsh is Vivian Lane. I knew it. I knew it from the ledger.')],
    effects: (w, sp) => setBelief(w, sp.id, 'vivianIsMrsMarsh', true, 0.95, 'player'),
    priority: 10,
  },
  fallbackTell('ruth', ['Oh.', 'I don\'t know what to do with that.']),
  {
    id: 'ruth_shown_certificate',
    speaker: 'ruth',
    trigger: { show: 'birth_certificate' },
    lines: [L('ruth', 'That\'s mine! Where did you get that? Give it back!')],
    effects: (w, sp, li) => {
      if (li && has(w, li.id, 'birth_certificate')) moveItem(w, 'birth_certificate', { kind: 'agent', agent: sp.id }, sp.id);
      adjustMood(w, sp.id, 'anger', 2, 'a stranger went through my bag');
    },
    priority: 10,
  },
  {
    id: 'ruth_shown_press_pass',
    speaker: 'ruth',
    trigger: { show: 'press_pass' },
    lines: [L('ruth', 'Staff photographer. Jimmy said he was in sales.'), L('ruth', 'Why would he lie about that?')],
    effects: (w, sp) => {
      setBelief(w, sp.id, 'jimmyIsPhotographer', true, 1, 'player');
      adjustMood(w, sp.id, 'suspicion', 2, 'Jimmy lied about his job');
    },
    priority: 10,
  },
  {
    id: 'ruth_shown_letters',
    speaker: 'ruth',
    trigger: { show: 'blackmail_letters' },
    lines: ['She reads the first page and no further.', L('ruth', 'My mother did that. My mother killed someone and paid to hide it.')],
    effects: (w, sp) => {
      setBelief(w, sp.id, 'vivianWasDriver', true, 0.9, 'player');
      adjustMood(w, sp.id, 'fear', 2, 'what my mother did');
    },
    priority: 10,
  },
  fallbackShow('ruth', ['I don\'t understand.', 'What is it?']),
  {
    id: 'ruth_given_earring',
    speaker: 'ruth',
    trigger: { give: 'ruth_earring' },
    lines: [L('ruth', 'My earring! I didn\'t even... thank you.')],
    effects: (w, sp) => {
      const rel = sp.relationships.player;
      if (rel) rel.trust = Math.min(10, rel.trust + 2);
    },
    priority: 10,
  },
  fallbackGive('ruth', 'I can\'t take that.'),
  ...fallbackAccuse('ruth', 'I didn\'t... I was in my room! Ask Jimmy!', 'I wasn\'t born until the year after.'),
  getOut('ruth', 'This is our room. Please go.', 'Please. I\'ll call the clerk.'),
  beingFollowed('ruth', 'Are you... are you following me?'),
  {
    id: 'ruth_confronts_jimmy_voss',
    speaker: 'ruth',
    listener: 'jimmy',
    trigger: { topic: 'do_you_work_for_voss' },
    soundKind: 'argument',
    loudness: 3,
    lines: [
      L('ruth', 'Do you work for him? For Voss?'),
      L('jimmy', 'Who told you that?'),
      L('ruth', 'Is that why we\'re here? Did he send you? Did he send you to me?'),
      L('jimmy', 'Ruth, listen...'),
      L('ruth', 'Get out. Get out of this room.'),
    ],
    effects: (w, sp, li) => {
      adjustMood(w, sp.id, 'anger', 3, 'Jimmy works for Voss');
      setBelief(w, sp.id, 'jimmyWorksForVoss', true, 0.95, 'jimmy');
      const rel = sp.relationships.jimmy;
      if (rel) rel.trust = Math.max(0, rel.trust - 4);
      if (li) {
        adjustMood(w, li.id, 'fear', 2, 'Ruth knows');
        setBelief(w, li.id, 'ruthSuspectsNothing', false, 1, 'ruth');
      }
      setFlag(w, 'ruthJimmyFallout', w.tick);
    },
    minutes: 4,
    priority: 10,
  },
  {
    id: 'ruth_meets_vivian',
    speaker: 'ruth',
    listener: 'vivian',
    trigger: { topic: 'i_am_your_daughter' },
    when: (w, sp, li) => !!li && believes(w, li.id, 'daughterIsHere', true, 0.5) && li.mood.fear < 8,
    lines: [
      L('ruth', 'My name is Ruth. I was born in March 1950, in Los Angeles. The certificate says Vivian Lane.'),
      'The door does not close. After a while the chain comes off.',
      L('vivian', 'You have my mother\'s hands. I noticed in the corridor. I noticed and I shut the door.'),
      L('ruth', 'You can open it now.'),
      'They sit on the edge of the bed and talk until the rain thins out.',
    ],
    effects: (w, sp, li) => {
      setFlag(w, 'ruthMetVivian', w.tick);
      adjustMood(w, sp.id, 'fear', -2, 'she opened the door');
      adjustMood(w, sp.id, 'resolve', 2, 'she opened the door');
      if (li) {
        adjustMood(w, li.id, 'fear', -3, 'she has her mother\'s hands');
        adjustMood(w, li.id, 'resolve', 3, 'she has her mother\'s hands');
        li.flags['expecting:ruth'] = true;
        li.flags.leaveDoorOpen = true;
      }
      sp.flags['invitedTo:suite1'] = true;
    },
    minutes: 10,
    priority: 50,
  },
  {
    id: 'ruth_turned_away_again',
    speaker: 'ruth',
    listener: 'vivian',
    trigger: { topic: 'i_am_your_daughter' },
    lines: [L('ruth', 'My name is Ruth. I think you are my mother.'), L('vivian', 'You have the wrong room. Please go away.'), 'The door closes.'],
    effects: (w, sp, li) => {
      adjustMood(w, sp.id, 'fear', 2, 'she shut the door again');
      if (li) adjustMood(w, li.id, 'fear', 2, 'she knows');
    },
    minutes: 1,
    priority: 10,
  },
];
