// What the header's sync badge shows: offline, still uploading, or a write
// the server rejected. Writes are saved to the device instantly either way —
// this is only about whether they've reached the cloud yet.
import { useSyncExternalStore } from "react";
import type { CollectionName } from "../types";

export interface SyncStatus {
  online: boolean;
  pending: boolean;
  lastError: string | null;
}

const pendingByCollection = new Map<CollectionName, boolean>();
let status: SyncStatus = { online: typeof navigator === "undefined" ? true : navigator.onLine, pending: false, lastError: null };
const listeners = new Set<() => void>();

function set(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function setCollectionPending(name: CollectionName, pending: boolean): void {
  pendingByCollection.set(name, pending);
  const any = Array.from(pendingByCollection.values()).some(Boolean);
  if (any !== status.pending) set({ pending: any });
}

export function reportWriteError(message: string | null): void {
  set({ lastError: message });
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => set({ online: true }));
  window.addEventListener("offline", () => set({ online: false }));
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}
