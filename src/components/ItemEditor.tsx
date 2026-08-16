import { useState } from "react";
import { format } from "date-fns";
import type { Item, ItemKind, ItemStatus, StatusUpdate } from "../types";
import { itemKindMeta, STATUS_META } from "../lib/itemKinds";
import {
  addStatusUpdate,
  createItem,
  deleteItem,
  deleteStatusUpdate,
  linkItems,
  unlinkItems,
  updateItem,
} from "../db/repo";
import { useAllItems } from "../hooks/useJournalData";
import { newId, nowIso, todayDateString } from "../lib/id";
import { appendDictatedPhrase, appendDictatedSentence } from "../lib/dictation";
import VoiceButton from "./VoiceButton";
import ItemKindBadge from "./ItemKindBadge";

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
  const [closureNote, setClosureNote] = useState(item?.closureNote ?? "");
  const [linkedIds, setLinkedIds] = useState<string[]>(item?.linkedItemIds ?? []);
  const [linkPick, setLinkPick] = useState("");
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>(item?.statusUpdates ?? []);
  const [newUpdateNote, setNewUpdateNote] = useState("");
  const [saving, setSaving] = useState(false);

  const allItems = useAllItems();
  const linkedItems = linkedIds.map((id) => allItems.find((i) => i.id === id)).filter((i): i is Item => Boolean(i));
  const linkCandidates = item ? allItems.filter((i) => i.id !== item.id && !linkedIds.includes(i.id)) : [];

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (item) {
        await updateItem(item.id, { title: title.trim(), body, date, time, status, closureNote });
        onSaved?.({ ...item, title: title.trim(), body, date, time, status, closureNote });
      } else {
        const created = await createItem({ kind, title: title.trim(), body, date, time, sourceEntryId: sourceEntryId ?? null });
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

  async function addLink() {
    if (!item || !linkPick) return;
    const targetId = linkPick;
    setLinkPick("");
    setLinkedIds((prev) => [...prev, targetId]);
    await linkItems(item.id, targetId);
  }

  async function removeLink(otherId: string) {
    if (!item) return;
    setLinkedIds((prev) => prev.filter((id) => id !== otherId));
    await unlinkItems(item.id, otherId);
  }

  async function addUpdate() {
    if (!item || !newUpdateNote.trim()) return;
    const note = newUpdateNote.trim();
    setNewUpdateNote("");
    await addStatusUpdate(item.id, note);
    setStatusUpdates((prev) => [...prev, { id: newId(), note, createdAt: nowIso() }]);
  }

  async function removeUpdate(updateId: string) {
    if (!item) return;
    setStatusUpdates((prev) => prev.filter((u) => u.id !== updateId));
    await deleteStatusUpdate(item.id, updateId);
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
        <VoiceButton onTranscript={(text) => setTitle((prev) => appendDictatedPhrase(prev, text))} />
      </div>
      <div className="field">
        <span className="field-label">Entry</span>
        <textarea
          className="entry-body"
          placeholder="Details…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
        />
        <div className="field-voice-row">
          <VoiceButton onTranscript={(text) => setBody((prev) => appendDictatedSentence(prev, text))} />
        </div>
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
      {item && <p className="entry-timestamp">Logged {format(new Date(item.createdAt), "MMM d, yyyy · h:mm a")}</p>}

      {status === "closed" && (
        <label className="field">
          <span className="field-label">
            Closure note {item?.closedAt && <span className="closed-at">— closed {format(new Date(item.closedAt), "MMM d, h:mm a")}</span>}
          </span>
          <textarea
            className="closure-note-input"
            placeholder="What was the outcome / how was this resolved…"
            value={closureNote}
            onChange={(e) => setClosureNote(e.target.value)}
            rows={4}
          />
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

      {item && meta.statuses.length > 0 && (
        <div className="link-section">
          <span className="field-label">Status updates</span>
          {statusUpdates.length > 0 && (
            <ul className="status-update-list">
              {[...statusUpdates]
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .map((u) => (
                  <li key={u.id} className="status-update-row">
                    <span className="status-update-time">{format(new Date(u.createdAt), "MMM d, h:mm a")}</span>
                    <span className="status-update-note">{u.note}</span>
                    <button type="button" className="chip-remove" aria-label="Delete update" onClick={() => void removeUpdate(u.id)}>
                      ×
                    </button>
                  </li>
                ))}
            </ul>
          )}
          <div className="field">
            <span className="field-label">Entry</span>
            <textarea
              className="entry-body"
              placeholder="Add a dated status update…"
              value={newUpdateNote}
              onChange={(e) => setNewUpdateNote(e.target.value)}
              rows={10}
            />
            <div className="add-update-row">
              <button type="button" className="primary" disabled={!newUpdateNote.trim()} onClick={() => void addUpdate()}>
                Add update
              </button>
            </div>
          </div>
        </div>
      )}

      {item ? (
        <div className="link-section">
          <span className="field-label">Linked items</span>
          {linkedItems.length > 0 && (
            <div className="topic-chips linked-item-chips">
              {linkedItems.map((li) => (
                <span className="chip" key={li.id}>
                  <ItemKindBadge kind={li.kind} short />
                  {li.code} — {li.title}
                  <button
                    type="button"
                    className="chip-remove"
                    aria-label={`Unlink ${li.title}`}
                    onClick={() => void removeLink(li.id)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="add-link-row">
            <select value={linkPick} onChange={(e) => setLinkPick(e.target.value)}>
              <option value="">Link to another item…</option>
              {linkCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
            <button type="button" disabled={!linkPick} onClick={() => void addLink()}>
              Add link
            </button>
          </div>
        </div>
      ) : (
        <p className="settings-hint small">Save this {meta.label.toLowerCase()} first to link it to other items.</p>
      )}
    </div>
  );
}
