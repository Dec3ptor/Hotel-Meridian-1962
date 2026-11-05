/**
 * Core simulation types. Everything inside `World` is plain data (no functions,
 * Maps or class instances) so a world can be JSON-cloned, diffed and stored.
 * Content (rooms, characters, plans, storylets) is static and referenced by id.
 */

export type CharacterId = 'voss' | 'vivian' | 'hale' | 'jimmy' | 'ruth' | 'walter' | 'player';
export const CHARACTER_IDS: readonly CharacterId[] = ['walter', 'voss', 'vivian', 'hale', 'jimmy', 'ruth', 'player'];

export type RoomId = string;
export type DoorId = string;
export type PortalId = string;
export type FixtureId = string;
export type ItemId = string;
export type GoalId = string;
export type PlanId = string;
export type FactKey = string;
export type StoryletId = string;
export type EndingId = string;

/** Game time as minutes since 10:00 PM (0..240). Content may also write 'h:mm'. */
export type GameTime = number | string;

export interface TilePos {
  floor: number;
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// World state
// ---------------------------------------------------------------------------

export type ItemLoc =
  | { kind: 'tile'; floor: number; x: number; y: number }
  | { kind: 'agent'; agent: CharacterId; concealed?: boolean }
  | { kind: 'fixture'; fixture: FixtureId }
  | { kind: 'void' };

export type Scalar = number | string | boolean;

export interface ItemState {
  loc: ItemLoc;
  state: Record<string, Scalar>;
}

export interface DoorState {
  open: boolean;
  locked: boolean;
}

export interface RoomState {
  lit: boolean;
  blood: boolean;
}

export interface FixtureState {
  state: Record<string, Scalar>;
}

export type BeliefValue = Scalar;

export interface Belief {
  value: BeliefValue;
  confidence: number; // 0..1
  source: string; // CharacterId | 'seen' | 'heard' | 'radio' | 'start' | 'inferred'
  tick: number;
}

export interface Mood {
  fear: number;
  anger: number;
  suspicion: number;
  drunk: number;
  resolve: number;
}

export type MoodKey = keyof Mood;

export interface Relationship {
  trust: number; // 0..10
  knowsSecret: boolean;
}

export type GoalStatus = 'idle' | 'active' | 'done' | 'failed';

export interface GoalProgress {
  status: GoalStatus;
  planIndex: number; // -1 when no plan chosen yet
  step: number;
  stepStartedTick: number;
  planStartedTick?: number;
  failedTick?: number;
  completedTick?: number;
  /** A persistent goal that finished instantly rests until this tick, so it cannot spin. */
  restUntil?: number;
}

export type Incapacity = 'drowsy' | 'asleep' | 'dead';

export interface AgentState {
  id: CharacterId;
  pos: TilePos;
  room: RoomId;
  facing: number; // 0 up, 1 right, 2 down, 3 left
  speed: number; // tiles per tick
  goalStates: Record<GoalId, GoalProgress>;
  current?: { goal: GoalId; plan: PlanId; step: number };
  beliefs: Record<FactKey, Belief>;
  mood: Mood;
  relationships: Record<string, Relationship>;
  inventory: ItemId[];
  busyUntil?: number;
  busyWith?: string;
  alive: boolean;
  incapacity?: Incapacity;
  hiddenIn?: FixtureId;
  flags: Record<string, Scalar>;
  // movement scratch (serializable)
  path: number[]; // cells remaining, index 0 = next cell
  pathTarget: number; // cell the path leads to, -1 none
  moveProgress: number;
  // perception scratch
  visibleMask: number; // bitmask of agent indexes currently visible (for Saw transitions)
  reactionCooldowns: Record<string, number>;
  lastItemScanTick: number;
}

export interface Decision {
  tick: number;
  agent: CharacterId;
  text: string;
}

export interface PlayerCommand {
  tick: number;
  action: string;
  args?: Record<string, Scalar>;
}

export interface World {
  seed: number;
  rng: number; // mulberry32 state
  tick: number;
  loop: number;
  rooms: Record<RoomId, RoomState>;
  doors: Record<DoorId, DoorState>;
  fixtures: Record<FixtureId, FixtureState>;
  items: Record<ItemId, ItemState>;
  agents: Record<CharacterId, AgentState>;
  flags: Record<string, Scalar>;
  scheduleFired: Record<string, true>;
  log: WorldEvent[];
  decisions: Decision[];
  commands: PlayerCommand[]; // input log (consumed commands are kept for replay)
  /** Sounds and gestures produced this tick, perceived at the start of the next. */
  pendingSounds: SoundRecord[];
  pendingGestures: GestureRecord[];
  /** Bumped whenever a door opens, closes, locks or unlocks (sound propagation cache key). */
  doorVersion: number;
  ended?: { tick: number; reason: string; ending?: EndingId };
}

export interface SoundRecord {
  kind: SoundKind;
  room: RoomId;
  cell: number;
  loudness: number;
  by?: CharacterId;
  text?: string;
  tick: number;
}

export interface GestureRecord {
  agent: CharacterId;
  gesture: GestureKind;
  tick: number;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type SoundKind =
  | 'speech'
  | 'argument'
  | 'scream'
  | 'gunshot'
  | 'knock'
  | 'bell'
  | 'creak'
  | 'glass_breaks'
  | 'thunder'
  | 'radio'
  | 'door_slam'
  | 'struggle'
  | 'footsteps';

export type GestureKind = 'smile' | 'shaking' | 'drops_glass' | 'glare' | 'nod';

export type AttackOutcome = 'killed' | 'shot_attacker' | 'scuffle' | 'failed';

export type WorldEvent =
  | { type: 'LoopStarted'; tick: number; seed: number; loop: number }
  | { type: 'WorldEvent'; tick: number; id: string; text: string }
  | { type: 'Moved'; tick: number; agent: CharacterId; from: RoomId; to: RoomId; via?: PortalId }
  | { type: 'ItemMoved'; tick: number; item: ItemId; from: ItemLoc; to: ItemLoc; by?: CharacterId }
  | { type: 'ItemChanged'; tick: number; item: ItemId; key: string; value: Scalar; by?: CharacterId }
  | { type: 'FixtureChanged'; tick: number; fixture: FixtureId; key: string; value: Scalar; by?: CharacterId }
  | { type: 'DoorOpened'; tick: number; door: DoorId; by?: CharacterId }
  | { type: 'DoorClosed'; tick: number; door: DoorId; by?: CharacterId }
  | { type: 'DoorLocked'; tick: number; door: DoorId; by?: CharacterId }
  | { type: 'DoorUnlocked'; tick: number; door: DoorId; by?: CharacterId }
  | { type: 'Saw'; tick: number; agent: CharacterId; target: CharacterId; room: RoomId; detail?: string }
  | { type: 'SawBody'; tick: number; agent: CharacterId; body: CharacterId; room: RoomId }
  | { type: 'SawItem'; tick: number; agent: CharacterId; item: ItemId; room: RoomId }
  | { type: 'NoticedMissing'; tick: number; agent: CharacterId; item: ItemId; room: RoomId }
  | { type: 'SawGesture'; tick: number; agent: CharacterId; target: CharacterId; gesture: GestureKind }
  | { type: 'Sound'; tick: number; kind: SoundKind; room: RoomId; loudness: number; by?: CharacterId; text?: string }
  | { type: 'Heard'; tick: number; agent: CharacterId; kind: SoundKind; room: RoomId; by?: CharacterId; text?: string }
  | { type: 'Gesture'; tick: number; agent: CharacterId; gesture: GestureKind }
  | { type: 'Said'; tick: number; speaker: CharacterId; to?: CharacterId | 'all'; topic?: string; storylet: StoryletId; text: string; room: RoomId }
  | { type: 'Narration'; tick: number; storylet: StoryletId; text: string; room: RoomId }
  | { type: 'Told'; tick: number; from: CharacterId; to: CharacterId; fact: FactKey; value: BeliefValue; confidence: number }
  | { type: 'GoalChanged'; tick: number; agent: CharacterId; from?: GoalId; to?: GoalId; reason: string }
  | { type: 'PlanStarted'; tick: number; agent: CharacterId; goal: GoalId; plan: PlanId }
  | { type: 'PlanAbandoned'; tick: number; agent: CharacterId; goal: GoalId; plan: PlanId; reason: string }
  | { type: 'PlanCompleted'; tick: number; agent: CharacterId; goal: GoalId; plan: PlanId }
  | { type: 'GoalFailed'; tick: number; agent: CharacterId; goal: GoalId; reason: string }
  | { type: 'Used'; tick: number; agent: CharacterId; target: string; action: string; item?: ItemId; room: RoomId }
  | { type: 'Took'; tick: number; agent: CharacterId; item: ItemId; from: ItemLoc; room: RoomId }
  | { type: 'Gave'; tick: number; from: CharacterId; to: CharacterId; item: ItemId; room: RoomId }
  | { type: 'Dropped'; tick: number; agent: CharacterId; item: ItemId; to: ItemLoc; room: RoomId }
  | { type: 'Hid'; tick: number; agent: CharacterId; spot: FixtureId }
  | { type: 'Unhid'; tick: number; agent: CharacterId; spot: FixtureId }
  | { type: 'Attacked'; tick: number; attacker: CharacterId; target: CharacterId; weapon?: ItemId; outcome: AttackOutcome; room: RoomId }
  | { type: 'Died'; tick: number; agent: CharacterId; killer?: CharacterId; cause: string; room: RoomId }
  | { type: 'Drugged'; tick: number; agent: CharacterId; doses: number }
  | { type: 'Incapacitated'; tick: number; agent: CharacterId; state: Incapacity }
  | { type: 'MoodChanged'; tick: number; agent: CharacterId; key: MoodKey; from: number; to: number; reason: string }
  | { type: 'Reaction'; tick: number; agent: CharacterId; reaction: string; percept: string }
  | { type: 'Bloodied'; tick: number; agent: CharacterId }
  | { type: 'LoopEnded'; tick: number; reason: string; ending?: EndingId };

export type EventType = WorldEvent['type'];

// ---------------------------------------------------------------------------
// Perception
// ---------------------------------------------------------------------------

export type Percept =
  | { kind: 'saw_agent'; who: CharacterId; room: RoomId; blood: boolean; weapon?: ItemId; intruder: boolean; isNew: boolean }
  | { kind: 'saw_body'; who: CharacterId; room: RoomId }
  | { kind: 'saw_item'; item: ItemId; room: RoomId }
  | { kind: 'item_missing'; item: ItemId; room: RoomId }
  | { kind: 'saw_gesture'; who: CharacterId; gesture: GestureKind }
  | { kind: 'heard'; sound: SoundKind; room: RoomId; by?: CharacterId; text?: string; loudness: number }
  | { kind: 'threatened'; by: CharacterId; weapon?: ItemId }
  | { kind: 'attacked'; by: CharacterId; weapon?: ItemId };

export type PerceptKind = Percept['kind'];

// ---------------------------------------------------------------------------
// Content definitions (static data; functions allowed here, not in World)
// ---------------------------------------------------------------------------

export interface Rect {
  x0: number;
  y0: number;
  x1: number; // inclusive
  y1: number; // inclusive
}

export interface RoomDef {
  id: RoomId;
  name: string;
  floor: number;
  rects: Rect[];
  /** Named standing spots used by plans. */
  spots: Record<string, { x: number; y: number }>;
  outdoor?: boolean;
  /** Tiles beyond this distance are invisible even when lit (outdoor darkness). */
  visibility?: number;
  /** Occupants: anyone else inside is an intruder, and occupants can work the door latch. */
  owners?: CharacterId[];
  /** Service areas; guests path around them unless told otherwise. */
  service?: boolean;
  lit?: boolean;
}

export interface DoorDef {
  id: DoorId;
  name: string;
  floor: number;
  tiles: { x: number; y: number }[];
  between: [RoomId, RoomId];
  kind: 'door' | 'archway';
  lockable?: boolean;
  key?: ItemId;
  /** Starts closed; passing agents open it. Private doors auto-close behind them. */
  autoClose?: boolean;
  startOpen?: boolean;
  startLocked?: boolean;
}

export interface PortalDef {
  id: PortalId;
  name: string;
  a: TilePos;
  b: TilePos;
  roomA: RoomId;
  roomB: RoomId;
  creaks?: boolean;
}

export interface WindowDef {
  id: string;
  inside: TilePos;
  insideRoom: RoomId;
  outside: TilePos;
  outsideRoom: RoomId;
  radiusInside: number;
  radiusOutside: number;
}

export interface ThinWallDef {
  rooms: [RoomId, RoomId];
}

export interface UseDef {
  /** Game minutes the agent is busy. */
  minutes?: number;
  /** Item required in the user's inventory, or `withItem` means "use item on". */
  requiresItem?: ItemId;
  effect?: (w: World, who: CharacterId, ctx: UseContext) => void;
  loud?: SoundKind;
  loudness?: number;
  text?: string;
}

export interface UseContext {
  target: FixtureId | ItemId;
  item?: ItemId;
  emit: (ev: WorldEvent) => void;
}

export interface FixtureDef {
  id: FixtureId;
  name: string;
  room: RoomId;
  tiles: { x: number; y: number }[];
  /** Tile an agent stands on to use this fixture (must be walkable). */
  at: { x: number; y: number };
  blocking?: boolean;
  hidingSpot?: boolean;
  container?: boolean;
  /** Container contents are visible to anyone in the room. */
  openContainer?: boolean;
  uses?: Record<string, UseDef>;
  description: string;
  state?: Record<string, Scalar>;
}

export interface ItemDef {
  id: ItemId;
  name: string;
  description: string;
  portable: boolean;
  weapon?: 'knife' | 'gun';
  loaded?: boolean;
  concealable?: boolean;
  start: ItemLoc;
  state?: Record<string, Scalar>;
  /** Key for which doors. */
  opens?: DoorId[] | 'all';
  uses?: Record<string, UseDef>;
  /** Clue facts this item proves when examined. */
  proves?: FactKey[];
}

export type Cond = (w: World, a: AgentState) => boolean;
export type ArgValue = Scalar | string[] | ((w: World, a: AgentState) => Scalar | string[] | undefined) | undefined;

export type StepVerb =
  | 'goTo'
  | 'wait'
  | 'take'
  | 'use'
  | 'give'
  | 'talk'
  | 'search'
  | 'hide'
  | 'lock'
  | 'unlock'
  | 'attack'
  | 'flee'
  | 'drop'
  | 'gesture';

export interface PlanStep {
  do: StepVerb;
  args?: Record<string, ArgValue>;
  /** Precondition, checked every tick while the step is active. */
  if?: Cond;
  ifReason?: string;
  /** Skip this step when already satisfied (used when a plan resumes). */
  skipIf?: Cond;
  /** For wait steps; receives the tick the step started. */
  until?: (w: World, a: AgentState, startedTick: number) => boolean;
  minutes?: number;
  notBefore?: GameTime;
  deadline?: GameTime;
  label?: string;
  /** Derived by buildStatic from notBefore/deadline; content leaves these unset. */
  nbTick?: number;
  dlTick?: number;
}

export interface PlanDef {
  id: PlanId;
  steps: PlanStep[];
  if?: Cond;
  ifReason?: string;
  onFail?: (w: World, a: AgentState) => void;
  onComplete?: (w: World, a: AgentState) => void;
}

export interface GoalDef {
  id: GoalId;
  name: string;
  priority: number | ((w: World, a: AgentState) => number);
  notBefore?: GameTime;
  deadline?: GameTime;
  active?: Cond;
  /** When true the goal is marked done without running further plans. */
  done?: Cond;
  persistent?: boolean;
  /** Minutes before a failed goal may be retried. Omit for never. */
  retryAfter?: number;
  /** Minutes a persistent goal rests after completing before it may run again. By default it only rests (one minute) when it completed in the same tick it started. */
  repeatAfter?: number;
  /** May interrupt a busy action (conversation, use). */
  urgent?: boolean;
  /** Derived by buildStatic from notBefore/deadline; content leaves these unset. */
  nbTick?: number;
  dlTick?: number;
}

export interface ReactionDef {
  id: string;
  on: PerceptKind | PerceptKind[];
  when?: (w: World, a: AgentState, p: Percept) => boolean;
  do: (w: World, a: AgentState, p: Percept, ctx: ReactionContext) => void;
  cooldownMinutes?: number;
  once?: boolean;
}

export interface ReactionContext {
  emit: (ev: WorldEvent) => void;
  decide: (text: string) => void;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  shortName: string;
  age: number;
  blurb: string;
  startRoom: RoomId;
  startSpot: string;
  speed: number;
  mood: Mood;
  beliefs: Record<FactKey, { value: BeliefValue; confidence: number }>;
  /** Facts this character will not volunteer in gossip. */
  secrets: FactKey[];
  relationships: Record<string, Relationship>;
  inventory: ItemId[];
  /** Starting agent flags (e.g. who is expected in one's room). */
  flags?: Record<string, Scalar>;
  /** Staff walk through service areas freely. */
  staff?: boolean;
  homeRoom: RoomId;
  homeSpot: string;
  goals: GoalDef[];
  plans: Record<GoalId, PlanDef[]>;
  reactions: ReactionDef[];
  /** Base chance per minute of volunteering gossip (0..1). */
  chattiness: number;
}

export type StoryletTrigger =
  | { topic: string }
  | { show: ItemId }
  | { give: ItemId }
  | { accuse: 'killer' | 'driver' }
  | { scene: string };

export type StoryletLine = string | { who: CharacterId; text: string };

export interface StoryletDef {
  id: StoryletId;
  speaker: CharacterId;
  listener?: CharacterId;
  trigger: StoryletTrigger;
  when?: (w: World, speaker: AgentState, listener: AgentState | undefined) => boolean;
  lines: StoryletLine[];
  effects?: (w: World, speaker: AgentState, listener: AgentState | undefined, ctx: StoryletContext) => void;
  priority: number;
  /** Game minutes both parties are busy. Defaults to a function of line count. */
  minutes?: number;
  loudness?: number;
  soundKind?: SoundKind;
  /** Mark facts the listener learns (applied with trust weighting). */
  tells?: { fact: FactKey; value: BeliefValue; confidence: number }[];
}

export interface StoryletContext {
  emit: (ev: WorldEvent) => void;
  decide: (agent: CharacterId, text: string) => void;
}

export interface ScheduleDef {
  id: string;
  at: GameTime;
  text: string;
  run?: (w: World, ctx: StoryletContext) => void;
  sound?: { kind: SoundKind; room: RoomId; loudness: number; text?: string };
}

export interface EndingDef {
  id: EndingId;
  title: string;
  epilogue: string;
  /** Higher wins when several endings match. */
  priority: number;
  when: (w: World) => boolean;
  /** Ends the loop immediately when it first becomes true. */
  immediate?: boolean;
}

export interface MapDef {
  width: number;
  height: number;
  floors: number;
  tileSize: number;
  rooms: RoomDef[];
  doors: DoorDef[];
  portals: PortalDef[];
  windows: WindowDef[];
  thinWalls: ThinWallDef[];
}

export interface Content {
  map: MapDef;
  fixtures: FixtureDef[];
  items: ItemDef[];
  characters: CharacterDef[];
  storylets: StoryletDef[];
  schedule: ScheduleDef[];
  endings: EndingDef[];
}

export interface SimConfig {
  loopMinutes: number;
  ticksPerMinute: number;
  ticksPerRealSecond: number;
}

export const DEFAULT_CONFIG: SimConfig = {
  loopMinutes: 240,
  ticksPerMinute: 25,
  ticksPerRealSecond: 10,
};
