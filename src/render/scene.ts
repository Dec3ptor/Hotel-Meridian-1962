/**
 * The PixiJS scene: one container per floor (baked floor texture, dimming,
 * items, doors, characters, cut-away walls), a screen-space darkness layer
 * with lamp light cut out, and rain over the lot. The scene only reads the
 * world; it never changes it.
 */
import { Application, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import type { Static } from '../sim/registry';
import type { AgentState, CharacterId, World } from '../sim/types';
import { AgentSprite, type AgentPose, type GlyphKind } from './agents';
import { Camera } from './camera';
import { ItemSprite, itemPlacement, type ItemPlacement } from './items';
import { Lighting } from './lighting';
import { C } from './palette';
import { Rain } from './rain';
import { buildFloorTexture, drawDim, drawWalls } from './static';

export type PickKind = 'agent' | 'item' | 'fixture' | 'door' | 'floor';

export interface PickResult {
  kind: PickKind;
  id: string;
  tile: { x: number; y: number; floor: number };
  sx: number;
  sy: number;
}

interface FloorLayer {
  floor: number;
  container: Container;
  floorSprite: Sprite;
  dim: Graphics;
  items: Container;
  doors: Graphics;
  agents: Container;
  walls: Graphics;
  highlights: Graphics;
  wallsFor: string | undefined;
  wallsDirty: boolean;
}

interface Snapshot {
  x: number;
  y: number;
  floor: number;
}

export class Scene {
  readonly app: Application;
  readonly camera = new Camera();
  readonly s: Static;
  readonly world = new Container();
  private layers: FloorLayer[] = [];
  private agentSprites = new Map<CharacterId, AgentSprite>();
  private itemSprites = new Map<string, ItemSprite>();
  private lighting: Lighting;
  private rain: Rain;
  private prev = new Map<CharacterId, Snapshot>();
  private placement: ItemPlacement = { x: 0, y: 0, floor: 0 };
  private tmp = { x: 0, y: 0 };
  private vacancy: Text;
  private highlightIds: Set<string> = new Set();
  private doorVersion = -1;
  currentFloor = 0;
  highContrast = false;

  private constructor(app: Application, s: Static) {
    this.app = app;
    this.s = s;
    const renderer = app.renderer;
    for (let floor = 0; floor < s.content.map.floors; floor++) {
      const container = new Container();
      const tex: Texture = buildFloorTexture(renderer, s, floor);
      const floorSprite = new Sprite(tex);
      const dim = new Graphics();
      const items = new Container();
      const doors = new Graphics();
      const agents = new Container();
      const walls = new Graphics();
      const highlights = new Graphics();
      container.addChild(floorSprite, dim, items, doors, agents, walls, highlights);
      this.world.addChild(container);
      this.layers.push({ floor, container, floorSprite, dim, items, doors, agents, walls, highlights, wallsFor: undefined, wallsDirty: true });
    }
    for (const id of s.characterOrder) {
      const sp = new AgentSprite(id);
      this.agentSprites.set(id, sp);
    }
    for (const id of s.itemIds) {
      const sp = new ItemSprite(id);
      this.itemSprites.set(id, sp);
    }
    this.vacancy = new Text({
      text: 'VACANCY',
      style: { fontFamily: 'Poiret One, Trebuchet MS, sans-serif', fontSize: 22, fill: C.neon, letterSpacing: 4 },
    });
    this.vacancy.anchor.set(0.5);
    const tile = s.content.map.tileSize;
    this.vacancy.position.set(11.5 * tile, 2.5 * tile);
    this.layers[0]!.container.addChild(this.vacancy);
    this.rain = new Rain(renderer, s);
    this.lighting = new Lighting(renderer, app.screen.width, app.screen.height);
    app.stage.addChild(this.world, this.lighting.sprite, this.rain.container);
    this.camera.setViewport(app.screen.width, app.screen.height);
  }

  static async create(parent: HTMLElement, s: Static): Promise<Scene> {
    const app = new Application();
    await app.init({
      background: C.ink,
      resizeTo: parent,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      antialias: true,
      preference: 'webgl',
      powerPreference: 'high-performance',
    });
    parent.appendChild(app.canvas);
    app.canvas.style.touchAction = 'none';
    const scene = new Scene(app, s);
    scene.camera.setZoom(app.screen.height / 520);
    app.renderer.on('resize', () => scene.onResize());
    return scene;
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  private onResize(): void {
    this.camera.setViewport(this.app.screen.width, this.app.screen.height);
    this.lighting.resize(this.app.renderer, this.app.screen.width, this.app.screen.height);
  }

  setReducedMotion(on: boolean): void {
    this.camera.reducedMotion = on;
    this.rain.enabled = !on;
  }

  setLightingEnabled(on: boolean): void {
    this.lighting.enabled = on;
  }

  flicker(ms: number): void {
    this.lighting.flicker(ms, performance.now());
  }

  setHighlights(ids: Iterable<string>): void {
    this.highlightIds = new Set(ids);
    for (const [id, sp] of this.agentSprites) sp.setHighlight(this.highlightIds.has(id));
    for (const [id, sp] of this.itemSprites) sp.setHighlight(this.highlightIds.has(id));
    for (const l of this.layers) l.wallsDirty = true;
  }

  showGlyph(id: CharacterId, kind: GlyphKind, ms = 2500): void {
    this.agentSprites.get(id)?.showGlyph(kind, performance.now() + ms);
  }

  /** Snapshot positions before a sim step so rendering can interpolate. */
  beforeStep(w: World): void {
    for (const id of this.s.characterOrder) {
      const a = w.agents[id]!;
      let snap = this.prev.get(id);
      if (!snap) {
        snap = { x: 0, y: 0, floor: 0 };
        this.prev.set(id, snap);
      }
      snap.x = a.pos.x;
      snap.y = a.pos.y;
      snap.floor = a.pos.floor;
    }
  }

  /** Forget interpolation history (new loop). */
  resetHistory(w: World): void {
    this.prev.clear();
    this.beforeStep(w);
    const tile = this.s.content.map.tileSize;
    const p = w.agents.player!;
    this.camera.snapTo((p.pos.x + 0.5) * tile, (p.pos.y + 0.5) * tile);
    for (const l of this.layers) l.wallsDirty = true;
  }

  recentre(w: World): void {
    const tile = this.s.content.map.tileSize;
    const p = w.agents.player!;
    this.camera.snapTo((p.pos.x + 0.5) * tile, (p.pos.y + 0.5) * tile);
  }

  private drawDoors(layer: FloorLayer, w: World): void {
    const g = layer.doors;
    g.clear();
    const tile = this.s.content.map.tileSize;
    for (const d of this.s.content.map.doors) {
      if (d.floor !== layer.floor) continue;
      const st = w.doors[d.id]!;
      for (const t of d.tiles) {
        const x = t.x * tile;
        const y = t.y * tile;
        if (d.kind === 'archway') {
          g.rect(x, y, 3, tile).fill({ color: C.gold, alpha: 0.5 });
          g.rect(x + tile - 3, y, 3, tile).fill({ color: C.gold, alpha: 0.5 });
          continue;
        }
        // Which way does the door run? Walls on left/right mean a vertical gap: draw the leaf across it.
        const nav = this.s.nav;
        const c = nav.cell(layer.floor, t.x, t.y);
        const horizontalGap = t.x > 0 && nav.walkable[c - 1] === 0 && t.x < nav.W - 1 && nav.walkable[c + 1] === 0;
        g.rect(x, y, tile, tile).fill({ color: C.plaster, alpha: 0.25 });
        if (st.open) {
          if (horizontalGap) g.rect(x + 2, y + 2, 4, tile - 4).fill(0x5a3b1e);
          else g.rect(x + 2, y + 2, tile - 4, 4).fill(0x5a3b1e);
        } else if (horizontalGap) {
          g.rect(x + 4, y + tile / 2 - 3, tile - 8, 6).fill(0x5a3b1e);
        } else {
          g.rect(x + tile / 2 - 3, y + 4, 6, tile - 8).fill(0x5a3b1e);
        }
        if (st.locked) g.circle(x + tile / 2, y + tile / 2, 3).fill(C.neon);
      }
    }
  }

  private drawHighlights(layer: FloorLayer, w: World): void {
    const g = layer.highlights;
    g.clear();
    if (this.highlightIds.size === 0) return;
    const tile = this.s.content.map.tileSize;
    for (const f of this.s.content.fixtures) {
      if (!this.highlightIds.has(f.id)) continue;
      if (this.s.rooms[f.room]!.floor !== layer.floor) continue;
      for (const t of f.tiles) g.rect(t.x * tile + 2, t.y * tile + 2, tile - 4, tile - 4).stroke({ width: 2, color: C.gold, alpha: 0.9 });
    }
    for (const d of this.s.content.map.doors) {
      if (!this.highlightIds.has(d.id) || d.floor !== layer.floor) continue;
      for (const t of d.tiles) g.rect(t.x * tile + 2, t.y * tile + 2, tile - 4, tile - 4).stroke({ width: 2, color: C.gold, alpha: 0.9 });
    }
    void w;
  }

  render(w: World, alpha: number, dtMs: number, nowMs: number): void {
    const s = this.s;
    const tile = s.content.map.tileSize;
    const player = w.agents.player!;
    const floor = player.pos.floor;
    this.currentFloor = floor;
    const playerRoom = player.room;
    // Camera follows the interpolated player position.
    const pp = this.prev.get('player');
    const px = pp && pp.floor === floor ? pp.x + (player.pos.x - pp.x) * alpha : player.pos.x;
    const py = pp && pp.floor === floor ? pp.y + (player.pos.y - pp.y) * alpha : player.pos.y;
    this.camera.follow((px + 0.5) * tile, (py + 0.5) * tile, dtMs);
    this.camera.applyTo(this.world);

    for (const layer of this.layers) {
      const visible = layer.floor === floor;
      layer.container.visible = visible;
      if (!visible) continue;
      if (layer.wallsFor !== playerRoom || layer.wallsDirty) {
        drawWalls(layer.walls, s, layer.floor, playerRoom);
        drawDim(layer.dim, s, layer.floor, playerRoom);
        this.drawHighlights(layer, w);
        layer.wallsFor = playerRoom;
        layer.wallsDirty = false;
      }
      if (this.doorVersion !== w.doorVersion) this.drawDoors(layer, w);
      // Items.
      layer.items.removeChildren();
      for (const id of s.itemIds) {
        const pl = itemPlacement(w, s, id, this.placement);
        if (!pl || pl.floor !== layer.floor) continue;
        const sp = this.itemSprites.get(id)!;
        sp.container.position.set(pl.x, pl.y);
        layer.items.addChild(sp.container);
      }
      // Agents.
      layer.agents.removeChildren();
      for (const id of s.characterOrder) {
        const a = w.agents[id]!;
        const sp = this.agentSprites.get(id)!;
        const onFloor = a.pos.floor === layer.floor;
        if (!onFloor) continue;
        const prev = this.prev.get(id);
        const ix = prev && prev.floor === a.pos.floor ? prev.x + (a.pos.x - prev.x) * alpha : a.pos.x;
        const iy = prev && prev.floor === a.pos.floor ? prev.y + (a.pos.y - prev.y) * alpha : a.pos.y;
        const pose: AgentPose = {
          x: (ix + 0.5) * tile,
          y: (iy + 0.5) * tile,
          facing: a.facing,
          alive: a.alive,
          drowsy: a.incapacity === 'drowsy' || a.incapacity === 'asleep',
          hidden: !!a.hiddenIn && id !== 'player',
          bloody: a.flags.bloody === true,
          left: a.flags.left === true,
          visible: true,
        };
        sp.update(pose, nowMs);
        if (id === 'player' && a.hiddenIn) sp.container.alpha = 0.45;
        else sp.container.alpha = 1;
        layer.agents.addChild(sp.container);
      }
      layer.agents.children.sort((a, b) => a.position.y - b.position.y);
    }
    this.doorVersion = w.doorVersion;
    this.vacancy.alpha = 0.7 + 0.3 * Math.sin(nowMs / 400);
    this.rain.update(dtMs, floor === 0);
    this.rain.container.position.copyFrom(this.world.position);
    this.rain.container.scale.copyFrom(this.world.scale);
    this.lighting.update(this.app.renderer, this.camera, w, s, floor, nowMs);
  }

  /** Screen position of an agent, item, fixture or door on the current floor. */
  screenOf(w: World, kind: PickKind, id: string, out: { x: number; y: number }): { x: number; y: number } | undefined {
    const tile = this.s.content.map.tileSize;
    switch (kind) {
      case 'agent': {
        const a = w.agents[id as CharacterId];
        if (!a || a.pos.floor !== this.currentFloor) return undefined;
        return this.camera.worldToScreen((a.pos.x + 0.5) * tile, (a.pos.y + 0.5) * tile, out);
      }
      case 'item': {
        const pl = itemPlacement(w, this.s, id, this.placement);
        if (!pl || pl.floor !== this.currentFloor) return undefined;
        return this.camera.worldToScreen(pl.x, pl.y, out);
      }
      case 'fixture': {
        const f = this.s.fixtures[id];
        if (!f) return undefined;
        const room = this.s.rooms[f.room]!;
        if (room.floor !== this.currentFloor) return undefined;
        const t = f.tiles[0]!;
        return this.camera.worldToScreen((t.x + 0.5) * tile, (t.y + 0.5) * tile, out);
      }
      case 'door': {
        const d = this.s.doors[id];
        if (!d || d.floor !== this.currentFloor) return undefined;
        const t = d.tiles[0]!;
        return this.camera.worldToScreen((t.x + 0.5) * tile, (t.y + 0.5) * tile, out);
      }
      default:
        return undefined;
    }
  }

  /** What is under a screen point: a person, an item, a door, a fixture, or the floor. */
  pick(w: World, sx: number, sy: number): PickResult {
    const s = this.s;
    const tile = s.content.map.tileSize;
    const wp = this.camera.screenToWorld(sx, sy, this.tmp);
    const wx = wp.x;
    const wy = wp.y;
    const tx = Math.floor(wx / tile);
    const ty = Math.floor(wy / tile);
    const floor = this.currentFloor;
    const result: PickResult = { kind: 'floor', id: '', tile: { x: tx, y: ty, floor }, sx, sy };
    // People first (within 18 world px of the figure).
    let best = Infinity;
    for (const id of s.characterOrder) {
      const a: AgentState = w.agents[id]!;
      if (a.pos.floor !== floor || (a.hiddenIn && id !== 'player') || a.flags.left) continue;
      if (id === 'player') continue;
      const dx = (a.pos.x + 0.5) * tile - wx;
      const dy = (a.pos.y + 0.5) * tile - wy;
      const d = Math.hypot(dx, dy);
      if (d < 20 && d < best) {
        best = d;
        result.kind = 'agent';
        result.id = id;
      }
    }
    if (result.kind !== 'floor') return result;
    for (const id of s.itemIds) {
      const pl = itemPlacement(w, s, id, this.placement);
      if (!pl || pl.floor !== floor) continue;
      const d = Math.hypot(pl.x - wx, pl.y - wy);
      if (d < 14 && d < best) {
        best = d;
        result.kind = 'item';
        result.id = id;
      }
    }
    if (result.kind !== 'floor') return result;
    for (const d of s.content.map.doors) {
      if (d.floor !== floor) continue;
      for (const t of d.tiles) {
        if (t.x === tx && t.y === ty) {
          result.kind = 'door';
          result.id = d.id;
          return result;
        }
      }
    }
    for (const f of s.content.fixtures) {
      if (s.rooms[f.room]!.floor !== floor) continue;
      for (const t of f.tiles) {
        if (t.x === tx && t.y === ty) {
          result.kind = 'fixture';
          result.id = f.id;
          return result;
        }
      }
    }
    return result;
  }

  /** Everything interactable in a room (for the "show interactables" button). */
  interactablesIn(w: World, room: string): string[] {
    const out: string[] = [];
    for (const f of this.s.content.fixtures) if (f.room === room) out.push(f.id);
    for (const d of this.s.content.map.doors) if (d.between.includes(room)) out.push(d.id);
    for (const id of this.s.itemIds) {
      const pl = itemPlacement(w, this.s, id, this.placement);
      if (pl && this.s.nav.roomOfCell(this.s.nav.cell(pl.floor, Math.floor(pl.x / this.s.content.map.tileSize), Math.floor(pl.y / this.s.content.map.tileSize))) === room) out.push(id);
    }
    for (const id of this.s.characterOrder) if (id !== 'player' && w.agents[id]!.room === room) out.push(id);
    return out;
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
