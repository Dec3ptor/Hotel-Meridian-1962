/**
 * Storylets for the default night plus generic fallbacks. Each is picked by
 * (speaker, trigger) and the highest priority whose `when` holds. Lines are
 * attributed; effects change beliefs and moods.
 */
import { dropItem, giveItem } from '../../sim/actions';
import { setBelief } from '../../sim/agents/beliefs';
import { adjustMood } from '../../sim/agents/mood';
import type { StoryletDef } from '../../sim/types';

export const storylets: StoryletDef[] = [
  // --- Walter ---------------------------------------------------------------
  {
    id: 'walter_no_way_out',
    speaker: 'walter',
    trigger: { topic: 'no_way_out' },
    lines: [{ who: 'walter', text: 'The bridge is out and the lines are down. Nobody leaves tonight, I\'m afraid. The Meridian will look after you.' }],
    tells: [{ fact: 'noWayOut', value: true, confidence: 1 }],
    minutes: 0.6,
    priority: 10,
  },
  {
    id: 'walter_nightcap_delivered',
    speaker: 'walter',
    listener: 'voss',
    trigger: { topic: 'nightcap_delivered' },
    lines: [
      { who: 'walter', text: 'Your nightcap, Mr. Voss.' },
      { who: 'voss', text: 'Leave the door, Walter. I\'m expecting someone.' },
    ],
    effects: (w, speaker, listener) => {
      if (!listener) return;
      listener.flags.expectingJimmy = true;
      listener.flags['expecting:jimmy'] = true;
      setBelief(w, speaker.id, 'suite3DoorLeftUnlocked', true, 1, 'voss');
    },
    minutes: 0.6,
    priority: 10,
  },
  {
    id: 'walter_fallback',
    speaker: 'walter',
    trigger: { topic: '*' },
    lines: [{ who: 'walter', text: 'I couldn\'t say, sir. I only work nights.' }],
    priority: 0,
  },
  // --- Voss -----------------------------------------------------------------
  {
    id: 'voss_office_now',
    speaker: 'voss',
    listener: 'walter',
    trigger: { topic: 'office_now' },
    lines: [
      { who: 'voss', text: 'A word, Walter. Somewhere private.' },
      { who: 'walter', text: 'The office, Mr. Voss. After you.' },
    ],
    effects: (w, speaker, listener) => {
      if (!listener) return;
      setBelief(w, listener.id, 'vossWantsMeeting', true, 1, 'voss');
      listener.flags['expecting:voss'] = true;
    },
    minutes: 0.5,
    priority: 10,
  },
  {
    id: 'voss_summons',
    speaker: 'voss',
    listener: 'vivian',
    trigger: { topic: 'summons' },
    lines: [
      { who: 'voss', text: 'Suite 3. One o\'clock. Bring all of it.' },
      'She says nothing. Her glass does not quite reach her mouth.',
    ],
    effects: (w, speaker, listener) => {
      if (!listener) return;
      setBelief(w, listener.id, 'meetingAtOne', true, 1, 'voss');
      adjustMood(w, listener.id, 'fear', 1, 'Voss named the hour');
      speaker.flags['expecting:vivian'] = true;
    },
    minutes: 0.6,
    priority: 10,
  },
  {
    id: 'voss_order_photos',
    speaker: 'voss',
    listener: 'jimmy',
    trigger: { topic: 'order_photos' },
    lines: [
      { who: 'voss', text: 'The girl will go looking for her mother tonight. When she finds her, I want the two of them in one frame.' },
      { who: 'jimmy', text: 'And my end of it?' },
      { who: 'voss', text: 'After. Suite 3, ten to two. Bring the camera.' },
    ],
    effects: (w, speaker, listener) => {
      if (!listener) return;
      setBelief(w, listener.id, 'meetVossAtTenToTwo', true, 1, 'voss');
      setBelief(w, listener.id, 'photosOrdered', true, 1, 'voss');
      speaker.flags['expecting:jimmy'] = true;
    },
    minutes: 1,
    priority: 10,
  },
  {
    id: 'voss_settlement',
    speaker: 'voss',
    listener: 'vivian',
    trigger: { topic: 'settlement' },
    lines: [
      { who: 'voss', text: 'Sit down, Vivian. Thirteen years. Let\'s call it a round number.' },
      { who: 'vivian', text: 'It\'s all there. Every cent I have.' },
      { who: 'voss', text: 'Everything, I said. The house. The name. You sign it over and the letters burn.' },
      { who: 'vivian', text: 'You said this was the last time.' },
      { who: 'voss', text: 'Your daughter\'s downstairs, by the way. Room 6. Pretty girl. She has your eyes.' },
      'Her hands shake so badly the envelope falls. He picks it up.',
    ],
    effects: (w, speaker, listener) => {
      if (!listener) return;
      if (listener.inventory.includes('vivian_cash')) giveItem(w, listener.id, speaker.id, 'vivian_cash');
      adjustMood(w, listener.id, 'fear', 2, 'Voss wants everything, and he knows about Ruth');
      adjustMood(w, listener.id, 'anger', 2, 'Voss wants everything');
      setBelief(w, listener.id, 'daughterIsHere', true, 0.9, 'voss');
      setBelief(w, listener.id, 'vossWantsEverything', true, 1, 'voss');
      w.flags.settlementDone = w.tick;
    },
    minutes: 7,
    priority: 10,
  },
  {
    id: 'voss_pays_jimmy',
    speaker: 'voss',
    listener: 'jimmy',
    trigger: { topic: 'pay_jimmy' },
    lines: [
      { who: 'voss', text: 'The film first.' },
      { who: 'jimmy', text: 'The money first.' },
      { who: 'voss', text: 'Half now. The rest when I\'ve seen the prints.' },
    ],
    effects: (w, speaker, listener) => {
      if (!listener) return;
      if (listener.inventory.includes('camera')) giveItem(w, listener.id, speaker.id, 'camera');
      setBelief(w, listener.id, 'paidByVoss', 'half', 1, 'voss');
    },
    minutes: 1.5,
    priority: 10,
  },
  {
    id: 'voss_fallback',
    speaker: 'voss',
    trigger: { topic: '*' },
    lines: [{ who: 'voss', text: 'I\'m in sales. Everything\'s for sale, friend. Even the weather.' }],
    priority: 0,
  },
  // --- Ruth -----------------------------------------------------------------
  {
    id: 'ruth_asks_walter',
    speaker: 'ruth',
    listener: 'walter',
    trigger: { topic: 'mrs_marsh_room' },
    lines: [
      { who: 'ruth', text: 'Which room is Mrs. Marsh in? Please. It\'s important.' },
      { who: 'walter', text: 'I can\'t give out guests\' rooms, miss. House rule.' },
      'An earring slips from her ear and rolls under the desk. She does not notice.',
    ],
    effects: (w, speaker, listener) => {
      if (speaker.inventory.includes('ruth_earring')) {
        dropItem(w, speaker.id, 'ruth_earring', { kind: 'tile', floor: speaker.pos.floor, x: speaker.pos.x, y: speaker.pos.y + 1 });
      }
      setBelief(w, speaker.id, 'walterWontTell', true, 1, 'walter');
      if (listener) {
        setBelief(w, listener.id, 'ruthLooksForMarsh', true, 1, 'ruth');
        adjustMood(w, listener.id, 'suspicion', 1, 'a girl asking after Mrs. Marsh');
      }
    },
    minutes: 1,
    priority: 10,
  },
  {
    id: 'ruth_asks_vivian',
    speaker: 'ruth',
    listener: 'vivian',
    trigger: { topic: 'are_you_mrs_marsh' },
    lines: [
      { who: 'ruth', text: 'Mrs. Marsh? I\'m sorry, I... are you Vivian Lane?' },
      { who: 'vivian', text: 'You have the wrong room.' },
      'The chain stays on. The door closes.',
    ],
    effects: (w, speaker, listener) => {
      setBelief(w, speaker.id, 'mrsMarshDenied', true, 1, 'vivian');
      adjustMood(w, speaker.id, 'fear', 1, 'she shut the door on me');
      if (listener) {
        setBelief(w, listener.id, 'ruthIsLookingForMe', true, 1, 'ruth');
        adjustMood(w, listener.id, 'fear', 2, 'the girl knows my name');
      }
    },
    minutes: 1,
    priority: 10,
  },
  {
    id: 'ruth_argument',
    speaker: 'ruth',
    listener: 'jimmy',
    trigger: { topic: 'why_follow_me' },
    soundKind: 'argument',
    loudness: 3,
    lines: [
      { who: 'ruth', text: 'You followed me. You were on the stairs, Jimmy.' },
      { who: 'jimmy', text: 'I went out for cigarettes.' },
      { who: 'ruth', text: 'With your camera?' },
      { who: 'jimmy', text: 'Leave it, Ruth. Just leave it.' },
    ],
    effects: (w, speaker, listener) => {
      adjustMood(w, speaker.id, 'anger', 2, 'Jimmy lied to my face');
      adjustMood(w, speaker.id, 'suspicion', 2, 'Jimmy lied to my face');
      if (listener) {
        adjustMood(w, listener.id, 'anger', 2, 'Ruth will not drop it');
        adjustMood(w, listener.id, 'fear', 1, 'Ruth suspects');
        setBelief(w, listener.id, 'ruthSuspectsNothing', false, 0.9, 'ruth');
      }
    },
    minutes: 4,
    priority: 10,
  },
  {
    id: 'ruth_aspirin',
    speaker: 'ruth',
    listener: 'walter',
    trigger: { topic: 'aspirin' },
    lines: [
      { who: 'ruth', text: 'Do you have any aspirin? I can\'t sleep. I can\'t stop thinking.' },
      { who: 'walter', text: 'There\'s a bottle in the office. One moment, miss.' },
    ],
    effects: (w, speaker, listener) => {
      if (listener) setBelief(w, listener.id, 'ruthWantsAspirin', true, 1, 'ruth');
    },
    minutes: 0.6,
    priority: 10,
  },
  {
    id: 'ruth_jimmy_blood',
    speaker: 'ruth',
    listener: 'walter',
    trigger: { topic: 'jimmy_blood' },
    lines: [
      { who: 'ruth', text: 'Jimmy... he came down the stairs. There\'s blood on his cuff. Blood!' },
      { who: 'walter', text: 'Stay here, miss. Stay right here.' },
    ],
    tells: [
      { fact: 'troubleUpstairs', value: true, confidence: 1 },
      { fact: 'bloody:jimmy', value: true, confidence: 1 },
    ],
    effects: (w, speaker, listener) => {
      if (listener) adjustMood(w, listener.id, 'fear', 2, 'blood on a guest');
    },
    minutes: 2,
    priority: 10,
  },
  {
    id: 'ruth_fallback',
    speaker: 'ruth',
    trigger: { topic: '*' },
    lines: [{ who: 'ruth', text: 'I\'m sorry, I don\'t... I\'m just here with my boyfriend.' }],
    priority: 0,
  },
  // --- Jimmy ----------------------------------------------------------------
  {
    id: 'jimmy_pay_me',
    speaker: 'jimmy',
    listener: 'voss',
    trigger: { topic: 'pay_me' },
    lines: [
      { who: 'jimmy', text: 'I\'ve got your pictures. Where\'s my money?' },
    ],
    minutes: 0.4,
    priority: 10,
  },
  {
    id: 'jimmy_fallback',
    speaker: 'jimmy',
    trigger: { topic: '*' },
    lines: [{ who: 'jimmy', text: 'Hell of a night, huh? You want a cigarette?' }],
    priority: 0,
  },
  // --- Vivian ---------------------------------------------------------------
  {
    id: 'vivian_fallback',
    speaker: 'vivian',
    trigger: { topic: '*' },
    lines: [{ who: 'vivian', text: 'I\'m afraid I don\'t know anyone here. I\'m only passing through.' }],
    priority: 0,
  },
  // --- Hale -----------------------------------------------------------------
  {
    id: 'hale_fallback',
    speaker: 'hale',
    trigger: { topic: '*' },
    lines: [{ who: 'hale', text: 'I keep to myself. I\'d advise the same.' }],
    priority: 0,
  },
];
