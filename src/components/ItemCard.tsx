import { differenceInCalendarDays, format } from "date-fns";
import type { CSSProperties } from "react";
import type { Item, ItemStatus } from "../types";
import { itemKindMeta, PRIORITY_META, STATUS_META } from "../lib/itemKinds";
import { setItemStatus } from "../db/repo";
import { useAllItems } from "../hooks/useJournalData";
import ItemKindBadge from "./ItemKindBadge";

interface Props {
  item: Item;
  onClick?: () => void;
}

export default function ItemCard({ item, onClick }: Props) {
  const meta = itemKindMeta(item.kind);
  const allItems = useAllItems();
  const linkedItems = item.linkedItemIds
    .map((id) => allItems.find((i) => i.id === id))
    .filter((i): i is Item => Boolean(i));
  const latestUpdate = item.statusUpdates.length > 0 ? item.statusUpdates[item.statusUpdates.length - 1] : null;

  // Days open (since logged) and how far before/after the due date we are —
  // measured against the closure time once closed, otherwise today.
  let agingLabel: string | null = null;
  if (meta.statuses.length > 0) {
    const reference = item.closedAt ? new Date(item.closedAt) : new Date();
    const daysOpen = differenceInCalendarDays(reference, new Date(item.createdAt));
    const dueDelta = differenceInCalendarDays(reference, new Date(item.date));
    const dueSign = dueDelta >= 0 ? "+" : "";
    agingLabel = `${daysOpen}d open · ${dueSign}${dueDelta}d due`;
  }

  return (
    <div className={`item-card ${item.status === "closed" ? "item-done" : ""}`}>
      <button type="button" className="item-card-main" onClick={onClick}>
        <div className="item-card-meta">
          <span className="code-badge">{item.code}</span>
          <ItemKindBadge kind={item.kind} short />
          <span className="entry-card-date">
            {item.date}
            {item.time ? ` · ${item.time}` : ""}
          </span>
          {item.sourceEntryId && <span className="linked-badge">from journal</span>}
          {agingLabel && <span className="linked-badge">{agingLabel}</span>}
          {item.project && <span className="project-badge">{item.project}</span>}
          {item.priority && (
            <span className="rag-badge" style={{ "--rag-color": PRIORITY_META[item.priority].color } as CSSProperties}>
              {PRIORITY_META[item.priority].label}
            </span>
          )}
          {item.probability && (
            <span className="rag-badge" style={{ "--rag-color": PRIORITY_META[item.probability].color } as CSSProperties}>
              Probability: {PRIORITY_META[item.probability].label}
            </span>
          )}
          {item.impact && (
            <span className="rag-badge" style={{ "--rag-color": PRIORITY_META[item.impact].color } as CSSProperties}>
              Impact: {PRIORITY_META[item.impact].label}
            </span>
          )}
        </div>
        <p className="entry-card-body item-card-title">{item.title}</p>
        {linkedItems.length > 0 && (
          <p className="dependency-line">
            🔗 Linked: {linkedItems.map((li) => `${li.code} — ${li.title}`).join(", ")}
          </p>
        )}
        {latestUpdate && (
          <p className="dependency-line">
            🕐 {format(new Date(latestUpdate.createdAt), "MMM d, h:mm a")} — {latestUpdate.note}
          </p>
        )}
        {item.status === "closed" && item.closedAt && (
          <p className="dependency-line">
            ✔ Closed {format(new Date(item.closedAt), "MMM d, h:mm a")}
            {item.closureNote ? ` — ${item.closureNote}` : ""}
          </p>
        )}
      </button>
      {meta.statuses.length > 0 && item.status && (
        <select
          className="status-select"
          style={{ color: STATUS_META[item.status].color, borderColor: STATUS_META[item.status].color }}
          value={item.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => void setItemStatus(item.id, e.target.value as ItemStatus)}
        >
          {meta.statuses.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
