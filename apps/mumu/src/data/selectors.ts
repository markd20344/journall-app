// Derived views over the store. Cheap enough to recompute on each render at
// personal scale; memoised where a screen recomputes them often.
import { useMemo } from "react";
import { personName } from "../lib/format";
import { byText } from "../lib/search";
import type { Note, Person } from "../types";
import { useCollection, useStore } from "./store";
import type { PickerOption } from "../components/RecordPicker";

/** Pinned first, then most recent first. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.occurredAt.localeCompare(a.occurredAt));
}

export function useNotesFor(ctx: { companyId?: string; personId?: string }): Note[] {
  const notes = useCollection("notes");
  return useMemo(
    () =>
      sortNotes(
        notes.filter(
          (n) => (ctx.companyId && n.companyIds.includes(ctx.companyId)) || (ctx.personId && n.personIds.includes(ctx.personId)),
        ),
      ),
    [notes, ctx.companyId, ctx.personId],
  );
}

export function usePeopleAtCompany(companyId: string | undefined): Person[] {
  const people = useCollection("people");
  return useMemo(
    () => (companyId ? people.filter((p) => p.companyIds.includes(companyId)).sort(byText(personName)) : []),
    [people, companyId],
  );
}

export function useAllTags(): string[] {
  const s = useStore();
  return useMemo(() => {
    const set = new Set<string>();
    for (const r of [...s.companies.live, ...s.people.live, ...s.notes.live]) r.tags?.forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, [s]);
}

export function useCompanyOptions(): PickerOption[] {
  const companies = useCollection("companies");
  return useMemo(() => [...companies].sort(byText((c) => c.name)).map((c) => ({ id: c.id, label: c.name || "(unnamed)", sub: c.postcode })), [companies]);
}

export function usePeopleOptions(): PickerOption[] {
  const people = useCollection("people");
  const companies = useStore().companies.byId;
  return useMemo(
    () =>
      [...people].sort(byText(personName)).map((p) => ({
        id: p.id,
        label: personName(p),
        sub: p.companyIds.map((id) => companies.get(id)?.name).filter(Boolean).join(", ") || p.relationship,
      })),
    [people, companies],
  );
}
