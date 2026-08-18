import { useEffect, useReducer } from "react";

// Backs the "Delete — Undo" toast pattern: a delete is staged for a few
// seconds before it actually happens, giving Undo something real to cancel
// instead of a browser confirm() dialog gatekeeping every delete up front.
// List views filter out staged ids via usePendingDeleteIds so the record
// disappears immediately, the same as before, while still being fully
// recoverable until the timer fires.
export type PendingKind = "entry" | "item" | "category" | "book";

interface Pending {
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, Pending>();
type Listener = () => void;
let listeners: Listener[] = [];

function key(kind: PendingKind, id: string): string {
  return `${kind}:${id}`;
}

function notify(): void {
  listeners.forEach((l) => l());
}

/** Stages a delete to actually run after delayMs unless cancelPendingDelete is called first. */
export function schedulePendingDelete(kind: PendingKind, id: string, commit: () => Promise<void>, delayMs = 5000): void {
  const k = key(kind, id);
  const existing = pending.get(k);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    pending.delete(k);
    notify();
    void commit();
  }, delayMs);
  pending.set(k, { timer });
  notify();
}

/** Cancels a staged delete (Undo). Returns false if it already ran or was never staged. */
export function cancelPendingDelete(kind: PendingKind, id: string): boolean {
  const k = key(kind, id);
  const existing = pending.get(k);
  if (!existing) return false;
  clearTimeout(existing.timer);
  pending.delete(k);
  notify();
  return true;
}

function subscribe(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/** The set of ids of a given kind currently staged for deletion — list views filter these out. */
export function usePendingDeleteIds(kind: PendingKind): Set<string> {
  const [, forceRender] = useReducer((c: number) => c + 1, 0);
  useEffect(() => subscribe(forceRender), []);
  const ids = new Set<string>();
  const prefix = `${kind}:`;
  for (const k of pending.keys()) {
    if (k.startsWith(prefix)) ids.add(k.slice(prefix.length));
  }
  return ids;
}
