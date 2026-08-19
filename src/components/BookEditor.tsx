import { useRef, useState } from "react";
import type { Book, BookStatus } from "../types";
import { BOOK_FORMATS, BOOK_STATUSES } from "../lib/bookMeta";
import { createBook, deleteBook, updateBook } from "../db/repo";
import { useAllBooks, useCategories } from "../hooks/useJournalData";
import { resizeImageFile } from "../lib/image";
import { todayDateString } from "../lib/id";
import { appendDictatedSentence, ensureSentenceEnd } from "../lib/dictation";
import { useDictation } from "../hooks/useDictation";
import { showToast } from "../lib/toast";
import { schedulePendingDelete, cancelPendingDelete } from "../lib/pendingDelete";
import BookCover from "./BookCover";
import VoiceButton from "./VoiceButton";
import Dropdown from "./Dropdown";
import ItemEditor from "./ItemEditor";

interface Props {
  book?: Book;
  defaultStatus?: BookStatus;
  onSaved?: (book: Book) => void;
  onCancel?: () => void;
  onDeleted?: () => void;
}

// Rating only matters once you've actually finished something — showing it
// for every status would just be five stars nobody has an opinion on yet.
function ratingApplies(status: BookStatus): boolean {
  return status === "finished" || status === "abandoned";
}

export default function BookEditor({ book, defaultStatus, onSaved, onCancel, onDeleted }: Props) {
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [series, setSeries] = useState(book?.series ?? "");
  const [seriesOrder, setSeriesOrder] = useState(book?.seriesOrder != null ? String(book.seriesOrder) : "");
  const [status, setStatus] = useState<BookStatus>(book?.status ?? defaultStatus ?? "wishlist");
  const [format, setFormat] = useState(book?.format ?? "physical");
  const [coverImage, setCoverImage] = useState<string | null>(book?.coverImage ?? null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [rating, setRating] = useState<number | null>(book?.rating ?? null);
  const [notes, setNotes] = useState(book?.notes ?? "");
  const { onTranscript: onNotesTranscript, endSession: endNotesDictation } = useDictation(
    setNotes,
    appendDictatedSentence,
    ensureSentenceEnd,
  );
  const [dateAdded, setDateAdded] = useState(book?.dateAdded ?? todayDateString());
  const [dateStarted, setDateStarted] = useState(book?.dateStarted ?? "");
  const [dateFinished, setDateFinished] = useState(book?.dateFinished ?? "");
  const [saving, setSaving] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allBooks = useAllBooks();
  const knownSeries = Array.from(new Set(allBooks.filter((b) => b.series).map((b) => b.series as string))).sort((a, b) =>
    a.localeCompare(b),
  );

  // Tasks aren't a book-specific record — they're a normal Task (Item), just
  // pre-tagged with the "Books" category (see ensureDomainCategories) so
  // they read as book-related wherever Tasks show up (Log, Today, a colored
  // pill on the card) without a separate task system to maintain. Falls
  // back to no default if that category was renamed/deleted — the picker
  // in ItemEditor still works, just without the pre-fill.
  const categories = useCategories();
  const booksCategoryId = categories.find((c) => c.name.toLowerCase() === "books")?.id;

  async function handleCoverPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverBusy(true);
    try {
      const dataUrl = await resizeImageFile(file);
      setCoverImage(dataUrl);
    } catch {
      showToast("Couldn't process that photo — try another one");
    } finally {
      setCoverBusy(false);
    }
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const parsedOrder = seriesOrder.trim() ? Number(seriesOrder) : null;
      const finalSeriesOrder = parsedOrder != null && !Number.isNaN(parsedOrder) ? parsedOrder : null;
      const finalRating = ratingApplies(status) ? rating : null;
      if (book) {
        await updateBook(book.id, {
          title: title.trim(),
          author: author.trim(),
          series: series.trim() || null,
          seriesOrder: finalSeriesOrder,
          status,
          format,
          coverImage,
          rating: finalRating,
          notes,
          dateAdded,
          dateStarted: dateStarted || null,
          dateFinished: dateFinished || null,
        });
        showToast("Book saved");
        onSaved?.({
          ...book,
          title: title.trim(),
          author: author.trim(),
          series: series.trim() || null,
          seriesOrder: finalSeriesOrder,
          status,
          format,
          coverImage,
          rating: finalRating,
          notes,
          dateAdded,
          dateStarted: dateStarted || null,
          dateFinished: dateFinished || null,
        });
      } else {
        const created = await createBook({
          title: title.trim(),
          author: author.trim(),
          series: series.trim() || null,
          seriesOrder: finalSeriesOrder,
          status,
          format,
          coverImage,
          notes,
          dateAdded,
        });
        showToast("Book added");
        onSaved?.(created);
        setTitle("");
        setAuthor("");
        setCoverImage(null);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!book) return;
    const id = book.id;
    const bookTitle = book.title;
    schedulePendingDelete("book", id, () => deleteBook(id));
    showToast(`Deleted "${bookTitle}"`, {
      action: { label: "Undo", onClick: () => cancelPendingDelete("book", id) },
      durationMs: 5000,
    });
    onDeleted?.();
  }

  if (addingTask && book) {
    return (
      <ItemEditor
        kind="action"
        defaultDate={todayDateString()}
        defaultTitle={`Re: ${book.title}`}
        defaultCategoryId={booksCategoryId}
        onSaved={() => setAddingTask(false)}
        onCancel={() => setAddingTask(false)}
      />
    );
  }

  return (
    <div className="item-editor book-editor">
      <div className="book-editor-cover-row">
        <BookCover title={title} coverImage={coverImage} size="lg" />
        <div className="book-editor-cover-actions">
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => void handleCoverPicked(e)} />
          <button type="button" disabled={coverBusy} onClick={() => fileInputRef.current?.click()}>
            {coverBusy ? "Processing…" : coverImage ? "🖼️ Change cover" : "🖼️ Add cover"}
          </button>
          {coverImage && (
            <button type="button" className="ghost" onClick={() => setCoverImage(null)}>
              Remove
            </button>
          )}
          <p className="settings-hint small">
            Take a new photo, or pick one already on your phone — a cover shot, a TikTok/Instagram screenshot, or a
            screenshot of an e-book's cover from your reading app.
          </p>
        </div>
      </div>

      <input
        type="text"
        className="item-title-input"
        placeholder="Book title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoCapitalize="sentences"
        spellCheck
        autoFocus
      />

      <label className="field">
        <span className="field-label">Author</span>
        <input type="text" placeholder="Author (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} />
      </label>

      <div className="item-editor-row">
        <label className="field">
          <span className="field-label">Series</span>
          <input
            type="text"
            list="book-series-suggestions"
            placeholder="e.g. Arena"
            value={series}
            onChange={(e) => setSeries(e.target.value)}
          />
          <datalist id="book-series-suggestions">
            {knownSeries.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="field book-series-order-field">
          <span className="field-label">Book #</span>
          <input
            type="number"
            min={1}
            placeholder="#"
            value={seriesOrder}
            onChange={(e) => setSeriesOrder(e.target.value)}
          />
        </label>
      </div>

      <div className="item-editor-row">
        <label className="field">
          <span className="field-label">Format</span>
          <Dropdown
            value={format}
            onChange={(v) => setFormat(v as typeof format)}
            options={BOOK_FORMATS.map((f) => ({ value: f.format, label: `${f.icon} ${f.label}` }))}
          />
        </label>
        <label className="field">
          <span className="field-label">Status</span>
          <Dropdown
            value={status}
            onChange={(v) => setStatus(v as BookStatus)}
            options={BOOK_STATUSES.map((s) => ({ value: s.status, label: s.label }))}
          />
        </label>
      </div>

      {ratingApplies(status) && (
        <div className="field">
          <span className="field-label">Rating</span>
          <div className="star-picker">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`star-btn ${rating != null && n <= rating ? "filled" : ""}`}
                aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
                onClick={() => setRating(rating === n ? null : n)}
              >
                {rating != null && n <= rating ? "★" : "☆"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="item-editor-row">
        <label className="field">
          <span className="field-label">Added</span>
          <input type="date" value={dateAdded} onChange={(e) => setDateAdded(e.target.value)} />
        </label>
        {status !== "wishlist" && (
          <label className="field">
            <span className="field-label">Started</span>
            <input type="date" value={dateStarted} onChange={(e) => setDateStarted(e.target.value)} />
          </label>
        )}
        {ratingApplies(status) && (
          <label className="field">
            <span className="field-label">Finished</span>
            <input type="date" value={dateFinished} onChange={(e) => setDateFinished(e.target.value)} />
          </label>
        )}
      </div>

      <div className="field">
        <span className="field-label">Notes</span>
        <textarea
          className="entry-body book-notes"
          placeholder="Thoughts, where you're up to, why you want to read it…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          autoCapitalize="sentences"
          spellCheck
          rows={4}
        />
        <div className="field-voice-row">
          <VoiceButton onTranscript={onNotesTranscript} onDictationEnd={endNotesDictation} />
        </div>
      </div>

      <div className="entry-editor-actions">
        <button type="button" className="primary" disabled={saving || !title.trim()} onClick={() => void handleSave()}>
          {book ? "Save changes" : "Add book"}
        </button>
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        {book && (
          <button type="button" className="danger" onClick={handleDelete}>
            Delete
          </button>
        )}
      </div>

      {book ? (
        <div className="link-section">
          <span className="field-label">Tasks</span>
          <p className="settings-hint small">
            A normal task, tagged "Books" so it's easy to spot in Log/Today — e.g. return it to the library, chase up
            a preorder, or post a review.
          </p>
          <button type="button" onClick={() => setAddingTask(true)}>
            + Add a task for this book
          </button>
        </div>
      ) : (
        <p className="settings-hint small">Save this book first to add a task for it.</p>
      )}
    </div>
  );
}
