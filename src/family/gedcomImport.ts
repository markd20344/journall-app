// Imports a GEDCOM export (e.g. from Ancestry: Tree Settings → Export Tree)
// into our people/relationships shape. Ancestry's GEDCOM export never
// includes the actual photos/scans — third-party tools can't pull those —
// so this only ever produces people, relationships and their dates/places;
// photos and records get added by hand afterward for the people who matter
// most (see README).
import { readGedcom } from "read-gedcom";
import type { SelectionAny } from "read-gedcom";
import { newId } from "../lib/id";
import { convertGedcomDate } from "./gedcomDates";
import { emptyDate } from "../types/family";
import type { Gender, Person, Relationship } from "../types/family";

export interface GedcomImportPreview {
  people: Person[];
  relationships: Relationship[];
  warnings: string[];
}

function firstValue(sel: SelectionAny): string {
  return sel.value()[0] ?? "";
}

function genderOf(sexValue: string): Gender {
  if (sexValue === "M") return "male";
  if (sexValue === "F") return "female";
  return "unknown";
}

export function parseGedcomFile(buffer: ArrayBuffer, uid: string): GedcomImportPreview {
  const gedcom = readGedcom(buffer);
  const warnings: string[] = [];
  const ts = new Date().toISOString();

  const xrefToPersonId = new Map<string, string>();
  const people: Person[] = [];

  for (const indi of gedcom.getIndividualRecord().arraySelect()) {
    const xref = indi.pointer()[0];
    if (!xref) continue;
    const id = newId();
    xrefToPersonId.set(xref, id);

    const nameParts = indi.getName().valueAsParts()[0];
    const given = nameParts?.[0] ?? "";
    const surname = nameParts?.[1] ?? "";
    const givenWords = given.trim().split(/\s+/).filter(Boolean);
    const firstName = givenWords[0] ?? "";
    const middleName = givenWords.slice(1).join(" ");

    const sex = firstValue(indi.getSex());
    const birth = indi.getEventBirth();
    const death = indi.getEventDeath();

    people.push({
      id,
      firstName,
      middleName,
      lastName: surname,
      maidenName: "",
      gender: genderOf(sex),
      birth: convertGedcomDate(birth.getDate().valueAsDate()),
      birthPlace: firstValue(birth.getPlace()),
      death: convertGedcomDate(death.getDate().valueAsDate()),
      deathPlace: firstValue(death.getPlace()),
      notes: "",
      profileMediaId: null,
      createdAt: ts,
      updatedAt: ts,
      createdBy: uid,
    });
  }

  const relationships: Relationship[] = [];
  for (const fam of gedcom.getFamilyRecord().arraySelect()) {
    const husbandXref = fam.getHusband().getIndividualRecord().pointer()[0];
    const wifeXref = fam.getWife().getIndividualRecord().pointer()[0];
    const husbandId = husbandXref ? xrefToPersonId.get(husbandXref) : undefined;
    const wifeId = wifeXref ? xrefToPersonId.get(wifeXref) : undefined;

    if (husbandId && wifeId) {
      const marriage = fam.getEventMarriage();
      const divorce = fam.getEventDivorce();
      const hasDivorce = divorce.length > 0;
      relationships.push({
        id: newId(),
        type: "spouse",
        personA: husbandId,
        personB: wifeId,
        subtype: "married",
        startDate: convertGedcomDate(marriage.getDate().valueAsDate()),
        startPlace: firstValue(marriage.getPlace()),
        endDate: hasDivorce ? convertGedcomDate(divorce.getDate().valueAsDate()) : emptyDate(),
        endReason: hasDivorce ? "divorced" : null,
        createdAt: ts,
        updatedAt: ts,
      });
    }

    const parentIds = [husbandId, wifeId].filter((v): v is string => Boolean(v));
    if (parentIds.length === 0) continue;

    for (const childRef of fam.getChild().arraySelect()) {
      const childXref = childRef.getIndividualRecord().pointer()[0];
      const childId = childXref ? xrefToPersonId.get(childXref) : undefined;
      if (!childId) continue;
      for (const parentId of parentIds) {
        relationships.push({
          id: newId(),
          type: "parent-child",
          personA: parentId,
          personB: childId,
          subtype: "biological",
          startDate: emptyDate(),
          startPlace: "",
          endDate: emptyDate(),
          endReason: null,
          createdAt: ts,
          updatedAt: ts,
        });
      }
    }
  }

  if (people.length === 0) warnings.push("No individuals found in this file — is it a valid GEDCOM export?");

  return { people, relationships, warnings };
}
