// Mirrors the local Dexie cache to/from Firestore so the same account sees
// the same data on every device. Dexie stays the source of truth for the UI
// (fast, works offline); Firestore is a sync layer bolted on top using the
// same last-write-wins-by-`updatedAt` approach as the JSON export/import and
// folder-sync features.
//
// Deletions are written as tombstones (`{ id, deleted: true, updatedAt }`)
// rather than removing the Firestore doc outright. That makes a full
// reconciliation (initialMerge / refreshNow) unambiguous: a local record
// with no remote counterpart at all is simply "not pushed yet" and is left
// alone, while a remote tombstone is an explicit instruction to delete
// locally. Without this, a plain "local record missing from remote" check
// couldn't tell a genuine deletion apart from a race against an in-flight
// first push, risking data loss.
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../db/db";
import { firestore } from "./config";
import { nowIso } from "../lib/id";

const SYNCED_TABLES = ["categories", "topics", "entries", "items"] as const;
type SyncedTable = (typeof SYNCED_TABLES)[number];

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

function userCollection(uid: string, table: SyncedTable) {
  return collection(firestore!, "users", uid, table);
}

/** Push one changed record up to Firestore. Fire-and-forget; safe to call even when sync is inactive. */
export function pushRecord(table: SyncedTable, record: Syncable): void {
  if (!activeUid || !firestore) return;
  const uid = activeUid;
  void (async () => {
    try {
      const batch = writeBatch(firestore);
      batch.set(doc(userCollection(uid, table), record.id), record as unknown as Record<string, unknown>);
      await batch.commit();
    } catch (err) {
      console.error(`Firestore push failed for ${table}/${record.id}`, err);
    }
  })();
}

/** Marks a record deleted in Firestore via tombstone rather than removing the doc. */
export function deleteRecord(table: SyncedTable, id: string): void {
  if (!activeUid || !firestore) return;
  const tombstone: RemoteDoc = { id, deleted: true, updatedAt: nowIso() };
  setDoc(doc(userCollection(activeUid, table), id), tombstone as unknown as Record<string, unknown>).catch((err) => {
    console.error(`Firestore delete failed for ${table}/${id}`, err);
  });
}

/** Full reconciliation of local vs. remote state — safe to call anytime, not just at sign-in. */
async function fullMerge(uid: string): Promise<void> {
  if (!firestore) return;
  for (const table of SYNCED_TABLES) {
    const localRecords = (await db.table(table).toArray()) as Syncable[];
    const remoteSnap = await getDocs(userCollection(uid, table));
    const remoteById = new Map(remoteSnap.docs.map((d) => [d.id, d.data() as RemoteDoc]));
    const localById = new Map(localRecords.map((r) => [r.id, r]));

    const batch = writeBatch(firestore);
    let pending = 0;
    for (const local of localRecords) {
      const remote = remoteById.get(local.id);
      // A newer remote tombstone means this record was deleted elsewhere
      // after our last known state — don't resurrect it by pushing.
      if (remote?.deleted && remote.updatedAt >= local.updatedAt) continue;
      if (!remote || local.updatedAt > remote.updatedAt) {
        batch.set(doc(userCollection(uid, table), local.id), local as unknown as Record<string, unknown>);
        pending++;
      }
    }
    if (pending > 0) await batch.commit();

    for (const [id, remote] of remoteById) {
      const local = localById.get(id);
      if (remote.deleted) {
        if (!local || remote.updatedAt >= local.updatedAt) {
          await db.table(table).delete(id);
        }
        continue;
      }
      if (!local || remote.updatedAt > local.updatedAt) {
        await db.table(table).put(remote);
      }
    }
  }
}

function startListeners(uid: string): void {
  for (const table of SYNCED_TABLES) {
    const unsub = onSnapshot(
      userCollection(uid, table),
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
              if (!local || remote.updatedAt >= local.updatedAt) {
                await db.table(table).delete(remote.id);
              }
              continue;
            }
            if (!local || remote.updatedAt >= local.updatedAt) {
              await db.table(table).put(remote);
            }
          }
        })();
      },
      (err) => console.error(`Firestore listener error for ${table}`, err),
    );
    unsubscribers.push(unsub);
  }
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
 * real-time listeners — useful when a device was backgrounded (phones
 * pause JS for background tabs, so listeners can lag until reopened).
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
