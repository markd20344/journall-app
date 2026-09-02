import type { Person } from "../types/family";
import { yearOf } from "./dates";

export function fullName(person: Person): string {
  const parts = [person.firstName, person.middleName, person.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Unnamed";
}

export function shortName(person: Person): string {
  const parts = [person.firstName, person.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Unnamed";
}

/** e.g. "1890 – 1962", "b. 1934", "d. 2001", or "" if both dates are unknown. */
export function lifespan(person: Person): string {
  const birthYear = yearOf(person.birth);
  const deathYear = yearOf(person.death);
  if (birthYear && deathYear) return `${birthYear} – ${deathYear}`;
  if (birthYear) return `b. ${birthYear}`;
  if (deathYear) return `d. ${deathYear}`;
  return "";
}

export function searchText(person: Person): string {
  return [fullName(person), person.maidenName, person.birthPlace, person.deathPlace, person.notes].join(" ").toLowerCase();
}
