import { db } from "./db";
import type { Candle } from "../types/markets";
import { fetchAllCandles, type RefreshProgress } from "../markets/api";
import { MIN_CANDLES_FOR_FULL_ANALYSIS } from "../markets/analysis";
import { excludeWeekends } from "../markets/dates";
import { PAIRS } from "../markets/pairs";

const API_KEY_SETTING = "markets:twelveDataApiKey";
const LAST_REFRESH_SETTING = "markets:lastRefreshedAt";

// Sized for the average monthly range (6 complete months + the current
// partial one, at ~21 trading days/month, plus a buffer) rather than just
// TDI's 52-candle minimum — that's the tallest pole now that AWR/AMR are
// part of the analysis too.
const FETCH_OUTPUT_SIZE = Math.max(MIN_CANDLES_FOR_FULL_ANALYSIS + 20, 160);

export async function getApiKey(): Promise<string> {
  const record = await db.settings.get(API_KEY_SETTING);
  return (record?.value as string | undefined) ?? "";
}

export async function setApiKey(key: string): Promise<void> {
  await db.settings.put({ key: API_KEY_SETTING, value: key.trim() });
}

export async function getLastRefreshedAt(): Promise<string | null> {
  const record = await db.settings.get(LAST_REFRESH_SETTING);
  return (record?.value as string | undefined) ?? null;
}

async function setLastRefreshedAt(iso: string): Promise<void> {
  await db.settings.put({ key: LAST_REFRESH_SETTING, value: iso });
}

export async function getCandlesForPair(pair: string): Promise<Candle[]> {
  return db.candles.where("pair").equals(pair).sortBy("date");
}

export async function getCandlesForPairs(pairs: string[]): Promise<Map<string, Candle[]>> {
  const all = await db.candles.where("pair").anyOf(pairs).toArray();
  const byPair = new Map<string, Candle[]>();
  for (const pair of pairs) byPair.set(pair, []);
  for (const candle of all) byPair.get(candle.pair)?.push(candle);
  for (const list of byPair.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  return byPair;
}

export interface RefreshResult {
  succeeded: string[];
  failed: Array<{ pair: string; message: string }>;
}

// Pulls fresh daily candles for every tracked pair from Twelve Data and
// caches them locally. Chunked + paced internally (see markets/api.ts) to
// respect the free-tier rate limit, so this can take a couple of minutes for
// the full 28-pair universe — call it from a manual "Refresh" action, not on
// every page load.
export async function refreshAllCandles(onProgress?: (p: RefreshProgress) => void): Promise<RefreshResult> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("No Twelve Data API key set. Add one in Settings first.");

  const results = await fetchAllCandles(PAIRS, apiKey, FETCH_OUTPUT_SIZE, onProgress);

  const succeeded: string[] = [];
  const failed: Array<{ pair: string; message: string }> = [];
  const toStore: Candle[] = [];

  for (const [pair, value] of results) {
    if (value instanceof Error) {
      failed.push({ pair, message: value.message });
    } else {
      succeeded.push(pair);
      toStore.push(...excludeWeekends(value));
    }
  }

  if (toStore.length > 0) await db.candles.bulkPut(toStore);
  await setLastRefreshedAt(new Date().toISOString());

  return { succeeded, failed };
}
