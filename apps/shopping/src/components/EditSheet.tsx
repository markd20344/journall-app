import { useEffect, useRef, useState } from "react";
import { AISLES, type Aisle, type ShoppingItem } from "../types";
import { KNOWN_SHOPS } from "../lib/shops";

interface Props {
  item: ShoppingItem;
  shops: string[];
  onSave: (patch: { name: string; shop: string | null; aisle: Aisle; note: string }) => void;
  onRemove: () => void;
  onForget: () => void;
  onClose: () => void;
}

export default function EditSheet({ item, shops, onSave, onRemove, onForget, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(item.name);
  const [shop, setShop] = useState(item.shop ?? "");
  const [aisle, setAisle] = useState<Aisle>(item.aisle);
  const [note, setNote] = useState(item.note ?? "");

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const shopOptions = Array.from(new Set([...shops, ...KNOWN_SHOPS]));

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={`Edit ${item.name}`}
      onClose={onClose}
      onClick={(e) => {
        // Tapping the backdrop closes it.
        if (e.target === ref.current) onClose();
      }}
    >
      <form
        method="dialog"
        className="sheet-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSave({ name: name.trim(), shop: shop.trim() || null, aisle, note: note.trim() });
        }}
      >
        <h2>Edit item</h2>
        <label>
          Item
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </label>
        <label>
          Shop
          <input value={shop} onChange={(e) => setShop(e.target.value)} list="shop-options" placeholder="Any shop" autoComplete="off" />
          <datalist id="shop-options">
            {shopOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label>
          Aisle
          <select value={aisle} onChange={(e) => setAisle(e.target.value as Aisle)}>
            {AISLES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label>
          Note
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2 packs, the 0% one" autoComplete="off" />
        </label>
        <div className="sheet-actions">
          <button type="submit" className="primary">
            Save
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className="sheet-actions secondary">
          {item.status !== "off" && (
            <button type="button" onClick={onRemove}>
              Take off the list
            </button>
          )}
          <button type="button" className="danger" onClick={onForget}>
            Forget this item
          </button>
        </div>
      </form>
    </dialog>
  );
}
