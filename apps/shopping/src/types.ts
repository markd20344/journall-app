// One doc per product at users/{uid}/shoppingItems/{id}. A product keeps its
// doc after it's bought, so "Buy again" can offer it back with one tap and
// saying "eggs" a second time reuses the same record instead of duplicating.
export const AISLES = [
  "Fruit & veg",
  "Bread & bakery",
  "Meat & fish",
  "Dairy & eggs",
  "Cupboard",
  "Herbs & spices",
  "Frozen",
  "Drinks",
  "Snacks",
  "Household",
  "Toiletries",
  "Other",
] as const;

export type Aisle = (typeof AISLES)[number];

/** needed = on the list; got = ticked off this trip; off = bought and cleared. */
export type ItemStatus = "needed" | "got" | "off";

export interface ShoppingItem {
  id: string;
  name: string;
  /** Lower-case, accent-free, singular-ish: what duplicate checks compare. */
  key: string;
  shop: string | null;
  aisle: Aisle;
  note: string;
  status: ItemStatus;
  /** How often it's gone on the list; orders the "Buy again" suggestions. */
  timesAdded: number;
  addedAt: string;
  gotAt: string | null;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}
