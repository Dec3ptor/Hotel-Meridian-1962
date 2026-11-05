import type { Content, DoorDef, FixtureDef, MapDef, PortalDef, RoomId, TilePos, WindowDef } from './types';

/**
 * Tile grid for both floors and A* pathfinding.
 *
 * Cells are integers: floor * W * H + y * W + x. A tile is walkable when it
 * lies inside a room rect or is a door tile, and no blocking fixture sits on
 * it. Portals (stairs) connect two cells on different floors.
 *
 * Paths are cached per (from, to, blocked doors, avoided rooms, avoided
 * portals). The blocked-door mask is derived from door state each query, so
 * the cache never goes stale: a changed lock changes the key.
 */

export type RoomLinkKind = 'door' | 'archway' | 'portal' | 'thinwall' | 'window';

export interface RoomLink {
  a: number;
  b: number;
  kind: RoomLinkKind;
  door?: number;
  portal?: number;
  window?: number;
}

export class Nav {
  readonly W: number;
  readonly H: number;
  readonly floors: number;
  readonly floorCells: number;
  readonly totalCells: number;
  readonly walkable: Uint8Array;
  readonly roomIdx: Int16Array;
  readonly doorIdx: Int16Array;
  readonly portalAt: Int16Array;
  readonly roomIds: RoomId[];
  readonly roomIndex: Record<RoomId, number> = {};
  readonly doorIds: string[];
  readonly doorIndex: Record<string, number> = {};
  readonly doors: DoorDef[];
  readonly portals: PortalDef[];
  readonly portalIndex: Record<string, number> = {};
  readonly portalCells: { a: number; b: number }[] = [];
  readonly windows: WindowDef[];
  readonly links: RoomLink[] = [];
  /** linkTable[a][b]: links between rooms a and b (both directions). */
  readonly linkTable: RoomLink[][][] = [];
  readonly doorCells: number[][] = []; // door index -> cells
  readonly fixtureAt: Int16Array; // cell -> fixture index or -1
  readonly fixtures: FixtureDef[];
  readonly fixtureIndex: Record<string, number> = {};

  private cache: Map<string, number[] | null> = new Map();
  // A* scratch
  private gScore: Float64Array;
  private cameFrom: Int32Array;
  private seenGen: Uint32Array;
  private closedGen: Uint32Array;
  private gen = 0;
  private heapKeys: Float64Array;
  private heapVals: Int32Array;
  private heapSize = 0;

  constructor(map: MapDef, fixtures: FixtureDef[]) {
    this.W = map.width;
    this.H = map.height;
    this.floors = map.floors;
    this.floorCells = this.W * this.H;
    this.totalCells = this.floorCells * this.floors;
    this.walkable = new Uint8Array(this.totalCells);
    this.roomIdx = new Int16Array(this.totalCells).fill(-1);
    this.doorIdx = new Int16Array(this.totalCells).fill(-1);
    this.portalAt = new Int16Array(this.totalCells).fill(-1);
    this.fixtureAt = new Int16Array(this.totalCells).fill(-1);
    this.roomIds = map.rooms.map((r) => r.id);
    map.rooms.forEach((r, i) => (this.roomIndex[r.id] = i));
    this.doors = map.doors;
    this.doorIds = map.doors.map((d) => d.id);
    map.doors.forEach((d, i) => (this.doorIndex[d.id] = i));
    this.portals = map.portals;
    map.portals.forEach((p, i) => (this.portalIndex[p.id] = i));
    this.windows = map.windows;
    this.fixtures = fixtures;
    fixtures.forEach((f, i) => (this.fixtureIndex[f.id] = i));

    // Rooms
    map.rooms.forEach((room, ri) => {
      for (const rect of room.rects) {
        for (let y = rect.y0; y <= rect.y1; y++) {
          for (let x = rect.x0; x <= rect.x1; x++) {
            const c = this.cell(room.floor, x, y);
            if (this.roomIdx[c] !== -1 && this.roomIdx[c] !== ri) {
              throw new Error(`Rooms overlap at floor ${room.floor} (${x},${y}): ${this.roomIds[this.roomIdx[c]!]} and ${room.id}`);
            }
            this.roomIdx[c] = ri;
            this.walkable[c] = 1;
          }
        }
      }
    });
    // Doors
    map.doors.forEach((door, di) => {
      const cells: number[] = [];
      for (const t of door.tiles) {
        const c = this.cell(door.floor, t.x, t.y);
        if (this.roomIdx[c] !== -1) {
          throw new Error(`Door ${door.id} tile (${t.x},${t.y}) lies inside room ${this.roomIds[this.roomIdx[c]!]}`);
        }
        this.doorIdx[c] = di;
        this.walkable[c] = 1;
        cells.push(c);
      }
      this.doorCells.push(cells);
      const a = this.roomIndex[door.between[0]];
      const b = this.roomIndex[door.between[1]];
      if (a === undefined || b === undefined) throw new Error(`Door ${door.id} references unknown room`);
      this.links.push({ a, b, kind: door.kind, door: di });
    });
    // Portals
    map.portals.forEach((p, pi) => {
      const a = this.cell(p.a.floor, p.a.x, p.a.y);
      const b = this.cell(p.b.floor, p.b.x, p.b.y);
      if (!this.walkable[a] || !this.walkable[b]) throw new Error(`Portal ${p.id} endpoint is not walkable`);
      this.portalAt[a] = pi;
      this.portalAt[b] = pi;
      this.portalCells.push({ a, b });
      const ra = this.roomIndex[p.roomA];
      const rb = this.roomIndex[p.roomB];
      if (ra === undefined || rb === undefined) throw new Error(`Portal ${p.id} references unknown room`);
      this.links.push({ a: ra, b: rb, kind: 'portal', portal: pi });
    });
    // Thin walls and windows
    for (const tw of map.thinWalls) {
      const a = this.roomIndex[tw.rooms[0]];
      const b = this.roomIndex[tw.rooms[1]];
      if (a === undefined || b === undefined) throw new Error(`Thin wall references unknown room`);
      this.links.push({ a, b, kind: 'thinwall' });
    }
    map.windows.forEach((win, wi) => {
      const a = this.roomIndex[win.insideRoom];
      const b = this.roomIndex[win.outsideRoom];
      if (a === undefined || b === undefined) throw new Error(`Window ${win.id} references unknown room`);
      this.links.push({ a, b, kind: 'window', window: wi });
    });
    // Fixtures
    fixtures.forEach((f, fi) => {
      const room = map.rooms[this.roomIndex[f.room]!];
      if (!room) throw new Error(`Fixture ${f.id} references unknown room ${f.room}`);
      for (const t of f.tiles) {
        const c = this.cell(room.floor, t.x, t.y);
        if (this.roomIdx[c] !== this.roomIndex[f.room]) {
          throw new Error(`Fixture ${f.id} tile (${t.x},${t.y}) is not inside room ${f.room}`);
        }
        this.fixtureAt[c] = fi;
        if (f.blocking) this.walkable[c] = 0;
      }
      const at = this.cell(room.floor, f.at.x, f.at.y);
      if (!this.walkable[at]) throw new Error(`Fixture ${f.id} approach tile (${f.at.x},${f.at.y}) is not walkable`);
    });
    this.validateRoomSeparation();
    for (let i = 0; i < this.roomIds.length; i++) {
      const row: RoomLink[][] = [];
      for (let j = 0; j < this.roomIds.length; j++) row.push([]);
      this.linkTable.push(row);
    }
    for (const l of this.links) {
      this.linkTable[l.a]![l.b]!.push(l);
      if (l.a !== l.b) this.linkTable[l.b]![l.a]!.push(l);
    }

    this.gScore = new Float64Array(this.totalCells);
    this.cameFrom = new Int32Array(this.totalCells);
    this.seenGen = new Uint32Array(this.totalCells);
    this.closedGen = new Uint32Array(this.totalCells);
    this.heapKeys = new Float64Array(this.totalCells * 2);
    this.heapVals = new Int32Array(this.totalCells * 2);
  }

  /** Every room must be separated from other rooms by at least a wall tile or a door. */
  private validateRoomSeparation(): void {
    for (let f = 0; f < this.floors; f++) {
      for (let y = 0; y < this.H; y++) {
        for (let x = 0; x < this.W; x++) {
          const c = this.cell(f, x, y);
          const r = this.roomIdx[c]!;
          if (r < 0) continue;
          if (x + 1 < this.W) {
            const r2 = this.roomIdx[c + 1]!;
            if (r2 >= 0 && r2 !== r) throw new Error(`Rooms ${this.roomIds[r]} and ${this.roomIds[r2]} touch at floor ${f} (${x},${y})`);
          }
          if (y + 1 < this.H) {
            const r2 = this.roomIdx[c + this.W]!;
            if (r2 >= 0 && r2 !== r) throw new Error(`Rooms ${this.roomIds[r]} and ${this.roomIds[r2]} touch at floor ${f} (${x},${y})`);
          }
        }
      }
    }
  }

  cell(floor: number, x: number, y: number): number {
    return floor * this.floorCells + y * this.W + x;
  }

  cellOf(p: TilePos): number {
    return this.cell(p.floor, p.x, p.y);
  }

  floorOf(c: number): number {
    return Math.floor(c / this.floorCells);
  }

  xOf(c: number): number {
    return (c % this.floorCells) % this.W;
  }

  yOf(c: number): number {
    return Math.floor((c % this.floorCells) / this.W);
  }

  posOf(c: number): TilePos {
    return { floor: this.floorOf(c), x: this.xOf(c), y: this.yOf(c) };
  }

  roomOfCell(c: number): RoomId | undefined {
    const r = this.roomIdx[c]!;
    return r >= 0 ? this.roomIds[r] : undefined;
  }

  roomMask(ids: readonly RoomId[] | undefined): number {
    let m = 0;
    if (!ids) return 0;
    for (const id of ids) {
      const i = this.roomIndex[id];
      if (i === undefined) throw new Error(`Unknown room ${id}`);
      m |= 1 << i;
    }
    return m;
  }

  portalMask(ids: readonly string[] | undefined): number {
    let m = 0;
    if (!ids) return 0;
    for (const id of ids) {
      const i = this.portalIndex[id];
      if (i === undefined) throw new Error(`Unknown portal ${id}`);
      m |= 1 << i;
    }
    return m;
  }

  /** Manhattan distance between two cells on the same floor; large when floors differ. */
  dist(a: number, b: number): number {
    if (this.floorOf(a) !== this.floorOf(b)) return 1000;
    return Math.abs(this.xOf(a) - this.xOf(b)) + Math.abs(this.yOf(a) - this.yOf(b));
  }

  chebyshev(a: number, b: number): number {
    if (this.floorOf(a) !== this.floorOf(b)) return 1000;
    return Math.max(Math.abs(this.xOf(a) - this.xOf(b)), Math.abs(this.yOf(a) - this.yOf(b)));
  }

  private heuristic(c: number, goal: number): number {
    if (this.floorOf(c) === this.floorOf(goal)) return this.dist(c, goal);
    let best = Infinity;
    for (const p of this.portalCells) {
      const near = this.floorOf(p.a) === this.floorOf(c) ? p.a : p.b;
      const far = near === p.a ? p.b : p.a;
      if (this.floorOf(far) !== this.floorOf(goal)) continue;
      const h = this.dist(c, near) + 1 + this.dist(far, goal);
      if (h < best) best = h;
    }
    return best === Infinity ? 0 : best;
  }

  private heapPush(key: number, val: number): void {
    let i = this.heapSize++;
    const keys = this.heapKeys;
    const vals = this.heapVals;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent]! <= key) break;
      keys[i] = keys[parent]!;
      vals[i] = vals[parent]!;
      i = parent;
    }
    keys[i] = key;
    vals[i] = val;
  }

  private heapPop(): number {
    const keys = this.heapKeys;
    const vals = this.heapVals;
    const top = vals[0]!;
    this.heapSize--;
    if (this.heapSize > 0) {
      const key = keys[this.heapSize]!;
      const val = vals[this.heapSize]!;
      let i = 0;
      const n = this.heapSize;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const child = r < n && keys[r]! < keys[l]! ? r : l;
        if (keys[child]! >= key) break;
        keys[i] = keys[child]!;
        vals[i] = vals[child]!;
        i = child;
      }
      keys[i] = key;
      vals[i] = val;
    }
    return top;
  }

  /**
   * A* from `from` to `to`. Returns the cells after `from` up to and including
   * `to`, or null when unreachable. The returned array is shared with the
   * cache: do not mutate it.
   */
  findPath(from: number, to: number, blockedDoors: number, avoidRooms: number, avoidPortals: number, costlyRooms = 0): number[] | null {
    if (from === to) return EMPTY_PATH;
    const key = `${from},${to},${blockedDoors},${avoidRooms},${avoidPortals},${costlyRooms}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const path = this.search(from, to, blockedDoors, avoidRooms, avoidPortals, costlyRooms);
    if (this.cache.size > 5000) this.cache.clear();
    this.cache.set(key, path);
    return path;
  }

  private passable(c: number, blockedDoors: number, avoidRooms: number, startRoom: number): boolean {
    if (!this.walkable[c]) return false;
    const d = this.doorIdx[c]!;
    if (d >= 0 && (blockedDoors & (1 << d)) !== 0) return false;
    const r = this.roomIdx[c]!;
    if (r >= 0 && r !== startRoom && (avoidRooms & (1 << r)) !== 0) return false;
    return true;
  }

  private search(from: number, to: number, blockedDoors: number, avoidRooms: number, avoidPortals: number, costlyRooms: number): number[] | null {
    if (!this.walkable[to]) return null;
    this.gen++;
    const gen = this.gen;
    const startRoom = this.roomIdx[from]!;
    this.heapSize = 0;
    this.gScore[from] = 0;
    this.cameFrom[from] = -1;
    this.seenGen[from] = gen;
    this.heapPush(this.heuristic(from, to), from);
    const W = this.W;
    const H = this.H;
    while (this.heapSize > 0) {
      const cur = this.heapPop();
      if (cur === to) {
        const out: number[] = [];
        let c = to;
        while (c !== from) {
          out.push(c);
          c = this.cameFrom[c]!;
        }
        out.reverse();
        return out;
      }
      if (this.closedGen[cur] === gen) continue;
      this.closedGen[cur] = gen;
      const g = this.gScore[cur]!;
      const x = this.xOf(cur);
      const y = this.yOf(cur);
      // 4-neighbours
      if (x > 0) this.relax(cur, cur - 1, g, to, gen, blockedDoors, avoidRooms, startRoom, costlyRooms);
      if (x < W - 1) this.relax(cur, cur + 1, g, to, gen, blockedDoors, avoidRooms, startRoom, costlyRooms);
      if (y > 0) this.relax(cur, cur - W, g, to, gen, blockedDoors, avoidRooms, startRoom, costlyRooms);
      if (y < H - 1) this.relax(cur, cur + W, g, to, gen, blockedDoors, avoidRooms, startRoom, costlyRooms);
      const p = this.portalAt[cur]!;
      if (p >= 0 && (avoidPortals & (1 << p)) === 0) {
        const pc = this.portalCells[p]!;
        const other = pc.a === cur ? pc.b : pc.a;
        this.relax(cur, other, g + 1, to, gen, blockedDoors, avoidRooms, startRoom, costlyRooms);
      }
    }
    return null;
  }

  private relax(cur: number, next: number, gBase: number, to: number, gen: number, blockedDoors: number, avoidRooms: number, startRoom: number, costlyRooms: number): void {
    if (this.closedGen[next] === gen) return;
    if (!this.passable(next, blockedDoors, avoidRooms, startRoom)) return;
    const r = this.roomIdx[next]!;
    const g = gBase + (r >= 0 && (costlyRooms & (1 << r)) !== 0 ? COSTLY_TILE : 1);
    if (this.seenGen[next] === gen && this.gScore[next]! <= g) return;
    this.seenGen[next] = gen;
    this.gScore[next] = g;
    this.cameFrom[next] = cur;
    this.heapPush(g + this.heuristic(next, to), next);
  }

  /** Walkable cells 4-adjacent to a cell (same floor). */
  neighbours(c: number, out: number[]): number[] {
    out.length = 0;
    const x = this.xOf(c);
    const y = this.yOf(c);
    if (x > 0 && this.walkable[c - 1]) out.push(c - 1);
    if (x < this.W - 1 && this.walkable[c + 1]) out.push(c + 1);
    if (y > 0 && this.walkable[c - this.W]) out.push(c - this.W);
    if (y < this.H - 1 && this.walkable[c + this.W]) out.push(c + this.W);
    return out;
  }

  clearCache(): void {
    this.cache.clear();
  }

  cacheSize(): number {
    return this.cache.size;
  }
}

const EMPTY_PATH: number[] = [];
/** Step cost inside a room the walker would rather not cross (service areas for guests). */
const COSTLY_TILE = 4;

export function buildNav(content: Content): Nav {
  return new Nav(content.map, content.fixtures);
}
