import { useState, type FormEvent } from "react";
import { format } from "date-fns";
import { useAllQuickCaptures } from "../hooks/useJournalData";
import { addQuickCapture, deleteQuickCapture } from "../db/repo";
import { schedulePendingDelete, cancelPendingDelete } from "@journall/shared/lib/pendingDelete";
import { showToast } from "@journall/shared/lib/toast";

// Zero-friction capture: type a word or a stray thought, hit Enter, done —
// no category, no kind, no due date to pick first. Lives at the top of
// Today since that's the moment this is for (open the app, jot it down,
// get back to whatever you were doing), not tucked behind a form.
export default function QuickCapture() {
  const [text, setText] = useState("");
  const captures = useAllQuickCaptures();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    await addQuickCapture(trimmed);
  }

  function handleDelete(id: string, capturedText: string) {
    schedulePendingDelete("quickCapture", id, () => deleteQuickCapture(id));
    showToast(`Deleted "${capturedText}"`, {
      action: { label: "Undo", onClick: () => cancelPendingDelete("quickCapture", id) },
      durationMs: 5000,
    });
  }

  return (
    <section className="today-section quick-capture-section">
      <form className="quick-capture-form" onSubmit={(e) => void handleSubmit(e)}>
        <input
          type="text"
          className="quick-capture-input"
          placeholder="Quick capture — a word, a thought, anything…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoCapitalize="sentences"
          spellCheck
        />
        <button type="submit" className="primary" disabled={!text.trim()}>
          Add
        </button>
      </form>

      {captures.length > 0 && (
        <ul className="quick-capture-list">
          {captures.map((c) => (
            <li key={c.id} className="quick-capture-row">
              <span className="quick-capture-time">{format(new Date(c.createdAt), "MMM d, h:mm a")}</span>
              <span className="quick-capture-text">{c.text}</span>
              <button
                type="button"
                className="chip-remove"
                aria-label={`Delete ${c.text}`}
                onClick={() => handleDelete(c.id, c.text)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
