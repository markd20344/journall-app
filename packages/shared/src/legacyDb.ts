// Kit Runs and Family Tree used to live inside the same app as the journal
// (one shared "journall-db" Dexie/IndexedDB database). Now that they're
// separate apps with their own dedicated databases, each one does a
// one-time copy of its own tables out of that old shared database the first
// time it loads on a given device/browser, then leaves the old copy alone
// (nothing here ever deletes from it) so there's no way this loses data.
//
// This mirrors journall-db's schema exactly as it stood at version 19 (the
// last version before the split) — just enough for Dexie to open the
// existing database and read rows out of it, not to run any migrations.
import Dexie, { type Table } from "dexie";

const LEGACY_DB_NAME = "journall-db";

class LegacyJournalDB extends Dexie {
  entries!: Table<unknown, string>;
  categories!: Table<unknown, string>;
  topics!: Table<unknown, string>;
  settings!: Table<{ key: string; value: unknown }, string>;
  items!: Table<unknown, string>;
  candles!: Table<unknown, [string, string]>;
  kitJobs!: Table<unknown, string>;
  books!: Table<unknown, string>;
  people!: Table<unknown, string>;
  relationships!: Table<unknown, string>;
  familyEvents!: Table<unknown, string>;
  familyMedia!: Table<unknown, string>;
  familyRecords!: Table<unknown, string>;
  familyMembers!: Table<unknown, string>;
  itemAttachments!: Table<unknown, string>;

  constructor() {
    super(LEGACY_DB_NAME);
    this.version(19).stores({
      entries: "id, date, categoryId, *topicIds, updatedAt",
      categories: "id, name",
      topics: "id, name, categoryId",
      settings: "key",
      items: "id, kind, date, sourceEntryId, status, categoryId, *linkedItemIds, code, updatedAt",
      kitJobs: "id, batchDate, postcode, routeOrder, droppedOffBatchId, updatedAt",
      candles: "[pair+date], pair, date",
      books: "id, title, author, series, status, format, updatedAt",
      people: "id, lastName, updatedAt",
      relationships: "id, type, personA, personB, updatedAt",
      familyEvents: "id, personId, type, updatedAt",
      familyMedia: "id, updatedAt",
      familyRecords: "id, updatedAt",
      familyMembers: "uid, email, updatedAt",
      itemAttachments: "id, itemId, updatedAt",
    });
  }
}

/**
 * Opens the old shared database read-only-in-spirit (nothing here writes to
 * it) if it exists on this device, or returns null for a fresh install with
 * nothing to migrate. Caller is responsible for closing it when done.
 */
export async function openLegacyDbIfExists(): Promise<LegacyJournalDB | null> {
  const exists = await Dexie.exists(LEGACY_DB_NAME);
  if (!exists) return null;
  const legacyDb = new LegacyJournalDB();
  await legacyDb.open();
  return legacyDb;
}
