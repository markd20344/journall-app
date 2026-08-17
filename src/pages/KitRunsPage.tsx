import { useState } from "react";
import { addDays, format } from "date-fns";
import type { KitJob } from "../types/kit";
import { createKitJob, markDroppedOff } from "../db/kitRepo";
import { useKitBatchDates, useKitJobsForDate, usePendingDropOff } from "../hooks/useKitData";
import { showToast } from "../lib/toast";
import KitJobCard from "../components/KitJobCard";
import KitJobEditor from "../components/KitJobEditor";
import KitImportPanel from "../components/KitImportPanel";
import KitRouteView from "../components/KitRouteView";

type SubView = "jobs" | "route";

function tomorrow(): string {
  return format(addDays(new Date(), 1), "yyyy-MM-dd");
}

export default function KitRunsPage() {
  const [subView, setSubView] = useState<SubView>("jobs");
  const [selectedDate, setSelectedDate] = useState(tomorrow());
  const [editingJob, setEditingJob] = useState<KitJob | null>(null);
  const [importing, setImporting] = useState(false);

  const jobsForDate = useKitJobsForDate(selectedDate);
  const batchDates = useKitBatchDates();
  const pendingDropOff = usePendingDropOff();

  async function handleAddManually() {
    const job = await createKitJob({ batchDate: selectedDate, customerName: "", address: "", postcode: "" });
    setEditingJob(job);
  }

  async function handleMarkAllDroppedOff() {
    await markDroppedOff(pendingDropOff.map((j) => j.id));
    showToast(`Marked ${pendingDropOff.length} job(s) dropped off at Corby`);
  }

  if (editingJob) {
    return (
      <div className="page">
        <KitJobEditor
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onDeleted={() => setEditingJob(null)}
        />
      </div>
    );
  }

  if (importing) {
    return (
      <div className="page">
        <h1 className="page-title">Import jobs</h1>
        <KitImportPanel onImported={() => setImporting(false)} onCancel={() => setImporting(false)} />
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Kit Runs</h1>
      <p className="settings-hint">
        Paste the daily job email, plan the route, and track each job from first text through to dropping the kit off at
        Corby.
      </p>

      <nav className="kit-subnav">
        <button type="button" className={`nav-btn ${subView === "jobs" ? "active" : ""}`} onClick={() => setSubView("jobs")}>
          Jobs
        </button>
        <button type="button" className={`nav-btn ${subView === "route" ? "active" : ""}`} onClick={() => setSubView("route")}>
          Route
        </button>
      </nav>

      {pendingDropOff.length > 0 && (
        <div className="kit-dropoff-banner">
          <span>
            {pendingDropOff.length} job{pendingDropOff.length === 1 ? "" : "s"} collected and ready to drop off at BCA
            Corby.
          </span>
          <button type="button" className="ghost" onClick={() => void handleMarkAllDroppedOff()}>
            Mark all dropped off
          </button>
        </div>
      )}

      <div className="kit-date-row">
        <label className="field">
          <span className="field-label">Visit date</span>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </label>
        {batchDates.length > 0 && (
          <div className="chip-row">
            {batchDates.map((d) => (
              <button
                key={d}
                type="button"
                className={`kit-date-chip ${d === selectedDate ? "active" : ""}`}
                onClick={() => setSelectedDate(d)}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {subView === "jobs" ? (
        <>
          <div className="entry-editor-actions">
            <button type="button" className="primary" onClick={() => setImporting(true)}>
              + Import from email
            </button>
            <button type="button" className="ghost" onClick={() => void handleAddManually()}>
              + Add job manually
            </button>
          </div>
          <p className="result-count">
            {jobsForDate.length} job{jobsForDate.length === 1 ? "" : "s"} for {selectedDate}
          </p>
          <div className="entry-list">
            {jobsForDate.map((job) => (
              <KitJobCard key={job.id} job={job} onClick={() => setEditingJob(job)} />
            ))}
            {jobsForDate.length === 0 && <p className="empty-hint">Nothing here yet — import the day's email to get started.</p>}
          </div>
        </>
      ) : (
        <KitRouteView batchDate={selectedDate} onOpenJob={setEditingJob} />
      )}
    </div>
  );
}
