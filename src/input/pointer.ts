/**
 * One pointer-event code path for mouse, touch and pen: tap, long-press,
 * two-finger pinch, mouse wheel zoom, right-click look, and keyboard.
 */
export interface InputHandlers {
  onTap: (sx: number, sy: number) => void;
  onLongPress: (sx: number, sy: number) => void;
  onRightClick: (sx: number, sy: number) => void;
  onZoom: (factor: number, sx: number, sy: number) => void;
  onKey: (key: string, down: boolean, e: KeyboardEvent) => void;
}

interface Pointer {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  startTime: number;
}

const TAP_MOVE = 10;
const TAP_TIME = 400;
const LONG_PRESS = 480;

export class InputController {
  private pointers = new Map<number, Pointer>();
  private longPressTimer: number | undefined;
  private pinchStart = 0;
  private suppressTap = false;
  private rect = { left: 0, top: 0 };
  readonly held = new Set<string>();

  constructor(private canvas: HTMLCanvasElement, private handlers: InputHandlers) {
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onContext);
    canvas.addEventListener('dblclick', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.held.clear());
  }

  private local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    this.rect.left = r.left;
    this.rect.top = r.top;
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private clearLongPress(): void {
    if (this.longPressTimer !== undefined) {
      window.clearTimeout(this.longPressTimer);
      this.longPressTimer = undefined;
    }
  }

  private onDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.local(e);
    this.pointers.set(e.pointerId, { id: e.pointerId, x: p.x, y: p.y, startX: p.x, startY: p.y, startTime: performance.now() });
    this.clearLongPress();
    if (this.pointers.size === 1) {
      this.suppressTap = false;
      if (e.button === 2) return;
      this.longPressTimer = window.setTimeout(() => {
        this.longPressTimer = undefined;
        const cur = this.pointers.get(e.pointerId);
        if (!cur || this.pointers.size !== 1) return;
        if (Math.hypot(cur.x - cur.startX, cur.y - cur.startY) > TAP_MOVE) return;
        this.suppressTap = true;
        this.handlers.onLongPress(cur.x, cur.y);
      }, LONG_PRESS);
    } else if (this.pointers.size === 2) {
      this.suppressTap = true;
      const [a, b] = Array.from(this.pointers.values());
      this.pinchStart = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    }
  };

  private onMove = (e: PointerEvent): void => {
    const cur = this.pointers.get(e.pointerId);
    if (!cur) return;
    const p = this.local(e);
    cur.x = p.x;
    cur.y = p.y;
    if (this.pointers.size === 2) {
      const [a, b] = Array.from(this.pointers.values());
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (this.pinchStart > 0 && d > 0) {
        const factor = d / this.pinchStart;
        if (Math.abs(factor - 1) > 0.02) {
          this.handlers.onZoom(factor, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
          this.pinchStart = d;
        }
      }
    } else if (Math.hypot(cur.x - cur.startX, cur.y - cur.startY) > TAP_MOVE) {
      this.clearLongPress();
    }
  };

  private onUp = (e: PointerEvent): void => {
    const cur = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    this.clearLongPress();
    if (!cur) return;
    if (e.button === 2) {
      this.handlers.onRightClick(cur.x, cur.y);
      return;
    }
    if (this.suppressTap || this.pointers.size > 0) {
      if (this.pointers.size === 0) this.suppressTap = false;
      return;
    }
    const dt = performance.now() - cur.startTime;
    const moved = Math.hypot(cur.x - cur.startX, cur.y - cur.startY);
    if (dt <= TAP_TIME * 2 && moved <= TAP_MOVE) this.handlers.onTap(cur.x, cur.y);
  };

  private onCancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    this.clearLongPress();
    if (this.pointers.size === 0) this.suppressTap = false;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const p = this.local(e);
    const factor = Math.exp(-e.deltaY * 0.0015);
    this.handlers.onZoom(factor, p.x, p.y);
  };

  private onContext = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    this.held.add(e.key.toLowerCase());
    this.handlers.onKey(e.key, true, e);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.key.toLowerCase());
    this.handlers.onKey(e.key, false, e);
  };

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onCancel);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('contextmenu', this.onContext);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
