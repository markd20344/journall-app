import { useState } from "react";
import { addDays, format } from "date-fns";
import { emptyDraftJob, parseKitEmail, type DraftKitJob } from "../lib/kitEmailParser";
import { importKitJobs } from "../db/kitRepo";
import { showToast } from "../lib/toast";

interface Props {
  onImported: () => void;
  onCancel: () => void;
}

function tomorrow(): string {
  return format(addDays(new Date(), 1), "yyyy-MM-dd");
}

export default function KitImportPanel({ onImported, onCancel }: Props) {
  const [emailText, setEmailText] = useState("");
  const [batchDate, setBatchDate] = useState(tomorrow());
  const [drafts, setDrafts] = useState<DraftKitJob[] | null>(null);
  const [importing, setImporting] = useState(false);

  function handleParse() {
    const parsed = parseKitEmail(emailText);
    setDrafts(parsed.length > 0 ? parsed : [emptyDraftJob()]);
  }

  function updateDraft(index: number, changes: Partial<DraftKitJob>) {
    setDrafts((prev) => (prev ? prev.map((d, i) => (i === index ? { ...d, ...changes } : d)) : prev));
  }

  function removeDraft(index: number) {
    setDrafts((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  function addPhoneToDraft(index: number, phone: string) {
    const trimmed = phone.trim();
    if (!trimmed) return;
    setDrafts((prev) =>
      prev ? prev.map((d, i) => (i === index ? { ...d, phoneNumbers: [...d.phoneNumbers, trimmed] } : d)) : prev,
    );
  }

  function removePhoneFromDraft(index: number, phoneIndex: number) {
    setDrafts((prev) =>
      prev
        ? prev.map((d, i) => (i === index ? { ...d, phoneNumbers: d.phoneNumbers.filter((_, pi) => pi !== phoneIndex) } : d))
        : prev,
    );
  }

  async function handleImport() {
    if (!drafts) return;
    const usable = drafts.filter((d) => d.customerName.trim() || d.address.trim() || d.postcode.trim());
    if (usable.length === 0) return;
    setImporting(true);
    try {
      await importKitJobs(usable, batchDate);
      showToast(`Imported ${usable.length} job${usable.length === 1 ? "" : "s"} for ${batchDate}`);
      onImported();
    } finally {
      setImporting(false);
    }
  }

  if (!drafts) {
    return (
      <div className="kit-import-panel">
        <label className="field">
          <span className="field-label">Visit date</span>
          <input type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Paste the day's email</span>
          <textarea
            className="entry-body kit-import-textarea"
            placeholder="Paste the whole job email here — junk, footers and all. It'll be split into jobs and you'll get a chance to fix anything before it's saved."
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            rows={14}
          />
        </label>
        <div className="entry-editor-actions">
          <button type="button" className="primary" disabled={!emailText.trim()} onClick={handleParse}>
            Parse email
          </button>
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="kit-import-panel">
      <label className="field">
        <span className="field-label">Visit date</span>
        <input type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} />
      </label>
      <p className="settings-hint">
        Found {drafts.length} job{drafts.length === 1 ? "" : "s"}. Check the details below — the split is a best guess, so
        fix anything that's wrong or delete a card that isn't really a job.
      </p>

      {drafts.map((draft, index) => (
        <div key={index} className="kit-draft-card">
          <div className="kit-draft-row">
            <label className="field">
              <span className="field-label">Job number</span>
              <input type="text" value={draft.jobNumber} onChange={(e) => updateDraft(index, { jobNumber: e.target.value })} />
            </label>
            <button type="button" className="chip-remove" aria-label="Discard this job" onClick={() => removeDraft(index)}>
              ×
            </button>
          </div>
          <label className="field">
            <span className="field-label">Name</span>
            <input type="text" value={draft.customerName} onChange={(e) => updateDraft(index, { customerName: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Address</span>
            <input type="text" value={draft.address} onChange={(e) => updateDraft(index, { address: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Postcode</span>
            <input type="text" value={draft.postcode} onChange={(e) => updateDraft(index, { postcode: e.target.value })} />
          </label>
          <div className="field">
            <span className="field-label">Phone numbers</span>
            {draft.phoneNumbers.length > 0 && (
              <div className="chip-row">
                {draft.phoneNumbers.map((phone, phoneIndex) => (
                  <span key={phoneIndex} className="chip">
                    {phone}
                    <button
                      type="button"
                      className="chip-remove"
                      aria-label={`Remove ${phone}`}
                      onClick={() => removePhoneFromDraft(index, phoneIndex)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              placeholder="Add a phone number and press Enter"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                addPhoneToDraft(index, e.currentTarget.value);
                e.currentTarget.value = "";
              }}
            />
          </div>
          {draft.rawText && (
            <details className="kit-draft-raw">
              <summary>Original text</summary>
              <pre>{draft.rawText}</pre>
            </details>
          )}
        </div>
      ))}

      <button type="button" className="ghost" onClick={() => setDrafts((prev) => [...(prev ?? []), emptyDraftJob()])}>
        + Add a job manually
      </button>

      <div className="entry-editor-actions">
        <button type="button" className="primary" disabled={importing} onClick={() => void handleImport()}>
          {importing ? "Importing…" : `Import ${drafts.filter((d) => d.customerName.trim() || d.address.trim() || d.postcode.trim()).length} job(s)`}
        </button>
        <button type="button" className="ghost" onClick={() => setDrafts(null)}>
          Back to paste
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
