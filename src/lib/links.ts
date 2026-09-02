// Pulls http(s) URLs out of free text (e.g. a pasted YouTube link in a
// task's notes) so they can be rendered as clickable links — a plain
// <textarea> can't contain a live <a>, so the app has to detect them itself
// and surface them separately rather than relying on the browser.
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;
// Trailing punctuation is almost never part of the URL itself (end of
// sentence, comma before the next clause, a closing bracket around it).
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? [];
  const cleaned = matches.map((url) => url.replace(TRAILING_PUNCTUATION, ""));
  return Array.from(new Set(cleaned));
}

/** A short, friendly label for a detected link — its hostname, not the full URL. */
export function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
