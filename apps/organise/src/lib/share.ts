import type { ShoppingItem } from "../types";
import type { ListConfig } from "./lists";

/** Plain-text list grouped by section, for WhatsApp, Notes or a text. */
export function listAsText(config: ListConfig, items: ShoppingItem[]): string {
  const title = config.kind === "todo" ? "To-do" : `${config.label} list`;
  const line = (i: ShoppingItem) => {
    const extra = [i.shop, i.note].filter(Boolean).join(", ");
    return `- ${i.name}${extra ? ` (${extra})` : ""}`;
  };
  if (config.sections.length === 0) return [title, "", ...items.map(line)].join("\n");
  const lines: string[] = [title];
  for (const section of config.sections) {
    const inSection = items.filter((i) => (config.sections.includes(i.aisle) ? i.aisle : "Other") === section);
    if (inSection.length === 0) continue;
    lines.push("", section, ...inSection.map(line));
  }
  return lines.join("\n");
}
