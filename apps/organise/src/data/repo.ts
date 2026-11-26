// The only module that writes. Writes are fire-and-forget: Firestore updates
// its local cache (and the UI) at once, and the promise only settles when the
// server acknowledges, which never happens offline. Never await these in UI.
import { doc, setDoc } from "firebase/firestore";
import { firebaseEnabled, firestore } from "@journall/shared/firebase/config";
import { newId, nowIso } from "@journall/shared/lib/id";
import type { ParsedItem } from "../lib/parse";
import { LISTS } from "../lib/lists";
import { itemKey } from "../lib/text";
import { listOf, qtyOf, type ListKind, type ShoppingItem } from "../types";
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
      console.error("Organise write failed", err);
      reportWriteError(err.message);
    });
}

/** What an add changed, so Undo can put it back. */
export interface AddResult {
  added: ShoppingItem[];
  undo: () => void;
}

export function addItems(list: ListKind, parsed: ParsedItem[]): AddResult {
  const now = nowIso();
  const added: ShoppingItem[] = [];
  const restores: (() => void)[] = [];
  const seen = new Set<string>();

  for (const p of parsed) {
    const key = itemKey(p.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    // Only within the same list: "socks" on Clothes and a to-do are unrelated.
    const existing = getItems().find((i) => i.key === key && listOf(i) === list);

    if (existing) {
      const before = { status: existing.status, shop: existing.shop, note: existing.note, qty: qtyOf(existing), addedAt: existing.addedAt, timesAdded: existing.timesAdded, gotAt: existing.gotAt };
      const shared = { shop: p.shop ?? existing.shop, note: p.note ?? existing.note };
      const patch: Partial<ShoppingItem> =
        existing.status === "needed"
          ? // Already on the list: take a newly named shop, size or count.
            { ...shared, qty: p.qty ?? qtyOf(existing) }
          : // Back on the list: last trip's count doesn't carry over.
            { ...shared, qty: p.qty ?? 1, status: "needed", addedAt: now, gotAt: null, timesAdded: (existing.timesAdded ?? 0) + 1 };
      write(existing.id, patch);
      added.push({ ...existing, ...patch });
      restores.push(() => write(existing.id, before));
      continue;
    }

    const item: ShoppingItem = {
      id: newId(),
      list,
      name: p.name,
      key,
      shop: p.shop,
      aisle: LISTS[list].guessSection(p.name),
      note: p.note ?? "",
      qty: p.qty ?? 1,
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
export function clearGot(list: ListKind): string[] {
  const ids = getItems()
    .filter((i) => i.status === "got" && listOf(i) === list)
    .map((i) => i.id);
  ids.forEach((id) => write(id, { status: "off" }));
  return ids;
}

export function setQty(id: string, qty: number): void {
  write(id, { qty: Math.min(99, Math.max(1, Math.round(qty))) });
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
