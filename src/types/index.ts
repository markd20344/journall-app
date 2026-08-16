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
