import { after, believes, dist, inRoom, has } from '../../sim/query';
import { storyletRan } from '../../sim/storylets';
import type { CharacterDef, CharacterId } from '../../sim/types';
import { setBelief } from '../../sim/agents/beliefs';
import { adjustMood } from '../../sim/agents/mood';
import { bellRecently, confrontFollowerGoal, confrontFollowerPlans, confrontIntruderGoal, confrontIntruderPlans, idlePlan, looseItemOnFloor } from './common';

const GUESTS: CharacterId[] = ['ruth', 'jimmy', 'vivian', 'hale', 'voss', 'player'];

/**
 * Walter Pike, 71, night clerk since 1931. Keeps the hotel calm, keeps
 * Voss's money coming, and is quietly fond of Vivian from 1949.
 */
export const walter: CharacterDef = {
  id: 'walter',
  name: 'Walter Pike',
  shortName: 'Walter',
  age: 71,
  blurb: 'Night clerk since 1931. Knows where everything is kept, including the past.',
  startRoom: 'lobby',
  startSpot: 'desk_back',
  homeRoom: 'lobby',
  homeSpot: 'desk_back',
  speed: 1,
  mood: { fear: 1, anger: 0, suspicion: 2, drunk: 0, resolve: 5 },
  beliefs: {
    vivianIsMrsMarsh: { value: true, confidence: 1 },
    driverOf1949: { value: 'vivian', confidence: 1 },
    vossBlackmailsVivian: { value: true, confidence: 0.9 },
    hidVivianCar1949: { value: true, confidence: 1 },
    safeCombination: { value: true, confidence: 1 },
    vossPaysMe: { value: true, confidence: 1 },
  },
  secrets: ['vivianIsMrsMarsh', 'driverOf1949', 'vossBlackmailsVivian', 'hidVivianCar1949', 'safeCombination', 'vossPaysMe'],
  relationships: {
    voss: { trust: 6, knowsSecret: true },
    vivian: { trust: 7, knowsSecret: true },
    hale: { trust: 3, knowsSecret: false },
    jimmy: { trust: 3, knowsSecret: false },
    ruth: { trust: 4, knowsSecret: false },
    player: { trust: 3, knowsSecret: false },
  },
  inventory: ['master_key', 'office_key'],
  staff: true,
  chattiness: 0.05,
  goals: [
    {
      id: 'investigate_upstairs',
      name: 'see what is wrong upstairs',
      priority: 85,
      active: (w, a) => believes(w, a.id, 'troubleUpstairs', true, 0.5),
    },
    {
      id: 'answer_bell',
      name: 'answer the desk bell',
      priority: 75,
      persistent: true,
      active: (w, a) => bellRecently(w, a),
    },
    {
      id: 'fetch_aspirin',
      name: 'fetch aspirin for Ruth',
      priority: 72,
      active: (w, a) => believes(w, a.id, 'ruthWantsAspirin', true, 0.5) && !has(w, 'ruth', 'aspirin'),
      done: (w) => has(w, 'ruth', 'aspirin'),
    },
    {
      id: 'announce_phones_dead',
      name: 'tell the guests nobody can leave',
      priority: 70,
      active: (w, a) => believes(w, a.id, 'phonesDead', true, 0.5),
    },
    {
      id: 'attend_voss',
      name: 'attend Mr. Voss in the office',
      priority: 60,
      active: (w, a) => believes(w, a.id, 'vossWantsMeeting', true, 0.5),
    },
    {
      id: 'serve_nightcap',
      name: "take Mr. Voss's nightcap up",
      priority: 60,
      notBefore: '1:03',
    },
    {
      id: 'tidy_lost_property',
      name: 'tidy lost property',
      priority: 55,
      persistent: true,
      active: (w, a) => a.room === 'lobby' && looseItemOnFloor(w, 'lobby') !== undefined,
    },
    {
      id: 'night_rounds',
      name: 'look in on Suite 3',
      priority: 50,
      notBefore: '1:56',
    },
    confrontIntruderGoal('office'),
    confrontFollowerGoal(),
    { id: 'idle', name: 'mind the desk', priority: 1, persistent: true },
  ],
  plans: {
    investigate_upstairs: [
      {
        id: 'GoToSuite3',
        steps: [
          { do: 'wait', minutes: 1.5, label: 'fetch the master key and steady himself' },
          { do: 'goTo', args: { room: 'suite3', spot: 'door_inside' }, label: 'hurry to Suite 3' },
          { do: 'wait', minutes: 1, label: 'take it in' },
        ],
      },
    ],
    answer_bell: [
      {
        id: 'ComeToDesk',
        steps: [
          { do: 'goTo', args: { room: 'lobby', spot: 'desk_back' }, label: 'come to the desk' },
          {
            do: 'wait',
            label: 'see who rang',
            until: (w, a) => GUESTS.some((id) => inRoom(w, id, 'lobby') && dist(w, a.id, id) <= 2),
            minutes: 3,
          },
          { do: 'wait', minutes: 0.5, label: 'listen to the guest' },
        ],
        onComplete: (w, a) => {
          a.flags.lastBellAnswered = Number(a.beliefs['bell:desk']?.value ?? w.tick);
        },
        onFail: (w, a) => {
          a.flags.lastBellAnswered = Number(a.beliefs['bell:desk']?.value ?? w.tick);
        },
      },
    ],
    fetch_aspirin: [
      {
        id: 'AspirinFromOffice',
        steps: [
          { do: 'search', args: { target: 'office_desk', item: 'aspirin', minutes: 2.5 }, skipIf: (w, a) => a.inventory.includes('aspirin'), label: 'find the aspirin' },
          { do: 'goTo', args: { room: 'lobby', spot: 'desk_back' }, label: 'back to the desk' },
          { do: 'give', args: { to: 'ruth', item: 'aspirin' }, deadline: '1:22', label: 'hand over the aspirin' },
        ],
      },
    ],
    announce_phones_dead: [
      {
        id: 'TellTheHouse',
        steps: [
          { do: 'talk', args: { to: 'all', topic: 'no_way_out' }, label: 'tell the lobby' },
          { do: 'goTo', args: { room: 'bar', spot: 'default' }, label: 'go through to the bar' },
          { do: 'talk', args: { to: 'all', topic: 'no_way_out' }, label: 'tell the bar' },
          { do: 'goTo', args: { room: 'lobby', spot: 'desk_back' }, label: 'back to the desk' },
        ],
      },
    ],
    attend_voss: [
      {
        id: 'MeetVossInOffice',
        steps: [
          { do: 'goTo', args: { room: 'office', spot: 'walter' }, label: 'into the office' },
          { do: 'wait', until: (w, a) => a.inventory.includes('voss_cash'), deadline: '10:26', label: 'wait on Mr. Voss' },
          { do: 'use', args: { target: 'walters_coat', action: 'put', item: 'voss_cash' }, label: 'pocket the cash' },
          { do: 'goTo', args: { room: 'lobby', spot: 'desk_back' }, label: 'back to the desk' },
        ],
      },
    ],
    serve_nightcap: [
      {
        id: 'NightcapFromKitchen',
        steps: [
          { do: 'goTo', args: { room: 'kitchen', spot: 'counter' }, label: 'to the kitchen' },
          { do: 'use', args: { target: 'nightcap_tray', action: 'prepare' }, skipIf: (w) => w.items.nightcap_tray?.state.prepared === true, label: 'make up the tray' },
          { do: 'take', args: { item: 'nightcap_tray' }, label: 'pick up the tray' },
          { do: 'goTo', args: { room: 'corridor', spot: 'outside_suite3' }, notBefore: '1:18', label: 'up to Suite 3' },
          { do: 'use', args: { target: 'suite3_door', action: 'knock' }, skipIf: (w) => !w.doors.suite3_door!.locked, label: 'knock' },
          { do: 'wait', until: (w) => !w.doors.suite3_door!.locked, deadline: '1:35', label: 'wait to be let in' },
          { do: 'goTo', args: { room: 'suite3', spot: 'door_inside' }, label: 'step inside' },
          { do: 'give', args: { to: 'voss', item: 'nightcap_tray' }, label: 'hand over the tray' },
          { do: 'talk', args: { to: 'voss', topic: 'nightcap_delivered' }, label: 'a word with Mr. Voss' },
          { do: 'goTo', args: { room: 'lobby', spot: 'desk_back' }, label: 'back to the desk' },
        ],
      },
    ],
    tidy_lost_property: [
      {
        id: 'PutInLostAndFound',
        steps: [
          { do: 'take', args: { item: (w) => looseItemOnFloor(w, 'lobby') }, label: 'pick it up' },
          { do: 'drop', args: { item: (w, a) => a.inventory.find((i) => i === 'ruth_earring') ?? a.inventory[a.inventory.length - 1], into: 'lost_and_found' }, label: 'into lost and found' },
          { do: 'goTo', args: { room: 'lobby', spot: 'desk_back' }, label: 'back to the desk' },
        ],
      },
    ],
    night_rounds: [
      {
        id: 'LookInOnSuite3',
        steps: [
          { do: 'goTo', args: { room: 'corridor', spot: 'outside_suite3' }, label: 'up to Suite 3' },
          { do: 'use', args: { target: 'suite3_door', action: 'knock' }, label: 'knock' },
          { do: 'wait', minutes: 0.5, label: 'wait' },
          { do: 'goTo', args: { room: 'suite3', spot: 'door_inside' }, label: 'look in' },
          { do: 'wait', minutes: 3, label: 'stand there' },
        ],
      },
    ],
    confront_intruder: confrontIntruderPlans(),
    confront_follower: confrontFollowerPlans(),
    idle: [{ id: 'MindTheDesk', steps: idlePlan('lobby', 'desk_back') }],
  },
  reactions: [
    {
      id: 'walter_suspects_player',
      on: ['saw_body', 'saw_agent'],
      when: (w, a, p) => {
        if (p.kind === 'saw_body') return p.who === 'voss' && a.beliefs['whereIs:player']?.value === 'suite3' && w.tick - (a.beliefs['whereIs:player']?.tick ?? -999) <= 25;
        return p.kind === 'saw_agent' && p.who === 'player' && (p.weapon === 'kitchen_knife' || (p.blood && after(w, '1:30')));
      },
      do: (w, a, p, ctx) => {
        setBelief(w, a.id, 'playerSuspect', true, 0.9, 'seen');
        adjustMood(w, a.id, 'suspicion', 3, 'the guest from Room 7, at a time like this');
        ctx.decide('the guest from Room 7 is in this up to the neck');
      },
      once: true,
    },
    {
      id: 'walter_hears_scream',
      on: 'heard',
      when: (w, a, p) => p.kind === 'heard' && p.sound === 'scream' && after(w, '1:30') && !storyletRan(w, 'ruth_jimmy_blood'),
      do: (w, a, p, ctx) => {
        ctx.decide('a scream after half past one; something has gone wrong');
      },
      cooldownMinutes: 5,
    },
  ],
};
