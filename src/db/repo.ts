// Thin CRUD layer over Dexie. Every write also bumps `updatedAt` so the
// file-sync layer can do simple last-write-wins conflict resolution.
import { db } from "./db";
import type { Category, Entry, Item, ItemKind, ItemStatus, Topic } from "../types";
import { newId, nowIso } from "../lib/id";
import { itemKindMeta } from "../lib/itemKinds";

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

async function nextCode(kind: ItemKind): Promise<string> {
  const prefix = itemKindMeta(kind).codePrefix;
  return db.transaction("rw", db.settings, async () => {
    const key = `codeCounter:${kind}`;
    const record = await db.settings.get(key);
    const next = ((record?.value as number | undefined) ?? 0) + 1;
    await db.settings.put({ key, value: next });
    return `${prefix}${String(next).padStart(3, "0")}`;
  });
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
  const meta = itemKindMeta(input.kind);
  const item: Item = {
    id: newId(),
    kind: input.kind,
    code: await nextCode(input.kind),
    title: input.title,
    body: input.body ?? "",
    date: input.date ?? ts.slice(0, 10),
    time: input.time ?? "",
    status: meta.statuses.length > 0 ? "open" : null,
    linkedItemIds: [],
    sourceEntryId: input.sourceEntryId ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.items.add(item);
  return item;
}

export async function updateItem(
  id: string,
  changes: Partial<Pick<Item, "title" | "body" | "date" | "time" | "status">>,
): Promise<void> {
  await db.items.update(id, { ...changes, updatedAt: nowIso() });
}

export async function setItemStatus(id: string, status: ItemStatus): Promise<void> {
  await db.items.update(id, { status, updatedAt: nowIso() });
}

/** Links two items to each other. Always bidirectional — both sides show the connection. */
export async function linkItems(aId: string, bId: string): Promise<void> {
  if (aId === bId) return;
  await db.transaction("rw", db.items, async () => {
    const [a, b] = await Promise.all([db.items.get(aId), db.items.get(bId)]);
    if (!a || !b) return;
    const ts = nowIso();
    if (!a.linkedItemIds.includes(bId)) {
      await db.items.update(aId, { linkedItemIds: [...a.linkedItemIds, bId], updatedAt: ts });
    }
    if (!b.linkedItemIds.includes(aId)) {
      await db.items.update(bId, { linkedItemIds: [...b.linkedItemIds, aId], updatedAt: ts });
    }
  });
}

export async function unlinkItems(aId: string, bId: string): Promise<void> {
  await db.transaction("rw", db.items, async () => {
    const [a, b] = await Promise.all([db.items.get(aId), db.items.get(bId)]);
    const ts = nowIso();
    if (a) await db.items.update(aId, { linkedItemIds: a.linkedItemIds.filter((id) => id !== bId), updatedAt: ts });
    if (b) await db.items.update(bId, { linkedItemIds: b.linkedItemIds.filter((id) => id !== aId), updatedAt: ts });
  });
}

export async function deleteItem(id: string): Promise<void> {
  await db.transaction("rw", db.items, async () => {
    const linkers = await db.items.where("linkedItemIds").equals(id).toArray();
    const ts = nowIso();
    for (const linker of linkers) {
      await db.items.update(linker.id, { linkedItemIds: linker.linkedItemIds.filter((lid) => lid !== id), updatedAt: ts });
    }
    await db.items.delete(id);
  });
}
