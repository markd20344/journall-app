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
// left blank (e.g. `done` only matters for "action", `time` only for
// "event").
export type ItemKind = "lesson" | "action" | "risk" | "assumption" | "decision" | "event";

export interface Item {
  id: string;
  kind: ItemKind;
  title: string;
  body: string;
  date: string; // YYYY-MM-DD — due date (action), booking date (event), or logged date otherwise
  time: string; // HH:mm, optional — mainly for "event" bookings; empty string if unset
  done: boolean; // only meaningful for "action"
  sourceEntryId: string | null; // the journal entry this was spun off from, if any
  createdAt: string;
  updatedAt: string;
}
