import type { ItemKind, ItemStatus, Priority } from "../types";

export interface ItemKindMeta {
  kind: ItemKind;
  label: string;
  shortLabel: string;
  color: string;
  codePrefix: string;
  statuses: ItemStatus[]; // empty = no lifecycle (Lesson, Booking)
  hasTime: boolean; // shows a time field alongside date
  dateLabel: string;
  hasPriority: boolean; // single High/Medium/Low priority (RAG)
  hasProbabilityImpact: boolean; // separate High/Medium/Low probability + impact (Risks)
  hasProject: boolean; // free-form project/app label (Stories)
}

// Fixed, semantic colors — unlike categories these carry meaning (risk =
// red, decision = green) so they aren't user-customizable. Display order
// (Action, Story, Booking, Diary, Risk, Decision, Assumption, Lesson) is
// deliberate — everywhere these kinds are listed (Log page, Browse
// filters, spin-off buttons) follows this array's order.
export const ITEM_KINDS: ItemKindMeta[] = [
  {
    kind: "action",
    label: "Action",
    shortLabel: "Action",
    color: "#0369a1",
    codePrefix: "AC",
    statuses: ["open", "on_hold", "blocked", "closed"],
    hasTime: false,
    dateLabel: "Due date",
    hasPriority: true,
    hasProbabilityImpact: false,
    hasProject: false,
  },
  {
    kind: "story",
    label: "Story",
    shortLabel: "Story",
    color: "#0d9488",
    codePrefix: "ST",
    statuses: ["open", "on_hold", "blocked", "closed"],
    hasTime: false,
    dateLabel: "Due date",
    hasPriority: true,
    hasProbabilityImpact: false,
    hasProject: true,
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
    hasPriority: false,
    hasProbabilityImpact: false,
    hasProject: false,
  },
  {
    kind: "diary",
    label: "Diary Entry",
    shortLabel: "Diary",
    color: "#be185d",
    codePrefix: "DE",
    statuses: [],
    hasTime: false,
    dateLabel: "Date",
    hasPriority: false,
    hasProbabilityImpact: false,
    hasProject: false,
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
    hasPriority: false,
    hasProbabilityImpact: true,
    hasProject: false,
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
    hasPriority: true,
    hasProbabilityImpact: false,
    hasProject: false,
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
    hasPriority: false,
    hasProbabilityImpact: false,
    hasProject: false,
  },
  {
    kind: "lesson",
    label: "Lesson Learned",
    shortLabel: "Lesson",
    color: "#b45309",
    codePrefix: "L",
    statuses: [],
    hasTime: false,
    dateLabel: "Date",
    hasPriority: false,
    hasProbabilityImpact: false,
    hasProject: false,
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

export interface PriorityMeta {
  priority: Priority;
  label: string;
  color: string;
}

// Standard RAG (Red/Amber/Green) scale, shared by priority, probability and impact.
export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  high: { priority: "high", label: "High", color: "#dc2626" },
  medium: { priority: "medium", label: "Medium", color: "#d97706" },
  low: { priority: "low", label: "Low", color: "#16a34a" },
};

export const PRIORITY_ORDER: Priority[] = ["high", "medium", "low"];
