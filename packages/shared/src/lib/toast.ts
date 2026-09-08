// Minimal global toast — a transient "✓ Saved" style confirmation that
// outlives the editor triggering it (editors are often unmounted the
// instant onSaved fires, e.g. the create form closing), so the
// confirmation has to live above any single component's lifecycle.
export interface ToastState {
  message: string;
  action?: { label: string; onClick: () => void };
}

type Listener = (toast: ToastState | null) => void;

let listeners: Listener[] = [];
let timeoutId: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, options?: { action?: ToastState["action"]; durationMs?: number }): void {
  const toast: ToastState = { message, action: options?.action };
  listeners.forEach((l) => l(toast));
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = setTimeout(
    () => {
      listeners.forEach((l) => l(null));
    },
    options?.durationMs ?? 2200,
  );
}

export function subscribeToast(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
