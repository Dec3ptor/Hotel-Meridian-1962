import type { EventType, World, WorldEvent } from './types';
import { formatShort } from './clock';

export type Listener<T extends WorldEvent = WorldEvent> = (ev: T) => void;

/**
 * Typed event bus. The world log is the source of truth (it is state);
 * listeners are a side channel for rendering, audio, UI and debugging.
 */
export class EventBus {
  private listeners: Map<EventType | '*', Listener[]> = new Map();

  on<T extends EventType>(type: T, cb: Listener<Extract<WorldEvent, { type: T }>>): () => void {
    const list = this.listeners.get(type) ?? [];
    list.push(cb as Listener);
    this.listeners.set(type, list);
    return () => {
      const l = this.listeners.get(type);
      if (!l) return;
      const i = l.indexOf(cb as Listener);
      if (i >= 0) l.splice(i, 1);
    };
  }

  onAny(cb: Listener): () => void {
    const list = this.listeners.get('*') ?? [];
    list.push(cb);
    this.listeners.set('*', list);
    return () => {
      const l = this.listeners.get('*');
      if (!l) return;
      const i = l.indexOf(cb);
      if (i >= 0) l.splice(i, 1);
    };
  }

  dispatch(ev: WorldEvent): void {
    const specific = this.listeners.get(ev.type);
    if (specific) for (let i = 0; i < specific.length; i++) specific[i]!(ev);
    const any = this.listeners.get('*');
    if (any) for (let i = 0; i < any.length; i++) any[i]!(ev);
  }
}

function locText(loc: { kind: string; [k: string]: unknown }): string {
  switch (loc.kind) {
    case 'tile':
      return `floor ${loc.floor} (${loc.x},${loc.y})`;
    case 'agent':
      return `${loc.agent}${loc.concealed ? ' (concealed)' : ''}`;
    case 'fixture':
      return `${loc.fixture}`;
    default:
      return 'nowhere';
  }
}

/** One-line human text for an event, used by the CLI and the debug log. */
export function describeEvent(ev: WorldEvent): string {
  switch (ev.type) {
    case 'LoopStarted':
      return `Loop ${ev.loop} begins (seed ${ev.seed}).`;
    case 'WorldEvent':
      return ev.text;
    case 'Moved':
      return `${ev.agent} enters ${ev.to}${ev.via ? ` via ${ev.via}` : ''}.`;
    case 'ItemMoved':
      return `${ev.item} moved from ${locText(ev.from)} to ${locText(ev.to)}${ev.by ? ` by ${ev.by}` : ''}.`;
    case 'ItemChanged':
      return `${ev.item}.${ev.key} = ${String(ev.value)}${ev.by ? ` (${ev.by})` : ''}.`;
    case 'FixtureChanged':
      return `${ev.fixture}.${ev.key} = ${String(ev.value)}${ev.by ? ` (${ev.by})` : ''}.`;
    case 'DoorOpened':
      return `${ev.door} opened${ev.by ? ` by ${ev.by}` : ''}.`;
    case 'DoorClosed':
      return `${ev.door} closed${ev.by ? ` by ${ev.by}` : ''}.`;
    case 'DoorLocked':
      return `${ev.door} locked${ev.by ? ` by ${ev.by}` : ''}.`;
    case 'DoorUnlocked':
      return `${ev.door} unlocked${ev.by ? ` by ${ev.by}` : ''}.`;
    case 'Saw':
      return `${ev.agent} sees ${ev.target} in ${ev.room}${ev.detail ? ` (${ev.detail})` : ''}.`;
    case 'SawBody':
      return `${ev.agent} finds ${ev.body}'s body in ${ev.room}.`;
    case 'SawItem':
      return `${ev.agent} notices ${ev.item} in ${ev.room}.`;
    case 'NoticedMissing':
      return `${ev.agent} notices ${ev.item} is missing from ${ev.room}.`;
    case 'SawGesture':
      return `${ev.agent} sees ${ev.target} ${ev.gesture}.`;
    case 'Sound':
      return `[${ev.kind}] in ${ev.room}${ev.by ? ` (${ev.by})` : ''}${ev.text ? `: ${ev.text}` : ''}`;
    case 'Heard':
      return `${ev.agent} hears ${ev.kind} from ${ev.room}${ev.by ? ` (${ev.by})` : ''}.`;
    case 'Gesture':
      return `${ev.agent} ${ev.gesture}.`;
    case 'Said':
      return `${ev.speaker}${ev.to ? ` -> ${ev.to}` : ''}: ${ev.text}`;
    case 'Narration':
      return `(${ev.text})`;
    case 'Told':
      return `${ev.from} tells ${ev.to} ${ev.fact}=${String(ev.value)} (${ev.confidence.toFixed(2)}).`;
    case 'GoalChanged':
      return `${ev.agent} goal ${ev.from ?? '-'} -> ${ev.to ?? '-'}: ${ev.reason}`;
    case 'PlanStarted':
      return `${ev.agent} starts ${ev.goal}/${ev.plan}.`;
    case 'PlanAbandoned':
      return `${ev.agent} abandons ${ev.goal}/${ev.plan}: ${ev.reason}`;
    case 'PlanCompleted':
      return `${ev.agent} completes ${ev.goal}/${ev.plan}.`;
    case 'GoalFailed':
      return `${ev.agent} gives up on ${ev.goal}: ${ev.reason}`;
    case 'Used':
      return `${ev.agent} ${ev.action} ${ev.target}${ev.item ? ` with ${ev.item}` : ''} in ${ev.room}.`;
    case 'Took':
      return `${ev.agent} takes ${ev.item} from ${locText(ev.from)} in ${ev.room}.`;
    case 'Gave':
      return `${ev.from} gives ${ev.item} to ${ev.to} in ${ev.room}.`;
    case 'Dropped':
      return `${ev.agent} drops ${ev.item} at ${locText(ev.to)} in ${ev.room}.`;
    case 'Hid':
      return `${ev.agent} hides in ${ev.spot}.`;
    case 'Unhid':
      return `${ev.agent} comes out of ${ev.spot}.`;
    case 'Attacked':
      return `${ev.attacker} attacks ${ev.target}${ev.weapon ? ` with ${ev.weapon}` : ''} in ${ev.room}: ${ev.outcome}.`;
    case 'Died':
      return `${ev.agent} dies in ${ev.room} (${ev.cause}${ev.killer ? `, killer ${ev.killer}` : ''}).`;
    case 'Drugged':
      return `${ev.agent} is drugged (${ev.doses} dose${ev.doses === 1 ? '' : 's'}).`;
    case 'Incapacitated':
      return `${ev.agent} is ${ev.state}.`;
    case 'MoodChanged':
      return `${ev.agent} ${ev.key} ${ev.from} -> ${ev.to}: ${ev.reason}`;
    case 'Reaction':
      return `${ev.agent} reacts (${ev.reaction}) to ${ev.percept}.`;
    case 'Bloodied':
      return `${ev.agent} has blood on them.`;
    case 'Looked':
      return `${ev.agent} looks at ${ev.target}${ev.close ? '' : ' from a distance'}: ${ev.text}`;
    case 'ClueFound':
      return `Clue: ${ev.fact} (${ev.source}): ${ev.text}`;
    case 'Searched':
      return `${ev.agent} searches ${ev.target}: ${ev.found.length ? ev.found.join(', ') : 'nothing'}.`;
    case 'PickpocketFailed':
      return `${ev.agent} is caught trying to take ${ev.item} from ${ev.holder}.`;
    case 'ActionDone':
      return `${ev.action}${ev.target ? ` ${ev.target}` : ''}: done.`;
    case 'ActionFailed':
      return `${ev.action}${ev.target ? ` ${ev.target}` : ''}: ${ev.reason}.`;
    case 'Listening':
      return `${ev.agent} listens at ${ev.at} (${ev.room}).`;
    case 'Threatened':
      return `${ev.by} threatens ${ev.agent}${ev.weapon ? ` with ${ev.weapon}` : ''}.`;
    case 'Left':
      return `${ev.agent} ${ev.how}.`;
    case 'LoopEnded':
      return `Loop ends: ${ev.reason}${ev.ending ? ` [${ev.ending}]` : ''}.`;
  }
}

export function formatEventLine(ev: WorldEvent): string {
  return `${formatShort(ev.tick)} ${describeEvent(ev)}`;
}

export function formatEventLog(w: World, filter?: (ev: WorldEvent) => boolean): string {
  const out: string[] = [];
  for (const ev of w.log) {
    if (filter && !filter(ev)) continue;
    out.push(formatEventLine(ev));
  }
  return out.join('\n');
}

export function formatDecisionLog(w: World): string {
  return w.decisions.map((d) => `${formatShort(d.tick)} ${d.agent}: ${d.text}`).join('\n');
}
