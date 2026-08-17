import { useState, type CSSProperties } from "react";
import CalendarView from "../components/CalendarView";
import ItemCard from "../components/ItemCard";
import ItemEditor from "../components/ItemEditor";
import { itemKindMeta } from "../lib/itemKinds";
import { useCalendarItemsForDate } from "../hooks/useJournalData";
import { todayDateString } from "../lib/id";
import type { Item, ItemKind } from "../types";

type Mode = { type: "none" } | { type: "new-item"; kind: ItemKind } | { type: "edit-item"; item: Item };

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [mode, setMode] = useState<Mode>({ type: "none" });

  const scheduledItems = useCalendarItemsForDate(selectedDate);

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
                style={{ "--kind-color": itemKindMeta("action").color } as CSSProperties}
                onClick={() => setMode({ type: "new-item", kind: "action" })}
              >
                + Action
              </button>
              <button
                type="button"
                className="kind-action-btn"
                style={{ "--kind-color": itemKindMeta("event").color } as CSSProperties}
                onClick={() => setMode({ type: "new-item", kind: "event" })}
              >
                + Booking
              </button>
              <button
                type="button"
                className="kind-action-btn"
                style={{ "--kind-color": itemKindMeta("diary").color } as CSSProperties}
                onClick={() => setMode({ type: "new-item", kind: "diary" })}
              >
                + Diary Entry
              </button>
            </div>
          </div>

          {mode.type === "new-item" && (
            <ItemEditor kind={mode.kind} defaultDate={selectedDate} onCancel={closeMode} onSaved={closeMode} />
          )}

          {mode.type === "edit-item" && (
            <ItemEditor kind={mode.item.kind} item={mode.item} onCancel={closeMode} onSaved={closeMode} onDeleted={closeMode} />
          )}

          {mode.type === "none" && (
            <div className="entry-list">
              {scheduledItems.length === 0 && <p className="empty-hint">Nothing scheduled for this day.</p>}
              {scheduledItems.map((item) => (
                <ItemCard key={item.id} item={item} onClick={() => setMode({ type: "edit-item", item })} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
