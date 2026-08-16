import { useState } from "react";
import CalendarView from "../components/CalendarView";
import EntryCard from "../components/EntryCard";
import EntryEditor from "../components/EntryEditor";
import ItemCard from "../components/ItemCard";
import ItemEditor from "../components/ItemEditor";
import { useEnrichedEntries, useEntriesForDate, useScheduledItemsForDate } from "../hooks/useJournalData";
import { todayDateString } from "../lib/id";
import type { Entry, Item, ItemKind } from "../types";

type Mode =
  | { type: "none" }
  | { type: "new-entry" }
  | { type: "edit-entry"; entry: Entry }
  | { type: "new-item"; kind: ItemKind }
  | { type: "edit-item"; item: Item };

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [mode, setMode] = useState<Mode>({ type: "none" });

  const entriesForDate = useEntriesForDate(selectedDate);
  const enriched = useEnrichedEntries(entriesForDate);
  const scheduledItems = useScheduledItemsForDate(selectedDate);

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
              <button type="button" className="ghost" onClick={() => setMode({ type: "new-item", kind: "event" })}>
                + Booking
              </button>
              <button type="button" className="ghost" onClick={() => setMode({ type: "new-item", kind: "action" })}>
                + Action
              </button>
              <button type="button" className="primary" onClick={() => setMode({ type: "new-entry" })}>
                + New entry
              </button>
            </div>
          </div>

          {mode.type === "new-entry" && (
            <EntryEditor initialDate={selectedDate} onCancel={closeMode} onSaved={closeMode} />
          )}

          {mode.type === "edit-entry" && (
            <EntryEditor entry={mode.entry} onCancel={closeMode} onSaved={closeMode} onDeleted={closeMode} />
          )}

          {mode.type === "new-item" && (
            <ItemEditor kind={mode.kind} defaultDate={selectedDate} onCancel={closeMode} onSaved={closeMode} />
          )}

          {mode.type === "edit-item" && (
            <ItemEditor kind={mode.item.kind} item={mode.item} onCancel={closeMode} onSaved={closeMode} onDeleted={closeMode} />
          )}

          {mode.type === "none" && (
            <>
              {scheduledItems.length > 0 && (
                <div className="day-scheduled-section">
                  <h3 className="day-section-title">Scheduled</h3>
                  <div className="entry-list">
                    {scheduledItems.map((item) => (
                      <ItemCard key={item.id} item={item} onClick={() => setMode({ type: "edit-item", item })} />
                    ))}
                  </div>
                </div>
              )}

              <h3 className="day-section-title">Journal entries</h3>
              <div className="entry-list">
                {enriched.length === 0 && <p className="empty-hint">No entries for this day yet.</p>}
                {enriched.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} onClick={() => setMode({ type: "edit-entry", entry })} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
