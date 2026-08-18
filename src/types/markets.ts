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
  lookbackDays: number;
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
  firstDay: FirstDaySignal | null;
  insideDay: InsideDayResult;
  breakout: BreakoutResult | null;
  adrPips: number | null;
  todayRangePips: number | null;
  tdi: TdiResult | null;
  lastClose: number | null;
  lastUpdated: string | null; // date of the most recent cached candle
}
