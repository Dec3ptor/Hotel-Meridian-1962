/**
 * Storylet matching: the highest-priority storylet for (speaker, trigger)
 * whose conditions hold. Lines become Said/Narration events and speech
 * sounds; effects and `tells` change beliefs, mood and relationships.
 */
import { tell } from './agents/beliefs';
import { emitSound } from './actions';
import { decide, emit, S, type Static } from './registry';
import type { AgentState, CharacterId, StoryletDef, StoryletId, World } from './types';

export interface TalkResult {
  ok: boolean;
  minutes: number;
  storylet?: StoryletId;
  reason?: string;
}

function pick(w: World, s: Static, key: string, speaker: AgentState, listener: AgentState | undefined): StoryletDef | undefined {
  const list = s.storyletsByKey[key];
  if (!list) return undefined;
  for (const st of list) {
    if (st.listener && (!listener || st.listener !== listener.id)) continue;
    if (st.when && !st.when(w, speaker, listener)) continue;
    return st;
  }
  return undefined;
}

export function runStorylet(w: World, st: StoryletDef, speaker: AgentState, listener: AgentState | undefined, topic?: string): TalkResult {
  const s = S();
  const nav = s.nav;
  const to: CharacterId | 'all' = listener ? listener.id : 'all';
  for (const line of st.lines) {
    if (typeof line === 'string') {
      emit(w, { type: 'Narration', tick: w.tick, storylet: st.id, text: line, room: speaker.room });
      continue;
    }
    const who = w.agents[line.who]!;
    const addressee: CharacterId | 'all' = line.who === speaker.id ? to : speaker.id;
    emit(w, { type: 'Said', tick: w.tick, speaker: line.who, to: addressee, topic, storylet: st.id, text: line.text, room: who.room });
    emitSound(w, st.soundKind ?? 'speech', who.room, nav.cellOf(who.pos), st.loudness ?? 1, line.who, line.text);
  }
  if (st.tells) {
    const targets: CharacterId[] = [];
    if (listener) targets.push(listener.id);
    else {
      for (const id of s.characterOrder) {
        const o = w.agents[id]!;
        if (id !== speaker.id && o.alive && o.room === speaker.room) targets.push(id);
      }
    }
    for (const t of targets) for (const f of st.tells) tell(w, speaker.id, t, f.fact, f.value, f.confidence);
  }
  if (st.effects) {
    st.effects(w, speaker, listener, { emit: (ev) => emit(w, ev), decide: (agent, text) => decide(w, agent, text) });
  }
  w.flags[`storylet:${st.id}`] = w.tick;
  const count = Number(w.flags[`storyletCount:${st.id}`] ?? 0) + 1;
  w.flags[`storyletCount:${st.id}`] = count;
  const minutes = st.minutes ?? Math.max(0.5, st.lines.length * 0.4);
  return { ok: true, minutes, storylet: st.id };
}

/** A speaker addresses a listener (or the room when undefined) on a topic. */
export function converse(w: World, speakerId: CharacterId, listenerId: CharacterId | undefined, topic: string): TalkResult {
  const s = S();
  const speaker = w.agents[speakerId]!;
  const listener = listenerId ? w.agents[listenerId] : undefined;
  const st = pick(w, s, `${speakerId}|topic|${topic}`, speaker, listener);
  if (!st) {
    decide(w, speakerId, `no storylet for topic '${topic}'${listenerId ? ` with ${listenerId}` : ''}; using fallback`);
    const fallback = pick(w, s, `${speakerId}|topic|*`, speaker, listener);
    if (fallback) return runStorylet(w, fallback, speaker, listener, topic);
    emit(w, {
      type: 'Said',
      tick: w.tick,
      speaker: speakerId,
      to: listenerId ?? 'all',
      topic,
      storylet: 'fallback',
      text: '...',
      room: speaker.room,
    });
    return { ok: true, minutes: 0.5, storylet: 'fallback', reason: `no storylet for ${topic}` };
  }
  return runStorylet(w, st, speaker, listener, topic);
}

/** Showing or giving an item, or accusing: the listener is the speaker of the response. */
export function respondTo(w: World, responderId: CharacterId, kind: 'show' | 'give' | 'accuse', key: string, byId: CharacterId): TalkResult {
  const s = S();
  const responder = w.agents[responderId]!;
  const by = w.agents[byId];
  const st = pick(w, s, `${responderId}|${kind}|${key}`, responder, by) ?? pick(w, s, `${responderId}|${kind}|*`, responder, by);
  if (!st) {
    decide(w, responderId, `no storylet for ${kind} '${key}'; using fallback`);
    emit(w, { type: 'Said', tick: w.tick, speaker: responderId, to: byId, topic: `${kind}:${key}`, storylet: 'fallback', text: '...', room: responder.room });
    return { ok: true, minutes: 0.5, storylet: 'fallback', reason: `no storylet for ${kind} ${key}` };
  }
  return runStorylet(w, st, responder, by, `${kind}:${key}`);
}

/** Authored scenes between two agents already in position. */
export function runScene(w: World, scene: string, speakerId: CharacterId, listenerId?: CharacterId): TalkResult {
  const s = S();
  const speaker = w.agents[speakerId]!;
  const listener = listenerId ? w.agents[listenerId] : undefined;
  const st = pick(w, s, `${speakerId}|scene|${scene}`, speaker, listener);
  if (!st) return { ok: false, minutes: 0, reason: `no scene ${scene} for ${speakerId}` };
  return runStorylet(w, st, speaker, listener, scene);
}

export function storyletRan(w: World, id: StoryletId): boolean {
  return w.flags[`storylet:${id}`] !== undefined;
}
