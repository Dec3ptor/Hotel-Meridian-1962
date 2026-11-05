/**
 * The Hotel Meridian on a 46x32 tile grid, two floors.
 *
 * Ground floor: the parking lot wraps the building (front drive to the
 * north, rear lot and motor court to the south). Office, lobby and bar face
 * the front; laundry and kitchen are behind them. Rooms 6 and 7 sit in the
 * motor court at the back. Upstairs a corridor runs the length of the
 * building with the three suites behind it; the grand stair rises from the
 * lobby's corner and the back stair from the laundry.
 *
 * Rooms never touch: a one-tile wall separates them, with doors in the gap.
 */
import type { MapDef } from '../sim/types';

export const TILE = 32;
export const MAP_W = 46;
export const MAP_H = 32;

export const RoomIds = {
  lot: 'lot',
  office: 'office',
  lobby: 'lobby',
  bar: 'bar',
  laundry: 'laundry',
  kitchen: 'kitchen',
  room6: 'room6',
  room7: 'room7',
  corridor: 'corridor',
  suite1: 'suite1',
  suite2: 'suite2',
  suite3: 'suite3',
} as const;

export const map: MapDef = {
  width: MAP_W,
  height: MAP_H,
  floors: 2,
  tileSize: TILE,
  rooms: [
    {
      id: 'lot',
      name: 'Parking lot',
      floor: 0,
      outdoor: true,
      visibility: 7,
      rects: [
        { x0: 1, y0: 1, x1: 44, y1: 3 }, // front drive
        { x0: 1, y0: 4, x1: 3, y1: 30 }, // west side
        { x0: 42, y0: 4, x1: 44, y1: 30 }, // east side
        { x0: 4, y0: 20, x1: 41, y1: 21 }, // behind the kitchen
        { x0: 4, y0: 22, x1: 28, y1: 30 }, // rear lot
        { x0: 29, y0: 29, x1: 41, y1: 30 }, // behind the motor court
      ],
      spots: {
        default: { x: 19, y: 2 },
        front_door: { x: 19, y: 3 },
        cadillac_side: { x: 13, y: 25 },
        back_door: { x: 24, y: 20 },
        room6_door: { x: 32, y: 21 },
        room7_door: { x: 38, y: 21 },
        east_side: { x: 42, y: 8 },
      },
    },
    {
      id: 'office',
      name: "Clerk's office",
      floor: 0,
      owners: ['walter'],
      rects: [{ x0: 5, y0: 5, x1: 11, y1: 11 }],
      spots: { default: { x: 8, y: 7 }, walter: { x: 7, y: 9 } },
    },
    {
      id: 'lobby',
      name: 'Lobby',
      floor: 0,
      rects: [{ x0: 13, y0: 5, x1: 26, y1: 11 }],
      spots: {
        default: { x: 19, y: 7 },
        desk_front: { x: 15, y: 8 },
        desk_back: { x: 13, y: 8 },
        armchair: { x: 24, y: 9 },
        stair_foot: { x: 25, y: 6 },
      },
    },
    {
      id: 'bar',
      name: 'Lounge bar',
      floor: 0,
      rects: [{ x0: 28, y0: 5, x1: 40, y1: 11 }],
      spots: {
        default: { x: 33, y: 8 },
        voss_stool: { x: 35, y: 7 },
        vivian_stool: { x: 35, y: 8 },
        hale_table: { x: 30, y: 7 },
        radio: { x: 33, y: 6 },
      },
    },
    {
      id: 'laundry',
      name: 'Laundry',
      floor: 0,
      service: true,
      rects: [{ x0: 5, y0: 13, x1: 14, y1: 18 }],
      spots: { default: { x: 9, y: 15 }, stair: { x: 6, y: 13 }, carts: { x: 9, y: 16 } },
    },
    {
      id: 'kitchen',
      name: 'Kitchen',
      floor: 0,
      service: true,
      rects: [{ x0: 16, y0: 13, x1: 40, y1: 18 }],
      spots: {
        default: { x: 25, y: 16 },
        counter: { x: 22, y: 14 },
        knife_block: { x: 18, y: 14 },
        back_door: { x: 24, y: 18 },
        laundry_door: { x: 16, y: 15 },
      },
    },
    {
      id: 'room6',
      name: 'Room 6',
      floor: 0,
      owners: ['jimmy', 'ruth'],
      rects: [{ x0: 30, y0: 23, x1: 34, y1: 27 }],
      spots: { default: { x: 32, y: 24 }, door_inside: { x: 32, y: 23 }, bed: { x: 32, y: 26 } },
    },
    {
      id: 'room7',
      name: 'Room 7',
      floor: 0,
      owners: ['player'],
      rects: [{ x0: 36, y0: 23, x1: 40, y1: 27 }],
      spots: { default: { x: 38, y: 25 }, door_inside: { x: 38, y: 23 }, bed: { x: 38, y: 26 }, wall: { x: 36, y: 25 } },
    },
    {
      id: 'corridor',
      name: 'Upstairs corridor',
      floor: 1,
      rects: [{ x0: 5, y0: 5, x1: 40, y1: 7 }],
      spots: {
        default: { x: 20, y: 6 },
        stair_top: { x: 25, y: 6 },
        alcove: { x: 40, y: 5 },
        back_stair_top: { x: 6, y: 5 },
        outside_suite1: { x: 10, y: 7 },
        outside_suite2: { x: 22, y: 7 },
        outside_suite3: { x: 34, y: 7 },
        chute: { x: 13, y: 6 },
      },
    },
    {
      id: 'suite1',
      name: 'Suite 1',
      floor: 1,
      owners: ['vivian'],
      rects: [{ x0: 5, y0: 9, x1: 15, y1: 17 }],
      spots: { default: { x: 10, y: 12 }, door_inside: { x: 10, y: 9 }, vanity: { x: 6, y: 10 }, window: { x: 10, y: 16 } },
    },
    {
      id: 'suite2',
      name: 'Suite 2',
      floor: 1,
      owners: ['hale'],
      rects: [{ x0: 17, y0: 9, x1: 27, y1: 17 }],
      spots: { default: { x: 22, y: 12 }, door_inside: { x: 22, y: 9 }, window: { x: 22, y: 16 } },
    },
    {
      id: 'suite3',
      name: 'Suite 3',
      floor: 1,
      owners: ['voss'],
      rects: [{ x0: 29, y0: 9, x1: 40, y1: 17 }],
      spots: {
        default: { x: 37, y: 12 },
        door_inside: { x: 34, y: 9 },
        desk: { x: 39, y: 9 },
        sitting: { x: 36, y: 13 },
        guest: { x: 37, y: 13 },
        wardrobe: { x: 30, y: 10 },
      },
    },
  ],
  doors: [
    { id: 'office_door', name: 'office door', floor: 0, tiles: [{ x: 12, y: 8 }], between: ['office', 'lobby'], kind: 'door', lockable: true, key: 'office_key', autoClose: true },
    { id: 'lobby_arch', name: 'archway to the bar', floor: 0, tiles: [{ x: 27, y: 7 }, { x: 27, y: 8 }], between: ['lobby', 'bar'], kind: 'archway' },
    { id: 'front_door', name: 'front door', floor: 0, tiles: [{ x: 19, y: 4 }], between: ['lobby', 'lot'], kind: 'door', lockable: true, autoClose: true },
    { id: 'bar_kitchen_door', name: 'service door', floor: 0, tiles: [{ x: 34, y: 12 }], between: ['bar', 'kitchen'], kind: 'door', autoClose: true },
    { id: 'laundry_door', name: 'back-stair door', floor: 0, tiles: [{ x: 15, y: 15 }], between: ['kitchen', 'laundry'], kind: 'door', lockable: true, key: 'laundry_key', autoClose: true },
    { id: 'kitchen_back_door', name: 'kitchen back door', floor: 0, tiles: [{ x: 24, y: 19 }], between: ['kitchen', 'lot'], kind: 'door', lockable: true, key: 'laundry_key', autoClose: true },
    { id: 'room6_door', name: 'Room 6 door', floor: 0, tiles: [{ x: 32, y: 22 }], between: ['room6', 'lot'], kind: 'door', lockable: true, key: 'room6_key', autoClose: true },
    { id: 'room7_door', name: 'Room 7 door', floor: 0, tiles: [{ x: 38, y: 22 }], between: ['room7', 'lot'], kind: 'door', lockable: true, key: 'room7_key', autoClose: true },
    { id: 'suite1_door', name: 'Suite 1 door', floor: 1, tiles: [{ x: 10, y: 8 }], between: ['suite1', 'corridor'], kind: 'door', lockable: true, key: 'suite1_key', autoClose: true },
    { id: 'suite2_door', name: 'Suite 2 door', floor: 1, tiles: [{ x: 22, y: 8 }], between: ['suite2', 'corridor'], kind: 'door', lockable: true, key: 'suite2_key', autoClose: true },
    { id: 'suite3_door', name: 'Suite 3 door', floor: 1, tiles: [{ x: 34, y: 8 }], between: ['suite3', 'corridor'], kind: 'door', lockable: true, key: 'suite3_key', autoClose: true },
  ],
  portals: [
    { id: 'main_stair', name: 'grand staircase', a: { floor: 0, x: 26, y: 5 }, b: { floor: 1, x: 26, y: 6 }, roomA: 'lobby', roomB: 'corridor', creaks: true },
    { id: 'back_stair', name: 'back stair', a: { floor: 0, x: 5, y: 13 }, b: { floor: 1, x: 5, y: 5 }, roomA: 'laundry', roomB: 'corridor' },
  ],
  windows: [
    { id: 'suite3_window', inside: { floor: 1, x: 40, y: 12 }, insideRoom: 'suite3', outside: { floor: 0, x: 42, y: 12 }, outsideRoom: 'lot', radiusInside: 6, radiusOutside: 2 },
    { id: 'corridor_window', inside: { floor: 1, x: 33, y: 5 }, insideRoom: 'corridor', outside: { floor: 0, x: 33, y: 2 }, outsideRoom: 'lot', radiusInside: 6, radiusOutside: 3 },
    { id: 'room7_window', inside: { floor: 0, x: 37, y: 23 }, insideRoom: 'room7', outside: { floor: 0, x: 37, y: 21 }, outsideRoom: 'lot', radiusInside: 3, radiusOutside: 4 },
    { id: 'suite1_window', inside: { floor: 1, x: 10, y: 17 }, insideRoom: 'suite1', outside: { floor: 0, x: 10, y: 21 }, outsideRoom: 'lot', radiusInside: 4, radiusOutside: 3 },
  ],
  thinWalls: [{ rooms: ['room6', 'room7'] }],
};
