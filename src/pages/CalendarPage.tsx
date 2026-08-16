import { useState, type CSSProperties } from "react";
import CalendarView from "../components/CalendarView";
import ItemCard from "../components/ItemCard";
import ItemEditor from "../components/ItemEditor";
import { itemKindMeta } from "../lib/itemKinds";
import { useBookingsForDate } from "../hooks/useJournalData";
import { todayDateString } from "../lib/id";
import type { Item } from "../types";

type Mode = { type: "none" } | { type: "new-booking" } | { type: "edit-booking"; item: Item };

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [mode, setMode] = useState<Mode>({ type: "none" });

  const bookings = useBookingsForDate(selectedDate);

  const closeMode = () => setMode({ type: "none" });

  return (
    <div className="page calendar-page">
      <h1 className="page-title">Calendar</h1>
      <div className="calendar-page-layout">
        <CalendarView
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            setSelectedDate(date);
            closeMode();
          }}
        />
        <div className="day-panel">
          <div className="day-panel-header">
            <h2>{selectedDate}</h2>
            <div className="day-panel-actions">
              <button
                type="button"
                className="kind-action-btn"
                style={{ "--kind-color": itemKindMeta("event").color } as CSSProperties}
                onClick={() => setMode({ type: "new-booking" })}
              >
                + Booking
              </button>
            </div>
          </div>

          {mode.type === "new-booking" && (
            <ItemEditor kind="event" defaultDate={selectedDate} onCancel={closeMode} onSaved={closeMode} />
          )}

          {mode.type === "edit-booking" && (
            <ItemEditor kind="event" item={mode.item} onCancel={closeMode} onSaved={closeMode} onDeleted={closeMode} />
          )}

          {mode.type === "none" && (
            <div className="entry-list">
              {bookings.length === 0 && <p className="empty-hint">No bookings for this day.</p>}
              {bookings.map((item) => (
                <ItemCard key={item.id} item={item} onClick={() => setMode({ type: "edit-booking", item })} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
