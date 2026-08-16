import { useState } from "react";
import type { Entry, Item, ItemKind } from "../types";
import { ITEM_KINDS } from "../lib/itemKinds";
import { useItemsForEntry } from "../hooks/useJournalData";
import { toggleItemDone } from "../db/repo";
import ItemEditor from "./ItemEditor";
import ItemKindBadge from "./ItemKindBadge";

interface Props {
  entry: Entry;
}

export default function SpinOffPanel({ entry }: Props) {
  const [activeKind, setActiveKind] = useState<ItemKind | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const linkedItems = useItemsForEntry(entry.id);

  return (
    <div className="spin-off-panel">
      <div className="spin-off-header">
        <span className="field-label">Spin off from this entry</span>
      </div>
      <div className="spin-off-buttons">
        {ITEM_KINDS.map((meta) => (
          <button
            key={meta.kind}
            type="button"
            className={`spin-off-btn ${activeKind === meta.kind ? "active" : ""}`}
            style={activeKind === meta.kind ? { background: meta.color, borderColor: meta.color, color: "#fff" } : undefined}
            onClick={() => {
              setEditingItem(null);
              setActiveKind(activeKind === meta.kind ? null : meta.kind);
            }}
          >
            + {meta.shortLabel}
          </button>
        ))}
      </div>

      {activeKind && !editingItem && (
        <ItemEditor
          kind={activeKind}
          sourceEntryId={entry.id}
          defaultDate={entry.date}
          onSaved={() => setActiveKind(null)}
          onCancel={() => setActiveKind(null)}
        />
      )}

      {editingItem && (
        <ItemEditor
          kind={editingItem.kind}
          item={editingItem}
          onSaved={() => setEditingItem(null)}
          onCancel={() => setEditingItem(null)}
          onDeleted={() => setEditingItem(null)}
        />
      )}

      {linkedItems.length > 0 && !editingItem && (
        <ul className="linked-items-list">
          {linkedItems.map((item) => (
            <li key={item.id} className="linked-item-row">
              {item.kind === "action" && (
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) => void toggleItemDone(item.id, e.target.checked)}
                />
              )}
              <button type="button" className="linked-item-title" onClick={() => setEditingItem(item)}>
                <ItemKindBadge kind={item.kind} short />
                <span className={item.done ? "done-text" : ""}>{item.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
