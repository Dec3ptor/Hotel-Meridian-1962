/**
 * Static geometry: floors and furniture are drawn once per floor into a
 * texture. Walls and the dimming of other rooms are drawn into small
 * dynamic Graphics that are only redrawn when the player's room changes.
 */
import { Graphics, type Renderer, type Texture } from 'pixi.js';
import type { Static } from '../sim/registry';
import type { FixtureDef, RoomDef } from '../sim/types';
import { C, FIXTURE_LOOKS, ROOM_FLOORS, type FixtureKind } from './palette';

function roomsOnFloor(s: Static, floor: number): RoomDef[] {
  return s.content.map.rooms.filter((r) => r.floor === floor);
}

function drawFloor(g: Graphics, room: RoomDef, tile: number): void {
  const kind = ROOM_FLOORS[room.id] ?? 'carpet';
  for (const rect of room.rects) {
    const x = rect.x0 * tile;
    const y = rect.y0 * tile;
    const w = (rect.x1 - rect.x0 + 1) * tile;
    const h = (rect.y1 - rect.y0 + 1) * tile;
    switch (kind) {
      case 'carpet': {
        g.rect(x, y, w, h).fill(C.carpet);
        // Deco diamonds, every other tile.
        for (let ty = rect.y0; ty <= rect.y1; ty++) {
          for (let tx = rect.x0; tx <= rect.x1; tx++) {
            if ((tx + ty) % 2 !== 0) continue;
            const cx = tx * tile + tile / 2;
            const cy = ty * tile + tile / 2;
            g.poly([cx, cy - 6, cx + 6, cy, cx, cy + 6, cx - 6, cy]).fill({ color: C.carpetLight, alpha: 0.9 });
          }
        }
        g.rect(x, y, w, h).stroke({ width: 2, color: C.gold, alpha: 0.25, alignment: 1 });
        break;
      }
      case 'tile': {
        g.rect(x, y, w, h).fill(C.tile);
        for (let ty = rect.y0; ty <= rect.y1; ty++) {
          for (let tx = rect.x0; tx <= rect.x1; tx++) {
            if ((tx + ty) % 2 === 0) g.rect(tx * tile + 1, ty * tile + 1, tile - 2, tile - 2).fill({ color: C.tileLight, alpha: 0.8 });
          }
        }
        break;
      }
      case 'wood': {
        g.rect(x, y, w, h).fill(C.wood);
        for (let ty = rect.y0; ty <= rect.y1; ty++) {
          const yy = ty * tile;
          g.rect(x, yy + tile / 2 - 1, w, 2).fill({ color: C.woodLight, alpha: 0.6 });
          g.rect(x, yy + tile - 1, w, 1).fill({ color: C.ink, alpha: 0.5 });
        }
        break;
      }
      case 'asphalt': {
        g.rect(x, y, w, h).fill(C.asphalt);
        break;
      }
    }
  }
  if (kind === 'asphalt') {
    // Puddles and parking lines on the lot.
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (const rect of room.rects) {
      const count = Math.floor(((rect.x1 - rect.x0 + 1) * (rect.y1 - rect.y0 + 1)) / 18);
      for (let i = 0; i < count; i++) {
        const px = (rect.x0 + rnd() * (rect.x1 - rect.x0 + 1)) * tile;
        const py = (rect.y0 + rnd() * (rect.y1 - rect.y0 + 1)) * tile;
        g.ellipse(px, py, 10 + rnd() * 18, 5 + rnd() * 8).fill({ color: C.glass, alpha: 0.12 });
      }
    }
    for (let i = 0; i < 6; i++) g.rect((6 + i * 4) * tile, 23 * tile, 2, 3 * tile).fill({ color: C.cream, alpha: 0.12 });
  }
}

function drawFixture(g: Graphics, s: Static, f: FixtureDef, tile: number): void {
  const room = s.rooms[f.room]!;
  const look = FIXTURE_LOOKS[f.id] ?? { kind: 'table' as FixtureKind };
  const xs = f.tiles.map((t) => t.x);
  const ys = f.tiles.map((t) => t.y);
  const x0 = Math.min(...xs) * tile;
  const y0 = Math.min(...ys) * tile;
  const w = (Math.max(...xs) - Math.min(...xs) + 1) * tile;
  const h = (Math.max(...ys) - Math.min(...ys) + 1) * tile;
  const color = look.color ?? C.wood;
  void room;
  switch (look.kind) {
    case 'bed':
      g.roundRect(x0 + 2, y0 + 2, w - 4, h - 4, 4).fill(color);
      g.roundRect(x0 + 4, y0 + 4, Math.min(w, tile) - 8, h - 8, 3).fill({ color: C.cream, alpha: 0.8 });
      g.roundRect(x0 + 2, y0 + 2, w - 4, h - 4, 4).stroke({ width: 1, color: C.ink, alpha: 0.6 });
      break;
    case 'desk':
    case 'table':
      g.roundRect(x0 + 3, y0 + 3, w - 6, h - 6, 3).fill(color);
      g.roundRect(x0 + 5, y0 + 5, w - 10, h - 14, 2).fill({ color: C.woodLight, alpha: 0.5 });
      g.roundRect(x0 + 3, y0 + 3, w - 6, h - 6, 3).stroke({ width: 1, color: C.ink, alpha: 0.7 });
      break;
    case 'counter':
      g.rect(x0 + 2, y0 + 2, w - 4, h - 4).fill(color);
      g.rect(x0 + 2, y0 + 2, w - 4, 4).fill({ color: C.gold, alpha: 0.35 });
      g.rect(x0 + 2, y0 + 2, w - 4, h - 4).stroke({ width: 1, color: C.ink, alpha: 0.7 });
      break;
    case 'chair':
      g.roundRect(x0 + 5, y0 + 5, w - 10, h - 10, 5).fill(C.oxblood);
      g.roundRect(x0 + 5, y0 + 5, w - 10, 7, 3).fill({ color: C.ink, alpha: 0.35 });
      break;
    case 'piano':
      g.roundRect(x0 + 2, y0 + 2, w - 4, h - 4, 8).fill(0x101010);
      g.rect(x0 + 6, y0 + h - 10, w - 12, 4).fill(C.cream);
      g.roundRect(x0 + 2, y0 + 2, w - 4, h - 4, 8).stroke({ width: 1, color: C.gold, alpha: 0.5 });
      break;
    case 'car':
      g.roundRect(x0 + 2, y0 + 4, w - 4, h - 8, 8).fill(color);
      g.roundRect(x0 + w * 0.3, y0 + 6, w * 0.4, h - 12, 4).fill({ color: C.glass, alpha: 0.5 });
      g.circle(x0 + 6, y0 + h / 2, 2).fill({ color: C.cream, alpha: 0.8 });
      g.circle(x0 + w - 6, y0 + h / 2, 2).fill({ color: C.neon, alpha: 0.6 });
      g.roundRect(x0 + 2, y0 + 4, w - 4, h - 8, 8).stroke({ width: 1, color: 0x000000, alpha: 0.8 });
      break;
    case 'safe':
      g.rect(x0 + 3, y0 + 3, w - 6, h - 6).fill(0x2a2a2a);
      g.circle(x0 + w / 2, y0 + h / 2, 6).stroke({ width: 2, color: C.gold });
      g.rect(x0 + 3, y0 + 3, w - 6, h - 6).stroke({ width: 1, color: C.ink });
      break;
    case 'wallThing':
      g.rect(x0 + 4, y0 + 2, w - 8, 8).fill(color);
      g.rect(x0 + 4, y0 + 2, w - 8, 8).stroke({ width: 1, color: C.ink, alpha: 0.7 });
      break;
    case 'cart':
      g.roundRect(x0 + 3, y0 + 3, w - 6, h - 6, 6).fill(0x8a8f94);
      g.roundRect(x0 + 6, y0 + 6, w - 12, h - 12, 5).fill({ color: C.cream, alpha: 0.9 });
      break;
    case 'wardrobe':
      g.rect(x0 + 2, y0 + 2, w - 4, h - 4).fill(0x2e1d0f);
      g.rect(x0 + w / 2 - 1, y0 + 4, 2, h - 8).fill({ color: C.gold, alpha: 0.5 });
      g.rect(x0 + 2, y0 + 2, w - 4, h - 4).stroke({ width: 1, color: C.ink });
      break;
    case 'appliance':
      g.rect(x0 + 3, y0 + 3, w - 6, h - 6).fill(color);
      g.rect(x0 + 3, y0 + 3, w - 6, h - 6).stroke({ width: 1, color: C.ink, alpha: 0.7 });
      break;
    case 'bag':
      g.roundRect(x0 + 8, y0 + 10, w - 16, h - 16, 4).fill(color);
      g.rect(x0 + 12, y0 + 6, w - 24, 5).fill({ color: C.gold, alpha: 0.7 });
      break;
    case 'window':
      g.rect(x0 + 4, y0 + 2, w - 8, 6).fill({ color: C.glass, alpha: 0.6 });
      g.rect(x0 + 4, y0 + 2, w - 8, 6).stroke({ width: 1, color: C.cream, alpha: 0.6 });
      break;
    case 'wall':
      g.rect(x0 + 2, y0 + 2, w - 4, h - 4).fill({ color: C.plaster, alpha: 0.35 });
      break;
    case 'hatch':
      g.roundRect(x0 + 8, y0 + 4, w - 16, 10, 2).fill(C.brass);
      break;
    case 'chute':
      g.circle(x0 + w / 2, y0 + h / 2, 9).fill(0x1a1a1a);
      g.circle(x0 + w / 2, y0 + h / 2, 9).stroke({ width: 2, color: C.metal });
      break;
    case 'radio':
      g.roundRect(x0 + 8, y0 + 6, w - 16, h - 14, 3).fill(0x5a3b1e);
      g.circle(x0 + w / 2, y0 + h / 2, 3).fill(C.gold);
      break;
  }
}

/** Floors and furniture of one floor, baked into a texture. */
export function buildFloorTexture(renderer: Renderer, s: Static, floor: number): Texture {
  const tile = s.content.map.tileSize;
  const g = new Graphics();
  // A dark base so the texture covers the whole map (tiles outside rooms stay dark).
  g.rect(0, 0, s.content.map.width * tile, s.content.map.height * tile).fill(C.ink);
  for (const room of roomsOnFloor(s, floor)) drawFloor(g, room, tile);
  for (const f of s.content.fixtures) {
    if (s.rooms[f.room]!.floor !== floor) continue;
    drawFixture(g, s, f, tile);
  }
  const tex = renderer.generateTexture({ target: g, resolution: 1 });
  g.destroy();
  return tex;
}

interface WallTile {
  x: number;
  y: number;
  rooms: number[];
}

const wallCache = new Map<string, WallTile[]>();

/** Wall tiles: non-walkable tiles touching a room, with the rooms they border. */
export function wallTiles(s: Static, floor: number): WallTile[] {
  const key = `${floor}`;
  const hit = wallCache.get(key);
  if (hit) return hit;
  const nav = s.nav;
  const out: WallTile[] = [];
  for (let y = 0; y < nav.H; y++) {
    for (let x = 0; x < nav.W; x++) {
      const c = nav.cell(floor, x, y);
      if (nav.roomIdx[c] !== -1 || nav.doorIdx[c] !== -1) continue;
      const rooms: number[] = [];
      const check = (cc: number) => {
        const r = nav.roomIdx[cc]!;
        if (r >= 0 && !rooms.includes(r)) rooms.push(r);
      };
      if (x > 0) check(c - 1);
      if (x < nav.W - 1) check(c + 1);
      if (y > 0) check(c - nav.W);
      if (y < nav.H - 1) check(c + nav.W);
      // Diagonals count too, so corners close.
      if (x > 0 && y > 0) check(c - nav.W - 1);
      if (x < nav.W - 1 && y > 0) check(c - nav.W + 1);
      if (x > 0 && y < nav.H - 1) check(c + nav.W - 1);
      if (x < nav.W - 1 && y < nav.H - 1) check(c + nav.W + 1);
      if (rooms.length > 0) out.push({ x, y, rooms });
    }
  }
  wallCache.set(key, out);
  return out;
}

/** Walls, cut away around the current room. */
export function drawWalls(g: Graphics, s: Static, floor: number, currentRoom: string | undefined): void {
  g.clear();
  const tile = s.content.map.tileSize;
  const cur = currentRoom ? s.nav.roomIndex[currentRoom] : undefined;
  const lotIdx = s.nav.roomIndex.lot;
  for (const t of wallTiles(s, floor)) {
    const bordersCurrent = cur !== undefined && t.rooms.includes(cur);
    const outdoorOnly = t.rooms.length === 1 && t.rooms[0] === lotIdx;
    const x = t.x * tile;
    const y = t.y * tile;
    if (bordersCurrent) {
      // Cut away: a low wall you can see over.
      g.rect(x, y, tile, tile).fill({ color: 0x8a7a66, alpha: 0.22 });
      g.rect(x + 4, y + 4, tile - 8, tile - 8).fill({ color: C.plaster, alpha: 0.35 });
      g.rect(x, y, tile, tile).stroke({ width: 1, color: C.gold, alpha: 0.35 });
    } else {
      g.rect(x, y, tile, tile).fill(outdoorOnly ? 0x1b1a17 : 0x221d16);
      g.rect(x, y, tile, 4).fill({ color: C.wallTop, alpha: 0.9 });
      g.rect(x, y + tile - 2, tile, 2).fill({ color: 0x000000, alpha: 0.5 });
    }
  }
}

/** Dim every room on the floor except the current one. */
export function drawDim(g: Graphics, s: Static, floor: number, currentRoom: string | undefined): void {
  g.clear();
  const tile = s.content.map.tileSize;
  for (const room of roomsOnFloor(s, floor)) {
    if (room.id === currentRoom) continue;
    for (const r of room.rects) {
      g.rect(r.x0 * tile, r.y0 * tile, (r.x1 - r.x0 + 1) * tile, (r.y1 - r.y0 + 1) * tile).fill({ color: C.ink, alpha: room.outdoor ? 0.3 : 0.55 });
    }
  }
}
