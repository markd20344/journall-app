import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { showToast } from "@journall/shared/lib/toast";
import BackLink from "../components/BackLink";
import ChoiceChips from "../components/ChoiceChips";
import { createRecord, updateRecord, type NewRecord } from "../data/repo";
import { useRecord, useStoreReady } from "../data/store";
import { blankImportantDate } from "../lib/blanks";
import { daysInMonth, monthName } from "../lib/dates";
import { personName } from "../lib/format";
import { DATE_KINDS, WARN_DAY_OPTIONS } from "../lib/labels";
import { deleteWithUndo } from "../lib/undoDelete";
import { useUnsavedGuard } from "../lib/useUnsavedGuard";
import type { ImportantDate } from "../types";
import NotFound from "./NotFound";

type Draft = NewRecord<"importantDates">;

// Routes: /people/:personId/dates/new and /dates/:id/edit
export default function DateEditPage() {
  const { id, personId } = useParams();
  const existing = useRecord("importantDates", id);
  const ready = useStoreReady();
  if (id && !existing) return ready ? <NotFound what="date" /> : null;
  return <DateForm key={id ?? "new"} existing={existing} personId={existing?.personId ?? personId ?? ""} />;
}

function DateForm({ existing, personId }: { existing?: ImportantDate; personId: string }) {
  const navigate = useNavigate();
  const person = useRecord("people", personId);
  const [draft, setDraft] = useState<Draft>(() => (existing ? { ...blankImportantDate(personId), ...existing } : blankImportantDate(personId)));
  const [yearText, setYearText] = useState(existing?.year ? String(existing.year) : "");
  const [dirty, setDirty] = useState(false);
  useUnsavedGuard(dirty);

  function patch(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  }

  // 2000 is a leap year, so 29 Feb stays selectable.
  const maxDay = daysInMonth(2000, draft.month);
  const year = yearText.trim() ? Number(yearText) : null;
  const yearValid = year === null || (Number.isInteger(year) && year >= 1900 && year <= new Date().getFullYear() + 1);
  const valid = Boolean(personId) && draft.day <= maxDay && yearValid;

  function save(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const clean: Draft = { ...draft, label: draft.label.trim(), year, warnDays: [...draft.warnDays].sort((a, b) => b - a) };
    setDirty(false);
    if (existing) updateRecord("importantDates", existing.id, clean);
    else createRecord("importantDates", clean);
    showToast(existing ? "Saved" : "Date added");
    navigate(`/people/${personId}`, { replace: true });
  }

  return (
    <form className="page form" onSubmit={save}>
      <div className="page-head">
        <BackLink fallback={`/people/${personId}`} label="Cancel" />
        <h1>{existing ? "Edit date" : "New date"}</h1>
      </div>
      {person && <p className="hint" style={{ fontSize: "1rem" }}>For {personName(person)}</p>}

      <div className="label">
        What is it?
        <ChoiceChips label="Kind" options={DATE_KINDS.map((k) => ({ value: k.value, label: `${k.icon} ${k.label}` }))} value={draft.kind} onChange={(kind) => patch({ kind })} />
      </div>

      {draft.kind !== "birthday" && (
        <label>
          Label
          <input type="text" value={draft.label} onChange={(e) => patch({ label: e.target.value })} placeholder={draft.kind === "anniversary" ? "e.g. Wedding anniversary" : "e.g. Name day"} />
        </label>
      )}

      <div className="two">
        <label>
          Day
          <select value={draft.day} onChange={(e) => patch({ day: Number(e.target.value) })}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d} disabled={d > maxDay}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          Month
          <select value={draft.month} onChange={(e) => patch({ month: Number(e.target.value), day: Math.min(draft.day, daysInMonth(2000, Number(e.target.value))) })}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Year (optional)
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={yearText}
          onChange={(e) => {
            setYearText(e.target.value.replace(/\D/g, ""));
            setDirty(true);
          }}
          placeholder={draft.kind === "birthday" ? "So Mumu can show their age" : "So Mumu can count the years"}
        />
      </label>
      {!yearValid && <p className="auth-error">That doesn't look like a year.</p>}

      <fieldset>
        <legend>Remind me</legend>
        <div className="chips" role="group" aria-label="Remind me">
          {WARN_DAY_OPTIONS.map((o) => {
            const on = draft.warnDays.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                className={`chip${on ? " on" : ""}`}
                onClick={() => patch({ warnDays: on ? draft.warnDays.filter((d) => d !== o.value) : [...draft.warnDays, o.value] })}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <p className="hint">Shown on Home now; emailed to you once the daily digest is set up (Phase 4).</p>
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="primary" disabled={!valid}>
          {existing ? "Save" : "Add date"}
        </button>
      </div>

      {existing && (
        <div className="danger-zone">
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (!window.confirm("Delete this date?")) return;
              setDirty(false);
              deleteWithUndo("importantDates", existing.id, "Date");
              navigate(`/people/${personId}`, { replace: true });
            }}
          >
            Delete date
          </button>
        </div>
      )}
    </form>
  );
}
