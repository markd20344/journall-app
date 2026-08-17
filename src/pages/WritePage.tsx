import { useState } from "react";
import EntryEditor from "../components/EntryEditor";
import type { Entry } from "../types";

export default function WritePage() {
  const [savedEntry, setSavedEntry] = useState<Entry | null>(null);
  const [key, setKey] = useState(0);

  function startNewEntry() {
    setSavedEntry(null);
    setKey((k) => k + 1);
  }

  return (
    <div className="page write-page">
      <div className="write-page-header">
        <h1 className="page-title">Journal</h1>
        {savedEntry && (
          <button type="button" className="ghost" onClick={startNewEntry}>
            + Write new entry
          </button>
        )}
      </div>

      {savedEntry && (
        <div className="saved-banner">Saved. Add a lesson, action, risk or other note below if useful, or start a new entry.</div>
      )}

      <EntryEditor
        key={key}
        entry={savedEntry ?? undefined}
        onSaved={(entry) => setSavedEntry(entry)}
        onDeleted={startNewEntry}
      />
    </div>
  );
}
