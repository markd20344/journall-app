import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { useCategories } from "../hooks/useJournalData";
import { deleteCategory, renameCategory } from "../db/repo";
import { exportAsJson, exportAsMarkdown, importDump, readFileAsJson } from "../lib/exportImport";
import { ACCENT_PRESETS, getStoredAccentColor, setStoredAccentColor } from "../lib/theme";
import { signOutUser, watchAuthState } from "../firebase/auth";
import { firebaseEnabled } from "../firebase/config";
import { refreshNow } from "../firebase/sync";
import { showToast } from "../lib/toast";
import { cancelPendingDelete, schedulePendingDelete } from "../lib/pendingDelete";
import {
  forgetDirectoryHandle,
  getSavedDirectoryHandle,
  isFileSystemAccessSupported,
  pickSyncFolder,
  syncWithFolder,
  verifyPermission,
} from "../lib/fileSync";

export default function SettingsPage() {
  const categories = useCategories();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#6b7280");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [syncSupported] = useState(isFileSystemAccessSupported());
  const [syncFolderName, setSyncFolderName] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [account, setAccount] = useState<User | null>(null);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    void getSavedDirectoryHandle().then((handle) => {
      if (handle) setSyncFolderName(handle.name);
    });
    void getStoredAccentColor().then(setAccentColor);
    return watchAuthState(setAccount);
  }, []);

  async function handleCloudSyncNow() {
    setCloudSyncing(true);
    setCloudSyncStatus(null);
    try {
      await refreshNow();
      setCloudSyncStatus("Synced.");
    } catch (err) {
      setCloudSyncStatus(`Sync failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setCloudSyncing(false);
    }
  }

  async function chooseAccent(hex: string) {
    setAccentColor(hex);
    await setStoredAccentColor(hex);
  }

  function startEdit(id: string, name: string, color: string) {
    setEditingId(id);
    setEditName(name);
    setEditColor(color);
  }

  async function saveEdit() {
    if (!editingId) return;
    await renameCategory(editingId, editName.trim(), editColor);
    setEditingId(null);
  }

  function handleDelete(id: string, name: string) {
    schedulePendingDelete("category", id, () => deleteCategory(id));
    showToast(`Deleted "${name}"`, {
      action: { label: "Undo", onClick: () => cancelPendingDelete("category", id) },
      durationMs: 5000,
    });
  }

  async function handleImportFile(file: File) {
    try {
      const dump = await readFileAsJson(file);
      const result = await importDump(dump);
      setImportStatus(`Imported: ${result.added} added, ${result.updated} updated.`);
    } catch {
      setImportStatus("Import failed — that doesn't look like a valid journal export file.");
    }
  }

  async function handleConnectFolder() {
    try {
      const handle = await pickSyncFolder();
      setSyncFolderName(handle.name);
      setSyncStatus(null);
    } catch {
      // User cancelled the picker — nothing to do.
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    setSyncStatus(null);
    try {
      const handle = await getSavedDirectoryHandle();
      if (!handle) {
        setSyncStatus("No sync folder connected yet.");
        return;
      }
      const ok = await verifyPermission(handle, "readwrite");
      if (!ok) {
        setSyncStatus("Permission to access the folder was denied.");
        return;
      }
      const result = await syncWithFolder(handle);
      setSyncStatus(`Synced. Pulled in ${result.added} new and ${result.updated} updated record(s).`);
    } catch (err) {
      setSyncStatus(`Sync failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnectFolder() {
    await forgetDirectoryHandle();
    setSyncFolderName(null);
    setSyncStatus(null);
  }

  return (
    <div className="page settings-page">
      <h1 className="page-title">Settings</h1>

      {firebaseEnabled && account && (
        <section className="settings-section">
          <h2>Account</h2>
          <p className="settings-hint">
            Signed in as <strong>{account.email}</strong>. Your journal syncs automatically to any other device
            signed in with this account — but phones pause background tabs, so a device that's been asleep can lag
            behind until it's reopened. Use "Sync now" to force it immediately.
          </p>
          <div className="settings-actions">
            <button type="button" onClick={() => void handleCloudSyncNow()} disabled={cloudSyncing}>
              {cloudSyncing ? "Syncing…" : "Sync now"}
            </button>
            <button type="button" className="ghost" onClick={() => void signOutUser()}>Sign out</button>
          </div>
          {cloudSyncStatus && <p className="settings-status">{cloudSyncStatus}</p>}
        </section>
      )}

      <section className="settings-section">
        <h2>Appearance</h2>
        <p className="settings-hint">Pick an accent color for buttons, highlights and links.</p>
        <div className="accent-swatches">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.hex}
              type="button"
              className={`accent-swatch ${accentColor === preset.hex ? "selected" : ""}`}
              style={{ background: preset.hex }}
              title={preset.name}
              aria-label={preset.name}
              onClick={() => void chooseAccent(preset.hex)}
            />
          ))}
          <label className="accent-swatch accent-swatch-custom" title="Custom color">
            <input
              type="color"
              value={accentColor ?? "#2563eb"}
              onChange={(e) => void chooseAccent(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h2>Categories</h2>
        <p className="settings-hint">Rename, recolor, or remove categories. Topics stay attached to the category they were created under.</p>
        <ul className="category-list">
          {categories.map((c) => (
            <li key={c.id} className="category-list-item">
              {editingId === c.id ? (
                <>
                  <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} />
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <button type="button" onClick={() => void saveEdit()}>Save</button>
                  <button type="button" className="ghost" onClick={() => setEditingId(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span className="category-pill" style={{ background: c.color }}>{c.name}</span>
                  <button type="button" className="ghost" onClick={() => startEdit(c.id, c.name, c.color)}>Edit</button>
                  <button type="button" className="danger ghost" onClick={() => handleDelete(c.id, c.name)}>Delete</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-section">
        <h2>Backup &amp; export</h2>
        <p className="settings-hint">Your data always lives in this browser's local storage first. Export regularly as a fallback backup.</p>
        <div className="settings-actions">
          <button type="button" onClick={() => void exportAsJson()}>Export as JSON</button>
          <button type="button" onClick={() => void exportAsMarkdown()}>Export as Markdown</button>
          <button type="button" className="ghost" onClick={() => fileInputRef.current?.click()}>
            Import from JSON…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = "";
            }}
          />
        </div>
        {importStatus && <p className="settings-status">{importStatus}</p>}
      </section>

      <section className="settings-section">
        <h2>Folder sync (phone ↔ PC)</h2>
        {!syncSupported && (
          <p className="settings-hint">
            Your browser doesn't support direct folder access (this needs Chrome or Edge on desktop, or Android).
            On this device, use Export/Import above through a synced folder (e.g. open your Drive/iCloud/Syncthing
            app, save the exported file into it, and import it on your other device).
          </p>
        )}
        {syncSupported && (
          <>
            <p className="settings-hint">
              Connect a folder that's synced by a service you already control — Syncthing, Google Drive, iCloud
              Drive, or a WebDAV/Nextcloud mount. The app reads and writes plain JSON files there; nothing goes to a
              proprietary cloud.
            </p>
            {syncFolderName ? (
              <>
                <p className="settings-status">Connected folder: <strong>{syncFolderName}</strong></p>
                <div className="settings-actions">
                  <button type="button" onClick={() => void handleSyncNow()} disabled={syncing}>
                    {syncing ? "Syncing…" : "Sync now"}
                  </button>
                  <button type="button" className="ghost" onClick={() => void handleDisconnectFolder()}>
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <button type="button" onClick={() => void handleConnectFolder()}>Choose sync folder…</button>
            )}
            {syncStatus && <p className="settings-status">{syncStatus}</p>}
            <p className="settings-hint small">
              Note: sync is last-write-wins per entry and doesn't yet propagate deletions across devices — deleting
              an entry removes it locally, but re-syncing with a folder that still has the old file will bring it
              back. Delete from the folder too if you need it gone everywhere.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
