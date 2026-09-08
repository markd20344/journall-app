// Mirrors the local kitJobs cache to/from Firestore, at the same
// users/{uid}/kitJobs path this data has always lived at (Kit Runs used to
// be a page inside the journal app, sharing its Firestore sync — splitting
// into a separate app changes nothing server-side, just which frontend
// talks to that path). Dexie stays the source of truth for the UI; Firestore
// is a sync layer bolted on top using last-write-wins-by-`updatedAt`, with
// deletions written as tombstones (`{ id, deleted: true, updatedAt }`) so a
// full reconciliation can tell "not pushed yet" apart from "deleted
// elsewhere" — see the journal app's firebase/sync.ts for the fuller
// rationale, which this mirrors.
import { collection, doc, getDocs, onSnapshot, setDoc, writeBatch, type Unsubscribe } from "firebase/firestore";
import { db, normalizeKitJob } from "../db/db";
import { firestore } from "@journall/shared/firebase/config";
import { nowIso } from "@journall/shared/lib/id";
import type { KitJob } from "../types";

interface Syncable {
  id: string;
  updatedAt: string;
}

type RemoteDoc = Syncable & { deleted?: boolean };

let activeUid: string | null = null;
let unsubscribers: Unsubscribe[] = [];

export function isSyncActive(): boolean {
  return activeUid !== null;
}

function kitJobsCollection(uid: string) {
  return collection(firestore!, "users", uid, "kitJobs");
}

export interface SyncStatus {
  pending: number;
  lastError: string | null;
}

let pendingWrites = 0;
let lastSyncError: string | null = null;
let statusListeners: Array<(status: SyncStatus) => void> = [];

function currentStatus(): SyncStatus {
  return { pending: pendingWrites, lastError: lastSyncError };
}

function notifyStatus(): void {
  const status = currentStatus();
  statusListeners.forEach((l) => l(status));
}

export function subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
  statusListeners.push(listener);
  listener(currentStatus());
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
}

async function trackWrite(description: string, work: () => Promise<void>): Promise<void> {
  pendingWrites++;
  notifyStatus();
  try {
    await work();
    lastSyncError = null;
  } catch (err) {
    lastSyncError = err instanceof Error ? err.message : description;
    console.error(description, err);
  } finally {
    pendingWrites--;
    notifyStatus();
  }
}

/** Push one changed kitJob up to Firestore. Fire-and-forget; safe to call even when sync is inactive. */
export function pushRecord(table: "kitJobs", record: Syncable): void {
  if (!activeUid || !firestore) return;
  const uid = activeUid;
  const fs = firestore;
  void trackWrite(`Firestore push failed for ${table}/${record.id}`, async () => {
    const batch = writeBatch(fs);
    batch.set(doc(kitJobsCollection(uid), record.id), record as unknown as Record<string, unknown>);
    await batch.commit();
  });
}

/** Marks a kitJob deleted in Firestore via tombstone rather than removing the doc. */
export function deleteRecord(table: "kitJobs", id: string): void {
  if (!activeUid || !firestore) return;
  const uid = activeUid;
  const tombstone: RemoteDoc = { id, deleted: true, updatedAt: nowIso() };
  void trackWrite(`Firestore delete failed for ${table}/${id}`, async () => {
    await setDoc(doc(kitJobsCollection(uid), id), tombstone as unknown as Record<string, unknown>);
  });
}

/** Full reconciliation of local vs. remote state — safe to call anytime, not just at sign-in. */
async function fullMerge(uid: string): Promise<void> {
  if (!firestore) return;
  const localRecords = await db.kitJobs.toArray();
  const remoteSnap = await getDocs(kitJobsCollection(uid));
  const remoteById = new Map(remoteSnap.docs.map((d) => [d.id, d.data() as RemoteDoc]));
  const localById = new Map(localRecords.map((r) => [r.id, r]));

  const batch = writeBatch(firestore);
  let pending = 0;
  for (const local of localRecords) {
    const remote = remoteById.get(local.id);
    if (remote?.deleted && remote.updatedAt >= local.updatedAt) continue;
    if (!remote || local.updatedAt > remote.updatedAt) {
      batch.set(doc(kitJobsCollection(uid), local.id), local as unknown as Record<string, unknown>);
      pending++;
    }
  }
  if (pending > 0) await batch.commit();

  for (const [id, remote] of remoteById) {
    const local = localById.get(id);
    if (remote.deleted) {
      if (!local || remote.updatedAt >= local.updatedAt) await db.kitJobs.delete(id);
      continue;
    }
    if (!local || remote.updatedAt > local.updatedAt) {
      await db.kitJobs.put(normalizeKitJob(remote as unknown as KitJob));
    }
  }
}

function startListeners(uid: string): void {
  const unsub = onSnapshot(
    kitJobsCollection(uid),
    (snap) => {
      void (async () => {
        for (const change of snap.docChanges()) {
          if (change.type === "removed") {
            await db.kitJobs.delete(change.doc.id);
            continue;
          }
          const remote = change.doc.data() as RemoteDoc;
          const local = await db.kitJobs.get(remote.id);
          if (remote.deleted) {
            if (!local || remote.updatedAt >= local.updatedAt) await db.kitJobs.delete(remote.id);
            continue;
          }
          if (!local || remote.updatedAt >= local.updatedAt) {
            await db.kitJobs.put(normalizeKitJob(remote as unknown as KitJob));
          }
        }
      })();
    },
    (err) => console.error("Firestore listener error for kitJobs", err),
  );
  unsubscribers.push(unsub);
}

export async function startSync(uid: string): Promise<void> {
  if (activeUid === uid) return;
  stopSync();
  await fullMerge(uid);
  activeUid = uid;
  startListeners(uid);
}

/**
 * Forces an immediate full reconciliation instead of waiting for the
 * real-time listener — useful when a device was backgrounded (phones pause
 * JS for background tabs, so the listener can lag until reopened).
 */
export async function refreshNow(): Promise<void> {
  if (!activeUid) return;
  await fullMerge(activeUid);
}

export function stopSync(): void {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
  activeUid = null;
}
