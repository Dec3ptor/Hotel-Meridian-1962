import { soundAtAgent } from '../../sim/actions';
import { adjustMood } from '../../sim/agents/mood';
import { setBelief } from '../../sim/agents/beliefs';
import { after, alive, before, believes, dist, inRoom } from '../../sim/query';
import { storyletRan } from '../../sim/storylets';
import type { CharacterDef } from '../../sim/types';
import { confrontFollowerGoal, confrontFollowerPlans, idlePlan, seenSince } from './common';

/**
 * Ruth Carter, 24. Adopted; found a birth certificate naming Vivian Lane.
 * Jimmy brought her here "for a getaway". She wants to meet her mother.
 */
export const ruth: CharacterDef = {
  id: 'ruth',
  name: 'Ruth Carter',
  shortName: 'Ruth',
  age: 24,
  blurb: 'A nervous young woman with a birth certificate in her handbag and a boyfriend who lies.',
  startRoom: 'room6',
  startSpot: 'bed',
  homeRoom: 'room6',
  homeSpot: 'bed',
  speed: 1,
  mood: { fear: 3, anger: 1, suspicion: 2, drunk: 0, resolve: 3 },
  beliefs: {
    motherIsVivianLane: { value: true, confidence: 0.9 },
    vivianIsMrsMarsh: { value: true, confidence: 0.7 },
    iAmAdopted: { value: true, confidence: 1 },
    jimmyLovesMe: { value: true, confidence: 0.7 },
    romanticGetaway: { value: true, confidence: 0.6 },
  },
  secrets: ['motherIsVivianLane', 'vivianIsMrsMarsh', 'iAmAdopted'],
  relationships: {
    jimmy: { trust: 7, knowsSecret: false },
    vivian: { trust: 5, knowsSecret: false },
    walter: { trust: 4, knowsSecret: false },
    voss: { trust: 2, knowsSecret: false },
    hale: { trust: 3, knowsSecret: false },
    player: { trust: 4, knowsSecret: false },
  },
  inventory: ['ruth_earring'],
  chattiness: 0.1,
  goals: [
    {
      id: 'raise_alarm',
      name: 'tell someone about the blood',
      priority: 90,
      urgent: true,
      active: (w, a) => believes(w, a.id, 'bloody:jimmy', true, 0.5) && !storyletRan(w, 'ruth_jimmy_blood'),
    },
    {
      id: 'confront_jimmy_voss',
      name: 'ask Jimmy if he works for Voss',
      priority: 62,
      active: (w, a) => believes(w, a.id, 'jimmyWorksForVoss', true, 0.5) && alive(w, 'jimmy'),
      done: (w) => storyletRan(w, 'ruth_confronts_jimmy_voss'),
    },
    confrontFollowerGoal(),
    {
      id: 'confront_jimmy',
      name: 'have it out with Jimmy',
      priority: 60,
      notBefore: '12:29',
      active: (w, a) => believes(w, a.id, 'jimmyFollowedMe', true, 0.5) && inRoom(w, 'jimmy', 'room6'),
      done: (w) => storyletRan(w, 'ruth_argument'),
    },
    {
      id: 'find_jimmy',
      name: 'find out where Jimmy went',
      priority: 58,
      notBefore: '1:48',
      active: (w, a) => a.beliefs['whereIs:jimmy']?.value !== 'room6',
    },
    {
      id: 'get_aspirin',
      name: 'get aspirin from the desk',
      priority: 55,
      notBefore: '1:03',
      done: (w, a) => a.inventory.includes('aspirin') && a.room === 'room6',
    },
    {
      id: 'find_mother',
      name: 'find Mrs. Marsh',
      priority: 50,
      notBefore: '10:42',
      persistent: true,
      retryAfter: 5,
      active: (w, a) =>
        !believes(w, a.id, 'walterWontTell', true, 0.5) ||
        (after(w, '11:55') && !a.flags.knockedOnSuite1) ||
        (believes(w, a.id, 'vivianIsInSuite1', true, 0.5) && believes(w, a.id, 'vivianIsMrsMarsh', true, 0.5) && !storyletRan(w, 'ruth_meets_vivian') && !a.flags.triedSuite1Again),
    },
    { id: 'idle', name: 'wait in Room 6', priority: 1, persistent: true },
  ],
  plans: {
    confront_jimmy_voss: [
      {
        id: 'AskHimStraight',
        steps: [
          { do: 'goTo', args: { room: 'room6', spot: 'default' }, skipIf: (w, a) => a.beliefs['whereIs:jimmy']?.value !== 'room6', label: 'back to Room 6' },
          { do: 'talk', args: { to: 'jimmy', topic: 'do_you_work_for_voss', near: 2, interrupt: true }, deadline: undefined, label: 'ask him straight' },
        ],
      },
    ],
    confront_follower: confrontFollowerPlans(),
    raise_alarm: [
      {
        id: 'TellWalter',
        steps: [{ do: 'talk', args: { to: 'walter', topic: 'jimmy_blood', near: 2, interrupt: true }, deadline: '2:00', label: 'tell Walter' }],
      },
    ],
    confront_jimmy: [
      {
        id: 'HaveItOut',
        steps: [
          { do: 'goTo', args: { room: 'room6', spot: 'default' }, label: 'face him' },
          { do: 'talk', args: { to: 'jimmy', topic: 'why_follow_me', near: 2 }, label: 'the argument' },
        ],
      },
    ],
    find_jimmy: [
      {
        id: 'LookInTheLobby',
        steps: [
          { do: 'goTo', args: { room: 'lobby', spot: 'default' }, label: 'to the lobby' },
          {
            do: 'wait',
            until: (w, a, started) => seenSince(a, 'jimmy', started + 25) && a.beliefs['whereIs:jimmy']?.value === 'lobby',
            deadline: '2:00',
            label: 'wait in the lobby for Jimmy to come back down',
          },
        ],
      },
    ],
    get_aspirin: [
      {
        id: 'RingForAspirin',
        steps: [
          { do: 'goTo', args: { room: 'lobby', spot: 'desk_front' }, label: 'to the desk' },
          { do: 'use', args: { target: 'service_bell', action: 'ring' }, label: 'ring the bell' },
          { do: 'wait', until: (w, a) => inRoom(w, 'walter', 'lobby') && dist(w, a.id, 'walter') <= 2, deadline: '1:14', label: 'wait for Walter' },
          { do: 'talk', args: { to: 'walter', topic: 'aspirin', near: 2 }, label: 'ask for aspirin' },
          { do: 'wait', until: (w, a) => a.inventory.includes('aspirin'), deadline: '1:24', label: 'wait for the aspirin' },
          { do: 'goTo', args: { room: 'room6', spot: 'default' }, label: 'back to Room 6' },
        ],
      },
    ],
    find_mother: [
      {
        id: 'AskTheClerk',
        if: (w, a) => !believes(w, a.id, 'walterWontTell', true, 0.5) && before(w, '11:30'),
        ifReason: 'the clerk has already refused',
        steps: [
          { do: 'goTo', args: { room: 'lobby', spot: 'desk_front' }, label: 'to the front desk' },
          { do: 'talk', args: { to: 'walter', topic: 'mrs_marsh_room', near: 2 }, deadline: '11:00', label: 'ask which room' },
          { do: 'goTo', args: { room: 'room6', spot: 'default' }, label: 'back to Room 6' },
        ],
      },
      {
        id: 'GoToHerAsHerDaughter',
        if: (w, a) => believes(w, a.id, 'vivianIsInSuite1', true, 0.5) && believes(w, a.id, 'vivianIsMrsMarsh', true, 0.5) && !a.flags.triedSuite1Again && a.flags.knockedOnSuite1 === true,
        ifReason: 'no reason to try Suite 1 again',
        steps: [
          { do: 'goTo', args: { room: 'corridor', spot: 'outside_suite1' }, label: 'up to Suite 1' },
          { do: 'use', args: { target: 'suite1_door', action: 'knock' }, label: 'knock' },
          { do: 'wait', until: (w, a) => dist(w, a.id, 'vivian') <= 2, minutes: 4, label: 'wait for an answer' },
          { do: 'talk', args: { to: 'vivian', topic: 'i_am_your_daughter', near: 2, interrupt: true }, if: (w, a) => dist(w, a.id, 'vivian') <= 2, ifReason: 'she did not open the door', label: 'tell her who I am' },
          { do: 'goTo', args: { room: 'room6', spot: 'default' }, label: 'back to Room 6' },
        ],
        onComplete: (w, a) => {
          a.flags.triedSuite1Again = true;
        },
        onFail: (w, a) => {
          a.flags.triedSuite1Again = true;
        },
      },
      {
        id: 'KnockOnSuite1',
        if: (w, a) => after(w, '11:55') && !a.flags.knockedOnSuite1,
        ifReason: 'not yet',
        steps: [
          { do: 'goTo', args: { room: 'corridor', spot: 'outside_suite1' }, label: 'up to Suite 1' },
          { do: 'use', args: { target: 'suite1_door', action: 'knock' }, label: 'knock' },
          { do: 'wait', until: (w, a) => dist(w, a.id, 'vivian') <= 2, deadline: '12:08', label: 'wait for an answer' },
          { do: 'talk', args: { to: 'vivian', topic: 'are_you_mrs_marsh', near: 2 }, label: 'ask her' },
          { do: 'goTo', args: { room: 'room6', spot: 'default' }, label: 'back to Room 6' },
        ],
        onComplete: (w, a) => {
          a.flags.knockedOnSuite1 = true;
        },
        onFail: (w, a) => {
          a.flags.knockedOnSuite1 = true;
        },
      },
    ],
    idle: [{ id: 'WaitInRoom6', steps: idlePlan('room6', 'bed') }],
  },
  reactions: [
    {
      id: 'ruth_sees_jimmy_following',
      on: 'saw_agent',
      when: (w, a, p) => p.kind === 'saw_agent' && p.who === 'jimmy' && a.room === 'corridor' && before(w, '12:30'),
      do: (w, a, p, ctx) => {
        setBelief(w, a.id, 'jimmyFollowedMe', true, 1, 'seen');
        adjustMood(w, a.id, 'anger', 2, 'Jimmy followed me upstairs');
        adjustMood(w, a.id, 'suspicion', 2, 'Jimmy followed me upstairs');
        ctx.decide('Jimmy is on the stairs. He followed me.');
      },
      once: true,
    },
    {
      id: 'ruth_screams_at_blood',
      on: 'saw_agent',
      when: (w, a, p) => p.kind === 'saw_agent' && p.who === 'jimmy' && p.blood,
      do: (w, a, p, ctx) => {
        soundAtAgent(w, 'scream', a.id, 5, 'Ruth screams');
        adjustMood(w, a.id, 'fear', 3, 'blood on Jimmy\'s cuff');
        ctx.decide('there is blood on his cuff');
      },
      cooldownMinutes: 10,
    },
  ],
};
