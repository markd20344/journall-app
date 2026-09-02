import { useMemo, useState } from "react";
import type { Person } from "../../types/family";
import { fullName, lifespan, searchText } from "../../family/personDisplay";

interface Props {
  people: Person[];
  onSelect: (id: string) => void;
}

export default function FamilySearchPanel({ people, onSelect }: Props) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return people.filter((p) => searchText(p).includes(q)).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [people, query]);

  return (
    <div className="family-search-panel">
      <input
        type="text"
        placeholder="Search by name, place, or note…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <p className="result-count">{query.trim() ? `${results.length} result${results.length === 1 ? "" : "s"}` : `${people.length} people in the tree`}</p>
      <div className="person-picker-results">
        {results.map((p) => (
          <button key={p.id} type="button" className="person-picker-row" onClick={() => onSelect(p.id)}>
            <span>{fullName(p)}</span>
            <span className="person-picker-years">{lifespan(p)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
