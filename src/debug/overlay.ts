/**
 * Debug overlay (backtick): agent inspector, decision log and a timeline
 * scrubber that rebuilds the night to any tick from the input log.
 */
import { formatShort } from '../sim/clock';
import { describeEvent } from '../sim/events';
import type { Static } from '../sim/registry';
import type { CharacterId, World } from '../sim/types';

interface GameLike {
  readonly s: Static;
  readonly world: World;
  paused: boolean;
  scrubTo(tick: number): void;
}

export class DebugOverlay {
  private el: HTMLDivElement;
  private select: HTMLSelectElement;
  private inspector: HTMLDivElement;
  private decisions: HTMLDivElement;
  private events: HTMLDivElement;
  private scrubber: HTMLInputElement;
  private scrubLabel: HTMLSpanElement;
  private fps: HTMLSpanElement;
  private visible = false;
  private lastRefresh = 0;
  private frames = 0;
  private frameTime = 0;
  private scrubbing = false;

  constructor(parent: HTMLElement, private game: GameLike) {
    this.el = document.createElement('div');
    this.el.className = 'debug hidden';
    const head = document.createElement('div');
    head.innerHTML = '<b>DEBUG</b> ';
    this.fps = document.createElement('span');
    head.appendChild(this.fps);
    this.select = document.createElement('select');
    for (const id of game.s.characterOrder) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = id;
      this.select.appendChild(o);
    }
    this.select.value = 'hale';
    this.select.addEventListener('change', () => this.refresh(game.world, true));
    const h1 = document.createElement('h4');
    h1.textContent = 'Agent';
    h1.appendChild(this.select);
    this.inspector = document.createElement('div');
    const h2 = document.createElement('h4');
    h2.textContent = 'Timeline (re-simulates on release)';
    this.scrubber = document.createElement('input');
    this.scrubber.type = 'range';
    this.scrubber.min = '0';
    this.scrubber.max = '6000';
    this.scrubber.value = '0';
    this.scrubLabel = document.createElement('span');
    this.scrubber.addEventListener('input', () => {
      this.scrubbing = true;
      this.scrubLabel.textContent = formatShort(Number(this.scrubber.value));
    });
    const commit = () => {
      if (!this.scrubbing) return;
      this.scrubbing = false;
      game.scrubTo(Number(this.scrubber.value));
      this.refresh(game.world, true);
    };
    this.scrubber.addEventListener('change', commit);
    this.scrubber.addEventListener('pointerup', commit);
    const h3 = document.createElement('h4');
    h3.textContent = 'Decisions (selected agent, latest first)';
    this.decisions = document.createElement('div');
    this.decisions.className = 'log';
    const h4 = document.createElement('h4');
    h4.textContent = 'Events (latest first)';
    this.events = document.createElement('div');
    this.events.className = 'log';
    this.el.append(head, h1, this.inspector, h2, this.scrubber, this.scrubLabel, h3, this.decisions, h4, this.events);
    parent.appendChild(this.el);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.classList.toggle('hidden', !this.visible);
    if (this.visible) this.refresh(this.game.world, true);
  }

  update(w: World, dtMs: number): void {
    this.frames++;
    this.frameTime += dtMs;
    if (!this.visible) return;
    const now = performance.now();
    if (now - this.lastRefresh > 500) {
      this.lastRefresh = now;
      this.fps.textContent = ` ${Math.round((this.frames * 1000) / Math.max(1, this.frameTime))} fps, tick ${w.tick} (${formatShort(w.tick)})${this.game.paused ? ' PAUSED' : ''}`;
      this.frames = 0;
      this.frameTime = 0;
      this.refresh(w, false);
    }
  }

  private refresh(w: World, force: boolean): void {
    const id = this.select.value as CharacterId;
    const a = w.agents[id];
    if (!a) return;
    const def = this.game.s.characters[id]!;
    const rows: string[] = [];
    rows.push(`<tr><td>room</td><td>${a.room} (${a.pos.floor}:${a.pos.x},${a.pos.y}) ${a.alive ? '' : 'DEAD '}${a.incapacity ?? ''}${a.hiddenIn ? ` hidden in ${a.hiddenIn}` : ''}</td></tr>`);
    rows.push(`<tr><td>mood</td><td>fear ${a.mood.fear.toFixed(1)} anger ${a.mood.anger.toFixed(1)} susp ${a.mood.suspicion.toFixed(1)} drunk ${a.mood.drunk.toFixed(1)} resolve ${a.mood.resolve.toFixed(1)}</td></tr>`);
    rows.push(`<tr><td>busy</td><td>${a.busyUntil !== undefined && a.busyUntil > w.tick ? `${a.busyWith ?? ''} until ${formatShort(a.busyUntil)}` : '-'}</td></tr>`);
    rows.push(`<tr><td>current</td><td>${a.current ? `${a.current.goal} / ${a.current.plan} step ${a.current.step}` : '-'}</td></tr>`);
    rows.push(`<tr><td>inventory</td><td>${a.inventory.join(', ') || '-'}</td></tr>`);
    const goals = def.goals
      .map((g) => {
        const gs = a.goalStates[g.id];
        const cls = a.current?.goal === g.id ? 'active' : gs?.status === 'done' ? 'done' : gs?.status === 'failed' ? 'failed' : '';
        return `<span class="pill ${cls}">${g.id}</span>`;
      })
      .join('');
    rows.push(`<tr><td>goals</td><td>${goals}</td></tr>`);
    const beliefs = Object.entries(a.beliefs)
      .filter(([k]) => !k.startsWith('itemAt:'))
      .map(([k, b]) => `${k}=${String(b.value)} (${b.confidence.toFixed(2)} ${b.source} ${formatShort(b.tick)})`)
      .join('<br>');
    rows.push(`<tr><td>beliefs</td><td>${beliefs || '-'}</td></tr>`);
    this.inspector.innerHTML = `<table>${rows.join('')}</table>`;
    if (!this.scrubbing) {
      this.scrubber.value = String(w.tick);
      this.scrubLabel.textContent = formatShort(w.tick);
    }
    const dec = w.decisions.filter((d) => d.agent === id).slice(-60).reverse();
    this.decisions.textContent = dec.map((d) => `${formatShort(d.tick)} ${d.text}`).join('\n');
    if (force || this.frames % 2 === 0) {
      const evs = w.log
        .slice(-120)
        .reverse()
        .filter((e) => !['Moved', 'Saw', 'SawItem', 'DoorOpened', 'DoorClosed', 'ItemChanged', 'GoalChanged', 'PlanStarted', 'PlanCompleted', 'Heard'].includes(e.type))
        .slice(0, 50);
      this.events.textContent = evs.map((e) => `${formatShort(e.tick)} ${describeEvent(e)}`).join('\n');
    }
  }
}
