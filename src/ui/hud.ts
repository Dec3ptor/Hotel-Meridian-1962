/**
 * The HUD: clock and loop number, notebook and pause buttons, inventory
 * tray, wait button, toasts and speech captions. A DOM overlay over the
 * canvas; it only raises handler callbacks.
 */
export interface HudHandlers {
  onNotebook: () => void;
  onPause: () => void;
  onWait: () => void;
  onSlotSelect: (index: number | undefined) => void;
  onDrop: (itemId: string, clientX: number, clientY: number) => void;
  onShowInteractables: (pressed: boolean) => void;
}

export interface TrayItem {
  id: string;
  name: string;
}

interface Caption {
  el: HTMLDivElement;
  agent: string;
  until: number;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export class Hud {
  readonly root: HTMLElement;
  private clock: HTMLDivElement;
  private loopEl: HTMLElement;
  private speed: HTMLDivElement;
  private tray: HTMLDivElement;
  private slots: HTMLDivElement[] = [];
  private items: TrayItem[] = [];
  private selected: number | undefined;
  private toasts: HTMLDivElement;
  private captionsRoot: HTMLDivElement;
  private captions: Caption[] = [];
  private ghost: HTMLDivElement | undefined;
  private collapsed = false;
  readonly buttons: { notebook: HTMLButtonElement; pause: HTMLButtonElement; wait: HTMLButtonElement; show: HTMLButtonElement };

  constructor(parent: HTMLElement, private handlers: HudHandlers) {
    this.root = el('div', 'hud');
    parent.appendChild(this.root);
    this.clock = el('div', 'hud-clock');
    this.clock.innerHTML = '<span class="time">10:00 PM</span><small class="loop">NIGHT 1</small>';
    this.loopEl = this.clock.querySelector('.loop')!;
    this.speed = el('div', 'hud-speed', '');
    const topRight = el('div', 'hud-topright');
    const notebook = el('button', '', 'Notebook');
    notebook.title = 'Notebook (N)';
    notebook.addEventListener('click', () => this.handlers.onNotebook());
    const pause = el('button', '', 'II');
    pause.title = 'Pause (Esc)';
    pause.addEventListener('click', () => this.handlers.onPause());
    topRight.append(notebook, pause);
    const bottomRight = el('div', 'hud-bottomright');
    const wait = el('button', '', 'Wait');
    wait.title = 'Wait (T)';
    wait.addEventListener('click', () => this.handlers.onWait());
    bottomRight.append(wait);
    const bottomLeft = el('div', 'hud-bottomleft');
    const show = el('button', '', 'Show');
    show.title = 'Hold to highlight everything you can use';
    const press = (e: PointerEvent) => {
      e.preventDefault();
      show.setPointerCapture(e.pointerId);
      this.handlers.onShowInteractables(true);
    };
    const release = () => this.handlers.onShowInteractables(false);
    show.addEventListener('pointerdown', press);
    show.addEventListener('pointerup', release);
    show.addEventListener('pointercancel', release);
    show.addEventListener('lostpointercapture', release);
    bottomLeft.append(show);
    this.tray = el('div', 'tray');
    const grip = el('div', 'grip');
    this.tray.appendChild(grip);
    for (let i = 0; i < 8; i++) {
      const slot = el('div', 'slot empty');
      slot.dataset.index = String(i);
      slot.addEventListener('pointerdown', (e) => this.slotPointerDown(e, i));
      this.tray.appendChild(slot);
      this.slots.push(slot);
    }
    // Swipe up on the tray expands it, swipe down collapses it.
    let swipeY = 0;
    grip.addEventListener('pointerdown', (e) => {
      swipeY = e.clientY;
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener('pointerup', (e) => {
      const dy = e.clientY - swipeY;
      if (dy < -12) this.setCollapsed(false);
      else if (dy > 12) this.setCollapsed(true);
      else this.setCollapsed(!this.collapsed);
    });
    this.toasts = el('div', 'toasts');
    this.captionsRoot = el('div', 'captions');
    this.root.append(this.captionsRoot, this.clock, this.speed, topRight, bottomRight, bottomLeft, this.tray, this.toasts);
    this.buttons = { notebook, pause, wait, show };
  }

  setCollapsed(on: boolean): void {
    this.collapsed = on;
    this.tray.classList.toggle('collapsed', on);
  }

  setClock(text: string, loop: number): void {
    const time = this.clock.querySelector('.time')!;
    if (time.textContent !== text) time.textContent = text;
    const loopText = `NIGHT ${loop}`;
    if (this.loopEl.textContent !== loopText) this.loopEl.textContent = loopText;
  }

  setSpeed(text: string): void {
    if (this.speed.textContent !== text) this.speed.textContent = text;
  }

  setInventory(items: TrayItem[]): void {
    this.items = items.slice(0, 8);
    for (let i = 0; i < 8; i++) {
      const slot = this.slots[i]!;
      const it = this.items[i];
      slot.textContent = it ? it.name : '';
      slot.classList.toggle('empty', !it);
      slot.title = it ? `${it.name} (${i + 1})` : '';
    }
    if (this.selected !== undefined && !this.items[this.selected]) this.setSelectedSlot(undefined);
  }

  setSelectedSlot(index: number | undefined): void {
    this.selected = index !== undefined && this.items[index] ? index : undefined;
    for (let i = 0; i < 8; i++) this.slots[i]!.classList.toggle('selected', i === this.selected);
    this.handlers.onSlotSelect(this.selected);
  }

  get selectedItem(): TrayItem | undefined {
    return this.selected === undefined ? undefined : this.items[this.selected];
  }

  private slotPointerDown(e: PointerEvent, index: number): void {
    const it = this.items[index];
    if (!it) return;
    e.preventDefault();
    const slot = this.slots[index]!;
    slot.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 10) {
        dragging = true;
        this.ghost = el('div', 'drag-ghost', it.name);
        document.body.appendChild(this.ghost);
      }
      if (this.ghost) {
        this.ghost.style.left = `${ev.clientX}px`;
        this.ghost.style.top = `${ev.clientY}px`;
      }
    };
    const up = (ev: PointerEvent) => {
      slot.removeEventListener('pointermove', move);
      slot.removeEventListener('pointerup', up);
      slot.removeEventListener('pointercancel', up);
      if (this.ghost) {
        this.ghost.remove();
        this.ghost = undefined;
      }
      if (dragging) {
        if (ev.type === 'pointerup') this.handlers.onDrop(it.id, ev.clientX, ev.clientY);
      } else {
        this.setSelectedSlot(this.selected === index ? undefined : index);
      }
    };
    slot.addEventListener('pointermove', move);
    slot.addEventListener('pointerup', up);
    slot.addEventListener('pointercancel', up);
  }

  toast(text: string, kind: 'info' | 'clue' | 'fail' = 'info', ms = 3600): void {
    const t = el('div', `toast ${kind}`, text);
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    window.setTimeout(() => t.remove(), ms);
  }

  /** A speech caption above a character; positioned each frame by `updateCaptions`. */
  caption(agent: string, speaker: string, text: string, accent: string, nowMs: number): void {
    // One caption per speaker: replace.
    const existing = this.captions.find((c) => c.agent === agent);
    if (existing) existing.el.remove();
    this.captions = this.captions.filter((c) => c.agent !== agent);
    const c = el('div', 'caption');
    const b = el('b', '', speaker);
    b.style.color = accent;
    c.append(b, document.createTextNode(text.length > 140 ? `${text.slice(0, 137)}...` : text));
    this.captionsRoot.appendChild(c);
    const ttl = 2200 + Math.min(5000, text.length * 45);
    this.captions.push({ el: c, agent, until: nowMs + ttl });
    while (this.captions.length > 6) this.captions.shift()!.el.remove();
  }

  updateCaptions(project: (agent: string) => { x: number; y: number } | undefined, nowMs: number): void {
    for (let i = this.captions.length - 1; i >= 0; i--) {
      const c = this.captions[i]!;
      if (nowMs > c.until) {
        c.el.remove();
        this.captions.splice(i, 1);
        continue;
      }
      const p = project(c.agent);
      if (!p) {
        c.el.style.display = 'none';
        continue;
      }
      c.el.style.display = '';
      c.el.style.left = `${Math.round(p.x)}px`;
      c.el.style.top = `${Math.round(p.y - 22)}px`;
    }
  }

  clearCaptions(): void {
    for (const c of this.captions) c.el.remove();
    this.captions.length = 0;
  }
}
