/**
 * Fixtures (fixed objects with their own verbs) and items (portable or not,
 * with a location). Uses are small effect functions; the engine handles the
 * approach, the event and the busy time.
 */
import { drug, moveItem, setFixtureState, setItemState } from '../sim/actions';
import { adjustMood } from '../sim/agents/mood';
import { believes } from '../sim/query';
import type { FixtureDef, ItemDef } from '../sim/types';

export const fixtures: FixtureDef[] = [
  // --- Office ---------------------------------------------------------------
  {
    id: 'safe',
    name: 'hotel safe',
    room: 'office',
    tiles: [{ x: 11, y: 5 }],
    at: { x: 10, y: 5 },
    blocking: true,
    container: true,
    description: 'A squat iron safe with a brass dial. The combination is six digits.',
    state: { open: false },
    uses: {
      open: {
        minutes: 0.5,
        effect: (w, who) => {
          if (believes(w, who, 'safeCombination', true, 0.8)) setFixtureState(w, 'safe', 'open', true, who);
        },
      },
      close: { minutes: 0.2, effect: (w, who) => setFixtureState(w, 'safe', 'open', false, who) },
      put: {
        minutes: 1,
        effect: (w, who, ctx) => {
          if (ctx.item) moveItem(w, ctx.item, { kind: 'fixture', fixture: 'safe' }, who);
        },
      },
    },
  },
  {
    id: 'party_photos',
    name: '1949 party photographs',
    room: 'office',
    tiles: [{ x: 6, y: 5 }],
    at: { x: 6, y: 5 },
    description: 'Framed photographs of a party in the bar, 1949. A young actress laughs at the piano.',
  },
  {
    id: 'office_desk',
    name: "clerk's desk",
    room: 'office',
    tiles: [{ x: 8, y: 8 }, { x: 9, y: 8 }],
    at: { x: 8, y: 9 },
    blocking: true,
    container: true,
    description: 'A scarred oak desk. The drawers stick.',
  },
  {
    id: 'walters_coat',
    name: "Walter's coat",
    room: 'office',
    tiles: [{ x: 5, y: 10 }],
    at: { x: 5, y: 10 },
    container: true,
    description: 'A grey overcoat on a hook. Something stiff in the inside pocket.',
    uses: {
      put: {
        minutes: 0.3,
        effect: (w, who, ctx) => {
          if (ctx.item) moveItem(w, ctx.item, { kind: 'fixture', fixture: 'walters_coat' }, who);
        },
      },
    },
  },
  // --- Lobby ----------------------------------------------------------------
  {
    id: 'front_desk',
    name: 'front desk',
    room: 'lobby',
    tiles: [{ x: 14, y: 7 }, { x: 14, y: 8 }, { x: 14, y: 9 }],
    at: { x: 15, y: 8 },
    blocking: true,
    container: true,
    openContainer: true,
    description: 'A long walnut counter with a brass rail, the varnish worn pale where elbows rest.',
  },
  {
    id: 'key_rack',
    name: 'brass key rack',
    room: 'lobby',
    tiles: [{ x: 13, y: 5 }],
    at: { x: 13, y: 5 },
    container: true,
    openContainer: true,
    description: 'A rack of hooks behind the desk. Empty hooks mark the occupied rooms: Suites 1, 2 and 3, Rooms 6 and 7.',
  },
  {
    id: 'switchboard',
    name: 'switchboard',
    room: 'lobby',
    tiles: [{ x: 13, y: 10 }],
    at: { x: 13, y: 9 },
    blocking: true,
    container: true,
    openContainer: true,
    description: 'A dead switchboard, every lamp dark since ten past ten.',
  },
  {
    id: 'lost_and_found',
    name: 'lost-and-found drawer',
    room: 'lobby',
    tiles: [{ x: 14, y: 10 }],
    at: { x: 13, y: 9 },
    blocking: true,
    container: true,
    description: 'A drawer of umbrellas, gloves and one glove too many.',
  },
  {
    id: 'armchair_hale',
    name: 'lobby armchair',
    room: 'lobby',
    tiles: [{ x: 24, y: 9 }],
    at: { x: 24, y: 9 },
    description: 'A sagging oxblood armchair with a view through the archway into the bar.',
    uses: { sit: { minutes: 0.1 } },
  },
  {
    id: 'armchair_2',
    name: 'second armchair',
    room: 'lobby',
    tiles: [{ x: 22, y: 10 }],
    at: { x: 22, y: 10 },
    description: 'Its twin, facing the front door.',
    uses: { sit: { minutes: 0.1 } },
  },
  // --- Bar ------------------------------------------------------------------
  {
    id: 'bar_counter',
    name: 'bar',
    room: 'bar',
    tiles: [{ x: 36, y: 6 }, { x: 36, y: 7 }, { x: 36, y: 8 }, { x: 36, y: 9 }],
    at: { x: 35, y: 7 },
    blocking: true,
    container: true,
    openContainer: true,
    description: 'A chrome-edged bar, three stools, a bowl of stale nuts.',
    uses: {
      drink: {
        minutes: 1.5,
        effect: (w, who) => adjustMood(w, who, 'drunk', 1.5, 'a drink at the bar'),
      },
    },
  },
  {
    id: 'liquor_shelf',
    name: 'liquor shelf',
    room: 'bar',
    tiles: [{ x: 39, y: 5 }, { x: 40, y: 5 }],
    at: { x: 39, y: 6 },
    blocking: true,
    description: 'Mirrored shelves of bourbon and rye, half of them empty.',
  },
  {
    id: 'piano',
    name: 'piano',
    room: 'bar',
    tiles: [{ x: 29, y: 10 }, { x: 30, y: 10 }],
    at: { x: 30, y: 9 },
    blocking: true,
    container: true,
    openContainer: true,
    description: 'A baby grand, lid down, a sheet of music on the stand.',
  },
  {
    id: 'radio',
    name: 'radio',
    room: 'bar',
    tiles: [{ x: 33, y: 5 }],
    at: { x: 33, y: 5 },
    description: 'A walnut radio crackling with late jazz.',
    state: { on: true },
    uses: {
      on: { minutes: 0.1, effect: (w, who) => setFixtureState(w, 'radio', 'on', true, who) },
      off: { minutes: 0.1, effect: (w, who) => setFixtureState(w, 'radio', 'on', false, who) },
    },
  },
  {
    id: 'bar_table',
    name: 'corner table',
    room: 'bar',
    tiles: [{ x: 31, y: 7 }],
    at: { x: 30, y: 7 },
    blocking: true,
    container: true,
    openContainer: true,
    description: 'A small table near the archway, with a clear view of the stools.',
  },
  // --- Laundry --------------------------------------------------------------
  {
    id: 'laundry_cart_1',
    name: 'laundry cart',
    room: 'laundry',
    tiles: [{ x: 8, y: 17 }],
    at: { x: 8, y: 16 },
    blocking: true,
    hidingSpot: true,
    container: true,
    description: 'A canvas cart heaped with sheets. Big enough to hide in.',
  },
  {
    id: 'laundry_cart_2',
    name: 'second laundry cart',
    room: 'laundry',
    tiles: [{ x: 10, y: 17 }],
    at: { x: 10, y: 16 },
    blocking: true,
    hidingSpot: true,
    container: true,
    description: 'Another cart, this one of towels.',
  },
  {
    id: 'chute_exit',
    name: 'laundry chute exit',
    room: 'laundry',
    tiles: [{ x: 13, y: 13 }],
    at: { x: 13, y: 13 },
    container: true,
    openContainer: true,
    description: 'The mouth of the chute from upstairs. Whatever is dropped up there lands here.',
  },
  // --- Kitchen --------------------------------------------------------------
  {
    id: 'knife_block',
    name: 'knife block',
    room: 'kitchen',
    tiles: [{ x: 18, y: 13 }],
    at: { x: 18, y: 14 },
    blocking: true,
    container: true,
    openContainer: true,
    description: 'A wooden block of kitchen knives.',
  },
  {
    id: 'kitchen_counter',
    name: 'kitchen counter',
    room: 'kitchen',
    tiles: [{ x: 21, y: 13 }, { x: 22, y: 13 }, { x: 23, y: 13 }],
    at: { x: 22, y: 14 },
    blocking: true,
    container: true,
    openContainer: true,
    description: 'A steel counter where the night tray is made up.',
  },
  {
    id: 'sink',
    name: 'sink',
    room: 'kitchen',
    tiles: [{ x: 27, y: 13 }],
    at: { x: 27, y: 14 },
    blocking: true,
    description: 'A deep sink with a dripping tap.',
    uses: { wash: { minutes: 0.5, effect: (w, who) => { w.agents[who]!.flags.bloody = false; } } },
  },
  {
    id: 'stove',
    name: 'stove',
    room: 'kitchen',
    tiles: [{ x: 30, y: 13 }, { x: 31, y: 13 }],
    at: { x: 30, y: 14 },
    blocking: true,
    description: 'A cold range.',
  },
  // --- Room 6 ---------------------------------------------------------------
  {
    id: 'bed6',
    name: 'bed',
    room: 'room6',
    tiles: [{ x: 30, y: 26 }, { x: 31, y: 26 }],
    at: { x: 32, y: 26 },
    blocking: true,
    description: 'A motor-court bed with a thin chenille spread.',
  },
  {
    id: 'jimmys_jacket',
    name: "Jimmy's jacket",
    room: 'room6',
    tiles: [{ x: 30, y: 23 }],
    at: { x: 30, y: 23 },
    container: true,
    description: 'A sports jacket on the back of the door. Heavy on one side.',
  },
  {
    id: 'ruths_handbag',
    name: "Ruth's handbag",
    room: 'room6',
    tiles: [{ x: 34, y: 27 }],
    at: { x: 34, y: 27 },
    container: true,
    description: 'A cheap patent handbag, clasp worn bright.',
  },
  {
    id: 'thin_wall_6',
    name: 'wall to Room 7',
    room: 'room6',
    tiles: [{ x: 34, y: 25 }],
    at: { x: 34, y: 25 },
    description: 'A plasterboard wall. You can hear the rain through it.',
  },
  // --- Room 7 ---------------------------------------------------------------
  {
    id: 'bed7',
    name: 'bed',
    room: 'room7',
    tiles: [{ x: 39, y: 26 }, { x: 40, y: 26 }],
    at: { x: 38, y: 26 },
    blocking: true,
    hidingSpot: true,
    description: 'Your bed. There is room underneath it.',
  },
  {
    id: 'desk7',
    name: 'writing desk',
    room: 'room7',
    tiles: [{ x: 40, y: 23 }],
    at: { x: 39, y: 23 },
    blocking: true,
    container: true,
    openContainer: true,
    description: 'A desk by the window with a notebook on it.',
  },
  {
    id: 'window7',
    name: 'window',
    room: 'room7',
    tiles: [{ x: 37, y: 23 }],
    at: { x: 37, y: 23 },
    description: 'Rain streaks the glass. The lot and the back of the hotel are out there.',
  },
  {
    id: 'thin_wall_7',
    name: 'wall to Room 6',
    room: 'room7',
    tiles: [{ x: 36, y: 25 }],
    at: { x: 36, y: 25 },
    description: 'The wall is thin enough to hear the couple next door.',
  },
  // --- Lot ------------------------------------------------------------------
  {
    id: 'cadillac',
    name: "Voss's Cadillac",
    room: 'lot',
    tiles: [{ x: 10, y: 25 }, { x: 11, y: 25 }],
    at: { x: 12, y: 25 },
    blocking: true,
    container: true,
    description: 'A black Cadillac, new this year, parked nose-out.',
  },
  {
    id: 'vivian_car',
    name: "Vivian's car",
    room: 'lot',
    tiles: [{ x: 18, y: 25 }, { x: 19, y: 25 }],
    at: { x: 18, y: 24 },
    blocking: true,
    description: 'A pre-war coupe. The front fender carries an old dent, never repaired.',
  },
  {
    id: 'hale_car',
    name: "the Colonel's car",
    room: 'lot',
    tiles: [{ x: 43, y: 12 }, { x: 43, y: 13 }],
    at: { x: 42, y: 12 },
    blocking: true,
    description: 'A dusty sedan with out-of-state plates, parked where it can see the upstairs windows.',
    uses: { sit: { minutes: 0.1 } },
  },
  // --- Corridor -------------------------------------------------------------
  {
    id: 'chute_hatch',
    name: 'laundry chute hatch',
    room: 'corridor',
    tiles: [{ x: 13, y: 5 }],
    at: { x: 13, y: 5 },
    description: 'A brass hatch in the wall. It opens onto a chute to the laundry.',
    uses: {
      drop: {
        minutes: 0.2,
        effect: (w, who, ctx) => {
          if (ctx.item) moveItem(w, ctx.item, { kind: 'fixture', fixture: 'chute_exit' }, who);
        },
      },
    },
  },
  {
    id: 'corridor_window',
    name: 'corridor window',
    room: 'corridor',
    tiles: [{ x: 33, y: 5 }],
    at: { x: 33, y: 5 },
    description: 'A tall window over the front drive and the lot.',
  },
  // --- Suite 1 --------------------------------------------------------------
  {
    id: 'vanity',
    name: 'vanity',
    room: 'suite1',
    tiles: [{ x: 6, y: 9 }, { x: 7, y: 9 }],
    at: { x: 6, y: 10 },
    blocking: true,
    container: true,
    openContainer: true,
    description: 'A mirrored vanity crowded with jars, a compact and a brown pill bottle.',
  },
  {
    id: 'vivian_suitcase',
    name: "Vivian's suitcase",
    room: 'suite1',
    tiles: [{ x: 14, y: 17 }],
    at: { x: 14, y: 17 },
    container: true,
    description: 'A good leather suitcase. The lining has been restitched by hand.',
  },
  {
    id: 'bed1',
    name: 'bed',
    room: 'suite1',
    tiles: [{ x: 12, y: 10 }, { x: 13, y: 10 }],
    at: { x: 12, y: 11 },
    blocking: true,
    description: 'A wide bed, barely slept in.',
  },
  {
    id: 'window1',
    name: 'window',
    room: 'suite1',
    tiles: [{ x: 10, y: 17 }],
    at: { x: 10, y: 17 },
    description: 'A window over the rear lot.',
  },
  // --- Suite 2 --------------------------------------------------------------
  {
    id: 'bedside_drawer',
    name: 'bedside drawer',
    room: 'suite2',
    tiles: [{ x: 18, y: 9 }],
    at: { x: 18, y: 10 },
    blocking: true,
    container: true,
    description: 'A nightstand with one drawer.',
  },
  {
    id: 'bed2',
    name: 'bed',
    room: 'suite2',
    tiles: [{ x: 19, y: 9 }, { x: 20, y: 9 }],
    at: { x: 19, y: 10 },
    blocking: true,
    description: 'Made with military corners.',
  },
  {
    id: 'desk2',
    name: 'writing desk',
    room: 'suite2',
    tiles: [{ x: 26, y: 9 }],
    at: { x: 26, y: 10 },
    blocking: true,
    container: true,
    openContainer: true,
    description: 'A desk covered in newspaper clippings and a notebook in a careful hand.',
  },
  // --- Suite 3 --------------------------------------------------------------
  {
    id: 'wardrobe',
    name: 'wardrobe',
    room: 'suite3',
    tiles: [{ x: 29, y: 9 }, { x: 29, y: 10 }],
    at: { x: 30, y: 10 },
    blocking: true,
    hidingSpot: true,
    description: 'A deep walnut wardrobe. A person could stand inside it.',
  },
  {
    id: 'desk3',
    name: 'writing desk',
    room: 'suite3',
    tiles: [{ x: 40, y: 9 }],
    at: { x: 39, y: 9 },
    blocking: true,
    container: true,
    openContainer: true,
    description: 'A desk with hotel stationery and a half-written telegram form.',
  },
  {
    id: 'briefcase',
    name: 'briefcase',
    room: 'suite3',
    tiles: [{ x: 40, y: 17 }],
    at: { x: 40, y: 17 },
    container: true,
    description: 'A salesman\'s sample case. The samples are missing; something else is not.',
  },
  {
    id: 'bed3',
    name: 'bed',
    room: 'suite3',
    tiles: [{ x: 33, y: 16 }, { x: 34, y: 16 }],
    at: { x: 34, y: 15 },
    blocking: true,
    description: 'A bed with a suit laid out on it.',
  },
  {
    id: 'washstand',
    name: 'washstand',
    room: 'suite3',
    tiles: [{ x: 31, y: 17 }],
    at: { x: 31, y: 16 },
    blocking: true,
    container: true,
    openContainer: true,
    description: 'A washstand with a folded hotel towel.',
  },
];

export const items: ItemDef[] = [
  // --- Lobby ----------------------------------------------------------------
  {
    id: 'guest_ledger',
    name: 'guest ledger',
    description: 'Tonight\'s entries: Suite 1, "Mrs. V. Marsh". Suite 2, "A. Hale". Suite 3, "L. Voss". Room 6, "Mr. and Mrs. J. Doyle". Room 7: you.',
    portable: false,
    start: { kind: 'fixture', fixture: 'front_desk' },
    proves: ['vivianIsMrsMarsh'],
  },
  {
    id: 'service_bell',
    name: 'service bell',
    description: 'A brass bell on the counter.',
    portable: false,
    start: { kind: 'fixture', fixture: 'front_desk' },
    uses: { ring: { minutes: 0.1, loud: 'bell', loudness: 4 } },
  },
  {
    id: 'walters_notepad',
    name: "Walter's notepad",
    description: 'Call log in pencil. The last line: "9:52 pm, Suite 3 calling out, long distance."',
    portable: true,
    start: { kind: 'fixture', fixture: 'switchboard' },
    proves: ['suite3CalledOut'],
  },
  { id: 'laundry_key', name: 'service key', description: 'A worn key tagged LAUNDRY / BACK DOOR.', portable: true, start: { kind: 'fixture', fixture: 'key_rack' }, opens: ['laundry_door', 'kitchen_back_door'] },
  // --- Office ---------------------------------------------------------------
  { id: 'spare_master_key', name: 'spare master key', description: 'A master key on a red tag. It opens every lock in the hotel.', portable: true, start: { kind: 'fixture', fixture: 'office_desk' }, opens: 'all' },
  { id: 'aspirin', name: 'aspirin', description: 'A bottle of aspirin.', portable: true, start: { kind: 'fixture', fixture: 'office_desk' } },
  // --- Bar ------------------------------------------------------------------
  { id: 'sheet_music', name: 'sheet music', description: '"Stormy Weather", with a telephone number pencilled in the margin.', portable: true, start: { kind: 'fixture', fixture: 'piano' }, proves: ['phoneNumberOnSheetMusic'] },
  { id: 'ashtray_lipstick', name: 'ashtray', description: 'Three cigarette ends, each with a crescent of coral lipstick.', portable: false, start: { kind: 'fixture', fixture: 'bar_table' }, proves: ['vivianLipstickBrand'] },
  { id: 'bar_tab_book', name: 'bar tab book', description: 'Tabs in Walter\'s hand. "Suite 3: 2 rye. Suite 3 for Suite 1: 1 gin."', portable: true, start: { kind: 'fixture', fixture: 'bar_counter' }, proves: ['vossBoughtVivianDrinks'] },
  // --- Kitchen --------------------------------------------------------------
  { id: 'kitchen_knife', name: 'kitchen knife', description: 'A long carving knife from the block.', portable: true, weapon: 'knife', concealable: true, start: { kind: 'fixture', fixture: 'knife_block' } },
  {
    id: 'nightcap_tray',
    name: 'nightcap tray',
    description: 'A tray with a glass, a decanter of brandy and a folded napkin.',
    portable: true,
    start: { kind: 'fixture', fixture: 'kitchen_counter' },
    state: { prepared: false, dosed: 0, consumed: false },
    uses: {
      prepare: {
        minutes: 2,
        effect: (w, who) => setItemState(w, 'nightcap_tray', 'prepared', true, who),
      },
      dose: {
        minutes: 1.5,
        requiresItem: 'sleeping_pills',
        effect: (w, who) => {
          const doses = w.agents[who]!.mood.fear >= 9 ? 2 : 1;
          const tray = w.items.nightcap_tray!;
          setItemState(w, 'nightcap_tray', 'dosed', Number(tray.state.dosed ?? 0) + doses, who);
          const pills = w.items.sleeping_pills!;
          setItemState(w, 'sleeping_pills', 'count', Math.max(0, Number(pills.state.count ?? 0) - 6 * doses), who);
        },
      },
      drink: {
        minutes: 2,
        effect: (w, who) => {
          const tray = w.items.nightcap_tray!;
          const dosed = Number(tray.state.dosed ?? 0);
          setItemState(w, 'nightcap_tray', 'consumed', true, who);
          if (dosed > 0) drug(w, who, dosed);
        },
      },
    },
  },
  // --- Room 6 ---------------------------------------------------------------
  { id: 'birth_certificate', name: 'birth certificate', description: 'County of Los Angeles, 1950. Mother: Vivian Lane. Father: not stated. Child: Ruth.', portable: true, start: { kind: 'fixture', fixture: 'ruths_handbag' }, proves: ['ruthIsVivianDaughter'] },
  { id: 'press_pass', name: 'press pass', description: 'J. Doyle, staff photographer, Coast Confidential.', portable: true, start: { kind: 'fixture', fixture: 'jimmys_jacket' }, proves: ['jimmyIsPhotographer'] },
  {
    id: 'camera',
    name: 'camera',
    description: 'A compact camera with a fast lens, loaded.',
    portable: true,
    start: { kind: 'fixture', fixture: 'jimmys_jacket' },
    state: { photos: 0 },
    uses: {
      photograph: {
        minutes: 0.3,
        effect: (w, who) => setItemState(w, 'camera', 'photos', Number(w.items.camera!.state.photos ?? 0) + 1, who),
      },
    },
  },
  // --- Room 7 ---------------------------------------------------------------
  { id: 'notebook', name: 'notebook', description: 'Your notebook. Everything you learn goes in here, and stays.', portable: false, start: { kind: 'fixture', fixture: 'desk7' } },
  { id: 'player_suitcase', name: 'your suitcase', description: 'Your suitcase, still wet from the storm.', portable: false, start: { kind: 'tile', floor: 0, x: 36, y: 27 } },
  // --- Lot ------------------------------------------------------------------
  { id: 'combination_note', name: 'glovebox note', description: 'A card in the glovebox: "KLondike 5-2271". Six digits, if you drop the exchange.', portable: true, start: { kind: 'fixture', fixture: 'cadillac' }, proves: ['safeCombination'] },
  // --- Suite 1 --------------------------------------------------------------
  { id: 'sleeping_pills', name: 'sleeping pills', description: 'A brown bottle of barbiturates, prescribed to "V. Marsh".', portable: true, start: { kind: 'fixture', fixture: 'vanity' }, state: { count: 12 } },
  { id: 'blackmail_letters', name: 'blackmail letters', description: 'Thirteen years of letters, each signed "L.V.", each naming the coast road, the date, and the driver: Vivian Lane.', portable: true, start: { kind: 'fixture', fixture: 'vivian_suitcase' }, proves: ['vivianWasDriver', 'vossBlackmailsVivian'] },
  { id: 'baby_photo', name: 'baby photograph', description: 'A photograph of an infant, tucked in a compact. On the back: "R., March 1950".', portable: true, start: { kind: 'agent', agent: 'vivian' }, proves: ['vivianHadADaughter'] },
  { id: 'vivian_cash', name: 'envelope of cash', description: 'A fat envelope of worn bills.', portable: true, start: { kind: 'agent', agent: 'vivian' } },
  { id: 'suite1_key', name: 'Suite 1 key', description: 'A brass key with a deco fob: 1.', portable: true, start: { kind: 'agent', agent: 'vivian' }, opens: ['suite1_door'] },
  // --- Suite 2 --------------------------------------------------------------
  { id: 'hale_revolver', name: 'service revolver', description: 'An army revolver, oiled and loaded.', portable: true, weapon: 'gun', loaded: true, concealable: true, start: { kind: 'fixture', fixture: 'bedside_drawer' } },
  { id: 'hale_clippings', name: 'newspaper clippings', description: '"Coast road hit-and-run: girl, 19, killed." "Deputy clears local man." A photograph of Clara Hale.', portable: true, start: { kind: 'fixture', fixture: 'desk2' }, proves: ['claraHaleDied1949'] },
  { id: 'hale_notebook', name: "the Colonel's notebook", description: 'Dates and places across three states, each with the initials L.V. The last entry is tonight.', portable: true, start: { kind: 'fixture', fixture: 'desk2' }, proves: ['haleTrackedVoss'] },
  { id: 'suite2_key', name: 'Suite 2 key', description: 'A brass key with a deco fob: 2.', portable: true, start: { kind: 'agent', agent: 'hale' }, opens: ['suite2_door'] },
  // --- Suite 3 --------------------------------------------------------------
  { id: 'blackmail_ledger', name: 'blackmail ledger', description: 'A ledger of names, sums and dates. Vivian Lane is the longest account. Walter Pike is on page two.', portable: true, start: { kind: 'fixture', fixture: 'briefcase' }, proves: ['vossBlackmailer', 'vossBlackmailsVivian'] },
  { id: 'undeveloped_film', name: 'undeveloped film', description: 'A roll of film in a brass canister.', portable: true, concealable: true, start: { kind: 'agent', agent: 'voss', concealed: true } },
  {
    id: 'telegram',
    name: 'telegram form',
    description: 'A half-written telegram: "ALL PARTIES PRESENT. FINAL SETTLEMENT TONIGHT."',
    portable: true,
    start: { kind: 'fixture', fixture: 'desk3' },
    state: { written: false },
    uses: { write: { minutes: 3, effect: (w, who) => setItemState(w, 'telegram', 'written', true, who) } },
  },
  { id: 'voss_pistol', name: 'small pistol', description: 'A small automatic pistol, the kind that fits a coat pocket.', portable: true, weapon: 'gun', loaded: true, concealable: true, start: { kind: 'agent', agent: 'voss', concealed: true } },
  {
    id: 'suite3_towel',
    name: 'hotel towel',
    description: 'A white hotel towel.',
    portable: true,
    start: { kind: 'fixture', fixture: 'washstand' },
    state: { bloodied: false },
    uses: {
      wipe: {
        minutes: 0.5,
        effect: (w, who) => {
          const a = w.agents[who]!;
          if (a.flags.bloody) {
            setItemState(w, 'suite3_towel', 'bloodied', true, who);
            a.flags.bloody = false;
          }
        },
      },
    },
  },
  { id: 'suite3_key', name: 'Suite 3 key', description: 'A brass key with a deco fob: 3.', portable: true, start: { kind: 'agent', agent: 'voss' }, opens: ['suite3_door'] },
  { id: 'voss_envelope', name: "Voss's envelope", description: 'A thick manila envelope. Inside: three letters in a young woman\'s hand, dated 1949, begging a man to "make it go away".', portable: true, start: { kind: 'agent', agent: 'voss' }, proves: ['vivianWasDriver'] },
  { id: 'voss_cash', name: 'folded bills', description: 'Fifty dollars, folded small.', portable: true, start: { kind: 'agent', agent: 'voss' } },
  // --- Carried by others ----------------------------------------------------
  { id: 'master_key', name: 'master key', description: 'The night clerk\'s master key on a chain.', portable: true, start: { kind: 'agent', agent: 'walter' }, opens: 'all' },
  { id: 'office_key', name: 'office key', description: 'The key to the clerk\'s office.', portable: true, start: { kind: 'agent', agent: 'walter' }, opens: ['office_door'] },
  { id: 'ruth_earring', name: "Ruth's earring", description: 'A cheap pearl drop earring.', portable: true, start: { kind: 'agent', agent: 'ruth' } },
  { id: 'room6_key', name: 'Room 6 key', description: 'A key on a plastic tag: 6.', portable: true, start: { kind: 'agent', agent: 'jimmy' }, opens: ['room6_door'] },
  { id: 'room7_key', name: 'Room 7 key', description: 'Your key, on a plastic tag: 7.', portable: true, start: { kind: 'agent', agent: 'player' }, opens: ['room7_door'] },
];
