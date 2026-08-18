import { useEffect, useState } from "react";
import { useAllPairAnalyses } from "../hooks/useMarketsData";
import { getApiKey, getLastRefreshedAt, refreshAllCandles } from "../db/marketsRepo";
import { buildStatusSummary } from "../markets/analysis";
import { formatPair } from "../markets/pairs";
import type { RefreshProgress } from "../markets/api";
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

      <div className="markets-compact-table">
        {analyses.map((a) => {
          const summary = a.candles.length > 0 ? buildStatusSummary(a) : null;
          return (
            <button
              type="button"
              key={a.pair}
              className={`markets-compact-row ${selectedPair === a.pair ? "markets-compact-row-selected" : ""}`}
              onClick={() => setSelectedPair(a.pair === selectedPair ? null : a.pair)}
            >
              <span className="markets-compact-symbol">{formatPair(a.pair)}</span>
              <span className={`status-text ${summary ? `status-text-${summary.tone}` : "status-text-empty"}`}>
                {a.candles.length === 0 ? "No data" : (summary?.text ?? "—")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
