/**
 * What the player can ask about, claim, or accuse. Topics unlock as facts
 * are learned (this loop's clues plus cross-loop memory); claims can always
 * be made, true or bluffed.
 */
import { playerKnows } from '../../sim/commands';
import type { World } from '../../sim/types';

export interface TopicDef {
  id: string;
  label: string;
  /** Any one of these known facts unlocks the topic. */
  requires?: string[];
}

export const TOPICS: TopicDef[] = [
  { id: 'tonight', label: 'Tonight' },
  { id: 'the_hotel', label: 'The hotel' },
  { id: 'the_storm', label: 'The storm' },
  { id: 'voss', label: 'Mr. Voss' },
  { id: 'vivian', label: 'The lady in Suite 1' },
  { id: 'mrs_marsh', label: 'Mrs. Marsh', requires: ['vivianIsMrsMarsh', 'met:vivian'] },
  { id: 'hale', label: 'The Colonel' },
  { id: 'ruth', label: 'The girl in Room 6' },
  { id: 'jimmy', label: 'Jimmy Doyle' },
  { id: 'walter', label: 'Walter, the clerk' },
  { id: 'crash_1949', label: 'The 1949 crash', requires: ['caseReopened', 'claraHaleDied1949', 'haleTrackedVoss', 'vivianWasDriver'] },
  { id: 'clara_hale', label: 'Clara Hale', requires: ['claraHaleDied1949', 'haleIsClarasFather'] },
  { id: 'the_letters', label: 'The letters', requires: ['vivianWasDriver', 'vossBlackmailsVivian'] },
  { id: 'the_ledger', label: "Voss's ledger", requires: ['vossBlackmailer'] },
  { id: 'the_safe', label: 'The hotel safe', requires: ['safeCombination', 'vossEnvelopeInSafe'] },
  { id: 'the_nightcap', label: 'The nightcap', requires: ['vossTakesANightcap', 'nightcapDosed'] },
  { id: 'the_telegram', label: 'The telegram', requires: ['telegramSeen'] },
  { id: 'the_camera', label: 'The camera', requires: ['jimmyIsPhotographer'] },
  { id: 'the_murder', label: 'The murder', requires: ['dead:voss', 'murderHappened'] },
];

export interface ClaimDef {
  id: string;
  fact: string;
  value: string | boolean;
  label: string;
  /** Known facts that make this a truth rather than a bluff (for the notebook). */
  provenBy?: string[];
}

export const CLAIMS: ClaimDef[] = [
  { id: 'jimmy_voss', fact: 'jimmyWorksForVoss', value: true, label: 'Jimmy works for Voss', provenBy: ['jimmyIsPhotographer', 'jimmyWorksForVoss'] },
  { id: 'vivian_suite1', fact: 'vivianIsInSuite1', value: true, label: 'Vivian Lane is in Suite 1', provenBy: ['vivianIsMrsMarsh'] },
  { id: 'vivian_marsh', fact: 'vivianIsMrsMarsh', value: true, label: 'Mrs. Marsh is Vivian Lane', provenBy: ['vivianIsMrsMarsh'] },
  { id: 'hale_father', fact: 'haleIsClarasFather', value: true, label: "The Colonel is Clara Hale's father", provenBy: ['haleIsClarasFather', 'claraHaleDied1949'] },
  { id: 'hale_knife', fact: 'haleHasAKnife', value: true, label: 'The Colonel has a knife', provenBy: ['armed:hale'] },
  { id: 'voss_pistol', fact: 'vossHasAPistol', value: true, label: 'Voss carries a pistol', provenBy: ['armed:voss'] },
  { id: 'ruth_daughter', fact: 'ruthIsYourDaughter', value: true, label: 'Ruth is your daughter', provenBy: ['ruthIsVivianDaughter', 'vivianHadADaughter'] },
  { id: 'ruth_daughter_of_vivian', fact: 'ruthIsVivianDaughter', value: true, label: "Ruth is Vivian Lane's daughter", provenBy: ['ruthIsVivianDaughter'] },
  { id: 'voss_blackmail', fact: 'vossBlackmailsVivian', value: true, label: 'Voss is blackmailing Vivian', provenBy: ['vossBlackmailsVivian', 'vossBlackmailer'] },
  { id: 'driver_vivian', fact: 'driverOf1949', value: 'vivian', label: 'Vivian Lane was driving in 1949', provenBy: ['vivianWasDriver'] },
  { id: 'driver_voss', fact: 'driverOf1949', value: 'voss', label: 'Voss was driving in 1949' },
  { id: 'trouble_upstairs', fact: 'troubleUpstairs', value: true, label: 'Something is wrong upstairs' },
  { id: 'voss_dead', fact: 'dead:voss', value: true, label: 'Voss is dead', provenBy: ['dead:voss'] },
  { id: 'nightcap_dosed', fact: 'nightcapDosed', value: true, label: 'The nightcap is drugged', provenBy: ['nightcapDosed'] },
];

export interface AccusationDef {
  kind: 'killer' | 'driver';
  label: string;
}

export const ACCUSATIONS: AccusationDef[] = [
  { kind: 'killer', label: 'of the murder' },
  { kind: 'driver', label: 'of the 1949 crash' },
];

export function topicAvailable(w: World, t: TopicDef, memoryKnows: (fact: string) => boolean): boolean {
  if (!t.requires) return true;
  return t.requires.some((f) => playerKnows(w, f) || memoryKnows(f));
}

export function availableTopics(w: World, memoryKnows: (fact: string) => boolean): TopicDef[] {
  return TOPICS.filter((t) => topicAvailable(w, t, memoryKnows));
}

export function claimIsTrue(w: World, c: ClaimDef, memoryKnows: (fact: string) => boolean): boolean {
  if (!c.provenBy) return false;
  return c.provenBy.some((f) => playerKnows(w, f) || memoryKnows(f));
}
