/**
 * Darkness with lamp light cut out of it. One screen-sized render texture is
 * filled with near-black each frame; light sprites drawn with the erase
 * blend mode punch soft holes in it. No per-pixel shaders.
 */
import { Container, Graphics, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js';
import type { Static } from '../sim/registry';
import type { World } from '../sim/types';
import type { Camera } from './camera';
import { LAMPS, type LampDef } from './palette';

const LIGHT_TEX = 256;
const DARKNESS = 0.78;

function makeLightTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = LIGHT_TEX;
  canvas.height = LIGHT_TEX;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(LIGHT_TEX / 2, LIGHT_TEX / 2, 0, LIGHT_TEX / 2, LIGHT_TEX / 2, LIGHT_TEX / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.3)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, LIGHT_TEX, LIGHT_TEX);
  return Texture.from(canvas);
}

interface LightSprite {
  sprite: Sprite;
  lamp: LampDef;
  phase: number;
}

export class Lighting {
  readonly sprite: Sprite;
  private rt: RenderTexture;
  private scene = new Container();
  private dark = new Graphics();
  private lights = new Container();
  private lightTex: Texture;
  private lamps: LightSprite[] = [];
  private playerLight: Sprite;
  private width: number;
  private height: number;
  private flickerUntil = 0;
  private tmp = { x: 0, y: 0 };
  enabled = true;

  constructor(renderer: Renderer, width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.rt = RenderTexture.create({ width: this.width, height: this.height, resolution: Math.min(renderer.resolution, 1) });
    this.sprite = new Sprite(this.rt);
    this.lightTex = makeLightTexture();
    this.scene.addChild(this.dark, this.lights);
    for (const lamp of LAMPS) {
      const sp = new Sprite(this.lightTex);
      sp.anchor.set(0.5);
      sp.blendMode = 'erase';
      if (lamp.color !== undefined) sp.tint = lamp.color;
      this.lights.addChild(sp);
      this.lamps.push({ sprite: sp, lamp, phase: Math.random() * 6.28 });
    }
    this.playerLight = new Sprite(this.lightTex);
    this.playerLight.anchor.set(0.5);
    this.playerLight.blendMode = 'erase';
    this.playerLight.alpha = 0.55;
    this.lights.addChild(this.playerLight);
    void renderer;
  }

  resize(renderer: Renderer, width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.rt.destroy(true);
    this.rt = RenderTexture.create({ width: this.width, height: this.height, resolution: Math.min(renderer.resolution, 1) });
    this.sprite.texture = this.rt;
  }

  /** Storm flicker for a while (ms from now). */
  flicker(durationMs: number, nowMs: number): void {
    this.flickerUntil = nowMs + durationMs;
  }

  update(renderer: Renderer, camera: Camera, w: World, s: Static, floor: number, nowMs: number): void {
    if (!this.enabled) {
      this.sprite.visible = false;
      return;
    }
    this.sprite.visible = true;
    const tile = s.content.map.tileSize;
    const flickering = nowMs < this.flickerUntil;
    const storm = flickering ? 0.55 + 0.45 * Math.abs(Math.sin(nowMs / 37) * Math.cos(nowMs / 91)) : 1;
    this.dark.clear();
    this.dark.rect(0, 0, this.width, this.height).fill({ color: 0x05040a, alpha: DARKNESS });
    for (const l of this.lamps) {
      const room = s.rooms[l.lamp.room];
      const onFloor = room !== undefined && room.floor === floor;
      const lit = w.rooms[l.lamp.room]?.lit !== false;
      l.sprite.visible = onFloor && lit;
      if (!l.sprite.visible) continue;
      camera.worldToScreen(l.lamp.x * tile, l.lamp.y * tile, this.tmp);
      l.sprite.position.set(this.tmp.x, this.tmp.y);
      const px = l.lamp.radius * tile * camera.zoom * 2;
      l.sprite.width = px;
      l.sprite.height = px;
      const gentle = 0.94 + 0.06 * Math.sin(nowMs / 230 + l.phase);
      l.sprite.alpha = (l.lamp.strength ?? 1) * gentle * storm;
    }
    const p = w.agents.player;
    if (p && p.pos.floor === floor) {
      camera.worldToScreen((p.pos.x + 0.5) * tile, (p.pos.y + 0.5) * tile, this.tmp);
      this.playerLight.position.set(this.tmp.x, this.tmp.y);
      const px = 2.2 * tile * camera.zoom * 2;
      this.playerLight.width = px;
      this.playerLight.height = px;
      this.playerLight.visible = true;
    } else {
      this.playerLight.visible = false;
    }
    renderer.render({ container: this.scene, target: this.rt, clear: true });
  }
}
