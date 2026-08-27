import { useEffect, useState } from "react";
import { useAllPeople, useAllRelationships, useMediaUrlById } from "../hooks/useFamilyData";
import { useFamilyMembership, canEditStructure, canManageMembers } from "../family/role";
import { pickDefaultRootId } from "../family/treeLayout";
import { createPerson, emptyPersonInput } from "../family/repo";
import { firebaseEnabled } from "../firebase/config";
import FamilyTreeCanvas from "../components/family/FamilyTreeCanvas";
import PersonDetailPanel from "../components/family/PersonDetailPanel";
import PersonEditor from "../components/family/PersonEditor";
import FamilySearchPanel from "../components/family/FamilySearchPanel";
import GedcomImportPanel from "../components/family/GedcomImportPanel";
import MembersPanel from "../components/family/MembersPanel";
import { showToast } from "../lib/toast";

type SubView = "tree" | "search" | "import" | "members";

export default function FamilyTreePage() {
  const people = useAllPeople();
  const relationships = useAllRelationships();
  const mediaUrlById = useMediaUrlById();
  const membership = useFamilyMembership();

  const [subView, setSubView] = useState<SubView>("tree");
  const [rootId, setRootId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingPerson, setAddingPerson] = useState(false);

  useEffect(() => {
    if (rootId && people.some((p) => p.id === rootId)) return;
    setRootId(pickDefaultRootId(people, relationships));
  }, [people, relationships, rootId]);

  if (!firebaseEnabled) {
    return (
      <div className="page">
        <h1 className="page-title">Family Tree</h1>
        <p className="empty-hint">
          The family tree is a shared, invite-only space and needs cloud sync configured to work — this device is
          currently running in local-only mode.
        </p>
      </div>
    );
  }

  if (membership.loading) {
    return (
      <div className="page">
        <h1 className="page-title">Family Tree</h1>
        <p className="settings-hint">Checking your access…</p>
      </div>
    );
  }

  if (!membership.role) {
    return (
      <div className="page">
        <h1 className="page-title">Family Tree</h1>
        <p className="empty-hint">
          You don't have access to the family tree yet. Ask whoever owns it to invite the email address you signed in
          with.
        </p>
      </div>
    );
  }

  const selectedPerson = selectedId ? people.find((p) => p.id === selectedId) : undefined;

  if (addingPerson) {
    return (
      <div className="page">
        <PersonEditor
          title="Add a person"
          initial={emptyPersonInput()}
          onCancel={() => setAddingPerson(false)}
          onSave={async (input) => {
            const person = await createPerson(input, membership.uid!);
            showToast("Person added");
            setAddingPerson(false);
            setRootId(person.id);
            setSelectedId(person.id);
          }}
        />
      </div>
    );
  }

  if (selectedPerson) {
    return (
      <div className="page">
        <PersonDetailPanel
          person={selectedPerson}
          membership={membership}
          onNavigateToPerson={(id) => setSelectedId(id)}
          onClose={() => setSelectedId(null)}
          onDeleted={() => {
            setSelectedId(null);
            setRootId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Family Tree</h1>

      <nav className="kit-subnav">
        <button type="button" className={`nav-btn ${subView === "tree" ? "active" : ""}`} onClick={() => setSubView("tree")}>
          Tree
        </button>
        <button type="button" className={`nav-btn ${subView === "search" ? "active" : ""}`} onClick={() => setSubView("search")}>
          Search
        </button>
        {canEditStructure(membership.role) && (
          <button type="button" className={`nav-btn ${subView === "import" ? "active" : ""}`} onClick={() => setSubView("import")}>
            Import
          </button>
        )}
        {canManageMembers(membership.role) && (
          <button type="button" className={`nav-btn ${subView === "members" ? "active" : ""}`} onClick={() => setSubView("members")}>
            People with access
          </button>
        )}
      </nav>

      {subView === "tree" && (
        <>
          {canEditStructure(membership.role) && (
            <div className="entry-editor-actions">
              <button type="button" className="primary" onClick={() => setAddingPerson(true)}>
                + Add person
              </button>
            </div>
          )}
          {rootId ? (
            <FamilyTreeCanvas
              people={people}
              relationships={relationships}
              rootId={rootId}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRecenter={setRootId}
              mediaUrlFor={(person) => (person.profileMediaId ? mediaUrlById.get(person.profileMediaId) ?? null : null)}
            />
          ) : (
            <p className="empty-hint">
              Nobody in the tree yet. {canEditStructure(membership.role) ? "Add a person or import a GEDCOM file to get started." : "Ask the tree owner to add people."}
            </p>
          )}
        </>
      )}

      {subView === "search" && <FamilySearchPanel people={people} onSelect={setSelectedId} />}

      {subView === "import" && canEditStructure(membership.role) && (
        <GedcomImportPanel uid={membership.uid!} onDone={() => setSubView("tree")} onCancel={() => setSubView("tree")} />
      )}

      {subView === "members" && canManageMembers(membership.role) && <MembersPanel uid={membership.uid!} />}
    </div>
  );
}
