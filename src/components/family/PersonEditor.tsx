import { useState } from "react";
import type { PersonInput } from "../../family/repo";
import type { Gender } from "../../types/family";
import PartialDateInput from "./PartialDateInput";

interface Props {
  initial: PersonInput;
  title: string;
  onSave: (input: PersonInput) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}

const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: "unknown", label: "Unknown" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

export default function PersonEditor({ initial, title, onSave, onCancel, onDelete }: Props) {
  const [input, setInput] = useState<PersonInput>(initial);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof PersonInput>(key: K, value: PersonInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(input);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="family-editor">
      <h2 className="page-title">{title}</h2>

      <div className="family-editor-grid">
        <label className="field">
          <span className="field-label">First name</span>
          <input value={input.firstName} onChange={(e) => set("firstName", e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span className="field-label">Middle name</span>
          <input value={input.middleName} onChange={(e) => set("middleName", e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Last name</span>
          <input value={input.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Maiden name</span>
          <input value={input.maidenName} onChange={(e) => set("maidenName", e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Gender</span>
          <select value={input.gender} onChange={(e) => set("gender", e.target.value as Gender)}>
            {GENDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="family-editor-grid">
        <PartialDateInput label="Born" value={input.birth} onChange={(d) => set("birth", d)} />
        <label className="field">
          <span className="field-label">Birth place</span>
          <input value={input.birthPlace} onChange={(e) => set("birthPlace", e.target.value)} placeholder="City, County, Country" />
        </label>
        <PartialDateInput label="Died" value={input.death} onChange={(d) => set("death", d)} />
        <label className="field">
          <span className="field-label">Death place</span>
          <input value={input.deathPlace} onChange={(e) => set("deathPlace", e.target.value)} placeholder="City, County, Country" />
        </label>
      </div>

      <label className="field">
        <span className="field-label">Notes / biography</span>
        <textarea value={input.notes} onChange={(e) => set("notes", e.target.value)} rows={5} />
      </label>

      <div className="entry-editor-actions">
        <button type="button" className="primary" disabled={saving} onClick={() => void handleSave()}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
        {onDelete && (
          <button type="button" className="danger" onClick={onDelete}>
            Delete person
          </button>
        )}
      </div>
    </div>
  );
}
