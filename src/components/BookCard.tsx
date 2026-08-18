import type { Book, BookStatus } from "../types";
import { BOOK_STATUSES, bookFormatMeta, bookStatusMeta } from "../lib/bookMeta";
import { setBookStatus } from "../db/repo";
import BookCover from "./BookCover";
import Dropdown from "./Dropdown";

interface Props {
  book: Book;
  onClick?: () => void;
}

export default function BookCard({ book, onClick }: Props) {
  const status = bookStatusMeta(book.status);
  const format = bookFormatMeta(book.format);

  return (
    <div className="book-card">
      <button type="button" className="book-card-main" onClick={onClick}>
        <BookCover title={book.title} coverImage={book.coverImage} size="sm" />
        <div className="book-card-body">
          <div className="book-card-meta">
            <span className="format-badge">
              {format.icon} {format.label}
            </span>
            {book.series && (
              <span className="series-badge">
                {book.series}
                {book.seriesOrder != null ? ` · Book ${book.seriesOrder}` : ""}
              </span>
            )}
            {book.rating != null && (
              <span className="rating-badge">
                {"★".repeat(book.rating)}
                {"☆".repeat(5 - book.rating)}
              </span>
            )}
          </div>
          <p className="book-card-title">{book.title || "Untitled"}</p>
          {book.author && <p className="book-card-author">{book.author}</p>}
        </div>
      </button>
      <Dropdown
        className="status-select"
        triggerStyle={{ color: status.color, borderColor: status.color }}
        value={book.status}
        onChange={(v) => void setBookStatus(book.id, v as BookStatus)}
        options={BOOK_STATUSES.map((s) => ({ value: s.status, label: s.label }))}
      />
    </div>
  );
}
