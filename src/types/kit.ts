// Domain types for the kit-collection round: each day's email lists a
// handful of people to visit and collect company kit back from. These
// shapes are plain and JSON-serializable, same rule as the journal types —
// they're also what gets synced through Firestore.

export type ContactOutcome = "no_response" | "disconnected" | "delivered_no_reply" | "replied";

// One text sent to one number for a job. A job can have several numbers and
// several attempts per number before you either give up or get a reply.
export interface ContactAttempt {
  id: string;
  phoneNumber: string;
  outcome: ContactOutcome;
  note: string;
  createdAt: string; // ISO timestamp
}

// "answered_not_home" covers the very common case of someone else (mother,
// brother, whoever) answering the door while the actual contact isn't in —
// distinct from nobody answering at all, and worded differently in the
// report either way.
export type DoorVisitOutcome = "answered" | "answered_not_home" | "no_answer";

// A knock on the door. photoDataUrl holds the "nobody answered" evidence
// photo as a small compressed JPEG data URL — see lib/photo.ts.
export interface DoorVisit {
  id: string;
  outcome: DoorVisitOutcome;
  note: string;
  photoDataUrl: string | null;
  createdAt: string; // ISO timestamp
}

// What actually came back at the door. Counts rather than booleans for
// everything except the rucksack and tablet, since fuel cards, ID cards and
// number plates can come back in any quantity, and phones have shown up
// more than once per job before.
export interface KitCollected {
  rucksack: boolean;
  tablets: number;
  phones: number;
  fuelCards: number;
  idCards: number;
  numberPlates: number;
  other: string; // free text for anything that doesn't fit the above
  loggedAt: string; // ISO timestamp
}

// The life-cycle stage is always *derived* from the fields below (see
// lib/kitStage.ts's deriveStage) rather than stored — that keeps it
// impossible for a stage to drift out of sync with the events that are
// supposed to have produced it, on this device or another one after a sync.
export type JobStage = "no_visit_needed" | "new" | "contacted" | "visited" | "collected" | "emailed" | "dropped_off";

export interface KitJob {
  id: string;
  batchDate: string; // YYYY-MM-DD — the day this job is scheduled to be visited
  jobNumber: string; // as given in the company email, if any
  customerName: string;
  address: string;
  postcode: string;
  phoneNumbers: string[];
  rawText: string; // the original pasted email block this job was parsed from
  notes: string;
  routeOrder: number | null; // this job's position in batchDate's route; null = not yet ordered
  lat: number | null; // geocoded from postcode via postcodes.io
  lng: number | null;
  // Set the moment "Text"/"Reply" is tapped (from the Jobs list or the
  // editor's phone row) — deliberately just a fact ("I've sent them
  // something"), not tied to any particular outcome, since a text sent from
  // the phone's own Messages app can't be paired with whatever comes back.
  textedAt: string | null;
  // What they said back, logged separately once/if a reply actually shows
  // up — respondedAt is null until responseNote is saved non-empty.
  respondedAt: string | null;
  responseNote: string;
  // The text didn't go through — number's dead/disconnected. A separate
  // flag rather than a third contactAttempt-style outcome, same lightweight
  // pattern as noVisitNeeded/needsReschedule, and reported as its own line
  // distinct from a plain "no response".
  numberInvalid: boolean;
  // Ticked when a response says a visit isn't needed after all. Keeps the
  // job visible here (so it's still "on the list" to review) and pulls it
  // out of route planning — see kitStage.deriveStage and KitRouteView —
  // but it's still included in the office email (with noVisitReason, if
  // given) so the office knows why nothing happened rather than the job
  // just silently vanishing from the report.
  noVisitNeeded: boolean;
  noVisitReason: string;
  // A visit that came up empty (no answer, no kit) sometimes just needs
  // another attempt rather than being abandoned — this keeps that flagged
  // for a follow-up rather than the job silently going stale.
  needsReschedule: boolean;
  contactAttempts: ContactAttempt[];
  visits: DoorVisit[];
  kitCollected: KitCollected | null; // null until logged
  officeEmailedAt: string | null; // when the evening "here's what I collected" email was sent
  droppedOffAt: string | null; // when this kit was physically dropped at BCA Corby
  droppedOffBatchId: string | null; // groups jobs dropped off together in the same trip
  createdAt: string;
  updatedAt: string;
}
