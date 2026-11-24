import { describe, expect, it } from "vitest";
import { parseItems } from "./parse";
import { guessAisle } from "./aisles";
import { itemKey } from "./text";
import { joinResults } from "./voice";

const names = (text: string) => parseItems(text).map((i) => i.name);

describe("parseItems", () => {
  it("takes a single item", () => {
    expect(parseItems("eggs")).toEqual([{ name: "Eggs", shop: null }]);
  });

  it("drops the chatter around items", () => {
    expect(names("I'm out of eggs")).toEqual(["Eggs"]);
    expect(names("we've run out of dishwasher tablets")).toEqual(["Dishwasher tablets"]);
    expect(names("running low on white onions")).toEqual(["White onions"]);
    expect(names("I need to buy some bleach please")).toEqual(["Bleach"]);
    expect(names("there's no milk")).toEqual(["Milk"]);
    expect(names("add jam to the list")).toEqual(["Jam"]);
    expect(names("any herbs that I need to order")).toEqual(["Herbs"]);
  });

  it("splits a list on commas, and, also, then", () => {
    expect(names("carrots, lemons and limes also greek yogurt then protein wraps")).toEqual([
      "Carrots",
      "Lemons",
      "Limes",
      "Greek yogurt",
      "Protein wraps",
    ]);
    expect(names("salt and pepper")).toEqual(["Salt", "Pepper"]);
  });

  it("splits obvious items said with no pause between them", () => {
    expect(names("carrots lemons and limes")).toEqual(["Carrots", "Lemons", "Limes"]);
    expect(names("eggs milk")).toEqual(["Eggs", "Milk"]);
    // ...but not phrases that are one item.
    expect(names("white onions")).toEqual(["White onions"]);
    expect(names("greek yogurt")).toEqual(["Greek yogurt"]);
    expect(names("lentil crisps")).toEqual(["Lentil crisps"]);
    expect(names("garlic bread")).toEqual(["Garlic bread"]);
  });

  it("picks up a shop at the end of an item", () => {
    expect(parseItems("there's no bread so I need protein bread from Aldi")).toEqual([
      { name: "Bread", shop: null },
      { name: "Protein bread", shop: "Aldi" },
    ]);
    expect(parseItems("protein bread from Aldi and eggs")).toEqual([
      { name: "Protein bread", shop: "Aldi" },
      { name: "Eggs", shop: null },
    ]);
    expect(parseItems("mozzarella at Lidl")).toEqual([{ name: "Mozzarella", shop: "Lidl" }]);
    expect(parseItems("protein powder from my protein")).toEqual([{ name: "Protein powder", shop: "Myprotein" }]);
  });

  it("applies a leading shop to everything said", () => {
    expect(parseItems("from Tesco I need tuna and lentils")).toEqual([
      { name: "Tuna", shop: "Tesco" },
      { name: "Lentils", shop: "Tesco" },
    ]);
  });

  it("keeps shop names with 'and' in them whole", () => {
    expect(parseItems("sandwiches from marks and spencer")).toEqual([{ name: "Sandwiches", shop: "M&S" }]);
  });

  it("doesn't mistake words for shops", () => {
    expect(parseItems("little gem lettuce")).toEqual([{ name: "Little gem lettuce", shop: null }]);
  });

  it("returns nothing for filler alone", () => {
    expect(parseItems("um I need")).toEqual([]);
    expect(parseItems("   ")).toEqual([]);
  });
});

describe("guessAisle", () => {
  it.each([
    ["Protein bread", "Bread & bakery"],
    ["Eggs", "Dairy & eggs"],
    ["White onions", "Fruit & veg"],
    ["Greek yogurt", "Dairy & eggs"],
    ["Mozzarella cheese", "Dairy & eggs"],
    ["Parmesan", "Dairy & eggs"],
    ["Tomatoes", "Fruit & veg"],
    ["Chopped tomatoes", "Cupboard"],
    ["Lentil crisps", "Snacks"],
    ["Packet of lentils", "Cupboard"],
    ["Summer fruits juice", "Drinks"],
    ["Soy sauce", "Cupboard"],
    ["Salt", "Herbs & spices"],
    ["Coconut oil", "Cupboard"],
    ["Tins of tuna", "Cupboard"],
    ["Protein powder", "Cupboard"],
    ["Peanut butter", "Cupboard"],
    ["Bleach", "Household"],
    ["Dishwasher tablets", "Household"],
    ["Something odd", "Other"],
  ])("%s -> %s", (name, aisle) => {
    expect(guessAisle(name)).toBe(aisle);
  });
});

describe("itemKey", () => {
  it("treats plurals, case and accents as the same item", () => {
    expect(itemKey("Eggs")).toBe(itemKey("egg"));
    expect(itemKey("Tomatoes")).toBe(itemKey("tomato"));
    expect(itemKey("Crème fraîche")).toBe(itemKey("creme fraiche"));
    expect(itemKey("Cherries")).toBe(itemKey("cherry"));
    expect(itemKey("Lemons")).not.toBe(itemKey("Limes"));
  });
});

describe("joinResults", () => {
  it("joins separate pauses with commas", () => {
    expect(joinResults(["eggs", " milk", " bread"])).toBe("eggs, milk, bread");
  });
  it("doesn't double up repeated results", () => {
    expect(joinResults(["eggs", "eggs and milk", "eggs and milk and bread"])).toBe("eggs and milk and bread");
  });
});
