// One doc per item at users/{uid}/shoppingItems/{id}, for all three lists.
// The collection keeps its original name (it started as the food list), and
// docs written before Clothes and To-do existed have no `list` field: they
// are food. An item keeps its doc after it's done, so "Buy again" can offer
// it back with one tap and saying "eggs" twice doesn't duplicate it.
export type ListKind = "food" | "clothes" | "todo";

/** needed = on the list; got = ticked off; off = done and cleared. */
export type ItemStatus = "needed" | "got" | "off";

export interface ShoppingItem {
  id: string;
  /** Missing on early food items. Read it through listOf(). */
  list?: ListKind;
  name: string;
  /** Lower-case, accent-free, singular-ish: what duplicate checks compare. */
  key: string;
  shop: string | null;
  /** Section within the list: an aisle for food, a kind of clothing for clothes. Unused for to-dos. */
  aisle: string;
  note: string;
  /** How many to get. Missing on items saved before quantities existed: read it through qtyOf(). */
  qty?: number;
  status: ItemStatus;
  /** How often it's gone on the list; orders the "Buy again" suggestions. */
  timesAdded: number;
  addedAt: string;
  gotAt: string | null;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export function listOf(item: ShoppingItem): ListKind {
  return item.list ?? "food";
}

export function qtyOf(item: ShoppingItem): number {
  return item.qty && item.qty > 0 ? item.qty : 1;
}
