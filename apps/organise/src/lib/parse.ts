// Turns one spoken (or typed) sentence into list items:
//   "I'm out of eggs, white onions and protein bread from Aldi"
//   -> Eggs, White onions, Protein bread (Aldi)
// Speech recognition gives back plain words with little punctuation, so the
// splitting is on "and", commas and a few other joiners, and the chatter
// around the items ("I need", "we've run out of", "please") is dropped.
import { SHOP_PREFIX, SHOP_SUFFIX, SHOPS_WITH_AND, isShop, shopName } from "./shops";
import { extractQty } from "./quantity";
import { capitaliseFirst } from "./text";

export interface ParsedItem {
  name: string;
  shop: string | null;
  note?: string;
  /** Only set when a number was said. */
  qty?: number;
}

// Repeated until nothing more comes off, so "and also we need some" all goes.
const LEADING_FILLER = new RegExp(
  "^(?:" +
    [
      "and", "also", "oh", "um+", "uh+", "erm+", "er", "right", "okay", "ok", "so", "please", "and then", "then",
      "can you", "could you", "can i", "could i", "i(?:'d| would) like", "i want",
      "(?:i|we|you)(?:'ve| have)? (?:got )?(?:to|need to|needs to|should|must) (?:buy|get|order|pick up|grab)",
      "(?:i|we)(?: really)? need(?: to)?(?: some)?", "need", "needs",
      "(?:i|we|im|were)(?:'m|'re| am| are)? (?:all |completely |totally )?(?:out of|run out of|running out of|running low on|low on|nearly out of|almost out of)",
      "(?:i|we)(?:'ve| have) (?:run|ran) out of", "(?:i|we) ran out of", "ran out of", "run out of",
      "out of", "running low on", "running out of", "low on", "nearly out of", "almost out of",
      "there(?:'s| is| are) no(?: more)?", "there(?:'s| is) none of the", "no more", "we(?:'ve| have) got no", "(?:i|we)(?:'ve| have) no",
      "add", "put", "buy", "get", "order", "pick up", "grab", "remember", "don't forget(?: the)?", "dont forget(?: the)?",
      "some more", "some", "more", "any", "a few", "few", "the", "a", "an",
    ].join("|") +
    ")\\b[\\s,]*",
  "i",
);

const TRAILING_FILLER = new RegExp(
  "[\\s,]*\\b(?:" +
    [
      "(?:that|which) (?:i|we) (?:need|want)(?: to (?:order|buy|get))?",
      "(?:to|on|onto) (?:the|my|our) (?:shopping )?list",
      "to the shopping", "please", "as well", "too", "again", "thanks", "thank you", "for me",
    ].join("|") +
    ")\\s*$",
  "i",
);

// Joiners between items. Not "&" on its own: it's part of "M&S" and "B&M".
const SPLITTER = /\s*(?:[,;.!?\n]+|\band then\b|\bthen\b|\balso\b|\bplus\b|\band\b|\bso\b|\bbut\b)\s*/i;

// Things that are an item on their own. When two of these are said back to
// back with no pause ("carrots lemons and limes"), they're two items. Words
// that also describe other things ("garlic bread", "lentil crisps", "protein
// wraps", "cheese sauce") are deliberately left out.
const STANDALONE = new Set(
  (
    "eggs milk carrots lemons limes onions apples bananas oranges pears grapes potatoes tomatoes mushrooms " +
    "peppers cucumber cucumbers lettuce spinach broccoli cauliflower courgettes leeks celery avocados " +
    "jam honey rice pasta lentils chickpeas tuna salt sugar flour oats coffee teabags bleach shampoo " +
    "toothpaste yogurt yoghurt butter crisps cereal granola noodles ketchup mayo mustard"
  ).split(" "),
);

function splitRunTogether(part: string): string[] {
  const words = part.split(" ");
  const out: string[][] = [[]];
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (prev && STANDALONE.has(prev.toLowerCase()) && STANDALONE.has(w.toLowerCase())) out.push([]);
    out[out.length - 1].push(w);
  });
  return out.map((ws) => ws.join(" "));
}

function stripFiller(text: string): string {
  let out = text.trim();
  for (let i = 0; i < 10; i++) {
    const next = out.replace(LEADING_FILLER, "").replace(TRAILING_FILLER, "").trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

export function parseItems(input: string): ParsedItem[] {
  let text = input.trim();
  if (!text) return [];

  // "Marks and Spencer" -> "M&S" first, so the splitter leaves it whole.
  for (const [spoken] of SHOPS_WITH_AND) {
    text = text.replace(new RegExp(`\\b${spoken}\\b`, "gi"), shopName(spoken));
  }

  // "From Aldi I need eggs and milk": the shop applies to everything said.
  let sentenceShop: string | null = null;
  const lead = stripFiller(text).match(SHOP_PREFIX);
  if (lead) {
    sentenceShop = shopName(lead[1] ?? lead[2]);
    text = stripFiller(text).slice(lead[0].length);
  }

  const items: ParsedItem[] = [];
  for (const raw of text.split(SPLITTER)) {
    let part = stripFiller(raw);
    let shop = sentenceShop;
    const suffix = part.match(SHOP_SUFFIX);
    if (suffix) {
      shop = shopName(suffix[1]);
      part = stripFiller(part.slice(0, suffix.index));
    } else {
      const prefix = part.match(SHOP_PREFIX);
      if (prefix && part.length > prefix[0].length) {
        shop = shopName(prefix[1] ?? prefix[2]);
        part = stripFiller(part.slice(prefix[0].length));
      }
    }
    part = part.replace(/\s+/g, " ").trim();
    for (const piece of splitRunTogether(part)) {
      if (!piece || piece.length > 80) continue;
      // A bare shop name left over ("...and Aldi") isn't an item.
      if (isShop(piece)) continue;
      const { name, qty } = extractQty(piece);
      items.push(qty === undefined ? { name: capitaliseFirst(name), shop } : { name: capitaliseFirst(name), shop, qty });
    }
  }
  return items;
}
