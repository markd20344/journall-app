import type { DatePrecision, PartialDate } from "../types/family";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PRECISION_PREFIX: Record<DatePrecision, string> = {
  exact: "",
  about: "abt. ",
  before: "bef. ",
  after: "aft. ",
  estimated: "est. ",
  calculated: "calc. ",
};

export const DATE_PRECISION_OPTIONS: Array<{ value: DatePrecision; label: string }> = [
  { value: "exact", label: "Exact" },
  { value: "about", label: "About" },
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
  { value: "estimated", label: "Estimated" },
];

/** Builds a PartialDate from separate year/month/day inputs — month and day are optional. */
export function buildPartialDate(
  precision: DatePrecision,
  year: string,
  month: string,
  day: string,
): PartialDate {
  const y = year.trim();
  if (!y || !/^\d{1,4}$/.test(y)) return { iso: "", precision, display: "" };
  const paddedYear = y.padStart(4, "0");
  const m = month.trim() ? Math.min(12, Math.max(1, parseInt(month, 10))) : null;
  const d = m && day.trim() ? Math.min(31, Math.max(1, parseInt(day, 10))) : null;

  let iso = paddedYear;
  let display = y;
  if (m) {
    iso += `-${String(m).padStart(2, "0")}`;
    display = `${MONTHS[m - 1]} ${y}`;
    if (d) {
      iso += `-${String(d).padStart(2, "0")}`;
      display = `${d} ${MONTHS[m - 1]} ${y}`;
    }
  }
  return { iso, precision, display: `${PRECISION_PREFIX[precision]}${display}` };
}

/** Splits a PartialDate's iso string back into the year/month/day inputs buildPartialDate expects. */
export function splitPartialDate(date: PartialDate): { year: string; month: string; day: string } {
  const [y, m, d] = date.iso.split("-");
  return { year: y ?? "", month: m ? String(parseInt(m, 10)) : "", day: d ? String(parseInt(d, 10)) : "" };
}

export function formatDateRange(start: PartialDate, end: PartialDate): string {
  if (start.display && end.display) return `${start.display} – ${end.display}`;
  if (start.display) return start.display;
  if (end.display) return `– ${end.display}`;
  return "";
}

/** Best-effort year, for sorting/timelines even when the date is only partially known. */
export function yearOf(date: PartialDate): number | null {
  const y = date.iso.slice(0, 4);
  return /^\d{4}$/.test(y) ? parseInt(y, 10) : null;
}
