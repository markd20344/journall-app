// Turns a pasted "daily jobs" email into a list of draft jobs. The exact
// wording/layout of the company email isn't something this app can rely on,
// so this is deliberately a *best-effort* heuristic split — every draft it
// produces is shown in an editable review step before anything is saved, so
// a wrong guess just means a quick fix, not a wrong record silently saved.

export interface DraftKitJob {
  jobNumber: string;
  customerName: string;
  address: string;
  postcode: string;
  phoneNumbers: string[];
  rawText: string;
}

const POSTCODE_REGEX = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi;
const PHONE_REGEX = /(?:\+44\s?\d{2,4}|\(?0\d{2,4}\)?)[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g;
const JOB_NUMBER_REGEX = /\b(?:job\s*(?:no\.?|number)?|ref(?:erence)?|booking\s*ref)\s*[:#-]?\s*([A-Z0-9-]{3,})/i;
const LABEL_LINE_REGEX = /^(name|address|postcode|post\s*code|phone|tel(?:ephone)?|mobile|contact|job\s*(?:no\.?|number)?|ref(?:erence)?|booking\s*ref)\s*[:#-]\s*/i;

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

function extractPostcode(text: string): string {
  const matches = text.match(POSTCODE_REGEX);
  if (!matches || matches.length === 0) return "";
  // Last match wins — postcodes overwhelmingly appear at the end of an
  // address, and a stray earlier match is more likely noise (e.g. a
  // reference code that happens to fit the pattern).
  return matches[matches.length - 1].toUpperCase().replace(/\s+/g, " ").trim();
}

function extractJobNumber(text: string): string {
  const match = JOB_NUMBER_REGEX.exec(text);
  return match ? match[1] : "";
}

/** Strips a label prefix ("Name:", "Address:", …) a line might carry. */
function stripLabel(line: string): string {
  return line.replace(LABEL_LINE_REGEX, "").trim();
}

/**
 * Best guess at the customer's name: the first non-empty line of the block
 * that isn't a job-number line, doesn't itself contain the postcode, and
 * isn't just a phone number.
 */
function guessName(lines: string[], postcode: string): string {
  for (const raw of lines) {
    // Checked against the raw line, before label-stripping — stripping
    // "Job Number:" off "Job Number: 10234" leaves the bare "10234", which
    // no longer matches this pattern, so the check would otherwise miss it.
    if (JOB_NUMBER_REGEX.test(raw)) continue;
    const line = stripLabel(raw);
    if (!line) continue;
    if (postcode && line.toUpperCase().includes(postcode)) continue;
    if (PHONE_REGEX.test(line) && line.replace(PHONE_REGEX, "").trim().length < 3) continue;
    PHONE_REGEX.lastIndex = 0;
    return line;
  }
  return "";
}

/** Everything that looks like the address: lines with no phone number, excluding the guessed name line. */
function guessAddress(lines: string[], name: string): string {
  const addressLines: string[] = [];
  for (const raw of lines) {
    if (JOB_NUMBER_REGEX.test(raw)) continue; // see guessName — must check before stripLabel removes the marker
    const line = stripLabel(raw);
    if (!line || line === name) continue;
    const withoutPhones = line.replace(PHONE_REGEX, "").trim();
    if (!withoutPhones) continue; // the whole line was just a phone number
    addressLines.push(withoutPhones.replace(/[,\s]+$/, ""));
  }
  return addressLines.join(", ");
}

function parseBlock(rawText: string): DraftKitJob {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const postcode = extractPostcode(rawText);
  const phoneNumbers = extractPhones(rawText);
  const jobNumber = extractJobNumber(rawText);
  const name = guessName(lines, postcode);
  const address = guessAddress(lines, name);
  return { jobNumber, customerName: name, address, postcode, phoneNumbers, rawText: rawText.trim() };
}

/**
 * Splits the pasted email into per-job blocks and parses each one.
 *
 * Paragraphs (blank-line-separated chunks) are accumulated into the current
 * block until one containing a postcode is seen, which closes that block —
 * a postcode reliably marks the end of an address. Paragraphs immediately
 * following that contain a phone number but no new postcode are folded into
 * the same block, since contact numbers are often listed just after the
 * address rather than inside it. Leftover paragraphs with no postcode at
 * the very end (signature/footer junk) are dropped rather than turned into
 * a bogus trailing job.
 */
export function parseKitEmail(rawEmailText: string): DraftKitJob[] {
  const paragraphs = rawEmailText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  // A "Job Number:" / "Ref:" line is a much stronger, unambiguous signal of
  // where one job ends and the next begins than a postcode is — postcode
  // grouping can't tell a preamble/greeting paragraph apart from the first
  // job's own text, so it ends up folded into job 1 (see the postcode-only
  // fallback below). When at least two such markers are found, use them as
  // the block boundaries instead and drop anything before the first one.
  const markerIndexes = paragraphs.map((p, i) => (JOB_NUMBER_REGEX.test(p) ? i : -1)).filter((i) => i >= 0);
  if (markerIndexes.length >= 2) {
    const blocks: string[][] = markerIndexes.map((start, i) => {
      const end = i + 1 < markerIndexes.length ? markerIndexes[i + 1] : paragraphs.length;
      return paragraphs.slice(start, end);
    });
    return blocks.map((paras) => parseBlock(paras.join("\n\n")));
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
  // Trailing paragraphs with no postcode: fold into the last real block if
  // they look like contact info (a phone number), otherwise drop them.
  if (current.length > 0 && blocks.length > 0) {
    for (const para of current) {
      if (PHONE_REGEX.test(para)) {
        blocks[blocks.length - 1].push(para);
      }
      PHONE_REGEX.lastIndex = 0;
    }
  }

  return blocks.map((paras) => parseBlock(paras.join("\n\n")));
}

export function emptyDraftJob(): DraftKitJob {
  return { jobNumber: "", customerName: "", address: "", postcode: "", phoneNumbers: [], rawText: "" };
}
