import BookBrowser from "../components/BookBrowser";

export default function BooksPage() {
  return (
    <div className="page books-page">
      <h1 className="page-title">Books</h1>
      <p className="settings-hint">
        Want-to-read, currently reading (any number at once), and finished — across PDFs, Audible, YouTube,
        e-books, or physical copies. Snap a cover photo or a screenshot to add one fast.
      </p>
      <BookBrowser />
    </div>
  );
}
