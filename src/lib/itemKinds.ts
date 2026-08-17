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
  hasApplicationFields: boolean; // Agency/Recruiter + Source fields (Job Applications)
  hasCategory: boolean; // Category picker, reusing the same Category table journal entries use (Tasks)
  hasSubtasks: boolean; // Lightweight checklist with a ballpark % complete (Tasks)
  // True for kinds that are pure historical record, not a task with a
  // lifecycle (Diary, Lesson) — they never have a status to close, so
  // without this they'd sit in the Due tab forever. When true, the Due tab
  // only shows the item while it has a linked item that's still open;
  // Calendar and other views are unaffected and always show them.
  referenceOnly: boolean;
  // Per-kind display text for the shared open/on_hold/blocked/closed status
  // values — lets a kind read as its own domain-specific lifecycle (Job
  // Applications: Applied/Interviewing/Waiting to hear back/Closed) without
  // introducing a second status type. Falls back to STATUS_META's generic
  // label when a kind doesn't override it.
  statusLabels?: Partial<Record<ItemStatus, string>>;
  notClosedLabel?: string; // override for the "not-closed" composite filter option
}

// Fixed, semantic colors — unlike categories these carry meaning (risk =
// red, decision = green) so they aren't user-customizable. Display order
// (Task, Story, Booking, Diary, Risk, Decision, Assumption, Lesson, Job
// Application) is deliberate — everywhere these kinds are listed (Log page,
// Browse filters, spin-off buttons) follows this array's order. "Task"
// (kind: "action") is the general-purpose to-do kind — categorized,
// prioritized, linkable, and calendar-visible like every other kind here,
// it's just named for what a small business actually calls it.
export const ITEM_KINDS: ItemKindMeta[] = [
  {
    kind: "action",
    label: "Task",
    shortLabel: "Task",
    color: "#0369a1",
    codePrefix: "T",
    statuses: ["open", "on_hold", "blocked", "closed"],
    hasTime: false,
    dateLabel: "Due date",
    hasPriority: true,
    hasProbabilityImpact: false,
    hasProject: false,
    hasApplicationFields: false,
    hasCategory: true,
    hasSubtasks: true,
    referenceOnly: false,
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
    hasApplicationFields: false,
    hasCategory: false,
    hasSubtasks: false,
    referenceOnly: false,
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
    hasApplicationFields: false,
    hasCategory: false,
    hasSubtasks: false,
    referenceOnly: false,
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
    hasApplicationFields: false,
    hasCategory: false,
    hasSubtasks: false,
    referenceOnly: true,
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
    hasApplicationFields: false,
    hasCategory: false,
    hasSubtasks: false,
    referenceOnly: false,
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
    hasApplicationFields: false,
    hasCategory: false,
    hasSubtasks: false,
    referenceOnly: false,
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
    hasApplicationFields: false,
    hasCategory: false,
    hasSubtasks: false,
    referenceOnly: false,
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
    hasApplicationFields: false,
    hasCategory: false,
    hasSubtasks: false,
    referenceOnly: true,
  },
  {
    kind: "application",
    label: "Job Application",
    shortLabel: "Job App",
    color: "#0891b2",
    codePrefix: "JA",
    statuses: ["open", "on_hold", "blocked", "closed"],
    hasTime: false,
    dateLabel: "Applied on",
    hasPriority: false,
    hasProbabilityImpact: false,
    hasProject: false,
    hasApplicationFields: true,
    hasCategory: false,
    hasSubtasks: false,
    referenceOnly: false,
    statusLabels: {
      open: "Applied",
      on_hold: "Interviewing",
      blocked: "Waiting to hear back",
      closed: "Closed",
    },
    notClosedLabel: "Active",
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

// A kind's own wording for a status value (e.g. Job Applications show
// "Interviewing" instead of "On hold"), falling back to the generic label.
export function statusLabelFor(kind: ItemKind, status: ItemStatus): string {
  return itemKindMeta(kind).statusLabels?.[status] ?? STATUS_META[status].label;
}

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
