import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import type { Item } from "../types";
import type { View } from "../App";
import { CALENDAR_KINDS, DUE_TAB_KINDS, useAllItems } from "../hooks/useJournalData";
import { itemKindMeta } from "../lib/itemKinds";
import { todayDateString } from "../lib/id";
import ItemCard from "../components/ItemCard";
import ItemEditor from "../components/ItemEditor";

interface Props {
  onNavigate: (view: View) => void;
}

function sortByDate(a: Item, b: Item): number {
  return a.date !== b.date ? a.date.localeCompare(b.date) : (a.time || "").localeCompare(b.time || "");
}

// The landing view — "what's actually happening" instead of a filtered list
// you have to go hunting through. Pulls from the same DUE_TAB_KINDS /
// CALENDAR_KINDS scoping the Entries page already uses, just regrouped by
// urgency (overdue / due today / this week / flagged high-priority) rather
// than by kind.
export default function TodayPage({ onNavigate }: Props) {
  const allItems = useAllItems();
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const today = todayDateString();
  const weekAhead = format(addDays(new Date(), 7), "yyyy-MM-dd");

  const { overdue, dueToday, comingUp, highPriority } = useMemo(() => {
    const overdue: Item[] = [];
    const dueToday: Item[] = [];
    const shown = new Set<string>();

    for (const item of allItems) {
      if (!DUE_TAB_KINDS.includes(item.kind)) continue;
      const meta = itemKindMeta(item.kind);
      if (meta.statuses.length === 0 || item.status === "closed") continue;
      if (item.date < today) {
        overdue.push(item);
        shown.add(item.id);
      } else if (item.date === today) {
        dueToday.push(item);
        shown.add(item.id);
      }
    }

    const comingUp = allItems.filter(
      (item) =>
        CALENDAR_KINDS.includes(item.kind) && !shown.has(item.id) && item.date > today && item.date <= weekAhead,
    );
    comingUp.forEach((item) => shown.add(item.id));

    const highPriority = allItems.filter(
      (item) => item.priority === "high" && item.status !== "closed" && !shown.has(item.id),
    );

    overdue.sort(sortByDate);
    dueToday.sort(sortByDate);
    comingUp.sort(sortByDate);
    highPriority.sort(sortByDate);

    return { overdue, dueToday, comingUp, highPriority };
  }, [allItems, today, weekAhead]);

  if (editingItem) {
    return (
      <ItemEditor
        kind={editingItem.kind}
        item={editingItem}
        onSaved={() => setEditingItem(null)}
        onCancel={() => setEditingItem(null)}
        onDeleted={() => setEditingItem(null)}
      />
    );
  }

  const nothingToShow = overdue.length === 0 && dueToday.length === 0 && comingUp.length === 0 && highPriority.length === 0;

  return (
    <div className="page today-page">
      <h1 className="page-title">Today</h1>
      <p className="today-date">{format(new Date(), "EEEE, MMMM d")}</p>

      {nothingToShow && <p className="empty-hint">Nothing overdue, due, or coming up this week.</p>}

      {overdue.length > 0 && (
        <section className="today-section">
          <div className="today-section-head">
            <h2 className="today-section-title today-section-title-overdue">Overdue · {overdue.length}</h2>
            <button type="button" className="ghost" onClick={() => onNavigate("browse")}>
              View all
            </button>
          </div>
          {overdue.map((item) => (
            <ItemCard key={item.id} item={item} onClick={() => setEditingItem(item)} />
          ))}
        </section>
      )}

      {dueToday.length > 0 && (
        <section className="today-section">
          <div className="today-section-head">
            <h2 className="today-section-title">Due today · {dueToday.length}</h2>
            <button type="button" className="ghost" onClick={() => onNavigate("browse")}>
              View all
            </button>
          </div>
          {dueToday.map((item) => (
            <ItemCard key={item.id} item={item} onClick={() => setEditingItem(item)} />
          ))}
        </section>
      )}

      {comingUp.length > 0 && (
        <section className="today-section">
          <div className="today-section-head">
            <h2 className="today-section-title">Coming up this week</h2>
            <button type="button" className="ghost" onClick={() => onNavigate("calendar")}>
              Open calendar
            </button>
          </div>
          {comingUp.map((item) => (
            <ItemCard key={item.id} item={item} onClick={() => setEditingItem(item)} />
          ))}
        </section>
      )}

      {highPriority.length > 0 && (
        <section className="today-section">
          <div className="today-section-head">
            <h2 className="today-section-title">Open &amp; high priority</h2>
            <button type="button" className="ghost" onClick={() => onNavigate("log")}>
              View all
            </button>
          </div>
          {highPriority.map((item) => (
            <ItemCard key={item.id} item={item} onClick={() => setEditingItem(item)} />
          ))}
        </section>
      )}
    </div>
  );
}
