import { useState } from "react";
import type { Item, ItemKind } from "../types";
import { itemKindMeta } from "../lib/itemKinds";
import { createItem, deleteItem, updateItem } from "../db/repo";
import { todayDateString } from "../lib/id";

interface Props {
  kind: ItemKind;
  item?: Item;
  sourceEntryId?: string | null;
  defaultDate?: string;
  onSaved?: (item: Item) => void;
  onCancel?: () => void;
  onDeleted?: () => void;
}

export default function ItemEditor({ kind, item, sourceEntryId, defaultDate, onSaved, onCancel, onDeleted }: Props) {
  const meta = itemKindMeta(kind);
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [date, setDate] = useState(item?.date ?? defaultDate ?? todayDateString());
  const [time, setTime] = useState(item?.time ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (item) {
        await updateItem(item.id, { title: title.trim(), body, date, time });
        onSaved?.({ ...item, title: title.trim(), body, date, time });
      } else {
        const created = await createItem({
          kind,
          title: title.trim(),
          body,
          date,
          time,
          sourceEntryId: sourceEntryId ?? null,
        });
        onSaved?.(created);
        setTitle("");
        setBody("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    if (!window.confirm(`Delete this ${meta.label.toLowerCase()}?`)) return;
    await deleteItem(item.id);
    onDeleted?.();
  }

  return (
    <div className="item-editor">
      <input
        type="text"
        className="item-title-input"
        placeholder={`${meta.label} title…`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <textarea
        className="item-body-input"
        placeholder="Details (optional)…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
      />
      <div className="item-editor-row">
        <label className="field">
          <span className="field-label">{meta.dateLabel}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {meta.hasTime && (
          <label className="field">
            <span className="field-label">Time</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        )}
      </div>
      <div className="entry-editor-actions">
        <button type="button" className="primary" disabled={saving || !title.trim()} onClick={() => void handleSave()}>
          {item ? "Save changes" : `Add ${meta.shortLabel.toLowerCase()}`}
        </button>
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        {item && (
          <button type="button" className="danger" onClick={() => void handleDelete()}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
