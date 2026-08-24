import type { CSSProperties } from "react";
import type { KitJob } from "../types/kit";
import { deriveStage, kitSummary, STAGE_META } from "../lib/kitStage";
import { followUpMessage, initialContactMessage, smsHref } from "../lib/kitSms";

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
  state: "muted" | "texted" | "replied" | "visited";
  label: string;
}

function phoneStatus(job: KitJob): StatusIcon {
  const replied = job.contactAttempts.some((a) => a.outcome === "replied");
  const texted = job.contactAttempts.length > 0;
  if (replied) return { icon: "📱", state: "replied", label: "Replied to text" };
  if (texted) return { icon: "📱", state: "texted", label: "Texted — no reply yet" };
  return { icon: "📱", state: "muted", label: "Not texted yet" };
}

function doorStatus(job: KitJob): StatusIcon {
  if (job.visits.length > 0) return { icon: "🚪", state: "visited", label: "Been to the door" };
  return { icon: "🚪", state: "muted", label: "Not visited yet" };
}

export default function KitJobCard({ job, onClick, routePosition, legLabel }: Props) {
  const stage = STAGE_META[deriveStage(job)];
  const summary = kitSummary(job);
  const firstPhone = job.phoneNumbers[0];
  const phone = phoneStatus(job);
  const door = doorStatus(job);

  return (
    <div className="kit-job-card">
      {routePosition !== undefined && <span className="kit-route-position">{routePosition}</span>}
      <button type="button" className="kit-job-card-main" onClick={onClick}>
        <div className="kit-job-card-body">
          <div className="kit-job-card-meta">
            {job.jobNumber && <span className="code-badge">{job.jobNumber}</span>}
            <span className="kit-stage-badge" style={{ "--stage-color": stage.color } as CSSProperties}>
              {stage.label}
            </span>
            {job.phoneNumbers.length > 0 && (
              <span className="linked-badge">
                {job.phoneNumbers.length} phone{job.phoneNumbers.length === 1 ? "" : "s"}
              </span>
            )}
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
          {job.notes.trim() && <p className="kit-note-preview">📝 {job.notes.trim()}</p>}
          {summary && <p className="dependency-line">🎒 {summary}</p>}
          {legLabel && <p className="dependency-line">🚗 {legLabel}</p>}
        </div>
      </button>
      {firstPhone && (
        <div className="kit-card-actions">
          <a
            className="kit-card-text-btn"
            href={smsHref(firstPhone, initialContactMessage(job.customerName))}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Send initial text to ${job.customerName || firstPhone}`}
          >
            💬 Text
          </a>
          <a
            className="kit-card-text-btn kit-card-reply-btn"
            href={smsHref(firstPhone, followUpMessage(job.customerName))}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Reply to ${job.customerName || firstPhone}`}
          >
            ↩️ Reply
          </a>
        </div>
      )}
    </div>
  );
}
