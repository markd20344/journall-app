import { useEffect, useState } from "react";
import { useAllPairAnalyses } from "../hooks/useMarketsData";
import { getApiKey, getLastRefreshedAt, refreshAllCandles } from "../db/marketsRepo";
import { buildStatusSummary } from "../markets/analysis";
import { formatPair } from "../markets/pairs";
import type { RefreshProgress } from "../markets/api";
import DayStreak from "../components/markets/DayStreak";
import KeyLevelsPanel from "../components/markets/KeyLevelsPanel";

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
  const [selectedPair, setSelectedPair] = useState<string | null>(null);

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

  const selected = selectedPair ? analyses.find((a) => a.pair === selectedPair) : undefined;

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

      {selected && <KeyLevelsPanel analysis={selected} onClose={() => setSelectedPair(null)} />}

      <div className="markets-table-wrap">
        <table className="markets-table">
          <thead>
            <tr>
              <th>Pair</th>
              <th>Last 3 weeks</th>
              <th>Status</th>
              <th>ADR (14d) / Today</th>
              <th>TDI (RSI 13)</th>
            </tr>
          </thead>
          <tbody>
            {analyses.map((a) => {
              const summary = a.candles.length > 0 ? buildStatusSummary(a) : null;
              return (
                <tr
                  key={a.pair}
                  className={selectedPair === a.pair ? "markets-row-selected" : ""}
                  onClick={() => setSelectedPair(a.pair === selectedPair ? null : a.pair)}
                >
                  <td className="markets-pair-cell">{formatPair(a.pair)}</td>
                  <td>
                    {a.candles.length > 0 ? (
                      <DayStreak history={a.history} />
                    ) : (
                      <span className="settings-hint small">No data</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-text ${summary ? `status-text-${summary.tone}` : "status-text-empty"}`}>
                      {a.candles.length === 0 ? "—" : (summary?.text ?? "—")}
                    </span>
                  </td>
                  <td>
                    <div>{a.adrPips !== null ? `${a.adrPips.toFixed(1)} pips` : "—"}</div>
                    <div className="settings-hint small">
                      {a.todayRangePips !== null ? `Today: ${a.todayRangePips.toFixed(1)} pips` : ""}
                    </div>
                  </td>
                  <td title={a.tdi ? `Price line ${a.tdi.priceLine.toFixed(1)} / Signal ${a.tdi.signalLine.toFixed(1)}` : undefined}>
                    {a.tdi ? (
                      <>
                        <div className={`tdi-value tdi-${a.tdi.zone}`}>{a.tdi.rsi.toFixed(0)}</div>
                        {a.tdi.zone !== "neutral" && <div className={`settings-hint small tdi-${a.tdi.zone}`}>{a.tdi.zone}</div>}
                      </>
                    ) : (
                      <span className="settings-hint small">Needs more history</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
