import type { PairAnalysis, RangeStatus } from "../../types/markets";
import { formatPair } from "../../markets/pairs";
import DayStreak from "./DayStreak";
import WeekLetterGrid from "./WeekLetterGrid";

const RANGE_LABEL: Record<RangeStatus, string> = {
  within: "Within",
  "broke-high": "Broke High",
  "broke-low": "Broke Low",
};

export default function KeyLevelsPanel({ analysis, onClose }: { analysis: PairAnalysis; onClose: () => void }) {
  const kl = analysis.keyLevels;

  return (
    <section className="key-levels-panel">
      <div className="key-levels-header">
        <h2>{formatPair(analysis.pair)}</h2>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <WeekLetterGrid rows={analysis.weekGrid} />

      {kl ? (
        <table className="key-levels-table">
          <tbody>
            <tr>
              <th>Day</th>
              <td>{kl.dayLabel ?? "—"}</td>
            </tr>
            <tr className="key-levels-tone-green">
              <th>Day Color</th>
              <td>{kl.dayColorSummary ?? "—"}</td>
            </tr>
            <tr className="key-levels-tone-red">
              <th>Inside Day</th>
              <td>{kl.insideDay ? "Yes" : "No"}</td>
            </tr>
            <tr className="key-levels-tone-blue">
              <th>PDH</th>
              <td>{kl.pdhBroken ? "Broken" : "Unbroken"}</td>
            </tr>
            <tr className="key-levels-tone-blue">
              <th>PDL</th>
              <td>{kl.pdlBroken ? "Broken" : "Unbroken"}</td>
            </tr>
            <tr className="key-levels-tone-green">
              <th>Prev Day</th>
              <td>{kl.prevDaySummary ?? "—"}</td>
            </tr>
            <tr className="key-levels-tone-amber">
              <th>Mon Range</th>
              <td>{kl.mondayRange ? RANGE_LABEL[kl.mondayRange] : "—"}</td>
            </tr>
            <tr className="key-levels-tone-amber">
              <th>PW Range</th>
              <td>{kl.priorWeekRange ? RANGE_LABEL[kl.priorWeekRange] : "—"}</td>
            </tr>
            <tr>
              <th>ADR</th>
              <td>{kl.adrPips !== null ? `${kl.adrPips.toFixed(0)}p` : "—"}</td>
            </tr>
            <tr>
              <th>ADR Used</th>
              <td>{kl.adrUsedPct !== null ? `${kl.adrUsedPct.toFixed(0)}%` : "—"}</td>
            </tr>
            <tr>
              <th>AWR</th>
              <td>{kl.awrPips !== null ? `${kl.awrPips.toFixed(0)}p` : "—"}</td>
            </tr>
            <tr>
              <th>AMR</th>
              <td>{kl.amrPips !== null ? `${kl.amrPips.toFixed(0)}p` : "—"}</td>
            </tr>
            <tr>
              <th>TDI Level</th>
              <td>{kl.tdiLevel !== null ? kl.tdiLevel.toFixed(1) : "—"}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="settings-hint">Not enough history yet for this pair.</p>
      )}

      <div className="key-levels-history">
        <p className="settings-hint small">Last 3 weeks</p>
        <DayStreak history={analysis.history} />
      </div>
    </section>
  );
}
