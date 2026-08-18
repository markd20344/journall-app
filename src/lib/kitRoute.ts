// Route planning for a day's kit-collection jobs. Geocoding uses
// postcodes.io — a free, key-less, CORS-enabled UK postcode lookup — so
// this works straight from the browser with no backend of its own.
// Ordering is a nearest-neighbor heuristic from a chosen start point: good
// enough for the size of round this app deals with (single-digit stops),
// and lets "start from X instead" just mean "re-run from a different
// point," which is the actual requirement — not the shortest-possible-tour
// guarantee a full TSP solver would chase.

export interface GeoPoint {
  lat: number;
  lng: number;
}

interface PostcodesIoBulkResult {
  result: Array<{
    query: string;
    result: { postcode: string; latitude: number; longitude: number } | null;
  }>;
}

interface PostcodesIoSingleResult {
  result: { postcode: string; latitude: number; longitude: number } | null;
}

/** Looks up lat/lng for a batch of UK postcodes. Unresolvable ones map to null. */
export async function geocodePostcodes(postcodes: string[]): Promise<Map<string, GeoPoint | null>> {
  const unique = Array.from(new Set(postcodes.map((p) => p.trim().toUpperCase()).filter(Boolean)));
  const results = new Map<string, GeoPoint | null>();
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const res = await fetch("https://api.postcodes.io/postcodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postcodes: batch }),
    });
    if (!res.ok) throw new Error(`Postcode lookup failed (HTTP ${res.status})`);
    const data = (await res.json()) as PostcodesIoBulkResult;
    for (const item of data.result) {
      results.set(item.query, item.result ? { lat: item.result.latitude, lng: item.result.longitude } : null);
    }
  }
  return results;
}

/** Looks up lat/lng for a single postcode — used for a custom "start from here" point. */
export async function geocodeSinglePostcode(postcode: string): Promise<GeoPoint | null> {
  const trimmed = postcode.trim();
  if (!trimmed) return null;
  const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as PostcodesIoSingleResult;
  return data.result ? { lat: data.result.latitude, lng: data.result.longitude } : null;
}

/** The device's current GPS position, for "start from where I am now." */
export function getCurrentLocation(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This device doesn't support location lookup"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || "Couldn't get your location")),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Straight-line distance in miles — exported for the leg-breakdown fallback when road routing is unavailable. */
export function straightLineMiles(a: GeoPoint, b: GeoPoint): number {
  return (haversineKm(a, b) * 1000) / 1609.344;
}

export interface RoutePoint {
  id: string;
  point: GeoPoint;
}

/**
 * Orders stops by always jumping to whichever remaining stop is closest to
 * wherever the route currently is, starting from `start`. Straight-line
 * distance only — used as the fallback when road routing (below) isn't
 * available, and good enough for that: it's a last resort, not the primary
 * path.
 */
export function nearestNeighborOrder(start: GeoPoint, stops: RoutePoint[]): string[] {
  const remaining = [...stops];
  const order: string[] = [];
  let current = start;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((stop, idx) => {
      const d = haversineKm(current, stop.point);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    });
    const [next] = remaining.splice(bestIdx, 1);
    order.push(next.id);
    current = next.point;
  }
  return order;
}

export interface RoadTripResult {
  order: string[]; // stop ids, visiting order
  distanceMiles: number;
  durationMinutes: number;
}

/**
 * Orders stops by real road distance/duration rather than straight-line —
 * "best economical route" means miles and minutes actually driven, not as
 * the crow flies. Uses OSRM's public routing demo (router.project-osrm.org),
 * a free, key-less service with a "Trip" endpoint that solves exactly this
 * (approximate travelling-salesman over the real road network) in one call.
 *
 * That demo server is a best-effort public service, not something to
 * depend on being up — this returns null on any failure (network, rate
 * limit, an unrecognized profile) so the caller can fall back to the
 * straight-line nearestNeighborOrder above rather than the route planner
 * just breaking.
 */
export async function orderByRoadTrip(start: GeoPoint, stops: RoutePoint[]): Promise<RoadTripResult | null> {
  if (stops.length === 0) return null;
  try {
    const coords = [start, ...stops.map((s) => s.point)].map((p) => `${p.lng},${p.lat}`).join(";");
    const url = `https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&destination=any&roundtrip=false&overview=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !Array.isArray(data.waypoints) || !Array.isArray(data.trips) || data.trips.length === 0) {
      return null;
    }
    const waypoints = data.waypoints as Array<{ waypoint_index: number }>;
    // waypoints[0] is the start point (source=first pins it to trip position 0);
    // waypoints[1..] correspond 1:1 with `stops`, each carrying its position
    // in the optimized trip — sort by that to get the visiting order.
    const ordered = stops
      .map((stop, i) => ({ id: stop.id, position: waypoints[i + 1]?.waypoint_index ?? Number.MAX_SAFE_INTEGER }))
      .sort((a, b) => a.position - b.position)
      .map((s) => s.id);
    const trip = data.trips[0] as { distance: number; duration: number };
    return { order: ordered, distanceMiles: trip.distance / 1609.344, durationMinutes: trip.duration / 60 };
  } catch {
    return null;
  }
}

export interface RouteLeg {
  distanceMiles: number;
  durationMinutes: number;
}

export interface FullRoutePlan {
  // legs[0] is start → orderedStops[0]; legs[i] (0 < i < orderedStops.length)
  // is orderedStops[i-1] → orderedStops[i]; the final entry is
  // orderedStops[last] → start (the drive home) — one more leg than stops.
  legs: RouteLeg[];
  totalDistanceMiles: number;
  totalDurationMinutes: number;
}

/**
 * Leg-by-leg distance/duration for a *fixed* visiting order, starting and
 * ending at `start` — used once the order is decided (by orderByRoadTrip or
 * a manual drag-reorder) to show "how far/long from the previous stop" plus
 * a grand total that includes the drive home, for working out timings
 * ("leaving at 7, that's 5 hours of driving before I'm back").
 *
 * Uses OSRM's Route service (not Trip) since Route preserves input order
 * and returns one leg per consecutive coordinate pair. Same best-effort
 * contract as orderByRoadTrip: null on any failure so the caller can fall
 * back to straight-line legs instead.
 */
export async function computeRouteLegs(start: GeoPoint, orderedStops: GeoPoint[]): Promise<FullRoutePlan | null> {
  if (orderedStops.length === 0) return null;
  try {
    const points = [start, ...orderedStops, start];
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false&steps=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !Array.isArray(data.routes) || data.routes.length === 0) return null;
    const route = data.routes[0] as { distance: number; duration: number; legs: Array<{ distance: number; duration: number }> };
    if (!Array.isArray(route.legs) || route.legs.length !== orderedStops.length + 1) return null;
    const legs = route.legs.map((l) => ({ distanceMiles: l.distance / 1609.344, durationMinutes: l.duration / 60 }));
    return { legs, totalDistanceMiles: route.distance / 1609.344, totalDurationMinutes: route.duration / 60 };
  } catch {
    return null;
  }
}

/** Straight-line leg breakdown — the fallback when computeRouteLegs' road-routing call is unavailable. */
export function straightLineRouteLegs(start: GeoPoint, orderedStops: GeoPoint[]): FullRoutePlan {
  const points = [start, ...orderedStops, start];
  const legs: RouteLeg[] = [];
  // No real-world speed to estimate duration from a straight line, so this
  // assumes a flat 30mph average — a rough placeholder, clearly labeled as
  // an estimate in the UI, not a substitute for the real road-routed figure.
  const ASSUMED_MPH = 30;
  for (let i = 1; i < points.length; i++) {
    const miles = straightLineMiles(points[i - 1], points[i]);
    legs.push({ distanceMiles: miles, durationMinutes: (miles / ASSUMED_MPH) * 60 });
  }
  const totalDistanceMiles = legs.reduce((sum, l) => sum + l.distanceMiles, 0);
  const totalDurationMinutes = legs.reduce((sum, l) => sum + l.durationMinutes, 0);
  return { legs, totalDistanceMiles, totalDurationMinutes };
}
