import { useEffect, useState } from "react";
import { firebaseEnabled } from "../firebase/config";

export interface SyncStatus {
  pending: number;
  lastError: string | null;
}

interface SyncStatusBadgeProps {
  /** Subscribe to this app's own sync status source (e.g. firebase/sync.ts's subscribeSyncStatus). */
  subscribe: (listener: (status: SyncStatus) => void) => () => void;
}

// Sits in the header, visible from every page — not just at sign-in — since
// a background push can fail (or queue up) at any point while using the app,
// and the whole point of sync is that the phone and PC silently stay in
// step. Renders nothing once everything's caught up and healthy, so it
// never becomes permanent visual noise.
export default function SyncStatusBadge({ subscribe }: SyncStatusBadgeProps) {
  const [status, setStatus] = useState<SyncStatus>({ pending: 0, lastError: null });

  useEffect(() => subscribe(setStatus), [subscribe]);

  if (!firebaseEnabled) return null;

  if (status.pending > 0) {
    return (
      <span className="sync-status-badge" role="status">
        Syncing…
      </span>
    );
  }

  if (status.lastError) {
    return (
      <span className="sync-status-badge sync-status-badge-error" role="status" title={status.lastError}>
        Sync error
      </span>
    );
  }

  return null;
}
