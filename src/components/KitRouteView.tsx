import { useState, type DragEvent } from "react";
import type { KitJob } from "../types/kit";
import { applyRouteOrder, setJobGeo, setRouteOrder } from "../db/kitRepo";
import {
  geocodePostcodes,
  geocodeSinglePostcode,
  getCurrentLocation,
  nearestNeighborOrder,
  orderByRoadTrip,
  type GeoPoint,
} from "../lib/kitRoute";
import { useKitJobsForDate } from "../hooks/useKitData";
import { showToast } from "../lib/toast";
import KitJobCard from "./KitJobCard";
import Dropdown from "./Dropdown";

interface Props {
  batchDate: string;
  onOpenJob: (job: KitJob) => void;
}

type StartMode = "location" | "postcode" | "job";

export default function KitRouteView({ batchDate, onOpenJob }: Props) {
  const jobs = useKitJobsForDate(batchDate);
  const [startMode, setStartMode] = useState<StartMode>("location");
  const [startPostcode, setStartPostcode] = useState("");
  const [startJobId, setStartJobId] = useState(jobs[0]?.id ?? "");
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

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
      }

      const skippedNote = skipped.length > 0 ? ` — ${skipped.length} couldn't be found by postcode` : "";
      if (roadTrip) {
        const miles = roadTrip.distanceMiles.toFixed(1);
        const hours = Math.floor(roadTrip.durationMinutes / 60);
        const mins = Math.round(roadTrip.durationMinutes % 60);
        const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        showToast(`Ordered ${orderedIds.length} stops — approx ${miles} mi, ${duration} driving${skippedNote}`);
      } else {
        showToast(`Ordered ${orderedIds.length} stops by straight-line distance (road routing unavailable)${skippedNote}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't plan the route");
    } finally {
      setComputing(false);
    }
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
    };
  }

  if (jobs.length === 0) {
    return <p className="empty-hint">No jobs for {batchDate} yet — import the email or add one on the Jobs tab.</p>;
  }

  return (
    <div className="kit-route-view">
      <div className="kit-route-controls">
        <span className="field-label">Start from</span>
        <Dropdown
          value={startMode}
          onChange={(v) => setStartMode(v as StartMode)}
          options={[
            { value: "location", label: "My current location" },
            { value: "postcode", label: "A postcode" },
            { value: "job", label: "One of today's jobs" },
          ]}
        />
        {startMode === "postcode" && (
          <input
            type="text"
            placeholder="e.g. NN17 1XY"
            value={startPostcode}
            onChange={(e) => setStartPostcode(e.target.value)}
          />
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
      <p className="settings-hint small">Drag a card to reorder it by hand.</p>

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
            <KitJobCard job={job} routePosition={index + 1} onClick={() => onOpenJob(job)} />
          </div>
        ))}
      </div>
    </div>
  );
}
