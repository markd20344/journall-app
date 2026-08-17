import { useMemo, useState, type CSSProperties } from "react";
import type { Item, ItemKind, ItemStatus } from "../types";
import { ITEM_KINDS, PRIORITY_ORDER, STATUS_META } from "../lib/itemKinds";
import { useAllItems } from "../hooks/useJournalData";
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

interface Props {
  // Log page creates items; Browse's "Log items" tab is view/edit-only so
  // it doesn't compete for attention with — or duplicate — the create flow
  // that already lives on Log.
  allowCreate?: boolean;
  defaultStatusFilter?: StatusFilterValue;
}

/**
 * Full search/filter/create UI for spin-off items (lessons, actions, risks,
 * assumptions, decisions, bookings). Shared between the dedicated Log page
 * and the "Items" tab on Browse, so item search lives in both places
 * without duplicating the logic.
 */
export default function ItemBrowser({ allowCreate = true, defaultStatusFilter = "" }: Props) {
  const allItems = useAllItems();
  const [kindFilter, setKindFilter] = useState<ItemKind | "">("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(defaultStatusFilter);
  const [projectFilter, setProjectFilter] = useState("");
  const [query, setQuery] = useState("");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [creatingKind, setCreatingKind] = useState<ItemKind | null>(null);

  const knownProjects = useMemo(
    () =>
      Array.from(new Set(allItems.filter((i) => i.kind === "story" && i.project).map((i) => i.project as string))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [allItems],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = allItems.filter((item) => {
      if (kindFilter && item.kind !== kindFilter) return false;
      if (statusFilter === "not-closed") {
        if (item.status === "closed") return false;
      } else if (statusFilter && item.status !== statusFilter) {
        return false;
      }
      if (projectFilter && item.project !== projectFilter) return false;
      if (q && !item.title.toLowerCase().includes(q) && !item.body.toLowerCase().includes(q) && !item.code.toLowerCase().includes(q))
        return false;
      return true;
    });
    return [...items].sort((a, b) => {
      const aOrder = a.status ? STATUS_SORT_ORDER[a.status] : STATUS_SORT_ORDER.open;
      const bOrder = b.status ? STATUS_SORT_ORDER[b.status] : STATUS_SORT_ORDER.open;
      if (aOrder !== bOrder) return aOrder - bOrder;
      const aPriority = a.priority ? PRIORITY_SORT_ORDER[a.priority] : PRIORITY_ORDER.length;
      const bPriority = b.priority ? PRIORITY_SORT_ORDER[b.priority] : PRIORITY_ORDER.length;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return b.date.localeCompare(a.date);
    });
  }, [allItems, kindFilter, statusFilter, projectFilter, query]);

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
            {ITEM_KINDS.map((k) => (
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
          options={[{ value: "", label: "All kinds" }, ...ITEM_KINDS.map((k) => ({ value: k.kind, label: k.label }))]}
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
