import type { ValueDate, ValuePartDate } from "read-gedcom";
import type { DatePrecision, PartialDate } from "../types/family";
import { emptyDate } from "../types/family";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function hasMonth(part: ValuePartDate): part is ValuePartDate & { month: number } {
  return "month" in part;
}

function hasDay(part: ValuePartDate): part is ValuePartDate & { month: number; day: number } {
  return "day" in part;
}

function isoFromPart(part: ValuePartDate): string {
  const year = String(part.year.value).padStart(4, "0");
  if (!hasMonth(part)) return year;
  const month = String(part.month).padStart(2, "0");
  if (!hasDay(part)) return `${year}-${month}`;
  return `${year}-${month}-${String(part.day).padStart(2, "0")}`;
}

function displayFromPart(part: ValuePartDate): string {
  const year = part.year.value;
  if (!hasMonth(part)) return String(year);
  const month = MONTHS[part.month - 1] ?? String(part.month);
  if (!hasDay(part)) return `${month} ${year}`;
  return `${part.day} ${month} ${year}`;
}

/** Converts a read-gedcom parsed date (from `getDate().valueAsDate()`) into our PartialDate shape. */
export function convertGedcomDate(dates: (ValueDate | null)[] | undefined): PartialDate {
  const value = dates?.[0];
  if (!value) return emptyDate();

  if (value.isDatePunctual) {
    const iso = isoFromPart(value.date);
    const display = displayFromPart(value.date);
    if (value.isDateApproximated) {
      const kind = value.approximationKind;
      const precision: DatePrecision = kind.isEstimated ? "estimated" : kind.isCalculated ? "calculated" : "about";
      const prefix = kind.isEstimated ? "est." : kind.isCalculated ? "calc." : "abt.";
      return { iso, precision, display: `${prefix} ${display}` };
    }
    return { iso, precision: "exact", display };
  }

  if (value.isDateRange) {
    if ("dateBefore" in value && value.dateBefore) {
      return { iso: isoFromPart(value.dateBefore), precision: "before", display: `bef. ${displayFromPart(value.dateBefore)}` };
    }
    if ("dateAfter" in value && value.dateAfter) {
      return { iso: isoFromPart(value.dateAfter), precision: "after", display: `aft. ${displayFromPart(value.dateAfter)}` };
    }
  }

  if (value.isDatePeriod && "dateFrom" in value && value.dateFrom) {
    const fromDisplay = displayFromPart(value.dateFrom);
    const toDisplay = "dateTo" in value && value.dateTo ? ` – ${displayFromPart(value.dateTo)}` : "";
    return { iso: isoFromPart(value.dateFrom), precision: "exact", display: `${fromDisplay}${toDisplay}` };
  }

  if (value.hasPhrase) {
    return { iso: "", precision: "exact", display: value.phrase };
  }

  return emptyDate();
}
