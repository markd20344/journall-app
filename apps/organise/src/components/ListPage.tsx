import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { showToast } from "@journall/shared/lib/toast";
import { listOf, qtyOf, type ShoppingItem } from "../types";
import type { ListConfig } from "../lib/lists";
import { addItems, clearGot, forget, setQty, setStatus, toggleGot, unforget, updateItem } from "../data/repo";
import { fold } from "../lib/text";
import { listAsText } from "../lib/share";
import { useVoice, voiceSupported } from "../lib/voice";
import EditSheet from "./EditSheet";

const ALL = "";

function names(items: { name: string }[]): string {
  const list = items.map((i) => i.name);
  if (list.length <= 3) return list.join(", ");
  return `${list.slice(0, 3).join(", ")} and ${list.length - 3} more`;
}

function shopsOf(items: ShoppingItem[]): string[] {
  return Array.from(new Set(items.map((i) => i.shop).filter((s): s is string => Boolean(s)))).sort();
}

interface Props {
  config: ListConfig;
  /** Every item in the store; this page shows only its own list's. */
  allItems: ShoppingItem[];
  /** Start listening as soon as the page opens (home-screen shortcut). */
  autoListen: boolean;
}

export default function ListPage({ config, allItems, autoListen }: Props) {
  const [text, setText] = useState("");
  const [chosenShop, setShopFilter] = useState(ALL);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [showAllUsuals, setShowAllUsuals] = useState(false);
  const isTodo = config.sections.length === 0;

  const addAndConfirm = useCallback(
    (spoken: string): boolean => {
      const parsed = config.parse(spoken);
      if (parsed.length === 0) {
        showToast(`Didn't catch any ${isTodo ? "jobs" : "items"} — try again`);
        return false;
      }
      const { added, undo } = addItems(config.kind, parsed);
      if (added.length === 0) return false;
      showToast(`Added ${names(added)}`, { action: { label: "Undo", onClick: undo }, durationMs: 5000 });
      return true;
    },
    [config, isTodo],
  );

  const onHeard = useCallback((transcript: string) => void addAndConfirm(transcript), [addAndConfirm]);
  const voice = useVoice(onHeard);
  const canTalk = voiceSupported();

  useEffect(() => {
    // Where the browser allows it without a tap (it may not; then the mic button is there).
    if (autoListen && canTalk) voice.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (voice.error) showToast(voice.error, { durationMs: 5000 });
  }, [voice.error]);

  const items = useMemo(() => allItems.filter((i) => listOf(i) === config.kind), [allItems, config.kind]);
  const needed = useMemo(
    () =>
      items
        .filter((i) => i.status === "needed")
        // Jobs stay in the order they were added; shopping is alphabetical within each section.
        .sort((a, b) => (isTodo ? a.addedAt.localeCompare(b.addedAt) : a.name.localeCompare(b.name))),
    [items, isTodo],
  );
  const got = useMemo(() => items.filter((i) => i.status === "got").sort((a, b) => (b.gotAt ?? "").localeCompare(a.gotAt ?? "")), [items]);
  const shops = useMemo(() => shopsOf(items), [items]);
  const neededShops = useMemo(() => (config.usesShops ? shopsOf(needed) : []), [needed, config.usesShops]);

  // Once the last thing from a shop is ticked off, go back to everything.
  const shopFilter = neededShops.includes(chosenShop) ? chosenShop : ALL;
  // Items with no shop show under every shop: "eggs" can come from anywhere.
  const visible = shopFilter === ALL ? needed : needed.filter((i) => !i.shop || i.shop === shopFilter);

  const typed = fold(text);
  const usuals = useMemo(
    () =>
      config.againLabel
        ? items.filter((i) => i.status === "off").sort((a, b) => (b.timesAdded ?? 0) - (a.timesAdded ?? 0) || b.updatedAt.localeCompare(a.updatedAt))
        : [],
    [items, config.againLabel],
  );
  const usualsShown = typed ? usuals.filter((i) => fold(i.name).includes(typed)) : usuals;
  const usualsLimit = showAllUsuals || typed ? usualsShown.length : 18;

  function submitTyped(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    if (addAndConfirm(text)) setText("");
  }

  async function share() {
    const body = listAsText(config, visible);
    try {
      if (navigator.share) {
        await navigator.share({ text: body });
        return;
      }
      await navigator.clipboard.writeText(body);
      showToast("List copied");
    } catch (err) {
      // Closing the share sheet isn't an error worth showing.
      if (err instanceof Error && err.name === "AbortError") return;
      showToast("Couldn't share the list");
    }
  }

  function clearDone() {
    const ids = clearGot(config.kind);
    showToast(`Cleared ${ids.length}`, {
      action: { label: "Undo", onClick: () => ids.forEach((id) => setStatus(id, "got")) },
      durationMs: 5000,
    });
  }

  // Items whose section isn't one of this list's (e.g. edited by hand) go under the last, "Other".
  const sectionOf = (i: ShoppingItem) => (config.sections.includes(i.aisle) ? i.aisle : config.sections[config.sections.length - 1]);
  const groups: [string | null, ShoppingItem[]][] = isTodo
    ? [[null, visible]]
    : config.sections.map((s) => [s, visible.filter((i) => sectionOf(i) === s)] as [string, ShoppingItem[]]);

  return (
    <div className="list-page">
      <header className="top">
        <h1>
          {config.label} <span className="count">{needed.length > 0 ? needed.length : ""}</span>
        </h1>
        {needed.length > 0 && (
          <button type="button" className="ghost small" onClick={() => void share()}>
            Send list
          </button>
        )}
      </header>

      {neededShops.length > 0 && (
        <nav className="chips shop-filter" aria-label="Filter by shop">
          {[ALL, ...neededShops].map((s) => (
            <button key={s || "all"} type="button" className={`chip ${shopFilter === s ? "on" : ""}`} aria-pressed={shopFilter === s} onClick={() => setShopFilter(s)}>
              {s || "All shops"}
            </button>
          ))}
        </nav>
      )}

      {needed.length === 0 && got.length === 0 && (
        <div className="empty">
          <p className="empty-title">Nothing on the list.</p>
          <p>
            {canTalk ? "Tap the mic and say it, like" : "Type it in, like"} <em>"{config.example}"</em>.
          </p>
        </div>
      )}

      {groups.map(([section, inSection]) => {
        if (inSection.length === 0) return null;
        return (
          <section key={section ?? "all"} className="aisle" aria-label={section ?? config.label}>
            {section && <h2>{section}</h2>}
            <ul>
              {inSection.map((item) => (
                <ItemRow key={item.id} item={item} config={config} onToggle={() => toggleGot(item.id)} onEdit={() => setEditing(item)} />
              ))}
            </ul>
          </section>
        );
      })}

      {got.length > 0 && (
        <section className="aisle basket" aria-label={config.doneLabel}>
          <div className="section-head">
            <h2>
              {config.doneLabel} ({got.length})
            </h2>
            <button type="button" className="ghost small" onClick={clearDone}>
              Clear
            </button>
          </div>
          <ul>
            {got.map((item) => (
              <ItemRow key={item.id} item={item} config={config} onToggle={() => toggleGot(item.id)} onEdit={() => setEditing(item)} />
            ))}
          </ul>
        </section>
      )}

      {config.againLabel && usualsShown.length > 0 && (
        <section className="usuals" aria-label={config.againLabel}>
          <h2>{typed ? "Matching items you've bought before" : config.againLabel}</h2>
          <div className="chips wrap">
            {usualsShown.slice(0, usualsLimit).map((item) => (
              <button
                key={item.id}
                type="button"
                className="chip add-chip"
                aria-label={`Add ${item.name}`}
                onClick={() => {
                  addAndConfirm(item.name);
                  setText("");
                }}
              >
                + {item.name}
              </button>
            ))}
            {usualsShown.length > usualsLimit && (
              <button type="button" className="chip ghost-chip" onClick={() => setShowAllUsuals(true)}>
                {usualsShown.length - usualsLimit} more…
              </button>
            )}
          </div>
        </section>
      )}

      {voice.listening && (
        <div className="listening" role="status" aria-live="polite">
          <p className="listening-label">
            <span className="pulse" aria-hidden="true" /> Listening for {config.label.toLowerCase()}…
          </p>
          <p className="live-text">{voice.transcript || "Say it — pause or tap Done when you've finished."}</p>
          {voice.transcript && (
            <div className="chips wrap preview">
              {config.parse(voice.transcript).map((p, i) => (
                <span key={i} className="chip on">
                  {[p.qty && p.qty > 1 ? `${p.qty} × ${p.name}` : p.name, p.note, p.shop].filter(Boolean).join(" · ")}
                </span>
              ))}
            </div>
          )}
          <div className="listening-actions">
            <button type="button" onClick={voice.cancel}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={voice.stop}>
              Done
            </button>
          </div>
        </div>
      )}

      <form className="add-bar" onSubmit={submitTyped}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={canTalk ? "Type, or tap the mic…" : `Add to ${config.label}…`}
          aria-label={`Add to ${config.label}`}
          enterKeyHint="done"
          autoComplete="off"
          autoCapitalize="sentences"
        />
        {text.trim() ? (
          <button type="submit" className="primary add-btn">
            Add
          </button>
        ) : (
          canTalk && (
            <button
              type="button"
              className={`mic ${voice.listening ? "on" : ""}`}
              aria-label={voice.listening ? "Stop listening" : `Speak to add to ${config.label}`}
              onClick={voice.listening ? voice.stop : voice.start}
            >
              <MicIcon />
            </button>
          )
        )}
      </form>

      {editing && (
        <EditSheet
          item={editing}
          config={config}
          shops={shops}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            updateItem(editing.id, patch);
            setEditing(null);
          }}
          onRemove={() => {
            const id = editing.id;
            const before = editing.status;
            setStatus(id, "off");
            setEditing(null);
            showToast(`Took ${editing.name} off the list`, { action: { label: "Undo", onClick: () => setStatus(id, before) } });
          }}
          onForget={() => {
            const id = editing.id;
            forget(id);
            setEditing(null);
            showToast(`Deleted ${editing.name}`, { action: { label: "Undo", onClick: () => unforget(id) }, durationMs: 5000 });
          }}
        />
      )}
    </div>
  );
}

function ItemRow({ item, config, onToggle, onEdit }: { item: ShoppingItem; config: ListConfig; onToggle: () => void; onEdit: () => void }) {
  const done = item.status === "got";
  const qty = qtyOf(item);
  // On lists with shops the shop shows in its own column, so only the note goes under the name.
  const meta = config.usesShops ? item.note : [item.shop, item.note].filter(Boolean).join(" · ");
  return (
    <li className={`item ${done ? "done" : ""}`}>
      <button type="button" className="item-main" role="checkbox" aria-checked={done} aria-label={qty > 1 ? `${item.name}, ${qty}` : item.name} onClick={onToggle}>
        <span className="tick" aria-hidden="true">
          {done ? "✓" : ""}
        </span>
        <span className="item-text">
          <span className="item-name">{item.name}</span>
          {meta && <span className="item-meta">{meta}</span>}
        </span>
      </button>
      {config.usesQty &&
        (done ? (
          qty > 1 && <span className="qty-done">×{qty}</span>
        ) : (
          <span className="qty" role="group" aria-label={`How many ${item.name}`}>
            <button type="button" aria-label={`One fewer ${item.name}`} disabled={qty <= 1} onClick={() => setQty(item.id, qty - 1)}>
              −
            </button>
            <output className={qty > 1 ? "more" : ""} aria-live="polite">
              {qty}
            </output>
            <button type="button" aria-label={`One more ${item.name}`} onClick={() => setQty(item.id, qty + 1)}>
              +
            </button>
          </span>
        ))}
      {config.usesShops ? (
        // The shop doubles as the edit button, so the row doesn't need a ⋯ as well.
        <button type="button" className={`shop-tag ${item.shop ? "" : "none"}`} aria-label={`${item.shop ?? "No shop"}: change shop or edit ${item.name}`} onClick={onEdit}>
          {item.shop ?? "Shop"}
        </button>
      ) : (
        <button type="button" className="edit" aria-label={`Edit ${item.name}`} onClick={onEdit}>
          ⋯
        </button>
      )}
    </li>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="currentColor">
      <path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 1 0-7 0v6A3.5 3.5 0 0 0 12 15Z" />
      <path d="M18.5 11a1 1 0 1 0-2 0 4.5 4.5 0 0 1-9 0 1 1 0 1 0-2 0 6.5 6.5 0 0 0 5.5 6.42V20H8.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2H13v-2.58A6.5 6.5 0 0 0 18.5 11Z" />
    </svg>
  );
}
