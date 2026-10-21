import { describe, expect, it } from "vitest";
import { initials, personName, telHref, websiteHref, websiteLabel, mapsHref } from "./format";

describe("personName", () => {
  it("joins first and last", () => expect(personName({ firstName: "Seán", lastName: "Ó Riordáin", nickname: "" })).toBe("Seán Ó Riordáin"));
  it("falls back to nickname", () => expect(personName({ firstName: " ", lastName: "", nickname: "Gran" })).toBe("Gran"));
  it("never returns empty", () => expect(personName({ firstName: "", lastName: "", nickname: "" })).toBe("(no name)"));
});

describe("initials", () => {
  it("first + last", () => expect(initials("Mary Kate O'Brien")).toBe("MO"));
  it("single word", () => expect(initials("Gran")).toBe("G"));
});

describe("telHref", () => {
  it("strips spaces and punctuation", () => expect(telHref("07700 900-123")).toBe("tel:07700900123"));
  it("keeps international plus", () => expect(telHref("+353 (0)21 123 4567")).toBe("tel:+3530211234567"));
});

describe("website", () => {
  it("adds https when missing", () => expect(websiteHref("acme.ie")).toBe("https://acme.ie"));
  it("keeps an existing scheme", () => expect(websiteHref("http://acme.ie")).toBe("http://acme.ie"));
  it("empty stays empty", () => expect(websiteHref("  ")).toBe(""));
  it("short label", () => expect(websiteLabel("https://www.acme.ie/")).toBe("acme.ie"));
});

describe("mapsHref", () => {
  it("joins multi-line address and postcode", () =>
    expect(mapsHref("1 Main St\nCork", "T12 X")).toBe("https://maps.google.com/?q=1%20Main%20St%2C%20Cork%2C%20T12%20X"));
});
