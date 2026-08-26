import { useMemo, useState } from "react";
import type { AttachedTo, Person } from "../../types/family";
import { deletePerson, deleteRelationship, updatePerson, type PersonInput } from "../../family/repo";
import { canEditFacts, canEditStructure, type FamilyMembership } from "../../family/role";
import { fullName } from "../../family/personDisplay";
import { useAllPeople, useAllRelationships, useMediaFor, useRelationshipsForPerson } from "../../hooks/useFamilyData";
import PersonEditor from "./PersonEditor";
import RelationshipEditor, { type RelationshipMode } from "./RelationshipEditor";
import EventTimeline from "./EventTimeline";
import MediaGallery from "./MediaGallery";
import RecordList from "./RecordList";
import { showToast } from "../../lib/toast";

interface Props {
  person: Person;
  membership: FamilyMembership;
  onNavigateToPerson: (id: string) => void;
  onClose: () => void;
  onDeleted: () => void;
}

type Tab = "facts" | "family" | "timeline" | "photos" | "records";

export default function PersonDetailPanel({ person, membership, onNavigateToPerson, onClose, onDeleted }: Props) {
  const [tab, setTab] = useState<Tab>("facts");
  const [editingFacts, setEditingFacts] = useState(false);
  const [relationshipMode, setRelationshipMode] = useState<RelationshipMode | null>(null);
  const [attachmentsTarget, setAttachmentsTarget] = useState<{ target: AttachedTo; label: string } | null>(null);

  const people = useAllPeople();
  const allRelationships = useAllRelationships();
  const relationships = useRelationshipsForPerson(person.id);
  const profileMedia = useMediaFor(person.profileMediaId ? { type: "person", id: person.id } : null);
  const role = membership.role;

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const profilePhotoUrl = person.profileMediaId ? profileMedia.find((m) => m.id === person.profileMediaId)?.downloadUrl ?? null : null;

  const parents = relationships.filter((r) => r.type === "parent-child" && r.personB === person.id);
  const children = relationships.filter((r) => r.type === "parent-child" && r.personA === person.id);
  const spouses = relationships.filter((r) => r.type === "spouse");

  async function handleSaveFacts(input: PersonInput) {
    await updatePerson(person.id, input);
    showToast("Saved");
    setEditingFacts(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete ${fullName(person)}? This also removes their relationships, photos and records.`)) return;
    await deletePerson(person.id);
    showToast("Person deleted");
    onDeleted();
  }

  if (editingFacts) {
    return (
      <PersonEditor
        title={`Edit ${fullName(person)}`}
        initial={person}
        onSave={handleSaveFacts}
        onCancel={() => setEditingFacts(false)}
        onDelete={canEditStructure(role) ? () => void handleDelete() : undefined}
      />
    );
  }

  if (relationshipMode) {
    return (
      <RelationshipEditor
        mode={relationshipMode}
        anchorPersonId={person.id}
        people={people}
        uid={membership.uid ?? ""}
        onDone={() => setRelationshipMode(null)}
        onCancel={() => setRelationshipMode(null)}
      />
    );
  }

  if (attachmentsTarget) {
    return (
      <div className="family-detail-panel">
        <div className="family-detail-header-row">
          <button type="button" className="ghost" onClick={() => setAttachmentsTarget(null)}>
            ← Back to {fullName(person)}
          </button>
        </div>
        <h2 className="page-title">Photos & records — {attachmentsTarget.label}</h2>
        <MediaGallery target={attachmentsTarget.target} role={role} uid={membership.uid ?? ""} />
        <RecordList target={attachmentsTarget.target} role={role} uid={membership.uid ?? ""} />
      </div>
    );
  }

  return (
    <div className="family-detail-panel">
      <div className="family-detail-header-row">
        <button type="button" className="ghost" onClick={onClose}>
          ← Back to tree
        </button>
      </div>

      <div className="family-detail-header">
        <span className="family-detail-photo">
          {profilePhotoUrl ? <img src={profilePhotoUrl} alt="" /> : <span className="family-tree-node-initial">{person.firstName.charAt(0) || "?"}</span>}
        </span>
        <div>
          <h2 className="page-title">{fullName(person)}</h2>
          {person.maidenName && <p className="settings-hint">née {person.maidenName}</p>}
        </div>
      </div>

      <nav className="kit-subnav">
        {(["facts", "family", "timeline", "photos", "records"] as Tab[]).map((t) => (
          <button key={t} type="button" className={`nav-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {tab === "facts" && (
        <div className="family-facts">
          <dl className="family-facts-list">
            <dt>Gender</dt>
            <dd>{person.gender}</dd>
            <dt>Born</dt>
            <dd>{[person.birth.display, person.birthPlace].filter(Boolean).join(" · ") || "—"}</dd>
            <dt>Died</dt>
            <dd>{[person.death.display, person.deathPlace].filter(Boolean).join(" · ") || "—"}</dd>
          </dl>
          {person.notes && <p className="family-notes">{person.notes}</p>}
          {canEditFacts(role) && (
            <button type="button" className="ghost" onClick={() => setEditingFacts(true)}>
              Edit facts
            </button>
          )}
        </div>
      )}

      {tab === "family" && (
        <div className="family-relationships">
          <section>
            <h3>Parents</h3>
            {parents.map((r) => {
              const parent = peopleById.get(r.personA);
              if (!parent) return null;
              return (
                <div key={r.id} className="family-relationship-row">
                  <button type="button" className="link" onClick={() => onNavigateToPerson(parent.id)}>
                    {fullName(parent)}
                  </button>
                  <span className="family-relationship-subtype">{r.subtype}</span>
                  {canEditStructure(role) && (
                    <button type="button" className="ghost small" onClick={() => void deleteRelationship(r.id)}>
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
            {canEditStructure(role) && (
              <button type="button" className="ghost" onClick={() => setRelationshipMode("add-parent")}>
                + Add parent
              </button>
            )}
          </section>

          <section>
            <h3>Spouses / partners</h3>
            {spouses.map((r) => {
              const spouseId = r.personA === person.id ? r.personB : r.personA;
              const spouse = peopleById.get(spouseId);
              if (!spouse) return null;
              return (
                <div key={r.id} className="family-relationship-row">
                  <button type="button" className="link" onClick={() => onNavigateToPerson(spouse.id)}>
                    {fullName(spouse)}
                  </button>
                  <span className="family-relationship-subtype">
                    {r.subtype}
                    {r.endReason ? ` · ${r.endReason}` : ""}
                  </span>
                  {canEditStructure(role) && (
                    <button type="button" className="ghost small" onClick={() => void deleteRelationship(r.id)}>
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
            {canEditStructure(role) && (
              <button type="button" className="ghost" onClick={() => setRelationshipMode("add-spouse")}>
                + Add spouse / partner
              </button>
            )}
          </section>

          <section>
            <h3>Children</h3>
            {children.map((r) => {
              const child = peopleById.get(r.personB);
              if (!child) return null;
              return (
                <div key={r.id} className="family-relationship-row">
                  <button type="button" className="link" onClick={() => onNavigateToPerson(child.id)}>
                    {fullName(child)}
                  </button>
                  <span className="family-relationship-subtype">{r.subtype}</span>
                  {canEditStructure(role) && (
                    <button type="button" className="ghost small" onClick={() => void deleteRelationship(r.id)}>
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
            {canEditStructure(role) && (
              <button type="button" className="ghost" onClick={() => setRelationshipMode("add-child")}>
                + Add child
              </button>
            )}
          </section>
        </div>
      )}

      {tab === "timeline" && (
        <EventTimeline
          person={person}
          relationships={allRelationships}
          peopleById={peopleById}
          role={role}
          onOpenAttachments={(target, label) => setAttachmentsTarget({ target, label })}
        />
      )}

      {tab === "photos" && <MediaGallery target={{ type: "person", id: person.id }} role={role} uid={membership.uid ?? ""} personIdForProfilePhoto={person.id} />}

      {tab === "records" && <RecordList target={{ type: "person", id: person.id }} role={role} uid={membership.uid ?? ""} />}
    </div>
  );
}
