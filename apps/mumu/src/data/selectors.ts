// Derived views over the store. Cheap enough to recompute on each render at
// personal scale; memoised where a screen recomputes them often.
import { useMemo } from "react";
import { personName } from "../lib/format";
import { byText } from "../lib/search";
import { formatMonthYear, todayLocal, upcoming, type Upcoming } from "../lib/dates";
import type { Engagement, ImportantDate, Note, Person } from "../types";
import { useCollection, useStore } from "./store";
import type { PickerOption } from "../components/RecordPicker";

/** Pinned first, then most recent first. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.occurredAt.localeCompare(a.occurredAt));
}

export interface NoteContext {
  companyId?: string;
  personId?: string;
  engagementId?: string;
  /** Also include notes on these engagements (a company page shows its engagements' notes). */
  alsoEngagementIds?: string[];
}

export function useNotesFor(ctx: NoteContext): Note[] {
  const notes = useCollection("notes");
  const also = (ctx.alsoEngagementIds ?? []).join(",");
  return useMemo(() => {
    const extra = new Set(also ? also.split(",") : []);
    return sortNotes(
      notes.filter(
        (n) =>
          (ctx.companyId && n.companyIds.includes(ctx.companyId)) ||
          (ctx.personId && n.personIds.includes(ctx.personId)) ||
          (ctx.engagementId && (n.engagementIds ?? []).includes(ctx.engagementId)) ||
          (n.engagementIds ?? []).some((id) => extra.has(id)),
      ),
    );
  }, [notes, ctx.companyId, ctx.personId, ctx.engagementId, also]);
}

/** Newest first; ongoing ones before finished ones. */
export function sortEngagements(list: Engagement[]): Engagement[] {
  return [...list].sort((a, b) => Number(b.endDate === null) - Number(a.endDate === null) || b.startDate.localeCompare(a.startDate));
}

export function useEngagementsForCompany(companyId: string | undefined): Engagement[] {
  const engagements = useCollection("engagements");
  return useMemo(() => (companyId ? sortEngagements(engagements.filter((e) => e.companyId === companyId)) : []), [engagements, companyId]);
}

/** Engagements where this person was a key contact or put me forward. */
export function useEngagementsForPerson(personId: string | undefined): Engagement[] {
  const engagements = useCollection("engagements");
  return useMemo(
    () => (personId ? sortEngagements(engagements.filter((e) => e.keyContactIds.includes(personId) || e.viaPersonId === personId)) : []),
    [engagements, personId],
  );
}

export function useDatesForPerson(personId: string | undefined): Upcoming<ImportantDate>[] {
  const dates = useCollection("importantDates");
  return useMemo(() => (personId ? upcoming(dates.filter((d) => d.personId === personId), todayLocal(), 366) : []), [dates, personId]);
}

/** Dates within `windowDays`, skipping any whose person has been deleted. */
export function useUpcomingDates(windowDays: number): Upcoming<ImportantDate>[] {
  const s = useStore();
  return useMemo(() => {
    const live = s.importantDates.live.filter((d) => {
      const p = s.people.byId.get(d.personId);
      return p && !p.deleted;
    });
    return upcoming(live, todayLocal(), windowDays);
  }, [s, windowDays]);
}

export function useEngagementOptions(): PickerOption[] {
  const engagements = useCollection("engagements");
  const companies = useStore().companies.byId;
  return useMemo(
    () =>
      sortEngagements(engagements).map((e) => ({
        id: e.id,
        label: engagementLabel(e, companies.get(e.companyId)?.name),
        sub: formatMonthYear(e.startDate),
      })),
    [engagements, companies],
  );
}

export function engagementLabel(e: Engagement, companyName?: string): string {
  return [companyName, e.title || e.myRole].filter(Boolean).join(" · ") || "(untitled engagement)";
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
    for (const r of [...s.companies.live, ...s.people.live, ...s.notes.live, ...s.engagements.live]) r.tags?.forEach((t) => set.add(t));
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
