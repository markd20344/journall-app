import Dexie, { type Table } from "dexie";
import type { Category, Entry, Item, ItemKind, Topic } from "../types";
import type { Candle } from "../types/markets";
import type { KitJob } from "../types/kit";
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
  candles!: Table<Candle, [string, string]>;
  kitJobs!: Table<KitJob, string>;

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
    // v5: add a dated status-update log per item, plus a closure note and
    // an auto-populated closedAt timestamp.
    this.version(5)
      .stores({
        entries: "id, date, categoryId, *topicIds, updatedAt",
        categories: "id, name",
        topics: "id, name, categoryId",
        settings: "key",
        items: "id, kind, date, sourceEntryId, status, *linkedItemIds, code, updatedAt",
      })
      .upgrade(async (tx) => {
        const items = (await tx.table("items").toArray()) as Item[];
        for (const item of items) {
          item.statusUpdates = item.statusUpdates ?? [];
          item.closureNote = item.closureNote ?? "";
          // Backfill a closedAt for anything already closed before this
          // version existed, using its last-updated time as a reasonable
          // approximation of when it was closed.
          item.closedAt = item.status === "closed" ? (item.closedAt ?? item.updatedAt) : null;
        }
        await tx.table("items").bulkPut(items);
      });
    // v6: add priority (Actions/Decisions/Stories), probability+impact
    // (Risks), and project (Stories) — plus the "story" kind itself.
    this.version(6)
      .stores({
        entries: "id, date, categoryId, *topicIds, updatedAt",
        categories: "id, name",
        topics: "id, name, categoryId",
        settings: "key",
        items: "id, kind, date, sourceEntryId, status, *linkedItemIds, code, updatedAt",
      })
      .upgrade(async (tx) => {
        const items = (await tx.table("items").toArray()) as Item[];
        for (const item of items) {
          item.priority = item.priority ?? null;
          item.probability = item.probability ?? null;
          item.impact = item.impact ?? null;
          item.project = item.project ?? null;
        }
        await tx.table("items").bulkPut(items);
      });
    // v7: add agency + source (Job Applications) — plus the "application" kind.
    this.version(7)
      .stores({
        entries: "id, date, categoryId, *topicIds, updatedAt",
        categories: "id, name",
        topics: "id, name, categoryId",
        settings: "key",
        items: "id, kind, date, sourceEntryId, status, *linkedItemIds, code, updatedAt",
      })
      .upgrade(async (tx) => {
        const items = (await tx.table("items").toArray()) as Item[];
        for (const item of items) {
          item.agency = item.agency ?? null;
          item.source = item.source ?? null;
        }
        await tx.table("items").bulkPut(items);
      });
    // v8: add categoryId (Tasks — reuses the same Category table journal
    // entries use, rather than a separate tagging system).
    this.version(8)
      .stores({
        entries: "id, date, categoryId, *topicIds, updatedAt",
        categories: "id, name",
        topics: "id, name, categoryId",
        settings: "key",
        items: "id, kind, date, sourceEntryId, status, categoryId, *linkedItemIds, code, updatedAt",
      })
      .upgrade(async (tx) => {
        const items = (await tx.table("items").toArray()) as Item[];
        for (const item of items) {
          item.categoryId = item.categoryId ?? null;
        }
        await tx.table("items").bulkPut(items);
      });
    // v9: add subtasks (Tasks) — a lightweight checklist for a ballpark %
    // complete, not full Items of their own.
    this.version(9)
      .stores({
        entries: "id, date, categoryId, *topicIds, updatedAt",
        categories: "id, name",
        topics: "id, name, categoryId",
        settings: "key",
        items: "id, kind, date, sourceEntryId, status, categoryId, *linkedItemIds, code, updatedAt",
      })
      .upgrade(async (tx) => {
        const items = (await tx.table("items").toArray()) as Item[];
        for (const item of items) {
          item.subtasks = item.subtasks ?? [];
        }
        await tx.table("items").bulkPut(items);
      });
    // v10: add kitJobs — the kit-collection round tracker (jobs parsed from
    // the daily company email, route order, contact/visit logs, kit
    // collected, and office-email/drop-off tracking).
    this.version(10).stores({
      entries: "id, date, categoryId, *topicIds, updatedAt",
      categories: "id, name",
      topics: "id, name, categoryId",
      settings: "key",
      items: "id, kind, date, sourceEntryId, status, categoryId, *linkedItemIds, code, updatedAt",
      kitJobs: "id, batchDate, postcode, routeOrder, droppedOffBatchId, updatedAt",
    });
    // v11: Markets dashboard — cached daily FX candles, keyed by pair+date
    // so a re-fetched day just overwrites in place (bulkPut, no dupes).
    this.version(11).stores({
      entries: "id, date, categoryId, *topicIds, updatedAt",
      categories: "id, name",
      topics: "id, name, categoryId",
      settings: "key",
      items: "id, kind, date, sourceEntryId, status, categoryId, *linkedItemIds, code, updatedAt",
      kitJobs: "id, batchDate, postcode, routeOrder, droppedOffBatchId, updatedAt",
      candles: "[pair+date], pair, date",
    });
  }
}

export const db = new JournalDB();

// Backfills every field the Item schema has grown over time with the same
// defaults the version migrations above use. Records created through
// repo.ts's createItem() always have every field already, but records that
// arrive from *outside* that path — a Firestore sync pull, or a JSON import
// of an older export — go straight into Dexie via `.put()` and skip the
// migrations entirely (those only run once, against whatever was already in
// this browser's IndexedDB, at schema-version-bump time). Without this, an
// old record missing a newer field (e.g. `subtasks`) crashes any component
// that assumes the field is always present.
export function normalizeItem(raw: Item): Item {
  return {
    ...raw,
    statusUpdates: raw.statusUpdates ?? [],
    closedAt: raw.closedAt ?? null,
    closureNote: raw.closureNote ?? "",
    priority: raw.priority ?? null,
    probability: raw.probability ?? null,
    impact: raw.impact ?? null,
    project: raw.project ?? null,
    agency: raw.agency ?? null,
    source: raw.source ?? null,
    categoryId: raw.categoryId ?? null,
    subtasks: raw.subtasks ?? [],
  };
}

// Same purpose as normalizeItem above, for kitJobs: backfills fields the
// shape has grown since a record was first written, for anything arriving
// via a Firestore pull or JSON import rather than through kitRepo.ts.
export function normalizeKitJob(raw: KitJob): KitJob {
  return {
    ...raw,
    jobNumber: raw.jobNumber ?? "",
    phoneNumbers: raw.phoneNumbers ?? [],
    rawText: raw.rawText ?? "",
    notes: raw.notes ?? "",
    routeOrder: raw.routeOrder ?? null,
    lat: raw.lat ?? null,
    lng: raw.lng ?? null,
    contactAttempts: raw.contactAttempts ?? [],
    visits: raw.visits ?? [],
    kitCollected: raw.kitCollected ?? null,
    officeEmailedAt: raw.officeEmailedAt ?? null,
    droppedOffAt: raw.droppedOffAt ?? null,
    droppedOffBatchId: raw.droppedOffBatchId ?? null,
  };
}

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
