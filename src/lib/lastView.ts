import { db } from "../db/db";
import type { View } from "../App";
import { NAV_ITEMS } from "./navItems";

// A per-device UI preference (which tab was open), not real data — kept out
// of the Firestore-synced tables the same way accentColor is, so your phone
// and PC each remember their own last tab instead of one overriding the
// other's.
const SETTINGS_KEY = "lastView";

export async function getStoredView(): Promise<View> {
  const record = await db.settings.get(SETTINGS_KEY);
  const value = record?.value as View | undefined;
  // Validated against the live nav list (not a separately maintained
  // literal) so a stored value pointing at a since-removed tab can't get
  // stuck — falls back to Today instead of a blank/broken view.
  return value && NAV_ITEMS.some((item) => item.id === value) ? value : "today";
}

export async function setStoredView(view: View): Promise<void> {
  await db.settings.put({ key: SETTINGS_KEY, value: view });
}
