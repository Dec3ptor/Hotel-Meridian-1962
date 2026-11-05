import { gesture, soundAtAgent } from '../../sim/actions';
import { adjustMood } from '../../sim/agents/mood';
import { setBelief } from '../../sim/agents/beliefs';
import { after, othersIn } from '../../sim/query';
import { storyletRan } from '../../sim/storylets';
import type { CharacterDef } from '../../sim/types';
import { answerDoorGoal, answerDoorPlans, confrontFollowerGoal, confrontFollowerPlans, confrontIntruderGoal, idlePlan, pillsAvailable, trayConsumed, trayInKitchen } from './common';

/**
 * Vivian Lane, 47, registered as "Mrs. V. Marsh". She was driving in 1949.
 * She wants her letters back, wants nobody to know her, and wants, once, to
 * see the daughter she gave up.
 */
export const vivian: CharacterDef = {
  id: 'vivian',
  name: 'Vivian Lane',
  shortName: 'Vivian',
  age: 47,
  blurb: 'A faded film actress travelling under a false name, thirteen years into paying for one night.',
  startRoom: 'suite1',
  startSpot: 'default',
  homeRoom: 'suite1',
  homeSpot: 'default',
  speed: 1,
  mood: { fear: 3, anger: 1, suspicion: 3, drunk: 0, resolve: 4 },
  beliefs: {
    driverOf1949: { value: 'vivian', confidence: 1 },
    iAmVivianLane: { value: true, confidence: 1 },
    lettersInSuite3: { value: true, confidence: 0.8 },
    daughterExists: { value: true, confidence: 1 },
    vossBlackmailsMe: { value: true, confidence: 1 },
    walterRemembersMe: { value: true, confidence: 0.7 },
    vossTakesANightcap: { value: true, confidence: 0.9 },
  },
  secrets: ['driverOf1949', 'iAmVivianLane', 'lettersInSuite3', 'daughterExists', 'vossBlackmailsMe', 'daughterIsHere'],
  relationships: {
    voss: { trust: 1, knowsSecret: true },
    walter: { trust: 6, knowsSecret: true },
    hale: { trust: 3, knowsSecret: false },
    jimmy: { trust: 2, knowsSecret: false },
    ruth: { trust: 3, knowsSecret: false },
    player: { trust: 3, knowsSecret: false },
  },
  inventory: ['vivian_cash', 'baby_photo', 'suite1_key'],
  chattiness: 0.03,
  goals: [
    {
      id: 'panic',
      name: 'lock the door and hide',
      priority: (w, a) => (a.mood.fear >= 8 && !storyletRan(w, 'voss_settlement') ? 90 : 0),
      persistent: true,
    },
    answerDoorGoal('suite1', 'suite1_door'),
    confrontIntruderGoal('suite1'),
    confrontFollowerGoal(),
    {
      id: 'attend_settlement',
      name: 'go to Suite 3 with the money',
      priority: 70,
      notBefore: '12:58',
    },
    {
      id: 'dose_voss',
      name: "dose Voss's nightcap",
      priority: 65,
      notBefore: '1:05',
      active: (w) => storyletRan(w, 'voss_settlement'),
      done: (w) => trayConsumed(w),
    },
    {
      id: 'steady_nerves',
      name: 'a drink downstairs',
      priority: 40,
      notBefore: '10:28',
      deadline: '11:29',
    },
    {
      id: 'retire',
      name: 'keep to the suite',
      priority: 35,
      notBefore: '11:29',
      deadline: '12:55',
      persistent: true,
    },
    { id: 'idle', name: 'wait in Suite 1', priority: 1, persistent: true },
  ],
  plans: {
    panic: [
      {
        id: 'LockHerselfIn',
        steps: [
          { do: 'goTo', args: { room: 'suite1', spot: 'door_inside' }, label: 'back to the suite' },
          { do: 'lock', args: { door: 'suite1_door' }, label: 'lock the door' },
          { do: 'goTo', args: { room: 'suite1', spot: 'window' }, label: 'to the window' },
          { do: 'wait', minutes: 20, label: 'shake' },
        ],
      },
    ],
    answer_door: answerDoorPlans('suite1', 'suite1_door'),
    confront_intruder: [
      {
        id: 'GetOutOrIScream',
        steps: [
          { do: 'talk', args: { to: 'player', topic: 'get_out', near: 2, interrupt: true }, label: 'tell them to get out' },
          { do: 'wait', until: (w, a) => a.beliefs['whereIs:player']?.value !== 'suite1', minutes: 2, label: 'see them out' },
          { do: 'use', args: { target: 'suite1_door', action: 'lock' }, skipIf: (w, a) => a.beliefs['whereIs:player']?.value === 'suite1', label: 'lock the door' },
        ],
      },
    ],
    confront_follower: confrontFollowerPlans(),
    attend_settlement: [
      {
        id: 'BringTheMoney',
        steps: [
          { do: 'take', args: { item: 'vivian_cash' }, skipIf: (w, a) => a.inventory.includes('vivian_cash'), label: 'take the cash' },
          { do: 'goTo', args: { room: 'corridor', spot: 'outside_suite3' }, label: 'along to Suite 3' },
          { do: 'use', args: { target: 'suite3_door', action: 'knock' }, skipIf: (w) => !w.doors.suite3_door!.locked, label: 'knock' },
          { do: 'wait', until: (w) => !w.doors.suite3_door!.locked, deadline: '1:06', label: 'wait to be let in' },
          { do: 'goTo', args: { room: 'suite3', spot: 'guest' }, label: 'go in' },
          { do: 'wait', until: (w) => storyletRan(w, 'voss_settlement'), deadline: '1:12', label: 'face him' },
          { do: 'goTo', args: { room: 'corridor', spot: 'outside_suite3' }, label: 'get out' },
          { do: 'gesture', args: { kind: 'shaking' }, label: 'shaking' },
        ],
      },
    ],
    dose_voss: [
      {
        id: 'DoseNightcap',
        steps: [
          {
            do: 'take',
            args: { item: 'sleeping_pills' },
            skipIf: (w, a) => a.inventory.includes('sleeping_pills'),
            if: pillsAvailable,
            ifReason: 'the sleeping pills are gone',
            label: 'fetch the pills',
          },
          {
            do: 'goTo',
            args: { room: 'kitchen', spot: 'counter', avoid: ['lobby', 'bar'] },
            if: trayInKitchen,
            ifReason: 'tray not in kitchen',
            label: 'down the back stair to the kitchen',
          },
          {
            do: 'wait',
            until: (w, a) => othersIn(w, 'kitchen', a.id) === 0,
            if: trayInKitchen,
            ifReason: 'tray not in kitchen',
            deadline: '1:18',
            label: 'wait for the kitchen to empty',
          },
          { do: 'use', args: { target: 'nightcap_tray', action: 'dose', item: 'sleeping_pills' }, label: 'crush the pills into the brandy' },
          { do: 'goTo', args: { room: 'suite1', spot: 'door_inside', avoid: ['lobby', 'bar'] }, label: 'back up the back stair' },
          { do: 'lock', args: { door: 'suite1_door' }, label: 'lock the door' },
        ],
        onFail: (w, a) => adjustMood(w, a.id, 'fear', 2, 'the plan for the nightcap fell through'),
      },
      {
        id: 'DrinkItOff',
        steps: [
          { do: 'goTo', args: { room: 'bar', spot: 'vivian_stool' }, label: 'down to the bar' },
          { do: 'use', args: { target: 'bar_counter', action: 'drink' }, label: 'a gin' },
          { do: 'use', args: { target: 'bar_counter', action: 'drink' }, label: 'another' },
          { do: 'use', args: { target: 'bar_counter', action: 'drink' }, label: 'and another' },
          { do: 'wait', minutes: 20, label: 'sit with it' },
        ],
      },
    ],
    steady_nerves: [
      {
        id: 'GinAtTheBar',
        steps: [
          { do: 'goTo', args: { room: 'bar', spot: 'vivian_stool' }, label: 'down to the bar' },
          { do: 'use', args: { target: 'bar_counter', action: 'drink' }, label: 'a gin' },
          { do: 'wait', until: (w) => after(w, '11:29'), label: 'sit at the bar' },
        ],
      },
    ],
    retire: [
      {
        id: 'KeepToTheSuite',
        steps: [
          { do: 'goTo', args: { room: 'suite1', spot: 'door_inside' }, label: 'up to Suite 1' },
          { do: 'lock', args: { door: 'suite1_door' }, label: 'lock the door' },
          { do: 'goTo', args: { room: 'suite1', spot: 'window' }, label: 'to the window' },
          { do: 'wait', until: (w) => after(w, '12:55'), label: 'wait' },
        ],
      },
    ],
    idle: [{ id: 'WaitInSuite1', steps: idlePlan('suite1', 'default') }],
  },
  reactions: [
    {
      id: 'vivian_hears_bulletin',
      on: 'heard',
      when: (w, a, p) => p.kind === 'heard' && p.sound === 'radio' && (p.text ?? '').includes('1949'),
      do: (w, a, p, ctx) => {
        adjustMood(w, a.id, 'fear', 2, 'the 1949 case reopened on the radio');
        gesture(w, a.id, 'drops_glass');
        soundAtAgent(w, 'glass_breaks', a.id, 2, 'a glass shatters');
        setBelief(w, a.id, 'caseReopened', true, 1, 'radio');
        ctx.decide('they are reopening it');
      },
      once: true,
    },
    {
      id: 'vivian_sees_daughter',
      on: 'saw_agent',
      when: (w, a, p) => p.kind === 'saw_agent' && p.who === 'ruth' && a.beliefs.daughterIsHere?.value === true,
      do: (w, a, p, ctx) => {
        adjustMood(w, a.id, 'fear', 1, 'the girl from Room 6');
        ctx.decide('that must be her');
      },
      cooldownMinutes: 15,
    },
  ],
};
