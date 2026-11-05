# The Meridian

A top-down time-loop murder mystery for the web. One stormy night in 1962 at a fading art deco hotel, replayed from 10:00 PM to 2:00 AM until you understand it. The full design is in [SPEC.md](SPEC.md).

## Status: Phase 1 complete (simulation core, no graphics)

| Script | What it does |
| --- | --- |
| `npm test` | Vitest: default-night timeline, determinism, performance, navigation |
| `npm run sim` | One headless night; prints the event log, the decision log and the ending |
| `npm run sim -- --seed 7 --until 1:45 --all` | Other seeds, stop early, show every event (moves, doors, sightings) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run build` | Vite production build (the page just confirms the sim runs in a browser until Phase 3) |

## Layout

```
src/sim/        engine: world, clock, rng, events, nav (A*), perception, actions, storylets, endings, memory
src/sim/agents/ planner (goals/plans), beliefs, mood, reactions, gossip
src/content/    data: map, items and fixtures, six characters + player, storylets, schedule, endings
scripts/sim.ts  the CLI
tests/          headless tests
```

The simulation is the game. `World` is one plain JSON-serialisable object (clock, rooms, doors, items, agents, flags, event log, decision log, input log). Content is static data referenced by id. Every state change goes through `src/sim/actions.ts` and emits a typed event; every agent decision lands in the decision log with a reason.

## Phase 1 report

### What works

- **Default night.** With the player idle in Room 7, all 50 checked rows of the Section 7 timeline occur within ±2 game minutes, for seeds 1, 2, 3 and 17, and the loop ends in *The Default* (Voss stabbed by the Colonel at 1:39, Jimmy seen with blood on his cuff, Walter finds the body at 1:58). Nothing is scripted: each character has ranked goals with alternative plans, and the timeline is what those plans produce.
- **Determinism.** Same seed gives byte-identical event, decision and agent state; stepping tick by tick matches running in one go; the world survives a JSON round trip.
- **Speed.** A full 6,000-tick night simulates in about 120–150 ms on this container (the test requires < 200 ms). Paths are cached per (from, to, blocked doors, avoided rooms, avoided stairs, costly rooms); belief keys are precomputed; sound attenuation is memoised until a door changes.
- **Agents.** Perceive (sightlines per room, archways, doorways, windows, stairwells, lighting; sound over a room graph with per-link attenuation; gestures), react (generic rules plus per-character reactions), re-rank goals from mood and beliefs, check step preconditions and deadlines every tick, act. Plans fall through to alternatives with a logged reason (`01:06 vivian: abandoned DoseNightcap: tray not in kitchen`).
- **Butterfly plumbing is already live.** Shared resources (one knife, one tray, keys, the back stair), perception-driven beliefs, mood thresholds, trust-weighted gossip with sources, and the `DoseNightcap → DrinkItOff` fallback all run. During development, a timing bug that made Walter carry the tray off early produced exactly the spec's cascade: Vivian abandoned the dosing, her fear rose, and she went down to the bar.
- **Endings.** All twelve conditions are written in `src/content/endings.ts` and checked from state at loop end. Only *The Default* and *The Fixer Walks* can be reached before player verbs exist; the others read flags that Phase 2 and Phase 5 actions will set.
- **Memory.** `src/sim/memory.ts` defines the cross-loop structure and a pure merge; storage and the notebook arrive in Phase 5.

### What does not work yet (by design, later phases)

- No player verbs: the player is a perceivable agent with no goals. `Sim.enqueue()` and the command log exist; the dispatcher is Phase 2.
- No rendering, input, audio or UI.
- Gossip content is thin: characters share what they believe, filtered by secrets and trust, but there are only the storylets the default night needs plus one fallback line per character.

### Interpretations and choices

1. **Plans live in content, not in `World`.** The spec's `Agent` carries `goals` and `plans` with function preconditions, which cannot be serialised. Agents in `World` store goal progress (`goalStates`, `current`), beliefs, mood and inventory; the plan library is static per character and referenced by id. Content condition functions keep the spec signature `(world, agent)` and reach static data through an "active content" registry.
2. **Goal semantics.** `active` is a start condition; once a goal is under way it runs until its plan completes or fails, `done` holds, or a higher-priority goal outranks it. Interrupted goals restart their plan from step 0 when resumed, with `skipIf` on steps to pass over work already done. Persistent goals repeat; one that completes in the tick it started rests a minute so it cannot spin.
3. **Movement.** One tile per tick for everyone (configurable per character). Guests route around service rooms (kitchen, laundry) unless a plan says otherwise; staff do not. Timings in the Section 7 table were met by choosing when goals become available, not by teleporting.
4. **The tray.** "Walter leaves it on the counter when Ruth rings the desk bell" emerges from the bell interrupting a two-minute preparation; the aspirin errand keeps him out of the kitchen until Vivian is gone. He takes the tray up at 1:18.
5. **The towel.** The Colonel drops it down the chute from the corridor hatch, goes down the back stair to bury it in the laundry cart, then returns to Suite 2 by the grand staircase (his plan avoids the back stair on the way up), which creaks at 1:48.
6. **Letters.** Vivian keeps Voss's blackmail letters sewn into her suitcase lining (Suite 1). Voss's envelope, locked in the hotel safe at 10:15, holds her 1949 letters; she believes they are in Suite 3.
7. **Doors.** Private rooms (office, suites, Rooms 6 and 7) can be latched from inside without a key; other locks need a key or a master. Suite 3 is locked when Voss is in it until he tells Walter to leave it unlocked at 1:20.
8. **Windows and stairwells** give a glimpse (who is there), not detail (blood, a weapon); a body on the floor is not visible through a window.
9. **Drugs and violence.** One dose makes Voss drowsy 12 minutes after drinking; two doses kill. An attack on a drowsy or sleeping target succeeds quietly; an awake target holding a loaded gun shoots a non-gun attacker (the Self-Defence route); otherwise an armed attacker kills noisily and an unarmed one scuffles. Taking an item from a bloody corpse stains you.
10. **Lot and map.** The parking lot wraps the building (front drive north, rear lot and motor court south); the Colonel's car sits on the east side under Suite 3's window. Grid: 46×32 tiles per floor, 32 px tiles.
11. **Loop end.** The loop ends at exactly 2:00 AM (tick 6000); Walter reaches the body at about 1:58 because Ruth reports Jimmy's bloody cuff to him.
