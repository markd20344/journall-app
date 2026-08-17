// Core domain types for the journaling app.
// These shapes are also what gets written to disk when syncing via a folder,
// so keep them plain and JSON-serializable.

export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface Topic {
  id: string;
  name: string;
  categoryId: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface Entry {
  id: string;
  date: string; // YYYY-MM-DD, the day this entry is *for*
  categoryId: string;
  topicIds: string[];
  body: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface EntryWithRefs extends Entry {
  category: Category | undefined;
  topics: Topic[];
}

// "Spin-off" items: structured records you can create out of a journal
// entry (or standalone) — lessons learned, actions, risks, etc. Each kind
// uses the same shape; fields that don't apply to a given kind are simply
// left blank (e.g. `status` is null for kinds with no lifecycle, `time`
// only matters for "event").
export type ItemKind = "lesson" | "action" | "risk" | "assumption" | "decision" | "event" | "story" | "diary";

// Shared RAG scale — used as a priority on Actions/Decisions/Stories, and
// as separate probability/impact ratings on Risks.
export type Priority = "high" | "medium" | "low";

// Not every kind uses every status — see ITEM_KINDS in lib/itemKinds.ts for
// which statuses are valid per kind. Kinds with no lifecycle (lesson,
// event) use a null status.
export type ItemStatus = "open" | "on_hold" | "blocked" | "closed";

// A dated note logged against an item — a running progress/commentary
// trail, distinct from a one-off closure note.
export interface StatusUpdate {
  id: string;
  note: string;
  createdAt: string; // ISO timestamp
}

export interface Item {
  id: string;
  kind: ItemKind;
  code: string; // auto-assigned, e.g. "R001", "D001" — sequential per kind
  title: string;
  body: string;
  date: string; // YYYY-MM-DD — due date (action), booking date (event), or logged date otherwise
  time: string; // HH:mm, optional — mainly for "event" bookings; empty string if unset
  status: ItemStatus | null;
  statusUpdates: StatusUpdate[]; // dated progress notes, newest last
  closedAt: string | null; // auto-set the moment status becomes "closed"; cleared if reopened
  closureNote: string; // optional note explaining the closure
  linkedItemIds: string[]; // other Items this one is linked to, any kind — always bidirectional
  sourceEntryId: string | null; // the journal entry this was spun off from, if any
  priority: Priority | null; // Actions, Decisions, Stories — null for kinds that don't use it
  probability: Priority | null; // Risks only
  impact: Priority | null; // Risks only
  project: string | null; // Stories only — free-form project/app label, reused via autocomplete
  createdAt: string;
  updatedAt: string;
}
