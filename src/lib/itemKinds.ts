import type { ItemKind, ItemStatus } from "../types";

export interface ItemKindMeta {
  kind: ItemKind;
  label: string;
  shortLabel: string;
  color: string;
  codePrefix: string;
  statuses: ItemStatus[]; // empty = no lifecycle (Lesson, Booking)
  hasTime: boolean; // shows a time field alongside date
  dateLabel: string;
}

// Fixed, semantic colors — unlike categories these carry meaning (risk =
// red, decision = green) so they aren't user-customizable.
export const ITEM_KINDS: ItemKindMeta[] = [
  {
    kind: "lesson",
    label: "Lesson Learned",
    shortLabel: "Lesson",
    color: "#b45309",
    codePrefix: "L",
    statuses: [],
    hasTime: false,
    dateLabel: "Date",
  },
  {
    kind: "action",
    label: "Action",
    shortLabel: "Action",
    color: "#0369a1",
    codePrefix: "AC",
    statuses: ["open", "on_hold", "blocked", "closed"],
    hasTime: false,
    dateLabel: "Due date",
  },
  {
    kind: "risk",
    label: "Risk",
    shortLabel: "Risk",
    color: "#b91c1c",
    codePrefix: "R",
    statuses: ["open", "closed"],
    hasTime: false,
    dateLabel: "Date",
  },
  {
    kind: "assumption",
    label: "Assumption",
    shortLabel: "Assumption",
    color: "#7c3aed",
    codePrefix: "AS",
    statuses: ["open", "closed"],
    hasTime: false,
    dateLabel: "Date",
  },
  {
    kind: "decision",
    label: "Decision",
    shortLabel: "Decision",
    color: "#15803d",
    codePrefix: "D",
    statuses: ["open", "closed", "blocked"],
    hasTime: false,
    dateLabel: "Date",
  },
  {
    kind: "event",
    label: "Calendar Booking",
    shortLabel: "Booking",
    color: "#4338ca",
    codePrefix: "CB",
    statuses: [],
    hasTime: true,
    dateLabel: "Date",
  },
];

const BY_KIND = new Map(ITEM_KINDS.map((k) => [k.kind, k]));

export function itemKindMeta(kind: ItemKind): ItemKindMeta {
  const meta = BY_KIND.get(kind);
  if (!meta) throw new Error(`Unknown item kind: ${kind}`);
  return meta;
}

export interface StatusMeta {
  status: ItemStatus;
  label: string;
  color: string;
}

export const STATUS_META: Record<ItemStatus, StatusMeta> = {
  open: { status: "open", label: "Open", color: "#2563eb" },
  on_hold: { status: "on_hold", label: "On hold", color: "#d97706" },
  blocked: { status: "blocked", label: "Blocked", color: "#dc2626" },
  closed: { status: "closed", label: "Closed", color: "#16a34a" },
};
