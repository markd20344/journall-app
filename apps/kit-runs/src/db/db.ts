import Dexie, { type Table } from "dexie";
import type { KitJob } from "../types";

export interface SettingRecord {
  key: string;
  value: unknown;
}

class KitRunsDB extends Dexie {
  kitJobs!: Table<KitJob, string>;
  settings!: Table<SettingRecord, string>;

  constructor() {
    super("kit-runs-db");
    this.version(1).stores({
      kitJobs: "id, batchDate, postcode, routeOrder, droppedOffBatchId, updatedAt",
      settings: "key",
    });
  }
}

export const db = new KitRunsDB();

// Backfills fields the KitJob shape has grown since a record was first
// written, for anything arriving via a Firestore pull, JSON import, or the
// one-time legacy-database migration rather than through kitRepo.ts.
export function normalizeKitJob(raw: KitJob): KitJob {
  return {
    ...raw,
    jobNumber: raw.jobNumber ?? "",
    phoneNumbers: raw.phoneNumbers ?? [],
    rawText: raw.rawText ?? "",
    notes: raw.notes ?? "",
    dropOffLocation: raw.dropOffLocation ?? "",
    routeOrder: raw.routeOrder ?? null,
    lat: raw.lat ?? null,
    lng: raw.lng ?? null,
    textedAt: raw.textedAt ?? null,
    respondedAt: raw.respondedAt ?? null,
    responseNote: raw.responseNote ?? "",
    numberInvalid: raw.numberInvalid ?? false,
    noVisitNeeded: raw.noVisitNeeded ?? false,
    noVisitReason: raw.noVisitReason ?? "",
    needsReschedule: raw.needsReschedule ?? false,
    contactAttempts: raw.contactAttempts ?? [],
    visits: raw.visits ?? [],
    kitCollected: raw.kitCollected ?? null,
    officeEmailedAt: raw.officeEmailedAt ?? null,
    droppedOffAt: raw.droppedOffAt ?? null,
    droppedOffBatchId: raw.droppedOffBatchId ?? null,
  };
}
