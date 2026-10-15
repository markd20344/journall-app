import { useId, useState } from "react";
import { normaliseTag } from "../lib/format";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[]; // every tag already used, for autocomplete
}

// Type and press Enter or comma to add; tap × to remove.
export default function TagInput({ value, onChange, suggestions }: Props) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  function add(raw: string) {
    const tag = normaliseTag(raw.replace(/,/g, ""));
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  }

  return (
    <div className="section">
      {value.length > 0 && (
        <div className="chips">
          {value.map((t) => (
            <span key={t} className="chip static">
              #{t}
              <button type="button" className="x" aria-label={`Remove tag ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        list={listId}
        value={draft}
        placeholder="Add a tag"
        enterKeyHint="done"
        onChange={(e) => {
          if (e.target.value.endsWith(",")) add(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
      />
      <datalist id={listId}>
        {suggestions.filter((s) => !value.includes(s)).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
