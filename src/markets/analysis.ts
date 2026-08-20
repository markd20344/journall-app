// Stacey Burke-style setup detection, plus ADR and TDI, computed purely off
// daily OHLC bars — no indicator library, just plain functions over Candle[].
import { getISODay, getISOWeek, getISOWeekYear } from "date-fns";
import type {
  BreakoutResult,
  BreakoutState,
  Candle,
  DayColor,
  DayResult,
  FirstDaySignal,
  InsideDayResult,
  KeyLevels,
  PairAnalysis,
  RangeStatus,
  StatusSummary,
  StatusTone,
  TdiResult,
  WeekLetterRow,
} from "../types/markets";
import { excludeWeekends } from "./dates";
import { pipSize } from "./pairs";

export function dayColor(candle: Candle): DayColor {
  if (candle.close > candle.open) return "green";
  if (candle.close < candle.open) return "red";
  return "flat";
}

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return `${getISOWeekYear(d)}-${getISOWeek(d)}`;
}

// Aligned on calendar weeks rather than a fixed count of trading days — a
// fixed "last 20 candles" slice rarely lands on a Monday, so the oldest
// week it covers gets arbitrarily truncated (e.g. 3 days instead of 5).
// Walking back by distinct ISO week instead means every week except the
// current (still in-progress) one keeps its full weekday set.
export function buildHistory(candles: Candle[], weeks = 4): DayResult[] {
  if (candles.length === 0) return [];
  const weekKeysNewestFirst: string[] = [];
  for (let i = candles.length - 1; i >= 0; i--) {
    const key = isoWeekKey(candles[i].date);
    if (weekKeysNewestFirst[weekKeysNewestFirst.length - 1] !== key) {
      weekKeysNewestFirst.push(key);
      if (weekKeysNewestFirst.length > weeks) break;
    }
  }
  const allowedWeeks = new Set(weekKeysNewestFirst.slice(0, weeks));
  return candles.filter((c) => allowedWeeks.has(isoWeekKey(c.date))).map((c) => ({ date: c.date, color: dayColor(c) }));
}

// Today is a First Red/Green Day when its color flips against yesterday's.
// `streakLen` counts the consecutive opposite-colored run being broken, and
// `oppositeDayInPriorWeek` looks ~5 trading days further back for a day that
// already matched today's new color — a long "clean" run with none is a
// stronger setup than one where the trend was already choppy.
export function detectFirstDaySignal(candles: Candle[]): FirstDaySignal | null {
  if (candles.length < 2) return null;
  const colors = candles.map(dayColor);
  const idx = colors.length - 1;
  const today = colors[idx];
  const yesterday = colors[idx - 1];
  if (today === "flat" || yesterday === "flat" || today === yesterday) return null;

  let i = idx - 1;
  let streakLen = 0;
  while (i >= 0 && colors[i] === yesterday) {
    streakLen++;
    i--;
  }
  const streakStart = i + 1;
  const windowStart = Math.max(0, streakStart - 5);
  let oppositeDayInPriorWeek = false;
  for (let j = windowStart; j < streakStart; j++) {
    if (colors[j] === today) {
      oppositeDayInPriorWeek = true;
      break;
    }
  }

  return { type: today === "green" ? "FGD" : "FRD", streakLen, oppositeDayInPriorWeek };
}

export function detectInsideOutsideDay(candles: Candle[]): InsideDayResult {
  if (candles.length < 2) return { isInsideDay: false, isOutsideDay: false };
  const today = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const sameRange = today.high === prev.high && today.low === prev.low;
  return {
    isInsideDay: today.high <= prev.high && today.low >= prev.low,
    isOutsideDay: !sameRange && today.high >= prev.high && today.low <= prev.low,
  };
}

// Auto-detects the range today broke out of, rather than checking a fixed
// lookback: starting from yesterday's own high/low, walk further back one
// day at a time for as long as each earlier day's range sits entirely
// inside the range accumulated so far (i.e. it was coiling, not expanding
// it). `rangeDays` ends up being the actual length of that consolidation,
// and the label is rangeDays + today = "Day 2 Breakout" for a single prior
// range day, "Day 3" for two, and so on — matching how these are commonly
// read off a chart, instead of a rigid one-size lookback.
//
// A daily bar's own high/low already tells us whether price pierced the
// range intrabar even if it closed back inside — that's what "wicked
// through and failed" (failed-breakout-*) captures, no intraday data needed.
export function detectBreakout(candles: Candle[], maxLookback = 10): BreakoutResult | null {
  if (candles.length < 3) return null;
  const today = candles[candles.length - 1];

  let rangeHigh = candles[candles.length - 2].high;
  let rangeLow = candles[candles.length - 2].low;
  let rangeDays = 1;

  for (let i = candles.length - 3; i >= 0 && rangeDays < maxLookback; i--) {
    const c = candles[i];
    if (c.high <= rangeHigh && c.low >= rangeLow) {
      rangeDays++;
    } else {
      break;
    }
  }

  let state: BreakoutState = "none";
  if (today.close > rangeHigh) state = "closed-breakout-up";
  else if (today.close < rangeLow) state = "closed-breakout-down";
  else if (today.high > rangeHigh) state = "failed-breakout-up";
  else if (today.low < rangeLow) state = "failed-breakout-down";

  return { state, rangeHigh, rangeLow, lookbackDays: rangeDays + 1 };
}

// What yesterday itself did, relative to what preceded it — used for the
// Key Levels panel's "Prev Day" row ("Breakout High", "Inside Day", ...).
function classifyDayOutcome(slice: Candle[]): string {
  const inside = detectInsideOutsideDay(slice);
  if (inside.isInsideDay) return "Inside Day";
  if (inside.isOutsideDay) return "Outside Day";
  const breakout = detectBreakout(slice);
  if (breakout) {
    if (breakout.state === "closed-breakout-up" || breakout.state === "failed-breakout-up") return "Breakout High";
    if (breakout.state === "closed-breakout-down" || breakout.state === "failed-breakout-down") return "Breakout Low";
  }
  return "Normal Day";
}

export function describePrevDay(candles: Candle[]): string | null {
  if (candles.length < 4) return null;
  return classifyDayOutcome(candles.slice(0, -1));
}

export interface PdhPdlStatus {
  pdhBroken: boolean;
  pdlBroken: boolean;
}

// Wick-based (not close-based): a print through the prior day's high/low
// counts as "broken" even without a close beyond it, which is the usual
// trader's definition of PDH/PDL getting taken out.
export function detectPdhPdlStatus(candles: Candle[]): PdhPdlStatus | null {
  if (candles.length < 2) return null;
  const today = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  return { pdhBroken: today.high > prev.high, pdlBroken: today.low < prev.low };
}

function weekCandles(candles: Candle[], key: string): Candle[] {
  return candles.filter((c) => isoWeekKey(c.date) === key);
}

// Is today still within the range Monday (this week's first trading day)
// set, or has it broken above/below it?
export function detectMondayRangeStatus(candles: Candle[]): RangeStatus | null {
  if (candles.length === 0) return null;
  const today = candles[candles.length - 1];
  const monday = weekCandles(candles, isoWeekKey(today.date))[0];
  if (!monday) return null;
  if (today.high > monday.high) return "broke-high";
  if (today.low < monday.low) return "broke-low";
  return "within";
}

// Same idea against last week's full high/low range.
export function detectPriorWeekRangeStatus(candles: Candle[]): RangeStatus | null {
  if (candles.length === 0) return null;
  const today = candles[candles.length - 1];
  const thisWeekKey = isoWeekKey(today.date);
  const priorCandles = candles.filter((c) => isoWeekKey(c.date) !== thisWeekKey);
  if (priorCandles.length === 0) return null;
  const priorWeek = weekCandles(candles, isoWeekKey(priorCandles[priorCandles.length - 1].date));
  if (priorWeek.length === 0) return null;
  const priorHigh = Math.max(...priorWeek.map((c) => c.high));
  const priorLow = Math.min(...priorWeek.map((c) => c.low));
  if (today.high > priorHigh) return "broke-high";
  if (today.low < priorLow) return "broke-low";
  return "within";
}

export function averageDailyRangePips(pair: string, candles: Candle[], lookback = 14): number | null {
  if (candles.length === 0) return null;
  const recent = candles.slice(-lookback);
  const avgRange = recent.reduce((sum, c) => sum + (c.high - c.low), 0) / recent.length;
  return avgRange / pipSize(pair);
}

export function todayRangePips(pair: string, candles: Candle[]): number | null {
  if (candles.length === 0) return null;
  const today = candles[candles.length - 1];
  return (today.high - today.low) / pipSize(pair);
}

// How much of the average daily range today has already covered, as a %.
export function adrUsedPct(pair: string, candles: Candle[], lookback = 14): number | null {
  const adr = averageDailyRangePips(pair, candles, lookback);
  const today = todayRangePips(pair, candles);
  if (adr === null || today === null || adr === 0) return null;
  return (today / adr) * 100;
}

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// "Day 2 - Tuesday" — today's position within the trading week.
export function buildDayLabel(candles: Candle[]): string | null {
  if (candles.length === 0) return null;
  const today = candles[candles.length - 1];
  const isoDay = getISODay(new Date(today.date + "T00:00:00Z"));
  if (isoDay < 1 || isoDay > 5) return null;
  return `Day ${isoDay} - ${WEEKDAY_NAMES[isoDay - 1]}`;
}

// "3 Green Days (thru yesterday)" — the streak leading into today, read as
// of yesterday's close (today's own bar may still be in progress).
export function buildDayColorSummary(candles: Candle[]): string | null {
  if (candles.length < 2) return null;
  const colors = candles.map(dayColor);
  const yestIdx = colors.length - 2;
  const yestColor = colors[yestIdx];
  if (yestColor === "flat") return "Flat (thru yesterday)";
  let streak = 0;
  let i = yestIdx;
  while (i >= 0 && colors[i] === yestColor) {
    streak++;
    i--;
  }
  const label = yestColor === "green" ? "Green" : "Red";
  return `${streak} ${label} Day${streak === 1 ? "" : "s"} (thru yesterday)`;
}

// M-F letter-grid over the last `weeks` calendar weeks (default 2, matching
// a "Last Wk / This Wk" view) — missing days (holidays, or days later this
// week that haven't happened yet) render as a blank cell.
export function buildWeekLetterGrid(candles: Candle[], weeks = 2): WeekLetterRow[] {
  if (candles.length === 0) return [];
  const byWeek = new Map<string, Candle[]>();
  for (const c of candles) {
    const key = isoWeekKey(c.date);
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key)!.push(c);
  }
  const weekKeysAsc = Array.from(byWeek.keys());
  const selected = weekKeysAsc.slice(-weeks);

  return selected.map((key, idx) => {
    const weeksAgo = selected.length - 1 - idx;
    const label = weeksAgo === 0 ? "This Wk" : weeksAgo === 1 ? "Last Wk" : `${weeksAgo} Wks Ago`;
    const byIsoDay = new Map<number, Candle>();
    for (const c of byWeek.get(key)!) byIsoDay.set(getISODay(new Date(c.date + "T00:00:00Z")), c);
    const days = [1, 2, 3, 4, 5].map((isoDay) => {
      const c = byIsoDay.get(isoDay);
      return { color: c ? dayColor(c) : null };
    });
    return { label, days };
  });
}

// The compact combined status line shown per row, e.g. "Inside Day + First
// Red Day" — inside/outside first, then the FRD/FGD flip, then breakout,
// each overriding the displayed color (tone) with its own when present, so
// a directional signal always wins over the neutral "Inside Day" amber.
export function buildStatusSummary(a: Pick<PairAnalysis, "firstDay" | "insideDay" | "breakout">): StatusSummary | null {
  const parts: string[] = [];
  let tone: StatusTone | null = null;

  if (a.insideDay.isInsideDay) {
    parts.push("Inside Day");
    tone = "amber";
  } else if (a.insideDay.isOutsideDay) {
    parts.push("Outside Day");
    tone = "amber";
  }

  if (a.firstDay) {
    parts.push(a.firstDay.type === "FRD" ? "First Red Day" : "First Green Day");
    tone = a.firstDay.type === "FRD" ? "red" : "green";
  }

  if (a.breakout && a.breakout.state !== "none") {
    const isUp = a.breakout.state.endsWith("up");
    const failed = a.breakout.state.startsWith("failed");
    parts.push(`Day ${a.breakout.lookbackDays} Breakout ${isUp ? "↑" : "↓"}${failed ? " (failed)" : ""}`);
    tone = isUp ? "green" : "red";
  }

  if (parts.length === 0) return null;
  return { text: parts.join(" + "), tone: tone ?? "amber" };
}

function buildKeyLevels(pair: string, candles: Candle[]): KeyLevels | null {
  if (candles.length < 3) return null;
  return {
    dayLabel: buildDayLabel(candles),
    dayColorSummary: buildDayColorSummary(candles),
    insideDay: detectInsideOutsideDay(candles).isInsideDay,
    pdhBroken: detectPdhPdlStatus(candles)?.pdhBroken ?? false,
    pdlBroken: detectPdhPdlStatus(candles)?.pdlBroken ?? false,
    prevDaySummary: describePrevDay(candles),
    mondayRange: detectMondayRangeStatus(candles),
    priorWeekRange: detectPriorWeekRangeStatus(candles),
    adrPips: averageDailyRangePips(pair, candles, 14),
    adrUsedPct: adrUsedPct(pair, candles, 14),
    tdiLevel: computeTdi(candles)?.rsi ?? null,
  };
}

// --- TDI (Traders Dynamic Index): RSI(13) + a fast/slow smoothing of it,
// plus Bollinger-style volatility bands around the RSI itself. Standard
// Dean Malone defaults: RSI 13, price line SMA2, signal line SMA7, bands
// SMA34 +/- 1.6185 stdev. Overbought/oversold read off 68/32, the levels
// TDI is conventionally plotted with (not the RSI-classic 70/30 or 80/20).
const RSI_PERIOD = 13;
const PRICE_LINE_PERIOD = 2;
const SIGNAL_PERIOD = 7;
const BAND_PERIOD = 34;
const BAND_MULT = 1.6185;

function computeRsiSeries(closes: number[], period: number): number[] {
  const rsi: number[] = new Array(closes.length).fill(NaN);
  if (closes.length <= period) return rsi;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

function windowSma(values: number[], period: number, endIndex: number): number | null {
  const start = endIndex - period + 1;
  if (start < 0) return null;
  let sum = 0;
  for (let i = start; i <= endIndex; i++) {
    if (Number.isNaN(values[i])) return null;
    sum += values[i];
  }
  return sum / period;
}

function windowStdDev(values: number[], period: number, endIndex: number, mean: number): number | null {
  const start = endIndex - period + 1;
  if (start < 0) return null;
  let sumSq = 0;
  for (let i = start; i <= endIndex; i++) {
    if (Number.isNaN(values[i])) return null;
    sumSq += (values[i] - mean) ** 2;
  }
  return Math.sqrt(sumSq / period);
}

export function computeTdi(candles: Candle[]): TdiResult | null {
  const closes = candles.map((c) => c.close);
  if (closes.length < RSI_PERIOD + BAND_PERIOD) return null;

  const rsiSeries = computeRsiSeries(closes, RSI_PERIOD);
  const last = rsiSeries.length - 1;
  const rsi = rsiSeries[last];
  const priceLine = windowSma(rsiSeries, PRICE_LINE_PERIOD, last);
  const signalLine = windowSma(rsiSeries, SIGNAL_PERIOD, last);
  const bandMid = windowSma(rsiSeries, BAND_PERIOD, last);
  const sd = bandMid === null ? null : windowStdDev(rsiSeries, BAND_PERIOD, last, bandMid);

  if (Number.isNaN(rsi) || priceLine === null || signalLine === null || bandMid === null || sd === null) {
    return null;
  }

  return {
    rsi,
    priceLine,
    signalLine,
    bandUpper: bandMid + BAND_MULT * sd,
    bandLower: bandMid - BAND_MULT * sd,
    bandMid,
    zone: rsi >= 68 ? "overbought" : rsi <= 32 ? "oversold" : "neutral",
  };
}

// Minimum candle history needed for every metric below to have real values
// (TDI's 34-period band is the tall pole) — used to size the API fetch.
export const MIN_CANDLES_FOR_FULL_ANALYSIS = RSI_PERIOD + BAND_PERIOD + 5;

export function analyzePair(pair: string, rawCandles: Candle[]): PairAnalysis {
  const candles = excludeWeekends(rawCandles).sort((a, b) => a.date.localeCompare(b.date));
  return {
    pair,
    candles,
    history: buildHistory(candles, 3),
    weekGrid: buildWeekLetterGrid(candles, 2),
    firstDay: detectFirstDaySignal(candles),
    insideDay: detectInsideOutsideDay(candles),
    breakout: detectBreakout(candles),
    adrPips: averageDailyRangePips(pair, candles, 14),
    todayRangePips: todayRangePips(pair, candles),
    tdi: computeTdi(candles),
    keyLevels: buildKeyLevels(pair, candles),
    lastClose: candles.length ? candles[candles.length - 1].close : null,
    lastUpdated: candles.length ? candles[candles.length - 1].date : null,
  };
}
