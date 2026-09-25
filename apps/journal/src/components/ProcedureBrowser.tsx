import { useMemo, useState } from "react";
import type { Procedure } from "../types";
import { useAllProcedures, useCategories } from "../hooks/useJournalData";
import ProcedureCard from "./ProcedureCard";
import ProcedureEditor from "./ProcedureEditor";
import Dropdown from "@journall/shared/components/Dropdown";

/**
 * Search/filter/create UI for procedures — mirrors BookBrowser's shape
 * (a quick-add entry point, filters, a flat card list). Sorted alphabetically
 * by title rather than recency: this is a reference lookup ("how do I do
 * that again?"), not a feed of recent activity.
 */
export default function ProcedureBrowser() {
  const allProcedures = useAllProcedures();
  const categories = useCategories();
  const [categoryFilter, setCategoryFilter] = useState("");
  const [query, setQuery] = useState("");
  const [editingProcedure, setEditingProcedure] = useState<Procedure | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allProcedures.filter((p) => {
      if (categoryFilter && p.categoryId !== categoryFilter) return false;
      if (q && !p.title.toLowerCase().includes(q) && !p.steps.some((s) => s.text.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [allProcedures, categoryFilter, query]);

  if (editingProcedure) {
    return (
      <ProcedureEditor
        procedure={editingProcedure}
        onSaved={() => setEditingProcedure(null)}
        onCancel={() => setEditingProcedure(null)}
        onDeleted={() => setEditingProcedure(null)}
      />
    );
  }

  if (creatingNew) {
    return <ProcedureEditor onSaved={() => setCreatingNew(false)} onCancel={() => setCreatingNew(false)} />;
  }

  return (
    <>
      <div className="new-item-section new-item-section-top">
        <button type="button" className="primary" onClick={() => setCreatingNew(true)}>
          + Add a procedure
        </button>
      </div>

      <div className="browse-filters">
        <input
          type="search"
          placeholder="Search title or steps…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
        {categories.length > 0 && (
          <Dropdown
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
        )}
      </div>

      <p className="result-count">
        {filtered.length} {filtered.length === 1 ? "procedure" : "procedures"}
      </p>

      <div className="entry-list">
        {filtered.map((procedure) => (
          <ProcedureCard key={procedure.id} procedure={procedure} onClick={() => setEditingProcedure(procedure)} />
        ))}
        {filtered.length === 0 && (
          <p className="empty-hint">
            {allProcedures.length === 0 ? "No procedures yet — add one above." : "Nothing matches that search/filter."}
          </p>
        )}
      </div>
    </>
  );
}
