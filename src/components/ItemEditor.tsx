import { useState } from "react";
import type { Item, ItemKind, ItemStatus } from "../types";
import { itemKindMeta, STATUS_META } from "../lib/itemKinds";
import { createItem, deleteItem, updateItem } from "../db/repo";
import { useAllItems } from "../hooks/useJournalData";
import { todayDateString } from "../lib/id";
import VoiceButton from "./VoiceButton";

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
  const [status, setStatus] = useState<ItemStatus | null>(item?.status ?? (meta.statuses[0] ?? null));
  const [dependsOnItemId, setDependsOnItemId] = useState<string>(item?.dependsOnItemId ?? "");
  const [saving, setSaving] = useState(false);

  const allItems = useAllItems();
  const dependencyOptions = meta.hasDependency ? allItems.filter((i) => i.id !== item?.id) : [];

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const dependsOnValue = meta.hasDependency && dependsOnItemId ? dependsOnItemId : null;
      if (item) {
        await updateItem(item.id, { title: title.trim(), body, date, time, status, dependsOnItemId: dependsOnValue });
        onSaved?.({ ...item, title: title.trim(), body, date, time, status, dependsOnItemId: dependsOnValue });
      } else {
        const created = await createItem({
          kind,
          title: title.trim(),
          body,
          date,
          time,
          dependsOnItemId: dependsOnValue,
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
      {item && (
        <div className="item-editor-code-row">
          <span className="code-badge">{item.code}</span>
        </div>
      )}
      <input
        type="text"
        className="item-title-input"
        placeholder={`${meta.label} title…`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <div className="field-voice-row">
        <VoiceButton onTranscript={(text) => setTitle((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))} />
      </div>
      <textarea
        className="item-body-input"
        placeholder="Details (optional)…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
      />
      <div className="field-voice-row">
        <VoiceButton onTranscript={(text) => setBody((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))} />
      </div>
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
        {meta.statuses.length > 0 && (
          <label className="field">
            <span className="field-label">Status</span>
            <select value={status ?? ""} onChange={(e) => setStatus(e.target.value as ItemStatus)}>
              {meta.statuses.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {meta.hasDependency && (
        <label className="field">
          <span className="field-label">Depends on / blocked by</span>
          <select value={dependsOnItemId} onChange={(e) => setDependsOnItemId(e.target.value)}>
            <option value="">None</option>
            {dependencyOptions.map((dep) => (
              <option key={dep.id} value={dep.id}>
                {dep.code} — {dep.title}
              </option>
            ))}
          </select>
        </label>
      )}

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
