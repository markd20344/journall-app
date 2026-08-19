import { useEffect, useState, type CSSProperties } from "react";
import { format } from "date-fns";
import type { Item, ItemKind, ItemStatus, Priority, StatusUpdate, Subtask } from "../types";
import { ITEM_KINDS, itemKindMeta, PRIORITY_META, PRIORITY_ORDER, statusLabelFor } from "../lib/itemKinds";
import {
  addStatusUpdate,
  addSubtask,
  createItem,
  deleteItem,
  deleteStatusUpdate,
  deleteSubtask,
  linkItems,
  toggleSubtask,
  unlinkItems,
  updateItem,
} from "../db/repo";
import { useAllItems, useCategories } from "../hooks/useJournalData";
import { todayDateString } from "../lib/id";
import { appendDictatedPhrase, appendDictatedSentence, ensureSentenceEnd } from "../lib/dictation";
import { useDictation } from "../hooks/useDictation";
import { showToast } from "../lib/toast";
import { schedulePendingDelete, cancelPendingDelete } from "../lib/pendingDelete";
import CategorySelect from "./CategorySelect";
import VoiceButton from "./VoiceButton";
import ItemKindBadge from "./ItemKindBadge";
import Dropdown from "./Dropdown";

function PriorityPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Priority | null;
  onChange: (value: Priority | null) => void;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="priority-picker">
        {PRIORITY_ORDER.map((p) => (
          <button
            key={p}
            type="button"
            className={`priority-btn ${value === p ? "active" : ""}`}
            style={{ "--priority-color": PRIORITY_META[p].color } as CSSProperties}
            onClick={() => onChange(value === p ? null : p)}
          >
            {PRIORITY_META[p].label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface Props {
  kind: ItemKind;
  item?: Item;
  sourceEntryId?: string | null;
  defaultDate?: string;
  // Pre-fills a new task's title/category — used by other domain pages
  // (e.g. the Books editor's "+ Add a task for this book") so a quick,
  // pre-scoped task doesn't need retyping or re-picking on top of what's
  // already known from context. No-ops once `item` (editing) is set.
  defaultTitle?: string;
  defaultCategoryId?: string;
  onSaved?: (item: Item) => void;
  onCancel?: () => void;
  onDeleted?: () => void;
}

export default function ItemEditor({
  kind,
  item,
  sourceEntryId,
  defaultDate,
  defaultTitle,
  defaultCategoryId,
  onSaved,
  onCancel,
  onDeleted,
}: Props) {
  const meta = itemKindMeta(kind);
  const [title, setTitle] = useState(item?.title ?? defaultTitle ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const { onTranscript: onTitleTranscript, endSession: endTitleDictation } = useDictation(setTitle, appendDictatedPhrase);
  const { onTranscript: onBodyTranscript, endSession: endBodyDictation } = useDictation(
    setBody,
    appendDictatedSentence,
    ensureSentenceEnd,
  );
  const [date, setDate] = useState(item?.date ?? defaultDate ?? todayDateString());
  const [time, setTime] = useState(item?.time ?? "");
  const [status, setStatus] = useState<ItemStatus | null>(item?.status ?? (meta.statuses[0] ?? null));
  const [closureNote, setClosureNote] = useState(item?.closureNote ?? "");
  const [linkedIds, setLinkedIds] = useState<string[]>(item?.linkedItemIds ?? []);
  const [linkPick, setLinkPick] = useState("");
  const [spinOffKind, setSpinOffKind] = useState<ItemKind | null>(null);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>(item?.statusUpdates ?? []);
  const [newUpdateNote, setNewUpdateNote] = useState("");
  const [subtasks, setSubtasks] = useState<Subtask[]>(item?.subtasks ?? []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [priority, setPriority] = useState<Priority | null>(item?.priority ?? null);
  const [probability, setProbability] = useState<Priority | null>(item?.probability ?? null);
  const [impact, setImpact] = useState<Priority | null>(item?.impact ?? null);
  const [project, setProject] = useState(item?.project ?? "");
  const [agency, setAgency] = useState(item?.agency ?? "");
  const [source, setSource] = useState(item?.source ?? "");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? defaultCategoryId ?? "");
  const [saving, setSaving] = useState(false);

  const categories = useCategories();

  // Default to the first available category once categories load, same as
  // the journal entry editor — only for kinds that actually use one.
  useEffect(() => {
    if (meta.hasCategory && !categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [meta.hasCategory, categories, categoryId]);

  const allItems = useAllItems();
  const linkedItems = linkedIds.map((id) => allItems.find((i) => i.id === id)).filter((i): i is Item => Boolean(i));
  // Closed items are rarely what you meant to link to, and the list only
  // grows — excluding them keeps it useful instead of an ever-lengthening
  // scroll of finished work. (Kinds with no lifecycle, e.g. Diary, have a
  // null status and are never "closed", so they stay included.)
  const linkCandidates = item
    ? allItems.filter((i) => i.id !== item.id && !linkedIds.includes(i.id) && i.status !== "closed")
    : [];
  const knownProjects = Array.from(
    new Set(allItems.filter((i) => i.kind === "story" && i.project).map((i) => i.project as string)),
  ).sort((a, b) => a.localeCompare(b));
  const knownSources = Array.from(
    new Set(
      [
        "LinkedIn",
        "Indeed",
        "Company website",
        "Recruiter / Agency",
        "Referral",
        ...allItems.filter((i) => i.kind === "application" && i.source).map((i) => i.source as string),
      ],
    ),
  ).sort((a, b) => a.localeCompare(b));

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const trimmedProject = meta.hasProject ? project.trim() || null : null;
      const trimmedAgency = meta.hasApplicationFields ? agency.trim() || null : null;
      const trimmedSource = meta.hasApplicationFields ? source.trim() || null : null;
      const finalCategoryId = meta.hasCategory ? categoryId || null : null;
      if (item) {
        await updateItem(item.id, {
          title: title.trim(),
          body,
          date,
          time,
          status,
          closureNote,
          priority: meta.hasPriority ? priority : null,
          probability: meta.hasProbabilityImpact ? probability : null,
          impact: meta.hasProbabilityImpact ? impact : null,
          project: trimmedProject,
          agency: trimmedAgency,
          source: trimmedSource,
          categoryId: finalCategoryId,
        });
        showToast(`${meta.label} saved`);
        onSaved?.({
          ...item,
          title: title.trim(),
          body,
          date,
          time,
          status,
          closureNote,
          priority: meta.hasPriority ? priority : null,
          probability: meta.hasProbabilityImpact ? probability : null,
          impact: meta.hasProbabilityImpact ? impact : null,
          project: trimmedProject,
          agency: trimmedAgency,
          source: trimmedSource,
          categoryId: finalCategoryId,
        });
      } else {
        const created = await createItem({
          kind,
          title: title.trim(),
          body,
          date,
          time,
          sourceEntryId: sourceEntryId ?? null,
          status,
          priority: meta.hasPriority ? priority : null,
          probability: meta.hasProbabilityImpact ? probability : null,
          impact: meta.hasProbabilityImpact ? impact : null,
          project: trimmedProject,
          agency: trimmedAgency,
          source: trimmedSource,
          categoryId: finalCategoryId,
        });
        showToast(`${meta.label} saved`);
        onSaved?.(created);
        setTitle("");
        setBody("");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!item) return;
    const id = item.id;
    const title = item.title;
    schedulePendingDelete("item", id, () => deleteItem(id));
    showToast(`Deleted "${title}"`, {
      action: { label: "Undo", onClick: () => cancelPendingDelete("item", id) },
      durationMs: 5000,
    });
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

  async function handleSpinOffSaved(newItem: Item) {
    if (!item) return;
    await linkItems(item.id, newItem.id);
    setLinkedIds((prev) => [...prev, newItem.id]);
    setSpinOffKind(null);
  }

  async function addUpdate() {
    if (!item || !newUpdateNote.trim()) return;
    const note = newUpdateNote.trim();
    setNewUpdateNote("");
    const created = await addStatusUpdate(item.id, note);
    if (created) setStatusUpdates((prev) => [...prev, created]);
  }

  async function removeUpdate(updateId: string) {
    if (!item) return;
    setStatusUpdates((prev) => prev.filter((u) => u.id !== updateId));
    await deleteStatusUpdate(item.id, updateId);
  }

  async function addSubtaskRow() {
    if (!item || !newSubtaskTitle.trim()) return;
    const title = newSubtaskTitle.trim();
    setNewSubtaskTitle("");
    const created = await addSubtask(item.id, title);
    if (created) setSubtasks((prev) => [...prev, created]);
  }

  async function toggleSubtaskRow(subtaskId: string, done: boolean) {
    if (!item) return;
    setSubtasks((prev) => prev.map((s) => (s.id === subtaskId ? { ...s, done } : s)));
    await toggleSubtask(item.id, subtaskId, done);
  }

  async function removeSubtask(subtaskId: string) {
    if (!item) return;
    setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    await deleteSubtask(item.id, subtaskId);
  }

  const subtaskDoneCount = subtasks.filter((s) => s.done).length;
  const subtaskPercent = subtasks.length > 0 ? Math.round((subtaskDoneCount / subtasks.length) * 100) : 0;

  async function copyBody() {
    if (!body.trim()) return;
    try {
      await navigator.clipboard.writeText(body);
      showToast("Copied to clipboard");
    } catch {
      showToast("Couldn't copy — try selecting the text manually");
    }
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
        autoCapitalize="sentences"
        spellCheck
        autoFocus
      />
      <div className="field-voice-row">
        <VoiceButton onTranscript={onTitleTranscript} onDictationEnd={endTitleDictation} />
      </div>
      <div className="field">
        <span className="field-label">Entry</span>
        <textarea
          className="entry-body"
          placeholder="Details…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          autoCapitalize="sentences"
          spellCheck
          rows={10}
        />
        <div className="field-voice-row field-voice-row-multi">
          <VoiceButton onTranscript={onBodyTranscript} onDictationEnd={endBodyDictation} />
          <button type="button" className="copy-btn" disabled={!body.trim()} onClick={() => void copyBody()}>
            📋 Copy
          </button>
        </div>
      </div>
      {/* Classification first — what this is and how important it is — since
          that's what you actually decide right after writing the entry.
          Scheduling (due date) and status (below, existing items only) come
          after: date defaults sensibly already, and status is something you
          come back to change, not something you set while logging. */}
      {meta.hasPriority && <PriorityPicker label="Priority" value={priority} onChange={setPriority} />}

      {meta.hasCategory && (
        <div className="field">
          <span className="field-label">Category</span>
          <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} />
        </div>
      )}

      {meta.hasProject && (
        <label className="field">
          <span className="field-label">Project / App</span>
          <input
            type="text"
            list="project-suggestions"
            placeholder="Which project or app is this for?"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          />
          <datalist id="project-suggestions">
            {knownProjects.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
      )}

      {meta.hasApplicationFields && (
        <div className="item-editor-row">
          <label className="field">
            <span className="field-label">Agency / Recruiter</span>
            <input
              type="text"
              placeholder="Who are you applying through?"
              value={agency}
              onChange={(e) => setAgency(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Found via</span>
            <input
              type="text"
              list="source-suggestions"
              placeholder="Where did you find this?"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <datalist id="source-suggestions">
              {knownSources.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
        </div>
      )}

      {meta.hasProbabilityImpact && (
        <div className="item-editor-row">
          <PriorityPicker label="Probability" value={probability} onChange={setProbability} />
          <PriorityPicker label="Impact" value={impact} onChange={setImpact} />
        </div>
      )}

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

      {item && <p className="entry-timestamp">Logged {format(new Date(item.createdAt), "MMM d, yyyy · h:mm a")}</p>}

      {/* Status only appears once an item exists — you wouldn't set it while
          just logging something, only later if it needs to change (blocked,
          on hold, closed). Kept small and quiet rather than styled like the
          fields above, but still right here, one tap from Save, so closing
          something out doesn't take any hunting. */}
      {item && meta.statuses.length > 0 && (
        <div className="status-row">
          <span className="status-row-label">Status</span>
          <Dropdown
            className="status-row-select"
            value={status ?? ""}
            onChange={(v) => setStatus(v as ItemStatus)}
            options={meta.statuses.map((s) => ({ value: s, label: statusLabelFor(kind, s) }))}
          />
        </div>
      )}

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
            autoCapitalize="sentences"
            spellCheck
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
              autoCapitalize="sentences"
              spellCheck
              rows={3}
            />
            <div className="add-update-row">
              <button type="button" className="primary" disabled={!newUpdateNote.trim()} onClick={() => void addUpdate()}>
                Add update
              </button>
            </div>
          </div>
        </div>
      )}

      {item && meta.hasSubtasks && (
        <div className="link-section">
          <div className="subtask-header">
            <span className="field-label">Subtasks</span>
            {subtasks.length > 0 && (
              <span className="subtask-count">
                {subtaskDoneCount}/{subtasks.length} · {subtaskPercent}%
              </span>
            )}
          </div>
          {subtasks.length > 0 && (
            <div className="subtask-progress-track">
              <div className="subtask-progress-fill" style={{ width: `${subtaskPercent}%` }} />
            </div>
          )}
          {subtasks.length > 0 && (
            <ul className="subtask-list">
              {subtasks.map((s) => (
                <li key={s.id} className={`subtask-row ${s.done ? "done" : ""}`}>
                  <label className="subtask-check">
                    <input
                      type="checkbox"
                      checked={s.done}
                      onChange={(e) => void toggleSubtaskRow(s.id, e.target.checked)}
                    />
                    <span className="subtask-title">{s.title}</span>
                  </label>
                  <button
                    type="button"
                    className="chip-remove"
                    aria-label={`Delete subtask ${s.title}`}
                    onClick={() => void removeSubtask(s.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="add-link-row">
            <input
              type="text"
              placeholder="Add a subtask…"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addSubtaskRow();
                }
              }}
            />
            <button type="button" disabled={!newSubtaskTitle.trim()} onClick={() => void addSubtaskRow()}>
              Add subtask
            </button>
          </div>
        </div>
      )}

      {item ? (
        <div className="link-section">
          <span className="field-label">Linked items</span>
          {linkedItems.length > 0 ? (
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
          ) : (
            <p className="settings-hint small">Not linked to anything yet.</p>
          )}

          {spinOffKind ? (
            <ItemEditor
              kind={spinOffKind}
              defaultDate={item.date}
              onSaved={(newItem) => void handleSpinOffSaved(newItem)}
              onCancel={() => setSpinOffKind(null)}
            />
          ) : (
            <>
              <div className="link-subsection">
                <span className="field-label">Spin off a new linked item</span>
                <div className="spin-off-buttons">
                  {ITEM_KINDS.map((k) => (
                    <button
                      key={k.kind}
                      type="button"
                      className="kind-action-btn"
                      style={{ "--kind-color": k.color } as CSSProperties}
                      onClick={() => setSpinOffKind(k.kind)}
                    >
                      + {k.shortLabel}
                    </button>
                  ))}
                </div>
              </div>
              <div className="add-link-row">
                <Dropdown
                  value={linkPick}
                  onChange={setLinkPick}
                  options={[
                    { value: "", label: "Link to another item…" },
                    ...linkCandidates.map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` })),
                  ]}
                />
                <button type="button" disabled={!linkPick} onClick={() => void addLink()}>
                  Add link
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="settings-hint small">Save this {meta.label.toLowerCase()} first to link it to other items.</p>
      )}
    </div>
  );
}
