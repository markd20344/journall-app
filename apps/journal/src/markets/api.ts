// Twelve Data client. Called directly from the browser (Twelve Data's API
// supports CORS) — no backend, matching this app's local-first/no-server
// philosophy. The API key lives in the local Dexie settings table (see
// marketsRepo.ts), entered by the user in Settings, never committed to the
// repo or sent anywhere except Twelve Data's own endpoint.
import type { Candle } from "../types/markets";
import { fromTwelveDataSymbol, toTwelveDataSymbol } from "./pairs";

const BASE_URL = "https://api.twelvedata.com/time_series";

// Twelve Data's free tier throttles to 8 API credits/minute; each symbol in
// a batched request still costs a credit, so we chunk requests and pace them
// a little over a minute apart rather than firing everything at once.
export const CHUNK_SIZE = 8;
export const CHUNK_DELAY_MS = 62_000;

interface TwelveDataValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

interface TwelveDataSeries {
  status: string;
  message?: string;
  values?: TwelveDataValue[];
}

export class TwelveDataError extends Error {}

function parseSeries(pair: string, series: TwelveDataSeries): Candle[] {
  if (series.status !== "ok" || !series.values) {
    throw new TwelveDataError(series.message ?? `No data returned for ${pair}`);
  }
  return series.values.map((v) => ({
    pair,
    date: v.datetime.slice(0, 10),
    open: Number(v.open),
    high: Number(v.high),
    low: Number(v.low),
    close: Number(v.close),
  }));
}

// One batched call for up to CHUNK_SIZE pairs. Twelve Data returns the
// single-symbol shape directly ({status, values}) when only one symbol is
// requested, and a dict keyed by symbol when multiple are requested.
async function fetchChunk(
  pairs: string[],
  apiKey: string,
  outputsize: number,
): Promise<Map<string, Candle[] | Error>> {
  const symbols = pairs.map(toTwelveDataSymbol).join(",");
  const url = `${BASE_URL}?symbol=${encodeURIComponent(symbols)}&interval=1day&outputsize=${outputsize}&apikey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new TwelveDataError(`Twelve Data request failed (${res.status})`);
  }
  const body = await res.json();
  const result = new Map<string, Candle[] | Error>();

  if (pairs.length === 1) {
    try {
      result.set(pairs[0], parseSeries(pairs[0], body as TwelveDataSeries));
    } catch (err) {
      result.set(pairs[0], err instanceof Error ? err : new Error(String(err)));
    }
    return result;
  }

  for (const [symbol, series] of Object.entries(body as Record<string, TwelveDataSeries>)) {
    const pair = fromTwelveDataSymbol(symbol);
    try {
      result.set(pair, parseSeries(pair, series));
    } catch (err) {
      result.set(pair, err instanceof Error ? err : new Error(String(err)));
    }
  }
  return result;
}

export interface RefreshProgress {
  completedChunks: number;
  totalChunks: number;
  pairsDone: number;
  totalPairs: number;
}

// Fetches daily candles for every pair, chunked and paced to respect the
// free-tier rate limit. Returns per-pair results (candles or the error that
// pair failed with) so one bad symbol doesn't abort the whole refresh.
export async function fetchAllCandles(
  pairs: string[],
  apiKey: string,
  outputsize: number,
  onProgress?: (progress: RefreshProgress) => void,
): Promise<Map<string, Candle[] | Error>> {
  const chunks: string[][] = [];
  for (let i = 0; i < pairs.length; i += CHUNK_SIZE) {
    chunks.push(pairs.slice(i, i + CHUNK_SIZE));
  }

  const results = new Map<string, Candle[] | Error>();
  for (let i = 0; i < chunks.length; i++) {
    const chunkResult = await fetchChunk(chunks[i], apiKey, outputsize);
    for (const [pair, value] of chunkResult) results.set(pair, value);
    onProgress?.({
      completedChunks: i + 1,
      totalChunks: chunks.length,
      pairsDone: results.size,
      totalPairs: pairs.length,
    });
    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
    }
  }
  return results;
}
