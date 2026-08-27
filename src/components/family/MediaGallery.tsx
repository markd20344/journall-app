import { useRef, useState } from "react";
import type { AttachedTo, FamilyRole } from "../../types/family";
import { emptyDate } from "../../types/family";
import { useMediaFor } from "../../hooks/useFamilyData";
import { addMedia, deleteMedia, setProfilePhoto } from "../../family/repo";
import { canEditFacts, canEditStructure } from "../../family/role";
import PartialDateInput from "./PartialDateInput";
import { showToast } from "../../lib/toast";

interface Props {
  target: AttachedTo;
  role: FamilyRole | null;
  uid: string;
  personIdForProfilePhoto?: string;
}

export default function MediaGallery({ target, role, uid, personIdForProfilePhoto }: Props) {
  const media = useMediaFor(target);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState(emptyDate());
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleUpload() {
    if (!pendingFile) return;
    setUploading(true);
    try {
      await addMedia(pendingFile, target, { caption, date }, uid);
      setPendingFile(null);
      setCaption("");
      setDate(emptyDate());
      if (fileInput.current) fileInput.current.value = "";
      showToast("Photo added");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="family-media-gallery">
      {media.length === 0 && <p className="empty-hint">No photos yet.</p>}
      <div className="family-media-grid">
        {media.map((m) => (
          <div key={m.id} className="family-media-thumb">
            <button type="button" onClick={() => setPreview(m.downloadUrl)}>
              <img src={m.downloadUrl} alt={m.caption} loading="lazy" />
            </button>
            {(m.caption || m.date.display) && (
              <span className="family-media-caption">
                {m.caption}
                {m.caption && m.date.display ? " · " : ""}
                {m.date.display}
              </span>
            )}
            <div className="family-media-thumb-actions">
              {personIdForProfilePhoto && canEditFacts(role) && (
                <button type="button" className="ghost small" onClick={() => void setProfilePhoto(personIdForProfilePhoto, m.id)}>
                  Set as photo
                </button>
              )}
              {canEditStructure(role) && (
                <button type="button" className="ghost small" onClick={() => void deleteMedia(m.id).then(() => showToast("Photo removed"))}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canEditFacts(role) && (
        <div className="family-upload-form">
          <input ref={fileInput} type="file" accept="image/*" onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)} />
          {pendingFile && (
            <>
              <div className="family-editor-grid">
                <label className="field">
                  <span className="field-label">Caption</span>
                  <input value={caption} onChange={(e) => setCaption(e.target.value)} />
                </label>
                <PartialDateInput label="Approx. date" value={date} onChange={setDate} />
              </div>
              <button type="button" className="primary" disabled={uploading} onClick={() => void handleUpload()}>
                {uploading ? "Uploading…" : "Add photo"}
              </button>
            </>
          )}
        </div>
      )}

      {preview && (
        <div className="family-media-lightbox" onClick={() => setPreview(null)}>
          <img src={preview} alt="" />
        </div>
      )}
    </div>
  );
}
