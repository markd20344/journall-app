import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatDuration,
  formatOccurrence,
  nextOccurrence,
  relativeDays,
  reminderDueToday,
  todayLocal,
  upcoming,
} from "./dates";

describe("daysBetween / addDays", () => {
  it("counts across month and year ends", () => {
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
  it("isn't thrown by the clocks changing (BST ends 25 Oct 2026)", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("nextOccurrence", () => {
  it("later this year", () => expect(nextOccurrence(12, 25, "2026-10-15")).toBe("2026-12-25"));
  it("today counts as next", () => expect(nextOccurrence(10, 15, "2026-10-15")).toBe("2026-10-15"));
  it("already passed rolls to next year", () => expect(nextOccurrence(3, 1, "2026-10-15")).toBe("2027-03-01"));
  it("29 Feb falls on 28 Feb in a non-leap year", () => expect(nextOccurrence(2, 29, "2026-10-15")).toBe("2027-02-28"));
  it("29 Feb stays 29 Feb in a leap year", () => expect(nextOccurrence(2, 29, "2027-10-15")).toBe("2028-02-29"));
  it("29 Feb is 'today' on 28 Feb of a non-leap year", () => expect(nextOccurrence(2, 29, "2027-02-28")).toBe("2027-02-28"));
});

describe("upcoming", () => {
  const items = [
    { id: "a", month: 10, day: 20, year: 1986, warnDays: [14, 3, 0] },
    { id: "b", month: 10, day: 15, year: null, warnDays: [0] },
    { id: "c", month: 12, day: 25, year: null, warnDays: [0] },
    { id: "d", month: 10, day: 1, year: 2000, warnDays: [0] },
  ];
  it("keeps the window, soonest first, with the age they turn", () => {
    const list = upcoming(items, "2026-10-15", 30);
    expect(list.map((u) => u.item.id)).toEqual(["b", "a"]);
    expect(list[0].daysAway).toBe(0);
    expect(list[1]).toMatchObject({ date: "2026-10-20", daysAway: 5, years: 40 });
  });
  it("a date that passed this month comes round next year", () => {
    const d = upcoming(items, "2026-10-15", 366).find((u) => u.item.id === "d")!;
    expect(d).toMatchObject({ date: "2027-10-01", years: 27 });
  });
});

describe("reminderDueToday", () => {
  const bday = { month: 10, day: 29, year: null, warnDays: [14, 3, 0] };
  it("fires on each warning day", () => {
    expect(reminderDueToday(bday, "2026-10-15")).toBe(true); // 14 days before
    expect(reminderDueToday(bday, "2026-10-26")).toBe(true); // 3 days before
    expect(reminderDueToday(bday, "2026-10-29")).toBe(true); // on the day
  });
  it("is quiet on other days", () => {
    expect(reminderDueToday(bday, "2026-10-16")).toBe(false);
    expect(reminderDueToday(bday, "2026-10-30")).toBe(false);
  });
});

describe("formatting", () => {
  it("relative days", () => {
    expect(relativeDays(0)).toBe("Today");
    expect(relativeDays(1)).toBe("Tomorrow");
    expect(relativeDays(5)).toBe("In 5 days");
    expect(relativeDays(20)).toBe("In 2 weeks");
  });
  it("occurrence with weekday", () => expect(formatOccurrence("2026-10-17")).toBe("Sat 17 Oct"));
  it("durations", () => {
    expect(formatDuration("2019-03-04", "2020-06-20")).toBe("1 yr 3 mos");
    expect(formatDuration("2024-01-10", "2024-09-09")).toBe("7 mos");
    expect(formatDuration("2024-01-10", "2024-01-24")).toBe("2 wks");
  });
  it("todayLocal uses local calendar date", () => expect(todayLocal(new Date(2026, 9, 15, 23, 30))).toBe("2026-10-15"));
});
