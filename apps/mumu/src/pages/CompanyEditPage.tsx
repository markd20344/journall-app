import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { showToast } from "@journall/shared/lib/toast";
import BackLink from "../components/BackLink";
import ChoiceChips from "../components/ChoiceChips";
import TagInput from "../components/TagInput";
import { createRecord, updateRecord, type NewRecord } from "../data/repo";
import { useAllTags } from "../data/selectors";
import { useRecord, useStoreReady } from "../data/store";
import { blankCompany } from "../lib/blanks";
import { COMPANY_STATUSES, COMPANY_TYPES } from "../lib/labels";
import { deleteWithUndo } from "../lib/undoDelete";
import { useUnsavedGuard } from "../lib/useUnsavedGuard";
import type { Company } from "../types";
import NotFound from "./NotFound";

function toDraft(c: Company): NewRecord<"companies"> {
  return {
    name: c.name ?? "",
    type: c.type ?? "other",
    status: c.status ?? "active",
    address: c.address ?? "",
    postcode: c.postcode ?? "",
    website: c.website ?? "",
    summary: c.summary ?? "",
    tags: c.tags ?? [],
  };
}

export default function CompanyEditPage() {
  const { id } = useParams();
  const existing = useRecord("companies", id);
  const ready = useStoreReady();
  if (id && !existing) return ready ? <NotFound what="company" /> : null;
  // Keyed so the form re-initialises if the record changes identity.
  return <CompanyForm key={id ?? "new"} existing={existing} />;
}

function CompanyForm({ existing }: { existing?: Company }) {
  const navigate = useNavigate();
  const tags = useAllTags();
  const [draft, setDraft] = useState<NewRecord<"companies">>(() => (existing ? toDraft(existing) : blankCompany()));
  const [dirty, setDirty] = useState(false);
  useUnsavedGuard(dirty);

  function set<K extends keyof NewRecord<"companies">>(key: K, value: NewRecord<"companies">[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    const clean = { ...draft, name: draft.name.trim(), website: draft.website.trim(), postcode: draft.postcode.trim().toUpperCase() };
    if (!clean.name) return;
    setDirty(false);
    if (existing) {
      updateRecord("companies", existing.id, clean);
      showToast("Saved");
      navigate(`/companies/${existing.id}`, { replace: true });
    } else {
      const newId = createRecord("companies", clean);
      showToast("Company added");
      navigate(`/companies/${newId}`, { replace: true });
    }
  }

  return (
    <form className="page form" onSubmit={save}>
      <div className="page-head">
        <BackLink fallback={existing ? `/companies/${existing.id}` : "/companies"} label="Cancel" />
        <h1>{existing ? "Edit company" : "New company"}</h1>
      </div>

      <label>
        Name
        <input type="text" value={draft.name} onChange={(e) => set("name", e.target.value)} required autoFocus={!existing} autoCapitalize="words" />
      </label>

      <div className="label">
        Type
        <ChoiceChips label="Type" options={COMPANY_TYPES} value={draft.type} onChange={(v) => set("type", v)} />
      </div>

      <div className="label">
        Status
        <ChoiceChips label="Status" options={COMPANY_STATUSES} value={draft.status} onChange={(v) => set("status", v)} />
      </div>

      <label>
        Website
        <input type="text" inputMode="url" value={draft.website} onChange={(e) => set("website", e.target.value)} placeholder="acme.co.uk" autoCapitalize="off" />
      </label>

      <label>
        Address
        <textarea rows={3} value={draft.address} onChange={(e) => set("address", e.target.value)} style={{ minHeight: 90 }} />
      </label>

      <label>
        Postcode
        <input type="text" value={draft.postcode} onChange={(e) => set("postcode", e.target.value)} autoCapitalize="characters" />
      </label>

      <label>
        Summary
        <textarea value={draft.summary} onChange={(e) => set("summary", e.target.value)} placeholder="What they do, how you know them, anything worth remembering" />
      </label>

      <div className="label">
        Tags
        <TagInput value={draft.tags} onChange={(v) => set("tags", v)} suggestions={tags} />
      </div>

      <div className="form-actions">
        <button type="submit" className="primary" disabled={!draft.name.trim()}>
          {existing ? "Save" : "Add company"}
        </button>
      </div>

      {existing && (
        <div className="danger-zone">
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (!window.confirm(`Delete ${existing.name}? Its notes and people are kept.`)) return;
              setDirty(false);
              deleteWithUndo("companies", existing.id, existing.name || "Company");
              navigate("/companies", { replace: true });
            }}
          >
            Delete company
          </button>
        </div>
      )}
    </form>
  );
}
