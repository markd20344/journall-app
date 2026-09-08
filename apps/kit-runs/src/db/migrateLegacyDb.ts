// One-time copy of kitJobs out of the old shared "journall-db" (from back
// when Kit Runs was a page inside the journal app) into this app's own
// dedicated database. Runs once per device/browser; the old database is
// left untouched, so this can never lose data even if something here goes
// wrong.
import { openLegacyDbIfExists } from "@journall/shared/legacyDb";
import { db, normalizeKitJob } from "./db";
import type { KitJob } from "../types";

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
    const legacyJobs = (await legacyDb.kitJobs.toArray()) as KitJob[];
    if (legacyJobs.length > 0) {
      await db.kitJobs.bulkPut(legacyJobs.map(normalizeKitJob));
      console.info(`Kit Runs: migrated ${legacyJobs.length} job(s) from the old shared database.`);
    }
  } finally {
    legacyDb.close();
  }

  await db.settings.put({ key: MIGRATED_FLAG_KEY, value: true });
}
