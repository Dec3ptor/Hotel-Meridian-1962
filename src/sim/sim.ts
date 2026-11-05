/**
 * The Sim ties the pieces together: one fixed tick advances the schedule,
 * player commands, perception, reactions, planning and endings. It runs with
 * no renderer; rendering, audio and UI subscribe to the event bus.
 */
import { tickIncapacity } from './actions';
import { applyCommand, playerTick } from './commands';
import { gossipPass } from './agents/gossip';
import { decayMoods } from './agents/mood';
import { think } from './agents/planner';
import { react } from './agents/reactions';
import { loopTicks } from './clock';
import { checkImmediateEndings, detectEnding } from './endings';
import { EventBus } from './events';
import { createScratch, perceive, type PerceiveScratch } from './perception';
import { activate, buildStatic, decide, emit, type Static } from './registry';
import { DEFAULT_CONFIG, type Content, type Percept, type PlayerCommand, type SimConfig, type World } from './types';
import { createWorld } from './world';

export type CommandHandler = (sim: Sim, cmd: PlayerCommand) => void;

export class Sim {
  readonly s: Static;
  readonly bus = new EventBus();
  readonly cfg: SimConfig;
  readonly loopTicks: number;
  world: World;
  private percepts: Percept[] = [];
  private scratch: PerceiveScratch;
  private queued: PlayerCommand[] = [];
  private commandHandler: CommandHandler | undefined;

  constructor(content: Content, seed: number, loop = 1, cfg: SimConfig = DEFAULT_CONFIG) {
    this.s = buildStatic(content);
    this.cfg = cfg;
    this.loopTicks = loopTicks(cfg);
    activate(this.s, this.bus);
    this.world = createWorld(this.s, seed, loop);
    this.scratch = createScratch(this.s);
    this.commandHandler = applyCommand;
  }

  /** Phase 2 installs the verb dispatcher here. */
  setCommandHandler(h: CommandHandler): void {
    this.commandHandler = h;
  }

  /** Queue a player command; it is consumed at its tick (or the next tick if in the past). */
  enqueue(cmd: PlayerCommand): void {
    this.queued.push(cmd);
    this.queued.sort((a, b) => a.tick - b.tick);
  }

  private runSchedule(w: World): void {
    for (const ev of this.s.schedule) {
      if (ev.tick > w.tick) break;
      if (w.scheduleFired[ev.id]) continue;
      w.scheduleFired[ev.id] = true;
      emit(w, { type: 'WorldEvent', tick: w.tick, id: ev.id, text: ev.text });
      if (ev.sound) {
        const room = this.s.rooms[ev.sound.room];
        const spot = room ? Object.values(room.spots)[0] : undefined;
        const cell = room && spot ? this.s.nav.cell(room.floor, spot.x, spot.y) : 0;
        w.pendingSounds.push({ kind: ev.sound.kind, room: ev.sound.room, cell, loudness: ev.sound.loudness, text: ev.sound.text, tick: w.tick });
        emit(w, { type: 'Sound', tick: w.tick, kind: ev.sound.kind, room: ev.sound.room, loudness: ev.sound.loudness, text: ev.sound.text });
      }
      if (ev.run) ev.run(w, { emit: (e) => emit(w, e), decide: (agent, text) => decide(w, agent, text) });
    }
  }

  private consumeCommands(w: World): void {
    while (this.queued.length > 0 && this.queued[0]!.tick <= w.tick) {
      const cmd = this.queued.shift()!;
      const applied = { ...cmd, tick: w.tick };
      w.commands.push(applied);
      if (this.commandHandler) this.commandHandler(this, applied);
    }
  }

  private endLoop(w: World, reason: string, ending: string | undefined): void {
    w.ended = { tick: w.tick, reason, ending };
    emit(w, { type: 'LoopEnded', tick: w.tick, reason, ending });
  }

  step(): void {
    const w = this.world;
    if (w.ended) return;
    activate(this.s, this.bus);
    w.tick++;
    this.runSchedule(w);
    this.consumeCommands(w);
    const order = this.s.characterOrder;
    // 1-2: perceive and react, all agents, before anyone acts.
    for (let i = 0; i < order.length; i++) {
      const a = w.agents[order[i]!]!;
      perceive(w, this.s, a, this.percepts, this.scratch);
      if (this.percepts.length > 0) react(w, this.s, a, this.percepts);
    }
    w.pendingSounds.length = 0;
    w.pendingGestures.length = 0;
    // The player acts first so agents see the result next tick.
    playerTick(w, this.s);
    // 3-5: re-rank, check, act.
    for (let i = 0; i < order.length; i++) {
      const id = order[i]!;
      tickIncapacity(w, id);
      think(w, this.s, w.agents[id]!);
    }
    if (w.tick % this.cfg.ticksPerMinute === 0) {
      decayMoods(w);
      gossipPass(w, this.s);
    }
    const immediate = checkImmediateEndings(w, this.s);
    if (immediate) {
      this.endLoop(w, 'ending triggered', immediate);
      return;
    }
    const player = w.agents.player;
    if (player && !player.alive) {
      this.endLoop(w, 'the player died', detectEnding(w, this.s));
      return;
    }
    if (w.tick >= this.loopTicks) {
      this.endLoop(w, '2:00 AM', detectEnding(w, this.s));
    }
  }

  run(ticks: number): void {
    for (let i = 0; i < ticks && !this.world.ended; i++) this.step();
  }

  runUntil(tick: number): void {
    while (this.world.tick < tick && !this.world.ended) this.step();
  }

  runNight(): void {
    this.runUntil(this.loopTicks);
  }

  /** Start the next loop from the initial state with the same seed. */
  resetLoop(): void {
    const loop = this.world.loop + 1;
    this.world = createWorld(this.s, this.world.seed, loop);
    this.queued.length = 0;
  }
}

export interface CreateSimOptions {
  seed?: number;
  content?: Content;
  loop?: number;
  config?: SimConfig;
}

let defaultContentLoader: (() => Content) | undefined;

/** The default content registers itself so engine callers need not import it. */
export function registerDefaultContent(loader: () => Content): void {
  defaultContentLoader = loader;
}

export function createSim(opts: CreateSimOptions = {}): Sim {
  let content = opts.content;
  if (!content) {
    if (!defaultContentLoader) {
      throw new Error('No content: pass `content` or import src/content to register the default.');
    }
    content = defaultContentLoader();
  }
  return new Sim(content, opts.seed ?? 1, opts.loop ?? 1, opts.config ?? DEFAULT_CONFIG);
}
