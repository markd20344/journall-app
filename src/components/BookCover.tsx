interface Props {
  title: string;
  coverImage: string | null;
  size?: "sm" | "lg";
}

// A snapped photo/screenshot when there is one; otherwise a plain initial
// tile rather than a broken-image icon or blank space, since plenty of
// wishlist entries will be title-only.
export default function BookCover({ title, coverImage, size = "sm" }: Props) {
  if (coverImage) {
    return <img className={`book-cover book-cover-${size}`} src={coverImage} alt={`Cover of ${title || "untitled book"}`} />;
  }
  const initial = title.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className={`book-cover book-cover-placeholder book-cover-${size}`} aria-hidden="true">
      {initial}
    </div>
  );
}
