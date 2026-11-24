import { describe, expect, it } from "vitest";
import { LISTS } from "./lists";
import { guessClothesSection } from "./clothes";
import { parseTasks } from "./tasks";

describe("clothes list", () => {
  const parse = LISTS.clothes.parse;

  it("splits items and picks up clothes shops", () => {
    expect(parse("black socks, running shoes from JD and a navy jumper from Primark")).toEqual([
      { name: "Black socks", shop: null },
      { name: "Running shoes", shop: "JD" },
      { name: "Navy jumper", shop: "Primark" },
    ]);
  });

  it("moves a size into the note", () => {
    expect(parse("jeans size 32")).toEqual([{ name: "Jeans", shop: null, note: "Size 32" }]);
    expect(parse("gym shorts in large from Decathlon")).toEqual([{ name: "Gym shorts", shop: "Decathlon", note: "Size Large" }]);
    expect(parse("t-shirts in xl")).toEqual([{ name: "T-shirts", shop: null, note: "Size XL" }]);
  });

  it.each([
    ["Running shoes", "Shoes"],
    ["Black socks", "Socks & underwear"],
    ["Boxers", "Socks & underwear"],
    ["Navy jumper", "Knitwear"],
    ["Hoodie", "Knitwear"],
    ["Jeans", "Trousers & shorts"],
    ["Swim shorts", "Sportswear"],
    ["White shirts", "Tops"],
    ["Rain jacket", "Jackets & coats"],
    ["Belt", "Accessories"],
    ["Pyjamas", "Nightwear"],
    ["Something odd", "Other"],
  ])("%s -> %s", (name, section) => {
    expect(guessClothesSection(name)).toBe(section);
  });
});

describe("to-do list", () => {
  const names = (text: string) => parseTasks(text).map((t) => t.name);

  it("keeps a job with 'and' in it whole", () => {
    expect(names("pick up and drop off the parcel")).toEqual(["Pick up and drop off the parcel"]);
  });

  it("splits on pauses, then and also", () => {
    expect(names("ring the dentist, then book the MOT also pay the window cleaner")).toEqual([
      "Ring the dentist",
      "Book the MOT",
      "Pay the window cleaner",
    ]);
  });

  it("drops the chatter in front", () => {
    expect(names("I need to renew the car insurance")).toEqual(["Renew the car insurance"]);
    expect(names("remember to email Sarah please")).toEqual(["Email Sarah"]);
    expect(names("don't forget to buy a birthday card")).toEqual(["Buy a birthday card"]);
    expect(names("I've got to cut the grass")).toEqual(["Cut the grass"]);
  });

  it("returns nothing for filler alone", () => {
    expect(names("um I need to")).toEqual([]);
  });
});
