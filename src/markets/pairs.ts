// The pair universe: all 8 "main" currencies, majors + full cross matrix.
// 8 currencies -> C(8,2) = 28 pairs. Base/quote order follows the standard
// FX convention (EUR > GBP > AUD > NZD > USD > CAD > CHF > JPY), not just
// alphabetical, so pairs read the way they trade (e.g. "GBPJPY" not "JPYGBP").

const CURRENCY_ORDER = ["EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF", "JPY"] as const;

export const PAIRS: string[] = CURRENCY_ORDER.flatMap((base, i) =>
  CURRENCY_ORDER.slice(i + 1).map((quote) => `${base}${quote}`),
);

export function isJpyPair(pair: string): boolean {
  return pair.endsWith("JPY");
}

// One pip = 0.01 for JPY-quoted pairs, 0.0001 for everything else.
export function pipSize(pair: string): number {
  return isJpyPair(pair) ? 0.01 : 0.0001;
}

export function toPips(pair: string, priceDelta: number): number {
  return priceDelta / pipSize(pair);
}

// Twelve Data's symbol format, e.g. "EUR/USD".
export function toTwelveDataSymbol(pair: string): string {
  return `${pair.slice(0, 3)}/${pair.slice(3)}`;
}

export function fromTwelveDataSymbol(symbol: string): string {
  return symbol.replace("/", "");
}

export function formatPair(pair: string): string {
  return `${pair.slice(0, 3)}/${pair.slice(3)}`;
}
