// One-time copy of the family-tree tables out of the old shared
// "journall-db" (from back when Family Tree was a page inside the journal
// app) into this app's own dedicated database. Runs once per device/
// browser; the old database is left untouched, so this can never lose data
// even if something here goes wrong.
import { openLegacyDbIfExists } from "@journall/shared/legacyDb";
import { db } from "./db";
import type { FamilyEvent, FamilyMedia, FamilyMember, FamilyRecord, Person, Relationship } from "../types";

const MIGRATED_FLAG_KEY = "migratedFromLegacyJournallDb";

export async function migrateFromLegacyDbIfNeeded(): Promise<void> {
  const alreadyMigrated = await db.settings.get(MIGRATED_FLAG_KEY);
  if (alreadyMigrated) return;

  const legacyDb = await openLegacyDbIfExists();
  if (!legacyDb) {
    await db.settings.put({ key: MIGRATED_FLAG_KEY, value: true });
    return;
  }

  try {
    const [people, relationships, familyEvents, familyMedia, familyRecords, familyMembers] = await Promise.all([
      legacyDb.people.toArray() as Promise<Person[]>,
      legacyDb.relationships.toArray() as Promise<Relationship[]>,
      legacyDb.familyEvents.toArray() as Promise<FamilyEvent[]>,
      legacyDb.familyMedia.toArray() as Promise<FamilyMedia[]>,
      legacyDb.familyRecords.toArray() as Promise<FamilyRecord[]>,
      legacyDb.familyMembers.toArray() as Promise<FamilyMember[]>,
    ]);
    let migrated = 0;
    if (people.length > 0) {
      await db.people.bulkPut(people);
      migrated += people.length;
    }
    if (relationships.length > 0) await db.relationships.bulkPut(relationships);
    if (familyEvents.length > 0) await db.familyEvents.bulkPut(familyEvents);
    if (familyMedia.length > 0) await db.familyMedia.bulkPut(familyMedia);
    if (familyRecords.length > 0) await db.familyRecords.bulkPut(familyRecords);
    if (familyMembers.length > 0) await db.familyMembers.bulkPut(familyMembers);
    if (migrated > 0) console.info(`Family Tree: migrated ${migrated} people (and related records) from the old shared database.`);
  } finally {
    legacyDb.close();
  }

  await db.settings.put({ key: MIGRATED_FLAG_KEY, value: true });
}
