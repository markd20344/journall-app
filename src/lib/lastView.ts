import { db } from "../db/db";
import type { View } from "../App";

// A per-device UI preference (which tab was open), not real data — kept out
// of the Firestore-synced tables the same way accentColor is, so your phone
// and PC each remember their own last tab instead of one overriding the
// other's.
const SETTINGS_KEY = "lastView";

const VALID_VIEWS: View[] = ["today", "write", "calendar", "log", "browse", "settings"];

export async function getStoredView(): Promise<View> {
  const record = await db.settings.get(SETTINGS_KEY);
  const value = record?.value as View | undefined;
  return value && VALID_VIEWS.includes(value) ? value : "today";
}

export async function setStoredView(view: View): Promise<void> {
  await db.settings.put({ key: SETTINGS_KEY, value: view });
}
