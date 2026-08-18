// Stacey Burke-style setup detection, plus ADR and TDI, computed purely off
// daily OHLC bars — no indicator library, just plain functions over Candle[].
import { getISOWeek, getISOWeekYear } from "date-fns";
import type {
  BreakoutResult,
  BreakoutState,
  Candle,
  DayColor,
  DayResult,
  FirstDaySignal,
  InsideDayResult,
  PairAnalysis,
  TdiResult,
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

// Range = the high/low of the `lookbackDays` days *before* today. A daily
// bar's own high/low already tells us whether price pierced that range
// intrabar even if it closed back inside — that's what "wicked through and
// failed" (failed-breakout-*) captures, without needing intraday data.
export function detectBreakout(candles: Candle[], lookbackDays = 3): BreakoutResult | null {
  if (candles.length < lookbackDays + 1) return null;
  const today = candles[candles.length - 1];
  const rangeCandles = candles.slice(candles.length - 1 - lookbackDays, candles.length - 1);
  const rangeHigh = Math.max(...rangeCandles.map((c) => c.high));
  const rangeLow = Math.min(...rangeCandles.map((c) => c.low));

  let state: BreakoutState = "none";
  if (today.close > rangeHigh) state = "closed-breakout-up";
  else if (today.close < rangeLow) state = "closed-breakout-down";
  else if (today.high > rangeHigh) state = "failed-breakout-up";
  else if (today.low < rangeLow) state = "failed-breakout-down";

  return { state, rangeHigh, rangeLow, lookbackDays };
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
    history: buildHistory(candles, 4),
    firstDay: detectFirstDaySignal(candles),
    insideDay: detectInsideOutsideDay(candles),
    breakout: detectBreakout(candles, 3),
    adrPips: averageDailyRangePips(pair, candles, 14),
    todayRangePips: todayRangePips(pair, candles),
    tdi: computeTdi(candles),
    lastClose: candles.length ? candles[candles.length - 1].close : null,
    lastUpdated: candles.length ? candles[candles.length - 1].date : null,
  };
}
