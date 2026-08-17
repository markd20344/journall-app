import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Category, Entry, EntryWithRefs, Item, ItemKind, Topic } from "../types";

export function useCategories(): Category[] {
  return useLiveQuery(() => db.categories.orderBy("name").toArray(), [], []) ?? [];
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

export function useAllEntries(): Entry[] {
  return useLiveQuery(() => db.entries.orderBy("date").reverse().toArray(), [], []) ?? [];
}

export function useAllItems(): Item[] {
  return useLiveQuery(() => db.items.orderBy("date").reverse().toArray(), [], []) ?? [];
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

// Entries' "Due" tab — everything with a due/logged date that isn't a Story
// or a journal entry, so "what's due in period X" doesn't require flipping
// between the Log items and Calendar tabs. Stories are deliberately left
// out (they don't carry a due date the same way) and journal entries never
// show here at all.
export const DUE_TAB_KINDS: ItemKind[] = ["action", "event", "diary", "risk", "decision", "assumption", "lesson"];

export function useCalendarItemsForDate(date: string): Item[] {
  return (
    useLiveQuery(() => db.items.where("date").equals(date).sortBy("time"), [date], []) ?? []
  ).filter((i) => (CALENDAR_KINDS as string[]).includes(i.kind));
}

export function useCalendarDatesInRange(startDate: string, endDate: string): Set<string> {
  const items =
    useLiveQuery(
      () => db.items.where("date").between(startDate, endDate, true, true).toArray(),
      [startDate, endDate],
      [],
    ) ?? [];
  return new Set(items.filter((i) => (CALENDAR_KINDS as string[]).includes(i.kind)).map((i) => i.date));
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
