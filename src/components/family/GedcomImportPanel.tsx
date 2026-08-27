import { useState } from "react";
import { parseGedcomFile, type GedcomImportPreview } from "../../family/gedcomImport";
import { commitGedcomImport } from "../../family/repo";
import { fullName } from "../../family/personDisplay";
import { showToast } from "../../lib/toast";

interface Props {
  uid: string;
  onDone: () => void;
  onCancel: () => void;
}

export default function GedcomImportPanel({ uid, onDone, onCancel }: Props) {
  const [preview, setPreview] = useState<GedcomImportPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setParsing(true);
    setError(null);
    setPreview(null);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseGedcomFile(buffer, uid);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't parse that GEDCOM file.");
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setImporting(true);
    try {
      await commitGedcomImport(preview.people, preview.relationships);
      showToast(`Imported ${preview.people.length} people`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed partway through — check your connection and try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="family-editor">
      <h2 className="page-title">Import from GEDCOM</h2>
      <p className="settings-hint">
        Export your tree from Ancestry (Tree Settings → Export Tree) or any other genealogy tool as a .ged file, and
        import it here. This brings in people, relationships, and dates/places — Ancestry doesn't let exports include
        photos or scanned documents, so those still need adding by hand afterward for the people who matter most.
      </p>

      <input
        type="file"
        accept=".ged,text/vnd.familysearch.gedcom,application/octet-stream"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {parsing && <p className="settings-hint">Parsing {fileName}…</p>}
      {error && <p className="auth-error">{error}</p>}

      {preview && (
        <div className="gedcom-preview">
          <p className="result-count">
            Found {preview.people.length} people and {preview.relationships.length} relationships in {fileName}.
          </p>
          {preview.warnings.map((w) => (
            <p key={w} className="auth-error">
              {w}
            </p>
          ))}
          <ul className="gedcom-preview-list">
            {preview.people.slice(0, 15).map((p) => (
              <li key={p.id}>{fullName(p)}</li>
            ))}
            {preview.people.length > 15 && <li>…and {preview.people.length - 15} more</li>}
          </ul>
        </div>
      )}

      <div className="entry-editor-actions">
        <button type="button" className="primary" disabled={!preview || preview.people.length === 0 || importing} onClick={() => void handleConfirm()}>
          {importing ? "Importing…" : "Import into the tree"}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
