import { describe, expect, it } from "vitest";
import { splitName } from "./blanks";

describe("splitName", () => {
  it("first + last", () => expect(splitName("Mary Kate O'Brien")).toEqual({ firstName: "Mary Kate", lastName: "O'Brien" }));
  it("single word", () => expect(splitName("  Gran ")).toEqual({ firstName: "Gran", lastName: "" }));
  it("empty", () => expect(splitName("")).toEqual({ firstName: "", lastName: "" }));
});
