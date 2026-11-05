import { adjustMood } from '../../sim/agents/mood';
import { setBelief } from '../../sim/agents/beliefs';
import { after, alive, believes, dist, hasWeapon, inRoom, othersIn } from '../../sim/query';
import type { CharacterDef } from '../../sim/types';
import { believedIn, confrontFollowerGoal, confrontFollowerPlans, confrontIntruderGoal, confrontIntruderPlans, idlePlan, sawRecently } from './common';

/**
 * Colonel Arthur Hale, 66, retired. He has followed Voss across three states
 * believing Voss drove the car that killed his daughter Clara in 1949.
 */
export const hale: CharacterDef = {
  id: 'hale',
  name: 'Colonel Arthur Hale',
  shortName: 'the Colonel',
  age: 66,
  blurb: 'A retired colonel with a newspaper, a notebook of dates, and a loaded revolver he does not intend to use.',
  startRoom: 'lobby',
  startSpot: 'armchair',
  homeRoom: 'suite2',
  homeSpot: 'default',
  speed: 1,
  mood: { fear: 1, anger: 6, suspicion: 5, drunk: 0, resolve: 9 },
  beliefs: {
    driverOf1949: { value: 'voss', confidence: 0.8 },
    vossKilledClara: { value: true, confidence: 0.8 },
    vivianIsJustAGuest: { value: true, confidence: 0.6 },
    cameToKillVoss: { value: true, confidence: 1 },
  },
  secrets: ['driverOf1949', 'vossKilledClara', 'cameToKillVoss'],
  relationships: {
    voss: { trust: 0, knowsSecret: false },
    vivian: { trust: 3, knowsSecret: false },
    walter: { trust: 4, knowsSecret: false },
    jimmy: { trust: 2, knowsSecret: false },
    ruth: { trust: 4, knowsSecret: false },
    player: { trust: 3, knowsSecret: false },
  },
  inventory: ['suite2_key'],
  chattiness: 0.02,
  goals: [
    {
      id: 'silence_witness',
      name: 'silence the witness',
      priority: 95,
      urgent: true,
      active: (w, a) => a.flags['killed:voss'] === true && a.room !== 'suite2' && alive(w, 'player') && sawRecently(w, a, 'player', 0.5) && !a.flags.witnessEscaped,
    },
    {
      id: 'flee_in_cadillac',
      name: 'get away in the Cadillac',
      priority: 94,
      active: (w, a) => a.flags.witnessEscaped === true && alive(w, 'player'),
    },
    {
      id: 'confront_driver',
      name: 'face the one who was driving',
      priority: 80,
      notBefore: '11:35',
      active: (w, a) => alive(w, 'vivian') && believes(w, a.id, 'driverOf1949', 'vivian', 0.7) && !believes(w, a.id, 'vivianConfessed', true, 0.5),
      done: (w, a) => believes(w, a.id, 'vivianConfessed', true, 0.5) || !alive(w, 'vivian'),
    },
    confrontIntruderGoal('suite2'),
    confrontFollowerGoal(),
    {
      id: 'kill_voss',
      name: 'make Voss pay for Clara',
      priority: 80,
      notBefore: '1:27',
      active: (w, a) => alive(w, 'voss') && hasWeapon(w, a.id) !== undefined && believes(w, a.id, 'driverOf1949', 'voss', 0.6),
    },
    {
      id: 'arm_himself',
      name: 'get a weapon',
      priority: 60,
      notBefore: '12:38',
      done: (w, a) => hasWeapon(w, a.id) !== undefined,
    },
    {
      id: 'surveil_suite3',
      name: "watch Suite 3's window from the car",
      priority: 55,
      notBefore: '12:40',
      deadline: '1:09',
      active: (w, a) => hasWeapon(w, a.id) !== undefined,
    },
    {
      id: 'return_to_lobby',
      name: 'come in from the car',
      priority: 50,
      notBefore: '1:09',
      deadline: '1:29',
    },
    {
      id: 'watch_voss',
      name: 'keep an eye on Voss',
      priority: 40,
      deadline: '11:30',
    },
    {
      id: 'rest_in_suite',
      name: 'rest in Suite 2',
      priority: 30,
      notBefore: '11:27',
      deadline: '12:38',
      persistent: true,
    },
    { id: 'idle', name: 'sit in Suite 2', priority: 1, persistent: true },
  ],
  plans: {
    silence_witness: [
      {
        id: 'KillTheWitness',
        steps: [{ do: 'attack', args: { target: 'player' }, deadline: undefined, label: 'no witnesses' }],
        onFail: (w, a) => {
          a.flags.witnessEscaped = true;
        },
      },
    ],
    flee_in_cadillac: [
      {
        id: 'TakeTheCadillac',
        steps: [
          { do: 'take', args: { item: 'cadillac_keys' }, skipIf: (w, a) => a.inventory.includes('cadillac_keys'), label: 'the keys from his coat' },
          { do: 'goTo', args: { fixture: 'cadillac' }, label: 'out to the Cadillac' },
          { do: 'use', args: { target: 'cadillac', action: 'drive' }, label: 'drive' },
        ],
      },
      {
        id: 'HoleUpInSuite2',
        steps: [
          { do: 'goTo', args: { room: 'suite2', spot: 'door_inside' }, label: 'back to Suite 2' },
          { do: 'lock', args: { door: 'suite2_door' }, label: 'lock the door' },
          { do: 'wait', minutes: 60, label: 'wait for the morning' },
        ],
      },
    ],
    confront_driver: [
      {
        id: 'ConfrontVivian',
        steps: [
          { do: 'goTo', args: { room: 'corridor', spot: 'outside_suite1' }, label: 'along to Suite 1' },
          { do: 'use', args: { target: 'suite1_door', action: 'knock' }, skipIf: (w) => !w.doors.suite1_door!.locked && w.doors.suite1_door!.open, label: 'knock' },
          { do: 'wait', until: (w, a) => inRoom(w, 'vivian', 'suite1') && dist(w, a.id, 'vivian') <= 2, minutes: 4, label: 'wait for her to open' },
          { do: 'talk', args: { to: 'vivian', topic: 'clara_hale', near: 2, interrupt: true }, if: (w, a) => dist(w, a.id, 'vivian') <= 2, ifReason: 'she will not come to the door', label: 'Clara Hale' },
          {
            do: 'attack',
            args: { target: 'vivian' },
            if: (w, a) => a.mood.anger >= 8 && hasWeapon(w, a.id) !== undefined && !believes(w, a.id, 'vivianConfessed', true, 0.5),
            ifReason: 'he cannot raise his hand to her',
            label: 'the knife, for Clara',
          },
          { do: 'goTo', args: { room: 'suite2', spot: 'default' }, label: 'back to Suite 2' },
        ],
      },
      {
        id: 'FindHerWhereverSheIs',
        steps: [
          { do: 'talk', args: { to: 'vivian', topic: 'clara_hale', near: 2, interrupt: true }, deadline: undefined, label: 'Clara Hale' },
          {
            do: 'attack',
            args: { target: 'vivian' },
            if: (w, a) => a.mood.anger >= 8 && hasWeapon(w, a.id) !== undefined && !believes(w, a.id, 'vivianConfessed', true, 0.5),
            ifReason: 'he cannot raise his hand to her',
            label: 'the knife, for Clara',
          },
          { do: 'goTo', args: { room: 'suite2', spot: 'default' }, label: 'back to Suite 2' },
        ],
      },
    ],
    confront_intruder: confrontIntruderPlans(),
    confront_follower: confrontFollowerPlans(),
    kill_voss: [
      {
        id: 'AmbushFromAlcove',
        steps: [
          { do: 'goTo', args: { room: 'corridor', spot: 'alcove', avoid: ['lobby'], avoidPortals: ['main_stair'] }, label: 'up the back stair to the alcove' },
          {
            do: 'wait',
            until: (w, a) => after(w, '1:39') && !w.doors.suite3_door!.locked && othersIn(w, 'corridor', a.id) === 0,
            deadline: '1:52',
            label: 'wait in the alcove',
          },
          {
            do: 'goTo',
            args: { room: 'suite3', spot: 'sitting', near: 1 },
            if: (w, a) => believedIn(w, a, 'suite3', ['voss']).length === 0,
            ifReason: 'someone else is in Suite 3',
            label: 'slip into Suite 3',
          },
          {
            do: 'attack',
            args: { target: 'voss' },
            if: (w, a) => believedIn(w, a, 'suite3', ['voss']).length === 0,
            ifReason: 'someone else is in Suite 3',
            label: 'the knife',
          },
          { do: 'take', args: { item: 'suite3_towel' }, label: 'take the towel' },
          { do: 'use', args: { target: 'suite3_towel', action: 'wipe' }, label: 'wipe the blade and his hands' },
          { do: 'use', args: { target: 'chute_hatch', action: 'drop', item: 'suite3_towel' }, label: 'towel down the chute' },
          { do: 'goTo', args: { room: 'laundry', spot: 'carts', avoid: ['lobby'] }, label: 'down the back stair to the laundry' },
          { do: 'take', args: { item: 'suite3_towel' }, label: 'fish the towel out of the chute' },
          { do: 'drop', args: { item: 'suite3_towel', into: 'laundry_cart_1' }, label: 'bury it in the cart' },
          { do: 'wait', minutes: 2.5, label: 'listen at the laundry door until the house is quiet' },
          { do: 'goTo', args: { room: 'suite2', spot: 'door_inside', avoidPortals: ['back_stair'] }, label: 'back to Suite 2 by the main stair' },
          { do: 'lock', args: { door: 'suite2_door' }, label: 'lock the door' },
          { do: 'goTo', args: { room: 'suite2', spot: 'default' }, label: 'sit down' },
        ],
        onFail: (w, a) => adjustMood(w, a.id, 'anger', 2, 'the moment slipped'),
      },
      {
        id: 'KnockAndConfront',
        steps: [
          { do: 'goTo', args: { room: 'corridor', spot: 'outside_suite3' }, label: 'to Suite 3' },
          { do: 'use', args: { target: 'suite3_door', action: 'knock' }, label: 'knock' },
          { do: 'wait', until: (w) => !w.doors.suite3_door!.locked, minutes: 3, label: 'wait for the door' },
          { do: 'goTo', args: { room: 'suite3', spot: 'sitting', near: 1 }, if: (w, a) => !w.doors.suite3_door!.locked && believedIn(w, a, 'suite3', ['voss']).length === 0, ifReason: 'he will not open the door, or he is not alone', label: 'go in' },
          { do: 'attack', args: { target: 'voss' }, if: (w, a) => believedIn(w, a, 'suite3', ['voss']).length === 0, ifReason: 'someone else is in Suite 3', label: 'face him' },
          { do: 'goTo', args: { room: 'suite2', spot: 'default' }, label: 'back to Suite 2' },
        ],
      },
      {
        id: 'NotTonight',
        steps: [
          { do: 'goTo', args: { room: 'suite2', spot: 'default' }, label: 'back to Suite 2' },
          { do: 'wait', minutes: 30, label: 'wait for another chance' },
        ],
      },
    ],
    arm_himself: [
      {
        id: 'KnifeViaBackStair',
        steps: [
          { do: 'goTo', args: { room: 'kitchen', spot: 'knife_block', avoid: ['lobby', 'bar'] }, label: 'down the back stair to the kitchen' },
          { do: 'take', args: { item: 'kitchen_knife', conceal: true }, label: 'take a knife from the block' },
        ],
      },
      {
        id: 'KnifeViaLobby',
        steps: [
          { do: 'goTo', args: { room: 'kitchen', spot: 'knife_block' }, label: 'through the bar to the kitchen' },
          { do: 'take', args: { item: 'kitchen_knife', conceal: true }, label: 'take a knife from the block' },
        ],
      },
      {
        id: 'TheRevolver',
        steps: [
          { do: 'search', args: { target: 'bedside_drawer', item: 'hale_revolver', conceal: true, minutes: 0.5 }, label: 'the service revolver' },
        ],
      },
    ],
    surveil_suite3: [
      {
        id: 'WatchFromTheCar',
        steps: [
          { do: 'goTo', args: { room: 'lot', spot: 'back_door', sneak: true }, label: 'out the back door' },
          { do: 'wait', until: (w) => after(w, '12:47'), label: 'stand under the eave until the lot is quiet' },
          { do: 'goTo', args: { fixture: 'hale_car' }, label: 'out to the car' },
          { do: 'use', args: { target: 'hale_car', action: 'sit' }, label: 'sit in the car' },
          { do: 'wait', until: (w) => after(w, '1:09'), label: "watch Suite 3's window" },
        ],
      },
    ],
    return_to_lobby: [
      {
        id: 'BackToTheArmchair',
        steps: [
          { do: 'goTo', args: { room: 'lobby', spot: 'armchair' }, label: 'in from the rain' },
          { do: 'use', args: { target: 'armchair_hale', action: 'sit' }, label: 'sit' },
          { do: 'wait', until: (w) => after(w, '1:28'), label: 'wait' },
        ],
      },
    ],
    watch_voss: [
      {
        id: 'NewspaperInTheLobby',
        steps: [
          { do: 'goTo', args: { room: 'lobby', spot: 'armchair' }, label: 'the armchair' },
          { do: 'use', args: { target: 'armchair_hale', action: 'sit' }, label: 'sit with the paper' },
          { do: 'wait', until: (w) => after(w, '11:12'), label: 'watch the bar' },
          { do: 'goTo', args: { room: 'bar', spot: 'hale_table' }, label: 'into the bar for the news' },
          { do: 'wait', until: (w) => after(w, '11:29'), label: 'listen to the radio' },
          { do: 'goTo', args: { room: 'suite2', spot: 'door_inside' }, label: 'up to Suite 2' },
          { do: 'lock', args: { door: 'suite2_door' }, label: 'lock the door' },
        ],
      },
    ],
    rest_in_suite: [
      {
        id: 'RestInSuite2',
        steps: [
          { do: 'goTo', args: { room: 'suite2', spot: 'default' }, label: 'to the suite' },
          { do: 'wait', until: (w) => after(w, '12:38'), label: 'wait' },
        ],
      },
    ],
    idle: [{ id: 'SitInSuite2', steps: idlePlan('suite2', 'default') }],
  },
  reactions: [
    {
      id: 'hale_sees_voss_smile',
      on: 'saw_gesture',
      when: (w, a, p) => p.kind === 'saw_gesture' && p.who === 'voss' && p.gesture === 'smile',
      do: (w, a, p, ctx) => {
        adjustMood(w, a.id, 'anger', 1, 'Voss smiled at the news');
        setBelief(w, a.id, 'vossSmiledAtBulletin', true, 1, 'seen');
        ctx.decide('he smiled. He smiled at it.');
      },
      once: true,
    },
    {
      id: 'hale_hears_bulletin',
      on: 'heard',
      when: (w, a, p) => p.kind === 'heard' && p.sound === 'radio' && (p.text ?? '').includes('1949'),
      do: (w, a, p, ctx) => {
        adjustMood(w, a.id, 'resolve', 1, 'the case is reopened');
        ctx.decide('thirteen years, and now they reopen it');
      },
      once: true,
    },
  ],
};
