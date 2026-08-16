import { useState } from "react";
import EntryEditor from "../components/EntryEditor";
import type { Entry } from "../types";

export default function WritePage() {
  const [justSaved, setJustSaved] = useState<Entry | null>(null);
  const [key, setKey] = useState(0);

  return (
    <div className="page write-page">
      <h1 className="page-title">Write</h1>
      {justSaved && (
        <div className="saved-banner">
          Saved to {justSaved.date}. <button type="button" className="link" onClick={() => setJustSaved(null)}>Dismiss</button>
        </div>
      )}
      <EntryEditor
        key={key}
        onSaved={(entry) => {
          setJustSaved(entry);
          setKey((k) => k + 1);
        }}
      />
    </div>
  );
}
