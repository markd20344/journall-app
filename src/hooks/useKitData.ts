import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { KitJob } from "../types/kit";
import { usePendingDeleteIds } from "../lib/pendingDelete";

function byRouteThenCreatedAt(a: KitJob, b: KitJob): number {
  if (a.routeOrder !== null && b.routeOrder !== null) return a.routeOrder - b.routeOrder;
  if (a.routeOrder !== null) return -1;
  if (b.routeOrder !== null) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}

export function useAllKitJobs(): KitJob[] {
  const jobs = useLiveQuery(() => db.kitJobs.toArray(), [], []) ?? [];
  const pendingIds = usePendingDeleteIds("kitJob");
  const visible = pendingIds.size === 0 ? jobs : jobs.filter((j) => !pendingIds.has(j.id));
  return [...visible].sort((a, b) => (a.batchDate !== b.batchDate ? b.batchDate.localeCompare(a.batchDate) : byRouteThenCreatedAt(a, b)));
}

export function useKitJobsForDate(batchDate: string): KitJob[] {
  const jobs = useLiveQuery(() => db.kitJobs.where("batchDate").equals(batchDate).toArray(), [batchDate], []) ?? [];
  const pendingIds = usePendingDeleteIds("kitJob");
  const visible = pendingIds.size === 0 ? jobs : jobs.filter((j) => !pendingIds.has(j.id));
  return [...visible].sort(byRouteThenCreatedAt);
}

/** Every distinct batchDate that has jobs, most recent first — powers the day picker. */
export function useKitBatchDates(): string[] {
  const jobs = useAllKitJobs();
  return Array.from(new Set(jobs.map((j) => j.batchDate))).sort((a, b) => b.localeCompare(a));
}

/** Kit that's been collected but not yet dropped off at BCA Corby — across all days. */
export function usePendingDropOff(): KitJob[] {
  const jobs = useAllKitJobs();
  return jobs.filter((j) => j.kitCollected && !j.droppedOffAt);
}
