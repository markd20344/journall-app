// Remembers the postcode Mark always starts (and ends) his round from —
// "Northampton" in practice — so the Route tab defaults to it instead of
// asking every time. Plain localStorage rather than the synced Dexie
// tables: it's a per-device UI default, not round data worth syncing.

const KEY = "kitRuns.homeBasePostcode";

export function getHomeBasePostcode(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setHomeBasePostcode(postcode: string): void {
  try {
    localStorage.setItem(KEY, postcode.trim());
  } catch {
    // Private browsing / storage disabled — the field just won't persist.
  }
}
