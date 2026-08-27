import { useState } from "react";
import type { Person, ParentChildSubtype, SpouseEndReason, SpouseSubtype } from "../../types/family";
import { emptyDate } from "../../types/family";
import { createPerson, createRelationship, emptyPersonInput, type RelationshipInput } from "../../family/repo";
import PersonPicker from "./PersonPicker";
import PartialDateInput from "./PartialDateInput";
import { showToast } from "../../lib/toast";

export type RelationshipMode = "add-parent" | "add-child" | "add-spouse";

interface Props {
  mode: RelationshipMode;
  anchorPersonId: string;
  people: Person[];
  uid: string;
  onDone: () => void;
  onCancel: () => void;
}

const MODE_TITLE: Record<RelationshipMode, string> = {
  "add-parent": "Add a parent",
  "add-child": "Add a child",
  "add-spouse": "Add a spouse / partner",
};

export default function RelationshipEditor({ mode, anchorPersonId, people, uid, onDone, onCancel }: Props) {
  const [other, setOther] = useState<Person | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [parentSubtype, setParentSubtype] = useState<ParentChildSubtype>("biological");
  const [spouseSubtype, setSpouseSubtype] = useState<SpouseSubtype>("married");
  const [startDate, setStartDate] = useState(emptyDate());
  const [startPlace, setStartPlace] = useState("");
  const [ended, setEnded] = useState(false);
  const [endDate, setEndDate] = useState(emptyDate());
  const [endReason, setEndReason] = useState<SpouseEndReason>("divorced");
  const [saving, setSaving] = useState(false);

  async function handleCreateNew() {
    if (!newFirstName.trim() && !newLastName.trim()) return;
    const person = await createPerson({ ...emptyPersonInput(), firstName: newFirstName.trim(), lastName: newLastName.trim() }, uid);
    setOther(person);
    setCreatingNew(false);
  }

  async function handleSave() {
    if (!other) return;
    setSaving(true);
    try {
      const input: RelationshipInput =
        mode === "add-spouse"
          ? {
              type: "spouse",
              personA: anchorPersonId,
              personB: other.id,
              subtype: spouseSubtype,
              startDate,
              startPlace,
              endDate: ended ? endDate : emptyDate(),
              endReason: ended ? endReason : null,
            }
          : {
              type: "parent-child",
              personA: mode === "add-parent" ? other.id : anchorPersonId,
              personB: mode === "add-parent" ? anchorPersonId : other.id,
              subtype: parentSubtype,
              startDate: emptyDate(),
              startPlace: "",
              endDate: emptyDate(),
              endReason: null,
            };
      await createRelationship(input);
      showToast("Relationship added");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="family-editor">
      <h2 className="page-title">{MODE_TITLE[mode]}</h2>

      {!other ? (
        creatingNew ? (
          <div className="family-editor-grid">
            <label className="field">
              <span className="field-label">First name</span>
              <input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} autoFocus />
            </label>
            <label className="field">
              <span className="field-label">Last name</span>
              <input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
            </label>
            <div className="entry-editor-actions">
              <button type="button" className="primary" onClick={() => void handleCreateNew()}>
                Create person
              </button>
              <button type="button" className="ghost" onClick={() => setCreatingNew(false)}>
                Back to search
              </button>
            </div>
          </div>
        ) : (
          <>
            <PersonPicker people={people} excludeIds={[anchorPersonId]} onPick={setOther} />
            <button type="button" className="ghost" onClick={() => setCreatingNew(true)}>
              + This person isn't in the tree yet
            </button>
          </>
        )
      ) : (
        <>
          <p className="result-count">Linking to: {other.firstName} {other.lastName}</p>

          {mode === "add-spouse" ? (
            <>
              <label className="field">
                <span className="field-label">Relationship</span>
                <select value={spouseSubtype} onChange={(e) => setSpouseSubtype(e.target.value as SpouseSubtype)}>
                  <option value="married">Married</option>
                  <option value="partnered">Partnered</option>
                </select>
              </label>
              <div className="family-editor-grid">
                <PartialDateInput label="Start date" value={startDate} onChange={setStartDate} />
                <label className="field">
                  <span className="field-label">Place</span>
                  <input value={startPlace} onChange={(e) => setStartPlace(e.target.value)} />
                </label>
              </div>
              <label className="checkbox-field">
                <input type="checkbox" checked={ended} onChange={(e) => setEnded(e.target.checked)} />
                <span>This relationship ended (divorce, death, separation)</span>
              </label>
              {ended && (
                <div className="family-editor-grid">
                  <PartialDateInput label="End date" value={endDate} onChange={setEndDate} />
                  <label className="field">
                    <span className="field-label">Reason</span>
                    <select value={endReason} onChange={(e) => setEndReason(e.target.value as SpouseEndReason)}>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                      <option value="separated">Separated</option>
                    </select>
                  </label>
                </div>
              )}
            </>
          ) : (
            <label className="field">
              <span className="field-label">Relationship</span>
              <select value={parentSubtype} onChange={(e) => setParentSubtype(e.target.value as ParentChildSubtype)}>
                <option value="biological">Biological</option>
                <option value="adopted">Adopted</option>
                <option value="step">Step</option>
              </select>
            </label>
          )}

          <div className="entry-editor-actions">
            <button type="button" className="primary" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="ghost" onClick={() => setOther(null)}>
              Choose someone else
            </button>
          </div>
        </>
      )}

      <div className="entry-editor-actions">
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
