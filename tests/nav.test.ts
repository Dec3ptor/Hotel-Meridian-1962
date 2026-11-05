import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { lockDoor } from '../src/sim/actions';
import { moveToward } from '../src/sim/agents/planner';
import { buildStatic, activate } from '../src/sim/registry';
import { createSim } from '../src/sim/sim';
import { createWorld } from '../src/sim/world';

const s = buildStatic(content);
const nav = s.nav;

function cellOfSpot(room: string, spot: string): number {
  const r = s.rooms[room]!;
  const sp = r.spots[spot]!;
  return nav.cell(r.floor, sp.x, sp.y);
}

describe('nav grid', () => {
  it('builds both floors with every room reachable from Room 7', () => {
    const from = cellOfSpot('room7', 'default');
    for (const room of content.map.rooms) {
      const to = cellOfSpot(room.id, 'default');
      const path = nav.findPath(from, to, 0, 0, 0);
      expect(path, `path to ${room.id}`).not.toBeNull();
    }
  });

  it('routes from Suite 2 to the kitchen by the back stair when the lobby is avoided', () => {
    const from = cellOfSpot('suite2', 'default');
    const to = cellOfSpot('kitchen', 'knife_block');
    const path = nav.findPath(from, to, 0, nav.roomMask(['lobby', 'bar']), 0)!;
    expect(path).not.toBeNull();
    const rooms = new Set(path.map((c) => nav.roomOfCell(c)).filter(Boolean));
    expect(rooms.has('laundry')).toBe(true);
    expect(rooms.has('lobby')).toBe(false);
    expect(rooms.has('bar')).toBe(false);
  });

  it('a locked door without a key blocks the route and forces the long way round', () => {
    const from = cellOfSpot('suite2', 'default');
    const to = cellOfSpot('kitchen', 'knife_block');
    const blocked = 1 << nav.doorIndex.laundry_door!;
    const avoiding = nav.findPath(from, to, blocked, nav.roomMask(['lobby', 'bar']), 0);
    expect(avoiding).toBeNull();
    const anyRoute = nav.findPath(from, to, blocked, 0, 0)!;
    expect(anyRoute).not.toBeNull();
    const rooms = new Set(anyRoute.map((c) => nav.roomOfCell(c)).filter(Boolean));
    expect(rooms.has('lobby')).toBe(true);
  });

  it('avoided portals are not used', () => {
    const from = cellOfSpot('laundry', 'carts');
    const to = cellOfSpot('suite2', 'default');
    const viaBack = nav.findPath(from, to, 0, 0, 0)!;
    const viaMain = nav.findPath(from, to, 0, 0, nav.portalMask(['back_stair']))!;
    expect(viaBack.length).toBeLessThan(viaMain.length);
    const mainCells = new Set(viaMain);
    expect(mainCells.has(nav.cell(0, 26, 5))).toBe(true);
  });

  it('paths are cached per door state', () => {
    nav.clearCache();
    const from = cellOfSpot('lobby', 'default');
    const to = cellOfSpot('kitchen', 'default');
    const a = nav.findPath(from, to, 0, 0, 0);
    const b = nav.findPath(from, to, 0, 0, 0);
    expect(a).toBe(b);
    expect(nav.cacheSize()).toBe(1);
  });
});

describe('movement', () => {
  it('walking through a locked door fails without a key and succeeds with the master key', () => {
    const sim = createSim({ seed: 1 });
    activate(sim.s, sim.bus);
    const w = sim.world;
    const hale = w.agents.hale!;
    // Put the Colonel in the laundry and lock the laundry door from the kitchen side with the master key.
    hale.pos = { floor: 0, x: 9, y: 15 };
    hale.room = 'laundry';
    w.agents.walter!.pos = { floor: 0, x: 16, y: 15 };
    w.agents.walter!.room = 'kitchen';
    expect(lockDoor(w, 'laundry_door', 'walter')).toBe(true);
    const target = cellOfSpot('kitchen', 'knife_block');
    const r = moveToward(w, sim.s, hale, target, { near: 0, avoidRooms: ['lobby', 'bar'] });
    expect(r).toBe('blocked');
    const walter = w.agents.walter!;
    walter.pos = { floor: 0, x: 9, y: 15 };
    walter.room = 'laundry';
    let state = moveToward(w, sim.s, walter, target, { near: 0, avoidRooms: ['lobby', 'bar'] });
    for (let i = 0; i < 100 && state === 'moving'; i++) state = moveToward(w, sim.s, walter, target, { near: 0, avoidRooms: ['lobby', 'bar'] });
    expect(state).toBe('arrived');
    expect(walter.room).toBe('kitchen');
    expect(w.log.some((e) => e.type === 'DoorUnlocked' && e.door === 'laundry_door' && e.by === 'walter')).toBe(true);
  });

  it('the grand staircase creaks when used', () => {
    const sim = createSim({ seed: 1 });
    activate(sim.s, sim.bus);
    const w = createWorld(sim.s, 1);
    sim.world = w;
    const ruth = w.agents.ruth!;
    ruth.pos = { floor: 0, x: 25, y: 6 };
    ruth.room = 'lobby';
    const target = cellOfSpot('corridor', 'default');
    let state = moveToward(w, sim.s, ruth, target, { near: 0 });
    for (let i = 0; i < 100 && state === 'moving'; i++) state = moveToward(w, sim.s, ruth, target, { near: 0 });
    expect(state).toBe('arrived');
    expect(ruth.room).toBe('corridor');
    expect(w.log.some((e) => e.type === 'Sound' && e.kind === 'creak' && e.by === 'ruth')).toBe(true);
    expect(w.log.some((e) => e.type === 'Moved' && e.agent === 'ruth' && e.via === 'main_stair')).toBe(true);
  });
});
