import type { ContactOutcome, DoorVisitOutcome, JobStage, KitJob } from "../types/kit";

/**
 * The job's life-cycle stage, worked out from what's actually recorded
 * against it rather than a separate field to keep in sync by hand. Follows
 * the real-world order: contacted → visited → kit collected → office
 * emailed → dropped off at Corby. A job can skip straight past "contacted"
 * or "visited" (e.g. logging kit collected before backfilling a contact
 * attempt) — this just reports the furthest stage reached.
 */
export function deriveStage(job: KitJob): JobStage {
  // A manual override — checked first since it means the rest of the
  // pipeline simply doesn't apply to this job anymore.
  if (job.noVisitNeeded) return "no_visit_needed";
  if (job.droppedOffAt) return "dropped_off";
  if (job.officeEmailedAt) return "emailed";
  if (job.kitCollected) return "collected";
  if (job.visits.length > 0) return "visited";
  if (job.textedAt || job.respondedAt || job.contactAttempts.length > 0) return "contacted";
  return "new";
}

export interface StageMeta {
  stage: JobStage;
  label: string;
  color: string;
}

export const STAGE_META: Record<JobStage, StageMeta> = {
  new: { stage: "new", label: "New", color: "#6b7280" },
  contacted: { stage: "contacted", label: "Contacted", color: "#2563eb" },
  visited: { stage: "visited", label: "Visited", color: "#7c3aed" },
  collected: { stage: "collected", label: "Kit collected", color: "#16a34a" },
  emailed: { stage: "emailed", label: "Office emailed", color: "#0d9488" },
  dropped_off: { stage: "dropped_off", label: "Dropped off", color: "#15803d" },
  no_visit_needed: { stage: "no_visit_needed", label: "No visit needed", color: "#9ca3af" },
};

// Display order for stage-grouped views — earliest-in-the-pipeline first,
// same convention as ITEM_KINDS' fixed display order.
export const STAGE_ORDER: JobStage[] = ["new", "contacted", "visited", "collected", "emailed", "dropped_off", "no_visit_needed"];

export interface ContactOutcomeMeta {
  outcome: ContactOutcome;
  label: string;
  color: string;
}

export const CONTACT_OUTCOME_META: Record<ContactOutcome, ContactOutcomeMeta> = {
  no_response: { outcome: "no_response", label: "No response", color: "#6b7280" },
  disconnected: { outcome: "disconnected", label: "Number disconnected", color: "#b91c1c" },
  delivered_no_reply: { outcome: "delivered_no_reply", label: "Delivered, no reply", color: "#d97706" },
  replied: { outcome: "replied", label: "Replied", color: "#16a34a" },
};

export const CONTACT_OUTCOME_ORDER: ContactOutcome[] = ["no_response", "disconnected", "delivered_no_reply", "replied"];

export interface DoorVisitOutcomeMeta {
  outcome: DoorVisitOutcome;
  label: string;
  color: string;
}

export const DOOR_VISIT_OUTCOME_META: Record<DoorVisitOutcome, DoorVisitOutcomeMeta> = {
  answered: { outcome: "answered", label: "Answered", color: "#16a34a" },
  no_answer: { outcome: "no_answer", label: "No answer", color: "#d97706" },
};

/** A short summary of what came back, e.g. "Rucksack, 2 fuel cards, tablet". */
export function kitSummary(job: KitJob): string {
  const kit = job.kitCollected;
  if (!kit) return "";
  const parts: string[] = [];
  if (kit.rucksack) parts.push("Rucksack");
  if (kit.tablets > 0) parts.push(kit.tablets === 1 ? "Tablet" : `${kit.tablets} tablets`);
  if (kit.phones > 0) parts.push(kit.phones === 1 ? "Phone" : `${kit.phones} phones`);
  if (kit.fuelCards > 0) parts.push(`${kit.fuelCards} fuel card${kit.fuelCards === 1 ? "" : "s"}`);
  if (kit.idCards > 0) parts.push(`${kit.idCards} ID card${kit.idCards === 1 ? "" : "s"}`);
  if (kit.numberPlates > 0) parts.push(`${kit.numberPlates} number plate${kit.numberPlates === 1 ? "" : "s"}`);
  if (kit.other.trim()) parts.push(kit.other.trim());
  return parts.length > 0 ? parts.join(", ") : "Nothing recorded";
}
