import { showToast } from "@journall/shared/lib/toast";
import { restore, softDelete } from "../data/repo";
import type { CollectionName } from "../types";

/** Soft-deletes and offers Undo for a few seconds. Trash (More tab) keeps it after that. */
export function deleteWithUndo(name: CollectionName, id: string, what: string): void {
  softDelete(name, id);
  showToast(`${what} deleted`, { action: { label: "Undo", onClick: () => restore(name, id) }, durationMs: 6000 });
}
