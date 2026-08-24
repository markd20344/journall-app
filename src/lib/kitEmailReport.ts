// Builds the plain-text "here's what I collected today" email Mark sends
// to the office at the end of the round — assembled entirely from what's
// already logged against each job (kit collected, door-visit notes,
// contact-attempt outcomes), so there's nothing to re-type.

import type { KitJob } from "../types/kit";

/**
 * The "Collection Outcome" line for a job with no kit collected — a short,
 * fixed phrase built from what's actually logged (texted/replied, door
 * outcome, reschedule flag), deliberately not Mark's own response text or
 * notes verbatim. The office needs to know what happened, not his
 * reasoning — that's what the separate "Note:" line and the in-app
 * response box are for.
 */
function outcomeNarrative(job: KitJob): string {
  const parts: string[] = [];

  if (job.phoneNumbers.length === 0) {
    parts.push(`No telephone number for ${job.customerName || "this contact"}.`);
  }

  // Legacy contactAttempts count toward "contacted"/"responded" for jobs
  // logged before texted/respondedAt existed, so nothing already recorded
  // falls out of the report.
  const contacted = Boolean(job.textedAt) || job.contactAttempts.length > 0;
  const responded = Boolean(job.respondedAt) || job.contactAttempts.some((a) => a.outcome === "replied");
  const lastVisit = job.visits[job.visits.length - 1];

  if (lastVisit) {
    if (lastVisit.outcome === "answered") {
      parts.push(responded ? "Responded, visited — spoke to them." : "Visited — spoke to them.");
    } else if (lastVisit.outcome === "answered_not_home") {
      parts.push(responded ? "Responded, visited — contact not home." : "Visited — contact not home.");
    } else if (responded) {
      parts.push("Responded, visited — no answer.");
    } else if (contacted) {
      parts.push("Contacted, no response. Visited — no answer.");
    } else {
      parts.push("Visited — no answer.");
    }
  } else if (responded) {
    parts.push("Responded to text.");
  } else if (contacted) {
    parts.push("Contacted, no response.");
  }

  parts.push("No kit collected.");
  if (job.needsReschedule) parts.push("Needs to be rescheduled.");
  return parts.join(" ");
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

  if (job.kitCollected) {
    lines.push("Equipment Collected:");
    lines.push("");
    lines.push(...equipmentLines(job));
  } else {
    lines.push(`Collection Outcome: ${outcomeNarrative(job)}`);
  }

  // Anomalies flagged by hand — a duplicate number, a different person
  // answering, "not back until Christmas" — apply regardless of whether
  // kit was collected, and regardless of whether this contact has a phone
  // number on file, so they're appended unconditionally rather than folded
  // into outcomeNarrative (which only runs when there's no kit collected).
  if (job.notes.trim()) {
    lines.push(`Note: ${job.notes.trim()}`);
  }

  return lines.join("\n");
}

/** The full plain-text email body, ready to paste, covering every job passed in — jobs marked "no visit needed" are left out entirely, since there's nothing to report on them. */
export function buildDailySummaryEmail(jobs: KitJob[]): string {
  const intro = "Hi,\n\nPlease find below the details of today's equipment collection visits:";
  const blocks = jobs
    .filter((j) => !j.noVisitNeeded)
    .map(jobBlock)
    .join("\n\n");
  const outro = "Please let me know if you have any queries.\n\nKind regards,\nMark";
  return [intro, blocks, outro].filter(Boolean).join("\n\n");
}
