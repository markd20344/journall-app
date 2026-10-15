import DateRow from "../components/DateRow";
import { useUpcomingDates } from "../data/selectors";
import { monthName, parseYmd } from "../lib/dates";

// Every important date, in the order they next come round, grouped by month.
export default function DatesPage() {
  const all = useUpcomingDates(366);
  let lastMonth = "";
  return (
    <div className="page">
      <h1>Birthdays &amp; dates</h1>
      <p className="hint">Add dates from a person's page.</p>
      {all.length === 0 ? (
        <p className="empty">No dates yet. Open a person and tap “＋ Date”.</p>
      ) : (
        <div className="list">
          {all.map((u) => {
            const { year, month } = parseYmd(u.date);
            const key = `${year}-${month}`;
            const header = key !== lastMonth ? `${monthName(month)} ${year}` : null;
            lastMonth = key;
            return (
              <div key={u.item.id} style={{ display: "contents" }}>
                {header && <div className="row-letter">{header}</div>}
                <DateRow entry={u} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
