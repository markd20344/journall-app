// Jobs are re-created fresh from each day's import — nothing links "Dave
// Smith" on Tuesday's sheet to the "Dave Smith" who was already texted (and
// said no) on Monday's. That's how the same person ends up getting texted
// two or three times over, which is the whole reason this exists: catch a
// repeat contact before the text goes out, not after.

import type { KitJob } from "../types/kit";
import { DOOR_VISIT_OUTCOME_META } from "./kitStage";

function normalizedPhones(phones: string[]): Set<string> {
  return new Set(phones.map((p) => p.replace(/\D/g, "")).filter(Boolean));
}

/**
 * Other jobs (any date, any batch) that look like the same person — a
 * shared phone number is the strong signal; an exact name match is the
 * fallback for a job with no phone number recorded. Sorted most-recent
 * first. `candidate` takes a plain shape rather than a full KitJob so it
 * also works against an unsaved import draft.
 */
export function findPriorJobs(
  candidate: { id?: string; phoneNumbers: string[]; customerName: string },
  allJobs: KitJob[],
): KitJob[] {
  const phones = normalizedPhones(candidate.phoneNumbers);
  const name = candidate.customerName.trim().toLowerCase();

  return allJobs
    .filter((j) => j.id !== candidate.id)
    .filter((j) => {
      if (phones.size > 0 && j.phoneNumbers.some((p) => phones.has(p.replace(/\D/g, "")))) return true;
      return name.length > 0 && j.customerName.trim().toLowerCase() === name;
    })
    .sort((a, b) => b.batchDate.localeCompare(a.batchDate));
}

// Higher = more worth surfacing as the headline match. A bare "texted
// today, nothing else logged yet" sighting shouldn't bury an older one
// that actually explains why not to bother them again.
function informativeness(job: KitJob): number {
  if (job.noVisitNeeded) return 5;
  if (job.kitCollected) return 4;
  if (job.visits.length > 0) return 3;
  if (job.respondedAt || job.numberInvalid) return 2;
  if (job.textedAt) return 1;
  return 0;
}

/** The single most worth-mentioning prior match — most informative first, most recent as the tiebreaker. Use findPriorJobs's own order for a full history list; use this for a one-line headline. */
export function pickHeadlineJob(priorJobs: KitJob[]): KitJob {
  return [...priorJobs].sort((a, b) => informativeness(b) - informativeness(a) || b.batchDate.localeCompare(a.batchDate))[0];
}

/** A short "what happened last time" line — the actual reason/response, not just a stage label, since that's the whole point of the warning. */
export function summarizePriorJob(job: KitJob): string {
  if (job.noVisitNeeded) {
    return job.noVisitReason.trim() ? `Not going (${job.batchDate}) — ${job.noVisitReason.trim()}` : `Not going (${job.batchDate})`;
  }
  if (job.kitCollected) {
    return `Kit collected (${job.batchDate})`;
  }
  const lastVisit = job.visits[job.visits.length - 1];
  if (lastVisit) {
    return `${DOOR_VISIT_OUTCOME_META[lastVisit.outcome].label} at the door (${job.batchDate})`;
  }
  if (job.numberInvalid) {
    return `Number was invalid (${job.batchDate})`;
  }
  if (job.respondedAt && job.responseNote.trim()) {
    return `Replied (${job.batchDate}): "${job.responseNote.trim()}"`;
  }
  if (job.textedAt) {
    return `Texted, no reply (${job.batchDate})`;
  }
  return `On the list (${job.batchDate})`;
}
