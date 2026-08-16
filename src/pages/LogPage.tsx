import { useMemo, useState } from "react";
import type { Item, ItemKind } from "../types";
import { ITEM_KINDS } from "../lib/itemKinds";
import { useAllItems } from "../hooks/useJournalData";
import ItemCard from "../components/ItemCard";
import ItemEditor from "../components/ItemEditor";

export default function LogPage() {
  const allItems = useAllItems();
  const [kindFilter, setKindFilter] = useState<ItemKind | "">("");
  const [query, setQuery] = useState("");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [creatingKind, setCreatingKind] = useState<ItemKind | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems.filter((item) => {
      if (kindFilter && item.kind !== kindFilter) return false;
      if (q && !item.title.toLowerCase().includes(q) && !item.body.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allItems, kindFilter, query]);

  return (
    <div className="page log-page">
      <h1 className="page-title">Log</h1>
      <p className="settings-hint">
        Lessons learned, actions, risks, assumptions, decisions and calendar bookings — spun off from journal
        entries, or added directly here.
      </p>

      {editingItem ? (
        <ItemEditor
          kind={editingItem.kind}
          item={editingItem}
          onSaved={() => setEditingItem(null)}
          onCancel={() => setEditingItem(null)}
          onDeleted={() => setEditingItem(null)}
        />
      ) : creatingKind ? (
        <ItemEditor kind={creatingKind} onSaved={() => setCreatingKind(null)} onCancel={() => setCreatingKind(null)} />
      ) : (
        <>
          <div className="browse-filters">
            <input
              type="search"
              placeholder="Search…"
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
          </div>

          <div className="new-item-buttons">
            {ITEM_KINDS.map((k) => (
              <button key={k.kind} type="button" className="ghost" onClick={() => setCreatingKind(k.kind)}>
                + {k.shortLabel}
              </button>
            ))}
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
      )}
    </div>
  );
}
