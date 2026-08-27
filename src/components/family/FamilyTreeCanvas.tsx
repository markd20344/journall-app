import { useMemo, useState } from "react";
import calcTree from "relatives-tree";
import type { ExtNode } from "relatives-tree/lib/types";
import type { Person, Relationship } from "../../types/family";
import { buildFamilyTreeNodes } from "../../family/treeLayout";
import { fullName, lifespan } from "../../family/personDisplay";

const CARD_WIDTH = 188;
const CARD_HEIGHT = 92;
const HALF_W = CARD_WIDTH / 2;
const HALF_H = CARD_HEIGHT / 2;

interface Props {
  people: Person[];
  relationships: Relationship[];
  rootId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRecenter: (id: string) => void;
  mediaUrlFor: (person: Person) => string | null;
}

export default function FamilyTreeCanvas({ people, relationships, rootId, selectedId, onSelect, onRecenter, mediaUrlFor }: Props) {
  const [zoom, setZoom] = useState(1);
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const data = useMemo(() => {
    const nodes = buildFamilyTreeNodes(people, relationships);
    if (!nodes.some((n) => n.id === rootId)) return null;
    try {
      return calcTree(nodes, { rootId });
    } catch (err) {
      console.error("Failed to lay out family tree", err);
      return null;
    }
  }, [people, relationships, rootId]);

  if (!data) {
    return <p className="empty-hint">Nobody to show yet — add a person to get started.</p>;
  }

  return (
    <div className="family-tree-viewport">
      <div className="family-tree-zoom-controls">
        <button type="button" className="ghost" onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}>
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" className="ghost" onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}>
          +
        </button>
      </div>
      <div className="family-tree-scroll">
        <div
          className="family-tree-canvas"
          style={{
            width: data.canvas.width * HALF_W,
            height: data.canvas.height * HALF_H,
            transform: `scale(${zoom})`,
          }}
        >
          {data.connectors.map(([x1, y1, x2, y2], idx) => (
            <i
              key={idx}
              className="family-tree-connector"
              style={{
                width: Math.max(1, (x2 - x1) * HALF_W + 1),
                height: Math.max(1, (y2 - y1) * HALF_H + 1),
                transform: `translate(${x1 * HALF_W}px, ${y1 * HALF_H}px)`,
              }}
            />
          ))}
          {data.nodes.map((node: ExtNode) => {
            const person = peopleById.get(node.id);
            if (!person) return null;
            const photoUrl = mediaUrlFor(person);
            const isRoot = node.id === rootId;
            const isSelected = node.id === selectedId;
            return (
              <button
                key={node.id}
                type="button"
                className={`family-tree-node gender-${person.gender} ${isRoot ? "is-root" : ""} ${isSelected ? "is-selected" : ""}`}
                style={{
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                  transform: `translate(${node.left * HALF_W}px, ${node.top * HALF_H}px)`,
                }}
                onClick={() => onSelect(node.id)}
                onDoubleClick={() => onRecenter(node.id)}
                title="Click to view, double-click to re-center the tree here"
              >
                <span className="family-tree-node-photo">
                  {photoUrl ? <img src={photoUrl} alt="" /> : <span className="family-tree-node-initial">{person.firstName.charAt(0) || "?"}</span>}
                </span>
                <span className="family-tree-node-text">
                  <span className="family-tree-node-name">{fullName(person)}</span>
                  <span className="family-tree-node-years">{lifespan(person)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
