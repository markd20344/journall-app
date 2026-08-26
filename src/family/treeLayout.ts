// Converts our People + Relationships into the Node[] shape relatives-tree
// expects for layout, deriving siblings from shared parents on the fly (per
// the data model — siblings are never stored, only parent-child and spouse
// links are).
// relatives-tree's Gender/RelType are TS const enums declared ambiently in
// its .d.ts — importing them as runtime values doesn't play well with this
// project's esbuild-based isolated-module transpilation, and the library's
// compiled JS confirms each member's runtime value is just its own name as
// a string anyway ("male", "blood", "married", ...). So nodes are built as
// plain string-keyed objects and cast to TreeNode at the boundary instead.
import type { Node as TreeNode } from "relatives-tree/lib/types";
import type { ParentChildSubtype, Person, Relationship } from "../types/family";

type PlainGender = "male" | "female";
type PlainRelType = "blood" | "married" | "divorced" | "adopted" | "half";

function treeGenderOf(gender: Person["gender"]): PlainGender {
  // relatives-tree only models a binary gender for layout purposes (it
  // affects which side of a couple a spouse renders on) — "unknown" has to
  // pick a side; this doesn't affect what's shown on the person's own card.
  return gender === "female" ? "female" : "male";
}

function parentChildRelType(subtype: ParentChildSubtype | null): PlainRelType {
  if (subtype === "adopted") return "adopted";
  if (subtype === "step") return "married";
  return "blood";
}

export function buildFamilyTreeNodes(people: Person[], relationships: Relationship[]): TreeNode[] {
  const parentLinks = relationships.filter((r) => r.type === "parent-child");
  const spouseLinks = relationships.filter((r) => r.type === "spouse");

  const parentsOf = new Map<string, Set<string>>();
  for (const link of parentLinks) {
    if (!parentsOf.has(link.personB)) parentsOf.set(link.personB, new Set());
    parentsOf.get(link.personB)!.add(link.personA);
  }

  const nodes = people.map((person) => {
    const parents = parentLinks
      .filter((r) => r.personB === person.id)
      .map((r) => ({ id: r.personA, type: parentChildRelType(r.subtype as ParentChildSubtype | null) }));

    const children = parentLinks
      .filter((r) => r.personA === person.id)
      .map((r) => ({ id: r.personB, type: parentChildRelType(r.subtype as ParentChildSubtype | null) }));

    const spouses = spouseLinks
      .filter((r) => r.personA === person.id || r.personB === person.id)
      .map((r) => ({
        id: r.personA === person.id ? r.personB : r.personA,
        type: (r.endReason === "divorced" ? "divorced" : "married") as PlainRelType,
      }));

    const myParents = parentsOf.get(person.id) ?? new Set<string>();
    const siblings: Array<{ id: string; type: PlainRelType }> = [];
    if (myParents.size > 0) {
      for (const other of people) {
        if (other.id === person.id) continue;
        const otherParents = parentsOf.get(other.id) ?? new Set<string>();
        const shared = [...myParents].filter((p) => otherParents.has(p));
        if (shared.length === 0) continue;
        const sameSet = shared.length === myParents.size && shared.length === otherParents.size;
        siblings.push({ id: other.id, type: sameSet ? "blood" : "half" });
      }
    }

    return {
      id: person.id,
      gender: treeGenderOf(person.gender),
      parents,
      children,
      siblings,
      spouses,
    };
  });

  return nodes as unknown as TreeNode[];
}

/** A reasonable default focal person when first opening the tree: the earliest-added person with the most direct connections. */
export function pickDefaultRootId(people: Person[], relationships: Relationship[]): string | null {
  if (people.length === 0) return null;
  const connectionCount = new Map<string, number>();
  for (const r of relationships) {
    connectionCount.set(r.personA, (connectionCount.get(r.personA) ?? 0) + 1);
    connectionCount.set(r.personB, (connectionCount.get(r.personB) ?? 0) + 1);
  }
  const sorted = [...people].sort((a, b) => {
    const diff = (connectionCount.get(b.id) ?? 0) - (connectionCount.get(a.id) ?? 0);
    return diff !== 0 ? diff : a.createdAt.localeCompare(b.createdAt);
  });
  return sorted[0].id;
}
