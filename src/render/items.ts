/**
 * Items as small procedural glyphs. Carried items are not drawn; items in
 * closed containers are not drawn; everything else sits on its tile or on
 * top of its fixture.
 */
import { Container, Graphics } from 'pixi.js';
import type { Static } from '../sim/registry';
import type { World } from '../sim/types';
import { C, ITEM_LOOKS } from './palette';

export class ItemSprite {
  readonly container = new Container();
  private glyph = new Graphics();
  private outline = new Graphics();

  constructor(readonly id: string) {
    this.build();
    this.container.addChild(this.glyph, this.outline);
  }

  private build(): void {
    const look = ITEM_LOOKS[this.id] ?? { kind: 'small' as const };
    const g = this.glyph;
    const color = look.color;
    switch (look.kind) {
      case 'key':
        g.circle(-4, 0, 3).stroke({ width: 2, color: color ?? C.brass });
        g.rect(-1, -1, 8, 2).fill(color ?? C.brass);
        g.rect(5, 0, 2, 3).fill(color ?? C.brass);
        break;
      case 'bottle':
        g.roundRect(-3, -6, 6, 12, 2).fill(color ?? 0x7a4a1e);
        g.rect(-2, -8, 4, 3).fill({ color: C.cream, alpha: 0.9 });
        break;
      case 'paper':
        g.rect(-5, -6, 10, 12).fill(color ?? C.paper);
        g.rect(-3, -3, 6, 1).fill({ color: C.ink, alpha: 0.5 });
        g.rect(-3, 0, 6, 1).fill({ color: C.ink, alpha: 0.5 });
        break;
      case 'knife':
        g.poly([-7, 2, 4, -4, 7, -2, -4, 5]).fill(C.metal);
        g.rect(-8, 2, 4, 3).fill(0x3a2a1a);
        break;
      case 'tray':
        g.ellipse(0, 0, 9, 6).fill(0xb8b8b8);
        g.circle(-3, -1, 2.5).fill({ color: 0xc08a3a, alpha: 0.95 });
        g.circle(3, 0, 2).fill({ color: C.glass, alpha: 0.9 });
        break;
      case 'camera':
        g.roundRect(-6, -4, 12, 8, 2).fill(0x1a1a1a);
        g.circle(1, 0, 2.5).fill(C.glass);
        break;
      case 'envelope':
        g.rect(-6, -4, 12, 8).fill(color ?? C.paper);
        g.poly([-6, -4, 0, 1, 6, -4]).stroke({ width: 1, color: C.ink, alpha: 0.6 });
        break;
      case 'money':
        g.rect(-6, -3, 12, 6).fill(0x5f8a5f);
        g.rect(-4, -2, 8, 4).stroke({ width: 1, color: C.cream, alpha: 0.6 });
        break;
      case 'film':
        g.roundRect(-3, -5, 6, 10, 2).fill(C.brass);
        break;
      case 'towel':
        g.roundRect(-6, -4, 12, 8, 2).fill(C.cream);
        g.rect(-6, -1, 12, 2).fill({ color: C.teal, alpha: 0.6 });
        break;
      case 'gun':
        g.rect(-6, -2, 10, 3).fill(0x2a2a2a);
        g.rect(-4, 0, 3, 5).fill(0x3a2a1a);
        break;
      case 'book':
        g.rect(-5, -6, 10, 12).fill(color ?? C.oxblood);
        g.rect(-5, -6, 2, 12).fill({ color: C.ink, alpha: 0.5 });
        break;
      case 'bell':
        g.circle(0, -1, 4).fill(C.brass);
        g.rect(-5, 3, 10, 2).fill(C.brass);
        break;
      case 'case':
        g.roundRect(-8, -5, 16, 10, 2).fill(0x5a3b1e);
        g.rect(-3, -7, 6, 3).fill(C.brass);
        break;
      case 'photo':
        g.rect(-5, -5, 10, 10).fill(C.paper);
        g.rect(-3, -3, 6, 6).fill({ color: 0x8a7a6a, alpha: 0.9 });
        break;
      default:
        g.circle(0, 0, 3).fill(color ?? C.brass);
        break;
    }
    this.outline.circle(0, 0, 11).stroke({ width: 2, color: C.gold, alpha: 0.9 });
    this.outline.visible = false;
  }

  setHighlight(on: boolean): void {
    this.outline.visible = on;
  }
}

export interface ItemPlacement {
  x: number;
  y: number;
  floor: number;
}

/** Where an item is drawn, or undefined when it is carried or out of sight. */
export function itemPlacement(w: World, s: Static, id: string, out: ItemPlacement): ItemPlacement | undefined {
  const it = w.items[id];
  if (!it) return undefined;
  const tile = s.content.map.tileSize;
  const loc = it.loc;
  if (loc.kind === 'tile') {
    out.x = (loc.x + 0.5) * tile;
    out.y = (loc.y + 0.5) * tile;
    out.floor = loc.floor;
    return out;
  }
  if (loc.kind === 'fixture') {
    const f = s.fixtures[loc.fixture];
    if (!f) return undefined;
    const open = f.openContainer || w.fixtures[loc.fixture]?.state.open === true;
    if (!open) return undefined;
    const room = s.rooms[f.room]!;
    // Spread several items across the fixture's tiles.
    let index = 0;
    for (const other of s.itemIds) {
      if (other === id) break;
      const ol = w.items[other]!.loc;
      if (ol.kind === 'fixture' && ol.fixture === loc.fixture) index++;
    }
    const t = f.tiles[index % f.tiles.length]!;
    out.x = (t.x + 0.5) * tile + ((index % 2) * 8 - 4);
    out.y = (t.y + 0.5) * tile - 4 + (Math.floor(index / f.tiles.length) % 2) * 6;
    out.floor = room.floor;
    return out;
  }
  return undefined;
}
