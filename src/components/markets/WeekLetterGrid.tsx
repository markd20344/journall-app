import type { DayColor, WeekLetterRow } from "../../types/markets";

const DAY_HEADERS = ["M", "T", "W", "T", "F"];

function letterFor(color: DayColor | null): string {
  if (color === "green") return "G";
  if (color === "red") return "R";
  if (color === "flat") return "F";
  return "-";
}

export default function WeekLetterGrid({ rows }: { rows: WeekLetterRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="week-letter-grid">
      <div className="week-letter-row">
        <span className="week-letter-row-label" />
        {DAY_HEADERS.map((d, i) => (
          <span key={i} className="week-letter-cell week-letter-cell-header">
            {d}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div className="week-letter-row" key={row.label}>
          <span className="week-letter-row-label">{row.label}</span>
          {row.days.map((day, i) => (
            <span key={i} className={`week-letter-cell week-letter-cell-${day.color ?? "empty"}`}>
              {letterFor(day.color)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
