import { useState } from "react";
import { emptyDate } from "../../types/family";
import type { PartialDate } from "../../types/family";
import { createEvent, updateEvent, type EventInput } from "../../family/repo";
import PartialDateInput from "./PartialDateInput";
import { showToast } from "../../lib/toast";

interface Props {
  personId: string;
  initial?: EventInput;
  eventId?: string;
  onDone: () => void;
  onCancel: () => void;
}

// User-created timeline entries are always "custom" — birth/marriage/death
// entries in the timeline are derived read-only from the person's own facts
// and their spouse relationships (see EventTimeline), so there's no
// separate stored record for those to avoid the two copies drifting apart.
export default function EventEditor({ personId, initial, eventId, onDone, onCancel }: Props) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [date, setDate] = useState<PartialDate>(initial?.date ?? emptyDate());
  const [place, setPlace] = useState(initial?.place ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!label.trim()) return;
    setSaving(true);
    try {
      const input: EventInput = { personId, type: "custom", label: label.trim(), date, place, note };
      if (eventId) {
        await updateEvent(eventId, input);
      } else {
        await createEvent(input);
      }
      showToast("Event saved");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="family-editor">
      <h2 className="page-title">{eventId ? "Edit event" : "Add an event"}</h2>
      <label className="field">
        <span className="field-label">What happened</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Emigrated to Canada" autoFocus />
      </label>
      <div className="family-editor-grid">
        <PartialDateInput label="Date" value={date} onChange={setDate} />
        <label className="field">
          <span className="field-label">Place</span>
          <input value={place} onChange={(e) => setPlace(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Note</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </label>
      <div className="entry-editor-actions">
        <button type="button" className="primary" disabled={saving || !label.trim()} onClick={() => void handleSave()}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
