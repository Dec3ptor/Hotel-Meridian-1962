/**
 * Colours from the spec, plus the procedural "looks" of rooms, fixtures,
 * items, characters and lamps. All art is drawn from these tables; a sprite
 * sheet can replace any entry later without touching the scene code.
 */
import type { CharacterId } from '../sim/types';

export const C = {
  ink: 0x0e0d0b,
  gold: 0xc9a24a,
  oxblood: 0x6b1e1e,
  teal: 0x2f5d5a,
  cream: 0xe8dcc0,
  neon: 0xff3b3b,
  // derived
  carpet: 0x4a1616,
  carpetLight: 0x5a1c1c,
  wood: 0x3b2a1a,
  woodLight: 0x4d3722,
  tile: 0x27504d,
  tileLight: 0x2f5d5a,
  asphalt: 0x15161a,
  asphaltLight: 0x1c1e24,
  wall: 0x0a0908,
  wallTop: 0x2a241a,
  plaster: 0x3a3025,
  skin: 0xd9b48f,
  skinPale: 0xe8cdb0,
  shadow: 0x000000,
  paper: 0xe8dcc0,
  metal: 0x9aa0a6,
  brass: 0xc9a24a,
  glass: 0x7fb3b0,
} as const;

export type FloorKind = 'carpet' | 'tile' | 'wood' | 'asphalt';

export const ROOM_FLOORS: Record<string, FloorKind> = {
  lot: 'asphalt',
  office: 'wood',
  lobby: 'carpet',
  bar: 'wood',
  laundry: 'tile',
  kitchen: 'tile',
  room6: 'tile',
  room7: 'tile',
  corridor: 'carpet',
  suite1: 'carpet',
  suite2: 'carpet',
  suite3: 'carpet',
};

export type FixtureKind =
  | 'bed'
  | 'desk'
  | 'counter'
  | 'chair'
  | 'piano'
  | 'car'
  | 'safe'
  | 'wallThing'
  | 'cart'
  | 'wardrobe'
  | 'appliance'
  | 'bag'
  | 'window'
  | 'wall'
  | 'hatch'
  | 'chute'
  | 'radio'
  | 'table';

export interface FixtureLook {
  kind: FixtureKind;
  color?: number;
}

export const FIXTURE_LOOKS: Record<string, FixtureLook> = {
  safe: { kind: 'safe' },
  party_photos: { kind: 'wallThing', color: C.gold },
  office_desk: { kind: 'desk' },
  walters_coat: { kind: 'bag', color: 0x55554f },
  front_desk: { kind: 'counter', color: 0x4d3722 },
  key_rack: { kind: 'wallThing', color: C.brass },
  switchboard: { kind: 'appliance', color: 0x3a3a3a },
  lost_and_found: { kind: 'desk', color: 0x3b2a1a },
  armchair_hale: { kind: 'chair' },
  armchair_2: { kind: 'chair' },
  bar_counter: { kind: 'counter', color: 0x2b1d12 },
  liquor_shelf: { kind: 'wallThing', color: 0x8a6d3b },
  piano: { kind: 'piano' },
  radio: { kind: 'radio' },
  bar_table: { kind: 'table' },
  laundry_cart_1: { kind: 'cart' },
  laundry_cart_2: { kind: 'cart' },
  chute_exit: { kind: 'chute' },
  knife_block: { kind: 'appliance', color: 0x5a3b1e },
  kitchen_counter: { kind: 'counter', color: 0x8f949a },
  sink: { kind: 'appliance', color: 0x9aa0a6 },
  stove: { kind: 'appliance', color: 0x2e2e2e },
  bed6: { kind: 'bed', color: 0x3f6f6b },
  jimmys_jacket: { kind: 'bag', color: 0x8a6d3b },
  ruths_handbag: { kind: 'bag', color: 0x1a1a1a },
  thin_wall_6: { kind: 'wall' },
  bed7: { kind: 'bed', color: 0x3f6f6b },
  desk7: { kind: 'desk' },
  window7: { kind: 'window' },
  thin_wall_7: { kind: 'wall' },
  cadillac: { kind: 'car', color: 0x101010 },
  vivian_car: { kind: 'car', color: 0x5a2a2a },
  hale_car: { kind: 'car', color: 0x4a4a3a },
  chute_hatch: { kind: 'hatch' },
  corridor_window: { kind: 'window' },
  vanity: { kind: 'desk', color: 0x6b4a2a },
  vivian_suitcase: { kind: 'bag', color: 0x5a3b1e },
  bed1: { kind: 'bed', color: C.oxblood },
  window1: { kind: 'window' },
  bedside_drawer: { kind: 'desk', color: 0x3b2a1a },
  bed2: { kind: 'bed', color: 0x3a3a2a },
  desk2: { kind: 'desk' },
  wardrobe: { kind: 'wardrobe' },
  desk3: { kind: 'desk' },
  briefcase: { kind: 'bag', color: 0x2a1a0a },
  bed3: { kind: 'bed', color: C.oxblood },
  washstand: { kind: 'appliance', color: 0xb0b4b8 },
};

export type ItemKind = 'key' | 'bottle' | 'paper' | 'knife' | 'tray' | 'camera' | 'envelope' | 'money' | 'film' | 'towel' | 'small' | 'gun' | 'book' | 'bell' | 'case' | 'photo';

export const ITEM_LOOKS: Record<string, { kind: ItemKind; color?: number }> = {
  guest_ledger: { kind: 'book', color: 0x6b1e1e },
  service_bell: { kind: 'bell' },
  walters_notepad: { kind: 'paper' },
  laundry_key: { kind: 'key' },
  spare_master_key: { kind: 'key', color: 0xd04040 },
  aspirin: { kind: 'bottle', color: 0xe8dcc0 },
  sheet_music: { kind: 'paper' },
  ashtray_lipstick: { kind: 'small', color: 0x9aa0a6 },
  bar_tab_book: { kind: 'book', color: 0x1a1a1a },
  kitchen_knife: { kind: 'knife' },
  nightcap_tray: { kind: 'tray' },
  birth_certificate: { kind: 'paper' },
  press_pass: { kind: 'paper', color: 0xc9a24a },
  camera: { kind: 'camera' },
  notebook: { kind: 'book', color: 0x2f5d5a },
  player_suitcase: { kind: 'case' },
  combination_note: { kind: 'paper' },
  sleeping_pills: { kind: 'bottle', color: 0x7a4a1e },
  blackmail_letters: { kind: 'envelope', color: 0xd8ccb0 },
  baby_photo: { kind: 'photo' },
  vivian_cash: { kind: 'money' },
  suite1_key: { kind: 'key' },
  hale_revolver: { kind: 'gun' },
  hale_clippings: { kind: 'paper' },
  hale_notebook: { kind: 'book', color: 0x3a3a2a },
  suite2_key: { kind: 'key' },
  blackmail_ledger: { kind: 'book', color: 0x1a1a1a },
  undeveloped_film: { kind: 'film' },
  telegram: { kind: 'paper', color: 0xf0e8c8 },
  cadillac_keys: { kind: 'key', color: 0x9aa0a6 },
  voss_pistol: { kind: 'gun' },
  suite3_towel: { kind: 'towel' },
  suite3_key: { kind: 'key' },
  voss_envelope: { kind: 'envelope', color: 0xc9a24a },
  voss_cash: { kind: 'money' },
  master_key: { kind: 'key' },
  office_key: { kind: 'key' },
  ruth_earring: { kind: 'small', color: 0xf0e8c8 },
  room6_key: { kind: 'key' },
  room7_key: { kind: 'key' },
};

export type HatKind = 'fedora' | 'cap' | 'bob' | 'slick' | 'ponytail' | 'bald' | 'brim';

export interface CharacterLook {
  coat: number;
  trim: number;
  skin: number;
  hat: HatKind;
  hatColor: number;
  /** Portrait initials for the DOM panels. */
  initials: string;
  accent: string; // CSS colour for UI
}

export const CHARACTER_LOOKS: Record<CharacterId, CharacterLook> = {
  walter: { coat: 0x2a2a2e, trim: C.gold, skin: C.skinPale, hat: 'bald', hatColor: 0xcfcfcf, initials: 'WP', accent: '#c9a24a' },
  voss: { coat: 0x141414, trim: 0x8a8a8a, skin: C.skin, hat: 'fedora', hatColor: 0x1e1e1e, initials: 'LV', accent: '#9aa0a6' },
  vivian: { coat: 0x7a1f2b, trim: C.cream, skin: C.skinPale, hat: 'bob', hatColor: 0x4a1a0a, initials: 'VL', accent: '#d8566a' },
  hale: { coat: 0x4b5320, trim: 0x2a2a1a, skin: 0xd0a98a, hat: 'cap', hatColor: 0x3a3f1c, initials: 'AH', accent: '#8f9a4a' },
  jimmy: { coat: 0x9c7b45, trim: 0x3a2a1a, skin: C.skin, hat: 'slick', hatColor: 0x1a1a1a, initials: 'JD', accent: '#d9b06a' },
  ruth: { coat: 0x7fa7c2, trim: C.cream, skin: C.skinPale, hat: 'ponytail', hatColor: 0xd9c27a, initials: 'RC', accent: '#9cc3dc' },
  player: { coat: 0x2f5d5a, trim: C.cream, skin: C.skin, hat: 'brim', hatColor: 0xe8dcc0, initials: 'YOU', accent: '#e8dcc0' },
};

export interface LampDef {
  room: string;
  x: number;
  y: number;
  radius: number; // tiles
  color?: number;
  strength?: number; // 0..1
}

export const LAMPS: LampDef[] = [
  { room: 'lobby', x: 16.5, y: 6.5, radius: 7 },
  { room: 'lobby', x: 23.5, y: 9.5, radius: 6 },
  { room: 'bar', x: 33.5, y: 6.5, radius: 7 },
  { room: 'bar', x: 37.5, y: 9.5, radius: 5 },
  { room: 'office', x: 8.5, y: 8.5, radius: 6 },
  { room: 'kitchen', x: 21.5, y: 15.5, radius: 7 },
  { room: 'kitchen', x: 31.5, y: 15.5, radius: 7 },
  { room: 'laundry', x: 9.5, y: 15.5, radius: 6 },
  { room: 'room6', x: 32.5, y: 25.5, radius: 5 },
  { room: 'room7', x: 38.5, y: 25.5, radius: 5 },
  { room: 'corridor', x: 12.5, y: 6.5, radius: 6 },
  { room: 'corridor', x: 22.5, y: 6.5, radius: 6 },
  { room: 'corridor', x: 32.5, y: 6.5, radius: 6 },
  { room: 'suite1', x: 10.5, y: 12.5, radius: 7 },
  { room: 'suite2', x: 22.5, y: 12.5, radius: 7 },
  { room: 'suite3', x: 35.5, y: 12.5, radius: 7 },
  { room: 'lot', x: 19.5, y: 2.5, radius: 5, strength: 0.8 },
  { room: 'lot', x: 24.5, y: 21.5, radius: 4, strength: 0.7 },
  { room: 'lot', x: 42.5, y: 8.5, radius: 4, strength: 0.7 },
  { room: 'lot', x: 36.5, y: 21.5, radius: 4, strength: 0.6 },
  { room: 'lot', x: 11.5, y: 2.5, radius: 4, color: C.neon, strength: 0.7 },
];

export function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}
