import Dexie, { type Table } from "dexie";
import type { Category, Entry, Item, ItemKind, Topic } from "../types";
import { newId, nowIso } from "../lib/id";
import { itemKindMeta } from "../lib/itemKinds";

const DEFAULT_CATEGORIES: Array<Pick<Category, "name" | "color">> = [
  { name: "General", color: "#6b7280" },
  { name: "Work", color: "#2563eb" },
  { name: "Health", color: "#16a34a" },
  { name: "Trading", color: "#d97706" },
];

export interface SettingRecord {
  key: string;
  value: unknown;
}

class JournalDB extends Dexie {
  entries!: Table<Entry, string>;
  categories!: Table<Category, string>;
  topics!: Table<Topic, string>;
  settings!: Table<SettingRecord, string>;
  items!: Table<Item, string>;

  constructor() {
    super("journall-db");
    this.version(1).stores({
      // Primary key + indexes we actually query by.
      entries: "id, date, categoryId, *topicIds, updatedAt",
      categories: "id, name",
      topics: "id, name, categoryId",
      settings: "key",
    });
    this.version(2).stores({
      entries: "id, date, categoryId, *topicIds, updatedAt",
      categories: "id, name",
      topics: "id, name, categoryId",
      settings: "key",
      items: "id, kind, date, sourceEntryId, done, updatedAt",
    });
    // v3: replace the boolean `done` field with a proper per-kind status
    // lifecycle (open/on_hold/blocked/closed), add auto-assigned sequential
    // codes (R001, D001, ...) and a dependsOnItemId link for Actions/Risks.
    this.version(3)
      .stores({
        entries: "id, date, categoryId, *topicIds, updatedAt",
        categories: "id, name",
        topics: "id, name, categoryId",
        settings: "key",
        items: "id, kind, date, sourceEntryId, status, dependsOnItemId, code, updatedAt",
      })
      .upgrade(async (tx) => {
        type V2Item = Item & { done?: boolean; dependsOnItemId?: string | null };
        const items = (await tx.table("items").toArray()) as V2Item[];
        const byKind = new Map<ItemKind, V2Item[]>();
        for (const item of items) {
          if (!byKind.has(item.kind)) byKind.set(item.kind, []);
          byKind.get(item.kind)!.push(item);
        }
        for (const [kind, list] of byKind) {
          list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          const meta = itemKindMeta(kind);
          list.forEach((item, idx) => {
            item.code = `${meta.codePrefix}${String(idx + 1).padStart(3, "0")}`;
            item.dependsOnItemId = item.dependsOnItemId ?? null;
            item.status = meta.statuses.length === 0 ? null : item.done ? "closed" : "open";
            delete item.done;
          });
          await tx.table("settings").put({ key: `codeCounter:${kind}`, value: list.length });
        }
        await tx.table("items").bulkPut(items);
      });
    // v4: replace the single, kind-restricted dependsOnItemId with a
    // general, bidirectional linkedItemIds array available on every kind.
    this.version(4)
      .stores({
        entries: "id, date, categoryId, *topicIds, updatedAt",
        categories: "id, name",
        topics: "id, name, categoryId",
        settings: "key",
        items: "id, kind, date, sourceEntryId, status, *linkedItemIds, code, updatedAt",
      })
      .upgrade(async (tx) => {
        const items = (await tx.table("items").toArray()) as Array<Item & { dependsOnItemId?: string | null }>;
        const byId = new Map(items.map((i) => [i.id, i]));
        for (const item of items) {
          const linked = new Set(item.linkedItemIds ?? []);
          if (item.dependsOnItemId) {
            linked.add(item.dependsOnItemId);
            const other = byId.get(item.dependsOnItemId);
            if (other) {
              other.linkedItemIds = Array.from(new Set([...(other.linkedItemIds ?? []), item.id]));
            }
          }
          item.linkedItemIds = Array.from(linked);
          delete item.dependsOnItemId;
        }
        await tx.table("items").bulkPut(items);
      });
  }
}

export const db = new JournalDB();

// Seed a small default category list on first run so the app isn't empty.
// Runs inside a transaction with a "seeded" flag so concurrent calls (e.g.
// React StrictMode double-invoking effects, or two tabs opening at once)
// can't race and insert duplicate categories.
export async function ensureSeeded(): Promise<void> {
  await db.transaction("rw", db.categories, db.settings, async () => {
    const flag = await db.settings.get("seeded");
    if (flag) return;
    const ts = nowIso();
    await db.categories.bulkAdd(
      DEFAULT_CATEGORIES.map((c) => ({
        id: newId(),
        name: c.name,
        color: c.color,
        createdAt: ts,
        updatedAt: ts,
      })),
    );
    await db.settings.put({ key: "seeded", value: true });
  });
}
