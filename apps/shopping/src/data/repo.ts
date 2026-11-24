// The only module that writes. Writes are fire-and-forget: Firestore updates
// its local cache (and the UI) at once, and the promise only settles when the
// server acknowledges, which never happens offline. Never await these in UI.
import { doc, setDoc } from "firebase/firestore";
import { firebaseEnabled, firestore } from "@journall/shared/firebase/config";
import { newId, nowIso } from "@journall/shared/lib/id";
import type { ParsedItem } from "../lib/parse";
import { guessAisle } from "../lib/aisles";
import { itemKey } from "../lib/text";
import type { ShoppingItem } from "../types";
import { COLLECTION, currentUid, getItem, getItems, reportWriteError, writeLocal } from "./store";

function write(id: string, patch: Partial<ShoppingItem>): void {
  const withTime = { ...patch, updatedAt: nowIso() };
  if (!firebaseEnabled) {
    writeLocal(id, withTime);
    return;
  }
  const uid = currentUid();
  if (!uid || !firestore) return;
  // merge, so fields a later version adds survive an edit from an older one.
  setDoc(doc(firestore, "users", uid, COLLECTION, id), withTime, { merge: true })
    .then(() => reportWriteError(null))
    .catch((err: Error) => {
      console.error("Shopping list write failed", err);
      reportWriteError(err.message);
    });
}

/** What an add changed, so Undo can put it back. */
export interface AddResult {
  added: ShoppingItem[];
  undo: () => void;
}

export function addItems(parsed: ParsedItem[]): AddResult {
  const now = nowIso();
  const added: ShoppingItem[] = [];
  const restores: (() => void)[] = [];
  const seen = new Set<string>();

  for (const p of parsed) {
    const key = itemKey(p.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const existing = getItems().find((i) => i.key === key);

    if (existing) {
      const before = { status: existing.status, shop: existing.shop, addedAt: existing.addedAt, timesAdded: existing.timesAdded, gotAt: existing.gotAt };
      const patch: Partial<ShoppingItem> =
        existing.status === "needed"
          ? { shop: p.shop ?? existing.shop } // already on the list: just take a newly named shop
          : { status: "needed", shop: p.shop ?? existing.shop, addedAt: now, gotAt: null, timesAdded: (existing.timesAdded ?? 0) + 1 };
      write(existing.id, patch);
      added.push({ ...existing, ...patch });
      restores.push(() => write(existing.id, before));
      continue;
    }

    const item: ShoppingItem = {
      id: newId(),
      name: p.name,
      key,
      shop: p.shop,
      aisle: guessAisle(p.name),
      note: "",
      status: "needed",
      timesAdded: 1,
      addedAt: now,
      gotAt: null,
      createdAt: now,
      updatedAt: now,
    };
    write(item.id, item);
    added.push(item);
    restores.push(() => write(item.id, { deleted: true }));
  }

  return { added, undo: () => restores.forEach((r) => r()) };
}

export function toggleGot(id: string): void {
  const item = getItem(id);
  if (!item) return;
  if (item.status === "got") write(id, { status: "needed", gotAt: null });
  else write(id, { status: "got", gotAt: nowIso() });
}

/** Ticked items leave the list but stay as "Buy again" suggestions. */
export function clearGot(): string[] {
  const ids = getItems()
    .filter((i) => i.status === "got")
    .map((i) => i.id);
  ids.forEach((id) => write(id, { status: "off" }));
  return ids;
}

export function setStatus(id: string, status: ShoppingItem["status"]): void {
  write(id, { status });
}

export function updateItem(id: string, patch: Pick<Partial<ShoppingItem>, "name" | "shop" | "aisle" | "note">): void {
  write(id, patch.name !== undefined ? { ...patch, key: itemKey(patch.name) } : patch);
}

/** Off the list and out of the suggestions (soft delete; recoverable in Firestore). */
export function forget(id: string): void {
  write(id, { deleted: true });
}

export function unforget(id: string): void {
  write(id, { deleted: false });
}
