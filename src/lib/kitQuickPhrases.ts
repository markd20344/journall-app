// Canned starting-points for the free-text fields Mark fills in most often
// through the day — built from the actual reasons/responses/notes he's
// described using in practice, not invented ones. Tapping one inserts it
// rather than replacing what's already there, so a couple of taps can
// still be combined or edited into something more specific.

export const NO_VISIT_REASON_PHRASES = [
  "Already collected",
  "Not available",
  "On holiday / abroad",
  "At work",
  "No longer with the company",
  "Duplicate number",
];

export const RESPONSE_PHRASES = ["Yes, I'll be in", "No longer needed — already returned", "Will confirm a time", "Not sure yet"];

export const DOOR_VISIT_NOTE_PHRASES = ["Left a card", "Spoke to someone else", "Property looked empty", "Will try again"];

export const GENERAL_NOTE_PHRASES = ["Duplicate number — different person answered", "Away until Christmas", "No longer at this address"];

/** Appends a tapped phrase onto whatever's already in the field, rather than clobbering it. */
export function appendPhrase(current: string, phrase: string): string {
  const trimmed = current.trim();
  return trimmed ? `${trimmed}; ${phrase}` : phrase;
}
