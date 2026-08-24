import { useMemo, useState } from "react";
import type { KitJob } from "../types/kit";
import { buildDailySummaryEmail } from "../lib/kitEmailReport";
import { setOfficeEmailed } from "../db/kitRepo";
import { showToast } from "../lib/toast";

interface Props {
  jobs: KitJob[];
  batchDate: string;
  onClose: () => void;
}

export default function KitDailySummaryPanel({ jobs, batchDate, onClose }: Props) {
  const emailText = useMemo(() => buildDailySummaryEmail(jobs), [jobs]);
  const [copying, setCopying] = useState(false);
  // Jobs marked "no visit needed" are left out of the email entirely, so
  // they shouldn't get marked as included in it either.
  const includedJobs = jobs.filter((j) => !j.noVisitNeeded);
  const excludedCount = jobs.length - includedJobs.length;

  async function handleCopy() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(emailText);
      await Promise.all(includedJobs.map((j) => setOfficeEmailed(j.id, true)));
      showToast(`Copied — ${includedJobs.length} job${includedJobs.length === 1 ? "" : "s"} marked as included in the office email`);
    } catch {
      showToast("Couldn't copy — try selecting the text manually");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Daily summary — {batchDate}</h1>
      <p className="settings-hint">
        Covers {includedJobs.length} job{includedJobs.length === 1 ? "" : "s"} for this date
        {excludedCount > 0 ? ` (${excludedCount} marked "no visit needed" left out)` : ""}. Copy it into your email to
        the office — copying also marks every job here as included in today's office email.
      </p>
      <textarea className="entry-body kit-summary-textarea" readOnly value={emailText} rows={20} />
      <div className="entry-editor-actions">
        <button type="button" className="primary" disabled={copying} onClick={() => void handleCopy()}>
          📋 Copy email
        </button>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
