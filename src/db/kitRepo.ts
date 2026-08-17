// Thin CRUD layer over Dexie for the kit-collection round, same shape as
// db/repo.ts: every write bumps `updatedAt` and mirrors the change to
// Firestore (a no-op when signed out).
import { db } from "./db";
import type { ContactAttempt, ContactOutcome, DoorVisit, DoorVisitOutcome, KitCollected, KitJob } from "../types/kit";
import type { DraftKitJob } from "../lib/kitEmailParser";
import { newId, nowIso } from "../lib/id";
import { deleteRecord, pushRecord } from "../firebase/sync";

async function persist(id: string): Promise<KitJob | undefined> {
  const updated = await db.kitJobs.get(id);
  if (updated) pushRecord("kitJobs", updated);
  return updated;
}

export async function createKitJob(input: {
  batchDate: string;
  jobNumber?: string;
  customerName: string;
  address: string;
  postcode: string;
  phoneNumbers?: string[];
  rawText?: string;
  notes?: string;
}): Promise<KitJob> {
  const ts = nowIso();
  const job: KitJob = {
    id: newId(),
    batchDate: input.batchDate,
    jobNumber: input.jobNumber ?? "",
    customerName: input.customerName,
    address: input.address,
    postcode: input.postcode,
    phoneNumbers: input.phoneNumbers ?? [],
    rawText: input.rawText ?? "",
    notes: input.notes ?? "",
    routeOrder: null,
    lat: null,
    lng: null,
    contactAttempts: [],
    visits: [],
    kitCollected: null,
    officeEmailedAt: null,
    droppedOffAt: null,
    droppedOffBatchId: null,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.kitJobs.add(job);
  pushRecord("kitJobs", job);
  return job;
}

/** Bulk-creates jobs parsed from a pasted email, all for the same visit day. */
export async function importKitJobs(drafts: DraftKitJob[], batchDate: string): Promise<KitJob[]> {
  const created = await Promise.all(
    drafts.map((d) =>
      createKitJob({
        batchDate,
        jobNumber: d.jobNumber,
        customerName: d.customerName,
        address: d.address,
        postcode: d.postcode,
        phoneNumbers: d.phoneNumbers,
        rawText: d.rawText,
      }),
    ),
  );
  return created;
}

export async function updateKitJob(
  id: string,
  changes: Partial<Pick<KitJob, "jobNumber" | "customerName" | "address" | "postcode" | "phoneNumbers" | "notes" | "batchDate">>,
): Promise<void> {
  await db.kitJobs.update(id, { ...changes, updatedAt: nowIso() });
  await persist(id);
}

export async function setJobGeo(id: string, lat: number | null, lng: number | null): Promise<void> {
  await db.kitJobs.update(id, { lat, lng, updatedAt: nowIso() });
  await persist(id);
}

export async function setRouteOrder(id: string, routeOrder: number | null): Promise<void> {
  await db.kitJobs.update(id, { routeOrder, updatedAt: nowIso() });
  await persist(id);
}

/** Applies a full ordering in one go — orderedIds[0] becomes routeOrder 1, and so on. */
export async function applyRouteOrder(orderedIds: string[]): Promise<void> {
  const ts = nowIso();
  await db.transaction("rw", db.kitJobs, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.kitJobs.update(orderedIds[i], { routeOrder: i + 1, updatedAt: ts });
    }
  });
  for (const id of orderedIds) await persist(id);
}

export async function addContactAttempt(
  jobId: string,
  input: { phoneNumber: string; outcome: ContactOutcome; note?: string },
): Promise<ContactAttempt | null> {
  const job = await db.kitJobs.get(jobId);
  if (!job) return null;
  const attempt: ContactAttempt = {
    id: newId(),
    phoneNumber: input.phoneNumber,
    outcome: input.outcome,
    note: input.note ?? "",
    createdAt: nowIso(),
  };
  await db.kitJobs.update(jobId, { contactAttempts: [...job.contactAttempts, attempt], updatedAt: nowIso() });
  await persist(jobId);
  return attempt;
}

export async function deleteContactAttempt(jobId: string, attemptId: string): Promise<void> {
  const job = await db.kitJobs.get(jobId);
  if (!job) return;
  await db.kitJobs.update(jobId, {
    contactAttempts: job.contactAttempts.filter((a) => a.id !== attemptId),
    updatedAt: nowIso(),
  });
  await persist(jobId);
}

export async function addDoorVisit(
  jobId: string,
  input: { outcome: DoorVisitOutcome; note?: string; photoDataUrl?: string | null },
): Promise<DoorVisit | null> {
  const job = await db.kitJobs.get(jobId);
  if (!job) return null;
  const visit: DoorVisit = {
    id: newId(),
    outcome: input.outcome,
    note: input.note ?? "",
    photoDataUrl: input.photoDataUrl ?? null,
    createdAt: nowIso(),
  };
  await db.kitJobs.update(jobId, { visits: [...job.visits, visit], updatedAt: nowIso() });
  await persist(jobId);
  return visit;
}

export async function deleteDoorVisit(jobId: string, visitId: string): Promise<void> {
  const job = await db.kitJobs.get(jobId);
  if (!job) return;
  await db.kitJobs.update(jobId, { visits: job.visits.filter((v) => v.id !== visitId), updatedAt: nowIso() });
  await persist(jobId);
}

export async function setKitCollected(jobId: string, kit: Omit<KitCollected, "loggedAt">): Promise<void> {
  await db.kitJobs.update(jobId, { kitCollected: { ...kit, loggedAt: nowIso() }, updatedAt: nowIso() });
  await persist(jobId);
}

export async function clearKitCollected(jobId: string): Promise<void> {
  await db.kitJobs.update(jobId, { kitCollected: null, updatedAt: nowIso() });
  await persist(jobId);
}

export async function setOfficeEmailed(jobId: string, emailed: boolean): Promise<void> {
  await db.kitJobs.update(jobId, { officeEmailedAt: emailed ? nowIso() : null, updatedAt: nowIso() });
  await persist(jobId);
}

/** Marks a batch of jobs dropped off at BCA Corby together, sharing one droppedOffBatchId. */
export async function markDroppedOff(jobIds: string[]): Promise<void> {
  const ts = nowIso();
  const batchId = newId();
  await db.transaction("rw", db.kitJobs, async () => {
    for (const id of jobIds) {
      await db.kitJobs.update(id, { droppedOffAt: ts, droppedOffBatchId: batchId, updatedAt: ts });
    }
  });
  for (const id of jobIds) await persist(id);
}

export async function unmarkDroppedOff(jobId: string): Promise<void> {
  await db.kitJobs.update(jobId, { droppedOffAt: null, droppedOffBatchId: null, updatedAt: nowIso() });
  await persist(jobId);
}

export async function deleteKitJob(id: string): Promise<void> {
  await db.kitJobs.delete(id);
  deleteRecord("kitJobs", id);
}
