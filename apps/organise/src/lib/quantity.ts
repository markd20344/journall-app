// "3 packets of protein wraps" -> Protein wraps, qty 3. The count and the
// "packets of" come off the name so it stays the same every time it's bought
// (Buy again and duplicate checks match on the name). The pack word isn't
// kept: the list shows only the number.
const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  couple: 2, "a couple": 2, "a couple of": 2, "couple of": 2, dozen: 12, "a dozen": 12, "half a dozen": 6,
};

const NUM = "(\\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|half a dozen|a dozen|dozen|a couple(?: of)?|couple(?: of)?)";
const UNIT =
  "(?:packets?|packs?|multipacks?|bottles?|tins?|cans?|jars?|bags?|boxes?|loaf|loaves|cartons?|tubs?|bunch(?:es)?|pairs?|punnets?|bars?|blocks?|pots?|sachets?|tubes?|trays?|crates?|rolls?|tins)";

const LEADING = new RegExp(`^(?:${NUM}\\s+)?(?:${UNIT}\\s+of\\s+)?(.+)$`, "i");
const TRAILING = new RegExp(`^(.+?)\\s+(?:x\\s*|times\\s+)${NUM}$`, "i");

function toNumber(word: string): number | undefined {
  const w = word.toLowerCase().trim();
  const n = /^\d+$/.test(w) ? Number(w) : WORDS[w];
  return n && n > 0 && n < 1000 ? n : undefined;
}

/** qty is undefined when none was said, so re-adding an item keeps its count. */
export function extractQty(text: string): { name: string; qty?: number } {
  const trailing = text.match(TRAILING);
  if (trailing) {
    const qty = toNumber(trailing[2]);
    if (qty) return { name: trailing[1].trim(), qty };
  }
  const m = text.match(LEADING);
  if (!m) return { name: text };
  const [, num, rest] = m;
  const hadUnit = rest.length < text.length - (num ? num.length + 1 : 0);
  // A bare number with nothing after it ("two") isn't an item.
  if (!rest.trim()) return { name: text };
  if (!num && !hadUnit) return { name: text };
  return { name: rest.trim(), qty: num ? toNumber(num) : undefined };
}
