import { useMemo, useState } from "react";
import type { Person } from "../../types/family";
import { fullName, lifespan } from "../../family/personDisplay";

interface Props {
  people: Person[];
  excludeIds?: string[];
  onPick: (person: Person) => void;
}

export default function PersonPicker({ people, excludeIds, onPick }: Props) {
  const [query, setQuery] = useState("");
  const excluded = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => !excluded.has(p.id))
      .filter((p) => (q ? fullName(p).toLowerCase().includes(q) : true))
      .sort((a, b) => fullName(a).localeCompare(fullName(b)))
      .slice(0, 25);
  }, [people, excluded, query]);

  return (
    <div className="person-picker">
      <input
        type="text"
        placeholder="Search for a person by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <div className="person-picker-results">
        {results.map((p) => (
          <button key={p.id} type="button" className="person-picker-row" onClick={() => onPick(p)}>
            <span>{fullName(p)}</span>
            <span className="person-picker-years">{lifespan(p)}</span>
          </button>
        ))}
        {results.length === 0 && <p className="empty-hint">No matches.</p>}
      </div>
    </div>
  );
}
