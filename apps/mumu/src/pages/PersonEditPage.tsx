import { useId, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { showToast } from "@journall/shared/lib/toast";
import BackLink from "../components/BackLink";
import ChoiceChips from "../components/ChoiceChips";
import RecordPicker from "../components/RecordPicker";
import TagInput from "../components/TagInput";
import { createRecord, updateRecord, type NewRecord } from "../data/repo";
import { useAllTags, useCompanyOptions } from "../data/selectors";
import { getRecord, useRecord, useStoreReady } from "../data/store";
import { blankCompany, blankEmail, blankPerson, blankPhone } from "../lib/blanks";
import { personName } from "../lib/format";
import { CIRCLES, EMAIL_LABELS, PHONE_LABELS } from "../lib/labels";
import { deleteWithUndo } from "../lib/undoDelete";
import { useUnsavedGuard } from "../lib/useUnsavedGuard";
import type { Person } from "../types";
import NotFound from "./NotFound";

type Draft = NewRecord<"people">;

function toDraft(p: Person): Draft {
  return { ...blankPerson(), ...p };
}

export default function PersonEditPage() {
  const { id } = useParams();
  const existing = useRecord("people", id);
  const ready = useStoreReady();
  if (id && !existing) return ready ? <NotFound what="person" /> : null;
  return <PersonForm key={id ?? "new"} existing={existing} />;
}

function PersonForm({ existing }: { existing?: Person }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tags = useAllTags();
  const companyOptions = useCompanyOptions();
  const phoneListId = useId();
  const emailListId = useId();

  const [draft, setDraft] = useState<Draft>(() => {
    if (existing) {
      const d = toDraft(existing);
      return { ...d, phones: d.phones.length ? d.phones : [blankPhone()], emails: d.emails.length ? d.emails : [blankEmail()] };
    }
    const d = blankPerson();
    const companyId = params.get("company");
    if (companyId) d.companyLinks = [{ companyId, role: "", current: true }];
    return { ...d, phones: [blankPhone()], emails: [blankEmail()] };
  });
  const [dirty, setDirty] = useState(false);
  useUnsavedGuard(dirty);

  function patch(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  }

  const hasName = Boolean(draft.firstName.trim() || draft.lastName.trim() || draft.nickname.trim());

  function save(e: FormEvent) {
    e.preventDefault();
    if (!hasName) return;
    const clean: Draft = {
      ...draft,
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      nickname: draft.nickname.trim(),
      relationship: draft.relationship.trim(),
      phones: draft.phones.filter((p) => p.number.trim()).map((p) => ({ ...p, number: p.number.trim(), label: p.label.trim() || "mobile" })),
      emails: draft.emails.filter((x) => x.address.trim()).map((x) => ({ ...x, address: x.address.trim(), label: x.label.trim() || "personal" })),
      companyLinks: draft.companyLinks.map((l) => ({ ...l, role: l.role.trim() })),
      companyIds: draft.companyLinks.map((l) => l.companyId),
    };
    setDirty(false);
    if (existing) {
      updateRecord("people", existing.id, clean);
      showToast("Saved");
      navigate(`/people/${existing.id}`, { replace: true });
    } else {
      const newId = createRecord("people", clean);
      showToast("Person added");
      navigate(`/people/${newId}`, { replace: true });
    }
  }

  return (
    <form className="page form" onSubmit={save}>
      <div className="page-head">
        <BackLink fallback={existing ? `/people/${existing.id}` : "/people"} label="Cancel" />
        <h1>{existing ? "Edit person" : "New person"}</h1>
      </div>

      <div className="two">
        <label>
          First name
          <input type="text" value={draft.firstName} onChange={(e) => patch({ firstName: e.target.value })} autoFocus={!existing} autoCapitalize="words" autoComplete="off" />
        </label>
        <label>
          Last name
          <input type="text" value={draft.lastName} onChange={(e) => patch({ lastName: e.target.value })} autoCapitalize="words" autoComplete="off" />
        </label>
      </div>

      <div className="label">
        Circle
        <ChoiceChips label="Circle" options={CIRCLES} value={draft.circle} onChange={(circle) => patch({ circle })} />
      </div>

      <div className="two">
        <label>
          Known as
          <input type="text" value={draft.nickname} onChange={(e) => patch({ nickname: e.target.value })} placeholder="Nickname" />
        </label>
        <label>
          Relationship
          <input type="text" value={draft.relationship} onChange={(e) => patch({ relationship: e.target.value })} placeholder="e.g. Cousin, School friend" />
        </label>
      </div>

      <fieldset>
        <legend>Phone numbers</legend>
        <datalist id={phoneListId}>
          {PHONE_LABELS.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
        {draft.phones.map((p, i) => (
          <div key={p.id} className="multi-row">
            <input type="text" aria-label="Label" list={phoneListId} value={p.label} onChange={(e) => patch({ phones: draft.phones.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <input type="tel" aria-label="Number" inputMode="tel" value={p.number} onChange={(e) => patch({ phones: draft.phones.map((x, j) => (j === i ? { ...x, number: e.target.value } : x)) })} placeholder="07700 900123" />
            <button type="button" className="icon-btn ghost" aria-label="Remove number" onClick={() => patch({ phones: draft.phones.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="small" onClick={() => patch({ phones: [...draft.phones, blankPhone(draft.phones.length ? "work" : "mobile")] })}>
          ＋ Add number
        </button>
      </fieldset>

      <fieldset>
        <legend>Email addresses</legend>
        <datalist id={emailListId}>
          {EMAIL_LABELS.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
        {draft.emails.map((x, i) => (
          <div key={x.id} className="multi-row">
            <input type="text" aria-label="Label" list={emailListId} value={x.label} onChange={(e) => patch({ emails: draft.emails.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) })} />
            <input type="email" aria-label="Email" inputMode="email" autoCapitalize="off" value={x.address} onChange={(e) => patch({ emails: draft.emails.map((y, j) => (j === i ? { ...y, address: e.target.value } : y)) })} placeholder="name@example.com" />
            <button type="button" className="icon-btn ghost" aria-label="Remove email" onClick={() => patch({ emails: draft.emails.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="small" onClick={() => patch({ emails: [...draft.emails, blankEmail(draft.emails.length ? "work" : "personal")] })}>
          ＋ Add email
        </button>
      </fieldset>

      <fieldset>
        <legend>Companies</legend>
        {draft.companyLinks.map((l, i) => (
          <div key={l.companyId} className="section" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
            <div className="label-row">
              <strong>{getRecord("companies", l.companyId)?.name ?? companyOptions.find((o) => o.id === l.companyId)?.label ?? "(new company)"}</strong>
              <button type="button" className="icon-btn ghost" aria-label="Remove company" onClick={() => patch({ companyLinks: draft.companyLinks.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
            <input type="text" aria-label="Role" placeholder="Their role, e.g. Site manager" value={l.role} onChange={(e) => patch({ companyLinks: draft.companyLinks.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)) })} />
            <label className="check">
              <input type="checkbox" checked={!l.current} onChange={(e) => patch({ companyLinks: draft.companyLinks.map((x, j) => (j === i ? { ...x, current: !e.target.checked } : x)) })} />
              No longer there
            </label>
          </div>
        ))}
        <RecordPicker
          hideSelected
          options={companyOptions}
          selected={draft.companyLinks.map((l) => l.companyId)}
          onChange={(ids) => {
            const added = ids.filter((id) => !draft.companyLinks.some((l) => l.companyId === id));
            patch({ companyLinks: [...draft.companyLinks, ...added.map((companyId) => ({ companyId, role: "", current: true }))] });
          }}
          placeholder="Link a company"
          onCreate={(name) => createRecord("companies", blankCompany(name))}
        />
      </fieldset>

      <label>
        Address
        <textarea rows={3} value={draft.address} onChange={(e) => patch({ address: e.target.value })} style={{ minHeight: 90 }} />
      </label>

      <label>
        About
        <textarea value={draft.summary} onChange={(e) => patch({ summary: e.target.value })} placeholder="How you know them, family, interests, anything worth remembering" />
      </label>

      <div className="label">
        Tags
        <TagInput value={draft.tags} onChange={(t) => patch({ tags: t })} suggestions={tags} />
      </div>

      <div className="form-actions">
        <button type="submit" className="primary" disabled={!hasName}>
          {existing ? "Save" : "Add person"}
        </button>
      </div>

      {existing && (
        <div className="danger-zone">
          <button
            type="button"
            className="danger"
            onClick={() => {
              const name = personName(existing);
              if (!window.confirm(`Delete ${name}? Their notes are kept.`)) return;
              setDirty(false);
              deleteWithUndo("people", existing.id, name);
              navigate("/people", { replace: true });
            }}
          >
            Delete person
          </button>
        </div>
      )}
    </form>
  );
}
