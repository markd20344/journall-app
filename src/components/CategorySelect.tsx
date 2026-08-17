import { useState } from "react";
import type { Category } from "../types";
import { upsertCategory } from "../db/repo";
import Dropdown from "./Dropdown";

const COLOR_CHOICES = [
  "#6b7280",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
];

interface Props {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
}

export default function CategorySelect({ categories, value, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  async function handleAdd() {
    const name = newName.trim();
    if (!name) {
      setAdding(false);
      return;
    }
    const color = COLOR_CHOICES[categories.length % COLOR_CHOICES.length];
    const category = await upsertCategory(name, color);
    onChange(category.id);
    setNewName("");
    setAdding(false);
  }

  if (adding) {
    return (
      <div className="inline-add">
        <input
          autoFocus
          type="text"
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleAdd();
            } else if (e.key === "Escape") {
              setAdding(false);
              setNewName("");
            }
          }}
        />
        <button type="button" onClick={() => void handleAdd()}>
          Add
        </button>
        <button type="button" className="ghost" onClick={() => setAdding(false)}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <Dropdown
      className="category-select"
      value={value}
      onChange={(v) => {
        if (v === "__new__") {
          setAdding(true);
        } else {
          onChange(v);
        }
      }}
      options={[
        ...(categories.length === 0 ? [{ value: "", label: "No categories yet" }] : []),
        ...categories.map((c) => ({ value: c.id, label: c.name })),
        { value: "__new__", label: "+ New category…" },
      ]}
    />
  );
}
