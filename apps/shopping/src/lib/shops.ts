import { fold } from "./text";

// Shops the parser recognises in "protein bread from Aldi". Spoken forms map to
// the spelling shown on the list.
const SHOPS: [spoken: string, shown: string][] = [
  ["aldi", "Aldi"],
  ["lidl", "Lidl"],
  ["little", "Lidl"], // how speech recognition usually hears "Lidl"
  ["tesco", "Tesco"],
  ["tescos", "Tesco"],
  ["sainsburys", "Sainsbury's"],
  ["asda", "Asda"],
  ["morrisons", "Morrisons"],
  ["waitrose", "Waitrose"],
  ["co-op", "Co-op"],
  ["coop", "Co-op"],
  ["co op", "Co-op"],
  ["iceland", "Iceland"],
  ["m&s", "M&S"],
  ["m and s", "M&S"],
  ["marks and spencer", "M&S"],
  ["marks and spencers", "M&S"],
  ["marks & spencer", "M&S"],
  ["ocado", "Ocado"],
  ["amazon", "Amazon"],
  ["boots", "Boots"],
  ["superdrug", "Superdrug"],
  ["home bargains", "Home Bargains"],
  ["b&m", "B&M"],
  ["b and m", "B&M"],
  ["costco", "Costco"],
  ["holland and barrett", "Holland & Barrett"],
  ["holland & barrett", "Holland & Barrett"],
  ["myprotein", "Myprotein"],
  ["my protein", "Myprotein"],
  ["the butchers", "Butcher"],
  ["the butcher", "Butcher"],
  ["the market", "Market"],
];

// Longest first, so "marks and spencers" wins over "marks and spencer".
const SORTED = [...SHOPS].sort((a, b) => b[0].length - a[0].length);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SHOP_PATTERN = SORTED.map(([spoken]) => escape(spoken)).join("|");

/** "from aldi" / "at tesco" / "in lidl" at the end of a phrase. */
export const SHOP_SUFFIX = new RegExp(`\\s*\\b(?:from|at|in|on|off)\\s+(?:the\\s+)?(${SHOP_PATTERN})\\s*$`, "i");
/**
 * "from aldi ..." / "aldi: ..." at the start of a phrase. A bare shop name
 * isn't enough ("little gem lettuce" is not from Lidl).
 */
export const SHOP_PREFIX = new RegExp(
  `^(?:(?:from|at|in)\\s+(?:the\\s+)?(${SHOP_PATTERN})\\s*[:,-]?\\s+|(${SHOP_PATTERN})\\s*[:-]\\s*)`,
  "i",
);
/** Spoken shop names with "and" in them, which would otherwise be split as two items. */
export const SHOPS_WITH_AND = SORTED.filter(([spoken]) => / and /.test(spoken));

export function shopName(spoken: string): string {
  const f = fold(spoken);
  return SHOPS.find(([s]) => s === f)?.[1] ?? spoken;
}

export function isShop(text: string): boolean {
  const f = fold(text);
  return SHOPS.some(([spoken, shown]) => spoken === f || fold(shown) === f);
}

/** Every shop name the edit screen offers, de-duplicated. */
export const KNOWN_SHOPS = Array.from(new Set(SHOPS.map(([, shown]) => shown)));
