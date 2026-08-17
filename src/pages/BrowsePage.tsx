import { useMemo, useState } from "react";
import EntryCard from "../components/EntryCard";
import EntryEditor from "../components/EntryEditor";
import ItemBrowser from "../components/ItemBrowser";
import { useAllEntries, useCategories, useEnrichedEntries, useTopics } from "../hooks/useJournalData";
import type { Entry } from "../types";

type Tab = "journal" | "items";

export default function BrowsePage() {
  const [tab, setTab] = useState<Tab>("items");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  const categories = useCategories();
  const allTopics = useTopics();
  const allEntries = useAllEntries();
  const enriched = useEnrichedEntries(allEntries);

  const topicsForFilter = categoryId ? allTopics.filter((t) => t.categoryId === categoryId) : allTopics;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((entry) => {
      if (categoryId && entry.categoryId !== categoryId) return false;
      if (topicId && !entry.topicIds.includes(topicId)) return false;
      if (q && !entry.body.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enriched, query, categoryId, topicId]);

  return (
    <div className="page browse-page">
      <h1 className="page-title">Browse</h1>

      <div className="browse-tabs">
        <button type="button" className={`browse-tab ${tab === "items" ? "active" : ""}`} onClick={() => setTab("items")}>
          Log items
        </button>
        <button type="button" className={`browse-tab ${tab === "journal" ? "active" : ""}`} onClick={() => setTab("journal")}>
          Journal entries
        </button>
      </div>

      {tab === "items" ? (
        <ItemBrowser allowCreate={false} />
      ) : editingEntry ? (
        <EntryEditor
          entry={editingEntry}
          onCancel={() => setEditingEntry(null)}
          onSaved={() => setEditingEntry(null)}
          onDeleted={() => setEditingEntry(null)}
        />
      ) : (
        <>
          <div className="browse-filters">
            <input
              type="search"
              placeholder="Search entry text…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
            />
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setTopicId("");
              }}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">All topics</option>
              {topicsForFilter.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {(query || categoryId || topicId) && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setQuery("");
                  setCategoryId("");
                  setTopicId("");
                }}
              >
                Clear
              </button>
            )}
          </div>

          <p className="result-count">
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
          </p>

          <div className="entry-list">
            {filtered.map((entry) => (
              <EntryCard key={entry.id} entry={entry} onClick={() => setEditingEntry(entry)} />
            ))}
            {filtered.length === 0 && <p className="empty-hint">No entries match.</p>}
          </div>
        </>
      )}
    </div>
  );
}
