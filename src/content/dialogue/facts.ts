/**
 * How facts read in the notebook, which people they concern, which open
 * questions they answer, and which connections they draw on the board.
 */
import type { CharacterId } from '../../sim/types';

export interface FactText {
  text: string;
  about: CharacterId[];
}

export const FACT_TEXT: Record<string, FactText> = {
  vivianIsMrsMarsh: { text: '"Mrs. Marsh" in Suite 1 is the actress Vivian Lane.', about: ['vivian'] },
  vivianWasDriver: { text: 'Vivian Lane was driving on the coast road in 1949.', about: ['vivian'] },
  vossBlackmailsVivian: { text: 'Voss has bled Vivian for thirteen years.', about: ['voss', 'vivian'] },
  vossBlackmailer: { text: 'Voss keeps a ledger of everyone he squeezes.', about: ['voss'] },
  ruthIsVivianDaughter: { text: 'Ruth is the daughter Vivian gave up in 1950.', about: ['ruth', 'vivian'] },
  vivianHadADaughter: { text: 'Vivian keeps a baby photograph marked March 1950.', about: ['vivian'] },
  jimmyIsPhotographer: { text: 'Jimmy is a staff photographer, not a salesman.', about: ['jimmy'] },
  jimmyWorksForVoss: { text: 'Jimmy takes his orders, and his pay, from Voss.', about: ['jimmy', 'voss'] },
  haleTrackedVoss: { text: 'The Colonel has followed Voss across three states.', about: ['hale', 'voss'] },
  claraHaleDied1949: { text: 'Clara Hale, nineteen, died on the coast road in 1949.', about: ['hale'] },
  haleIsClarasFather: { text: 'The Colonel is Clara Hale\'s father.', about: ['hale'] },
  safeCombination: { text: 'The hotel safe opens to 5-2271, the number in the Cadillac.', about: ['voss', 'walter'] },
  suite3CalledOut: { text: 'Suite 3 placed a long-distance call at 9:52.', about: ['voss'] },
  phoneNumberOnSheetMusic: { text: 'A telephone number is pencilled on the sheet music.', about: [] },
  vivianLipstickBrand: { text: 'The ashtray by the archway holds Vivian\'s lipstick.', about: ['vivian'] },
  vossBoughtVivianDrinks: { text: 'Voss bought Mrs. Marsh a gin, by the tab book.', about: ['voss', 'vivian'] },
  vossTakesANightcap: { text: 'Walter takes Voss a brandy at twenty past one.', about: ['voss', 'walter'] },
  caseReopened: { text: 'The 1949 hit-and-run has been reopened.', about: [] },
  walterWasHere1949: { text: 'Walter was on duty the night of the 1949 party.', about: ['walter'] },
  vivianCarDented: { text: 'Vivian\'s car still carries a dent from 1949.', about: ['vivian'] },
  killerOfVoss: { text: 'You saw who killed Voss.', about: ['voss'] },
  'dead:voss': { text: 'Voss died in Suite 3.', about: ['voss'] },
  'dead:vivian': { text: 'Vivian died in Suite 1.', about: ['vivian'] },
  'dead:hale': { text: 'The Colonel died in Suite 3.', about: ['hale'] },
  'bloody:jimmy': { text: 'Jimmy had blood on his cuff.', about: ['jimmy'] },
  'bloody:hale': { text: 'The Colonel had blood on him.', about: ['hale'] },
  'armed:hale': { text: 'The Colonel carried the kitchen knife.', about: ['hale'] },
  'armed:voss': { text: 'Voss carries a small pistol.', about: ['voss'] },
  nightcapDosed: { text: 'The nightcap was drugged.', about: ['voss', 'vivian'] },
  haleHasAKnife: { text: 'The Colonel took a knife from the kitchen.', about: ['hale'] },
};

/** How each person appears before the player knows better. */
export const PUBLIC_FACE: Record<CharacterId, { name: string; shortName: string; blurb: string; revealedBy?: string }> = {
  voss: { name: 'Mr. Voss', shortName: 'Voss', blurb: 'A salesman with a Cadillac and a ready smile, Suite 3.' },
  vivian: { name: 'Mrs. V. Marsh', shortName: 'Mrs. Marsh', blurb: 'A lady travelling alone, Suite 1. She keeps to herself.', revealedBy: 'vivianIsMrsMarsh' },
  hale: { name: 'Colonel Hale', shortName: 'the Colonel', blurb: 'A retired army man with a newspaper, Suite 2. He watches the room.' },
  jimmy: { name: 'Jimmy Doyle', shortName: 'Jimmy', blurb: 'A salesman on a getaway with his girl, Room 6.' },
  ruth: { name: 'Ruth', shortName: 'Ruth', blurb: 'A nervous young woman in Room 6, here with Jimmy.' },
  walter: { name: 'Walter Pike', shortName: 'Walter', blurb: 'The night clerk. He has been here longer than the carpet.' },
  player: { name: 'You', shortName: 'you', blurb: 'Stranded, wet, and awake.' },
};

export interface Question {
  id: string;
  about: CharacterId;
  text: string;
  answeredBy: string[];
}

export const QUESTIONS: Question[] = [
  { id: 'q_marsh', about: 'vivian', text: 'Who is Mrs. Marsh, really?', answeredBy: ['vivianIsMrsMarsh'] },
  { id: 'q_voss_on_vivian', about: 'vivian', text: 'What does Voss have on her?', answeredBy: ['vossBlackmailsVivian', 'vivianWasDriver'] },
  { id: 'q_photo', about: 'vivian', text: 'Why does she keep a baby photograph?', answeredBy: ['ruthIsVivianDaughter', 'vivianHadADaughter'] },
  { id: 'q_voss_sells', about: 'voss', text: 'What does Voss actually sell?', answeredBy: ['vossBlackmailer'] },
  { id: 'q_envelope', about: 'voss', text: 'What did Voss lock in the hotel safe?', answeredBy: ['vivianWasDriver', 'safeCombination'] },
  { id: 'q_pistol', about: 'voss', text: 'Is Voss armed?', answeredBy: ['armed:voss'] },
  { id: 'q_hale_watch', about: 'hale', text: 'Why does the Colonel watch Voss?', answeredBy: ['haleTrackedVoss', 'haleIsClarasFather'] },
  { id: 'q_clara', about: 'hale', text: 'Who was Clara Hale?', answeredBy: ['claraHaleDied1949', 'haleIsClarasFather'] },
  { id: 'q_knife', about: 'hale', text: 'What is the Colonel planning?', answeredBy: ['armed:hale', 'killerOfVoss', 'haleHasAKnife'] },
  { id: 'q_jimmy_job', about: 'jimmy', text: 'What does Jimmy really do?', answeredBy: ['jimmyIsPhotographer'] },
  { id: 'q_jimmy_boss', about: 'jimmy', text: 'Who is Jimmy working for?', answeredBy: ['jimmyWorksForVoss'] },
  { id: 'q_ruth_search', about: 'ruth', text: 'Who is Ruth looking for?', answeredBy: ['ruthIsVivianDaughter'] },
  { id: 'q_walter_1949', about: 'walter', text: 'What did Walter see in 1949?', answeredBy: ['walterWasHere1949', 'vivianWasDriver'] },
  { id: 'q_nightcap', about: 'walter', text: 'What is in the nightcap?', answeredBy: ['nightcapDosed', 'vossTakesANightcap'] },
];

export interface Relation {
  a: CharacterId;
  b: CharacterId;
  label: string;
  requires: string[];
}

export const RELATIONS: Relation[] = [
  { a: 'voss', b: 'vivian', label: 'blackmail', requires: ['vossBlackmailsVivian', 'vivianWasDriver'] },
  { a: 'ruth', b: 'vivian', label: 'daughter', requires: ['ruthIsVivianDaughter'] },
  { a: 'jimmy', b: 'voss', label: 'works for', requires: ['jimmyWorksForVoss'] },
  { a: 'jimmy', b: 'ruth', label: 'photographs', requires: ['jimmyIsPhotographer'] },
  { a: 'hale', b: 'voss', label: 'hunting', requires: ['haleTrackedVoss'] },
  { a: 'hale', b: 'vivian', label: 'Clara, 1949', requires: ['vivianWasDriver', 'haleIsClarasFather'] },
  { a: 'walter', b: 'voss', label: 'paid off', requires: ['safeCombination', 'vossTakesANightcap'] },
  { a: 'walter', b: 'vivian', label: '1949', requires: ['walterWasHere1949'] },
];
