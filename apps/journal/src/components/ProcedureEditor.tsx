import { useState } from "react";
import type { Procedure, ProcedureStep } from "../types";
import {
  addProcedureStep,
  createProcedure,
  deleteProcedure,
  deleteProcedureStep,
  markProcedureUsed,
  moveProcedureStep,
  updateProcedure,
  updateProcedureStep,
} from "../db/repo";
import { useCategories } from "../hooks/useJournalData";
import { appendDictatedPhrase, appendDictatedSentence, ensureSentenceEnd } from "@journall/shared/lib/dictation";
import { useDictation } from "@journall/shared/hooks/useDictation";
import { showToast } from "@journall/shared/lib/toast";
import { schedulePendingDelete, cancelPendingDelete } from "@journall/shared/lib/pendingDelete";
import VoiceButton from "@journall/shared/components/VoiceButton";
import Dropdown from "@journall/shared/components/Dropdown";

interface Props {
  procedure?: Procedure;
  onSaved?: (procedure: Procedure) => void;
  onCancel?: () => void;
  onDeleted?: () => void;
}

export default function ProcedureEditor({ procedure, onSaved, onCancel, onDeleted }: Props) {
  const [title, setTitle] = useState(procedure?.title ?? "");
  const { onTranscript: onTitleTranscript, endSession: endTitleDictation } = useDictation(setTitle, appendDictatedPhrase);
  const [categoryId, setCategoryId] = useState(procedure?.categoryId ?? "");
  const [notes, setNotes] = useState(procedure?.notes ?? "");
  const { onTranscript: onNotesTranscript, endSession: endNotesDictation } = useDictation(
    setNotes,
    appendDictatedSentence,
    ensureSentenceEnd,
  );
  const [saving, setSaving] = useState(false);

  const [steps, setSteps] = useState<ProcedureStep[]>(procedure?.steps ?? []);
  const [newStepText, setNewStepText] = useState("");
  const { onTranscript: onStepTranscript, endSession: endStepDictation } = useDictation(setNewStepText, appendDictatedPhrase);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingStepText, setEditingStepText] = useState("");
  const [lastUsedAt, setLastUsedAt] = useState(procedure?.lastUsedAt ?? null);

  const categories = useCategories();

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const finalCategoryId = categoryId || null;
      if (procedure) {
        await updateProcedure(procedure.id, { title: title.trim(), categoryId: finalCategoryId, notes });
        showToast("Procedure saved");
        onSaved?.({ ...procedure, title: title.trim(), categoryId: finalCategoryId, notes });
      } else {
        const created = await createProcedure({ title: title.trim(), categoryId: finalCategoryId, notes });
        showToast("Procedure added");
        onSaved?.(created);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!procedure) return;
    const id = procedure.id;
    const procedureTitle = procedure.title;
    schedulePendingDelete("procedure", id, () => deleteProcedure(id));
    showToast(`Deleted "${procedureTitle}"`, {
      action: { label: "Undo", onClick: () => cancelPendingDelete("procedure", id) },
      durationMs: 5000,
    });
    onDeleted?.();
  }

  async function handleAddStep() {
    if (!procedure || !newStepText.trim()) return;
    const created = await addProcedureStep(procedure.id, newStepText);
    if (created) setSteps((prev) => [...prev, created]);
    setNewStepText("");
  }

  function startEditingStep(stepId: string, text: string) {
    setEditingStepId(stepId);
    setEditingStepText(text);
  }

  async function saveEditingStep() {
    if (!procedure || !editingStepId) return;
    const trimmed = editingStepText.trim();
    if (trimmed) {
      await updateProcedureStep(procedure.id, editingStepId, trimmed);
      setSteps((prev) => prev.map((s) => (s.id === editingStepId ? { ...s, text: trimmed } : s)));
    }
    setEditingStepId(null);
    setEditingStepText("");
  }

  async function removeStep(stepId: string) {
    if (!procedure) return;
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
    await deleteProcedureStep(procedure.id, stepId);
  }

  async function moveStep(stepId: string, direction: "up" | "down") {
    if (!procedure) return;
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === stepId);
      const swapWith = direction === "up" ? idx - 1 : idx + 1;
      if (idx === -1 || swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
    await moveProcedureStep(procedure.id, stepId, direction);
  }

  async function handleMarkUsed() {
    if (!procedure) return;
    await markProcedureUsed(procedure.id);
    setLastUsedAt(new Date().toISOString());
    showToast("Marked as used today");
  }

  return (
    <div className="item-editor procedure-editor">
      <input
        type="text"
        className="item-title-input"
        placeholder="Procedure title — e.g. Post an eBay sale via Evri"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoCapitalize="sentences"
        spellCheck
        autoFocus
      />
      <div className="field-voice-row">
        <VoiceButton onTranscript={onTitleTranscript} onDictationEnd={endTitleDictation} />
      </div>

      <label className="field">
        <span className="field-label">Category</span>
        <Dropdown
          value={categoryId}
          onChange={setCategoryId}
          options={[{ value: "", label: "No category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        />
      </label>

      {procedure ? (
        <div className="link-section">
          <div className="field-label-row">
            <span className="field-label">Steps</span>
            <button type="button" className="ghost" onClick={() => void handleMarkUsed()}>
              ✓ I used this
            </button>
          </div>
          {lastUsedAt && <p className="settings-hint small">Last used {new Date(lastUsedAt).toLocaleDateString()}.</p>}
          {steps.length > 0 ? (
            <ol className="procedure-step-list">
              {steps.map((step, idx) => (
                <li key={step.id} className="procedure-step-row">
                  <span className="procedure-step-number">{idx + 1}</span>
                  {editingStepId === step.id ? (
                    <input
                      autoFocus
                      type="text"
                      className="procedure-step-input"
                      value={editingStepText}
                      onChange={(e) => setEditingStepText(e.target.value)}
                      onBlur={() => void saveEditingStep()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void saveEditingStep();
                        } else if (e.key === "Escape") {
                          setEditingStepId(null);
                        }
                      }}
                    />
                  ) : (
                    <button type="button" className="procedure-step-text" onClick={() => startEditingStep(step.id, step.text)}>
                      {step.text}
                    </button>
                  )}
                  <div className="procedure-step-actions">
                    <button
                      type="button"
                      className="ghost step-reorder-btn"
                      disabled={idx === 0}
                      aria-label="Move step up"
                      onClick={() => void moveStep(step.id, "up")}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="ghost step-reorder-btn"
                      disabled={idx === steps.length - 1}
                      aria-label="Move step down"
                      onClick={() => void moveStep(step.id, "down")}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="chip-remove"
                      aria-label={`Delete step ${idx + 1}`}
                      onClick={() => void removeStep(step.id)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="settings-hint small">No steps yet — dictate or type the first one below.</p>
          )}
          <div className="add-link-row procedure-add-step-row">
            <input
              type="text"
              placeholder="Next step…"
              value={newStepText}
              onChange={(e) => setNewStepText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAddStep();
                }
              }}
            />
            <VoiceButton onTranscript={onStepTranscript} onDictationEnd={endStepDictation} />
            <button type="button" disabled={!newStepText.trim()} onClick={() => void handleAddStep()}>
              Add step
            </button>
          </div>
        </div>
      ) : (
        <p className="settings-hint small">Save this procedure first, then dictate the steps one at a time.</p>
      )}

      <div className="field">
        <span className="field-label">Notes</span>
        <textarea
          className="entry-body book-notes"
          placeholder="Anything that doesn't fit as a step — gotchas, timing, account details to check…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          autoCapitalize="sentences"
          spellCheck
          rows={3}
        />
        <div className="field-voice-row">
          <VoiceButton onTranscript={onNotesTranscript} onDictationEnd={endNotesDictation} />
        </div>
      </div>

      <div className="entry-editor-actions">
        <button type="button" className="primary" disabled={saving || !title.trim()} onClick={() => void handleSave()}>
          {procedure ? "Save changes" : "Create procedure"}
        </button>
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        {procedure && (
          <button type="button" className="danger" onClick={handleDelete}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
