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

export function useEntriesForDate(date: string): Entry[] {
  return (
    useLiveQuery(
      () => db.entries.where("date").equals(date).sortBy("createdAt"),
      [date],
      [],
    ) ?? []
  );
}

export function useEntryDatesInRange(startDate: string, endDate: string): Set<string> {
  const entries =
    useLiveQuery(
      () => db.entries.where("date").between(startDate, endDate, true, true).toArray(),
      [startDate, endDate],
      [],
    ) ?? [];
  return new Set(entries.map((e) => e.date));
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

// Items with real calendar semantics: bookings (dated events) and actions
// (dated by their due date). Used to put markers on the Calendar view and
// to list "what's scheduled today" alongside journal entries.
export function useScheduledItemsForDate(date: string): Item[] {
  return (
    useLiveQuery(() => db.items.where("date").equals(date).sortBy("time"), [date], []) ?? []
  ).filter((i) => i.kind === "event" || i.kind === "action");
}

export function useScheduledDatesInRange(startDate: string, endDate: string): Set<string> {
  const items =
    useLiveQuery(
      () => db.items.where("date").between(startDate, endDate, true, true).toArray(),
      [startDate, endDate],
      [],
    ) ?? [];
  return new Set(items.filter((i) => i.kind === "event" || i.kind === "action").map((i) => i.date));
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
