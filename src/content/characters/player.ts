import type { CharacterDef } from '../../sim/types';

/**
 * The player is an agent like any other for perception purposes, but has no
 * goals of their own: commands (Phase 2) drive them.
 */
export const player: CharacterDef = {
  id: 'player',
  name: 'You',
  shortName: 'you',
  age: 30,
  blurb: 'A stranded guest in Room 7, wet from the storm, who knows nothing yet.',
  startRoom: 'room7',
  startSpot: 'default',
  homeRoom: 'room7',
  homeSpot: 'default',
  speed: 1,
  mood: { fear: 2, anger: 0, suspicion: 2, drunk: 0, resolve: 5 },
  beliefs: {},
  secrets: [],
  relationships: {
    voss: { trust: 3, knowsSecret: false },
    vivian: { trust: 3, knowsSecret: false },
    hale: { trust: 3, knowsSecret: false },
    jimmy: { trust: 3, knowsSecret: false },
    ruth: { trust: 3, knowsSecret: false },
    walter: { trust: 3, knowsSecret: false },
  },
  inventory: ['room7_key'],
  chattiness: 0,
  goals: [],
  plans: {},
  reactions: [],
};
