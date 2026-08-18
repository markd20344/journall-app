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

export type DoorVisitOutcome = "answered" | "no_answer";

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
export type JobStage = "new" | "contacted" | "visited" | "collected" | "emailed" | "dropped_off";

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
  contactAttempts: ContactAttempt[];
  visits: DoorVisit[];
  kitCollected: KitCollected | null; // null until logged
  officeEmailedAt: string | null; // when the evening "here's what I collected" email was sent
  droppedOffAt: string | null; // when this kit was physically dropped at BCA Corby
  droppedOffBatchId: string | null; // groups jobs dropped off together in the same trip
  createdAt: string;
  updatedAt: string;
}
