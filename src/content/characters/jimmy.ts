import { adjustMood } from '../../sim/agents/mood';
import { believes, dist, inRoom } from '../../sim/query';
import { storyletRan } from '../../sim/storylets';
import type { CharacterDef } from '../../sim/types';
import { answerDoorGoal, answerDoorPlans, confrontFollowerGoal, confrontFollowerPlans, confrontIntruderGoal, confrontIntruderPlans, idlePlan } from './common';

/**
 * Jimmy Doyle, 28, "salesman", actually Voss's photographer. He befriended
 * Ruth because Voss told him to. He wants his pay and a clean exit.
 */
export const jimmy: CharacterDef = {
  id: 'jimmy',
  name: 'Jimmy Doyle',
  shortName: 'Jimmy',
  age: 28,
  blurb: 'A charming "salesman" with a press pass in his jacket and a camera he did not mention.',
  startRoom: 'room6',
  startSpot: 'default',
  homeRoom: 'room6',
  homeSpot: 'default',
  speed: 1,
  mood: { fear: 2, anger: 2, suspicion: 2, drunk: 0, resolve: 5 },
  beliefs: {
    iWorkForVoss: { value: true, confidence: 1 },
    vossWillPayTonight: { value: true, confidence: 0.9 },
    ruthSuspectsNothing: { value: true, confidence: 0.8 },
    vivianIsMrsMarsh: { value: true, confidence: 1 },
    ruthIsVivianDaughter: { value: true, confidence: 0.9 },
  },
  secrets: ['iWorkForVoss', 'vivianIsMrsMarsh', 'ruthIsVivianDaughter', 'vossWillPayTonight'],
  relationships: {
    voss: { trust: 5, knowsSecret: true },
    ruth: { trust: 6, knowsSecret: false },
    vivian: { trust: 2, knowsSecret: false },
    walter: { trust: 3, knowsSecret: false },
    hale: { trust: 2, knowsSecret: false },
    player: { trust: 3, knowsSecret: false },
  },
  inventory: ['room6_key'],
  chattiness: 0.05,
  goals: [
    {
      id: 'collect_pay',
      name: 'collect the pay and the film',
      priority: 70,
      notBefore: '1:48',
      done: (w, a) => storyletRan(w, 'voss_pays_jimmy') || (a.inventory.includes('undeveloped_film') && a.room === 'room6'),
    },
    {
      id: 'photograph_ruth',
      name: 'photograph Ruth at Suite 1',
      priority: 60,
      notBefore: '11:50',
      deadline: '12:25',
      active: (w) => !inRoom(w, 'ruth', 'room6'),
    },
    {
      id: 'meet_voss_at_car',
      name: 'meet Voss at the Cadillac',
      priority: 55,
      notBefore: '10:57',
      deadline: '11:20',
    },
    answerDoorGoal('room6', 'room6_door'),
    confrontIntruderGoal('room6'),
    confrontFollowerGoal(),
    { id: 'idle', name: 'stay in Room 6', priority: 1, persistent: true },
  ],
  plans: {
    collect_pay: [
      {
        id: 'AskForPay',
        steps: [
          { do: 'goTo', args: { room: 'suite3', spot: 'door_inside' }, label: 'up to Suite 3' },
          { do: 'talk', args: { to: 'voss', topic: 'pay_me', near: 2 }, deadline: '1:58', label: 'ask for the money' },
          { do: 'wait', until: (w) => storyletRan(w, 'voss_pays_jimmy'), minutes: 3, label: 'wait for the envelope' },
          { do: 'goTo', args: { room: 'room6', spot: 'default' }, label: 'back to Room 6' },
        ],
      },
      {
        id: 'GrabTheFilmAndRun',
        if: (w, a) => believes(w, a.id, 'dead:voss', true, 0.5),
        ifReason: 'Voss is not dead, so why run',
        steps: [
          { do: 'take', args: { item: 'undeveloped_film' }, label: 'grab the film' },
          { do: 'wait', minutes: 1.5, label: 'stand over the body, unable to move' },
          { do: 'flee', args: { room: 'room6', spot: 'default' }, label: 'run' },
        ],
      },
      {
        id: 'GiveUpOnPay',
        steps: [{ do: 'goTo', args: { room: 'room6', spot: 'default' }, label: 'back to Room 6' }],
      },
    ],
    photograph_ruth: [
      {
        id: 'FromTheStairs',
        steps: [
          { do: 'search', args: { target: 'jimmys_jacket', item: 'camera', minutes: 0.2 }, skipIf: (w, a) => a.inventory.includes('camera'), label: 'the camera from the jacket' },
          { do: 'goTo', args: { room: 'corridor', spot: 'stair_top' }, label: 'up the main stair' },
          { do: 'wait', until: (w) => inRoom(w, 'ruth', 'corridor'), deadline: '12:12', label: 'wait for Ruth to knock' },
          { do: 'use', args: { target: 'camera', action: 'photograph' }, label: 'take the picture' },
          { do: 'wait', until: (w) => !inRoom(w, 'ruth', 'corridor'), deadline: '12:20', label: 'let her go first' },
          { do: 'goTo', args: { room: 'room6', spot: 'default' }, label: 'back to Room 6' },
        ],
      },
    ],
    meet_voss_at_car: [
      {
        id: 'OutToTheCadillac',
        steps: [
          { do: 'goTo', args: { room: 'lot', spot: 'cadillac_side' }, label: 'out to the Cadillac' },
          { do: 'wait', until: (w, a) => inRoom(w, 'voss', 'lot') && dist(w, a.id, 'voss') <= 2, deadline: '11:12', label: 'wait for Voss' },
          { do: 'wait', until: (w) => storyletRan(w, 'voss_order_photos'), deadline: '11:15', label: 'take his orders' },
          { do: 'goTo', args: { room: 'room6', spot: 'default' }, label: 'back to Room 6' },
        ],
      },
    ],
    answer_door: answerDoorPlans('room6', 'room6_door'),
    confront_intruder: confrontIntruderPlans(),
    confront_follower: confrontFollowerPlans(),
    idle: [{ id: 'StayInRoom6', steps: idlePlan('room6', 'default') }],
  },
  reactions: [
    {
      id: 'jimmy_finds_voss',
      on: 'saw_body',
      when: (w, a, p) => p.kind === 'saw_body' && p.who === 'voss',
      do: (w, a, p, ctx) => {
        adjustMood(w, a.id, 'fear', 2, 'Voss is dead and I am standing over him');
        ctx.decide('Voss is dead. Take the film and get out before anyone sees me here');
      },
      once: true,
    },
  ],
};
