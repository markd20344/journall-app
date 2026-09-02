import type { CSSProperties } from "react";
import type { KitJob } from "../types/kit";
import { deriveStage, kitSummary, STAGE_META } from "../lib/kitStage";
import { followUpMessage, initialContactMessage, smsHref } from "../lib/kitSms";
import { markTexted } from "../db/kitRepo";
import { findPriorJobs, pickHeadlineJob, summarizePriorJob } from "../lib/kitDuplicates";
import { useAllKitJobs } from "../hooks/useKitData";

interface Props {
  job: KitJob;
  onClick?: () => void;
  // Shown as a leading position number when this card is part of an ordered
  // route list — omitted in the plain Jobs list, where order isn't set yet.
  routePosition?: number;
  // "12.3 mi · 22 min from start" — the driving leg into this stop from
  // wherever the route was at before it, shown under the address on the
  // Route tab once a route's been planned.
  legLabel?: string;
}

interface StatusIcon {
  icon: string;
  state: "muted" | "texted" | "replied" | "visited" | "invalid";
  label: string;
}

function phoneStatus(job: KitJob): StatusIcon {
  // Legacy contactAttempts fall back for jobs logged before texted/response
  // replaced per-attempt outcome tracking.
  const replied = Boolean(job.respondedAt) || job.contactAttempts.some((a) => a.outcome === "replied");
  const texted = Boolean(job.textedAt) || job.contactAttempts.length > 0;
  // An actual reply proves the number worked, so it wins over a stale
  // invalid flag someone forgot to clear.
  if (replied) return { icon: "📱", state: "replied", label: "Replied" };
  if (job.numberInvalid) return { icon: "📱", state: "invalid", label: "Number invalid" };
  if (texted) return { icon: "📱", state: "texted", label: "Texted — no reply yet" };
  return { icon: "📱", state: "muted", label: "Not texted yet" };
}

function doorStatus(job: KitJob): StatusIcon {
  if (job.visits.length > 0) return { icon: "🚪", state: "visited", label: "Been to the door" };
  return { icon: "🚪", state: "muted", label: "Not visited yet" };
}

// Once a job is done — kit's collected, it's marked not-going, or it's
// already dropped off — there's nothing left to text anyone about, so the
// Text/Reply buttons just add clutter to an already-settled card.
function isFinished(job: KitJob): boolean {
  return Boolean(job.kitCollected) || job.noVisitNeeded || Boolean(job.droppedOffAt);
}

export default function KitJobCard({ job, onClick, routePosition, legLabel }: Props) {
  const stage = STAGE_META[deriveStage(job)];
  const summary = kitSummary(job);
  const firstPhone = job.phoneNumbers[0];
  const phone = phoneStatus(job);
  const door = doorStatus(job);
  const finished = isFinished(job);
  const allJobs = useAllKitJobs();
  const priorJobs = findPriorJobs(job, allJobs);

  return (
    <div className="kit-job-card">
      {routePosition !== undefined && <span className="kit-route-position">{routePosition}</span>}
      <button type="button" className="kit-job-card-main" onClick={onClick}>
        <div className="kit-job-card-body">
          <div className="kit-job-card-meta">
            {job.jobNumber && <span className="code-badge kit-jobnum-badge">{job.jobNumber}</span>}
            <span className="kit-stage-badge" style={{ "--stage-color": stage.color } as CSSProperties}>
              {stage.label}
            </span>
            {job.needsReschedule && (
              <span className="kit-stage-badge" style={{ "--stage-color": "#ea580c" } as CSSProperties}>
                🔁 Reschedule
              </span>
            )}
            {job.phoneNumbers.length === 0 && <span className="linked-badge">No phone</span>}
            <span className={`kit-status-icon state-${phone.state}`} title={phone.label} aria-label={phone.label}>
              {phone.icon}
            </span>
            <span className={`kit-status-icon state-${door.state}`} title={door.label} aria-label={door.label}>
              {door.icon}
            </span>
          </div>
          <p className="entry-card-body kit-job-card-name">{job.customerName || "Unnamed job"}</p>
          <p className="kit-job-card-address">
            {job.address}
            {job.address && job.postcode ? ", " : ""}
            {job.postcode}
          </p>
          {priorJobs.length > 0 && (
            <p className="kit-prior-warning">
              ⚠️ Seen before — {summarizePriorJob(pickHeadlineJob(priorJobs))}
              {priorJobs.length > 1 ? ` (+${priorJobs.length - 1} more)` : ""}
            </p>
          )}
          {job.noVisitNeeded && job.noVisitReason.trim() && (
            <p className="kit-reason-preview">🚫 {job.noVisitReason.trim()}</p>
          )}
          {job.notes.trim() && <p className="kit-note-preview">📝 {job.notes.trim()}</p>}
          {job.responseNote.trim() && <p className="kit-response-preview">💬 {job.responseNote.trim()}</p>}
          {summary && <p className="dependency-line">🎒 {summary}</p>}
          {legLabel && <p className="dependency-line">🚗 {legLabel}</p>}
        </div>
      </button>
      {firstPhone && !finished && (
        <div className="kit-card-actions">
          <a
            className="kit-card-text-btn"
            href={smsHref(firstPhone, initialContactMessage(job.customerName))}
            onClick={(e) => {
              e.stopPropagation();
              void markTexted(job.id);
            }}
            aria-label={`Send initial text to ${job.customerName || firstPhone}`}
          >
            💬 Text
          </a>
          <a
            className="kit-card-text-btn kit-card-reply-btn"
            href={smsHref(firstPhone, followUpMessage(job.customerName))}
            onClick={(e) => {
              e.stopPropagation();
              void markTexted(job.id);
            }}
            aria-label={`Reply to ${job.customerName || firstPhone}`}
          >
            ↩️ Reply
          </a>
        </div>
      )}
    </div>
  );
}
