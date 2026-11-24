// What differs between the three lists. Everything else (the screen, voice,
// storage) is shared.
import type { ListKind } from "../types";
import { AISLES, guessAisle } from "./aisles";
import { CLOTHES_SECTIONS, guessClothesSection } from "./clothes";
import { parseItems, type ParsedItem } from "./parse";
import { parseTasks } from "./tasks";
import { capitaliseFirst } from "./text";

export interface ListConfig {
  kind: ListKind;
  label: string;
  /** Empty for to-dos, which are one flat list. */
  sections: readonly string[];
  guessSection: (name: string) => string;
  parse: (text: string) => ParsedItem[];
  usesShops: boolean;
  example: string;
  doneLabel: string;
  againLabel: string | null;
}

// "jeans size 32", "running socks in large": the size goes in the note so
// the item name stays the same next time it's bought.
const SIZE = /\s*\b(?:(?:in )?(?:a )?size ([\w.-]+(?: \w+)?)|in (?:a )?(extra small|small|medium|large|extra large|x+l|xs|s|m|l|xl))\s*$/i;

function withSize(items: ParsedItem[]): ParsedItem[] {
  return items.map((item) => {
    const m = item.name.match(SIZE);
    if (!m || m.index === 0) return item;
    const raw = m[1] ?? m[2];
    const size = raw.length <= 3 ? raw.toUpperCase() : capitaliseFirst(raw.toLowerCase());
    return { ...item, name: item.name.slice(0, m.index).trim(), note: `Size ${size}` };
  });
}

export const LISTS: Record<ListKind, ListConfig> = {
  food: {
    kind: "food",
    label: "Food",
    sections: AISLES,
    guessSection: guessAisle,
    parse: parseItems,
    usesShops: true,
    example: "eggs, white onions and protein bread from Aldi",
    doneLabel: "In the basket",
    againLabel: "Buy again",
  },
  clothes: {
    kind: "clothes",
    label: "Clothes",
    sections: CLOTHES_SECTIONS,
    guessSection: guessClothesSection,
    parse: (text) => withSize(parseItems(text)),
    usesShops: true,
    example: "black socks, running shoes from JD and jeans size 32",
    doneLabel: "Bought",
    againLabel: "Buy again",
  },
  todo: {
    kind: "todo",
    label: "To-do",
    sections: [],
    guessSection: () => "",
    parse: parseTasks,
    usesShops: false,
    example: "ring the dentist, then book the MOT",
    doneLabel: "Done",
    againLabel: null,
  },
};

export const LIST_ORDER: ListKind[] = ["food", "clothes", "todo"];
