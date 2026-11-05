/**
 * The game controller: runs the simulation at a fixed 10 ticks per second,
 * renders between ticks, turns taps and keys into sim commands, and shows
 * what the player can see and hear through the DOM overlay.
 */
import '../content';
import { content } from '../content';
import { ACCUSATIONS, CLAIMS, availableTopics, claimIsTrue } from '../content/dialogue/topics';
import { DebugOverlay } from '../debug/overlay';
import { InputController } from '../input/pointer';
import { CHARACTER_LOOKS } from '../render/palette';
import { Scene, type PickResult } from '../render/scene';
import { formatClock, minutesToTick } from '../sim/clock';
import { playerKnows } from '../sim/commands';
import { endingDef } from '../sim/endings';
import { buildStatic, type Static } from '../sim/registry';
import { createSim, type Sim } from '../sim/sim';
import type { CharacterId, Scalar, World, WorldEvent } from '../sim/types';
import { DialoguePanel, type ChoiceGroup } from '../ui/dialogue';
import { Hud } from '../ui/hud';
import { Overlays } from '../ui/overlays';
import { VerbWheel, type Verb } from '../ui/verbwheel';

const STEP_MS = 100;
const MAX_STEPS_PER_FRAME = 80;

export interface GameSettings {
  textScale: number; // 1, 1.2, 1.4
  textSpeed: number; // chars per second
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  reducedMotion: boolean;
  highContrast: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  textScale: 1,
  textSpeed: 45,
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  reducedMotion: false,
  highContrast: false,
};

export interface GameHooks {
  /** Cross-loop knowledge (Phase 5). */
  memoryKnows: (fact: string) => boolean;
  onLoopEnd?: (w: World, game: Game) => Promise<void> | void;
  onEvent?: (ev: WorldEvent, game: Game) => void;
  onLoopStart?: (w: World, game: Game) => void;
}

const DIRS: Record<string, [number, number]> = {
  w: [0, -1],
  arrowup: [0, -1],
  s: [0, 1],
  arrowdown: [0, 1],
  a: [-1, 0],
  arrowleft: [-1, 0],
  d: [1, 0],
  arrowright: [1, 0],
};

export class Game {
  readonly s: Static;
  sim: Sim;
  readonly scene: Scene;
  readonly hud: Hud;
  readonly wheel: VerbWheel;
  readonly dialogue: DialoguePanel;
  readonly overlays: Overlays;
  readonly input: InputController;
  readonly debug: DebugOverlay;
  readonly uiRoot: HTMLElement;
  settings: GameSettings = { ...DEFAULT_SETTINGS };
  hooks: GameHooks;
  seed: number;
  loop = 1;
  paused = false;
  ending = false;
  waitUntil: number | undefined;
  private accumulator = 0;
  private pendingWheel: PickResult | undefined;
  private talkingTo: CharacterId | undefined;
  private inventoryKey = '';
  private keyMoveAt = 0;
  private unsubscribe: (() => void) | undefined;
  private tmp = { x: 0, y: 0 };
  private showingInteractables = false;
  started = false;

  private constructor(appRoot: HTMLElement, uiRoot: HTMLElement, scene: Scene, seed: number, hooks: GameHooks) {
    this.s = buildStatic(content);
    this.seed = seed;
    this.hooks = hooks;
    this.scene = scene;
    this.uiRoot = uiRoot;
    this.sim = createSim({ seed, loop: this.loop });
    this.hud = new Hud(uiRoot, {
      onNotebook: () => this.openNotebook(),
      onPause: () => this.togglePause(),
      onWait: () => this.openWaitMenu(),
      onSlotSelect: () => undefined,
      onDrop: (itemId, cx, cy) => this.dropItemAt(itemId, cx, cy),
      onShowInteractables: (pressed) => this.showInteractables(pressed),
    });
    this.wheel = new VerbWheel(uiRoot);
    this.dialogue = new DialoguePanel(uiRoot, { onLeave: () => this.closeDialogue() });
    this.overlays = new Overlays(uiRoot);
    this.debug = new DebugOverlay(uiRoot, this);
    this.input = new InputController(scene.canvas, {
      onTap: (x, y) => this.onTap(x, y),
      onLongPress: (x, y) => this.onLongPress(x, y),
      onRightClick: (x, y) => this.onLongPress(x, y),
      onZoom: (f) => this.scene.camera.setZoom(this.scene.camera.zoom * f),
      onKey: (key, down, e) => this.onKey(key, down, e),
    });
    this.attachBus();
    this.scene.resetHistory(this.sim.world);
    this.scene.app.ticker.add((t) => this.frame(t.deltaMS));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.scene.app.ticker.stop();
      else this.scene.app.ticker.start();
    });
    void appRoot;
  }

  static async boot(appRoot: HTMLElement, uiRoot: HTMLElement, opts: { seed?: number; hooks?: Partial<GameHooks> } = {}): Promise<Game> {
    const s = buildStatic(content);
    const scene = await Scene.create(appRoot, s);
    const hooks: GameHooks = { memoryKnows: () => false, ...opts.hooks };
    const game = new Game(appRoot, uiRoot, scene, opts.seed ?? 1962, hooks);
    return game;
  }

  get world(): World {
    return this.sim.world;
  }

  /** Begin play (after the title screen). */
  start(): void {
    this.started = true;
    this.hooks.onLoopStart?.(this.world, this);
  }

  applySettings(s: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...s };
    document.documentElement.style.setProperty('--text-scale', String(this.settings.textScale));
    this.dialogue.charsPerSecond = this.settings.textSpeed;
    this.scene.setReducedMotion(this.settings.reducedMotion);
    document.body.classList.toggle('high-contrast', this.settings.highContrast);
    this.scene.highContrast = this.settings.highContrast;
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  command(action: string, args?: Record<string, Scalar>): void {
    if (this.ending) return;
    this.sim.enqueue({ tick: this.world.tick + 1, action, args });
  }

  // ---------------------------------------------------------------------------
  // Events from the sim
  // ---------------------------------------------------------------------------

  private attachBus(): void {
    this.unsubscribe?.();
    this.unsubscribe = this.sim.bus.onAny((ev) => this.onEvent(ev));
  }

  private playerHears(room: string): boolean {
    const p = this.world.agents.player!;
    return p.room === room || p.flags.listeningRoom === room;
  }

  private onEvent(ev: WorldEvent): void {
    const w = this.world;
    const now = performance.now();
    this.hooks.onEvent?.(ev, this);
    switch (ev.type) {
      case 'Said': {
        const speakerName = ev.speaker === 'player' ? 'You' : this.s.characters[ev.speaker]!.shortName;
        const mine = ev.speaker === 'player';
        const toMe = ev.to === 'player' || mine;
        if (this.playerHears(ev.room) || toMe) {
          this.hud.caption(ev.speaker, speakerName, ev.text, CHARACTER_LOOKS[ev.speaker].accent, now);
          if (this.dialogue.isOpen && (toMe || this.talkingTo === ev.speaker || (ev.to === this.talkingTo && ev.speaker !== 'player'))) {
            this.dialogue.addLine(speakerName, ev.text, mine);
          }
          if (toMe && this.waitUntil !== undefined) this.stopWait();
          if (!this.dialogue.isOpen && toMe && !mine) this.hud.toast(`${speakerName}: ${ev.text}`, 'info', 5000);
        }
        if (this.waitUntil !== undefined && this.playerHears(ev.room)) this.stopWait();
        break;
      }
      case 'Narration':
        if (this.dialogue.isOpen && this.playerHears(ev.room)) this.dialogue.addLine('', ev.text, false, true);
        break;
      case 'ClueFound':
        this.hud.toast(`New clue: ${ev.text}`, 'clue', 6000);
        this.stopWait();
        break;
      case 'Looked':
        this.hud.toast(ev.text, 'info', 6000);
        break;
      case 'Searched':
        this.hud.toast(ev.found.length ? `You find: ${ev.found.map((i) => this.s.items[i]!.name).join(', ')}.` : 'Nothing there.', 'info', 4500);
        break;
      case 'ActionFailed':
        this.hud.toast(`${ev.reason.charAt(0).toUpperCase()}${ev.reason.slice(1)}.`, 'fail');
        if (ev.action !== 'move') this.stopWait();
        break;
      case 'ActionDone':
        if (ev.action === 'move' && this.pendingWheel) this.tryOpenPendingWheel(true);
        if (ev.action !== 'move') this.stopWait();
        break;
      case 'PickpocketFailed':
        this.hud.toast(`${this.s.characters[ev.holder]!.shortName} catches your hand.`, 'fail');
        break;
      case 'Heard':
        if (ev.agent === 'player' && ev.kind !== 'speech') {
          const where = this.s.rooms[ev.room]?.name ?? ev.room;
          const what: Record<string, string> = {
            scream: 'a scream',
            gunshot: 'a gunshot',
            argument: 'an argument',
            knock: 'a knock',
            bell: 'the desk bell',
            creak: 'the stair creak',
            glass_breaks: 'glass breaking',
            thunder: 'thunder',
            radio: 'the radio',
            struggle: 'a struggle',
            door_slam: 'a door slam',
            footsteps: 'footsteps',
          };
          if (ev.kind !== 'thunder' && ev.kind !== 'radio') this.hud.toast(`You hear ${what[ev.kind] ?? ev.kind} from the ${where.toLowerCase()}.`);
          if (ev.kind === 'radio' && ev.text) this.hud.caption('radio', 'Radio', ev.text, '#c9a24a', now);
          if (ev.kind !== 'radio' && ev.kind !== 'thunder') this.stopWait();
        }
        break;
      case 'WorldEvent':
        this.hud.toast(ev.text, 'info', 5000);
        if (ev.id === 'bridge_out') this.scene.flicker(3000);
        break;
      case 'SawBody':
        if (ev.agent === 'player') {
          this.hud.toast(`${this.s.characters[ev.body]!.name} is dead.`, 'clue', 6000);
          this.stopWait();
        }
        break;
      case 'Saw':
        if (ev.agent === 'player' && ev.detail) {
          this.hud.toast(`${this.s.characters[ev.target]!.shortName}: ${ev.detail}.`, 'clue');
          this.stopWait();
        }
        break;
      case 'Moved':
        if (ev.agent !== 'player' && ev.to === w.agents.player!.room) this.stopWait();
        if (ev.agent === 'player' && this.talkingTo && w.agents[this.talkingTo]!.room !== ev.to) this.closeDialogue();
        break;
      case 'Threatened':
        if (ev.agent === 'player') {
          this.hud.toast(`${this.s.characters[ev.by]!.shortName} is threatening you.`, 'fail', 5000);
          this.stopWait();
        }
        break;
      case 'Attacked':
        if (ev.target === 'player' || ev.attacker === 'player') this.stopWait();
        break;
      case 'MoodChanged': {
        if (ev.agent === 'player' || ev.to <= ev.from) break;
        const kind = ev.key === 'fear' ? 'fear' : ev.key === 'anger' ? 'anger' : ev.key === 'suspicion' ? 'suspicion' : ev.key === 'drunk' ? 'drunk' : 'none';
        if (kind !== 'none') this.scene.showGlyph(ev.agent, kind);
        break;
      }
      case 'Died':
        if (ev.agent === 'player') this.hud.toast('Everything goes dark.', 'fail', 6000);
        break;
      case 'LoopEnded':
        void this.endLoop(ev);
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Frame loop
  // ---------------------------------------------------------------------------

  private speedFactor(): number {
    if (this.paused || this.ending || !this.started || this.overlays.cardOpen) return 0;
    if (this.waitUntil !== undefined) return 20;
    if (this.dialogue.isOpen) return 0.25;
    return 1;
  }

  private frame(dtMs: number): void {
    const dt = Math.min(dtMs, 250);
    const now = performance.now();
    const w = this.world;
    const factor = this.speedFactor();
    if (factor > 0 && !w.ended) {
      this.accumulator += dt * factor;
      let steps = 0;
      while (this.accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
        this.keyboardMovement();
        this.scene.beforeStep(this.sim.world);
        this.sim.step();
        this.accumulator -= STEP_MS;
        steps++;
        if (this.sim.world.ended) break;
        if (this.waitUntil !== undefined && this.sim.world.tick >= this.waitUntil) this.stopWait();
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    }
    const alpha = factor > 0 ? Math.min(1, this.accumulator / STEP_MS) : 1;
    this.dialogue.update(dt);
    this.scene.render(this.sim.world, alpha, dt, now);
    this.hud.setClock(formatClock(this.sim.world.tick), this.loop);
    this.hud.setSpeed(this.paused ? 'PAUSED' : this.waitUntil !== undefined ? 'WAITING' : this.dialogue.isOpen ? 'TALKING' : '');
    this.hud.updateCaptions((agent) => (agent === 'radio' ? this.scene.screenOf(this.sim.world, 'fixture', 'radio', this.tmp) : this.scene.screenOf(this.sim.world, 'agent', agent, this.tmp)), now);
    this.syncInventory();
    if (this.pendingWheel) this.tryOpenPendingWheel(false);
    if (this.talkingTo) {
      const other = this.sim.world.agents[this.talkingTo]!;
      const p = this.sim.world.agents.player!;
      if (!other.alive || other.room !== p.room || Math.max(Math.abs(other.pos.x - p.pos.x), Math.abs(other.pos.y - p.pos.y)) > 3) this.closeDialogue();
    }
    this.debug.update(this.sim.world, dt);
  }

  private syncInventory(): void {
    const inv = this.world.agents.player!.inventory;
    const key = inv.join(',');
    if (key === this.inventoryKey) return;
    this.inventoryKey = key;
    this.hud.setInventory(inv.map((id) => ({ id, name: this.s.items[id]!.name })));
  }

  private keyboardMovement(): void {
    const now = performance.now();
    if (now - this.keyMoveAt < 120) return;
    if (this.dialogue.isOpen || this.wheel.isOpen || this.overlays.menuOpen) return;
    let dx = 0;
    let dy = 0;
    for (const k of this.input.held) {
      const d = DIRS[k];
      if (d) {
        dx += d[0];
        dy += d[1];
      }
    }
    if (dx === 0 && dy === 0) return;
    this.keyMoveAt = now;
    const p = this.world.agents.player!;
    const nav = this.s.nav;
    let x = p.pos.x;
    let y = p.pos.y;
    for (let i = 0; i < 2; i++) {
      const nx = x + Math.sign(dx);
      const ny = y + Math.sign(dy);
      const c = nav.cell(p.pos.floor, nx, ny);
      if (nx < 0 || ny < 0 || nx >= nav.W || ny >= nav.H || !nav.walkable[c]) break;
      x = nx;
      y = ny;
    }
    if (x !== p.pos.x || y !== p.pos.y) this.command('move', { x, y, floor: p.pos.floor });
  }

  // ---------------------------------------------------------------------------
  // Pointer interaction
  // ---------------------------------------------------------------------------

  private onTap(sx: number, sy: number): void {
    if (!this.started || this.ending) return;
    if (this.overlays.cardOpen) return;
    if (this.overlays.menuOpen) {
      this.overlays.closeMenu();
      return;
    }
    if (this.wheel.isOpen) {
      this.wheel.close();
      return;
    }
    const w = this.world;
    const pick = this.scene.pick(w, sx, sy);
    const selected = this.hud.selectedItem;
    if (selected && pick.kind !== 'floor') {
      this.useItemOn(selected.id, pick);
      this.hud.setSelectedSlot(undefined);
      return;
    }
    if (pick.kind === 'floor') {
      if (this.dialogue.isOpen) this.closeDialogue();
      this.pendingWheel = undefined;
      this.command('move', { x: pick.tile.x, y: pick.tile.y, floor: pick.tile.floor });
      return;
    }
    this.approachThenWheel(pick);
  }

  private onLongPress(sx: number, sy: number): void {
    if (!this.started || this.ending) return;
    const pick = this.scene.pick(this.world, sx, sy);
    if (pick.kind === 'floor') return;
    this.command('look', { target: pick.id });
  }

  private rangeFor(pick: PickResult): number {
    switch (pick.kind) {
      case 'agent':
        return 2;
      case 'item':
        return 1;
      case 'door':
        return 1;
      default:
        return 1;
    }
  }

  private distanceTo(pick: PickResult): number {
    const w = this.world;
    const p = w.agents.player!;
    const nav = this.s.nav;
    const pc = nav.cellOf(p.pos);
    switch (pick.kind) {
      case 'agent': {
        const a = w.agents[pick.id as CharacterId]!;
        return nav.chebyshev(pc, nav.cellOf(a.pos));
      }
      case 'fixture': {
        const f = this.s.fixtures[pick.id]!;
        const room = this.s.rooms[f.room]!;
        let best = Infinity;
        for (const t of f.tiles) best = Math.min(best, nav.chebyshev(pc, nav.cell(room.floor, t.x, t.y)));
        return best;
      }
      case 'door': {
        const di = nav.doorIndex[pick.id]!;
        let best = Infinity;
        for (const c of nav.doorCells[di]!) best = Math.min(best, nav.chebyshev(pc, c));
        return best;
      }
      case 'item':
        return nav.chebyshev(pc, nav.cell(pick.tile.floor, pick.tile.x, pick.tile.y));
      default:
        return 0;
    }
  }

  private approachTile(pick: PickResult): { x: number; y: number; floor: number } | undefined {
    const nav = this.s.nav;
    const w = this.world;
    const p = w.agents.player!;
    switch (pick.kind) {
      case 'agent': {
        const a = w.agents[pick.id as CharacterId]!;
        return { x: a.pos.x, y: a.pos.y, floor: a.pos.floor };
      }
      case 'fixture': {
        const f = this.s.fixtures[pick.id]!;
        return { x: f.at.x, y: f.at.y, floor: this.s.rooms[f.room]!.floor };
      }
      case 'door': {
        const di = nav.doorIndex[pick.id]!;
        const dc = nav.doorCells[di]![0]!;
        const nbrs: number[] = [];
        nav.neighbours(dc, nbrs);
        let best: number | undefined;
        let bestD = Infinity;
        const pc = nav.cellOf(p.pos);
        for (const n of nbrs) {
          const d = nav.dist(pc, n);
          if (d < bestD) {
            bestD = d;
            best = n;
          }
        }
        if (best === undefined) return undefined;
        return { x: nav.xOf(best), y: nav.yOf(best), floor: nav.floorOf(best) };
      }
      case 'item': {
        const c = nav.cell(pick.tile.floor, pick.tile.x, pick.tile.y);
        if (nav.walkable[c]) return { x: pick.tile.x, y: pick.tile.y, floor: pick.tile.floor };
        const loc = w.items[pick.id]!.loc;
        if (loc.kind === 'fixture') {
          const f = this.s.fixtures[loc.fixture]!;
          return { x: f.at.x, y: f.at.y, floor: this.s.rooms[f.room]!.floor };
        }
        return undefined;
      }
      default:
        return undefined;
    }
  }

  private approachThenWheel(pick: PickResult): void {
    if (this.distanceTo(pick) <= this.rangeFor(pick)) {
      this.openWheel(pick);
      return;
    }
    const t = this.approachTile(pick);
    if (!t) return;
    this.pendingWheel = pick;
    this.command('move', { x: t.x, y: t.y, floor: t.floor });
  }

  private tryOpenPendingWheel(arrived: boolean): void {
    const pick = this.pendingWheel;
    if (!pick) return;
    if (this.distanceTo(pick) <= this.rangeFor(pick)) {
      this.pendingWheel = undefined;
      if (!arrived) this.command('stop');
      this.openWheel(pick);
    } else if (arrived) {
      this.pendingWheel = undefined;
    }
  }

  private openWheel(pick: PickResult): void {
    const w = this.world;
    const pos = this.scene.screenOf(w, pick.kind, pick.id, this.tmp) ?? { x: pick.sx, y: pick.sy };
    const verbs: Verb[] = [{ label: 'Look', run: () => this.command('look', { target: pick.id }) }];
    let title = pick.id;
    switch (pick.kind) {
      case 'agent': {
        const id = pick.id as CharacterId;
        const a = w.agents[id]!;
        const def = this.s.characters[id]!;
        title = def.shortName;
        if (a.alive && !a.incapacity) {
          verbs.push({ label: 'Talk', primary: true, run: () => this.openDialogue(id) });
          if (w.agents.player!.inventory.length > 0) {
            verbs.push({ label: 'Show', run: () => this.pickInventory('Show what?', (item) => this.command('show', { to: id, item })) });
            verbs.push({ label: 'Give', run: () => this.pickInventory('Give what?', (item) => this.command('give', { to: id, item })) });
          }
          verbs.push({ label: 'Follow', run: () => this.command('follow', { agent: id }) });
        }
        const visible = a.inventory.filter((it) => {
          const loc = w.items[it]!.loc;
          return !(loc.kind === 'agent' && loc.concealed) || !a.alive;
        });
        if (visible.length > 0) {
          verbs.push({
            label: a.alive ? 'Pickpocket' : 'Search',
            run: () => this.pickFrom(a.alive ? 'Take what?' : 'Take what?', visible, (item) => this.command('take', { item })),
          });
        }
        break;
      }
      case 'item': {
        const def = this.s.items[pick.id]!;
        title = def.name;
        if (def.portable) verbs.push({ label: 'Take', primary: true, run: () => this.command('take', { item: pick.id }) });
        if (def.proves) verbs.push({ label: 'Read', run: () => this.command('use', { target: pick.id, action: 'read' }) });
        for (const [action, use] of Object.entries(def.uses ?? {})) {
          if (use.requiresItem) continue;
          verbs.push({ label: capitalize(action), run: () => this.command('use', { target: pick.id, action }) });
        }
        break;
      }
      case 'fixture': {
        const def = this.s.fixtures[pick.id]!;
        title = def.name;
        if (def.container) verbs.push({ label: 'Search', primary: true, run: () => this.command('use', { target: pick.id, action: 'search' }) });
        if (def.hidingSpot) verbs.push({ label: 'Hide', run: () => this.command('hide', { fixture: pick.id }) });
        if (pick.id.startsWith('thin_wall')) verbs.push({ label: 'Listen', run: () => this.command('listen', { target: pick.id }) });
        for (const [action, use] of Object.entries(def.uses ?? {})) {
          if (use.requiresItem || action === 'put' || action === 'drop') continue;
          verbs.push({ label: capitalize(action), run: () => this.command('use', { target: pick.id, action }) });
        }
        if (def.container && w.agents.player!.inventory.length > 0) {
          verbs.push({ label: 'Put', run: () => this.pickInventory('Put what?', (item) => this.command('use', { target: pick.id, action: 'apply', item })) });
        }
        break;
      }
      case 'door': {
        const def = this.s.doors[pick.id]!;
        const st = w.doors[pick.id]!;
        title = def.name;
        if (def.kind !== 'archway') {
          verbs.push({ label: st.open ? 'Close' : 'Open', primary: true, run: () => this.command('use', { target: pick.id, action: st.open ? 'close' : 'open' }) });
          if (def.lockable) verbs.push({ label: st.locked ? 'Unlock' : 'Lock', run: () => this.command('use', { target: pick.id, action: st.locked ? 'unlock' : 'lock' }) });
          verbs.push({ label: 'Knock', run: () => this.command('use', { target: pick.id, action: 'knock' }) });
          verbs.push({ label: 'Listen', run: () => this.command('listen', { target: pick.id }) });
        }
        break;
      }
      default:
        break;
    }
    this.wheel.open(pos.x, pos.y, title, verbs.slice(0, 6));
  }

  private pickInventory(title: string, onPick: (item: string) => void): void {
    this.pickFrom(title, this.world.agents.player!.inventory, onPick);
  }

  private pickFrom(title: string, items: readonly string[], onPick: (item: string) => void): void {
    this.overlays.menu(
      title,
      items.map((id) => ({ label: this.s.items[id]!.name, run: () => onPick(id) })),
    );
  }

  private useItemOn(itemId: string, pick: PickResult): void {
    switch (pick.kind) {
      case 'agent':
        this.overlays.menu(`${this.s.items[itemId]!.name} to ${this.s.characters[pick.id as CharacterId]!.shortName}`, [
          { label: 'Show', run: () => this.command('show', { to: pick.id, item: itemId }) },
          { label: 'Give', run: () => this.command('give', { to: pick.id, item: itemId }) },
        ]);
        break;
      case 'door':
      case 'fixture':
      case 'item':
        this.command('use', { target: pick.id, action: 'apply', item: itemId });
        break;
      default:
        break;
    }
  }

  private dropItemAt(itemId: string, clientX: number, clientY: number): void {
    const r = this.scene.canvas.getBoundingClientRect();
    const pick = this.scene.pick(this.world, clientX - r.left, clientY - r.top);
    if (pick.kind === 'floor') {
      this.hud.toast('Drop it on something or someone.', 'fail');
      return;
    }
    this.useItemOn(itemId, pick);
  }

  private showInteractables(pressed: boolean): void {
    this.showingInteractables = pressed;
    if (pressed) this.scene.setHighlights(this.scene.interactablesIn(this.world, this.world.agents.player!.room));
    else this.scene.setHighlights([]);
  }

  // ---------------------------------------------------------------------------
  // Dialogue
  // ---------------------------------------------------------------------------

  openDialogue(id: CharacterId): void {
    const def = this.s.characters[id]!;
    const look = CHARACTER_LOOKS[id];
    this.talkingTo = id;
    this.dialogue.open({ id, name: def.name, initials: look.initials, accent: look.accent });
    this.refreshChoices();
    this.command('talk', { to: id, topic: 'tonight' });
  }

  refreshChoices(): void {
    const id = this.talkingTo;
    if (!id) return;
    const w = this.world;
    const groups: ChoiceGroup[] = [];
    groups.push({
      id: 'ask',
      label: 'Ask about',
      options: availableTopics(w, this.hooks.memoryKnows).map((t) => ({ label: t.label, run: () => this.command('talk', { to: id, topic: t.id }) })),
    });
    groups.push({
      id: 'tell',
      label: 'Tell',
      options: CLAIMS.map((c) => ({
        label: c.label,
        hint: claimIsTrue(w, c, this.hooks.memoryKnows) ? 'known' : 'bluff',
        run: () => this.command('tell', { to: id, fact: c.fact, value: c.value }),
      })),
    });
    groups.push({
      id: 'show',
      label: 'Show',
      options: w.agents.player!.inventory.map((item) => ({ label: this.s.items[item]!.name, run: () => this.command('show', { to: id, item }) })),
    });
    const suspects = this.s.characterOrder.filter((c) => c !== 'player' && c !== id);
    groups.push({
      id: 'accuse',
      label: 'Accuse',
      options: ACCUSATIONS.flatMap((acc) =>
        suspects.map((who) => ({
          label: `${this.s.characters[who]!.shortName} ${acc.label}`,
          run: () => this.command('accuse', { to: id, kind: acc.kind, who }),
        })),
      ),
    });
    this.dialogue.setChoices(groups);
  }

  closeDialogue(): void {
    this.talkingTo = undefined;
    this.dialogue.close();
  }

  // ---------------------------------------------------------------------------
  // Waiting, pausing, keys
  // ---------------------------------------------------------------------------

  openWaitMenu(): void {
    if (this.overlays.menuOpen) {
      this.overlays.closeMenu();
      return;
    }
    const mk = (minutes: number) => ({ label: `Wait ${minutes} minutes`, run: () => this.wait(minutes) });
    this.overlays.menu('Wait', [mk(5), mk(15), mk(30), { label: 'Until something happens', run: () => this.wait(240) }]);
  }

  wait(minutes: number): void {
    this.waitUntil = this.world.tick + minutesToTick(minutes);
    this.command('wait', { minutes });
    this.wheel.close();
  }

  stopWait(): void {
    if (this.waitUntil === undefined) return;
    this.waitUntil = undefined;
  }

  togglePause(): void {
    if (this.ending || !this.started) return;
    if (this.overlays.cardOpen) {
      this.overlays.closeCard();
      this.paused = false;
      return;
    }
    this.paused = true;
    this.overlays.card({
      title: 'Paused',
      subtitle: `Night ${this.loop}, ${formatClock(this.world.tick)}`,
      buttons: [
        { label: 'Resume', primary: true, run: () => this.togglePause() },
        { label: 'Restart this night', run: () => void this.restartNight() },
        { label: 'Settings', run: () => this.openSettings() },
      ],
    });
  }

  openSettings(): void {
    this.paused = true;
    const content = document.createElement('div');
    const mkRange = (label: string, min: number, max: number, step: number, value: number, on: (v: number) => void) => {
      const l = document.createElement('label');
      const span = document.createElement('span');
      span.textContent = label;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(value);
      input.addEventListener('input', () => on(Number(input.value)));
      l.append(span, input);
      content.appendChild(l);
    };
    const mkCheck = (label: string, value: boolean, on: (v: boolean) => void) => {
      const l = document.createElement('label');
      const span = document.createElement('span');
      span.textContent = label;
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = value;
      input.addEventListener('change', () => on(input.checked));
      l.append(span, input);
      content.appendChild(l);
    };
    mkRange('Text size', 1, 1.4, 0.2, this.settings.textScale, (v) => this.applySettings({ textScale: v }));
    mkRange('Text speed', 15, 120, 5, this.settings.textSpeed, (v) => this.applySettings({ textSpeed: v }));
    mkRange('Master volume', 0, 1, 0.05, this.settings.masterVolume, (v) => this.applySettings({ masterVolume: v }));
    mkRange('Music volume', 0, 1, 0.05, this.settings.musicVolume, (v) => this.applySettings({ musicVolume: v }));
    mkRange('Effects volume', 0, 1, 0.05, this.settings.sfxVolume, (v) => this.applySettings({ sfxVolume: v }));
    mkCheck('Reduced motion', this.settings.reducedMotion, (v) => this.applySettings({ reducedMotion: v }));
    mkCheck('High-contrast outlines', this.settings.highContrast, (v) => this.applySettings({ highContrast: v }));
    this.overlays.card({
      title: 'Settings',
      content,
      buttons: [{ label: 'Done', primary: true, run: () => this.togglePause() }],
    });
    this.hooks.onEvent?.({ type: 'WorldEvent', tick: this.world.tick, id: 'settings', text: '' }, this);
  }

  openNotebook(): void {
    this.hud.toast('The notebook arrives with the next phase.', 'info');
  }

  private onKey(key: string, down: boolean, e: KeyboardEvent): void {
    if (!down) return;
    const k = key.toLowerCase();
    if (k === '`') {
      this.debug.toggle();
      e.preventDefault();
      return;
    }
    if (!this.started) return;
    switch (k) {
      case 'escape':
        if (this.wheel.isOpen) this.wheel.close();
        else if (this.overlays.menuOpen) this.overlays.closeMenu();
        else if (this.dialogue.isOpen) this.closeDialogue();
        else this.togglePause();
        break;
      case 'n':
        this.openNotebook();
        break;
      case 't':
        this.openWaitMenu();
        break;
      case ' ':
        if (this.dialogue.isOpen) this.dialogue.skip();
        e.preventDefault();
        break;
      case 'c':
        this.scene.recentre(this.world);
        break;
      default:
        if (/^[1-8]$/.test(k)) {
          const idx = Number(k) - 1;
          this.hud.setSelectedSlot(this.hud.selectedItem && this.world.agents.player!.inventory[idx] === this.hud.selectedItem.id ? undefined : idx);
        }
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Loops
  // ---------------------------------------------------------------------------

  private async endLoop(ev: Extract<WorldEvent, { type: 'LoopEnded' }>): Promise<void> {
    if (this.ending) return;
    this.ending = true;
    this.stopWait();
    this.closeDialogue();
    this.wheel.close();
    this.overlays.closeMenu();
    this.pendingWheel = undefined;
    await this.hooks.onLoopEnd?.(this.world, this);
    await this.overlays.fade(true, 1500);
    const def = ev.ending ? endingDef(this.sim.s, ev.ending) : undefined;
    await new Promise<void>((resolve) => {
      this.overlays.card({
        title: def?.title ?? 'The night ends',
        subtitle: ev.reason === '2:00 AM' ? '2:00 AM' : ev.reason,
        body: def?.epilogue ?? 'The rain goes on. The clock will come round again.',
        buttons: [{ label: 'Again', primary: true, run: () => resolve() }],
      });
    });
    this.overlays.closeCard();
    this.hud.toast('10:00 PM', 'info', 3000);
    this.nextLoop();
    await this.overlays.fade(false, 1200);
    this.ending = false;
  }

  nextLoop(): void {
    this.loop += 1;
    this.startLoop(this.loop);
  }

  private startLoop(loop: number): void {
    this.sim = createSim({ seed: this.seed, loop });
    this.attachBus();
    this.accumulator = 0;
    this.pendingWheel = undefined;
    this.inventoryKey = '';
    this.hud.clearCaptions();
    this.scene.resetHistory(this.world);
    this.hooks.onLoopStart?.(this.world, this);
  }

  async restartNight(): Promise<void> {
    this.overlays.closeCard();
    this.paused = false;
    this.ending = true;
    this.closeDialogue();
    await this.overlays.fade(true, 500);
    this.startLoop(this.loop);
    await this.overlays.fade(false, 500);
    this.ending = false;
  }

  /** Debug: rebuild the night up to a tick by replaying the input log. */
  scrubTo(tick: number): void {
    const commands = this.world.commands.filter((c) => c.tick <= tick);
    const sim = createSim({ seed: this.seed, loop: this.loop });
    for (const c of commands) sim.enqueue(c);
    sim.runUntil(tick);
    this.sim = sim;
    this.attachBus();
    this.accumulator = 0;
    this.paused = true;
    this.closeDialogue();
    this.hud.clearCaptions();
    this.scene.resetHistory(this.world);
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}
