import type { ItemKind } from "../types";

export interface ItemKindMeta {
  kind: ItemKind;
  label: string;
  shortLabel: string;
  color: string;
  hasDone: boolean; // shows a done/open checkbox
  hasTime: boolean; // shows a time field alongside date
  dateLabel: string;
}

// Fixed, semantic colors — unlike categories these carry meaning (risk =
// red, decision = green) so they aren't user-customizable.
export const ITEM_KINDS: ItemKindMeta[] = [
  { kind: "lesson", label: "Lesson Learned", shortLabel: "Lesson", color: "#b45309", hasDone: false, hasTime: false, dateLabel: "Date" },
  { kind: "action", label: "Action", shortLabel: "Action", color: "#0369a1", hasDone: true, hasTime: false, dateLabel: "Due date" },
  { kind: "risk", label: "Risk", shortLabel: "Risk", color: "#b91c1c", hasDone: false, hasTime: false, dateLabel: "Date" },
  { kind: "assumption", label: "Assumption", shortLabel: "Assumption", color: "#7c3aed", hasDone: false, hasTime: false, dateLabel: "Date" },
  { kind: "decision", label: "Decision", shortLabel: "Decision", color: "#15803d", hasDone: false, hasTime: false, dateLabel: "Date" },
  { kind: "event", label: "Calendar Booking", shortLabel: "Booking", color: "#4338ca", hasDone: false, hasTime: true, dateLabel: "Date" },
];

const BY_KIND = new Map(ITEM_KINDS.map((k) => [k.kind, k]));

export function itemKindMeta(kind: ItemKind): ItemKindMeta {
  const meta = BY_KIND.get(kind);
  if (!meta) throw new Error(`Unknown item kind: ${kind}`);
  return meta;
}
