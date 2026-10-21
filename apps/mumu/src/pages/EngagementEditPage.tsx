import { useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { showToast } from "@journall/shared/lib/toast";
import BackLink from "../components/BackLink";
import RecordPicker from "../components/RecordPicker";
import TagInput from "../components/TagInput";
import { createRecord, updateRecord, type NewRecord } from "../data/repo";
import { useAllTags, useCompanyOptions, usePeopleOptions } from "../data/selectors";
import { useRecord, useStoreReady } from "../data/store";
import { blankCompany, blankEngagement, blankPerson } from "../lib/blanks";
import { deleteWithUndo } from "../lib/undoDelete";
import { useUnsavedGuard } from "../lib/useUnsavedGuard";
import type { Engagement } from "../types";
import NotFound from "./NotFound";

type Draft = NewRecord<"engagements">;

export default function EngagementEditPage() {
  const { id } = useParams();
  const existing = useRecord("engagements", id);
  const ready = useStoreReady();
  if (id && !existing) return ready ? <NotFound what="engagement" /> : null;
  return <EngagementForm key={id ?? "new"} existing={existing} />;
}

/** Single choice from a RecordPicker: the most recently picked id wins. */
function single(ids: string[]): string | null {
  return ids.length ? ids[ids.length - 1] : null;
}

function EngagementForm({ existing }: { existing?: Engagement }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tags = useAllTags();
  const companyOptions = useCompanyOptions();
  const peopleOptions = usePeopleOptions();
  const [draft, setDraft] = useState<Draft>(() => (existing ? { ...blankEngagement(), ...existing } : blankEngagement(params.get("company") ?? "")));
  const [ongoing, setOngoing] = useState(existing ? existing.endDate === null : true);
  const [dirty, setDirty] = useState(false);
  useUnsavedGuard(dirty);

  function patch(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  }

  const endBeforeStart = !ongoing && !!draft.endDate && draft.endDate < draft.startDate;
  const valid = Boolean(draft.companyId && draft.startDate && (ongoing || draft.endDate) && !endBeforeStart);

  function save(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const clean: Draft = {
      ...draft,
      title: draft.title.trim(),
      myRole: draft.myRole.trim(),
      rate: draft.rate.trim(),
      endDate: ongoing ? null : draft.endDate,
    };
    setDirty(false);
    if (existing) {
      updateRecord("engagements", existing.id, clean);
      showToast("Saved");
      navigate(`/engagements/${existing.id}`, { replace: true });
    } else {
      const id = createRecord("engagements", clean);
      showToast("Engagement added");
      navigate(`/engagements/${id}`, { replace: true });
    }
  }

  return (
    <form className="page form" onSubmit={save}>
      <div className="page-head">
        <BackLink fallback={existing ? `/engagements/${existing.id}` : "/engagements"} label="Cancel" />
        <h1>{existing ? "Edit engagement" : "New engagement"}</h1>
      </div>

      <div className="label">
        Company
        <RecordPicker
          options={companyOptions}
          selected={draft.companyId ? [draft.companyId] : []}
          onChange={(ids) => patch({ companyId: single(ids) ?? "" })}
          placeholder="Who was it for?"
          onCreate={(name) => createRecord("companies", { ...blankCompany(name), type: "client" })}
        />
      </div>

      <label>
        Job / project name
        <input type="text" value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Mallow resignalling" />
      </label>

      <label>
        My role
        <input type="text" value={draft.myRole} onChange={(e) => patch({ myRole: e.target.value })} placeholder="e.g. Site supervisor" />
      </label>

      <label>
        Started
        <input type="date" value={draft.startDate} onChange={(e) => patch({ startDate: e.target.value })} required />
      </label>
      <label className="check">
        <input type="checkbox" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} />
        Still going
      </label>
      {!ongoing && (
        <label>
          Finished
          <input type="date" value={draft.endDate ?? ""} min={draft.startDate} onChange={(e) => patch({ endDate: e.target.value || null })} required />
        </label>
      )}
      {endBeforeStart && <p className="auth-error">The finish date is before the start date.</p>}

      <label>
        What I did
        <textarea value={draft.whatIDid} onChange={(e) => patch({ whatIDid: e.target.value })} placeholder="The work, the kit, the site, what went well, what to know next time" />
      </label>

      <label>
        How I got it
        <textarea rows={3} style={{ minHeight: 90 }} value={draft.howIGotIt} onChange={(e) => patch({ howIGotIt: e.target.value })} placeholder="e.g. Rang the agency after seeing it on Indeed" />
      </label>

      <div className="two">
        <div className="label">
          Via agency
          <RecordPicker
            options={companyOptions}
            selected={draft.viaCompanyId ? [draft.viaCompanyId] : []}
            onChange={(ids) => patch({ viaCompanyId: single(ids) })}
            placeholder="Agency (optional)"
            onCreate={(name) => createRecord("companies", { ...blankCompany(name), type: "agency" })}
          />
        </div>
        <div className="label">
          Via person
          <RecordPicker
            options={peopleOptions}
            selected={draft.viaPersonId ? [draft.viaPersonId] : []}
            onChange={(ids) => patch({ viaPersonId: single(ids) })}
            placeholder="Recruiter (optional)"
            onCreate={(name) => createRecord("people", blankPerson(name))}
          />
        </div>
      </div>

      <div className="label">
        Key contacts
        <RecordPicker
          options={peopleOptions}
          selected={draft.keyContactIds}
          onChange={(keyContactIds) => patch({ keyContactIds })}
          placeholder="People you dealt with"
          onCreate={(name) => createRecord("people", blankPerson(name))}
        />
      </div>

      <label>
        Rate
        <input type="text" value={draft.rate} onChange={(e) => patch({ rate: e.target.value })} placeholder="e.g. £350/day" />
      </label>

      <div className="label">
        Tags
        <TagInput value={draft.tags} onChange={(t) => patch({ tags: t })} suggestions={tags} />
      </div>

      <div className="form-actions">
        <button type="submit" className="primary" disabled={!valid}>
          {existing ? "Save" : "Add engagement"}
        </button>
      </div>

      {existing && (
        <div className="danger-zone">
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (!window.confirm("Delete this engagement? Its notes are kept.")) return;
              setDirty(false);
              deleteWithUndo("engagements", existing.id, "Engagement");
              navigate("/engagements", { replace: true });
            }}
          >
            Delete engagement
          </button>
        </div>
      )}
    </form>
  );
}
