import type { Item } from "../types";
import { itemKindMeta } from "../lib/itemKinds";
import { toggleItemDone } from "../db/repo";
import ItemKindBadge from "./ItemKindBadge";

interface Props {
  item: Item;
  onClick?: () => void;
}

export default function ItemCard({ item, onClick }: Props) {
  const meta = itemKindMeta(item.kind);
  return (
    <div className={`item-card ${item.done ? "item-done" : ""}`}>
      {meta.hasDone && (
        <input
          type="checkbox"
          className="item-card-checkbox"
          checked={item.done}
          onChange={(e) => void toggleItemDone(item.id, e.target.checked)}
          aria-label={`Mark "${item.title}" done`}
        />
      )}
      <button type="button" className="item-card-main" onClick={onClick}>
        <div className="item-card-meta">
          <ItemKindBadge kind={item.kind} short />
          <span className="entry-card-date">
            {item.date}
            {item.time ? ` · ${item.time}` : ""}
          </span>
          {item.sourceEntryId && <span className="linked-badge">from journal</span>}
        </div>
        <p className="entry-card-body item-card-title">{item.title}</p>
        {item.body && <p className="entry-card-body">{item.body}</p>}
      </button>
    </div>
  );
}
