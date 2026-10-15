// Calendar-date arithmetic for important dates and engagements.
//
// Everything here works on plain "YYYY-MM-DD" strings and does its maths in
// UTC, so British Summer Time changes can never shift a birthday onto the
// wrong day. "Today" is always the device's local date (todayLocal()).
// The same functions will drive the daily email digest (Phase 4), so keep
// them pure and dependency-free.

const DAY_MS = 86_400_000;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate(); // month is 1-12
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Device-local today as YYYY-MM-DD. */
export function todayLocal(now = new Date()): string {
  return ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function parseYmd(s: string): { year: number; month: number; day: number } {
  const [year, month, day] = s.split("-").map(Number);
  return { year, month, day };
}

function toUtc(s: string): number {
  const { year, month, day } = parseYmd(s);
  return Date.UTC(year, month - 1, day);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export function addDays(s: string, days: number): string {
  const d = new Date(toUtc(s) + days * DAY_MS);
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * The date a yearly event (month/day) falls on in a given year. A 29 February
 * birthday is marked on 28 February in non-leap years.
 */
export function occurrenceInYear(month: number, day: number, year: number): string {
  return ymd(year, month, Math.min(day, daysInMonth(year, month)));
}

/** The next time a yearly event happens, on or after `today`. */
export function nextOccurrence(month: number, day: number, today: string): string {
  const { year } = parseYmd(today);
  const thisYear = occurrenceInYear(month, day, year);
  return daysBetween(today, thisYear) >= 0 ? thisYear : occurrenceInYear(month, day, year + 1);
}

export interface YearlyDate {
  month: number;
  day: number;
  year: number | null; // birth/wedding year, when known
  warnDays: number[]; // e.g. [14, 3, 0]: two weeks before, three days before, on the day
}

export interface Upcoming<T> {
  item: T;
  date: string; // the occurrence, YYYY-MM-DD
  daysAway: number; // 0 = today
  years: number | null; // age they turn / anniversary number, if the year is known
}

export function upcoming<T extends YearlyDate>(items: T[], today: string, windowDays: number): Upcoming<T>[] {
  return items
    .map((item) => {
      const date = nextOccurrence(item.month, item.day, today);
      const daysAway = daysBetween(today, date);
      const years = item.year ? parseYmd(date).year - item.year : null;
      return { item, date, daysAway, years: years !== null && years > 0 ? years : null };
    })
    .filter((u) => u.daysAway <= windowDays)
    .sort((a, b) => a.daysAway - b.daysAway);
}

/** True when today is one of the item's warning days for its next occurrence. */
export function reminderDueToday(item: YearlyDate, today: string): boolean {
  const daysAway = daysBetween(today, nextOccurrence(item.month, item.day, today));
  return item.warnDays.includes(daysAway);
}

export function relativeDays(daysAway: number): string {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  if (daysAway < 0) return daysAway === -1 ? "Yesterday" : `${-daysAway} days ago`;
  if (daysAway < 7) return `In ${daysAway} days`;
  if (daysAway < 14) return "In a week";
  return `In ${Math.floor(daysAway / 7)} weeks`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? "";
}

/** "14 Mar" or "14 Mar 1985". */
export function formatDayMonth(month: number, day: number, year?: number | null): string {
  return `${day} ${monthName(month)}${year ? ` ${year}` : ""}`;
}

/** "Sat 14 Mar" for an occurrence date. */
export function formatOccurrence(s: string): string {
  const { year, month, day } = parseYmd(s);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${day} ${monthName(month)}`;
}

/** "Mar 2019" for an engagement start/end. */
export function formatMonthYear(s: string): string {
  const { year, month } = parseYmd(s);
  return `${monthName(month)} ${year}`;
}

/** "1 yr 3 mos", "8 mos", "3 wks" between two dates (end inclusive-ish). */
export function formatDuration(start: string, end: string): string {
  const days = daysBetween(start, end);
  if (days < 0) return "";
  if (days < 31) {
    const weeks = Math.max(1, Math.round(days / 7));
    return `${weeks} wk${weeks === 1 ? "" : "s"}`;
  }
  const a = parseYmd(start);
  const b = parseYmd(end);
  let months = (b.year - a.year) * 12 + (b.month - a.month) + (b.day >= a.day ? 0 : -1);
  months = Math.max(1, months);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years) parts.push(`${years} yr${years === 1 ? "" : "s"}`);
  if (rest) parts.push(`${rest} mo${rest === 1 ? "" : "s"}`);
  return parts.join(" ");
}

/** "Mar 2019 – Jun 2020 · 1 yr 3 mos", or "... – now · 8 mos" while ongoing. */
export function engagementPeriod(e: { startDate: string; endDate: string | null }, today = todayLocal()): string {
  const range = `${formatMonthYear(e.startDate)} – ${e.endDate ? formatMonthYear(e.endDate) : "now"}`;
  const length = formatDuration(e.startDate, e.endDate ?? today);
  return length ? `${range} · ${length}` : range;
}
