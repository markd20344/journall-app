import { useEffect } from "react";
import { trackView } from "../data/repo";
import type { RecordKind } from "../types";

/** Records a detail-page visit in "recently viewed" (once the record exists). */
export function useTrackView(kind: RecordKind, id: string | undefined, exists: boolean): void {
  useEffect(() => {
    if (id && exists) trackView(kind, id);
  }, [kind, id, exists]);
}
