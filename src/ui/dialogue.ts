/**
 * The dialogue panel: portrait, typewriter lines, and choice tabs
 * (Ask about, Tell, Show, Accuse, Leave). The world keeps running at reduced
 * speed while it is open; the game decides that.
 */
export interface ChoiceOption {
  label: string;
  hint?: string;
  run: () => void;
}

export interface ChoiceGroup {
  id: string;
  label: string;
  options: ChoiceOption[];
}

export interface Portrait {
  id: string;
  name: string;
  initials: string;
  accent: string;
}

export class DialoguePanel {
  private el: HTMLDivElement;
  private portrait: HTMLDivElement;
  private who: HTMLDivElement;
  private lines: HTMLDivElement;
  private tabs: HTMLDivElement;
  private options: HTMLDivElement;
  private openFlag = false;
  private groups: ChoiceGroup[] = [];
  private activeGroup = '';
  private queue: { speaker: string; text: string; mine: boolean; narration: boolean }[] = [];
  private typing: { el: HTMLElement; text: string; shown: number } | undefined;
  private acc = 0;
  charsPerSecond = 45;
  npc: Portrait | undefined;

  constructor(parent: HTMLElement, private handlers: { onLeave: () => void }) {
    this.el = document.createElement('div');
    this.el.className = 'dialogue hidden';
    const left = document.createElement('div');
    this.portrait = document.createElement('div');
    this.portrait.className = 'portrait';
    this.who = document.createElement('div');
    this.who.className = 'who';
    left.append(this.portrait, this.who);
    this.lines = document.createElement('div');
    this.lines.className = 'lines';
    this.lines.addEventListener('click', () => this.skip());
    const choices = document.createElement('div');
    choices.className = 'choices';
    this.tabs = document.createElement('div');
    this.tabs.className = 'tabs';
    this.options = document.createElement('div');
    this.options.className = 'options';
    choices.append(this.tabs, this.options);
    this.el.append(left, this.lines, choices);
    parent.appendChild(this.el);
  }

  get isOpen(): boolean {
    return this.openFlag;
  }

  open(npc: Portrait): void {
    this.npc = npc;
    this.portrait.textContent = npc.initials;
    this.portrait.style.background = npc.accent;
    this.who.textContent = npc.name;
    if (!this.openFlag) {
      this.lines.innerHTML = '';
      this.queue.length = 0;
      this.typing = undefined;
    }
    this.el.classList.remove('hidden');
    this.openFlag = true;
  }

  close(): void {
    this.el.classList.add('hidden');
    this.openFlag = false;
    this.npc = undefined;
  }

  setChoices(groups: ChoiceGroup[]): void {
    this.groups = groups;
    this.tabs.innerHTML = '';
    for (const g of groups) {
      const b = document.createElement('button');
      b.textContent = g.label;
      b.addEventListener('click', () => this.showGroup(g.id));
      b.dataset.group = g.id;
      this.tabs.appendChild(b);
    }
    const leave = document.createElement('button');
    leave.textContent = 'Leave';
    leave.addEventListener('click', () => this.handlers.onLeave());
    this.tabs.appendChild(leave);
    if (!groups.some((g) => g.id === this.activeGroup)) this.activeGroup = groups[0]?.id ?? '';
    this.showGroup(this.activeGroup);
  }

  private showGroup(id: string): void {
    this.activeGroup = id;
    for (const b of Array.from(this.tabs.querySelectorAll('button'))) b.classList.toggle('active', b.dataset.group === id);
    this.options.innerHTML = '';
    const g = this.groups.find((x) => x.id === id);
    if (!g) return;
    if (g.options.length === 0) {
      const p = document.createElement('div');
      p.textContent = 'Nothing yet.';
      p.style.opacity = '0.6';
      this.options.appendChild(p);
      return;
    }
    for (const o of g.options) {
      const b = document.createElement('button');
      b.textContent = o.label;
      if (o.hint) {
        const s = document.createElement('span');
        s.className = 'bluff';
        s.textContent = o.hint;
        b.appendChild(s);
      }
      b.addEventListener('click', () => o.run());
      this.options.appendChild(b);
    }
  }

  addLine(speaker: string, text: string, mine: boolean, narration = false): void {
    this.queue.push({ speaker, text, mine, narration });
    if (!this.typing) this.next();
  }

  private next(): void {
    const item = this.queue.shift();
    if (!item) return;
    const p = document.createElement('p');
    p.className = `line${item.mine ? ' mine' : ''}${item.narration ? ' narration' : ''}`;
    if (!item.narration) {
      const b = document.createElement('b');
      b.textContent = item.speaker;
      p.appendChild(b);
    }
    const span = document.createElement('span');
    p.appendChild(span);
    this.lines.appendChild(p);
    while (this.lines.children.length > 12) this.lines.firstElementChild?.remove();
    this.typing = { el: span, text: item.text, shown: 0 };
    this.acc = 0;
    this.lines.scrollTop = this.lines.scrollHeight;
  }

  /** Finish the current line, or show the next queued one. */
  skip(): void {
    if (this.typing) {
      this.typing.el.textContent = this.typing.text;
      this.typing = undefined;
      this.next();
    }
  }

  update(dtMs: number): void {
    if (!this.typing) return;
    this.acc += (dtMs / 1000) * this.charsPerSecond;
    const n = Math.min(this.typing.text.length, Math.floor(this.acc));
    if (n !== this.typing.shown) {
      this.typing.shown = n;
      this.typing.el.textContent = this.typing.text.slice(0, n);
      this.lines.scrollTop = this.lines.scrollHeight;
    }
    if (n >= this.typing.text.length) {
      this.typing = undefined;
      this.next();
    }
  }
}
