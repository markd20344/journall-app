// Syncs the *shared* family tree (trees/{FAMILY_TREE_ID}/...) to the local
// Dexie cache. Distinct from firebase/sync.ts, which syncs this account's
// own private journal data under users/{uid}/... — the family tree is a
// single shared document tree everyone with access reads from and (for
// contributors/owners) writes to, so there's no per-user scoping here.
// Firestore security rules (see firestore.rules) are the real enforcement
// of who can write what; this layer just reflects whatever the server
// accepts or rejects.
import { collection, doc, getDocs, onSnapshot, setDoc, writeBatch, type Unsubscribe } from "firebase/firestore";
import { db } from "../db/db";
import { firestore } from "./config";
import { FAMILY_TREE_ID } from "../family/config";
import { nowIso } from "../lib/id";
import type { FamilyMember } from "../types/family";

const FAMILY_TABLES = ["people", "relationships", "familyEvents", "familyMedia", "familyRecords"] as const;
export type FamilyTable = (typeof FAMILY_TABLES)[number];

// Dexie table name -> Firestore subcollection name. Local tables are
// prefixed with "family" only to avoid clashing with this app's own
// generically-named `items` table; the Firestore side stays plain.
const FIRESTORE_COLLECTION: Record<FamilyTable, string> = {
  people: "people",
  relationships: "relationships",
  familyEvents: "events",
  familyMedia: "media",
  familyRecords: "records",
};

interface Syncable {
  id: string;
  updatedAt: string;
}
type RemoteDoc = Syncable & { deleted?: boolean };

let activeUid: string | null = null;
let unsubscribers: Unsubscribe[] = [];

export function isFamilySyncActive(): boolean {
  return activeUid !== null;
}

function treeCollection(name: string) {
  return collection(firestore!, "trees", FAMILY_TREE_ID, name);
}

export interface FamilySyncStatus {
  pending: number;
  lastError: string | null;
}

let pendingWrites = 0;
let lastSyncError: string | null = null;
let statusListeners: Array<(status: FamilySyncStatus) => void> = [];

function currentStatus(): FamilySyncStatus {
  return { pending: pendingWrites, lastError: lastSyncError };
}

function notifyStatus(): void {
  const status = currentStatus();
  statusListeners.forEach((l) => l(status));
}

export function subscribeFamilySyncStatus(listener: (status: FamilySyncStatus) => void): () => void {
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

/** Push one changed record up to Firestore. Fire-and-forget; safe to call even when sync is inactive. */
export function pushFamilyRecord(table: FamilyTable, record: Syncable): void {
  if (!activeUid || !firestore) return;
  void trackWrite(`Family sync push failed for ${table}/${record.id}`, async () => {
    await setDoc(doc(treeCollection(FIRESTORE_COLLECTION[table]), record.id), record as unknown as Record<string, unknown>);
  });
}

/** Marks a record deleted via tombstone rather than removing the doc outright — see firebase/sync.ts for why. */
export function deleteFamilyRecord(table: FamilyTable, id: string): void {
  if (!activeUid || !firestore) return;
  const tombstone: RemoteDoc = { id, deleted: true, updatedAt: nowIso() };
  void trackWrite(`Family sync delete failed for ${table}/${id}`, async () => {
    await setDoc(doc(treeCollection(FIRESTORE_COLLECTION[table]), id), tombstone as unknown as Record<string, unknown>);
  });
}

/** Bulk-pushes many records at once (GEDCOM import), chunked under Firestore's 500-writes-per-batch limit. */
export async function bulkPushFamilyRecords(table: FamilyTable, records: Syncable[]): Promise<void> {
  if (!firestore || records.length === 0) return;
  const fs = firestore;
  const CHUNK = 450;
  for (let i = 0; i < records.length; i += CHUNK) {
    const batch = writeBatch(fs);
    for (const record of records.slice(i, i + CHUNK)) {
      batch.set(doc(treeCollection(FIRESTORE_COLLECTION[table]), record.id), record as unknown as Record<string, unknown>);
    }
    await batch.commit();
  }
}

async function fullMerge(): Promise<void> {
  if (!firestore) return;
  for (const table of FAMILY_TABLES) {
    const localRecords = (await db.table(table).toArray()) as Syncable[];
    const remoteSnap = await getDocs(treeCollection(FIRESTORE_COLLECTION[table]));
    const remoteById = new Map(remoteSnap.docs.map((d) => [d.id, d.data() as RemoteDoc]));
    const localById = new Map(localRecords.map((r) => [r.id, r]));

    const batch = writeBatch(firestore);
    let pending = 0;
    for (const local of localRecords) {
      const remote = remoteById.get(local.id);
      if (remote?.deleted && remote.updatedAt >= local.updatedAt) continue;
      if (!remote || local.updatedAt > remote.updatedAt) {
        batch.set(doc(treeCollection(FIRESTORE_COLLECTION[table]), local.id), local as unknown as Record<string, unknown>);
        pending++;
      }
    }
    if (pending > 0) await batch.commit();

    for (const [id, remote] of remoteById) {
      const local = localById.get(id);
      if (remote.deleted) {
        if (!local || remote.updatedAt >= local.updatedAt) await db.table(table).delete(id);
        continue;
      }
      if (!local || remote.updatedAt > local.updatedAt) await db.table(table).put(remote);
    }
  }

  // Members: no tombstones — removing access is a real doc delete by the
  // owner, and there's no offline-editing scenario for membership to race.
  const memberSnap = await getDocs(treeCollection("members"));
  const remoteMembers = memberSnap.docs.map((d) => d.data() as FamilyMember);
  await db.familyMembers.clear();
  if (remoteMembers.length > 0) await db.familyMembers.bulkPut(remoteMembers);
}

function startListeners(): void {
  for (const table of FAMILY_TABLES) {
    const unsub = onSnapshot(
      treeCollection(FIRESTORE_COLLECTION[table]),
      (snap) => {
        void (async () => {
          for (const change of snap.docChanges()) {
            if (change.type === "removed") {
              await db.table(table).delete(change.doc.id);
              continue;
            }
            const remote = change.doc.data() as RemoteDoc;
            const local = (await db.table(table).get(remote.id)) as Syncable | undefined;
            if (remote.deleted) {
              if (!local || remote.updatedAt >= local.updatedAt) await db.table(table).delete(remote.id);
              continue;
            }
            if (!local || remote.updatedAt >= local.updatedAt) await db.table(table).put(remote);
          }
        })();
      },
      (err) => console.error(`Family sync listener error for ${table}`, err),
    );
    unsubscribers.push(unsub);
  }

  const memberUnsub = onSnapshot(
    treeCollection("members"),
    (snap) => {
      void (async () => {
        for (const change of snap.docChanges()) {
          if (change.type === "removed") {
            await db.familyMembers.delete(change.doc.id);
            continue;
          }
          await db.familyMembers.put(change.doc.data() as FamilyMember);
        }
      })();
    },
    (err) => console.error("Family sync listener error for members", err),
  );
  unsubscribers.push(memberUnsub);
}

export async function startFamilySync(uid: string): Promise<void> {
  if (activeUid === uid) return;
  stopFamilySync();
  try {
    await fullMerge();
  } catch (err) {
    // Signed in but not (yet) a tree member — Firestore rules will reject
    // these reads, which is expected rather than a real sync failure.
    console.warn("Family tree sync: initial merge failed (likely not a member yet)", err);
  }
  activeUid = uid;
  startListeners();
}

export async function refreshFamilySyncNow(): Promise<void> {
  if (!activeUid) return;
  await fullMerge();
}

export function stopFamilySync(): void {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
  activeUid = null;
}
