// Accent- and case-insensitive matching, so "sean" finds "Seán" and
// "oriordan" finds "O'Riordan".
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "");
}

/** True when every word of the query appears somewhere in the haystack fields. */
export function matches(query: string, ...fields: Array<string | undefined | null>): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = fold(fields.filter(Boolean).join(" "));
  return words.every((w) => hay.includes(w));
}

export function byText<T>(get: (item: T) => string) {
  return (a: T, b: T) => fold(get(a)).localeCompare(fold(get(b)));
}
