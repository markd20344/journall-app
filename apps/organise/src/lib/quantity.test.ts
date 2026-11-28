import { describe, expect, it } from "vitest";
import { parseItems } from "./parse";
import { LISTS } from "./lists";

describe("quantities", () => {
  it("takes a spoken count and pack word off the name", () => {
    expect(parseItems("3 packets of protein wraps")).toEqual([{ name: "Protein wraps", shop: null, qty: 3 }]);
    expect(parseItems("two protein wraps from Aldi")).toEqual([{ name: "Protein wraps", shop: "Aldi", qty: 2 }]);
    expect(parseItems("a couple of tins of tuna")).toEqual([{ name: "Tuna", shop: null, qty: 2 }]);
    expect(parseItems("a dozen eggs")).toEqual([{ name: "Eggs", shop: null, qty: 12 }]);
    expect(parseItems("milk x2")).toEqual([{ name: "Milk", shop: null, qty: 2 }]);
  });

  it("leaves the count unset when none is said", () => {
    expect(parseItems("a packet of lentils")).toEqual([{ name: "Lentils", shop: null }]);
    expect(parseItems("tomatoes")).toEqual([{ name: "Tomatoes", shop: null }]);
    expect(parseItems("chopped tomatoes")).toEqual([{ name: "Chopped tomatoes", shop: null }]);
  });

  it("works in a list", () => {
    expect(parseItems("I need 3 packets of protein wraps, milk and 2 jars of jam")).toEqual([
      { name: "Protein wraps", shop: null, qty: 3 },
      { name: "Milk", shop: null },
      { name: "Jam", shop: null, qty: 2 },
    ]);
  });

  it("takes a shop said after the item, with or without 'from'", () => {
    expect(parseItems("tuna times 2 Aldi")).toEqual([{ name: "Tuna", shop: "Aldi", qty: 2 }]);
    expect(parseItems("protein powder times 1 Tesco")).toEqual([{ name: "Protein powder", shop: "Tesco", qty: 1 }]);
    expect(parseItems("tuna Aldi times 2")).toEqual([{ name: "Tuna", shop: "Aldi", qty: 2 }]);
    expect(parseItems("tuna from Aldi x 2")).toEqual([{ name: "Tuna", shop: "Aldi", qty: 2 }]);
    expect(parseItems("tuna × 2 Aldi, milk Tesco")).toEqual([
      { name: "Tuna", shop: "Aldi", qty: 2 },
      { name: "Milk", shop: "Tesco" },
    ]);
  });

  it("doesn't take shop names that are ordinary words without 'from'", () => {
    expect(LISTS.clothes.parse("running boots")).toEqual([{ name: "Running boots", shop: null }]);
    expect(LISTS.clothes.parse("running boots from Boots")).toEqual([{ name: "Running boots", shop: "Boots" }]);
  });

  it("works for clothes", () => {
    expect(LISTS.clothes.parse("3 pairs of black socks")).toEqual([{ name: "Black socks", shop: null, qty: 3 }]);
  });
});
