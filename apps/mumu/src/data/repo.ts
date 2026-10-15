// The only module that writes to Firestore. Every write stamps updatedAt
// (and createdAt on create), and nothing is ever hard-deleted.
//
// Writes are fire-and-forget on purpose: a Firestore write promise only
// resolves once the *server* acknowledges it, which never happens while
// offline. The change is already in the local cache (and so on screen, via
// the store's listeners) the moment setDoc is called, so awaiting it would
// just freeze the UI whenever there's no signal.
import { doc, setDoc } from "firebase/firestore";
import { firestore } from "@journall/shared/firebase/config";
import { newId, nowIso } from "@journall/shared/lib/id";
import type { BaseDoc, CollectionName, CollectionTypes } from "../types";
import { currentUid } from "./store";
import { reportWriteError } from "./syncStatus";

export type NewRecord<K extends CollectionName> = Omit<CollectionTypes[K], keyof BaseDoc>;

function ref(name: CollectionName, id: string) {
  const uid = currentUid();
  if (!uid || !firestore) throw new Error("Not signed in.");
  return doc(firestore, "users", uid, name, id);
}

function track(description: string, write: Promise<void>): void {
  write
    .then(() => reportWriteError(null))
    .catch((err: unknown) => {
      console.error(description, err);
      reportWriteError(err instanceof Error ? err.message : description);
    });
}

export function createRecord<K extends CollectionName>(name: K, data: NewRecord<K>): string {
  const id = newId();
  const now = nowIso();
  track(`Create ${name}/${id} failed`, setDoc(ref(name, id), { ...data, id, createdAt: now, updatedAt: now, deleted: false }));
  return id;
}

/**
 * Merges `patch` into the record. Fields not in the patch are left exactly
 * as they are — including fields this app doesn't know about (e.g. ones a
 * Journall OS record carries), so editing here never strips them.
 */
export function updateRecord<K extends CollectionName>(name: K, id: string, patch: Partial<NewRecord<K>> & { deleted?: boolean }): void {
  track(`Update ${name}/${id} failed`, setDoc(ref(name, id), { ...patch, updatedAt: nowIso() }, { merge: true }));
}

export function softDelete(name: CollectionName, id: string): void {
  updateRecord(name, id, { deleted: true });
}

export function restore(name: CollectionName, id: string): void {
  updateRecord(name, id, { deleted: false });
}
