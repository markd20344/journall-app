// Formats text coming back from voice dictation. The Web Speech API returns
// each dictated chunk as raw words with no punctuation and inconsistent
// capitalization, so the app has to add both itself when stitching chunks
// together across separate start/stop dictation cycles.

function capitalizeFirst(text: string): string {
  return text.length > 0 ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

const ENDS_WITH_SENTENCE_STOP = /[.!?]["')\]]?$/;

/**
 * For prose fields (entry/item body): capitalizes each new dictated chunk
 * and inserts a full stop after the previous chunk if it didn't already end
 * with sentence-ending punctuation, so separate dictation passes read as
 * separate sentences instead of one run-on line.
 */
export function appendDictatedSentence(existing: string, chunk: string): string {
  const trimmedChunk = chunk.trim();
  if (!trimmedChunk) return existing;
  const capitalized = capitalizeFirst(trimmedChunk);
  const trimmedExisting = existing.trim();
  if (!trimmedExisting) return capitalized;
  const needsStop = !ENDS_WITH_SENTENCE_STOP.test(trimmedExisting);
  return `${trimmedExisting}${needsStop ? "." : ""} ${capitalized}`;
}

/**
 * For short-phrase fields (titles, topic names): capitalizes the first
 * word only when starting fresh, and otherwise just space-joins — these
 * aren't sentences, so no auto full stop is inserted.
 */
export function appendDictatedPhrase(existing: string, chunk: string): string {
  const trimmedChunk = chunk.trim();
  if (!trimmedChunk) return existing;
  const trimmedExisting = existing.trim();
  if (!trimmedExisting) return capitalizeFirst(trimmedChunk);
  return `${trimmedExisting} ${trimmedChunk}`;
}
