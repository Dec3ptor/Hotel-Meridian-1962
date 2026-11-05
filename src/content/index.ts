/**
 * The default content bundle. Importing this module registers it with the
 * engine so `createSim()` needs no arguments.
 */
import { registerDefaultContent } from '../sim/sim';
import type { Content } from '../sim/types';
import { hale } from './characters/hale';
import { jimmy } from './characters/jimmy';
import { player } from './characters/player';
import { ruth } from './characters/ruth';
import { vivian } from './characters/vivian';
import { voss } from './characters/voss';
import { walter } from './characters/walter';
import { endings } from './endings';
import { fixtures, items } from './items';
import { map } from './map';
import { schedule } from './schedule';
import { storylets } from './storylets';

export const content: Content = {
  map,
  fixtures,
  items,
  characters: [walter, voss, vivian, hale, jimmy, ruth, player],
  storylets,
  schedule,
  endings,
};

registerDefaultContent(() => content);

export default content;
