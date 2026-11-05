# The Meridian

A top-down time-loop murder mystery for the web. One stormy night in 1962 at a fading art deco hotel, replayed from 10:00 PM to 2:00 AM until you understand it. The full design is in [SPEC.md](SPEC.md).

**Play it:** https://dec3ptor.github.io/Hotel-Meridian-1962/ (deployed by GitHub Actions from this branch; see `.github/workflows/pages.yml`).

## Status: all six phases built

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm test` | Vitest: default night, determinism, performance, navigation, butterfly cascades, every ending, response coverage |
| `npm run sim` | One headless night; prints the event log, the decision log and the ending (`-- --seed 7 --until 1:45 --all`) |
| `npm run build` | Production build into `dist/` |
| `npm run budget` | Checks the gzipped JavaScript against the 400 KB budget |
| `npm run smoke` | Builds, serves and drives the game in headless Chromium at phone and desktop sizes, with screenshots |
| `npm run typecheck` | `tsc --noEmit` (strict) |

## How to play

- Tap or click the floor to walk. Tap a person, object or door to walk there and open the verb wheel. Long-press or right-click to look without walking.
- The tray at the bottom holds what you carry: tap a slot (or press 1 to 8) then tap a target to use the item on it, or drag the item onto the target. Swipe the tray up to expand it.
- Talk opens the dialogue panel: Ask about topics you have learned, Tell people things (true or bluffed), Show items, Accuse. Space skips a line.
- Wait (T) fast-forwards until something happens near you. N opens the notebook. Esc pauses. C recentres. Pinch or scroll to zoom. The backtick opens the debug overlay.
- The night ends at 2:00 AM, when you die, or when an ending triggers. The world resets; the notebook does not.

## Layout

```
src/sim/        engine: world, clock, rng, events, nav (A*), perception, actions, commands (player verbs),
                storylets, endings, memory, whatchanged (loop summary)
src/sim/agents/ planner (goals/plans), beliefs, mood, reactions, gossip
src/content/    data: map, items and fixtures, six characters + player, storylets (night + player), dialogue
                topics/claims/facts, schedule, endings
src/render/     PixiJS scene: static geometry, characters, items, lighting, rain, camera, picking
src/ui/         DOM overlay: HUD, verb wheel, dialogue, notebook, overlays, title, styles
src/input/      pointer events (mouse, touch, pen), keyboard
src/audio/      synthesised rain, thunder, radio, footsteps, creak, clock, stings
src/game/       the controller (fixed-step loop, commands, loop reset), storage
src/debug/      agent inspector, logs, timeline scrubber
scripts/        sim CLI, smoke test, bundle budget
tests/          headless tests
```

The simulation is the game. `World` is one plain JSON-serialisable object; content is static data referenced by id; every state change goes through `src/sim/actions.ts` and emits a typed event; every agent decision lands in the decision log with a reason.

## Phase reports

### Phase 1: simulation core

- With the player idle, 50 checked rows of the Section 7 timeline occur within ±2 game minutes for seeds 1, 2, 3 and 17, and the loop ends in *The Default*. Nothing is scripted: each character has ranked goals with alternative plans.
- The same seed gives byte-identical event, decision and agent state; a night survives a JSON round trip; a full 6,000-tick night simulates in roughly 90 to 150 ms.
- Interpretations: plans live in content and agents store only progress (functions cannot be serialised); `active` is a goal's start condition and `done` stops it; interrupted goals restart their plan with `skipIf` passing over finished work; guests path around service rooms; windows and stairwells give a glimpse, not detail; one dose makes Voss drowsy twelve minutes after drinking and two kill; the loop ends at exactly 2:00 AM.

### Phase 2: player verbs and butterfly tests

- Verbs are sim commands (move, look, take, use, give, show, talk, tell, accuse, listen, hide, follow, drop, wait) queued as pending actions that walk the player to their target. Pickpocketing fails when the holder can see you. Looking closely at evidence records clue facts.
- The cast reacts to the player: owners see off intruders and lock up, anyone notices being followed, Voss orders strangers out of Suite 3, the Colonel changes target when shown proof, silences or flees from a witness, Ruth confronts Jimmy about Voss, Walter marks a suspect.
- All five spec cascades pass as scripted input logs, with no special-case code. Replaying a log reproduces the night exactly.

### Phase 3: rendering and desktop play

- Procedural art for both floors baked into per-floor textures; cut-away walls around the player's room; dimmed neighbours; doors with lock marks; item glyphs; characters readable by silhouette and colour; a darkness layer with lamp light cut out and storm flicker; rain over the lot; an easing camera with 0.75 to 1.5 zoom.
- A fixed 10-tick-per-second loop with interpolated rendering, Wait at 20x, dialogue at quarter speed, pause when the tab is hidden, and loop reset with a fade and an ending card. HUD, tray, verb wheel, dialogue panel, toasts and captions are DOM.
- Debug overlay: agent inspector, decision and event logs, and a timeline scrubber that rebuilds the night from the input log.
- Frame rate cannot be measured honestly in this container (software GL), so `npm run smoke` reports what headless Chromium manages and checks for errors; the rendering work per frame is a handful of containers and one screen-sized render texture.

### Phase 4: mobile landscape

- Safe-area insets, 44 px targets and 56 px wheel buttons, pointer events for every input, pinch zoom, swipe-to-expand tray, a rotate overlay that pauses the game in portrait, fullscreen with a landscape orientation lock (refusals ignored), `touch-action: none`, and a web app manifest with icons.
- Not verified on a real phone from here; the smoke test runs the phone viewport with touch emulation.

### Phase 5: memory, notebook and endings

- Cross-loop memory (facts, clues, witnessed events, what people said, theories, endings) is merged at loop end and saved to localStorage behind try/catch. Each night starts with what you learned, which unlocks topics and the safe. The notebook has People (names hidden until revealed), a Timeline merged across nights, a Connections board and Theories that light up when proven.
- `tests/endings.test.ts` reaches all twelve endings from input logs. Witnesses learn who killed whom; the Colonel confronts the driver only once armed and returns if turned away; a blow needs the target within arm's reach.

### Phase 6: content depth and polish

- Every character answers every topic, claim, item and accusation with authored lines (a coverage test enforces it); fallbacks have variants; every fixture has a verb beyond Look.
- Mood glyphs above heads, a title screen, a settings menu (text size, text speed, volumes, reduced motion, high-contrast outlines, a hold-to-highlight button), and synthesised audio: rain louder outdoors and by windows, a positional jazz radio, footsteps by floor, the creaking step, a clock tick that quickens after 1:30, stings for clues and the reset.
- After a night with any input, the ending card lists what changed against the default night, generated from room timelines and abandoned plans.
- Budget: about 240 KB of gzipped JavaScript (limit 400 KB).

## Known limits

- No sprite sheets yet; everything is drawn from shapes.
- The what-changed summary is heuristic and lists at most seven differences.
- The deploy workflow expects GitHub Pages to be served from Actions; the first run enables it when permissions allow.
