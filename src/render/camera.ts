import type { Container } from 'pixi.js';

export const ZOOM_MIN = 0.75;
export const ZOOM_MAX = 1.5;

/** Top-down camera: a world point at the screen centre plus a zoom. */
export class Camera {
  cx = 0;
  cy = 0;
  zoom = 1;
  width = 1;
  height = 1;
  reducedMotion = false;

  setViewport(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  snapTo(x: number, y: number): void {
    this.cx = x;
    this.cy = y;
  }

  /** Ease toward a target; with reduced motion the camera snaps. */
  follow(x: number, y: number, dtMs: number): void {
    if (this.reducedMotion) {
      this.snapTo(x, y);
      return;
    }
    const k = 1 - Math.exp(-dtMs / 160);
    this.cx += (x - this.cx) * k;
    this.cy += (y - this.cy) * k;
    if (Math.abs(x - this.cx) < 0.05) this.cx = x;
    if (Math.abs(y - this.cy) < 0.05) this.cy = y;
  }

  setZoom(z: number): void {
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  }

  worldToScreen(wx: number, wy: number, out: { x: number; y: number }): { x: number; y: number } {
    out.x = this.width / 2 + (wx - this.cx) * this.zoom;
    out.y = this.height / 2 + (wy - this.cy) * this.zoom;
    return out;
  }

  screenToWorld(sx: number, sy: number, out: { x: number; y: number }): { x: number; y: number } {
    out.x = this.cx + (sx - this.width / 2) / this.zoom;
    out.y = this.cy + (sy - this.height / 2) / this.zoom;
    return out;
  }

  applyTo(container: Container): void {
    container.position.set(Math.round(this.width / 2 - this.cx * this.zoom), Math.round(this.height / 2 - this.cy * this.zoom));
    container.scale.set(this.zoom);
  }
}
