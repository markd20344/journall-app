// Domain types for the Markets dashboard (Stacey Burke-style price-action
// setups across FX majors + crosses). Kept separate from the journal's core
// types (types/index.ts) since this is a distinct sub-domain with its own
// external data source (Twelve Data) rather than user-authored content.

// A single daily OHLC bar for one pair.
export interface Candle {
  pair: string; // e.g. "EURUSD" — see markets/pairs.ts for the canonical list
  date: string; // YYYY-MM-DD (the trading day this bar covers)
  open: number;
  high: number;
  low: number;
  close: number;
}

export type DayColor = "green" | "red" | "flat";

// One day's color-coded outcome, used to render the Mon–Fri history strip.
export interface DayResult {
  date: string;
  color: DayColor;
}

// First Red/Green Day: today's close broke a same-colored streak. `streakLen`
// is how many consecutive opposite-colored days preceded it (the run being
// broken) — this is what the user checks against "at least 2, wary above ~5".
export interface FirstDaySignal {
  type: "FRD" | "FGD";
  streakLen: number;
  // Was there a same-color day (i.e. a day matching today's new color)
  // anywhere in the ~5 trading days before the streak started? Burke's
  // caution: a long clean run with no opposing day in the prior week is a
  // stronger/cleaner setup than one where the "trend" was already choppy.
  oppositeDayInPriorWeek: boolean;
}

export interface InsideDayResult {
  isInsideDay: boolean;
  isOutsideDay: boolean;
}

export type BreakoutState =
  | "none" // closed inside the prior range, no wick breach either
  | "closed-breakout-up" // closed beyond the range high
  | "closed-breakout-down" // closed beyond the range low
  | "failed-breakout-up" // wicked above the range high but closed back inside
  | "failed-breakout-down"; // wicked below the range low but closed back inside

export interface BreakoutResult {
  state: BreakoutState;
  rangeHigh: number;
  rangeLow: number;
  // Total days in the pattern: the auto-detected run of prior days that
  // coiled inside a shared range, plus the breakout day itself — e.g. 1
  // range day + today = "Day 2 Breakout", 2 range days + today = "Day 3".
  lookbackDays: number;
}

export type RangeStatus = "within" | "broke-high" | "broke-low";

// One cell in the M-F letter-grid: null means no trading day landed there
// (a holiday, or a day later this week that hasn't happened yet).
export interface WeekLetterDay {
  color: DayColor | null;
}

export interface WeekLetterRow {
  label: string; // "This Wk", "Last Wk", "2 Wks Ago", ...
  days: WeekLetterDay[]; // exactly 5, Monday..Friday
}

// The per-pair drill-down panel (Key Levels).
export interface KeyLevels {
  dayLabel: string | null; // "Day 2 - Tuesday"
  dayColorSummary: string | null; // "3 Green Days (thru yesterday)"
  insideDay: boolean;
  pdhBroken: boolean;
  pdlBroken: boolean;
  prevDaySummary: string | null; // "Breakout High" / "Inside Day" / "Normal Day" / ...
  mondayRange: RangeStatus | null;
  priorWeekRange: RangeStatus | null;
  adrPips: number | null;
  adrUsedPct: number | null;
  awrPips: number | null; // average weekly range, last 8 complete weeks
  amrPips: number | null; // average monthly range, last 6 complete months
  tdiLevel: number | null;
}

export type StatusTone = "red" | "green" | "amber";

// The compact combined status line shown per row, e.g. "Inside Day + First
// Red Day" — built from whichever of FRD/FGD, inside/outside day, and
// breakout are currently active, joined together.
export interface StatusSummary {
  text: string;
  tone: StatusTone;
}

export interface TdiResult {
  rsi: number;
  priceLine: number; // fast RSI-smoothed line (SMA2 of RSI)
  signalLine: number; // slow line (SMA7 of RSI)
  bandUpper: number;
  bandLower: number;
  bandMid: number;
  zone: "overbought" | "oversold" | "neutral";
}

// Full computed state for one pair, as shown on one dashboard row.
export interface PairAnalysis {
  pair: string;
  candles: Candle[]; // ascending by date, most recent last
  history: DayResult[]; // last N trading days for the circle strip
  weekGrid: WeekLetterRow[]; // last N calendar weeks, M-F letter-grid form
  firstDay: FirstDaySignal | null;
  insideDay: InsideDayResult;
  breakout: BreakoutResult | null;
  adrPips: number | null;
  todayRangePips: number | null;
  awrPips: number | null; // average weekly range, last 8 complete weeks
  amrPips: number | null; // average monthly range, last 6 complete months
  tdi: TdiResult | null;
  keyLevels: KeyLevels | null;
  lastClose: number | null;
  lastUpdated: string | null; // date of the most recent cached candle
}
