import { formatDistanceToNow } from "date-fns";
import type { Procedure } from "../types";
import { useCategories } from "../hooks/useJournalData";

interface Props {
  procedure: Procedure;
  onClick?: () => void;
}

export default function ProcedureCard({ procedure, onClick }: Props) {
  const categories = useCategories();
  const category = procedure.categoryId ? categories.find((c) => c.id === procedure.categoryId) : undefined;

  return (
    <button type="button" className="entry-card" onClick={onClick}>
      <div className="entry-card-meta">
        <span className="linked-badge">
          {procedure.steps.length} step{procedure.steps.length === 1 ? "" : "s"}
        </span>
        {category && (
          <span className="category-pill" style={{ background: category.color }}>
            {category.name}
          </span>
        )}
        <span className="linked-badge">
          {procedure.lastUsedAt ? `Used ${formatDistanceToNow(new Date(procedure.lastUsedAt), { addSuffix: true })}` : "Never used yet"}
        </span>
      </div>
      <p className="entry-card-body">{procedure.title || "Untitled"}</p>
      {procedure.steps.length > 0 && <p className="dependency-line">{procedure.steps[0].text}</p>}
    </button>
  );
}
