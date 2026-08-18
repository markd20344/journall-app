import { getISOWeek, getISOWeekYear } from "date-fns";
import type { DayResult } from "../../types/markets";

interface Props {
  history: DayResult[];
}

// Small Mon-Fri circle strip for the last ~4 weeks: filled red/green per
// day's close vs open, grouped with a gap between calendar weeks (by ISO
// week, so a holiday-shortened week doesn't misalign the grouping).
export default function DayStreak({ history }: Props) {
  const weeks: DayResult[][] = [];
  let lastWeekKey = "";
  for (const day of history) {
    const d = new Date(day.date + "T00:00:00");
    const weekKey = `${getISOWeekYear(d)}-${getISOWeek(d)}`;
    if (weekKey !== lastWeekKey) {
      weeks.push([]);
      lastWeekKey = weekKey;
    }
    weeks[weeks.length - 1].push(day);
  }

  return (
    <div className="day-streak">
      {weeks.map((week, i) => (
        <div className="day-streak-week" key={i}>
          {week.map((day) => (
            <span
              key={day.date}
              className={`day-circle day-circle-${day.color}`}
              title={`${day.date}: ${day.color}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
