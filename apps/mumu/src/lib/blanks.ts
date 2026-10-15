// Defaults for new records. Also used to fill in fields missing from older
// or hand-edited docs before they reach a form.
import { newId } from "@journall/shared/lib/id";
import type { NewRecord } from "../data/repo";
import type { NoteType } from "../types";

export function blankCompany(name = ""): NewRecord<"companies"> {
  return { name, type: "client", status: "active", address: "", postcode: "", website: "", summary: "", tags: [] };
}

/** Splits a typed full name: everything up to the last word is the first name. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

export function blankPerson(fullName = ""): NewRecord<"people"> {
  return {
    ...splitName(fullName),
    nickname: "",
    circle: "work",
    relationship: "",
    companyLinks: [],
    companyIds: [],
    phones: [],
    emails: [],
    address: "",
    summary: "",
    tags: [],
  };
}

export function blankNote(type: NoteType = "general"): NewRecord<"notes"> {
  return {
    body: "",
    type,
    companyIds: [],
    personIds: [],
    engagementIds: [],
    tags: [],
    pinned: false,
    occurredAt: new Date().toISOString(),
  };
}

export function blankPhone(label = "mobile") {
  return { id: newId(), label, number: "" };
}

export function blankEmail(label = "personal") {
  return { id: newId(), label, address: "" };
}
