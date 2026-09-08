// Domain types for the Family Tree module. Lives in Firestore under
// `trees/{FAMILY_TREE_ID}/...` (see family/config.ts) rather than under a
// single user's private data — this is a shared, multi-user tree by design,
// unlike the rest of this app's per-account journal data.

export type Gender = "male" | "female" | "unknown";

// Genealogy dates are usually approximate ("c. 1890", "bef. 1920"). `iso` is
// a best-effort YYYY / YYYY-MM / YYYY-MM-DD used for sorting and search even
// when the date is approximate; `display` is the human-readable form shown
// in the UI (auto-formatted from the structured inputs, or carried over
// verbatim from a GEDCOM import). Both are "" when the date is entirely
// unknown.
export type DatePrecision = "exact" | "about" | "before" | "after" | "estimated" | "calculated";

export interface PartialDate {
  iso: string;
  precision: DatePrecision;
  display: string;
}

export function emptyDate(): PartialDate {
  return { iso: "", precision: "exact", display: "" };
}

export interface Person {
  id: string;
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
  profileMediaId: string | null; // the photo shown on the tree card, if any
  createdAt: string;
  updatedAt: string;
  createdBy: string; // uid of whoever created this person
}

export type RelationshipType = "parent-child" | "spouse";

// Meaning depends on `type`: biological/adopted/step for parent-child,
// married/partnered for spouse.
export type ParentChildSubtype = "biological" | "adopted" | "step";
export type SpouseSubtype = "married" | "partnered";
export type SpouseEndReason = "divorced" | "widowed" | "separated";

export interface Relationship {
  id: string;
  type: RelationshipType;
  // parent-child: personA is the parent, personB is the child.
  // spouse: unordered pair.
  personA: string;
  personB: string;
  subtype: ParentChildSubtype | SpouseSubtype | null;
  startDate: PartialDate; // marriage date — spouse only
  startPlace: string; // marriage place — spouse only
  endDate: PartialDate; // divorce/death date that ended the marriage — spouse only
  endReason: SpouseEndReason | null; // spouse only
  createdAt: string;
  updatedAt: string;
}

export type EventType = "birth" | "marriage" | "death" | "custom";

export interface FamilyEvent {
  id: string;
  personId: string;
  type: EventType;
  label: string; // required for "custom" (e.g. "Emigrated to Canada"); a default title otherwise
  date: PartialDate;
  place: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type AttachedTo = { type: "person"; id: string } | { type: "event"; id: string };

export interface FamilyMedia {
  id: string;
  storagePath: string;
  downloadUrl: string;
  caption: string;
  date: PartialDate;
  attachedTo: AttachedTo;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type RecordType =
  | "birth_certificate"
  | "death_certificate"
  | "marriage_certificate"
  | "census"
  | "immigration"
  | "military"
  | "other";

export interface FamilyRecord {
  id: string;
  storagePath: string;
  downloadUrl: string;
  fileName: string;
  recordType: RecordType;
  sourceCitation: string;
  caption: string;
  attachedTo: AttachedTo;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

// Owner: full control — edit relationships, delete people, manage access.
// Contributor: can add photos/records/events and edit facts on existing
// people, but can't create/edit/delete relationships (the tree structure),
// add new people, or delete anything.
// Viewer: read-only.
export type FamilyRole = "owner" | "contributor" | "viewer";

export interface FamilyMember {
  uid: string;
  email: string;
  displayName: string;
  role: FamilyRole;
  invitedBy: string;
  joinedAt: string;
  updatedAt: string;
}

// Pre-authorizes an email for a role before that person has ever signed in
// — Firebase Auth UIDs aren't known until someone actually signs in, so
// invites are keyed by (lowercased) email and get claimed into a
// FamilyMember doc on first sign-in. Doc id is the lowercased email.
export interface FamilyInvite {
  email: string;
  role: FamilyRole;
  invitedBy: string;
  invitedAt: string;
}
