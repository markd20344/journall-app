// To-dos are said as whole phrases ("ring the dentist and book a check-up"),
// so unlike shopping items they are NOT split on "and": "pick up and drop
// off the parcel" is one job. They split on pauses, commas, "then", "also"
// and "after that", and lose the "I need to" / "remember to" in front.
import type { ParsedItem } from "./parse";
import { capitaliseFirst } from "./text";

const LEADING = new RegExp(
  "^(?:" +
    [
      "and", "also", "oh", "um+", "uh+", "erm+", "er", "right", "okay", "ok", "so", "then", "and then",
      "(?:i|we)(?:'ve| have)? (?:really )?(?:got to|gotta|have to|need to|must|should)",
      "(?:i|we) need to", "need to", "got to", "have to",
      "(?:please )?(?:remember|remind me) to", "don'?t forget to", "make sure (?:i|we|to)",
      "(?:add )?(?:a )?(?:to ?do|task)(?: to)?", "can you add", "add a reminder to",
    ].join("|") +
    ")\\b[\\s,:]*",
  "i",
);

const TRAILING = /[\s,]*\b(?:to (?:the|my) (?:to ?do )?list|please|thanks|thank you)\s*$/i;

const SPLITTER = /\s*(?:[,;.!?\n]+|\band then\b|\bthen\b|\balso\b|\bafter that\b|\bas well as\b)\s*/i;

function strip(text: string): string {
  let out = text.trim();
  for (let i = 0; i < 8; i++) {
    const next = out.replace(LEADING, "").replace(TRAILING, "").trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

export function parseTasks(input: string): ParsedItem[] {
  return input
    .split(SPLITTER)
    .map(strip)
    .filter((t) => t.length > 1 && t.length <= 200)
    .map((t) => ({ name: capitaliseFirst(t), shop: null }));
}
