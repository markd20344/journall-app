import { useEffect, useMemo, useState } from "react";
import { useAllPairAnalyses } from "../hooks/useMarketsData";
import { getApiKey, getLastRefreshedAt, refreshAllCandles } from "../db/marketsRepo";
import { formatPair } from "../markets/pairs";
import type { RefreshProgress } from "../markets/api";
import type { PairAnalysis } from "../types/markets";
import DayStreak from "../components/markets/DayStreak";
import SetupBadges from "../components/markets/SetupBadges";

function formatRefreshedAt(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleString();
}

export default function MarketsPage() {
  const analyses = useAllPairAnalyses();
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<RefreshProgress | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void getApiKey().then(setApiKeyState);
    void getLastRefreshedAt().then(setLastRefreshed);
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setStatus(null);
    setProgress(null);
    try {
      const result = await refreshAllCandles((p) => setProgress(p));
      setLastRefreshed(await getLastRefreshedAt());
      setStatus(
        result.failed.length === 0
          ? `Refreshed all ${result.succeeded.length} pairs.`
          : `Refreshed ${result.succeeded.length} pairs. Failed: ${result.failed.map((f) => f.pair).join(", ")}.`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
      setProgress(null);
    }
  }

  const hasAnyData = analyses.some((a) => a.candles.length > 0);

  const firstDaySetups = useMemo(
    () =>
      analyses
        .filter((a): a is PairAnalysis & { firstDay: NonNullable<PairAnalysis["firstDay"]> } => a.firstDay !== null)
        .sort((a, b) => b.firstDay.streakLen - a.firstDay.streakLen),
    [analyses],
  );

  return (
    <div className="page markets-page">
      <div className="markets-header">
        <h1 className="page-title">Markets</h1>
        <div className="markets-refresh-bar">
          <span className="settings-hint small">Last refreshed: {formatRefreshedAt(lastRefreshed)}</span>
          <button type="button" onClick={() => void handleRefresh()} disabled={refreshing || !apiKey}>
            {refreshing
              ? progress
                ? `Refreshing… (${progress.pairsDone}/${progress.totalPairs})`
                : "Refreshing…"
              : "Refresh data"}
          </button>
        </div>
      </div>

      {apiKey === "" && (
        <p className="settings-status">
          No Twelve Data API key set yet — add one under Settings → Market data to start pulling prices.
        </p>
      )}
      {status && <p className="settings-status">{status}</p>}

      {hasAnyData && (
        <section className="markets-summary">
          <h2>Setups today</h2>
          {firstDaySetups.length === 0 ? (
            <p className="settings-hint">No First Red/Green Day today across the tracked pairs.</p>
          ) : (
            <ul className="markets-summary-list">
              {firstDaySetups.map((a) => (
                <li key={a.pair}>
                  <span className={`setup-badge setup-badge-${a.firstDay.type === "FRD" ? "red" : "green"}`}>
                    {formatPair(a.pair)} — {a.firstDay.type}
                  </span>
                  <span className="settings-hint small">
                    broke a {a.firstDay.streakLen}-day streak
                    {a.firstDay.oppositeDayInPriorWeek ? " (choppy — opposite day in prior week)" : " (clean run)"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="markets-table-wrap">
        <table className="markets-table">
          <thead>
            <tr>
              <th>Pair</th>
              <th>Last 4 weeks</th>
              <th>Setups</th>
              <th>ADR (14d)</th>
              <th>Today's range</th>
              <th>TDI (RSI 13)</th>
            </tr>
          </thead>
          <tbody>
            {analyses.map((a) => (
              <tr key={a.pair} className={a.firstDay ? "markets-row-active" : ""}>
                <td className="markets-pair-cell">{formatPair(a.pair)}</td>
                <td>{a.candles.length > 0 ? <DayStreak history={a.history} /> : <span className="settings-hint small">No data</span>}</td>
                <td><SetupBadges analysis={a} /></td>
                <td>{a.adrPips !== null ? `${a.adrPips.toFixed(1)} pips` : "—"}</td>
                <td>{a.todayRangePips !== null ? `${a.todayRangePips.toFixed(1)} pips` : "—"}</td>
                <td>
                  {a.tdi ? (
                    <span className={`tdi-value tdi-${a.tdi.zone}`} title={`Price line ${a.tdi.priceLine.toFixed(1)} / Signal ${a.tdi.signalLine.toFixed(1)}`}>
                      {a.tdi.rsi.toFixed(0)}
                      {a.tdi.zone !== "neutral" ? ` (${a.tdi.zone})` : ""}
                    </span>
                  ) : (
                    <span className="settings-hint small">Needs more history</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
