import { useEffect, useState } from "react";
import { firebaseEnabled } from "../firebase/config";
import { subscribeSyncStatus, type SyncStatus } from "../firebase/sync";

// Sits in the header, visible from every page — not just at sign-in — since
// a background push can fail (or queue up) at any point while using the app,
// and the whole point of sync is that the phone and PC silently stay in
// step. Renders nothing once everything's caught up and healthy, so it
// never becomes permanent visual noise.
export default function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatus>({ pending: 0, lastError: null });

  useEffect(() => subscribeSyncStatus(setStatus), []);

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
