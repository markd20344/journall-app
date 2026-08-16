// Mirrors the local Dexie cache to/from Firestore so the same account sees
// the same data on every device. Dexie stays the source of truth for the UI
// (fast, works offline); Firestore is a sync layer bolted on top using the
// same last-write-wins-by-`updatedAt` approach as the JSON export/import and
// folder-sync features.
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../db/db";
import { firestore } from "./config";

const SYNCED_TABLES = ["categories", "topics", "entries", "items"] as const;
type SyncedTable = (typeof SYNCED_TABLES)[number];

interface Syncable {
  id: string;
  updatedAt: string;
}

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

export function deleteRecord(table: SyncedTable, id: string): void {
  if (!activeUid || !firestore) return;
  deleteDoc(doc(userCollection(activeUid, table), id)).catch((err) => {
    console.error(`Firestore delete failed for ${table}/${id}`, err);
  });
}

/** One-time reconciliation of whatever's already local vs. already remote, run once per sign-in. */
async function initialMerge(uid: string): Promise<void> {
  if (!firestore) return;
  for (const table of SYNCED_TABLES) {
    const localRecords = (await db.table(table).toArray()) as Syncable[];
    const remoteSnap = await getDocs(userCollection(uid, table));
    const remoteById = new Map(remoteSnap.docs.map((d) => [d.id, d.data() as Syncable]));
    const localById = new Map(localRecords.map((r) => [r.id, r]));

    const batch = writeBatch(firestore);
    let pending = 0;
    for (const local of localRecords) {
      const remote = remoteById.get(local.id);
      if (!remote || local.updatedAt > remote.updatedAt) {
        batch.set(doc(userCollection(uid, table), local.id), local as unknown as Record<string, unknown>);
        pending++;
      }
    }
    if (pending > 0) await batch.commit();

    for (const [id, remote] of remoteById) {
      const local = localById.get(id);
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
            const remote = change.doc.data() as Syncable;
            const local = (await db.table(table).get(remote.id)) as Syncable | undefined;
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
  await initialMerge(uid);
  activeUid = uid;
  startListeners(uid);
}

export function stopSync(): void {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
  activeUid = null;
}
