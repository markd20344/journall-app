import type { Item, ItemStatus } from "../types";
import { itemKindMeta, STATUS_META } from "../lib/itemKinds";
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
  const dependency = item.dependsOnItemId ? allItems.find((i) => i.id === item.dependsOnItemId) : undefined;

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
        </div>
        <p className="entry-card-body item-card-title">{item.title}</p>
        {item.body && <p className="entry-card-body">{item.body}</p>}
        {dependency && (
          <p className="dependency-line">
            ⛓ Depends on {dependency.code} — {dependency.title}
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
