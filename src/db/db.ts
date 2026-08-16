import Dexie, { type Table } from "dexie";
import type { Category, Entry, Topic } from "../types";
import { newId, nowIso } from "../lib/id";

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

  constructor() {
    super("journall-db");
    this.version(1).stores({
      // Primary key + indexes we actually query by.
      entries: "id, date, categoryId, *topicIds, updatedAt",
      categories: "id, name",
      topics: "id, name, categoryId",
      settings: "key",
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
