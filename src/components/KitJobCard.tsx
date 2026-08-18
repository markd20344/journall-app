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
}

export default function KitJobCard({ job, onClick, routePosition }: Props) {
  const stage = STAGE_META[deriveStage(job)];
  const summary = kitSummary(job);
  const firstPhone = job.phoneNumbers[0];

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
          </div>
          <p className="entry-card-body kit-job-card-name">{job.customerName || "Unnamed job"}</p>
          <p className="kit-job-card-address">
            {job.address}
            {job.address && job.postcode ? ", " : ""}
            {job.postcode}
          </p>
          {summary && <p className="dependency-line">🎒 {summary}</p>}
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
