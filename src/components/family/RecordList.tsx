import { useRef, useState } from "react";
import type { AttachedTo, FamilyRole, RecordType } from "../../types/family";
import { useRecordsFor } from "../../hooks/useFamilyData";
import { addFamilyRecord, deleteFamilyRecordDoc } from "../../family/repo";
import { canEditFacts, canEditStructure } from "../../family/role";
import { RECORD_TYPE_OPTIONS, recordTypeLabel } from "../../family/recordTypes";
import { showToast } from "../../lib/toast";

interface Props {
  target: AttachedTo;
  role: FamilyRole | null;
  uid: string;
}

export default function RecordList({ target, role, uid }: Props) {
  const records = useRecordsFor(target);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [recordType, setRecordType] = useState<RecordType>("other");
  const [sourceCitation, setSourceCitation] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (!pendingFile) return;
    setUploading(true);
    try {
      await addFamilyRecord(pendingFile, target, { recordType, sourceCitation, caption }, uid);
      setPendingFile(null);
      setSourceCitation("");
      setCaption("");
      if (fileInput.current) fileInput.current.value = "";
      showToast("Record added");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="family-record-list">
      {records.length === 0 && <p className="empty-hint">No records yet.</p>}
      {records.map((r) => (
        <div key={r.id} className="family-record-row">
          <a href={r.downloadUrl} target="_blank" rel="noreferrer" className="family-record-link">
            {recordTypeLabel(r.recordType)} — {r.fileName}
          </a>
          {r.sourceCitation && <span className="family-record-citation">{r.sourceCitation}</span>}
          {r.caption && <span className="family-record-citation">{r.caption}</span>}
          {canEditStructure(role) && (
            <button type="button" className="ghost small" onClick={() => void deleteFamilyRecordDoc(r.id).then(() => showToast("Record removed"))}>
              Delete
            </button>
          )}
        </div>
      ))}

      {canEditFacts(role) && (
        <div className="family-upload-form">
          <input ref={fileInput} type="file" accept="image/*,application/pdf" onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)} />
          {pendingFile && (
            <>
              <div className="family-editor-grid">
                <label className="field">
                  <span className="field-label">Record type</span>
                  <select value={recordType} onChange={(e) => setRecordType(e.target.value as RecordType)}>
                    {RECORD_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Source citation</span>
                  <input value={sourceCitation} onChange={(e) => setSourceCitation(e.target.value)} placeholder="e.g. 1911 UK Census, Ancestry.co.uk" />
                </label>
              </div>
              <label className="field">
                <span className="field-label">Caption</span>
                <input value={caption} onChange={(e) => setCaption(e.target.value)} />
              </label>
              <button type="button" className="primary" disabled={uploading} onClick={() => void handleUpload()}>
                {uploading ? "Uploading…" : "Add record"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
