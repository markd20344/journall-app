import { useState } from "react";
import CalendarView from "../components/CalendarView";
import EntryCard from "../components/EntryCard";
import EntryEditor from "../components/EntryEditor";
import { useEnrichedEntries, useEntriesForDate } from "../hooks/useJournalData";
import { todayDateString } from "../lib/id";
import type { Entry } from "../types";

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [editingEntry, setEditingEntry] = useState<Entry | null | "new">(null);

  const entriesForDate = useEntriesForDate(selectedDate);
  const enriched = useEnrichedEntries(entriesForDate);

  return (
    <div className="page calendar-page">
      <h1 className="page-title">Calendar</h1>
      <div className="calendar-page-layout">
        <CalendarView
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setEditingEntry(null);
          }}
        />
        <div className="day-panel">
          <div className="day-panel-header">
            <h2>{selectedDate}</h2>
            <button type="button" className="primary" onClick={() => setEditingEntry("new")}>
              + New entry
            </button>
          </div>

          {editingEntry === "new" && (
            <EntryEditor
              initialDate={selectedDate}
              onCancel={() => setEditingEntry(null)}
              onSaved={() => setEditingEntry(null)}
            />
          )}

          {editingEntry && editingEntry !== "new" && (
            <EntryEditor
              entry={editingEntry}
              onCancel={() => setEditingEntry(null)}
              onSaved={() => setEditingEntry(null)}
              onDeleted={() => setEditingEntry(null)}
            />
          )}

          {!editingEntry && (
            <div className="entry-list">
              {enriched.length === 0 && <p className="empty-hint">No entries for this day yet.</p>}
              {enriched.map((entry) => (
                <EntryCard key={entry.id} entry={entry} onClick={() => setEditingEntry(entry)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
