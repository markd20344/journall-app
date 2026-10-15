import BackLink from "../components/BackLink";
import { restore } from "../data/repo";
import { useStore } from "../data/store";
import { formatDateTime, personName } from "../lib/format";
import type { CollectionName } from "../types";

interface TrashItem {
  collection: CollectionName;
  id: string;
  label: string;
  kind: string;
  updatedAt: string;
}

// Soft-deleted records, newest first. Nothing is ever purged automatically.
export default function TrashPage() {
  const s = useStore();
  const items: TrashItem[] = [
    ...s.people.all.filter((r) => r.deleted).map((r) => ({ collection: "people" as const, id: r.id, label: personName(r), kind: "Person", updatedAt: r.updatedAt })),
    ...s.companies.all.filter((r) => r.deleted).map((r) => ({ collection: "companies" as const, id: r.id, label: r.name, kind: "Company", updatedAt: r.updatedAt })),
    ...s.notes.all.filter((r) => r.deleted).map((r) => ({ collection: "notes" as const, id: r.id, label: (r.body ?? "").slice(0, 80), kind: "Note", updatedAt: r.updatedAt })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="page">
      <div className="page-head">
        <BackLink fallback="/more" label="More" />
      </div>
      <h1>Trash</h1>
      {items.length === 0 ? (
        <p className="empty">Nothing in the trash.</p>
      ) : (
        <div className="list">
          {items.map((i) => (
            <div key={`${i.collection}/${i.id}`} className="row">
              <span className="row-main">
                <span className="row-title">{i.label || "(untitled)"}</span>
                <span className="row-sub">
                  {i.kind} · deleted {formatDateTime(i.updatedAt)}
                </span>
              </span>
              <button type="button" className="small" onClick={() => restore(i.collection, i.id)}>
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
