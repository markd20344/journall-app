// Sections for the clothes list, in roughly the order you'd go round a shop
// or a wardrobe. First matching rule wins, so "running shoes" is Shoes, not
// Sportswear, and "swim shorts" is Sportswear, not Trousers & shorts.
import { fold } from "./text";

export const CLOTHES_SECTIONS = [
  "Tops",
  "Trousers & shorts",
  "Jackets & coats",
  "Knitwear",
  "Shoes",
  "Socks & underwear",
  "Sportswear",
  "Nightwear",
  "Accessories",
  "Other",
] as const;

type Section = (typeof CLOTHES_SECTIONS)[number];

const RULES: [Section, string[]][] = [
  ["Shoes", ["shoes", "shoe", "trainers", "trainer", "boots", "boot", "sandals", "sliders", "slippers", "flip flops", "loafers", "brogues", "heels", "wellies", "insoles", "laces", "shoelaces"]],
  ["Socks & underwear", ["socks", "sock", "boxers", "boxer shorts", "pants", "briefs", "trunks", "underwear", "bra", "bras", "knickers", "tights", "vest", "vests", "thermals"]],
  ["Nightwear", ["pyjamas", "pajamas", "pjs", "dressing gown", "nightie", "nightdress", "robe", "loungewear", "lounge pants"]],
  ["Sportswear", ["gym", "running", "sports bra", "leggings", "joggers", "tracksuit", "track suit", "swim shorts", "swimming", "swimsuit", "trunks", "cycling", "base layer", "football", "rugby", "compression"]],
  ["Jackets & coats", ["jacket", "jackets", "coat", "coats", "parka", "gilet", "blazer", "raincoat", "waterproof", "fleece", "puffer", "anorak", "mac"]],
  ["Knitwear", ["jumper", "jumpers", "sweater", "sweaters", "cardigan", "cardigans", "hoodie", "hoodies", "sweatshirt", "sweatshirts", "knit", "quarter zip", "half zip"]],
  ["Trousers & shorts", ["trousers", "jeans", "chinos", "shorts", "cargos", "cargo pants", "skirt", "skirts", "trackies", "suit trousers"]],
  ["Tops", ["shirt", "shirts", "t-shirt", "t-shirts", "t shirt", "t shirts", "tshirt", "tshirts", "tee", "tees", "polo", "polos", "top", "tops", "blouse", "blouses", "vest top", "dress", "dresses"]],
  ["Accessories", ["belt", "belts", "hat", "hats", "cap", "caps", "beanie", "scarf", "scarves", "gloves", "tie", "ties", "watch", "wallet", "bag", "backpack", "sunglasses", "umbrella", "cufflinks", "handkerchief", "hanger", "hangers"]],
];

const COMPILED = RULES.map(([section, words]) => [section, new RegExp(`\\b(?:${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`)] as const);

export function guessClothesSection(name: string): Section {
  const f = fold(name);
  for (const [section, re] of COMPILED) if (re.test(f)) return section;
  return "Other";
}
