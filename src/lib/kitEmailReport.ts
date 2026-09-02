// Builds the plain-text "here's what I collected today" email Mark sends
// to the office at the end of the round — assembled entirely from what's
// already logged against each job (kit collected, door-visit outcome,
// texted/response state), so there's nothing to re-type. Written as one
// continuous, plain-English paragraph per job rather than labelled fields
// ("Outcome:", "Note:") — it's meant to read like Mark wrote it himself.

import type { KitJob } from "../types/kit";

/**
 * The outcome paragraph for a job with no kit collected — built purely
 * from what's actually logged (texted/replied/invalid number, door
 * outcome, reschedule flag), in plain sentences rather than Mark's own
 * response text verbatim. His actual notes are still folded in at the end
 * (see jobBlock) since those are his own words already and worth keeping,
 * just not under a "Note:" label.
 */
function outcomeNarrative(job: KitJob): string {
  const sentences: string[] = [];

  if (job.phoneNumbers.length === 0) {
    sentences.push(`No telephone number on file for ${job.customerName || "this contact"}.`);
  }

  // Legacy contactAttempts count toward "contacted"/"responded" for jobs
  // logged before texted/respondedAt existed, so nothing already recorded
  // falls out of the report.
  const contacted = Boolean(job.textedAt) || job.contactAttempts.length > 0;
  const responded = Boolean(job.respondedAt) || job.contactAttempts.some((a) => a.outcome === "replied");
  const lastVisit = job.visits[job.visits.length - 1];

  if (job.numberInvalid) {
    sentences.push("Sent a text but the number was invalid.");
  } else if (responded) {
    sentences.push("Sent a text and got a response.");
  } else if (contacted) {
    sentences.push("Sent a text but had no response.");
  }

  if (lastVisit) {
    if (lastVisit.outcome === "answered") {
      sentences.push("Went to the property and spoke to them.");
    } else if (lastVisit.outcome === "answered_not_home") {
      sentences.push("Went to the property but they weren't home — someone else answered.");
    } else {
      sentences.push("Went to the property but there was no answer.");
    }
  }

  sentences.push("No kit collected.");
  if (job.needsReschedule) sentences.push("Will need to revisit.");
  return sentences.join(" ");
}

/** The line for a job marked "not going" — included in the email (unlike route planning, which still skips it) so the office knows why, in Mark's own reason rather than the job just vanishing from the report. */
function notGoingNarrative(job: KitJob): string {
  const reason = job.noVisitReason.trim();
  return reason ? `Customer requested I don't visit — ${reason}.` : "Customer requested I don't visit.";
}

/** "Phone x1" / "Plates x2" / … one line per item actually logged, plus whatever's in "Other" verbatim. */
function equipmentLines(job: KitJob): string[] {
  const kit = job.kitCollected;
  if (!kit) return [];
  const lines: string[] = [];
  if (kit.rucksack) lines.push("Rucksack x1");
  if (kit.tablets > 0) lines.push(`Tablet x${kit.tablets}`);
  if (kit.phones > 0) lines.push(`Phone x${kit.phones}`);
  if (kit.fuelCards > 0) lines.push(`Fuel Cards x${kit.fuelCards}`);
  if (kit.idCards > 0) lines.push(`ID x${kit.idCards}`);
  if (kit.numberPlates > 0) lines.push(`Plates x${kit.numberPlates}`);
  if (kit.other.trim()) lines.push(kit.other.trim());
  return lines;
}

function jobBlock(job: KitJob): string {
  const lines: string[] = [];
  lines.push(`Job Number: ${job.jobNumber || "—"}`);
  lines.push(`Name: ${job.customerName || "Unknown"}`);
  lines.push(`Address: ${[job.address, job.postcode].filter(Boolean).join(", ") || "—"}`);
  if (job.phoneNumbers.length > 0) lines.push(`Tel: ${job.phoneNumbers.join(", ")}`);

  // Anomalies flagged by hand — a duplicate number, a different person
  // answering, "not back until Christmas" — are Mark's own words already,
  // so they're folded straight into the same paragraph as whatever else is
  // being said about this job, rather than sitting under their own "Note:"
  // label.
  const notes = job.notes.trim();

  if (job.noVisitNeeded) {
    lines.push([notGoingNarrative(job), notes].filter(Boolean).join(" "));
  } else if (job.kitCollected) {
    lines.push("Equipment Collected:");
    lines.push("");
    lines.push(...equipmentLines(job));
    if (notes) lines.push(notes);
  } else {
    lines.push([outcomeNarrative(job), notes].filter(Boolean).join(" "));
  }

  return lines.join("\n");
}

/** The full plain-text email body, ready to paste, covering every job passed in — including ones marked "not going", so the office sees why rather than the job just disappearing from the report. */
export function buildDailySummaryEmail(jobs: KitJob[]): string {
  const intro = "Hi,\n\nPlease find below the details of today's equipment collection visits:";
  const blocks = jobs.map(jobBlock).join("\n\n");
  const outro = "Please let me know if you have any queries.\n\nKind regards,\nMark";
  return [intro, blocks, outro].filter(Boolean).join("\n\n");
}
