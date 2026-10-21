import { describe, expect, it } from "vitest";
import { fold, matches } from "./search";

describe("search", () => {
  it("folds accents and apostrophes", () => expect(fold("Seán O'Riordáin")).toBe("sean oriordain"));
  it("matches every word across fields", () => expect(matches("sean cork", "Seán Murphy", "Cork Council")).toBe(true));
  it("fails if any word is missing", () => expect(matches("sean dublin", "Seán Murphy", "Cork")).toBe(false));
  it("empty query matches all", () => expect(matches("  ", "anything")).toBe(true));
});
