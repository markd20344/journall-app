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
