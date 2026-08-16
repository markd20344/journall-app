import { useMemo, useState } from "react";
import type { Topic } from "../types";
import { appendDictatedPhrase } from "../lib/dictation";
import VoiceButton from "./VoiceButton";

interface Props {
  availableTopics: Topic[];
  selected: string[]; // topic names
  onChange: (names: string[]) => void;
}

export default function TopicTagInput({ availableTopics, selected, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    return availableTopics
      .map((t) => t.name)
      .filter((name) => !selected.some((s) => s.toLowerCase() === name.toLowerCase()))
      .filter((name) => (q ? name.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [availableTopics, draft, selected]);

  function addTopic(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (selected.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...selected, trimmed]);
    setDraft("");
  }

  function removeTopic(name: string) {
    onChange(selected.filter((s) => s !== name));
  }

  return (
    <div className="topic-input">
      <div className="topic-chips">
        {selected.map((name) => (
          <span className="chip" key={name}>
            {name}
            <button
              type="button"
              className="chip-remove"
              aria-label={`Remove ${name}`}
              onClick={() => removeTopic(name)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          placeholder={selected.length === 0 ? "Add topics (e.g. Diet, Sleep)…" : "Add another…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTopic(draft);
            } else if (e.key === "Backspace" && draft === "" && selected.length > 0) {
              removeTopic(selected[selected.length - 1]);
            }
          }}
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <ul className="topic-suggestions">
          {suggestions.map((name) => (
            <li key={name}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => addTopic(name)}>
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="field-voice-row">
        <VoiceButton onTranscript={(text) => setDraft((prev) => appendDictatedPhrase(prev, text))} />
      </div>
    </div>
  );
}
