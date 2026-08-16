// Thin CRUD layer over Dexie. Every write also bumps `updatedAt` so the
// file-sync layer can do simple last-write-wins conflict resolution.
import { db } from "./db";
import type { Category, Entry, Item, ItemKind, Topic } from "../types";
import { newId, nowIso } from "../lib/id";

export async function createEntry(input: {
  date: string;
  categoryId: string;
  topicIds: string[];
  body: string;
}): Promise<Entry> {
  const ts = nowIso();
  const entry: Entry = {
    id: newId(),
    date: input.date,
    categoryId: input.categoryId,
    topicIds: input.topicIds,
    body: input.body,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.entries.add(entry);
  return entry;
}

export async function updateEntry(
  id: string,
  changes: Partial<Pick<Entry, "date" | "categoryId" | "topicIds" | "body">>,
): Promise<void> {
  await db.entries.update(id, { ...changes, updatedAt: nowIso() });
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}

export async function upsertCategory(name: string, color: string): Promise<Category> {
  const existing = await db.categories.where("name").equalsIgnoreCase(name).first();
  if (existing) return existing;
  const ts = nowIso();
  const category: Category = { id: newId(), name, color, createdAt: ts, updatedAt: ts };
  await db.categories.add(category);
  return category;
}

export async function deleteCategory(id: string): Promise<void> {
  // Keep entries/topics around (orphaned category ref) rather than cascading
  // deletes silently — journaling data should never disappear unexpectedly.
  await db.categories.delete(id);
}

export async function renameCategory(id: string, name: string, color: string): Promise<void> {
  await db.categories.update(id, { name, color, updatedAt: nowIso() });
}

export async function findOrCreateTopic(name: string, categoryId: string): Promise<Topic> {
  const trimmed = name.trim();
  const existing = await db.topics
    .where("categoryId")
    .equals(categoryId)
    .filter((t) => t.name.toLowerCase() === trimmed.toLowerCase())
    .first();
  if (existing) return existing;
  const ts = nowIso();
  const topic: Topic = { id: newId(), name: trimmed, categoryId, createdAt: ts, updatedAt: ts };
  await db.topics.add(topic);
  return topic;
}

export async function createItem(input: {
  kind: ItemKind;
  title: string;
  body?: string;
  date?: string;
  time?: string;
  sourceEntryId?: string | null;
}): Promise<Item> {
  const ts = nowIso();
  const item: Item = {
    id: newId(),
    kind: input.kind,
    title: input.title,
    body: input.body ?? "",
    date: input.date ?? ts.slice(0, 10),
    time: input.time ?? "",
    done: false,
    sourceEntryId: input.sourceEntryId ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.items.add(item);
  return item;
}

export async function updateItem(
  id: string,
  changes: Partial<Pick<Item, "title" | "body" | "date" | "time" | "done">>,
): Promise<void> {
  await db.items.update(id, { ...changes, updatedAt: nowIso() });
}

export async function toggleItemDone(id: string, done: boolean): Promise<void> {
  await db.items.update(id, { done, updatedAt: nowIso() });
}

export async function deleteItem(id: string): Promise<void> {
  await db.items.delete(id);
}
