import { differenceInCalendarDays, format } from "date-fns";
import type { CSSProperties } from "react";
import type { Item, ItemStatus } from "../types";
import { itemKindMeta, PRIORITY_META, statusLabelFor, STATUS_META } from "../lib/itemKinds";
import { setItemStatus } from "../db/repo";
import { useAllItems, useCategories } from "../hooks/useJournalData";
import ItemKindBadge from "./ItemKindBadge";
import Dropdown from "./Dropdown";

interface Props {
  item: Item;
  onClick?: () => void;
}

export default function ItemCard({ item, onClick }: Props) {
  const meta = itemKindMeta(item.kind);
  const allItems = useAllItems();
  const categories = useCategories();
  const category = item.categoryId ? categories.find((c) => c.id === item.categoryId) : undefined;
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
          {category && (
            <span className="category-pill" style={{ background: category.color }}>
              {category.name}
            </span>
          )}
          {item.sourceEntryId && <span className="linked-badge">from journal</span>}
          {agingLabel && <span className="linked-badge">{agingLabel}</span>}
          {item.project && <span className="project-badge">{item.project}</span>}
          {item.agency && <span className="linked-badge">Agency: {item.agency}</span>}
          {item.source && <span className="linked-badge">via {item.source}</span>}
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
        <Dropdown
          className="status-select"
          triggerStyle={{ color: STATUS_META[item.status].color, borderColor: STATUS_META[item.status].color }}
          value={item.status}
          onChange={(v) => void setItemStatus(item.id, v as ItemStatus)}
          options={meta.statuses.map((s) => ({ value: s, label: statusLabelFor(item.kind, s) }))}
        />
      )}
    </div>
  );
}
