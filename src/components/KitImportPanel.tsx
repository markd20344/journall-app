import { Fragment, useState } from "react";
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

function phonesToText(phones: string[]): string {
  return phones.join(", ");
}

function textToPhones(text: string): string[] {
  return text
    .split(/[,;]|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function isUsableDraft(d: DraftKitJob): boolean {
  return Boolean(d.customerName.trim() || d.address.trim() || d.postcode.trim());
}

export default function KitImportPanel({ onImported, onCancel }: Props) {
  const [emailText, setEmailText] = useState("");
  const [batchDate, setBatchDate] = useState(tomorrow());
  const [drafts, setDrafts] = useState<DraftKitJob[] | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  function handleParse() {
    const parsed = parseKitEmail(emailText);
    setDrafts(parsed.length > 0 ? parsed : [emptyDraftJob()]);
    setExpanded(new Set());
  }

  function updateDraft(index: number, changes: Partial<DraftKitJob>) {
    setDrafts((prev) => (prev ? prev.map((d, i) => (i === index ? { ...d, ...changes } : d)) : prev));
  }

  function removeDraft(index: number) {
    setDrafts((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  function toggleExpanded(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleImport() {
    if (!drafts) return;
    const usable = drafts.filter(isUsableDraft);
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
          <span className="field-label">Paste the driver work sheet</span>
          <textarea
            className="entry-body kit-import-textarea"
            placeholder="Paste the day's 'Driver Work and StartTimes' sheet here — junk, boilerplate and all. It'll be split into jobs and you'll get a chance to fix anything before it's saved."
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            rows={14}
          />
        </label>
        <div className="entry-editor-actions">
          <button type="button" className="primary" disabled={!emailText.trim()} onClick={handleParse}>
            Parse
          </button>
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const usableCount = drafts.filter(isUsableDraft).length;

  return (
    <div className="kit-import-panel">
      <label className="field">
        <span className="field-label">Visit date</span>
        <input type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} />
      </label>
      <p className="settings-hint">
        Found {drafts.length} job{drafts.length === 1 ? "" : "s"}. Check the details below — the split is a best guess, so
        fix anything that's wrong or remove a row that isn't really a job.
      </p>

      <div className="kit-draft-table-wrap">
        <table className="kit-draft-table">
          <thead>
            <tr>
              <th>Job #</th>
              <th>Name</th>
              <th>Address</th>
              <th>Postcode</th>
              <th>Phone(s)</th>
              <th>Notes</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft, index) => (
              <Fragment key={index}>
                <tr>
                  <td>
                    <input
                      type="text"
                      value={draft.jobNumber}
                      onChange={(e) => updateDraft(index, { jobNumber: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={draft.customerName}
                      onChange={(e) => updateDraft(index, { customerName: e.target.value })}
                    />
                  </td>
                  <td>
                    <input type="text" value={draft.address} onChange={(e) => updateDraft(index, { address: e.target.value })} />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="kit-draft-postcode-input"
                      value={draft.postcode}
                      onChange={(e) => updateDraft(index, { postcode: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={phonesToText(draft.phoneNumbers)}
                      onChange={(e) => updateDraft(index, { phoneNumbers: textToPhones(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input type="text" value={draft.notes} onChange={(e) => updateDraft(index, { notes: e.target.value })} />
                  </td>
                  <td className="kit-draft-actions-cell">
                    {draft.rawText && (
                      <button type="button" className="chip-remove" aria-label="Show original text" onClick={() => toggleExpanded(index)}>
                        {expanded.has(index) ? "▲" : "▾"}
                      </button>
                    )}
                    <button type="button" className="chip-remove" aria-label="Remove this job" onClick={() => removeDraft(index)}>
                      ×
                    </button>
                  </td>
                </tr>
                {expanded.has(index) && draft.rawText && (
                  <tr>
                    <td colSpan={7} className="kit-draft-raw-cell">
                      <pre>{draft.rawText}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" className="ghost" onClick={() => setDrafts((prev) => [...(prev ?? []), emptyDraftJob()])}>
        + Add a job manually
      </button>

      <div className="entry-editor-actions">
        <button type="button" className="primary" disabled={importing || usableCount === 0} onClick={() => void handleImport()}>
          {importing ? "Importing…" : `Import ${usableCount} job(s)`}
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
