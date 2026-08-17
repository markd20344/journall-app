import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Category, Entry, EntryWithRefs, Item, ItemKind, Topic } from "../types";
import { usePendingDeleteIds } from "../lib/pendingDelete";

// Most-recent-first, and reliable within a single day: Dexie's own
// orderBy("date") only sorts the date string itself, so two records logged
// on the same day landed in whatever arbitrary order the index happened to
// return them — not necessarily the order they were actually written.
// createdAt is a full timestamp every record always has, so it's a
// deterministic date-*and-time* tiebreak regardless of kind.
function byDateThenCreatedAtDesc(a: { date: string; createdAt: string }, b: { date: string; createdAt: string }): number {
  return a.date !== b.date ? b.date.localeCompare(a.date) : b.createdAt.localeCompare(a.createdAt);
}

export function useCategories(): Category[] {
  const categories = useLiveQuery(() => db.categories.orderBy("name").toArray(), [], []) ?? [];
  const pendingIds = usePendingDeleteIds("category");
  return pendingIds.size === 0 ? categories : categories.filter((c) => !pendingIds.has(c.id));
}

export function useTopics(): Topic[] {
  return useLiveQuery(() => db.topics.orderBy("name").toArray(), [], []) ?? [];
}

export function useTopicsForCategory(categoryId: string | undefined): Topic[] {
  return (
    useLiveQuery(
      () => (categoryId ? db.topics.where("categoryId").equals(categoryId).sortBy("name") : []),
      [categoryId],
      [],
    ) ?? []
  );
}

// A delete is staged for a few seconds before it actually happens (the
// "Delete — Undo" toast pattern, see lib/pendingDelete) — filtering staged
// ids out here, in the shared data hooks, means every view (Entries list,
// Log, Calendar) drops the record immediately and consistently, not just
// whichever screen happened to trigger the delete.
export function useAllEntries(): Entry[] {
  const entries = useLiveQuery(() => db.entries.toArray(), [], []) ?? [];
  const pendingIds = usePendingDeleteIds("entry");
  const visible = pendingIds.size === 0 ? entries : entries.filter((e) => !pendingIds.has(e.id));
  return [...visible].sort(byDateThenCreatedAtDesc);
}

export function useAllItems(): Item[] {
  const items = useLiveQuery(() => db.items.toArray(), [], []) ?? [];
  const pendingIds = usePendingDeleteIds("item");
  const visible = pendingIds.size === 0 ? items : items.filter((i) => !pendingIds.has(i.id));
  return [...visible].sort(byDateThenCreatedAtDesc);
}

export function useItemsForEntry(entryId: string | undefined): Item[] {
  return (
    useLiveQuery(
      () => (entryId ? db.items.where("sourceEntryId").equals(entryId).sortBy("createdAt") : []),
      [entryId],
      [],
    ) ?? []
  );
}

export function useItemsByKind(kind: ItemKind | ""): Item[] {
  const all = useAllItems();
  return kind ? all.filter((i) => i.kind === kind) : all;
}

// The Calendar page shows Bookings, Actions and Diary entries only —
// journal entries live in Journal/Log/Entries instead, so the calendar
// stays a clean "what's scheduled" view rather than a second journal index.
export const CALENDAR_KINDS: ItemKind[] = ["event", "action", "diary"];

// Entries' "Log items" tab shows the plain work-item kinds only. Stories get
// their own tab, and Bookings/Diary entries are calendar-only — Action is
// the one kind that's dual-homed, appearing in both Log items and Calendar.
export const LOG_ITEM_KINDS: ItemKind[] = ["action", "risk", "decision", "assumption", "lesson"];

// Entries' "Stories" tab — kept out of Log items and Calendar so it reads
// as a dedicated story backlog rather than mixed in with everything else.
export const STORY_KINDS: ItemKind[] = ["story"];

// Entries' "Applications" tab — job applications live only here, same
// treatment as Stories, so tracking them doesn't clutter the general
// work-item views.
export const APPLICATION_KINDS: ItemKind[] = ["application"];

// Entries' "Due" tab — everything with a due/logged date that isn't a Story
// or a journal entry, so "what's due in period X" doesn't require flipping
// between the Log items and Calendar tabs. Stories are deliberately left
// out (they don't carry a due date the same way) and journal entries never
// show here at all.
export const DUE_TAB_KINDS: ItemKind[] = ["action", "event", "diary", "risk", "decision", "assumption", "lesson"];

export function useCalendarItemsForDate(date: string): Item[] {
  const items = useLiveQuery(() => db.items.where("date").equals(date).sortBy("time"), [date], []) ?? [];
  const pendingIds = usePendingDeleteIds("item");
  return items.filter((i) => (CALENDAR_KINDS as string[]).includes(i.kind) && !pendingIds.has(i.id));
}

export function useCalendarDatesInRange(startDate: string, endDate: string): Set<string> {
  const items =
    useLiveQuery(
      () => db.items.where("date").between(startDate, endDate, true, true).toArray(),
      [startDate, endDate],
      [],
    ) ?? [];
  const pendingIds = usePendingDeleteIds("item");
  return new Set(
    items.filter((i) => (CALENDAR_KINDS as string[]).includes(i.kind) && !pendingIds.has(i.id)).map((i) => i.date),
  );
}

// Powers the Calendar page's date-range view (Current week/month, Next 3/6
// months, Next year) — same Booking/Action/Diary scope as a single day, just
// widened to a range and sorted chronologically instead of grouped by day.
export function useCalendarItemsInRange(startDate: string, endDate: string): Item[] {
  const items =
    useLiveQuery(
      () => db.items.where("date").between(startDate, endDate, true, true).toArray(),
      [startDate, endDate],
      [],
    ) ?? [];
  const pendingIds = usePendingDeleteIds("item");
  return items
    .filter((i) => (CALENDAR_KINDS as string[]).includes(i.kind) && !pendingIds.has(i.id))
    .sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : (a.time || "").localeCompare(b.time || "")));
}

export function useEnrichedEntries(entries: Entry[]): EntryWithRefs[] {
  const categories = useCategories();
  const topics = useTopics();
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const topicById = new Map(topics.map((t) => [t.id, t]));
  return entries.map((e) => ({
    ...e,
    category: categoryById.get(e.categoryId),
    topics: e.topicIds.map((id) => topicById.get(id)).filter((t): t is Topic => Boolean(t)),
  }));
}
