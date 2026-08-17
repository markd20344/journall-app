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

export interface RoutePoint {
  id: string;
  point: GeoPoint;
}

/**
 * Orders stops by always jumping to whichever remaining stop is closest to
 * wherever the route currently is, starting from `start`. Returns stop ids
 * in visiting order.
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
