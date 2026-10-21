import { useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import VoiceButton from "@journall/shared/components/VoiceButton";
import { useDictation } from "@journall/shared/hooks/useDictation";
import { appendDictatedSentence, ensureSentenceEnd } from "@journall/shared/lib/dictation";
import { showToast } from "@journall/shared/lib/toast";
import BackLink from "../components/BackLink";
import ChoiceChips from "../components/ChoiceChips";
import RecordPicker from "../components/RecordPicker";
import TagInput from "../components/TagInput";
import { createRecord, updateRecord, type NewRecord } from "../data/repo";
import { useAllTags, useCompanyOptions, useEngagementOptions, usePeopleOptions } from "../data/selectors";
import { useRecord, useStoreReady } from "../data/store";
import { blankCompany, blankNote, blankPerson } from "../lib/blanks";
import { fromLocalInput, toLocalInput } from "../lib/format";
import { NOTE_TYPES } from "../lib/labels";
import { deleteWithUndo } from "../lib/undoDelete";
import { useUnsavedGuard } from "../lib/useUnsavedGuard";
import type { Note, NoteType } from "../types";
import NotFound from "./NotFound";

type Draft = NewRecord<"notes">;

export default function NoteEditPage() {
  const { id } = useParams();
  const existing = useRecord("notes", id);
  const ready = useStoreReady();
  if (id && !existing) return ready ? <NotFound what="note" /> : null;
  return <NoteForm key={id ?? "new"} existing={existing} />;
}

function NoteForm({ existing }: { existing?: Note }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tags = useAllTags();
  const companyOptions = useCompanyOptions();
  const peopleOptions = usePeopleOptions();
  const engagementOptions = useEngagementOptions();

  const [draft, setDraft] = useState<Draft>(() => {
    if (existing) return { ...blankNote(), ...existing };
    const d = blankNote((params.get("type") as NoteType | null) ?? "general");
    const company = params.get("company");
    const person = params.get("person");
    if (company) d.companyIds = [company];
    if (person) d.personIds = [person];
    const engagement = params.get("engagement");
    if (engagement) d.engagementIds = [engagement];
    return d;
  });
  const [dirty, setDirty] = useState(false);
  useUnsavedGuard(dirty);

  function patch(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  }

  const setBody = (update: string | ((prev: string) => string)) => {
    setDraft((d) => ({ ...d, body: typeof update === "function" ? update(d.body) : update }));
    setDirty(true);
  };
  const dictation = useDictation(setBody, appendDictatedSentence, ensureSentenceEnd);

  // Back to wherever the note was started from.
  const returnTo = existing
    ? -1
    : params.get("engagement")
      ? `/engagements/${params.get("engagement")}`
      : params.get("company")
      ? `/companies/${params.get("company")}`
      : params.get("person")
        ? `/people/${params.get("person")}`
        : "/notes";

  // Usually the form was opened from the page it returns to, so step back
  // rather than stacking a second copy of that page in history.
  function leave() {
    const hasHistory = (window.history.state?.idx ?? 0) > 0;
    if (typeof returnTo === "number" || hasHistory) navigate(-1);
    else navigate(returnTo, { replace: true });
  }

  function save(e: FormEvent) {
    e.preventDefault();
    const body = draft.body.trim();
    if (!body) return;
    setDirty(false);
    if (existing) {
      updateRecord("notes", existing.id, { ...draft, body });
      showToast("Saved");
    } else {
      createRecord("notes", { ...draft, body });
      showToast("Note added");
    }
    leave();
  }

  return (
    <form className="page form" onSubmit={save}>
      <div className="page-head">
        <BackLink fallback="/notes" label="Cancel" />
        <h1>{existing ? "Edit note" : "New note"}</h1>
      </div>

      <div className="label">
        Type
        <ChoiceChips label="Note type" options={NOTE_TYPES.map((t) => ({ value: t.value, label: `${t.icon} ${t.label}` }))} value={draft.type} onChange={(type) => patch({ type })} />
        {draft.type === "if-i-go-back" && <p className="hint">Shown at the top of every company and person this note is linked to.</p>}
      </div>

      <label>
        <span className="label-row">
          Note
          <VoiceButton onTranscript={dictation.onTranscript} onDictationEnd={dictation.endSession} />
        </span>
        <textarea
          value={draft.body}
          onChange={(e) => setBody(e.target.value)}
          autoFocus={!existing}
          rows={6}
          placeholder={draft.type === "if-i-go-back" ? "e.g. Ring the main office on 01234 567890 and ask for Siobhán in bookings" : ""}
        />
      </label>

      <div className="label">
        Companies
        <RecordPicker options={companyOptions} selected={draft.companyIds} onChange={(companyIds) => patch({ companyIds })} placeholder="Link a company" onCreate={(name) => createRecord("companies", blankCompany(name))} />
      </div>

      <div className="label">
        People
        <RecordPicker options={peopleOptions} selected={draft.personIds} onChange={(personIds) => patch({ personIds })} placeholder="Link a person" onCreate={(name) => createRecord("people", blankPerson(name))} />
      </div>

      {(engagementOptions.length > 0 || draft.engagementIds.length > 0) && (
        <div className="label">
          Engagements
          <RecordPicker options={engagementOptions} selected={draft.engagementIds} onChange={(engagementIds) => patch({ engagementIds })} placeholder="Link an engagement" />
        </div>
      )}

      <div className="two">
        <label>
          When
          <input type="datetime-local" value={toLocalInput(draft.occurredAt)} onChange={(e) => patch({ occurredAt: fromLocalInput(e.target.value) })} />
        </label>
        <label className="check" style={{ alignSelf: "end" }}>
          <input type="checkbox" checked={draft.pinned} onChange={(e) => patch({ pinned: e.target.checked })} />
          📌 Pin to Home
        </label>
      </div>

      <div className="label">
        Tags
        <TagInput value={draft.tags} onChange={(t) => patch({ tags: t })} suggestions={tags} />
      </div>

      <div className="form-actions">
        <button type="submit" className="primary" disabled={!draft.body.trim()}>
          {existing ? "Save" : "Add note"}
        </button>
      </div>

      {existing && (
        <div className="danger-zone">
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (!window.confirm("Delete this note?")) return;
              setDirty(false);
              deleteWithUndo("notes", existing.id, "Note");
              navigate(-1);
            }}
          >
            Delete note
          </button>
        </div>
      )}
    </form>
  );
}
