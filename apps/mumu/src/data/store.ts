// In-memory mirror of the signed-in user's Firestore collections.
//
// One live onSnapshot listener per collection feeds a plain object of arrays
// that React reads through useSyncExternalStore. At personal scale (a few
// thousand records) this makes every list, filter and search instant and
// fully offline: Firestore's persistent cache answers the listener from
// IndexedDB before the network does, and pushes server changes in as they
// arrive. Writes never go through here — see repo.ts.
import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { useSyncExternalStore } from "react";
import { firestore } from "@journall/shared/firebase/config";
import type { CollectionName, CollectionTypes } from "../types";
import { setCollectionPending } from "./syncStatus";

export const COLLECTIONS: CollectionName[] = ["companies", "people", "notes"];

interface Slice<T> {
  all: T[]; // includes soft-deleted records (Trash, backups)
  live: T[]; // excludes them — what every screen shows
  byId: Map<string, T>;
  ready: boolean;
}

type State = { [K in CollectionName]: Slice<CollectionTypes[K]> };

function emptySlice<T>(): Slice<T> {
  return { all: [], live: [], byId: new Map(), ready: false };
}

let state: State = { companies: emptySlice(), people: emptySlice(), notes: emptySlice() };
let uid: string | null = null;
let unsubscribers: Unsubscribe[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function currentUid(): string | null {
  return uid;
}

export function startStore(userId: string): void {
  if (uid === userId) return;
  stopStore();
  uid = userId;
  for (const name of COLLECTIONS) {
    const unsub = onSnapshot(
      collection(firestore!, "users", userId, name),
      { includeMetadataChanges: true },
      (snap) => {
        setCollectionPending(name, snap.metadata.hasPendingWrites);
        const all = snap.docs.map((d) => ({ ...d.data(), id: d.id })) as CollectionTypes[typeof name][];
        const slice: Slice<CollectionTypes[typeof name]> = {
          all,
          live: all.filter((r) => !r.deleted),
          byId: new Map(all.map((r) => [r.id, r])),
          ready: true,
        };
        state = { ...state, [name]: slice };
        emit();
      },
      (err) => console.error(`Firestore listener error for ${name}`, err),
    );
    unsubscribers.push(unsub);
  }
}

export function stopStore(): void {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  uid = null;
  state = { companies: emptySlice(), people: emptySlice(), notes: emptySlice() };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getState(): State {
  return state;
}

/** The whole store; re-renders on any change. Fine at this scale. */
export function useStore(): State {
  return useSyncExternalStore(subscribe, getState);
}

export function useCollection<K extends CollectionName>(name: K): CollectionTypes[K][] {
  return useStore()[name].live as CollectionTypes[K][];
}

export function useRecord<K extends CollectionName>(name: K, id: string | undefined): CollectionTypes[K] | undefined {
  const slice = useStore()[name];
  return id ? (slice.byId.get(id) as CollectionTypes[K] | undefined) : undefined;
}

export function useStoreReady(): boolean {
  const s = useStore();
  return COLLECTIONS.every((name) => s[name].ready);
}

/** Non-hook read for event handlers. */
export function getRecord<K extends CollectionName>(name: K, id: string): CollectionTypes[K] | undefined {
  return state[name].byId.get(id) as CollectionTypes[K] | undefined;
}
