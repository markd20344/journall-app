import { useMemo, useState, type CSSProperties } from "react";
import { addMonths, addWeeks, addYears, format } from "date-fns";
import type { Item, ItemKind, ItemStatus } from "../types";
import { ITEM_KINDS, PRIORITY_ORDER, STATUS_META } from "../lib/itemKinds";
import { useAllItems } from "../hooks/useJournalData";
import { todayDateString } from "../lib/id";
import ItemCard from "./ItemCard";
import ItemEditor from "./ItemEditor";
import Dropdown from "./Dropdown";

// Live first, then Blocked, then Hold, then Closed last (or not shown at all
// by default — see StatusFilterValue below). Items with no status lifecycle
// (Lessons, Bookings) sit alongside Live.
const STATUS_SORT_ORDER: Record<ItemStatus, number> = { open: 0, blocked: 1, on_hold: 2, closed: 3 };
const PRIORITY_SORT_ORDER = Object.fromEntries(PRIORITY_ORDER.map((p, i) => [p, i]));

// "" = every status including Closed. "not-closed" = Live/Blocked/Hold only
// (the composite default). Anything else filters to that exact status.
type StatusFilterValue = ItemStatus | "" | "not-closed";

// "" = no restriction. Otherwise, a forward-looking window from today.
type DateRangeValue = "" | "7d" | "1m" | "3m" | "6m" | "1y";

const DATE_RANGE_OPTIONS: Array<{ value: DateRangeValue; label: string }> = [
  { value: "", label: "All dates" },
  { value: "7d", label: "Next week" },
  { value: "1m", label: "Next month" },
  { value: "3m", label: "Next 3 months" },
  { value: "6m", label: "Next 6 months" },
  { value: "1y", label: "Next year" },
];

function rangeCutoffDate(range: DateRangeValue): string | null {
  if (!range) return null;
  const today = new Date();
  const cutoff =
    range === "7d"
      ? addWeeks(today, 1)
      : range === "1m"
        ? addMonths(today, 1)
        : range === "3m"
          ? addMonths(today, 3)
          : range === "6m"
            ? addMonths(today, 6)
            : addYears(today, 1);
  return format(cutoff, "yyyy-MM-dd");
}

interface Props {
  // Log page creates items; Browse's "Log items" tab is view/edit-only so
  // it doesn't compete for attention with — or duplicate — the create flow
  // that already lives on Log.
  allowCreate?: boolean;
  defaultStatusFilter?: StatusFilterValue;
  // Restricts which kinds are shown/selectable — used by Browse's Calendar
  // tab to scope down to Bookings/Actions/Diary entries.
  kindScope?: ItemKind[];
  // "status" (default) groups by Live/Blocked/Hold then priority — suited to
  // a work backlog. "date" sorts chronologically ascending — suited to an
  // appointments view.
  sortMode?: "status" | "date";
  showDateRangeFilter?: boolean;
}

/**
 * Full search/filter/create UI for spin-off items (lessons, actions, risks,
 * assumptions, decisions, bookings). Shared between the dedicated Log page
 * and the "Items"/"Calendar" tabs on Browse, so item search lives in both
 * places without duplicating the logic.
 */
export default function ItemBrowser({
  allowCreate = true,
  defaultStatusFilter = "",
  kindScope,
  sortMode = "status",
  showDateRangeFilter = false,
}: Props) {
  const allItems = useAllItems();
  const scopedItems = useMemo(
    () => (kindScope ? allItems.filter((i) => kindScope.includes(i.kind)) : allItems),
    [allItems, kindScope],
  );
  const kindOptions = kindScope ? ITEM_KINDS.filter((k) => kindScope.includes(k.kind)) : ITEM_KINDS;

  const [kindFilter, setKindFilter] = useState<ItemKind | "">("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(defaultStatusFilter);
  const [projectFilter, setProjectFilter] = useState("");
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeValue>("");
  const [query, setQuery] = useState("");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [creatingKind, setCreatingKind] = useState<ItemKind | null>(null);

  const knownProjects = useMemo(
    () =>
      Array.from(new Set(scopedItems.filter((i) => i.kind === "story" && i.project).map((i) => i.project as string))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [scopedItems],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const today = todayDateString();
    const cutoff = rangeCutoffDate(dateRangeFilter);
    const items = scopedItems.filter((item) => {
      if (kindFilter && item.kind !== kindFilter) return false;
      if (statusFilter === "not-closed") {
        if (item.status === "closed") return false;
      } else if (statusFilter && item.status !== statusFilter) {
        return false;
      }
      if (projectFilter && item.project !== projectFilter) return false;
      if (cutoff && (item.date < today || item.date > cutoff)) return false;
      if (q && !item.title.toLowerCase().includes(q) && !item.body.toLowerCase().includes(q) && !item.code.toLowerCase().includes(q))
        return false;
      return true;
    });
    return [...items].sort((a, b) => {
      if (sortMode === "date") {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || "").localeCompare(b.time || "");
      }
      const aOrder = a.status ? STATUS_SORT_ORDER[a.status] : STATUS_SORT_ORDER.open;
      const bOrder = b.status ? STATUS_SORT_ORDER[b.status] : STATUS_SORT_ORDER.open;
      if (aOrder !== bOrder) return aOrder - bOrder;
      const aPriority = a.priority ? PRIORITY_SORT_ORDER[a.priority] : PRIORITY_ORDER.length;
      const bPriority = b.priority ? PRIORITY_SORT_ORDER[b.priority] : PRIORITY_ORDER.length;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return b.date.localeCompare(a.date);
    });
  }, [scopedItems, kindFilter, statusFilter, projectFilter, dateRangeFilter, query, sortMode]);

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

  if (creatingKind) {
    return <ItemEditor kind={creatingKind} onSaved={() => setCreatingKind(null)} onCancel={() => setCreatingKind(null)} />;
  }

  return (
    <>
      {allowCreate && (
        <div className="new-item-section new-item-section-top">
          <span className="field-label">Log something new</span>
          <div className="new-item-buttons">
            {kindOptions.map((k) => (
              <button
                key={k.kind}
                type="button"
                className="kind-action-btn"
                style={{ "--kind-color": k.color } as CSSProperties}
                onClick={() => setCreatingKind(k.kind)}
              >
                + {k.shortLabel}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="browse-filters">
        <input
          type="search"
          placeholder="Search title, details, or code…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
        <Dropdown
          value={kindFilter}
          onChange={(v) => setKindFilter(v as ItemKind | "")}
          options={[{ value: "", label: "All kinds" }, ...kindOptions.map((k) => ({ value: k.kind, label: k.label }))]}
        />
        <Dropdown
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilterValue)}
          options={[
            { value: "", label: "All statuses" },
            { value: "not-closed", label: "Live, Blocked & Hold" },
            ...(Object.keys(STATUS_META) as ItemStatus[]).map((s) => ({ value: s, label: STATUS_META[s].label })),
          ]}
        />
        {knownProjects.length > 0 && (
          <Dropdown
            value={projectFilter}
            onChange={setProjectFilter}
            options={[{ value: "", label: "All projects" }, ...knownProjects.map((p) => ({ value: p, label: p }))]}
          />
        )}
        {showDateRangeFilter && (
          <Dropdown value={dateRangeFilter} onChange={(v) => setDateRangeFilter(v as DateRangeValue)} options={DATE_RANGE_OPTIONS} />
        )}
      </div>

      <p className="result-count">
        {filtered.length} {filtered.length === 1 ? "item" : "items"}
      </p>

      <div className="entry-list">
        {filtered.map((item) => (
          <ItemCard key={item.id} item={item} onClick={() => setEditingItem(item)} />
        ))}
        {filtered.length === 0 && <p className="empty-hint">Nothing here yet.</p>}
      </div>
    </>
  );
}
