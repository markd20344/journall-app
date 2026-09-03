import { useRef, useState } from "react";
import type { ItemAttachment } from "../types";
import { useAttachmentsForItem } from "../hooks/useJournalData";
import { addItemAttachment, deleteItemAttachment } from "../db/repo";
import { showToast } from "../lib/toast";

interface Props {
  itemId: string;
}

// Photos attached to a Task (or any item) — uploads to Firebase Storage
// (see lib/itemAttachmentStorage.ts), so a photo added on the phone shows
// up here on any signed-in device, not just the one it was taken on.
export default function ItemAttachments({ itemId }: Props) {
  const attachments = useAttachmentsForItem(itemId);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<ItemAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileChosen(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      await addItemAttachment(itemId, file);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't attach that photo");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(attachment: ItemAttachment) {
    if (viewing?.id === attachment.id) setViewing(null);
    await deleteItemAttachment(attachment.id);
  }

  return (
    <div className="link-section">
      <div className="attachments-header">
        <span className="field-label">Photos</span>
        <button type="button" className="ghost" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? "Uploading…" : "+ Add photo"}
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void handleFileChosen(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {attachments.length === 0 ? (
        <p className="settings-hint small">No photos attached yet.</p>
      ) : (
        <div className="attachment-grid">
          {attachments.map((a) => (
            <div key={a.id} className="attachment-thumb">
              <button type="button" className="attachment-thumb-open" onClick={() => setViewing(a)}>
                <img src={a.downloadUrl} alt={a.name} loading="lazy" />
              </button>
              <button
                type="button"
                className="chip-remove attachment-remove"
                aria-label={`Delete ${a.name}`}
                onClick={() => void handleDelete(a)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <div className="attachment-lightbox" onClick={() => setViewing(null)}>
          <img src={viewing.downloadUrl} alt={viewing.name} />
        </div>
      )}
    </div>
  );
}
