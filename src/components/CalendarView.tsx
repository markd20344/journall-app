import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { useBookingDatesInRange } from "../hooks/useJournalData";

interface Props {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarView({ selectedDate, onSelectDate }: Props) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selectedDate));

  const gridStart = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });

  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);

  const bookingDates = useBookingDatesInRange(format(gridStart, "yyyy-MM-dd"), format(gridEnd, "yyyy-MM-dd"));

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button type="button" className="ghost" onClick={() => setVisibleMonth((m) => subMonths(m, 1))}>
          ‹
        </button>
        <span className="calendar-month-label">{format(visibleMonth, "MMMM yyyy")}</span>
        <button type="button" className="ghost" onClick={() => setVisibleMonth((m) => addMonths(m, 1))}>
          ›
        </button>
      </div>
      <div className="calendar-weekdays">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const hasBooking = bookingDates.has(dateStr);
          const inMonth = isSameMonth(day, visibleMonth);
          const selected = isSameDay(day, new Date(selectedDate));
          return (
            <button
              type="button"
              key={dateStr}
              className={[
                "calendar-day",
                inMonth ? "" : "outside-month",
                selected ? "selected" : "",
                isToday(day) ? "today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectDate(dateStr)}
            >
              <span>{format(day, "d")}</span>
              {hasBooking && <span className="calendar-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
