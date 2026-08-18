import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { analyzePair } from "../markets/analysis";
import { PAIRS } from "../markets/pairs";
import type { Candle, PairAnalysis } from "../types/markets";

// Live-queries the cached candles and recomputes every pair's Stacey Burke
// analysis reactively — refreshing candles (marketsRepo.refreshAllCandles)
// writes to the same Dexie table, so this updates on its own once a refresh
// lands, no manual re-fetch/poll needed.
export function useAllPairAnalyses(): PairAnalysis[] {
  const candles = useLiveQuery(() => db.candles.toArray(), [], []) ?? [];

  const byPair = new Map<string, Candle[]>();
  for (const pair of PAIRS) byPair.set(pair, []);
  for (const candle of candles) byPair.get(candle.pair)?.push(candle);

  return PAIRS.map((pair) => analyzePair(pair, byPair.get(pair) ?? []));
}
