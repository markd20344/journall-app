// Mumu's domain types. Every record is a Firestore doc at
// users/{uid}/{collection}/{id}; see CLAUDE.md for the full data model.
// Keep these plain and JSON-serialisable: the same shapes go into the JSON
// backup export.

export interface BaseDoc {
  id: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  // Soft delete. Records are never removed outright, so a deletion syncs to
  // other devices like any other edit, and Trash can restore it. Journall's
  // tombstones ({ id, deleted: true, updatedAt }) are compatible with this.
  deleted?: boolean;
}

export type CompanyType = "employer" | "client" | "agency" | "supplier" | "other";
export type CompanyStatus = "active" | "prospect" | "past" | "dormant";

export interface Company extends BaseDoc {
  name: string;
  type: CompanyType;
  status: CompanyStatus;
  address: string; // multi-line, free text
  postcode: string;
  website: string;
  summary: string;
  tags: string[];
}

export type Circle = "work" | "personal" | "both";

export interface Phone {
  id: string;
  label: string; // "mobile", "work", "home", or anything typed
  number: string;
}

export interface Email {
  id: string;
  label: string;
  address: string;
}

export interface CompanyLink {
  companyId: string;
  role: string; // the person's role at that company, e.g. "Hiring manager"
  current: boolean; // false once they've moved on
}

export interface Person extends BaseDoc {
  firstName: string;
  lastName: string;
  nickname: string;
  circle: Circle;
  relationship: string; // personal contacts: "Sister", "School friend"...
  companyLinks: CompanyLink[];
  // Derived from companyLinks on every write, so "people at this company" is
  // a plain array lookup (and an array-contains query, should we ever need one).
  companyIds: string[];
  phones: Phone[];
  emails: Email[];
  address: string;
  summary: string;
  tags: string[];
}

export type NoteType = "general" | "if-i-go-back" | "call" | "meeting" | "email" | "idea";

export interface Note extends BaseDoc {
  body: string;
  type: NoteType;
  // A note can hang off any combination of records; it shows on each one.
  companyIds: string[];
  personIds: string[];
  engagementIds: string[];
  tags: string[];
  pinned: boolean;
  occurredAt: string; // ISO timestamp — when it happened; defaults to creation
}

// A stint of work for a company: enough detail to pick it up again if I go back.
export interface Engagement extends BaseDoc {
  companyId: string;
  title: string; // short name for the job, e.g. "Mallow resignalling"
  myRole: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // null = ongoing
  whatIDid: string;
  howIGotIt: string;
  viaCompanyId: string | null; // the agency, if one placed me
  viaPersonId: string | null; // the recruiter / person who put me forward
  keyContactIds: string[];
  rate: string; // free text: "£350/day", "£18/hr"...
  tags: string[];
}

export type DateKind = "birthday" | "anniversary" | "other";

// A yearly date linked to a person. Stored as month/day (+ optional year),
// never as a timestamp, so time zones and BST can't move it.
export interface ImportantDate extends BaseDoc {
  personId: string;
  kind: DateKind;
  label: string; // e.g. "Wedding anniversary"; blank for birthdays
  month: number; // 1-12
  day: number; // 1-31
  year: number | null;
  warnDays: number[]; // days before to remind; 0 = on the day
}

export type CollectionName = "companies" | "people" | "notes" | "engagements" | "importantDates";

export interface CollectionTypes {
  companies: Company;
  people: Person;
  notes: Note;
  engagements: Engagement;
  importantDates: ImportantDate;
}

export type RecordKind = "person" | "company" | "engagement";

export interface RecentRef {
  kind: RecordKind;
  id: string;
  at: string; // ISO timestamp
}
