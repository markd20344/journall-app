// FX trading-day helpers. Twelve Data's daily series can include a stray
// Saturday/Sunday bar (weekend rollover artifacts, or a broker's Sunday
// open bar) even though the market is closed then — left in, those flat/
// off-cycle bars distort streaks, inside-day, and breakout range checks.
import type { Candle } from "../types/markets";

export function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + "T00:00:00Z").getUTCDay();
  return day === 0 || day === 6; // Sunday, Saturday
}

export function excludeWeekends(candles: Candle[]): Candle[] {
  return candles.filter((c) => !isWeekend(c.date));
}
