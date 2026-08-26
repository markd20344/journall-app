// CRUD layer for the Family Tree module — mirrors db/repo.ts's pattern
// (write to Dexie, bump updatedAt, mirror the change to Firestore) but
// against the shared trees/{FAMILY_TREE_ID}/... collections rather than
// this account's own private data. Firestore security rules are the real
// enforcement of who can do what; the role checks in components are a
// courtesy (better error messages, hidden buttons) not the source of truth.
import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../db/db";
import { firestore } from "../firebase/config";
import { FAMILY_TREE_ID } from "./config";
import { bulkPushFamilyRecords, deleteFamilyRecord, pushFamilyRecord } from "../firebase/familySync";
import { deleteStorageFile, uploadMediaFile, uploadRecordFile } from "./storage";
import { newId, nowIso } from "../lib/id";
import { emptyDate } from "../types/family";
import type {
  AttachedTo,
  EventType,
  FamilyEvent,
  FamilyInvite,
  FamilyMedia,
  FamilyRecord,
  FamilyRole,
  Gender,
  ParentChildSubtype,
  PartialDate,
  Person,
  Relationship,
  RelationshipType,
  RecordType,
  SpouseEndReason,
  SpouseSubtype,
} from "../types/family";

function treeCollection(name: string) {
  return collection(firestore!, "trees", FAMILY_TREE_ID, name);
}
function treeDoc(name: string, id: string) {
  return doc(firestore!, "trees", FAMILY_TREE_ID, name, id);
}

// ---------- People ----------

export interface PersonInput {
  firstName: string;
  middleName: string;
  lastName: string;
  maidenName: string;
  gender: Gender;
  birth: PartialDate;
  birthPlace: string;
  death: PartialDate;
  deathPlace: string;
  notes: string;
}

export async function createPerson(input: PersonInput, uid: string): Promise<Person> {
  const ts = nowIso();
  const person: Person = { ...input, id: newId(), profileMediaId: null, createdAt: ts, updatedAt: ts, createdBy: uid };
  await db.people.add(person);
  pushFamilyRecord("people", person);
  return person;
}

export async function updatePerson(id: string, changes: Partial<PersonInput & { profileMediaId: string | null }>): Promise<void> {
  await db.people.update(id, { ...changes, updatedAt: nowIso() });
  const updated = await db.people.get(id);
  if (updated) pushFamilyRecord("people", updated);
}

/** Deletes a person and cascades to everything that only makes sense attached to them. Owner-only (enforced server-side). */
export async function deletePerson(id: string): Promise<void> {
  const [relationships, events] = await Promise.all([
    db.relationships.filter((r) => r.personA === id || r.personB === id).toArray(),
    db.familyEvents.where("personId").equals(id).toArray(),
  ]);
  const eventIds = new Set(events.map((e) => e.id));

  const [personMedia, personRecords] = await Promise.all([
    db.familyMedia.filter((m) => m.attachedTo.type === "person" && m.attachedTo.id === id).toArray(),
    db.familyRecords.filter((r) => r.attachedTo.type === "person" && r.attachedTo.id === id).toArray(),
  ]);
  const [eventMedia, eventRecords] = await Promise.all([
    db.familyMedia.filter((m) => m.attachedTo.type === "event" && eventIds.has(m.attachedTo.id)).toArray(),
    db.familyRecords.filter((r) => r.attachedTo.type === "event" && eventIds.has(r.attachedTo.id)).toArray(),
  ]);

  for (const media of [...personMedia, ...eventMedia]) await deleteMedia(media.id);
  for (const record of [...personRecords, ...eventRecords]) await deleteFamilyRecordDoc(record.id);
  for (const relationship of relationships) await deleteRelationship(relationship.id);
  for (const event of events) await deleteEvent(event.id);

  await db.people.delete(id);
  deleteFamilyRecord("people", id);
}

// ---------- Relationships ----------

export interface RelationshipInput {
  type: RelationshipType;
  personA: string;
  personB: string;
  subtype: ParentChildSubtype | SpouseSubtype | null;
  startDate: PartialDate;
  startPlace: string;
  endDate: PartialDate;
  endReason: SpouseEndReason | null;
}

export async function createRelationship(input: RelationshipInput): Promise<Relationship> {
  const ts = nowIso();
  const relationship: Relationship = { ...input, id: newId(), createdAt: ts, updatedAt: ts };
  await db.relationships.add(relationship);
  pushFamilyRecord("relationships", relationship);
  return relationship;
}

export async function updateRelationship(id: string, changes: Partial<RelationshipInput>): Promise<void> {
  await db.relationships.update(id, { ...changes, updatedAt: nowIso() });
  const updated = await db.relationships.get(id);
  if (updated) pushFamilyRecord("relationships", updated);
}

export async function deleteRelationship(id: string): Promise<void> {
  await db.relationships.delete(id);
  deleteFamilyRecord("relationships", id);
}

// ---------- Events ----------

export interface EventInput {
  personId: string;
  type: EventType;
  label: string;
  date: PartialDate;
  place: string;
  note: string;
}

export async function createEvent(input: EventInput): Promise<FamilyEvent> {
  const ts = nowIso();
  const event: FamilyEvent = { ...input, id: newId(), createdAt: ts, updatedAt: ts };
  await db.familyEvents.add(event);
  pushFamilyRecord("familyEvents", event);
  return event;
}

export async function updateEvent(id: string, changes: Partial<EventInput>): Promise<void> {
  await db.familyEvents.update(id, { ...changes, updatedAt: nowIso() });
  const updated = await db.familyEvents.get(id);
  if (updated) pushFamilyRecord("familyEvents", updated);
}

export async function deleteEvent(id: string): Promise<void> {
  const [media, records] = await Promise.all([
    db.familyMedia.filter((m) => m.attachedTo.type === "event" && m.attachedTo.id === id).toArray(),
    db.familyRecords.filter((r) => r.attachedTo.type === "event" && r.attachedTo.id === id).toArray(),
  ]);
  for (const m of media) await deleteMedia(m.id);
  for (const r of records) await deleteFamilyRecordDoc(r.id);
  await db.familyEvents.delete(id);
  deleteFamilyRecord("familyEvents", id);
}

// ---------- Media (photos) ----------

export async function addMedia(
  file: File,
  attachedTo: AttachedTo,
  input: { caption: string; date: PartialDate },
  uid: string,
): Promise<FamilyMedia> {
  const id = newId();
  const uploaded = await uploadMediaFile(id, file);
  const ts = nowIso();
  const media: FamilyMedia = {
    id,
    storagePath: uploaded.storagePath,
    downloadUrl: uploaded.downloadUrl,
    caption: input.caption,
    date: input.date,
    attachedTo,
    uploadedBy: uid,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.familyMedia.add(media);
  pushFamilyRecord("familyMedia", media);
  return media;
}

export async function updateMedia(id: string, changes: Partial<{ caption: string; date: PartialDate }>): Promise<void> {
  await db.familyMedia.update(id, { ...changes, updatedAt: nowIso() });
  const updated = await db.familyMedia.get(id);
  if (updated) pushFamilyRecord("familyMedia", updated);
}

export async function deleteMedia(id: string): Promise<void> {
  const media = await db.familyMedia.get(id);
  const peopleUsingAsProfile = await db.people.filter((p) => p.profileMediaId === id).toArray();
  for (const person of peopleUsingAsProfile) await updatePerson(person.id, { profileMediaId: null });
  await db.familyMedia.delete(id);
  deleteFamilyRecord("familyMedia", id);
  if (media) await deleteStorageFile(media.storagePath);
}

export async function setProfilePhoto(personId: string, mediaId: string | null): Promise<void> {
  await updatePerson(personId, { profileMediaId: mediaId });
}

// ---------- Records (documents) ----------

export async function addFamilyRecord(
  file: File,
  attachedTo: AttachedTo,
  input: { recordType: RecordType; sourceCitation: string; caption: string },
  uid: string,
): Promise<FamilyRecord> {
  const id = newId();
  const uploaded = await uploadRecordFile(id, file);
  const ts = nowIso();
  const record: FamilyRecord = {
    id,
    storagePath: uploaded.storagePath,
    downloadUrl: uploaded.downloadUrl,
    fileName: uploaded.fileName,
    recordType: input.recordType,
    sourceCitation: input.sourceCitation,
    caption: input.caption,
    attachedTo,
    uploadedBy: uid,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.familyRecords.add(record);
  pushFamilyRecord("familyRecords", record);
  return record;
}

export async function updateFamilyRecord(
  id: string,
  changes: Partial<{ recordType: RecordType; sourceCitation: string; caption: string }>,
): Promise<void> {
  await db.familyRecords.update(id, { ...changes, updatedAt: nowIso() });
  const updated = await db.familyRecords.get(id);
  if (updated) pushFamilyRecord("familyRecords", updated);
}

// Named oddly (not `deleteRecord`) only to avoid colliding with JS's global `Record` type import conventions elsewhere in this file.
export async function deleteFamilyRecordDoc(id: string): Promise<void> {
  const record = await db.familyRecords.get(id);
  await db.familyRecords.delete(id);
  deleteFamilyRecord("familyRecords", id);
  if (record) await deleteStorageFile(record.storagePath);
}

// ---------- GEDCOM import ----------

export async function commitGedcomImport(people: Person[], relationships: Relationship[]): Promise<void> {
  await db.people.bulkAdd(people);
  await db.relationships.bulkAdd(relationships);
  await Promise.all([
    bulkPushFamilyRecords("people", people),
    bulkPushFamilyRecords("relationships", relationships),
  ]);
}

// ---------- Members & invites ----------

export async function listInvites(): Promise<FamilyInvite[]> {
  const snap = await getDocs(treeCollection("invites"));
  return snap.docs.map((d) => d.data() as FamilyInvite);
}

export async function inviteMember(email: string, role: FamilyRole, invitedBy: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const invite: FamilyInvite = { email: normalized, role, invitedBy, invitedAt: nowIso() };
  await setDoc(treeDoc("invites", normalized), invite as unknown as Record<string, unknown>);
}

export async function revokeInvite(email: string): Promise<void> {
  await deleteDoc(treeDoc("invites", email));
}

export async function changeMemberRole(uid: string, role: FamilyRole): Promise<void> {
  await db.familyMembers.update(uid, { role, updatedAt: nowIso() });
  const updated = await db.familyMembers.get(uid);
  if (updated) await setDoc(treeDoc("members", uid), updated as unknown as Record<string, unknown>);
}

export async function removeMember(uid: string): Promise<void> {
  await db.familyMembers.delete(uid);
  await deleteDoc(treeDoc("members", uid));
}

export function emptyPersonInput(): PersonInput {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    maidenName: "",
    gender: "unknown",
    birth: emptyDate(),
    birthPlace: "",
    death: emptyDate(),
    deathPlace: "",
    notes: "",
  };
}
