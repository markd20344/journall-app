import { AISLES, type ShoppingItem } from "../types";

/** Plain-text list grouped by aisle, for WhatsApp, Notes or a text. */
export function listAsText(items: ShoppingItem[]): string {
  const lines: string[] = ["Shopping list"];
  for (const aisle of AISLES) {
    const inAisle = items.filter((i) => i.aisle === aisle);
    if (inAisle.length === 0) continue;
    lines.push("", aisle);
    for (const i of inAisle) {
      const extra = [i.shop, i.note].filter(Boolean).join(", ");
      lines.push(`- ${i.name}${extra ? ` (${extra})` : ""}`);
    }
  }
  return lines.join("\n");
}
