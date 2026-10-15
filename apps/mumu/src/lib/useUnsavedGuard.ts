import { useEffect } from "react";

// Warns before closing/reloading the tab with unsaved form changes.
// (In-app navigation goes through explicit Save/Cancel buttons.)
export function useUnsavedGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
