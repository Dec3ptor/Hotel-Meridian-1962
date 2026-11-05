/**
 * Rain over the lot: a few hundred streak sprites in one container, moved
 * each frame and wrapped. Drawn above the darkness so it reads in the dark.
 */
import { Container, Graphics, Sprite, Texture, type Renderer } from 'pixi.js';
import type { Static } from '../sim/registry';
import { C } from './palette';

interface Drop {
  sprite: Sprite;
  x0: number;
  y0: number;
  w: number;
  h: number;
  speed: number;
}

export class Rain {
  readonly container = new Container();
  private drops: Drop[] = [];
  private tex: Texture;
  private seed = 11;
  enabled = true;

  constructor(renderer: Renderer, s: Static, count = 360) {
    const g = new Graphics();
    g.rect(0, 0, 2, 12).fill({ color: C.cream, alpha: 0.35 });
    this.tex = renderer.generateTexture({ target: g, resolution: 1 });
    g.destroy();
    const tile = s.content.map.tileSize;
    const lot = s.rooms.lot;
    const rects = lot ? lot.rects : [];
    if (rects.length === 0) return;
    const areas = rects.map((r) => (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1));
    const total = areas.reduce((a, b) => a + b, 0);
    for (let i = 0; i < count; i++) {
      // Pick a rect in proportion to its area.
      let pick = this.rnd() * total;
      let ri = 0;
      while (ri < rects.length - 1 && pick > areas[ri]!) {
        pick -= areas[ri]!;
        ri++;
      }
      const r = rects[ri]!;
      const x0 = r.x0 * tile;
      const y0 = r.y0 * tile;
      const w = (r.x1 - r.x0 + 1) * tile;
      const h = (r.y1 - r.y0 + 1) * tile;
      const sp = new Sprite(this.tex);
      sp.anchor.set(0.5);
      sp.rotation = 0.18;
      sp.position.set(x0 + this.rnd() * w, y0 + this.rnd() * h);
      sp.alpha = 0.3 + this.rnd() * 0.5;
      this.container.addChild(sp);
      this.drops.push({ sprite: sp, x0, y0, w, h, speed: 320 + this.rnd() * 260 });
    }
  }

  private rnd(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  update(dtMs: number, visible: boolean): void {
    this.container.visible = visible && this.enabled;
    if (!this.container.visible) return;
    const dt = Math.min(dtMs, 50) / 1000;
    for (const d of this.drops) {
      const sp = d.sprite;
      sp.y += d.speed * dt;
      sp.x += d.speed * 0.18 * dt;
      if (sp.y > d.y0 + d.h) {
        sp.y = d.y0;
        sp.x = d.x0 + Math.random() * d.w;
      }
      if (sp.x > d.x0 + d.w) sp.x = d.x0;
    }
  }
}
