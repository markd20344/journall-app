// Minimal global toast — a transient "✓ Saved" style confirmation that
// outlives the editor triggering it (editors are often unmounted the
// instant onSaved fires, e.g. the create form closing), so the
// confirmation has to live above any single component's lifecycle.
type Listener = (message: string | null) => void;

let listeners: Listener[] = [];
let timeoutId: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string): void {
  listeners.forEach((l) => l(message));
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    listeners.forEach((l) => l(null));
  }, 2200);
}

export function subscribeToast(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
