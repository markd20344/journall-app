/** Lower-case, strip accents and apostrophes, squash spaces. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Duplicate-check key: "Eggs", "egg" and "eggs " all match. Only the last
 * word is de-pluralised, and only crudely — good enough to stop "tomato" and
 * "tomatoes" sitting on the list twice.
 */
export function itemKey(name: string): string {
  const words = fold(name).replace(/[^a-z0-9& ]/g, "").split(" ").filter(Boolean);
  if (words.length === 0) return "";
  const last = words[words.length - 1];
  words[words.length - 1] = last.length > 3 ? last.replace(/(oes|ies|es|s)$/, (m) => (m === "ies" ? "y" : m === "oes" ? "o" : m === "es" && !/(ch|sh|ss|x)es$/.test(last) ? "e" : "")) : last;
  return words.join(" ");
}

export function capitaliseFirst(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
