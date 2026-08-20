import { useMemo, useState, type CSSProperties } from "react";
import type { Book, BookFormat, BookStatus } from "../types";
import { BOOK_FORMATS, BOOK_STATUSES } from "../lib/bookMeta";
import { useAllBooks } from "../hooks/useJournalData";
import BookCard from "./BookCard";
import BookEditor from "./BookEditor";
import Dropdown from "./Dropdown";

type StatusFilterValue = BookStatus | "";

/**
 * Full search/filter/create UI for books — mirrors ItemBrowser's shape
 * (quick-add buttons, filters, a flat card list) so the app stays
 * consistent, but books get their own component since the fields and
 * quick-add flow (photo capture, series, format) don't fit the Item model.
 */
export default function BookBrowser() {
  const allBooks = useAllBooks();
  // Defaults to "Reading" — opening the page should answer "what am I
  // reading right now", the thing asked for most often, not dump the whole
  // library (wishlist backlog included) in your face.
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("reading");
  const [formatFilter, setFormatFilter] = useState<BookFormat | "">("");
  const [seriesFilter, setSeriesFilter] = useState("");
  const [query, setQuery] = useState("");
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [creatingStatus, setCreatingStatus] = useState<BookStatus | null>(null);

  const statusCounts = useMemo(() => {
    const counts = new Map<BookStatus, number>();
    for (const b of allBooks) counts.set(b.status, (counts.get(b.status) ?? 0) + 1);
    return counts;
  }, [allBooks]);

  const knownSeries = useMemo(
    () => Array.from(new Set(allBooks.filter((b) => b.series).map((b) => b.series as string))).sort((a, b) => a.localeCompare(b)),
    [allBooks],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const books = allBooks.filter((b) => {
      if (statusFilter && b.status !== statusFilter) return false;
      if (formatFilter && b.format !== formatFilter) return false;
      if (seriesFilter && b.series !== seriesFilter) return false;
      if (
        q &&
        !b.title.toLowerCase().includes(q) &&
        !b.author.toLowerCase().includes(q) &&
        !(b.series ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
    return [...books].sort((a, b) => {
      // Filtering to one series reads best in reading order, not recency.
      if (seriesFilter) {
        const aOrder = a.seriesOrder ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.seriesOrder ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [allBooks, statusFilter, formatFilter, seriesFilter, query]);

  if (editingBook) {
    return (
      <BookEditor
        book={editingBook}
        onSaved={() => setEditingBook(null)}
        onCancel={() => setEditingBook(null)}
        onDeleted={() => setEditingBook(null)}
      />
    );
  }

  if (creatingStatus) {
    return (
      <BookEditor
        defaultStatus={creatingStatus}
        onSaved={() => setCreatingStatus(null)}
        onCancel={() => setCreatingStatus(null)}
      />
    );
  }

  return (
    <>
      <div className="new-item-section new-item-section-top">
        <span className="field-label">Add a book</span>
        <div className="new-item-buttons">
          <button
            type="button"
            className="kind-action-btn"
            style={{ "--kind-color": "#7c3aed" } as CSSProperties}
            onClick={() => setCreatingStatus("wishlist")}
          >
            + Want to read
          </button>
          <button
            type="button"
            className="kind-action-btn"
            style={{ "--kind-color": "#2563eb" } as CSSProperties}
            onClick={() => setCreatingStatus("reading")}
          >
            + Currently reading
          </button>
          <button
            type="button"
            className="kind-action-btn"
            style={{ "--kind-color": "#16a34a" } as CSSProperties}
            onClick={() => setCreatingStatus("finished")}
          >
            + Already finished
          </button>
        </div>
      </div>

      <div className="browse-filters">
        <input
          type="search"
          placeholder="Search title, author, or series…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
        <Dropdown
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilterValue)}
          options={[
            { value: "", label: `All statuses · ${allBooks.length}` },
            ...BOOK_STATUSES.map((s) => ({ value: s.status, label: `${s.label} · ${statusCounts.get(s.status) ?? 0}` })),
          ]}
        />
        <Dropdown
          value={formatFilter}
          onChange={(v) => setFormatFilter(v as BookFormat | "")}
          options={[{ value: "", label: "All formats" }, ...BOOK_FORMATS.map((f) => ({ value: f.format, label: `${f.icon} ${f.label}` }))]}
        />
        {knownSeries.length > 0 && (
          <Dropdown
            value={seriesFilter}
            onChange={setSeriesFilter}
            options={[{ value: "", label: "All series" }, ...knownSeries.map((s) => ({ value: s, label: s }))]}
          />
        )}
      </div>

      <p className="result-count">
        {filtered.length} {filtered.length === 1 ? "book" : "books"}
      </p>

      <div className="entry-list">
        {filtered.map((book) => (
          <BookCard key={book.id} book={book} onClick={() => setEditingBook(book)} />
        ))}
        {filtered.length === 0 && <p className="empty-hint">No books here yet — add one above.</p>}
      </div>
    </>
  );
}
