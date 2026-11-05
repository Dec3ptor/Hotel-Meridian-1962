/** A ring of verb buttons around the tapped target. Look is always first. */
export interface Verb {
  label: string;
  run: () => void;
  primary?: boolean;
}

export class VerbWheel {
  private el: HTMLDivElement;
  private title: HTMLDivElement;
  private buttons: HTMLButtonElement[] = [];
  private openFlag = false;

  constructor(private parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'wheel hidden';
    this.title = document.createElement('div');
    this.title.className = 'title';
    this.el.appendChild(this.title);
    parent.appendChild(this.el);
  }

  get isOpen(): boolean {
    return this.openFlag;
  }

  open(sx: number, sy: number, title: string, verbs: Verb[]): void {
    this.close();
    const W = this.parent.clientWidth || window.innerWidth;
    const H = this.parent.clientHeight || window.innerHeight;
    const radius = 70;
    const cx = Math.min(Math.max(sx, radius + 30), W - radius - 30);
    const cy = Math.min(Math.max(sy, radius + 60), H - radius - 60);
    this.el.style.left = `${cx}px`;
    this.el.style.top = `${cy}px`;
    this.title.textContent = title;
    const n = Math.min(verbs.length, 6);
    for (let i = 0; i < n; i++) {
      const v = verbs[i]!;
      const b = document.createElement('button');
      b.textContent = v.label;
      if (v.primary) b.classList.add('primary');
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      b.style.left = `${Math.round(Math.cos(angle) * radius)}px`;
      b.style.top = `${Math.round(Math.sin(angle) * radius)}px`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
        v.run();
      });
      this.el.appendChild(b);
      this.buttons.push(b);
    }
    this.el.classList.remove('hidden');
    this.openFlag = true;
  }

  close(): void {
    for (const b of this.buttons) b.remove();
    this.buttons.length = 0;
    this.el.classList.add('hidden');
    this.openFlag = false;
  }
}
