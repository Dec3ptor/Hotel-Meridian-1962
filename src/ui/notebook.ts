/**
 * The notebook: people, a timeline merged across nights, a connections
 * board, and theories. Built from cross-loop memory plus what this night has
 * turned up so far.
 */
import { FACT_TEXT, PUBLIC_FACE, QUESTIONS, RELATIONS } from '../content/dialogue/facts';
import { formatShort } from '../sim/clock';
import { describeEvent } from '../sim/events';
import type { PlayerMemory } from '../sim/memory';
import { witnessFilter } from '../sim/memory';
import type { Static } from '../sim/registry';
import type { CharacterId, World } from '../sim/types';
import { CHARACTER_LOOKS } from '../render/palette';

const CAST: CharacterId[] = ['voss', 'vivian', 'hale', 'jimmy', 'ruth', 'walter'];

export interface NotebookHandlers {
  onClose: () => void;
  onTheory: (kind: 'killer' | 'driver', who: CharacterId | undefined) => void;
}

export class Notebook {
  private el: HTMLDivElement;
  private body: HTMLDivElement;
  private tabs: HTMLDivElement;
  private tab: 'people' | 'timeline' | 'board' | 'theories' = 'people';
  private openFlag = false;

  constructor(private parent: HTMLElement, private s: Static, private handlers: NotebookHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'card hidden';
    const inner = document.createElement('div');
    inner.className = 'inner notebook';
    const h1 = document.createElement('h1');
    h1.textContent = 'Notebook';
    this.tabs = document.createElement('div');
    this.tabs.className = 'row';
    for (const t of [
      ['people', 'People'],
      ['timeline', 'Timeline'],
      ['board', 'Connections'],
      ['theories', 'Theories'],
    ] as const) {
      const b = document.createElement('button');
      b.textContent = t[1];
      b.dataset.tab = t[0];
      b.addEventListener('click', () => {
        this.tab = t[0];
        this.render();
      });
      this.tabs.appendChild(b);
    }
    const close = document.createElement('button');
    close.textContent = 'Close';
    close.addEventListener('click', () => this.handlers.onClose());
    this.tabs.appendChild(close);
    this.body = document.createElement('div');
    this.body.className = 'notebook-body';
    inner.append(h1, this.tabs, this.body);
    this.el.appendChild(inner);
    parent.appendChild(this.el);
  }

  private mem!: PlayerMemory;
  private world!: World;

  get isOpen(): boolean {
    return this.openFlag;
  }

  open(mem: PlayerMemory, w: World): void {
    this.mem = mem;
    this.world = w;
    this.openFlag = true;
    this.el.classList.remove('hidden');
    this.render();
  }

  close(): void {
    this.openFlag = false;
    this.el.classList.add('hidden');
  }

  /** A fact is known if memory has it or this night has flagged it. */
  private known(fact: string): boolean {
    return this.mem.facts[fact] !== undefined || this.world.flags[`known:${fact}`] === true;
  }

  private knownFacts(): string[] {
    const out = new Set<string>(Object.keys(this.mem.facts));
    for (const k of Object.keys(this.world.flags)) if (k.startsWith('known:') && this.world.flags[k] === true) out.add(k.slice(6));
    return Array.from(out);
  }

  private render(): void {
    for (const b of Array.from(this.tabs.querySelectorAll('button'))) b.classList.toggle('active', b.dataset.tab === this.tab);
    this.body.innerHTML = '';
    switch (this.tab) {
      case 'people':
        this.renderPeople();
        break;
      case 'timeline':
        this.renderTimeline();
        break;
      case 'board':
        this.renderBoard();
        break;
      case 'theories':
        this.renderTheories();
        break;
    }
  }

  private renderPeople(): void {
    const facts = this.knownFacts();
    for (const id of CAST) {
      const def = this.s.characters[id]!;
      const look = CHARACTER_LOOKS[id];
      const card = document.createElement('div');
      card.className = 'person';
      const portrait = document.createElement('div');
      portrait.className = 'portrait';
      portrait.textContent = look.initials;
      portrait.style.background = look.accent;
      const text = document.createElement('div');
      const name = document.createElement('h3');
      const face = PUBLIC_FACE[id];
      const revealed = !face.revealedBy || this.known(face.revealedBy);
      name.textContent = revealed ? `${def.name}, ${def.age}` : face.name;
      const room = document.createElement('div');
      room.className = 'muted';
      const rec = this.mem.people[id];
      const lastRoom = rec?.lastSeenRoom ? this.s.rooms[rec.lastSeenRoom]?.name : undefined;
      room.textContent = `${this.s.rooms[def.startRoom]?.name ?? def.startRoom}${lastRoom ? ` · last seen: ${lastRoom}` : ''}${rec?.met ? ' · you have spoken' : ''}`;
      text.append(name, room);
      const blurb = document.createElement('p');
      blurb.textContent = revealed ? def.blurb : face.blurb;
      text.appendChild(blurb);
      const known = facts.filter((f) => FACT_TEXT[f]?.about.includes(id));
      if (known.length) {
        const ul = document.createElement('ul');
        for (const f of known) {
          const li = document.createElement('li');
          li.textContent = FACT_TEXT[f]!.text;
          ul.appendChild(li);
        }
        text.appendChild(ul);
      }
      const open = QUESTIONS.filter((q) => q.about === id && !q.answeredBy.some((f) => this.known(f)));
      if (open.length) {
        const h = document.createElement('div');
        h.className = 'muted';
        h.textContent = 'Open questions:';
        const ul = document.createElement('ul');
        ul.className = 'questions';
        for (const q of open) {
          const li = document.createElement('li');
          li.textContent = q.text;
          ul.appendChild(li);
        }
        text.append(h, ul);
      }
      if (rec && Object.keys(rec.said).length) {
        const h = document.createElement('div');
        h.className = 'muted';
        h.textContent = 'They said:';
        const ul = document.createElement('ul');
        ul.className = 'said';
        for (const [topic, lines] of Object.entries(rec.said).slice(0, 8)) {
          const li = document.createElement('li');
          li.innerHTML = `<i>${escapeHtml(topic.replace(/_/g, ' '))}</i>: ${escapeHtml(lines[0] ?? '')}`;
          ul.appendChild(li);
        }
        text.append(h, ul);
      }
      card.append(portrait, text);
      this.body.appendChild(card);
    }
  }

  private renderTimeline(): void {
    const entries: { loop: number; tick: number; text: string; now: boolean }[] = this.mem.witnessed.map((e) => ({ loop: e.loop, tick: e.tick, text: e.text, now: false }));
    for (const ev of this.world.log) {
      const wf = witnessFilter(this.world, ev);
      if (!wf) continue;
      entries.push({ loop: this.world.loop, tick: ev.tick, text: describeEvent(ev), now: true });
    }
    entries.sort((a, b) => a.tick - b.tick || a.loop - b.loop);
    if (entries.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'Nothing yet. Watch, listen, and look closely.';
      this.body.appendChild(p);
      return;
    }
    const table = document.createElement('table');
    table.className = 'timeline';
    let shown = 0;
    for (const e of entries) {
      if (shown++ > 400) break;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="t">${formatShort(e.tick)}</td><td class="n">${e.now ? 'now' : `night ${e.loop}`}</td><td>${escapeHtml(e.text)}</td>`;
      table.appendChild(tr);
    }
    this.body.appendChild(table);
  }

  private renderBoard(): void {
    const facts = new Set(this.knownFacts());
    const W = 560;
    const H = 340;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'board');
    const pos: Record<string, { x: number; y: number }> = {};
    CAST.forEach((id, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / CAST.length;
      pos[id] = { x: W / 2 + Math.cos(a) * 200, y: H / 2 + Math.sin(a) * 120 };
    });
    for (const r of RELATIONS) {
      if (!r.requires.some((f) => facts.has(f))) continue;
      const a = pos[r.a]!;
      const b = pos[r.b]!;
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', String(a.x));
      line.setAttribute('y1', String(a.y));
      line.setAttribute('x2', String(b.x));
      line.setAttribute('y2', String(b.y));
      line.setAttribute('stroke', '#c9a24a');
      line.setAttribute('stroke-width', '2');
      svg.appendChild(line);
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', String((a.x + b.x) / 2));
      label.setAttribute('y', String((a.y + b.y) / 2 - 4));
      label.setAttribute('fill', '#e8dcc0');
      label.setAttribute('font-size', '11');
      label.setAttribute('text-anchor', 'middle');
      label.textContent = r.label;
      svg.appendChild(label);
    }
    for (const id of CAST) {
      const p = pos[id]!;
      const g = document.createElementNS(svgNS, 'g');
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', String(p.x));
      c.setAttribute('cy', String(p.y));
      c.setAttribute('r', '26');
      c.setAttribute('fill', CHARACTER_LOOKS[id].accent);
      c.setAttribute('stroke', '#c9a24a');
      c.setAttribute('stroke-width', '2');
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', String(p.x));
      t.setAttribute('y', String(p.y + 5));
      t.setAttribute('fill', '#0e0d0b');
      t.setAttribute('font-size', '13');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-family', 'Poiret One, sans-serif');
      t.textContent = CHARACTER_LOOKS[id].initials;
      const n = document.createElementNS(svgNS, 'text');
      n.setAttribute('x', String(p.x));
      n.setAttribute('y', String(p.y + 42));
      n.setAttribute('fill', '#e8dcc0');
      n.setAttribute('font-size', '12');
      n.setAttribute('text-anchor', 'middle');
      n.textContent = this.s.characters[id]!.shortName;
      g.append(c, t, n);
      svg.appendChild(g);
    }
    this.body.appendChild(svg);
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Lines appear as you learn how people are tied to one another.';
    this.body.appendChild(p);
  }

  private renderTheories(): void {
    const mk = (kind: 'killer' | 'driver', title: string, provenFact: string, provenValue: CharacterId) => {
      const wrap = document.createElement('div');
      wrap.className = 'theory';
      const h = document.createElement('h3');
      h.textContent = title;
      const select = document.createElement('select');
      const none = document.createElement('option');
      none.value = '';
      none.textContent = 'No theory yet';
      select.appendChild(none);
      for (const id of CAST) {
        const o = document.createElement('option');
        o.value = id;
        o.textContent = this.s.characters[id]!.name;
        select.appendChild(o);
      }
      select.value = this.mem.theories[kind] ?? '';
      select.addEventListener('change', () => {
        this.handlers.onTheory(kind, (select.value || undefined) as CharacterId | undefined);
        this.render();
      });
      const status = document.createElement('div');
      const proven = this.known(provenFact) || this.mem.facts[provenFact]?.value === provenValue || this.world.flags[`known:${provenFact}`] === true;
      const chosen = this.mem.theories[kind];
      if (chosen && proven && chosen === provenValue) {
        status.className = 'proven';
        status.textContent = 'Proven. You have the evidence.';
      } else if (chosen) {
        status.className = 'muted';
        status.textContent = proven ? 'The evidence says otherwise.' : 'Unproven. Find something that settles it.';
      } else {
        status.className = 'muted';
        status.textContent = 'Mark a suspect.';
      }
      wrap.append(h, select, status);
      this.body.appendChild(wrap);
    };
    mk('killer', 'Who kills Voss?', 'killerOfVoss', 'hale');
    mk('driver', 'Who was driving in 1949?', 'vivianWasDriver', 'vivian');
    const endings = document.createElement('div');
    endings.className = 'muted';
    const n = this.mem.endingOrder.length;
    endings.textContent = `Endings found: ${n} of ${this.s.endings.length - 1}. Nights: ${Math.max(this.mem.loops, this.world.loop)}.`;
    this.body.appendChild(endings);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}
