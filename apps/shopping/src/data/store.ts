// In-memory mirror of users/{uid}/shoppingItems, read through
// useSyncExternalStore. Firestore's persistent cache answers the listener
// from IndexedDB before the network does, so the list opens instantly and
// works with no signal (in a shop basement, say).
//
// With no Firebase config (local dev without .env.local) the list lives in
// localStorage instead, so the app is still usable and testable.
import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { useSyncExternalStore } from "react";
import { firebaseEnabled, firestore } from "@journall/shared/firebase/config";
import type { SyncStatus } from "@journall/shared/components/SyncStatusBadge";
import type { ShoppingItem } from "../types";

export const COLLECTION = "shoppingItems";
const LOCAL_KEY = "shopping:items";

interface State {
  items: ShoppingItem[]; // excludes soft-deleted
  byId: Map<string, ShoppingItem>;
  ready: boolean;
}

let state: State = { items: [], byId: new Map(), ready: !firebaseEnabled };
let uid: string | null = null;
let unsubscribe: Unsubscribe | null = null;
const listeners = new Set<() => void>();

let syncStatus: SyncStatus = { pending: 0, lastError: null };
const syncListeners = new Set<(s: SyncStatus) => void>();

function setSync(patch: Partial<SyncStatus>) {
  syncStatus = { ...syncStatus, ...patch };
  syncListeners.forEach((l) => l(syncStatus));
}

export function subscribeSyncStatus(listener: (s: SyncStatus) => void): () => void {
  syncListeners.add(listener);
  listener(syncStatus);
  return () => syncListeners.delete(listener);
}

export function reportWriteError(message: string | null): void {
  setSync({ lastError: message });
}

function setItems(all: ShoppingItem[]) {
  const live = all.filter((i) => !i.deleted);
  state = { items: live, byId: new Map(all.map((i) => [i.id, i])), ready: true };
  listeners.forEach((l) => l());
}

export function currentUid(): string | null {
  return uid;
}

export function startStore(userId: string): void {
  if (uid === userId || !firestore) return;
  stopStore();
  uid = userId;
  unsubscribe = onSnapshot(
    collection(firestore, "users", userId, COLLECTION),
    { includeMetadataChanges: true },
    (snap) => {
      setSync({ pending: snap.metadata.hasPendingWrites ? 1 : 0 });
      setItems(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ShoppingItem));
    },
    (err) => {
      console.error("Shopping list listener failed", err);
      setSync({ lastError: err.message });
    },
  );
}

export function stopStore(): void {
  // AuthGate reports "signed out" on start-up even with no Firebase at all;
  // in local-only mode the list isn't tied to an account, so keep it.
  if (!firebaseEnabled) return;
  unsubscribe?.();
  unsubscribe = null;
  uid = null;
  state = { items: [], byId: new Map(), ready: false };
  listeners.forEach((l) => l());
}

// --- local-only mode ----------------------------------------------------

function readLocal(): ShoppingItem[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as ShoppingItem[];
  } catch {
    return [];
  }
}

if (!firebaseEnabled && typeof window !== "undefined") {
  setItems(readLocal());
  // Another tab changed the list.
  window.addEventListener("storage", (e) => {
    if (e.key === LOCAL_KEY) setItems(readLocal());
  });
}

/** Local-only mode's write path; repo.ts calls this instead of Firestore. */
export function writeLocal(id: string, patch: Partial<ShoppingItem>): void {
  const all = readLocal();
  const i = all.findIndex((x) => x.id === id);
  if (i >= 0) all[i] = { ...all[i], ...patch };
  else all.push({ ...(patch as ShoppingItem), id });
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  } catch {
    // Storage full or blocked: keep it in memory for this session.
  }
  setItems(all);
}

// --- hooks ----------------------------------------------------------------

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useItems(): State {
  return useSyncExternalStore(subscribe, () => state);
}

/** Non-hook read for event handlers. */
export function getItems(): ShoppingItem[] {
  return state.items;
}

export function getItem(id: string): ShoppingItem | undefined {
  return state.byId.get(id);
}
