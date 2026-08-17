import { useMemo, useState, type CSSProperties } from "react";
import { addMonths, addYears, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import CalendarView from "../components/CalendarView";
import Dropdown from "../components/Dropdown";
import ItemCard from "../components/ItemCard";
import ItemEditor from "../components/ItemEditor";
import { itemKindMeta } from "../lib/itemKinds";
import { useCalendarItemsForDate, useCalendarItemsInRange } from "../hooks/useJournalData";
import { todayDateString } from "../lib/id";
import type { Item, ItemKind } from "../types";

type Mode = { type: "none" } | { type: "new-item"; kind: ItemKind } | { type: "edit-item"; item: Item };

// "day" = just the selected day (default — click any day in the grid to see
// it). The rest are always anchored on today, not the selected day, since
// they answer "what's coming up" rather than "what's on this one day".
type RangeMode = "day" | "current_week" | "current_month" | "3m" | "6m" | "1y";

const RANGE_OPTIONS: Array<{ value: RangeMode; label: string }> = [
  { value: "day", label: "Selected day" },
  { value: "current_week", label: "Current week" },
  { value: "current_month", label: "Current month" },
  { value: "3m", label: "Next 3 months" },
  { value: "6m", label: "Next 6 months" },
  { value: "1y", label: "Next year" },
];

function rangeBoundsFor(mode: RangeMode): { start: string; end: string } | null {
  if (mode === "day") return null;
  const today = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  if (mode === "current_week") {
    return { start: fmt(startOfWeek(today, { weekStartsOn: 1 })), end: fmt(endOfWeek(today, { weekStartsOn: 1 })) };
  }
  if (mode === "current_month") {
    return { start: fmt(startOfMonth(today)), end: fmt(endOfMonth(today)) };
  }
  const end = mode === "3m" ? addMonths(today, 3) : mode === "6m" ? addMonths(today, 6) : addYears(today, 1);
  return { start: fmt(today), end: fmt(end) };
}

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [rangeMode, setRangeMode] = useState<RangeMode>("day");
  const [mode, setMode] = useState<Mode>({ type: "none" });

  const rangeBounds = useMemo(() => rangeBoundsFor(rangeMode), [rangeMode]);
  const dayItems = useCalendarItemsForDate(selectedDate);
  const rangeItems = useCalendarItemsInRange(rangeBounds?.start ?? "9999-12-31", rangeBounds?.end ?? "0000-01-01");
  const scheduledItems = rangeMode === "day" ? dayItems : rangeItems;

  const closeMode = () => setMode({ type: "none" });

  return (
    <div className="page calendar-page">
      <h1 className="page-title">Calendar</h1>
      <div className="calendar-page-layout">
        <CalendarView
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setRangeMode("day");
            closeMode();
          }}
        />
        <div className="day-panel">
          <div className="day-panel-header">
            <h2>{rangeMode === "day" ? selectedDate : RANGE_OPTIONS.find((o) => o.value === rangeMode)?.label}</h2>
            <Dropdown value={rangeMode} onChange={(v) => setRangeMode(v as RangeMode)} options={RANGE_OPTIONS} />
          </div>
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

          {mode.type === "new-item" && (
            <ItemEditor kind={mode.kind} defaultDate={selectedDate} onCancel={closeMode} onSaved={closeMode} />
          )}

          {mode.type === "edit-item" && (
            <ItemEditor kind={mode.item.kind} item={mode.item} onCancel={closeMode} onSaved={closeMode} onDeleted={closeMode} />
          )}

          {mode.type === "none" && (
            <div className="entry-list">
              {scheduledItems.length === 0 && (
                <p className="empty-hint">{rangeMode === "day" ? "Nothing scheduled for this day." : "Nothing scheduled in this range."}</p>
              )}
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
