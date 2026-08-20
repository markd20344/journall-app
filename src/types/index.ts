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
export type ItemKind = "lesson" | "action" | "risk" | "assumption" | "decision" | "event" | "story" | "diary" | "application";

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

// A lightweight checklist item under a Task — deliberately not a full Item
// (no date/priority/status lifecycle of its own): it exists to give a
// ballpark sense of how much of a task is done, not to be tracked
// independently elsewhere in the app.
export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  createdAt: string; // ISO timestamp
}

// A book you're tracking — wishlist ("saw it on TikTok"), currently reading
// (any number at once — fiction, mental health, technical... whatever's on
// the go), or finished. Deliberately its own shape rather than another Item
// kind: books carry fields (author, series, cover image, rating) that don't
// map onto Item's status/priority/RAG model at all.
export type BookStatus = "wishlist" | "reading" | "on_hold" | "finished" | "abandoned";

// Where you're actually consuming it — matters because the same person
// reads PDFs, listens on Audible, and watches full-book readalongs on
// YouTube, often for different books at once.
export type BookFormat = "physical" | "ebook" | "pdf" | "audiobook" | "youtube";

export interface Book {
  id: string;
  title: string;
  author: string; // "" if unknown — not required, so a quick cover-photo add isn't blocked on it
  series: string | null; // reused via autocomplete across books, like Topics
  seriesOrder: number | null; // book # within the series, if known
  status: BookStatus;
  format: BookFormat;
  coverImage: string | null; // small JPEG data URL, resized client-side — a snapped cover or TikTok screenshot
  rating: number | null; // 1-5, optional, usually set once finished
  notes: string;
  dateAdded: string; // YYYY-MM-DD, when it went on the list
  dateStarted: string | null; // YYYY-MM-DD, auto-set the first time status becomes "reading"
  dateFinished: string | null; // YYYY-MM-DD, auto-set the first time status becomes "finished"
  createdAt: string;
  updatedAt: string;
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
  agency: string | null; // Job Applications only — recruiter/agency applied through
  source: string | null; // Job Applications only — where the opportunity was found
  categoryId: string | null; // Tasks only — same Category table journal entries use
  subtasks: Subtask[]; // Tasks only — lightweight checklist, drives a ballpark % complete
  createdAt: string;
  updatedAt: string;
}
