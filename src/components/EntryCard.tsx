import type { EntryWithRefs } from "../types";

interface Props {
  entry: EntryWithRefs;
  onClick?: () => void;
}

export default function EntryCard({ entry, onClick }: Props) {
  const preview = entry.body.length > 220 ? `${entry.body.slice(0, 220)}…` : entry.body;
  return (
    <button type="button" className="entry-card" onClick={onClick}>
      <div className="entry-card-meta">
        <span className="entry-card-date">{entry.date}</span>
        {entry.category && (
          <span className="category-pill" style={{ background: entry.category.color }}>
            {entry.category.name}
          </span>
        )}
        {entry.topics.map((t) => (
          <span className="topic-pill" key={t.id}>
            {t.name}
          </span>
        ))}
      </div>
      <p className="entry-card-body">{preview}</p>
    </button>
  );
}
