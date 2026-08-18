// Turns a pasted "daily jobs" sheet into a list of draft jobs. Two formats
// are handled:
//
// 1. The real thing — a "Driver Work and StartTimes" sheet pasted as plain
//    text (tab-separated columns, with wrapped address cells spilling onto
//    their own bare lines). This is the primary, well-understood format —
//    see parseDriverSheet below for the exact layout it expects.
// 2. A fallback prose-style split (paragraph/postcode based) for anything
//    that doesn't look like the driver sheet, so pasting something else
//    still produces *something* to review rather than nothing.
//
// Either way, every draft is shown in an editable review step before
// anything is saved — a wrong guess is a quick fix, not a bad record.

export interface DraftKitJob {
  jobNumber: string;
  customerName: string;
  address: string;
  postcode: string;
  phoneNumbers: string[];
  notes: string;
  rawText: string;
}

const POSTCODE_REGEX = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi;
const PHONE_REGEX = /(?:\+44\s?\d{2,4}|\(?0\d{2,4}\)?)[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g;

function normalizePhone(raw: string): string {
  return raw.trim().replace(/\s{2,}/g, " ");
}

function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_REGEX) ?? [];
  const seen = new Set<string>();
  const phones: string[] = [];
  for (const m of matches) {
    const normalized = normalizePhone(m);
    const digits = normalized.replace(/\D/g, "");
    // Skip anything too short to plausibly be a real number (stray digit
    // runs like a job number fragment matching the pattern by accident).
    if (digits.length < 9) continue;
    if (seen.has(digits)) continue;
    seen.add(digits);
    phones.push(normalized);
  }
  return phones;
}

export function emptyDraftJob(): DraftKitJob {
  return { jobNumber: "", customerName: "", address: "", postcode: "", phoneNumbers: [], notes: "", rawText: "" };
}

// ---------------------------------------------------------------------
// Driver Work and StartTimes sheet
// ---------------------------------------------------------------------
//
// Each job is a row that, once wrapped address cells are accounted for,
// looks like this when pasted as plain text:
//
//   16:00:00	12322245	LEAVERS	KIT COLLECTION	PA/ BW327 CALL NIGHT BEFORE
//   White Cottage
//   Main Road
//   Boston
//
//   PE20 2BG	CORBY HUB GED B
//   Geddington Road
//
//   Corby
//
//   NN18 8EZ	52.0
//   Account:	Internal - Kit Collection
//   Collection Contact :	BROOKE WHEWELL
//   Collection Tel.No #:	07506745102
//   Collection Time:	Day
//   Delivery Contact #:
//   Delivery Time:	Day
//   Special Ins:
//   ...boilerplate safety text, TelePOD trailer...
//
// The first line (StartTime\tJob#\tRegistration\tDescription\tCollection
// From-first-line) is the only reliable, unambiguous marker of where a job
// starts — a spreadsheet's wrapped-cell text otherwise looks identical to
// free-flowing prose. Everything else (the address, the customer contact,
// their phone) is pulled out of the block that marker opens, by scanning
// for the postcode and the known "Label :\tValue" metadata lines rather
// than assuming a fixed number of lines — cell wrapping means that varies
// job to job.

const JOB_ROW_START_REGEX = /^(\d{1,2}:\d{2}:\d{2})\t/;
const COLLECTION_CONTACT_REGEX = /^collection\s*contact\s*#?\s*:\s*\t?\s*(.*)$/i;
const COLLECTION_TEL_REGEX = /^collection\s*tel\.?\s*no\.?\s*#?\s*:\s*\t?\s*(.*)$/i;
const SPECIAL_INS_REGEX = /^special\s*ins\s*:?\s*\t?\s*(.*)$/i;

/**
 * The first line of the "Collection From" address cell is sometimes a
 * job note (a reference code and/or an instruction like "CALL NIGHT
 * BEFORE") rather than the start of the street address — as in the
 * example above. Recognized by shape (a short code ending in "/") or by
 * containing an obvious instruction keyword, so it can be pulled out into
 * the job's notes instead of getting stuck onto the front of the address.
 */
function looksLikeAddressNote(line: string): boolean {
  return /^[A-Z]{1,4}\//.test(line) || /\bcall\b/i.test(line) || /\bnight before\b/i.test(line);
}

function parseDriverSheetBlock(lines: string[]): DraftKitJob {
  const firstLineFields = lines[0].split("\t");
  const jobNumber = (firstLineFields[1] ?? "").trim();
  const registration = (firstLineFields[2] ?? "").trim();
  const collectionFromFirstSeg = (firstLineFields[4] ?? "").trim();

  // Walk forward from the second line, collecting plain (no-tab) lines as
  // address text, until a line carrying the postcode is found — that line
  // may itself continue past a tab into the *next* column (Deliver To),
  // which is dropped since it's the drop-off hub, not this job's address.
  const addressLines: string[] = collectionFromFirstSeg ? [collectionFromFirstSeg] : [];
  let postcode = "";
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const tabIdx = line.indexOf("\t");
    const beforeTab = (tabIdx >= 0 ? line.slice(0, tabIdx) : line).trim();
    const postcodeMatch = beforeTab.match(POSTCODE_REGEX);
    if (postcodeMatch) {
      postcode = postcodeMatch[0].toUpperCase().replace(/\s+/g, " ");
      break;
    }
    if (beforeTab) addressLines.push(beforeTab);
    if (tabIdx >= 0) break; // hit a column boundary with no postcode — stop rather than guess further
  }

  let note = "";
  if (addressLines.length > 0 && looksLikeAddressNote(addressLines[0])) {
    note = addressLines.shift() as string;
  }
  const address = addressLines.join(", ");

  let customerName = "";
  let phone = "";
  let specialIns = "";
  for (const line of lines) {
    const contactMatch = COLLECTION_CONTACT_REGEX.exec(line);
    if (contactMatch?.[1].trim()) customerName = contactMatch[1].trim();
    const telMatch = COLLECTION_TEL_REGEX.exec(line);
    if (telMatch?.[1].trim()) phone = telMatch[1].trim();
    const specialMatch = SPECIAL_INS_REGEX.exec(line);
    if (specialMatch?.[1].trim()) specialIns = specialMatch[1].trim();
  }

  const notes = [registration && registration !== "KIT COLLECTION" ? registration : "", note, specialIns]
    .filter(Boolean)
    .join(" · ");

  return {
    jobNumber,
    customerName,
    address,
    postcode,
    // Only the explicit "Collection Tel.No #:" field, never a blind scan of
    // the whole block — the boilerplate/TelePOD trailer lines contain other
    // phone-shaped numbers (routing numbers, coordinator lines) that aren't
    // the customer's, and a missing field here means no number was given at
    // all, not "search harder."
    phoneNumbers: phone ? [phone] : [],
    notes,
    rawText: lines.join("\n"),
  };
}

/** Splits a driver sheet into job blocks anchored on each "HH:MM:SS\t" row start. Returns null if the text doesn't look like this format at all. */
function parseDriverSheet(rawText: string): DraftKitJob[] | null {
  const lines = rawText.split(/\r\n|\r|\n/).map((l) => l.trimEnd());
  const startIndexes: number[] = [];
  lines.forEach((line, i) => {
    if (JOB_ROW_START_REGEX.test(line)) startIndexes.push(i);
  });
  if (startIndexes.length === 0) return null;

  return startIndexes.map((start, i) => {
    const end = i + 1 < startIndexes.length ? startIndexes[i + 1] : lines.length;
    return parseDriverSheetBlock(lines.slice(start, end));
  });
}

// ---------------------------------------------------------------------
// Fallback: free-flowing prose email, split heuristically
// ---------------------------------------------------------------------

const JOB_NUMBER_LABEL_REGEX = /\b(?:job\s*(?:no\.?|number)?|ref(?:erence)?|booking\s*ref)\s*[:#-]?\s*([A-Z0-9-]{3,})/i;
const LABEL_LINE_REGEX = /^(name|address|postcode|post\s*code|phone|tel(?:ephone)?|mobile|contact|job\s*(?:no\.?|number)?|ref(?:erence)?|booking\s*ref)\s*[:#-]\s*/i;

function extractPostcode(text: string): string {
  const matches = text.match(POSTCODE_REGEX);
  if (!matches || matches.length === 0) return "";
  return matches[matches.length - 1].toUpperCase().replace(/\s+/g, " ").trim();
}

function extractJobNumber(text: string): string {
  const match = JOB_NUMBER_LABEL_REGEX.exec(text);
  return match ? match[1] : "";
}

function stripLabel(line: string): string {
  return line.replace(LABEL_LINE_REGEX, "").trim();
}

function guessName(lines: string[], postcode: string): string {
  for (const raw of lines) {
    if (JOB_NUMBER_LABEL_REGEX.test(raw)) continue;
    const line = stripLabel(raw);
    if (!line) continue;
    if (postcode && line.toUpperCase().includes(postcode)) continue;
    if (PHONE_REGEX.test(line) && line.replace(PHONE_REGEX, "").trim().length < 3) continue;
    PHONE_REGEX.lastIndex = 0;
    return line;
  }
  return "";
}

function guessAddress(lines: string[], name: string): string {
  const addressLines: string[] = [];
  for (const raw of lines) {
    if (JOB_NUMBER_LABEL_REGEX.test(raw)) continue;
    const line = stripLabel(raw);
    if (!line || line === name) continue;
    const withoutPhones = line.replace(PHONE_REGEX, "").trim();
    if (!withoutPhones) continue;
    addressLines.push(withoutPhones.replace(/[,\s]+$/, ""));
  }
  return addressLines.join(", ");
}

function parseProseBlock(rawText: string): DraftKitJob {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const postcode = extractPostcode(rawText);
  const phoneNumbers = extractPhones(rawText);
  const jobNumber = extractJobNumber(rawText);
  const name = guessName(lines, postcode);
  const address = guessAddress(lines, name);
  return { jobNumber, customerName: name, address, postcode, phoneNumbers, notes: "", rawText: rawText.trim() };
}

function parseProseEmail(rawEmailText: string): DraftKitJob[] {
  const paragraphs = rawEmailText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const markerIndexes = paragraphs.map((p, i) => (JOB_NUMBER_LABEL_REGEX.test(p) ? i : -1)).filter((i) => i >= 0);
  if (markerIndexes.length >= 2) {
    const blocks: string[][] = markerIndexes.map((start, i) => {
      const end = i + 1 < markerIndexes.length ? markerIndexes[i + 1] : paragraphs.length;
      return paragraphs.slice(start, end);
    });
    return blocks.map((paras) => parseProseBlock(paras.join("\n\n")));
  }

  const blocks: string[][] = [];
  let current: string[] = [];
  for (const para of paragraphs) {
    current.push(para);
    if (POSTCODE_REGEX.test(para)) {
      POSTCODE_REGEX.lastIndex = 0;
      blocks.push(current);
      current = [];
    }
    POSTCODE_REGEX.lastIndex = 0;
  }
  if (current.length > 0 && blocks.length > 0) {
    for (const para of current) {
      if (PHONE_REGEX.test(para)) {
        blocks[blocks.length - 1].push(para);
      }
      PHONE_REGEX.lastIndex = 0;
    }
  }

  return blocks.map((paras) => parseProseBlock(paras.join("\n\n")));
}

/** Splits pasted text into per-job drafts, trying the driver sheet format first and falling back to a prose-style split. */
export function parseKitEmail(rawText: string): DraftKitJob[] {
  return parseDriverSheet(rawText) ?? parseProseEmail(rawText);
}
