import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { AttachedTo, FamilyEvent, FamilyMedia, FamilyMember, FamilyRecord, Person, Relationship } from "../types/family";

export function useAllPeople(): Person[] {
  return useLiveQuery(() => db.people.toArray(), [], []) ?? [];
}

export function usePerson(id: string | null): Person | undefined {
  return useLiveQuery(async () => (id ? db.people.get(id) : undefined), [id]);
}

export function useAllRelationships(): Relationship[] {
  return useLiveQuery(() => db.relationships.toArray(), [], []) ?? [];
}

export function useRelationshipsForPerson(personId: string | null): Relationship[] {
  return (
    useLiveQuery(
      async () => (personId ? db.relationships.filter((r) => r.personA === personId || r.personB === personId).toArray() : []),
      [personId],
    ) ?? []
  );
}

export function useEventsForPerson(personId: string | null): FamilyEvent[] {
  const events =
    useLiveQuery(async () => (personId ? db.familyEvents.where("personId").equals(personId).toArray() : []), [personId]) ?? [];
  return [...events].sort((a, b) => a.date.iso.localeCompare(b.date.iso));
}

function attachedToKey(a: AttachedTo): string {
  return `${a.type}:${a.id}`;
}

export function useMediaFor(target: AttachedTo | null): FamilyMedia[] {
  return (
    useLiveQuery(
      async () => (target ? db.familyMedia.filter((m) => attachedToKey(m.attachedTo) === attachedToKey(target)).toArray() : []),
      [target ? attachedToKey(target) : null],
    ) ?? []
  );
}

export function useRecordsFor(target: AttachedTo | null): FamilyRecord[] {
  return (
    useLiveQuery(
      async () => (target ? db.familyRecords.filter((r) => attachedToKey(r.attachedTo) === attachedToKey(target)).toArray() : []),
      [target ? attachedToKey(target) : null],
    ) ?? []
  );
}

export function useAllFamilyMembers(): FamilyMember[] {
  return useLiveQuery(() => db.familyMembers.toArray(), [], []) ?? [];
}

/** Profile-photo lookups for tree cards — a map of media id -> downloadUrl, not the full media docs. */
export function useMediaUrlById(): Map<string, string> {
  const media = useLiveQuery(() => db.familyMedia.toArray(), [], []) ?? [];
  return new Map(media.map((m) => [m.id, m.downloadUrl]));
}
