/**
 * Full-screen overlays: the fade used at loop end, title/ending cards,
 * the pause menu, small pop-up menus (wait, item pickers) and the
 * rotate-your-phone screen.
 */
export interface MenuOption {
  label: string;
  run: () => void;
}

export interface CardSpec {
  title: string;
  subtitle?: string;
  body?: string;
  /** Extra DOM to place inside the card (settings, notebook). */
  content?: HTMLElement;
  buttons: { label: string; run: () => void; primary?: boolean }[];
}

export class Overlays {
  private fadeEl: HTMLDivElement;
  private cardEl: HTMLDivElement | undefined;
  private menuEl: HTMLDivElement | undefined;
  private rotateEl: HTMLDivElement;

  constructor(private parent: HTMLElement) {
    this.fadeEl = document.createElement('div');
    this.fadeEl.className = 'fade';
    this.rotateEl = document.createElement('div');
    this.rotateEl.className = 'rotate';
    this.rotateEl.innerHTML = '<div class="phone"></div><div>Rotate your phone</div><div style="font-size:14px;color:var(--cream)">The Meridian plays in landscape.</div>';
    parent.append(this.fadeEl, this.rotateEl);
  }

  get isPortraitBlocked(): boolean {
    return getComputedStyle(this.rotateEl).display !== 'none';
  }

  fade(toBlack: boolean, ms = 700): Promise<void> {
    this.fadeEl.style.transitionDuration = `${ms}ms`;
    this.fadeEl.classList.toggle('on', toBlack);
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  card(spec: CardSpec): HTMLDivElement {
    this.closeCard();
    const card = document.createElement('div');
    card.className = 'card';
    const inner = document.createElement('div');
    inner.className = 'inner';
    const h1 = document.createElement('h1');
    h1.textContent = spec.title;
    inner.appendChild(h1);
    if (spec.subtitle) {
      const h2 = document.createElement('h2');
      h2.textContent = spec.subtitle;
      inner.appendChild(h2);
    }
    if (spec.body) {
      for (const para of spec.body.split('\n\n')) {
        const p = document.createElement('p');
        p.textContent = para;
        inner.appendChild(p);
      }
    }
    if (spec.content) inner.appendChild(spec.content);
    const row = document.createElement('div');
    row.className = 'row';
    for (const b of spec.buttons) {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      if (b.primary) btn.style.borderWidth = '2px';
      btn.addEventListener('click', () => b.run());
      row.appendChild(btn);
    }
    inner.appendChild(row);
    card.appendChild(inner);
    this.parent.appendChild(card);
    this.cardEl = card;
    return card;
  }

  closeCard(): void {
    this.cardEl?.remove();
    this.cardEl = undefined;
  }

  get cardOpen(): boolean {
    return this.cardEl !== undefined;
  }

  menu(title: string, options: MenuOption[]): void {
    this.closeMenu();
    const m = document.createElement('div');
    m.className = 'menu';
    const h = document.createElement('h3');
    h.textContent = title;
    m.appendChild(h);
    for (const o of options) {
      const b = document.createElement('button');
      b.textContent = o.label;
      b.addEventListener('click', () => {
        this.closeMenu();
        o.run();
      });
      m.appendChild(b);
    }
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => this.closeMenu());
    m.appendChild(cancel);
    this.parent.appendChild(m);
    this.menuEl = m;
  }

  closeMenu(): void {
    this.menuEl?.remove();
    this.menuEl = undefined;
  }

  get menuOpen(): boolean {
    return this.menuEl !== undefined;
  }
}
