import { useState } from "react";
import type { FamilyEvent, FamilyRole, Person, Relationship } from "../../types/family";
import { useEventsForPerson } from "../../hooks/useFamilyData";
import { yearOf } from "../../family/dates";
import { shortName } from "../../family/personDisplay";
import { deleteEvent } from "../../family/repo";
import { canEditFacts, canEditStructure } from "../../family/role";
import EventEditor from "./EventEditor";
import { showToast } from "../../lib/toast";

interface TimelineEntry {
  key: string;
  year: number | null;
  title: string;
  display: string;
  place: string;
  note: string;
  editableEventId: string | null;
}

interface Props {
  person: Person;
  relationships: Relationship[];
  peopleById: Map<string, Person>;
  role: FamilyRole | null;
  onOpenAttachments: (target: { type: "person" | "event"; id: string }, label: string) => void;
}

export default function EventTimeline({ person, relationships, peopleById, role, onOpenAttachments }: Props) {
  const customEvents = useEventsForPerson(person.id);
  const [editing, setEditing] = useState<{ eventId?: string; initial?: FamilyEvent } | null>(null);

  const entries: TimelineEntry[] = [];
  if (person.birth.display || person.birthPlace) {
    entries.push({
      key: "birth",
      year: yearOf(person.birth),
      title: "Born",
      display: person.birth.display,
      place: person.birthPlace,
      note: "",
      editableEventId: null,
    });
  }
  for (const rel of relationships) {
    if (rel.type !== "spouse") continue;
    const spouseId = rel.personA === person.id ? rel.personB : rel.personA;
    const spouse = peopleById.get(spouseId);
    entries.push({
      key: `marriage-${rel.id}`,
      year: yearOf(rel.startDate),
      title: rel.subtype === "partnered" ? "Partnered" : "Married",
      display: rel.startDate.display,
      place: rel.startPlace,
      note: spouse ? shortName(spouse) : "",
      editableEventId: null,
    });
    if (rel.endDate.display) {
      entries.push({
        key: `marriage-end-${rel.id}`,
        year: yearOf(rel.endDate),
        title: rel.endReason === "divorced" ? "Divorced" : rel.endReason === "widowed" ? "Widowed" : "Separated",
        display: rel.endDate.display,
        place: "",
        note: spouse ? shortName(spouse) : "",
        editableEventId: null,
      });
    }
  }
  if (person.death.display || person.deathPlace) {
    entries.push({
      key: "death",
      year: yearOf(person.death),
      title: "Died",
      display: person.death.display,
      place: person.deathPlace,
      note: "",
      editableEventId: null,
    });
  }
  for (const ev of customEvents) {
    entries.push({
      key: `event-${ev.id}`,
      year: yearOf(ev.date),
      title: ev.label,
      display: ev.date.display,
      place: ev.place,
      note: ev.note,
      editableEventId: ev.id,
    });
  }
  entries.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));

  if (editing) {
    return (
      <EventEditor
        personId={person.id}
        eventId={editing.eventId}
        initial={editing.initial ? { personId: person.id, type: "custom", label: editing.initial.label, date: editing.initial.date, place: editing.initial.place, note: editing.initial.note } : undefined}
        onDone={() => setEditing(null)}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="family-timeline">
      {entries.length === 0 && <p className="empty-hint">No dates or events recorded yet.</p>}
      {entries.map((entry) => (
        <div key={entry.key} className="family-timeline-entry">
          <span className="family-timeline-year">{entry.year ?? "—"}</span>
          <div className="family-timeline-body">
            <strong>{entry.title}</strong>
            {entry.display && <span> — {entry.display}</span>}
            {entry.place && <span className="family-timeline-place"> · {entry.place}</span>}
            {entry.note && <p className="family-timeline-note">{entry.note}</p>}
            {entry.editableEventId && (
              <div className="family-timeline-actions">
                <button
                  type="button"
                  className="ghost small"
                  onClick={() => onOpenAttachments({ type: "event", id: entry.editableEventId! }, entry.title)}
                >
                  Photos & records
                </button>
                {canEditFacts(role) && (
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => {
                      const original = customEvents.find((e) => e.id === entry.editableEventId);
                      if (original) setEditing({ eventId: original.id, initial: original });
                    }}
                  >
                    Edit
                  </button>
                )}
                {canEditStructure(role) && (
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => {
                      void deleteEvent(entry.editableEventId!).then(() => showToast("Event deleted"));
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
      {canEditFacts(role) && (
        <button type="button" className="ghost" onClick={() => setEditing({})}>
          + Add event
        </button>
      )}
    </div>
  );
}
