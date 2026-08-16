import { useEffect, useState } from "react";
import { format } from "date-fns";
import type { Entry } from "../types";
import { useCategories, useTopicsForCategory } from "../hooks/useJournalData";
import { createEntry, deleteEntry, findOrCreateTopic, updateEntry } from "../db/repo";
import { db } from "../db/db";
import { todayDateString } from "../lib/id";
import CategorySelect from "./CategorySelect";
import TopicTagInput from "./TopicTagInput";
import VoiceButton from "./VoiceButton";
import SpinOffPanel from "./SpinOffPanel";

interface Props {
  entry?: Entry;
  initialDate?: string;
  onSaved?: (entry: Entry) => void;
  onDeleted?: () => void;
  onCancel?: () => void;
}

export default function EntryEditor({ entry, initialDate, onSaved, onDeleted, onCancel }: Props) {
  const categories = useCategories();
  const [date, setDate] = useState(entry?.date ?? initialDate ?? todayDateString());
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? "");
  const [topicNames, setTopicNames] = useState<string[]>([]);
  const [body, setBody] = useState(entry?.body ?? "");
  const [saving, setSaving] = useState(false);

  const topicsForCategory = useTopicsForCategory(categoryId);

  // Default to the first available category once categories load.
  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  // Resolve the entry's topic ids to names once on load / when entry changes.
  useEffect(() => {
    let cancelled = false;
    async function loadTopicNames() {
      if (!entry || entry.topicIds.length === 0) {
        if (!cancelled) setTopicNames([]);
        return;
      }
      const topics = await db.topics.bulkGet(entry.topicIds);
      if (!cancelled) {
        setTopicNames(topics.filter((t): t is NonNullable<typeof t> => Boolean(t)).map((t) => t.name));
      }
    }
    void loadTopicNames();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);

  function appendTranscript(text: string) {
    setBody((prev) => (prev.trim().length === 0 ? text : `${prev.trim()} ${text}`));
  }

  async function handleSave() {
    if (!categoryId || body.trim().length === 0) return;
    setSaving(true);
    try {
      const topicIds = await Promise.all(
        topicNames.map(async (name) => (await findOrCreateTopic(name, categoryId)).id),
      );
      if (entry) {
        await updateEntry(entry.id, { date, categoryId, topicIds, body });
        onSaved?.({ ...entry, date, categoryId, topicIds, body });
      } else {
        const created = await createEntry({ date, categoryId, topicIds, body });
        onSaved?.(created);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry) return;
    if (!window.confirm("Delete this entry? This can't be undone.")) return;
    await deleteEntry(entry.id);
    onDeleted?.();
  }

  return (
    <div className="entry-editor">
      <div className="entry-editor-row">
        <label className="field">
          <span className="field-label">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Category</span>
          <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} />
        </label>
      </div>

      {entry && (
        <p className="entry-timestamp">Logged {format(new Date(entry.createdAt), "h:mm a")}</p>
      )}

      <label className="field">
        <span className="field-label">Topics</span>
        <TopicTagInput availableTopics={topicsForCategory} selected={topicNames} onChange={setTopicNames} />
      </label>

      <div className="field">
        <div className="field-label-row">
          <span className="field-label">Entry</span>
          <VoiceButton onTranscript={appendTranscript} />
        </div>
        <textarea
          className="entry-body"
          placeholder="What's on your mind?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          autoFocus
        />
      </div>

      <div className="entry-editor-actions">
        <button type="button" className="primary" disabled={saving || !categoryId || !body.trim()} onClick={() => void handleSave()}>
          {entry ? "Save changes" : "Save entry"}
        </button>
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        {entry && (
          <button type="button" className="danger" onClick={() => void handleDelete()}>
            Delete
          </button>
        )}
      </div>

      {entry && <SpinOffPanel entry={entry} />}
    </div>
  );
}
