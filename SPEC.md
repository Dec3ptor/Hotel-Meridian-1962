# The Meridian — Claude Code Build Prompt

5 Nov 2026 · benjamin foote

## How to use this prompt

Paste everything below this section into Claude Code in an empty folder, or save it as SPEC.md in the repo and tell Claude Code: "Read SPEC.md and start Phase 1." The build is split into phases with acceptance criteria. Ask Claude Code to stop after each phase so you can play it before moving on.

You are building "The Meridian", a top-down time-loop murder mystery for the web. Read this whole spec before writing code. Work in the phases listed at the end, one phase at a time. After each phase, run the tests, run the game, and report what works, what doesn't, and anything in this spec you had to interpret. Don't skip ahead to art or polish.

## 1. Game overview and pillars

The player is a stranded guest at the Hotel Meridian, a fading 1920s art deco hotel, on a stormy night in 1962. A man is murdered at about 1:40am. Every loop runs from 10:00pm to 2:00am game time (about 10 real minutes), then resets. The world resets; what the player has learned does not. The camera looks straight down on the building, like Twelve Minutes, with walls cut away so you can see into rooms.

Pillars

1. **Everything reacts.** Characters are goal-driven agents, not scripts. Any player action that changes the world (moving an object, locking a door, telling someone something, being seen somewhere) can change what characters believe and do. Cascades must emerge from rules, not from hand-written branches.
2. **Knowledge is progression.** The player gets no stats or upgrades. Progress is knowing codes, names, timings and secrets, which unlocks new actions on later loops.
3. **Never say "you can't do that."** Every verb on every object and character has at least a fallback reaction.
4. **A fair mystery.** Motives never change between loops. Only means, timing and outcomes change. The same seed and the same player inputs always produce the same night.
5. **Fast and touch-first.** 60fps on a mid-range phone in landscape, playable with one thumb, plus mouse and keyboard on desktop.

No LLMs or external AI services. All character behaviour is plain deterministic code.

## 2. Tech stack and performance targets

Stack

- TypeScript (strict), Vite, PixiJS v8 for WebGL rendering. No other game framework.
- Vitest for simulation tests. Tests run headless with no renderer.
- No backend. Static build deployable to any static host.
- Content (rooms, objects, characters, plans, dialogue, storylets) lives in typed TypeScript data files, not in engine code.

Performance budget

| Target | Value |
| --- | --- |
| Frame rate | 60fps on a mid-range Android phone (e.g. Pixel 6a), 120fps-capable on desktop |
| Simulation | Fixed 10 ticks per real second, decoupled from rendering |
| Initial load | Under 2 seconds on 4G; JS bundle under 400 KB gzipped, excluding audio |
| Memory | Under 150 MB |
| Device pixel ratio | Capped at 2 |

Rules for staying fast

- Render static geometry (floors, walls, furniture) once per room into cached textures. Only characters, doors, items, lights and effects redraw per frame.
- No allocations in the per-frame or per-tick hot path. Pool objects and reuse arrays.
- Pathfinding is A* on a coarse tile grid, cached per (from, to) pair and invalidated only when a door's state changes.
- Pause the simulation and rendering on visibilitychange when the tab is hidden.
- Lazy-load audio after first input.
- Any browser storage access is wrapped in try/catch; the game must run if storage is unavailable.

## 3. Architecture

The simulation is the game; rendering only displays it. The simulation must run with no renderer, so a whole night can be simulated in a test in milliseconds.

Core rules

- World is one plain, serializable state object: clock, rooms, doors (open/locked), item locations, character states, flags, and an event log.
- The simulation advances in fixed ticks. The sim runs 10 ticks per real second and one tick is 2.4 game seconds, so a 240-minute night is 6,000 ticks and about 10 real minutes. Keep loop length as one config value. A "Wait" action fast-forwards ticks at up to 20x.
- All randomness comes from a seeded PRNG stored in World. Same seed + same input log = identical night.
- Player input is recorded as {tick, action} commands. The sim consumes commands; the UI never mutates World directly.
- Every state change emits a typed event on an event bus (ItemMoved, DoorLocked, Saw, Heard, Told, PlanAbandoned, Died...). Rendering, audio, UI and the debug log subscribe to events.
- Every agent decision is written to a decision log with a reason string, e.g. `01:12 Vivian abandoned DoseNightcap: tray not in kitchen.`

Folder structure

```
src/
  sim/          # pure logic, no DOM, no Pixi
    world.ts, clock.ts, rng.ts, events.ts
    nav.ts          # tile grid + A*
    perception.ts   # who sees/hears what
    agents/         # goals, planner, beliefs, mood, gossip
    actions.ts      # verbs as state transitions
    storylets.ts
    endings.ts
    memory.ts       # cross-loop player knowledge
  content/      # data only
    map.ts, rooms.ts, items.ts
    characters/ (voss.ts, vivian.ts, hale.ts, jimmy.ts, ruth.ts, walter.ts)
    dialogue/, storylets/, endings.ts
  render/       # Pixi scene, camera, lighting, sprites
  ui/           # HUD, verb wheel, inventory, notebook, dialogue (DOM overlay)
  input/        # pointer, touch gestures, keyboard
  audio/
  debug/        # timeline viewer, agent inspector, decision log panel
tests/
```

UI panels (dialogue, notebook, menus) are a DOM overlay over the canvas, not drawn in Pixi. DOM text is sharper, more accessible and easier to lay out for different screen sizes.

## 4. The world: the Hotel Meridian

A two-storey art deco hotel built in 1926, now shabby. The highway moved; the hotel is half empty. A cheap motor-court wing was added out back in 1955. A flash flood washes out the only bridge at 10:05pm and the phone lines go dead at 10:10pm, so nobody can leave or call out.

Build the map on a tile grid (suggest 32px tiles). Two floors; stairs and the laundry chute connect them. Every room has doors with an open/closed/locked state and a key item if lockable. Define a sightline rule per room: who in a room can see whom, plus which windows or doorways let characters see into adjacent spaces.

Ground floor

| # | Space | Interactable objects and what they hide |
| --- | --- | --- |
| 1 | Lobby and front desk | Guest ledger (Vivian signed as "Mrs. V. Marsh"); brass key rack (shows occupied rooms; a key can be taken); dead switchboard with Walter's notepad (Suite 3 called out at 9:52pm); lost-and-found drawer (Ruth's earring); service bell |
| 2 | Lounge bar | Piano and bench (sheet music with a phone number); ashtrays (lipstick on Vivian's brand); bar tab book (who bought whom drinks); radio (11:15pm bulletin about the 1949 hit-and-run being reopened); liquor shelf |
| 3 | Clerk's office | 1949 party photos on the wall (young Vivian); hotel safe (Voss's envelope; combination needed); Walter's coat (cash envelope from Voss); spare master key |
| 4 | Kitchen | Knife block (one knife gone after 12:40am); nightcap tray (prepared 1:05am for Suite 3); back door to the parking lot (unlocked); sink |
| 5 | Laundry and back stair | Laundry carts (hiding spot); chute exit (items dropped upstairs land here); back stair to the upstairs corridor that avoids the lobby |
| 6 | Motor court Room 6 (Jimmy and Ruth) | Ruth's handbag (birth certificate naming Vivian); Jimmy's jacket (press pass, camera); thin wall to Room 7 |
| 7 | Motor court Room 7 (player) | Player's suitcase; bed; window onto the lot; notebook on the desk (the in-world memory journal); wall to Room 6 (Listen) |
| 8 | Parking lot (outdoor, rain) | Voss's Cadillac (glovebox: safe combination written as a phone number); Vivian's car (old unrepaired dent on front fender); the Colonel's car (he sits in it 12:50 to 1:10am); puddles (fresh footprints after someone passes) |

Upstairs

| # | Space | Interactable objects and what they hide |
| --- | --- | --- |
| 9 | Grand staircase and corridor | Creaking step (anyone using the main stair is heard in the lobby); laundry chute hatch (hide items, or drop to laundry); window over the parking lot |
| 10 | Suite 1 (Vivian) | Vanity with sleeping pills (bottle count changes); blackmail letters sewn in the suitcase lining; baby photograph in her compact |
| 11 | Suite 2 (Colonel Hale) | Service revolver in bedside drawer (loaded red herring); newspaper clippings about the 1949 crash; notebook tracking Voss's movements |
| 12 | Suite 3 (Voss) | Briefcase (empty sample cases plus the blackmail ledger); undeveloped film; half-written telegram: "All parties present. Final settlement tonight."; Voss's own small pistol in his coat; wardrobe (hiding spot) |

Items the player can carry are marked portable in data. Large objects (piano, cars, safe) are fixtures with their own verbs. Hiding spots (wardrobe, laundry carts, under the bed in Room 7) let the player watch events unseen.

## 5. Backstory and cast

The hidden truth. In 1949, after a party at the Meridian, the young actress Vivian Lane drove drunk on the coast road and killed a 19-year-old woman, Clara Hale. Leonard Voss, a fixer, made it disappear: he paid off a deputy and hid Vivian's car. He has blackmailed her for 13 years. Tonight Voss has arranged a "final settlement": he lured Vivian here, brought his photographer Jimmy to catch her meeting the daughter she gave up, and plans to sell the story either way. He does not know the Colonel followed him.

The key false belief that drives the default murder: Colonel Hale believes Voss was driving the car that killed his daughter. If the player shows him proof that Vivian was driving, his target changes.

| Character | Room | Wants tonight (ranked goals) | Secret | Starting beliefs |
| --- | --- | --- | --- | --- |
| Leonard Voss, 54, the victim. Smooth "salesman" | Suite 3 | 1. Collect a final payment from Vivian at 1:00am. 2. Get Jimmy's photos. 3. Leave at dawn | Blackmails several people; ledger in briefcase; carries a small pistol | Nobody here can touch him; Walter is loyal for cash |
| Vivian Lane, 47, faded film actress | Suite 1, as "Mrs. V. Marsh" | 1. Get the letters back. 2. Avoid being recognised. 3. Secretly, see her daughter once | Was the driver in 1949; gave up a daughter in 1950 | Voss keeps the letters in Suite 3; nobody else knows her |
| Colonel Arthur Hale, 66, retired army | Suite 2 | 1. Make the man who killed Clara pay. 2. Confirm Voss was driving first | Tracked Voss across three states; came here to kill him | Voss was driving; Vivian is just a guest |
| Ruth Carter, 24, nervous young woman | Room 6 | 1. Meet her birth mother (Vivian). 2. Keep Jimmy happy | Adopted; found a birth certificate naming Vivian | Jimmy brought her here as a romantic getaway |
| Jimmy Doyle, 28, "salesman" boyfriend | Room 6 | 1. Get the photos and his pay from Voss. 2. Keep Ruth from finding out. 3. Get out clean | Works for Voss as a photographer; befriended Ruth because Voss told him to | Voss will pay tonight; Ruth suspects nothing |
| Walter Pike, 71, night clerk since 1931 | Front desk / office | 1. Keep the hotel calm. 2. Keep Voss's money coming. 3. Protect Vivian (he was fond of her in '49) | Helped hide Vivian's car in 1949; passes Voss's messages for cash | Everyone's secrets are safe if he stays quiet |
| The player | Room 7 | Survive the night and find out what's going on | None at start; unlocks over loops | Knows nothing |

Relationship web (what each knows about the others at 10:00pm; store as data so beliefs can change): Voss knows everyone's secret except the Colonel's. Walter knows Vivian and Voss. Vivian knows Voss and (by face) Walter. Jimmy knows Voss. Ruth knows Vivian's name but not her face. The Colonel knows Voss by face only.

## 6. Agent AI and the butterfly effect

This is the most important system. Characters are agents that perceive, believe, want and plan. There are no hand-written "if player does X" branches. Cascades come from agents reacting reasonably to a changed world.

Agent data model

```ts
interface Agent {
  id: CharacterId;
  pos: TilePos; room: RoomId;
  goals: Goal[];                 // ranked; priority can change with mood/beliefs
  plans: Record<GoalId, Plan[]>; // alternative plans per goal, tried in order
  current?: { goal: GoalId; plan: PlanId; step: number };
  beliefs: Record<FactKey, Belief>;  // {value, confidence, source, tick}
  mood: { fear: number; anger: number; suspicion: number; drunk: number; resolve: number }; // 0..10
  relationships: Record<CharacterId, { trust: number; knowsSecret: boolean }>;
  inventory: ItemId[];
  busyUntil?: number;
}

interface PlanStep {
  do: 'goTo' | 'wait' | 'take' | 'use' | 'give' | 'talk' | 'search' | 'hide' | 'lock' | 'unlock' | 'attack' | 'flee';
  args: Record<string, unknown>;
  if?: (w: World, a: Agent) => boolean;   // precondition, checked every tick while active
  until?: (w: World, a: Agent) => boolean; // for wait steps
  notBefore?: GameTime; deadline?: GameTime;
}
```

Each tick, per agent

1. **Perceive.** Update beliefs from what is visible in the same room and through doorways/windows (people present, items present or missing, someone carrying a knife, blood). Hear sounds within range (creaking step, argument, gunshot, scream). Perception is filtered by sightline rules and lighting.
2. **React.** Some perceptions trigger immediate reactions that pre-empt plans: seeing a body, being threatened, catching someone in their room, noticing their key is gone.
3. **Re-rank goals.** Mood and beliefs adjust goal priority. Thresholds can swap goals entirely (Vivian at fear 8+ switches from "recover letters" to "flee" or "silence Voss permanently").
4. **Check the current step.** If its precondition fails or its deadline passes, log why, then try the next alternative plan for the goal, or drop to the next goal.
5. **Act.** Move one step along the path, or perform the action.

What spreads change

- **Shared resources.** One knife, one tray, one key per room, one master key, one gun each, one back stair. Moving or using any of these breaks someone's plan.
- **Gossip.** When two agents are in the same room and not busy, they may exchange facts based on trust and mood (drunk agents share more). Facts carry their source, so a lie the player told can spread.
- **Being seen.** Agents remember who they saw where and when. That feeds suspicion and alibis.
- **Mood thresholds.** Fear, anger and drunkenness rise from events and fall over time. Crossing thresholds changes behaviour.
- **Player as a character.** Agents perceive the player like anyone else. Being seen in the wrong room raises suspicion; high suspicion means they lock doors, avoid you, or confront you. The player can be attacked and killed, which ends the loop early.

Example cascade the system must produce without special-casing: the player pockets Vivian's sleeping pills at 11:40 → at 1:05 her plan to dose Voss's nightcap fails its precondition → fear rises past 6 and she falls back to drinking in the lobby bar → drunk 6+, she tells the Colonel (now in the lobby) she "knew a man like Voss in '49" → his belief driverOf1949 drops for Voss and rises for Vivian → he follows her upstairs instead of taking the back stair to Suite 3 → Voss, not drugged and not attacked, keeps his 1:50 meeting with Jimmy, and the night ends with a different death, or none.

Guardrails for coherence

- Motives and backstory facts are constant. Only beliefs, plans, positions and moods change.
- Each agent's "do nothing" plans must reproduce the default timeline exactly (Section 7). That is the baseline test.
- Every character needs fallback reactions for every verb, for being followed, and for being asked about every topic, so nothing ever silently fails.

## 7. The default timeline (player does nothing)

This is what happens if the player stays in Room 7 all night. Encode it as each agent's default goals and plans, not as a script. The headless test `tests/default-night.test.ts` must reproduce every row within ±2 game minutes.

| Time | Who | Where | What happens |
| --- | --- | --- | --- |
| 10:00 | Everyone | Start positions | Player in Room 7, wet from the storm. Voss at the bar. Vivian in Suite 1. Colonel in a lobby armchair with a newspaper. Jimmy and Ruth in Room 6. Walter at the desk |
| 10:05 | World | Outside | Bridge washes out. Thunder, lights flicker |
| 10:10 | Walter | Lobby, then bar | Phones go dead. Walter tells everyone nobody can leave tonight |
| 10:15 | Voss, Walter | Office | Voss puts an envelope in the safe and slips Walter cash |
| 10:30 | Vivian, Voss | Bar | Vivian comes down and sees Voss. He tells her: "Suite 3. One o'clock. Bring all of it." The Colonel watches from the lobby |
| 10:45 | Ruth, Walter | Lobby | Ruth asks which room "Mrs. Marsh" is in. Walter refuses. Her earring falls; Walter puts it in lost-and-found |
| 11:00 | Jimmy, Voss | Parking lot | Meet at the Cadillac. Voss orders photos of Vivian and Ruth together |
| 11:15 | Vivian, Colonel, Voss | Bar | Radio bulletin: the 1949 hit-and-run is reopened. Vivian drops her glass. The Colonel watches Voss smile |
| 11:30 | Colonel, Vivian | Suites 2 and 1 | Both return to their rooms |
| 11:45 | Voss | Suite 3 | Writes the telegram, then waits |
| 12:00 | Ruth, Vivian, Jimmy | Upstairs corridor | Ruth knocks on Suite 1. Vivian answers on the chain and says she has the wrong room. Jimmy photographs from the stairs |
| 12:30 | Jimmy, Ruth | Room 6 | They argue. Audible through the Room 7 wall |
| 12:40 | Colonel | Back stair, kitchen | Takes a knife from the block via the back stair |
| 12:50 | Colonel | His car | Sits watching Suite 3's window until 1:10 |
| 1:00 | Vivian, Voss | Suite 3 | Vivian brings cash. Voss demands everything and mentions her daughter is here. She leaves at 1:08, shaking |
| 1:05 | Walter | Kitchen | Prepares Voss's nightcap tray; leaves it on the counter when Ruth rings the desk bell for aspirin at 1:06 |
| 1:10 | Vivian | Back stair, kitchen | Crushes her sleeping pills into the nightcap, intending to knock Voss out and take the letters later. Back in Suite 1 by 1:16 |
| 1:10 | Colonel | Lobby | Returns from the car |
| 1:20 | Walter | Suite 3 | Delivers the tray. Voss tells him to leave the door unlocked (he's expecting Jimmy) |
| 1:25 | Voss | Suite 3 | Drinks the nightcap; drowsy by 1:35 |
| 1:30 | Colonel | Back stair, corridor | Goes up the back stair and waits in the corridor alcove |
| 1:40 | Colonel, Voss | Suite 3 | The murder. The Colonel stabs the drowsy Voss |
| 1:45 | Colonel | Laundry | Drops a bloodied towel in the laundry cart via the chute, then returns to Suite 2 by the main stair (the step creaks at 1:48) |
| 1:50 | Jimmy | Suite 3 | Comes for his pay and the film, finds the body, grabs the film and runs down the main stair |
| 1:55 | Ruth, Jimmy | Lobby | Ruth, looking for Jimmy, sees him run past with blood on his cuff. She screams |
| 2:00 | Walter | Suite 3 | Finds the body. Loop ends: slow fade, rain, the clock resets to 10:00 |

## 8. Player verbs, interactions and dialogue

Verbs. A small set that works on everything. Each verb is a state transition in `sim/actions.ts` that emits events agents can perceive.

| Verb | On objects | On characters |
| --- | --- | --- |
| Look | Description; may reveal a clue and add it to memory | Describes appearance, mood cues, what they're holding |
| Take | Picks up portable items | Pickpocket attempt (fails if they're watching; raises suspicion) |
| Use | Open, close, lock, unlock, search, sit, turn on/off (radio, lights) | — |
| Use item on | Combine with world (key on door, pills on drink, towel on blood) | — |
| Show / Give | — | Show or hand over an item; they react based on beliefs |
| Talk | — | Topic-based conversation (below) |
| Listen | At doors and thin walls: hear what's said inside | — |
| Hide | Enter a hiding spot and watch unseen | — |
| Follow | — | Walk behind someone at a distance; they may notice |
| Wait | Fast-forward until a chosen time or until something happens nearby | — |

Dialogue system. No dialogue trees. Talking opens a panel with:

- **Ask about:** a topic list built from what the player knows (people, places, items, events, the 1949 crash). Topics appear as the player learns them.
- **Tell:** state a fact the player knows (true or a bluff). The listener updates beliefs based on trust and evidence, then may gossip it onward.
- **Show:** any inventory item.
- **Accuse:** name someone as the killer or the 1949 driver.

Each response is chosen by matching storylets: the highest-priority line whose conditions (speaker, topic, beliefs, mood, time, who else is present, loop count) are all true. Every character has a generic fallback for every topic and every item, plus variants so repeats don't feel canned. Lines can change beliefs, mood and relationships as side effects.

```ts
{ id: 'hale_shown_letters', speaker: 'hale', trigger: { show: 'blackmail_letters' },
  when: (w) => w.agents.hale.beliefs.driverOf1949?.value === 'voss',
  lines: ['He stares at the signature a long time.', '"Lane. Vivian Lane was driving."'],
  effects: (w) => { setBelief(w, 'hale', 'driverOf1949', 'vivian', 0.9, 'player'); w.agents.hale.mood.anger += 3; },
  priority: 90 }
```

Some conversations (e.g. Vivian confessing, Ruth meeting Vivian) are short authored scenes that run as storylets when their conditions are met, with the agents moved into position.

## 9. Loop, memory and endings

The loop. A loop ends at 2:00am, when the player dies, or when an ending triggers. Then: short fade, rain sound, "10:00 PM", and the world rebuilds from the initial state with the same seed. The player starts in Room 7 again.

Cross-loop memory (`sim/memory.ts`, saved to localStorage):

- Clues found (each clue has an id, a short description, and the facts it proves)
- Facts known (e.g. safeCombination, vivianWasDriver, ruthIsVivianDaughter, jimmyWorksForVoss)
- Events witnessed, with time and place
- People met and what each said about each topic
- Endings reached and loop count

Known facts unlock options: a new topic to ask about, a new "Tell" fact, using the safe without searching the Cadillac first. Items do not carry over, only knowledge.

The notebook (opened from the HUD or the desk in Room 7):

- People: portrait, room, what you know, open questions.
- Timeline: what you've seen happen at what time, merged across loops.
- Connections board: people as cards with lines for known relationships. Lines appear as facts are learned.
- Theories: the player can mark suspects and the 1949 driver; correct theories light up when proven.

Endings. Detect them in `sim/endings.ts` from world state at loop end or when triggered. Each has a title card and a one-paragraph epilogue.

| Ending | Trigger (summary) |
| --- | --- |
| The Default | Voss stabbed by the Colonel; Jimmy blamed |
| Overdose | Vivian doubles the dose (fear 9+) and Voss dies of the pills |
| Wrong Target | The Colonel kills Vivian after learning she was the driver |
| Self-Defence | Undrugged Voss shoots the Colonel |
| Two Bodies | Both Voss and another character die |
| The Fixer Walks | Nobody dies; Voss leaves at dawn with everything |
| Reckoning | Voss's ledger is exposed to everyone; the guests turn on him and hold him for the police |
| The Getaway | The killer escapes in Voss's Cadillac |
| The Patsy | The player is caught holding evidence and blamed |
| Lights Out | The player is killed |
| Mother and Daughter | Ruth and Vivian meet and talk before 2:00, and nobody dies |
| The Truth (true ending) | Nobody dies, Vivian confesses to the Colonel, the Colonel stands down, and Voss's ledger reaches the police |

Ending conditions must be checked from state, never from the specific path taken, so many routes lead to each ending.

## 10. Controls and UI

Touch is the primary input. Mouse and keyboard must be equally complete. Design every screen for a phone in landscape first (e.g. 844×390 CSS px), then scale up.

Camera. Top-down, looking straight down. The camera follows the player smoothly and frames the current room plus a little of the neighbours. Walls of the room the player is in are drawn low or cut away; other rooms on the same floor are visible but dimmed; the other floor is hidden. Pinch (or mouse wheel) zooms between 0.75x and 1.5x. Double-tap or C recentres.

Touch controls

| Gesture | Action |
| --- | --- |
| Tap floor | Walk there (path shown briefly as dots) |
| Tap object or person | Walk to it and open the verb wheel when you arrive |
| Long-press object or person | Look, without walking |
| Drag inventory item onto object or person | Use item on / Show / Give |
| Two-finger pinch | Zoom |
| Swipe up from inventory tray | Expand tray |

Desktop controls

| Input | Action |
| --- | --- |
| Left-click | Walk / interact (same as tap) |
| Right-click | Look |
| Drag item from tray | Use / Show / Give |
| WASD or arrows | Direct movement (optional alternative) |
| 1–8 | Select inventory slot, then click a target |
| N | Notebook |
| T | Wait menu |
| Space | Skip current line of dialogue |
| Esc | Pause menu |

HUD layout (landscape)

- Top-left: clock in a deco frame ("12:47 AM") and loop number.
- Top-right: notebook button and pause button.
- Bottom-centre: inventory tray, up to 8 slots, collapsible.
- Bottom-right: Wait button.
- Contextual: verb wheel around the tapped target (4–6 verbs, only those that apply, Look always present).
- Dialogue: a panel along the bottom third with the speaker's portrait, text, and large choice buttons. The world keeps running during dialogue at reduced speed unless the player pauses.
- Toast messages for discoveries ("New clue: the dented fender").

Mobile requirements

- Respect env(safe-area-inset-*) on all edges, including the notch side.
- All touch targets at least 44×44 CSS px; verb wheel buttons at least 56px.
- In portrait, show a full-screen "Rotate your phone" overlay and pause the game.
- A Fullscreen button on the title screen; after entering fullscreen, try screen.orientation.lock('landscape') and ignore failures (iOS Safari doesn't support it).
- Prevent page scroll, pull-to-refresh, double-tap zoom and long-press callouts on the game area (touch-action: none, user-select: none, -webkit-touch-callout: none).
- Use pointer events throughout so mouse, touch and pen share one code path.
- Add a web app manifest with "orientation": "landscape" and "display": "fullscreen" so it can be installed to the home screen.

Accessibility and settings: text size (3 steps), text speed, master/music/SFX volume, reduced motion (disables rain overlay and camera easing), high-contrast outlines on interactables, and a "show interactables" hold button (highlights everything clickable in the current room).

## 11. Visual and audio style

Mood: 1920s art deco grandeur gone to seed, seen through 1960s noir. Gold and black geometry against peeling wallpaper, rain on everything, pools of lamplight in the dark.

Palette

| Token | Hex | Use |
| --- | --- | --- |
| Ink | #0E0D0B | Darkness, outlines |
| Deco gold | #C9A24A | Trim, UI frames, clock |
| Oxblood | #6B1E1E | Carpets, upholstery, blood |
| Faded teal | #2F5D5A | Tiles, wallpaper, motor court |
| Cream | #E8DCC0 | Text, lamp light, paper |
| Neon red | #FF3B3B | VACANCY sign, danger highlights |

Rendering

- Start with no image assets: draw rooms, furniture and characters procedurally from simple shapes (characters as top-down circles with a hat or hair shape, shoulders and a facing direction). Every character must be distinguishable by silhouette and colour. Make it easy to swap in sprite sheets later.
- Lighting: the scene is dark; each lamp is a soft radial light. Lights flicker during the storm. Implement as a single darkness layer with light circles cut out (render texture with blend modes), not per-pixel shaders, to stay fast on phones.
- Rain: a lightweight particle overlay outdoors and streaks on windows, drawn in one batched layer.
- Characters show a small mood glyph above their head when it changes (sweat drop for fear, a line for anger, a question mark for suspicion).
- UI typography: a deco display font for titles and the clock (e.g. "Poiret One" or "Limelight" from Google Fonts) and a typewriter-style font for notes and dialogue (e.g. "Special Elite"). Self-host the fonts.

Audio (placeholder synthesized sounds are fine for early phases)

- Ambient rain and thunder, louder near windows and outside.
- A crackling jazz radio in the bar, positional (quieter in further rooms).
- Footsteps that differ by floor (carpet, tile, gravel, puddles); the creaking step.
- A low clock tick that quickens after 1:30am.
- Short stings for discovering a clue and for the loop reset.

## 12. Build phases

Complete one phase at a time. At the end of each, run `npm test`, run the game, and report back. Don't start the next phase until the acceptance criteria pass.

### Phase 1: Simulation core (no graphics)

- World state, clock, seeded RNG, event bus, decision log, tile map with both floors, doors and locks, A* pathfinding.
- Agents with goals, plans, beliefs, mood, perception and gossip. All six characters with their default plans.
- A CLI script `npm run sim` that runs one night headless and prints the event log and decision log.
- Accept when: `default-night.test.ts` reproduces the Section 7 timeline within ±2 game minutes; the same seed gives byte-identical logs twice; a full night simulates in under 200ms.

### Phase 2: Player actions and butterfly tests

- All verbs as sim commands; the player as a perceivable entity; scripted input logs for tests.
- Accept when these tests pass, with no special-case code for them:
  - Pocketing Vivian's pills at 11:40 means Voss is not drugged at 1:35.
  - Showing the Colonel the blackmail letters before 12:40 changes his target to Vivian.
  - Locking the kitchen's back-stair door at 12:30 means the Colonel cannot get the knife by his default route and must re-plan.
  - Telling Ruth that Jimmy works for Voss leads to a confrontation in Room 6.
  - Staying in Suite 3 with Voss from 1:30 changes the outcome.

### Phase 3: Rendering and desktop play

- Pixi scene with procedural art, camera, cut-away walls, lighting, rain, characters moving along paths.
- Click-to-move, verb wheel, inventory, dialogue panel, clock HUD, loop reset with fade.
- Debug overlay (toggle with backtick): agent inspector (goals, current step, beliefs, mood), decision log, a timeline scrubber that re-simulates to any tick.
- Accept when: a full loop is playable with mouse and keyboard at 60fps, and the default night plays out visibly.

### Phase 4: Mobile landscape

- All touch gestures, safe areas, rotate overlay, fullscreen and orientation lock, the manifest, touch-target sizes.
- Accept when: a full loop is playable one-handed in Chrome on Android and in iOS Safari in landscape, with no accidental scrolling or zooming, at 60fps on a mid-range phone (test with Chrome DevTools CPU 4x throttle as a proxy).

### Phase 5: Memory, notebook and endings

- Cross-loop memory saved to localStorage, the notebook (people, timeline, connections, theories), topic unlocks, all endings with title cards.
- Accept when: knowledge persists across loops and browser reloads; each ending in Section 9 has a test with an input log that reaches it.

### Phase 6: Content depth and polish

- Fallback reactions for every verb × character × item; dialogue variants; mood glyphs; audio; settings menu; title screen.
- A "what changed" summary after each loop, generated from the decision log diffed against the default night ("Vivian never reached the kitchen. The Colonel spent 1:15 to 1:40 in the bar.").
- Accept when: a coverage test confirms no verb/target pair returns an empty response, and the bundle-size and frame-rate budgets in Section 2 are met.

Throughout: keep content in `src/content/` so new storylets, lines and plans can be added without touching engine code. When something in this spec is ambiguous, pick the option that keeps the simulation deterministic and the content data-driven, and note the choice in your phase report.
