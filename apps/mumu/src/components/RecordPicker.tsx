import { useState } from "react";
import { matches } from "../lib/search";

export interface PickerOption {
  id: string;
  label: string;
  sub?: string;
}

interface Props {
  options: PickerOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  /** Offered when nothing matches, e.g. to create the record on the fly. */
  onCreate?: (name: string) => string;
  /** The caller renders the selection itself (e.g. with extra fields per row). */
  hideSelected?: boolean;
}

// Multi-select by search: chips for what's chosen, a search box to add more.
export default function RecordPicker({ options, selected, onChange, placeholder, onCreate, hideSelected }: Props) {
  const [query, setQuery] = useState("");
  const byId = new Map(options.map((o) => [o.id, o]));
  const results = query.trim()
    ? options.filter((o) => !selected.includes(o.id) && matches(query, o.label, o.sub)).slice(0, 8)
    : [];

  return (
    <div className="section">
      {!hideSelected && selected.length > 0 && (
        <div className="chips">
          {selected.map((id) => (
            <span key={id} className="chip static">
              {byId.get(id)?.label ?? "(deleted)"}
              <button type="button" className="x" aria-label="Remove" onClick={() => onChange(selected.filter((x) => x !== id))}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input type="search" value={query} placeholder={placeholder} onChange={(e) => setQuery(e.target.value)} />
      {query.trim() && (
        <div className="picker-results">
          {results.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onChange([...selected, o.id]);
                setQuery("");
              }}
            >
              {o.label}
              {o.sub && <span className="hint">&nbsp;· {o.sub}</span>}
            </button>
          ))}
          {onCreate && !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase()) && (
            <button
              type="button"
              onClick={() => {
                const id = onCreate(query.trim());
                onChange([...selected, id]);
                setQuery("");
              }}
            >
              ＋ Add “{query.trim()}”
            </button>
          )}
          {results.length === 0 && !onCreate && <span className="hint" style={{ padding: "12px" }}>No matches</span>}
        </div>
      )}
    </div>
  );
}
