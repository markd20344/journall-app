import { useMemo, useState, type CSSProperties } from "react";
import type { Item, ItemKind, ItemStatus } from "../types";
import { ITEM_KINDS, STATUS_META } from "../lib/itemKinds";
import { useAllItems } from "../hooks/useJournalData";
import ItemCard from "./ItemCard";
import ItemEditor from "./ItemEditor";

const STATUS_SORT_ORDER: Record<ItemStatus, number> = { blocked: 0, open: 1, on_hold: 2, closed: 3 };

interface Props {
  // Log page creates items; Browse's "Log items" tab is view/edit-only so
  // it doesn't compete for attention with — or duplicate — the create flow
  // that already lives on Log.
  allowCreate?: boolean;
}

/**
 * Full search/filter/create UI for spin-off items (lessons, actions, risks,
 * assumptions, decisions, bookings). Shared between the dedicated Log page
 * and the "Items" tab on Browse, so item search lives in both places
 * without duplicating the logic.
 */
export default function ItemBrowser({ allowCreate = true }: Props) {
  const allItems = useAllItems();
  const [kindFilter, setKindFilter] = useState<ItemKind | "">("");
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "">("");
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
      if (statusFilter && item.status !== statusFilter) return false;
      if (projectFilter && item.project !== projectFilter) return false;
      if (q && !item.title.toLowerCase().includes(q) && !item.body.toLowerCase().includes(q) && !item.code.toLowerCase().includes(q))
        return false;
      return true;
    });
    return [...items].sort((a, b) => {
      const aOrder = a.status ? STATUS_SORT_ORDER[a.status] : 1;
      const bOrder = b.status ? STATUS_SORT_ORDER[b.status] : 1;
      if (aOrder !== bOrder) return aOrder - bOrder;
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
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as ItemKind | "")}>
          <option value="">All kinds</option>
          {ITEM_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ItemStatus | "")}>
          <option value="">All statuses</option>
          {(Object.keys(STATUS_META) as ItemStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        {knownProjects.length > 0 && (
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">All projects</option>
            {knownProjects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
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
