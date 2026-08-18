import type { BookFormat, BookStatus } from "../types";

export interface BookStatusMeta {
  status: BookStatus;
  label: string;
  color: string;
}

// Display order used everywhere statuses are listed (tabs, dropdowns) — the
// natural life of a book on the list: spotted somewhere and want to read it,
// actually reading it (any number at once), paused, done, or given up on.
export const BOOK_STATUSES: BookStatusMeta[] = [
  { status: "wishlist", label: "Want to read", color: "#7c3aed" },
  { status: "reading", label: "Reading", color: "#2563eb" },
  { status: "on_hold", label: "On hold", color: "#d97706" },
  { status: "finished", label: "Finished", color: "#16a34a" },
  { status: "abandoned", label: "Abandoned", color: "#6b7280" },
];

const STATUS_BY_VALUE = new Map(BOOK_STATUSES.map((s) => [s.status, s]));

export function bookStatusMeta(status: BookStatus): BookStatusMeta {
  const meta = STATUS_BY_VALUE.get(status);
  if (!meta) throw new Error(`Unknown book status: ${status}`);
  return meta;
}

export interface BookFormatMeta {
  format: BookFormat;
  label: string;
  icon: string;
}

export const BOOK_FORMATS: BookFormatMeta[] = [
  { format: "physical", label: "Physical", icon: "📕" },
  { format: "ebook", label: "E-book", icon: "📱" },
  { format: "pdf", label: "PDF", icon: "📄" },
  { format: "audiobook", label: "Audiobook", icon: "🎧" },
  { format: "youtube", label: "YouTube", icon: "▶️" },
];

const FORMAT_BY_VALUE = new Map(BOOK_FORMATS.map((f) => [f.format, f]));

export function bookFormatMeta(format: BookFormat): BookFormatMeta {
  const meta = FORMAT_BY_VALUE.get(format);
  if (!meta) throw new Error(`Unknown book format: ${format}`);
  return meta;
}
