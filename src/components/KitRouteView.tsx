import { useState, type DragEvent } from "react";
import type { KitJob } from "../types/kit";
import { applyRouteOrder, setJobGeo, setRouteOrder } from "../db/kitRepo";
import {
  computeRouteLegs,
  geocodePostcodes,
  geocodeSinglePostcode,
  getCurrentLocation,
  nearestNeighborOrder,
  orderByRoadTrip,
  straightLineRouteLegs,
  type FullRoutePlan,
  type GeoPoint,
} from "../lib/kitRoute";
import { getHomeBasePostcode, setHomeBasePostcode } from "../lib/kitHomeBase";
import { useKitJobsForDate } from "../hooks/useKitData";
import { showToast } from "../lib/toast";
import KitJobCard from "./KitJobCard";
import Dropdown from "./Dropdown";

interface Props {
  batchDate: string;
  onOpenJob: (job: KitJob) => void;
}

type StartMode = "postcode" | "location" | "job";

function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export default function KitRouteView({ batchDate, onOpenJob }: Props) {
  const allJobs = useKitJobsForDate(batchDate);
  // Jobs marked "no visit needed" don't belong in the route at all — they
  // stay visible on the Jobs tab, but there's nowhere to drive to.
  const jobs = allJobs.filter((j) => !j.noVisitNeeded);
  const excludedCount = allJobs.length - jobs.length;
  const savedHomeBase = getHomeBasePostcode();
  const [startMode, setStartMode] = useState<StartMode>(savedHomeBase ? "postcode" : "location");
  const [startPostcode, setStartPostcode] = useState(savedHomeBase);
  const [startJobId, setStartJobId] = useState(jobs[0]?.id ?? "");
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // The last-computed leg-by-leg plan, and the start point it was computed
  // from (so a manual drag-reorder can recompute legs for the new order
  // without asking "start from" all over again).
  const [plan, setPlan] = useState<FullRoutePlan | null>(null);
  const [planIsEstimate, setPlanIsEstimate] = useState(false);
  const [lastStart, setLastStart] = useState<GeoPoint | null>(null);

  // Stale if the job list has changed shape since the plan was computed
  // (a job added/removed/skipped) — legs wouldn't line up with cards.
  const validPlan = plan && plan.legs.length === jobs.length + 1 ? plan : null;

  async function resolveStart(): Promise<GeoPoint> {
    if (startMode === "location") return getCurrentLocation();
    if (startMode === "postcode") {
      const geo = await geocodeSinglePostcode(startPostcode);
      if (!geo) throw new Error(`Couldn't find postcode "${startPostcode}"`);
      return geo;
    }
    const startJob = jobs.find((j) => j.id === startJobId);
    if (!startJob) throw new Error("Pick a job to start from");
    if (startJob.lat !== null && startJob.lng !== null) return { lat: startJob.lat, lng: startJob.lng };
    const geo = await geocodeSinglePostcode(startJob.postcode);
    if (!geo) throw new Error(`Couldn't find a postcode for ${startJob.customerName || "that job"}`);
    void setJobGeo(startJob.id, geo.lat, geo.lng);
    return geo;
  }

  function saveHomeBase() {
    if (!startPostcode.trim()) return;
    setHomeBasePostcode(startPostcode);
    showToast(`Saved "${startPostcode.trim()}" as your home base`);
  }

  async function handleOptimize() {
    setComputing(true);
    setError(null);
    try {
      const start = await resolveStart();

      const needGeocode = jobs.filter((j) => (j.lat === null || j.lng === null) && j.postcode.trim());
      const geoMap =
        needGeocode.length > 0 ? await geocodePostcodes(needGeocode.map((j) => j.postcode)) : new Map<string, GeoPoint | null>();

      const pointById = new Map<string, GeoPoint>();
      for (const job of jobs) {
        if (job.lat !== null && job.lng !== null) {
          pointById.set(job.id, { lat: job.lat, lng: job.lng });
          continue;
        }
        const geo = geoMap.get(job.postcode.trim().toUpperCase());
        if (geo) pointById.set(job.id, geo);
      }
      void Promise.all(
        needGeocode.map((job) => {
          const geo = pointById.get(job.id);
          return geo ? setJobGeo(job.id, geo.lat, geo.lng) : Promise.resolve();
        }),
      );

      const stops = jobs.filter((j) => pointById.has(j.id)).map((j) => ({ id: j.id, point: pointById.get(j.id)! }));
      const skipped = jobs.filter((j) => !pointById.has(j.id));
      if (stops.length === 0) throw new Error("None of these jobs have a postcode that could be found — check them and try again");

      // Real road distance/duration first (petrol, mileage, time actually
      // driven) — the public routing service is best-effort, so fall back
      // to straight-line ordering if it's unavailable rather than failing.
      const roadTrip = await orderByRoadTrip(start, stops);
      const orderedIds = roadTrip?.order ?? nearestNeighborOrder(start, stops);
      await applyRouteOrder(orderedIds);
      if (skipped.length > 0) {
        await Promise.all(skipped.map((j) => setRouteOrder(j.id, null)));
        setPlan(null);
      } else {
        const orderedPoints = orderedIds.map((id) => pointById.get(id)!);
        const roadLegs = await computeRouteLegs(start, orderedPoints);
        const finalPlan = roadLegs ?? straightLineRouteLegs(start, orderedPoints);
        setPlan(finalPlan);
        setPlanIsEstimate(!roadLegs);
        setLastStart(start);
      }

      const skippedNote = skipped.length > 0 ? ` — ${skipped.length} couldn't be found by postcode` : "";
      const totalsFromRoadTrip = roadTrip
        ? `approx ${roadTrip.distanceMiles.toFixed(1)} mi, ${formatDuration(roadTrip.durationMinutes)} driving`
        : null;
      showToast(
        totalsFromRoadTrip
          ? `Ordered ${orderedIds.length} stops — ${totalsFromRoadTrip}${skippedNote}`
          : `Ordered ${orderedIds.length} stops by straight-line distance (road routing unavailable)${skippedNote}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't plan the route");
    } finally {
      setComputing(false);
    }
  }

  async function recomputeLegsForOrder(orderedJobs: KitJob[]) {
    if (!lastStart) return;
    const points: GeoPoint[] = [];
    for (const j of orderedJobs) {
      if (j.lat === null || j.lng === null) {
        setPlan(null);
        return;
      }
      points.push({ lat: j.lat, lng: j.lng });
    }
    const roadLegs = await computeRouteLegs(lastStart, points);
    const finalPlan = roadLegs ?? straightLineRouteLegs(lastStart, points);
    setPlan(finalPlan);
    setPlanIsEstimate(!roadLegs);
  }

  function handleDragStart(index: number) {
    return (e: DragEvent) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = "move";
    };
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function handleDrop(index: number) {
    return () => {
      if (dragIndex === null || dragIndex === index) {
        setDragIndex(null);
        return;
      }
      const reordered = [...jobs];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(index, 0, moved);
      setDragIndex(null);
      void applyRouteOrder(reordered.map((j) => j.id));
      void recomputeLegsForOrder(reordered);
    };
  }

  // iOS Safari has never supported the native HTML5 drag-and-drop API for
  // touch — the draggable/onDragStart wiring above only ever works with a
  // mouse. These buttons are the real reorder mechanism on a phone.
  function moveJob(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= jobs.length) return;
    const reordered = [...jobs];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    void applyRouteOrder(reordered.map((j) => j.id));
    void recomputeLegsForOrder(reordered);
  }

  if (allJobs.length === 0) {
    return <p className="empty-hint">No jobs for {batchDate} yet — import the email or add one on the Jobs tab.</p>;
  }
  if (jobs.length === 0) {
    return <p className="empty-hint">Every job for {batchDate} is marked "not going" — nothing left to route.</p>;
  }

  return (
    <div className="kit-route-view">
      <div className="kit-route-controls">
        <span className="field-label">Start from</span>
        <Dropdown
          value={startMode}
          onChange={(v) => setStartMode(v as StartMode)}
          options={[
            { value: "postcode", label: "A postcode (your home base)" },
            { value: "location", label: "My current location" },
            { value: "job", label: "One of today's jobs" },
          ]}
        />
        {startMode === "postcode" && (
          <>
            <input type="text" placeholder="e.g. NN1 1AA" value={startPostcode} onChange={(e) => setStartPostcode(e.target.value)} />
            <button type="button" className="ghost" onClick={saveHomeBase} disabled={!startPostcode.trim()}>
              📌 Save as home base
            </button>
          </>
        )}
        {startMode === "job" && (
          <Dropdown
            value={startJobId}
            onChange={setStartJobId}
            options={jobs.map((j) => ({ value: j.id, label: j.customerName || j.postcode || "Unnamed job" }))}
          />
        )}
        <button type="button" className="primary" disabled={computing} onClick={() => void handleOptimize()}>
          {computing ? "Planning…" : "Order route"}
        </button>
      </div>
      {error && <p className="auth-error">{error}</p>}
      <p className="settings-hint small">Use ▲▼ to reorder a card by hand.</p>
      {excludedCount > 0 && (
        <p className="settings-hint small">
          {excludedCount} job{excludedCount === 1 ? "" : "s"} marked "not going" left out of the route.
        </p>
      )}

      {validPlan && (
        <div className="kit-route-totals">
          <span>
            🚗 Total driving: {validPlan.totalDistanceMiles.toFixed(1)} mi · {formatDuration(validPlan.totalDurationMinutes)}
            {planIsEstimate ? " (straight-line estimate)" : ""}
          </span>
        </div>
      )}

      <div className="entry-list">
        {jobs.map((job, index) => (
          <div
            key={job.id}
            draggable
            onDragStart={handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={handleDrop(index)}
            className={`kit-route-drag-row ${dragIndex === index ? "dragging" : ""}`}
          >
            <div className="kit-reorder-btns">
              <button
                type="button"
                className="kit-reorder-btn"
                disabled={index === 0}
                onClick={() => moveJob(index, -1)}
                aria-label={`Move ${job.customerName || "this job"} up`}
              >
                ▲
              </button>
              <button
                type="button"
                className="kit-reorder-btn"
                disabled={index === jobs.length - 1}
                onClick={() => moveJob(index, 1)}
                aria-label={`Move ${job.customerName || "this job"} down`}
              >
                ▼
              </button>
            </div>
            <KitJobCard
              job={job}
              routePosition={index + 1}
              onClick={() => onOpenJob(job)}
              legLabel={
                validPlan
                  ? `${validPlan.legs[index].distanceMiles.toFixed(1)} mi · ${formatDuration(validPlan.legs[index].durationMinutes)} from ${index === 0 ? "start" : "previous"}`
                  : undefined
              }
            />
          </div>
        ))}
      </div>

      {validPlan && (
        <p className="kit-route-return-leg">
          🏁 Return to start: {validPlan.legs[validPlan.legs.length - 1].distanceMiles.toFixed(1)} mi ·{" "}
          {formatDuration(validPlan.legs[validPlan.legs.length - 1].durationMinutes)}
        </p>
      )}
    </div>
  );
}
