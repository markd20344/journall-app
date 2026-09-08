import type { ItemKind } from "../types";
import { itemKindMeta } from "../lib/itemKinds";

interface Props {
  kind: ItemKind;
  short?: boolean;
}

export default function ItemKindBadge({ kind, short }: Props) {
  const meta = itemKindMeta(kind);
  return (
    <span className="kind-badge" style={{ background: meta.color }}>
      {short ? meta.shortLabel : meta.label}
    </span>
  );
}
