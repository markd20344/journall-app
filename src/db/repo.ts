// Thin CRUD layer over Dexie. Every write also bumps `updatedAt` so the
// file-sync and Firestore sync layers can do simple last-write-wins conflict
// resolution, and mirrors the change to Firestore (a no-op when signed out).
import { db } from "./db";
import type { Category, Entry, Item, ItemKind, ItemStatus, StatusUpdate, Topic } from "../types";
import { newId, nowIso } from "../lib/id";
import { itemKindMeta } from "../lib/itemKinds";
import { deleteRecord, pushRecord } from "../firebase/sync";

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
  pushRecord("entries", entry);
  return entry;
}

export async function updateEntry(
  id: string,
  changes: Partial<Pick<Entry, "date" | "categoryId" | "topicIds" | "body">>,
): Promise<void> {
  await db.entries.update(id, { ...changes, updatedAt: nowIso() });
  const updated = await db.entries.get(id);
  if (updated) pushRecord("entries", updated);
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
  deleteRecord("entries", id);
}

export async function upsertCategory(name: string, color: string): Promise<Category> {
  const existing = await db.categories.where("name").equalsIgnoreCase(name).first();
  if (existing) return existing;
  const ts = nowIso();
  const category: Category = { id: newId(), name, color, createdAt: ts, updatedAt: ts };
  await db.categories.add(category);
  pushRecord("categories", category);
  return category;
}

export async function deleteCategory(id: string): Promise<void> {
  // Keep entries/topics around (orphaned category ref) rather than cascading
  // deletes silently — journaling data should never disappear unexpectedly.
  await db.categories.delete(id);
  deleteRecord("categories", id);
}

export async function renameCategory(id: string, name: string, color: string): Promise<void> {
  await db.categories.update(id, { name, color, updatedAt: nowIso() });
  const updated = await db.categories.get(id);
  if (updated) pushRecord("categories", updated);
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
  pushRecord("topics", topic);
  return topic;
}

/**
 * Derives the next code from the highest one already in use for this kind,
 * rather than a stored per-device counter — the `settings` table isn't
 * synced to Firestore (it also holds things like the folder-sync directory
 * handle, which isn't serializable), so a stored counter would silently
 * diverge across devices and hand out the same code twice.
 */
async function nextCode(kind: ItemKind): Promise<string> {
  const prefix = itemKindMeta(kind).codePrefix;
  const items = await db.items.where("kind").equals(kind).toArray();
  let max = 0;
  for (const item of items) {
    const match = /(\d+)$/.exec(item.code);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/**
 * Renumbers items that ended up sharing a code — the result of two devices
 * each generating their own codes before ever syncing (see `nextCode`
 * above; this repairs codes issued before that fix). Keeps the oldest of
 * each duplicate pair's code as-is and reassigns the newer one(s). Codes
 * are just a display label, not a reference, so this is safe to do without
 * touching any linked-item relationships.
 */
export async function dedupeItemCodes(): Promise<void> {
  const items = await db.items.toArray();
  const byKindCode = new Map<string, Item[]>();
  for (const item of items) {
    const key = `${item.kind}::${item.code}`;
    byKindCode.set(key, [...(byKindCode.get(key) ?? []), item]);
  }
  for (const group of byKindCode.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const [, ...dupes] = group;
    for (const dupe of dupes) {
      const newCode = await nextCode(dupe.kind);
      await db.items.update(dupe.id, { code: newCode, updatedAt: nowIso() });
      const updated = await db.items.get(dupe.id);
      if (updated) pushRecord("items", updated);
    }
  }
}

/**
 * Collapses the double spaces that the pre-fix dictation join used to leave
 * behind in already-saved entries/items, and trims stray whitespace. Only
 * touches runs of spaces/tabs, never newlines, so intentional paragraph
 * breaks are left alone. Runs once per device (flagged in `settings`).
 */
export async function cleanupDictationArtifacts(): Promise<void> {
  const flagKey = "textCleanedV1";
  if (await db.settings.get(flagKey)) return;

  const collapse = (text: string) => text.replace(/[ \t]{2,}/g, " ").trim();

  for (const entry of await db.entries.toArray()) {
    const cleaned = collapse(entry.body);
    if (cleaned !== entry.body) {
      await db.entries.update(entry.id, { body: cleaned, updatedAt: nowIso() });
      const updated = await db.entries.get(entry.id);
      if (updated) pushRecord("entries", updated);
    }
  }

  for (const item of await db.items.toArray()) {
    const cleanedTitle = collapse(item.title);
    const cleanedBody = collapse(item.body);
    if (cleanedTitle !== item.title || cleanedBody !== item.body) {
      await db.items.update(item.id, { title: cleanedTitle, body: cleanedBody, updatedAt: nowIso() });
      const updated = await db.items.get(item.id);
      if (updated) pushRecord("items", updated);
    }
  }

  await db.settings.put({ key: flagKey, value: true });
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
    statusUpdates: [],
    closedAt: null,
    closureNote: "",
    linkedItemIds: [],
    sourceEntryId: input.sourceEntryId ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.items.add(item);
  pushRecord("items", item);
  return item;
}

export async function updateItem(
  id: string,
  changes: Partial<Pick<Item, "title" | "body" | "date" | "time" | "status" | "closureNote">>,
): Promise<void> {
  const ts = nowIso();
  const finalChanges: Partial<Item> = { ...changes, updatedAt: ts };
  if (changes.status !== undefined) {
    const current = await db.items.get(id);
    if (changes.status === "closed" && current?.status !== "closed") {
      finalChanges.closedAt = ts;
    } else if (changes.status !== "closed" && current?.status === "closed") {
      finalChanges.closedAt = null;
    }
  }
  await db.items.update(id, finalChanges);
  const updated = await db.items.get(id);
  if (updated) pushRecord("items", updated);
}

export async function setItemStatus(id: string, status: ItemStatus): Promise<void> {
  await updateItem(id, { status });
}

export async function addStatusUpdate(itemId: string, note: string): Promise<void> {
  const trimmed = note.trim();
  if (!trimmed) return;
  const item = await db.items.get(itemId);
  if (!item) return;
  const update: StatusUpdate = { id: newId(), note: trimmed, createdAt: nowIso() };
  await db.items.update(itemId, { statusUpdates: [...item.statusUpdates, update], updatedAt: nowIso() });
  const updated = await db.items.get(itemId);
  if (updated) pushRecord("items", updated);
}

export async function deleteStatusUpdate(itemId: string, updateId: string): Promise<void> {
  const item = await db.items.get(itemId);
  if (!item) return;
  await db.items.update(itemId, {
    statusUpdates: item.statusUpdates.filter((u) => u.id !== updateId),
    updatedAt: nowIso(),
  });
  const updated = await db.items.get(itemId);
  if (updated) pushRecord("items", updated);
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
  const [updatedA, updatedB] = await Promise.all([db.items.get(aId), db.items.get(bId)]);
  if (updatedA) pushRecord("items", updatedA);
  if (updatedB) pushRecord("items", updatedB);
}

export async function unlinkItems(aId: string, bId: string): Promise<void> {
  await db.transaction("rw", db.items, async () => {
    const [a, b] = await Promise.all([db.items.get(aId), db.items.get(bId)]);
    const ts = nowIso();
    if (a) await db.items.update(aId, { linkedItemIds: a.linkedItemIds.filter((id) => id !== bId), updatedAt: ts });
    if (b) await db.items.update(bId, { linkedItemIds: b.linkedItemIds.filter((id) => id !== aId), updatedAt: ts });
  });
  const [updatedA, updatedB] = await Promise.all([db.items.get(aId), db.items.get(bId)]);
  if (updatedA) pushRecord("items", updatedA);
  if (updatedB) pushRecord("items", updatedB);
}

/**
 * Merges categories (and, within them, topics) that share a name but have
 * different ids — the result of two devices each auto-seeding their own
 * "first run" defaults before ever syncing. Keeps the oldest of each
 * duplicate set, re-points any entries/topics referencing the others onto
 * it, then removes the duplicates. Safe to call anytime; a no-op if there's
 * nothing to merge.
 */
export async function dedupeCategoriesAndTopics(): Promise<void> {
  const categories = await db.categories.toArray();
  const categoryGroups = new Map<string, Category[]>();
  for (const c of categories) {
    const key = c.name.trim().toLowerCase();
    categoryGroups.set(key, [...(categoryGroups.get(key) ?? []), c]);
  }

  for (const group of categoryGroups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const [canonical, ...dupes] = group;
    for (const dupe of dupes) {
      const entries = await db.entries.where("categoryId").equals(dupe.id).toArray();
      for (const entry of entries) {
        await db.entries.update(entry.id, { categoryId: canonical.id, updatedAt: nowIso() });
        const updated = await db.entries.get(entry.id);
        if (updated) pushRecord("entries", updated);
      }
      const topics = await db.topics.where("categoryId").equals(dupe.id).toArray();
      for (const topic of topics) {
        await db.topics.update(topic.id, { categoryId: canonical.id, updatedAt: nowIso() });
        const updated = await db.topics.get(topic.id);
        if (updated) pushRecord("topics", updated);
      }
      await db.categories.delete(dupe.id);
      deleteRecord("categories", dupe.id);
    }
  }

  const topics = await db.topics.toArray();
  const topicGroups = new Map<string, Topic[]>();
  for (const t of topics) {
    const key = `${t.categoryId}::${t.name.trim().toLowerCase()}`;
    topicGroups.set(key, [...(topicGroups.get(key) ?? []), t]);
  }

  for (const group of topicGroups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const [canonical, ...dupes] = group;
    const dupeIds = new Set(dupes.map((d) => d.id));
    const entries = await db.entries.toArray();
    for (const entry of entries) {
      if (!entry.topicIds.some((id) => dupeIds.has(id))) continue;
      const newTopicIds = Array.from(new Set(entry.topicIds.map((id) => (dupeIds.has(id) ? canonical.id : id))));
      await db.entries.update(entry.id, { topicIds: newTopicIds, updatedAt: nowIso() });
      const updated = await db.entries.get(entry.id);
      if (updated) pushRecord("entries", updated);
    }
    for (const dupe of dupes) {
      await db.topics.delete(dupe.id);
      deleteRecord("topics", dupe.id);
    }
  }
}

export async function deleteItem(id: string): Promise<void> {
  let linkerIds: string[] = [];
  await db.transaction("rw", db.items, async () => {
    const linkers = await db.items.where("linkedItemIds").equals(id).toArray();
    linkerIds = linkers.map((l) => l.id);
    const ts = nowIso();
    for (const linker of linkers) {
      await db.items.update(linker.id, { linkedItemIds: linker.linkedItemIds.filter((lid) => lid !== id), updatedAt: ts });
    }
    await db.items.delete(id);
  });
  deleteRecord("items", id);
  for (const linkerId of linkerIds) {
    const updated = await db.items.get(linkerId);
    if (updated) pushRecord("items", updated);
  }
}
