/**
 * Characters as top-down figures: a shadow, shoulders, a head, a hat or
 * hair, and a facing mark. Every character reads by silhouette and colour.
 * Swap `build()` for a sprite sheet later without touching the scene.
 */
import { Container, Graphics } from 'pixi.js';
import type { CharacterId } from '../sim/types';
import { C, CHARACTER_LOOKS, type CharacterLook } from './palette';

export interface AgentPose {
  x: number; // world px
  y: number;
  facing: number; // 0 up, 1 right, 2 down, 3 left
  alive: boolean;
  drowsy: boolean;
  hidden: boolean;
  bloody: boolean;
  left: boolean;
  visible: boolean;
}

export type GlyphKind = 'fear' | 'anger' | 'suspicion' | 'drunk' | 'none';

const FACING_ANGLE = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

export class AgentSprite {
  readonly container = new Container();
  private body = new Container();
  private shadow = new Graphics();
  private figure = new Graphics();
  private facingMark = new Graphics();
  private glyph = new Graphics();
  private glyphKind: GlyphKind = 'none';
  private glyphUntil = 0;
  private outline = new Graphics();
  private look: CharacterLook;

  constructor(readonly id: CharacterId) {
    this.look = CHARACTER_LOOKS[id];
    this.build();
    this.container.addChild(this.shadow, this.body, this.outline, this.glyph);
    this.body.addChild(this.figure, this.facingMark);
  }

  private build(): void {
    const l = this.look;
    this.shadow.ellipse(0, 4, 13, 8).fill({ color: C.shadow, alpha: 0.35 });
    const g = this.figure;
    // Shoulders / coat.
    g.ellipse(0, 2, 12, 8).fill(l.coat);
    g.ellipse(0, 2, 12, 8).stroke({ width: 1, color: C.ink, alpha: 0.8 });
    // Collar trim.
    g.ellipse(0, -1, 6, 3).fill({ color: l.trim, alpha: 0.9 });
    // Head.
    g.circle(0, -2, 6).fill(l.skin);
    g.circle(0, -2, 6).stroke({ width: 1, color: C.ink, alpha: 0.6 });
    switch (l.hat) {
      case 'fedora':
        g.ellipse(0, -2, 9, 7).fill(l.hatColor);
        g.circle(0, -3, 5).fill({ color: l.hatColor + 0x111111 });
        g.rect(-6, -4, 12, 2).fill({ color: C.ink, alpha: 0.5 });
        break;
      case 'cap':
        g.circle(0, -2, 6.5).fill(l.hatColor);
        g.rect(-7, -1, 14, 3).fill({ color: l.hatColor, alpha: 0.9 });
        break;
      case 'bob':
        g.circle(0, -3, 7).fill(l.hatColor);
        g.circle(0, -1.5, 4.5).fill(l.skin);
        break;
      case 'slick':
        g.ellipse(0, -4, 6, 4.5).fill(l.hatColor);
        break;
      case 'ponytail':
        g.circle(0, -3, 6.5).fill(l.hatColor);
        g.circle(0, -1, 4.5).fill(l.skin);
        g.ellipse(0, 5, 3, 6).fill(l.hatColor);
        break;
      case 'bald':
        g.circle(0, -2, 6).fill(l.skin);
        g.ellipse(0, -0.5, 6.5, 3).fill({ color: l.hatColor, alpha: 0.8 });
        g.circle(0, -2, 4.5).fill(l.skin);
        break;
      case 'brim':
        g.ellipse(0, -2, 9, 6.5).fill(l.hatColor);
        g.circle(0, -2.5, 5).fill({ color: l.hatColor - 0x202020 });
        break;
    }
    this.facingMark.poly([10, 0, 15, -3, 15, 3]).fill({ color: C.cream, alpha: 0.8 });
    this.outline.circle(0, 0, 16).stroke({ width: 2, color: C.gold, alpha: 0.9 });
    this.outline.visible = false;
  }

  setHighlight(on: boolean): void {
    this.outline.visible = on;
  }

  showGlyph(kind: GlyphKind, untilMs: number): void {
    this.glyphKind = kind;
    this.glyphUntil = untilMs;
    const g = this.glyph;
    g.clear();
    switch (kind) {
      case 'fear':
        // sweat drop
        g.poly([0, -24, 4, -16, 0, -12, -4, -16]).fill({ color: 0x9fd3ff, alpha: 0.95 });
        break;
      case 'anger':
        g.rect(-7, -20, 14, 3).fill({ color: C.neon, alpha: 0.95 });
        g.rect(-7, -15, 14, 3).fill({ color: C.neon, alpha: 0.95 });
        break;
      case 'suspicion':
        g.circle(0, -20, 6).stroke({ width: 2, color: C.gold });
        g.rect(-1, -20, 2, 5).fill(C.gold);
        g.circle(0, -11, 1.5).fill(C.gold);
        break;
      case 'drunk':
        g.circle(-5, -20, 2.5).fill({ color: C.cream, alpha: 0.9 });
        g.circle(2, -24, 3).fill({ color: C.cream, alpha: 0.7 });
        g.circle(7, -17, 2).fill({ color: C.cream, alpha: 0.8 });
        break;
      default:
        break;
    }
  }

  update(p: AgentPose, nowMs: number): void {
    this.container.visible = p.visible && !p.hidden && !p.left;
    this.container.position.set(p.x, p.y);
    if (!p.alive) {
      this.body.rotation = Math.PI / 2;
      this.body.alpha = 0.75;
      this.facingMark.visible = false;
      this.figure.tint = 0x9a9a9a;
      this.shadow.alpha = 0.6;
    } else if (p.drowsy) {
      this.body.rotation = 0.5;
      this.body.alpha = 0.9;
      this.facingMark.visible = false;
      this.figure.tint = 0xffffff;
    } else {
      this.body.rotation = 0;
      this.body.alpha = 1;
      this.facingMark.visible = true;
      this.facingMark.rotation = FACING_ANGLE[p.facing] ?? 0;
      this.figure.tint = p.bloody ? 0xffb0a0 : 0xffffff;
    }
    if (this.glyphKind !== 'none' && nowMs > this.glyphUntil) {
      this.glyphKind = 'none';
      this.glyph.clear();
    }
  }
}
