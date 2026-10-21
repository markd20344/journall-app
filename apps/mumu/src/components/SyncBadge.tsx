import { firebaseEnabled } from "@journall/shared/firebase/config";
import { useSyncStatus } from "../data/syncStatus";

// Quiet when everything is saved and synced; otherwise says why not.
export default function SyncBadge() {
  const { online, pending, lastError } = useSyncStatus();
  if (!firebaseEnabled) return null;
  if (lastError) {
    return (
      <span className="sync-badge error" role="status" title={lastError}>
        Sync error
      </span>
    );
  }
  if (!online) {
    return (
      <span className="sync-badge" role="status" title="Changes are saved on this device and will sync when you're back online.">
        Offline · saved here
      </span>
    );
  }
  if (pending) {
    return (
      <span className="sync-badge" role="status">
        Syncing…
      </span>
    );
  }
  return null;
}
