// Frozen snapshot of exactly enough of the old kit-email parser to support
// db.ts's version-14 migration (which strips a specific auto-generated
// notes string back out of kitJobs rows imported before that fix landed).
// Kit Runs is now its own app with its own, independently-evolving copy of
// this parser (apps/kit-runs/src/lib/kitEmailParser.ts) — this journal app
// no longer touches kitJobs at all, so this file exists purely to keep a
// years-old Dexie upgrade step working for anyone whose local database
// still hasn't passed through it, without creating a dependency on the
// kit-runs app. Do not "fix" or extend this — it must reproduce exactly
// what the original parser produced at the time v14 shipped.

interface LegacyDraftKitJobNotes {
  notes: string;
}

const POSTCODE_REGEX = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi;
const JOB_ROW_START_REGEX = /^(\d{1,2}:\d{2}:\d{2})\t/;
const COLLECTION_CONTACT_REGEX = /^collection\s*contact\s*#?\s*:\s*\t?\s*(.*)$/i;
const COLLECTION_TEL_REGEX = /^collection\s*tel\.?\s*no\.?\s*#?\s*:\s*\t?\s*(.*)$/i;
const SPECIAL_INS_REGEX = /^special\s*ins\s*:?\s*\t?\s*(.*)$/i;

function looksLikeAddressNote(line: string): boolean {
  return /^[A-Z]{1,4}\//.test(line) || /\bcall\b/i.test(line) || /\bnight before\b/i.test(line);
}

function parseDriverSheetBlock(lines: string[]): LegacyDraftKitJobNotes {
  const firstLineFields = lines[0].split("\t");
  const registration = (firstLineFields[2] ?? "").trim();
  const collectionFromFirstSeg = (firstLineFields[4] ?? "").trim();

  const addressLines: string[] = collectionFromFirstSeg ? [collectionFromFirstSeg] : [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const tabIdx = line.indexOf("\t");
    const beforeTab = (tabIdx >= 0 ? line.slice(0, tabIdx) : line).trim();
    if (beforeTab.match(POSTCODE_REGEX)) break;
    if (beforeTab) addressLines.push(beforeTab);
    if (tabIdx >= 0) break;
  }

  let note = "";
  if (addressLines.length > 0 && looksLikeAddressNote(addressLines[0])) {
    note = addressLines.shift() as string;
  }

  let specialIns = "";
  for (const line of lines) {
    const specialMatch = SPECIAL_INS_REGEX.exec(line);
    if (specialMatch?.[1].trim()) specialIns = specialMatch[1].trim();
    // Matched for parity with the original parser's full field scan, even
    // though this notes-only reproduction doesn't use the captured values.
    COLLECTION_CONTACT_REGEX.exec(line);
    COLLECTION_TEL_REGEX.exec(line);
  }

  const notes = [registration && registration !== "KIT COLLECTION" ? registration : "", note, specialIns]
    .filter(Boolean)
    .join(" · ");

  return { notes };
}

/** Re-derives the legacy auto-generated notes string for a kitJob's stored rawText, or "" if it doesn't look like a driver-sheet row. */
export function deriveLegacyAutoNotes(rawText: string): string {
  if (!rawText.trim()) return "";
  const lines = rawText.split(/\r\n|\r|\n/);
  if (!JOB_ROW_START_REGEX.test(lines[0])) return "";
  return parseDriverSheetBlock(lines).notes;
}
