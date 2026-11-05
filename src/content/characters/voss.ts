import { gesture } from '../../sim/actions';
import { after, dist, inRoom } from '../../sim/query';
import { storyletRan } from '../../sim/storylets';
import type { CharacterDef } from '../../sim/types';
import { confrontFollowerGoal, confrontFollowerPlans, confrontIntruderGoal, idlePlan, knockedRecently, trayConsumed } from './common';

/**
 * Leonard Voss, 54, a fixer who calls himself a salesman. Tonight is the
 * final settlement with Vivian; Jimmy's photographs are the insurance.
 */
export const voss: CharacterDef = {
  id: 'voss',
  name: 'Leonard Voss',
  shortName: 'Voss',
  age: 54,
  blurb: 'A smooth "salesman" with a Cadillac, a ledger, and a small pistol.',
  startRoom: 'bar',
  startSpot: 'voss_stool',
  homeRoom: 'suite3',
  homeSpot: 'sitting',
  speed: 1,
  mood: { fear: 0, anger: 1, suspicion: 3, drunk: 1, resolve: 8 },
  beliefs: {
    driverOf1949: { value: 'vivian', confidence: 1 },
    vivianIsMrsMarsh: { value: true, confidence: 1 },
    ruthIsVivianDaughter: { value: true, confidence: 1 },
    jimmyWorksForMe: { value: true, confidence: 1 },
    walterLoyal: { value: true, confidence: 0.9 },
    safeCombination: { value: true, confidence: 1 },
    nobodyCanTouchMe: { value: true, confidence: 0.9 },
  },
  secrets: ['driverOf1949', 'vivianIsMrsMarsh', 'ruthIsVivianDaughter', 'jimmyWorksForMe', 'walterLoyal', 'safeCombination'],
  relationships: {
    walter: { trust: 6, knowsSecret: true },
    vivian: { trust: 2, knowsSecret: true },
    hale: { trust: 2, knowsSecret: false },
    jimmy: { trust: 5, knowsSecret: true },
    ruth: { trust: 2, knowsSecret: true },
    player: { trust: 2, knowsSecret: false },
  },
  inventory: ['voss_envelope', 'voss_cash', 'voss_pistol', 'undeveloped_film', 'suite3_key', 'cadillac_keys'],
  flags: { 'expecting:walter': true },
  chattiness: 0.02,
  goals: [
    {
      id: 'answer_door',
      name: 'answer the door',
      priority: 85,
      persistent: true,
      active: (w, a) => a.room === 'suite3' && knockedRecently(w, a, 'suite3_door'),
    },
    {
      id: 'collect_payment',
      name: 'collect the final payment',
      priority: 70,
      notBefore: '12:50',
      active: (w) => inRoom(w, 'vivian', 'suite3') && !storyletRan(w, 'voss_settlement'),
      done: (w) => storyletRan(w, 'voss_settlement'),
    },
    {
      id: 'nightcap',
      name: 'enjoy the nightcap',
      priority: 65,
      active: (w, a) => a.inventory.includes('nightcap_tray') && !trayConsumed(w),
      done: (w) => trayConsumed(w),
    },
    {
      id: 'stash_envelope',
      name: 'put the envelope in the hotel safe',
      priority: 60,
      notBefore: '10:12',
    },
    {
      id: 'write_telegram',
      name: 'write the telegram',
      priority: 58,
      notBefore: '11:42',
    },
    {
      id: 'order_photos',
      name: 'order the photographs',
      priority: 55,
      notBefore: '10:56',
    },
    {
      id: 'summon_vivian',
      name: 'tell Vivian when and where',
      priority: 50,
      done: (w) => storyletRan(w, 'voss_summons'),
    },
    {
      id: 'await_jimmy',
      name: 'wait for Jimmy and the photographs',
      priority: 40,
      notBefore: '1:08',
      active: (w) => storyletRan(w, 'voss_settlement') || after(w, '1:15'),
      done: (w) => storyletRan(w, 'voss_pays_jimmy'),
    },
    confrontIntruderGoal('suite3'),
    confrontFollowerGoal(),
    {
      id: 'drink_at_bar',
      name: 'drink at the bar',
      priority: 10,
      deadline: '11:42',
      persistent: true,
    },
    {
      id: 'wait_in_suite',
      name: 'wait in Suite 3',
      priority: 1,
      persistent: true,
    },
  ],
  plans: {
    answer_door: [
      {
        id: 'OpenUp',
        steps: [
          { do: 'goTo', args: { room: 'suite3', spot: 'door_inside' }, label: 'go to the door' },
          { do: 'unlock', args: { door: 'suite3_door' }, label: 'unlock it' },
          { do: 'wait', minutes: 0.3, label: 'see who it is' },
        ],
        onComplete: (w, a) => {
          a.flags.lastKnockAnswered = Number(a.beliefs['knock:suite3_door']?.value ?? w.tick);
        },
      },
    ],
    collect_payment: [
      {
        id: 'Settlement',
        steps: [{ do: 'talk', args: { to: 'vivian', topic: 'settlement', near: 2 }, deadline: '1:15', label: 'the settlement' }],
      },
    ],
    nightcap: [
      {
        id: 'DrinkIt',
        steps: [
          { do: 'goTo', args: { room: 'suite3', spot: 'sitting' }, label: 'sit down' },
          { do: 'wait', minutes: 4, label: 'let it breathe' },
          { do: 'use', args: { target: 'nightcap_tray', action: 'drink' }, label: 'drink the brandy' },
        ],
      },
    ],
    stash_envelope: [
      {
        id: 'SafeAndCash',
        steps: [
          { do: 'talk', args: { to: 'walter', topic: 'office_now', near: 2 }, deadline: '10:20', label: 'a word with Walter' },
          { do: 'goTo', args: { room: 'office', spot: 'default' }, label: 'into the office' },
          { do: 'wait', until: (w) => inRoom(w, 'walter', 'office'), deadline: '10:24', label: 'wait for Walter' },
          { do: 'use', args: { target: 'safe', action: 'put', item: 'voss_envelope' }, label: 'envelope into the safe' },
          { do: 'give', args: { to: 'walter', item: 'voss_cash' }, label: 'slip Walter the cash' },
          { do: 'goTo', args: { room: 'bar', spot: 'voss_stool' }, label: 'back to the bar' },
        ],
      },
    ],
    write_telegram: [
      {
        id: 'TelegramAtDesk',
        steps: [
          { do: 'goTo', args: { room: 'suite3', spot: 'door_inside' }, label: 'up to Suite 3' },
          { do: 'lock', args: { door: 'suite3_door' }, label: 'lock the door' },
          { do: 'use', args: { target: 'telegram', action: 'write' }, label: 'write the telegram' },
        ],
      },
    ],
    order_photos: [
      {
        id: 'MeetJimmyAtCar',
        steps: [
          { do: 'goTo', args: { fixture: 'cadillac' }, label: 'out to the Cadillac' },
          { do: 'wait', until: (w, a) => inRoom(w, 'jimmy', 'lot') && dist(w, a.id, 'jimmy') <= 2, deadline: '11:12', label: 'wait for Jimmy' },
          { do: 'talk', args: { to: 'jimmy', topic: 'order_photos', near: 2 }, label: 'give Jimmy his orders' },
          { do: 'goTo', args: { room: 'bar', spot: 'voss_stool' }, label: 'back to the bar' },
        ],
      },
    ],
    summon_vivian: [
      {
        id: 'CatchHerAtTheBar',
        steps: [
          { do: 'goTo', args: { room: 'bar', spot: 'voss_stool' }, label: 'wait at the bar' },
          { do: 'wait', until: (w) => inRoom(w, 'vivian', 'bar'), deadline: '10:50', label: 'wait for Vivian' },
          { do: 'talk', args: { to: 'vivian', topic: 'summons', near: 2 }, label: 'tell her' },
        ],
      },
      {
        id: 'KnockOnSuite1',
        steps: [
          { do: 'goTo', args: { room: 'corridor', spot: 'outside_suite1' }, label: 'up to Suite 1' },
          { do: 'use', args: { target: 'suite1_door', action: 'knock' }, label: 'knock' },
          { do: 'wait', until: (w, a) => dist(w, a.id, 'vivian') <= 2, minutes: 3, label: 'wait for her' },
          { do: 'talk', args: { to: 'vivian', topic: 'summons', near: 2 }, deadline: '11:00', label: 'tell her' },
        ],
      },
    ],
    await_jimmy: [
      {
        id: 'WaitForJimmy',
        steps: [
          { do: 'goTo', args: { room: 'suite3', spot: 'door_inside' }, label: 'to the door' },
          { do: 'lock', args: { door: 'suite3_door' }, skipIf: (w, a) => a.flags.expectingJimmy === true, label: 'lock up' },
          { do: 'goTo', args: { room: 'suite3', spot: 'sitting' }, label: 'sit down' },
          { do: 'wait', until: (w) => inRoom(w, 'jimmy', 'suite3'), label: 'wait for Jimmy' },
          { do: 'talk', args: { to: 'jimmy', topic: 'pay_jimmy', near: 2 }, label: 'settle with Jimmy' },
        ],
      },
    ],
    drink_at_bar: [
      {
        id: 'AnotherRye',
        steps: [
          { do: 'goTo', args: { room: 'bar', spot: 'voss_stool' }, label: 'to the bar' },
          { do: 'use', args: { target: 'bar_counter', action: 'drink' }, label: 'a rye' },
          { do: 'wait', minutes: 12, label: 'nurse it' },
        ],
      },
    ],
    confront_intruder: [
      {
        id: 'OutAndLockUp',
        steps: [
          { do: 'talk', args: { to: 'player', topic: 'get_out', near: 2, interrupt: true }, label: 'tell them to get out' },
          { do: 'wait', until: (w, a) => a.beliefs['whereIs:player']?.value !== 'suite3', minutes: 2, label: 'see them out' },
          { do: 'use', args: { target: 'suite3_door', action: 'lock' }, skipIf: (w, a) => a.beliefs['whereIs:player']?.value === 'suite3' || a.flags.expectingJimmy === true, label: 'lock the door' },
        ],
      },
    ],
    confront_follower: confrontFollowerPlans(),
    wait_in_suite: [{ id: 'SitInSuite3', steps: idlePlan('suite3', 'sitting') }],
  },
  reactions: [
    {
      id: 'voss_smiles_at_bulletin',
      on: 'heard',
      when: (w, a, p) => p.kind === 'heard' && p.sound === 'radio' && (p.text ?? '').includes('1949'),
      do: (w, a, p, ctx) => {
        gesture(w, a.id, 'smile');
        ctx.decide('the 1949 case reopened: more leverage, not less');
      },
      once: true,
    },
    {
      id: 'voss_notes_intruder',
      on: 'saw_agent',
      when: (w, a, p) => p.kind === 'saw_agent' && p.intruder && a.room === 'suite3',
      do: (w, a, p, ctx) => {
        if (p.kind !== 'saw_agent') return;
        a.flags[`expecting:${p.who}`] = true;
        ctx.decide(`${p.who} is in my suite uninvited`);
      },
      cooldownMinutes: 10,
    },
    {
      id: 'voss_hears_knock_while_out',
      on: 'heard',
      when: (w, a, p) => p.kind === 'heard' && p.sound === 'knock' && p.text === 'suite3_door' && a.room !== 'suite3',
      do: (w, a, p, ctx) => ctx.decide('someone is knocking at Suite 3 while I am out'),
      cooldownMinutes: 5,
    },
  ],
};
