import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { showToast } from "@journall/shared/lib/toast";
import { AISLES, type ShoppingItem } from "../types";
import { useItems } from "../data/store";
import { addItems, clearGot, forget, setStatus, toggleGot, unforget, updateItem } from "../data/repo";
import { parseItems } from "../lib/parse";
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

function addAndConfirm(text: string): boolean {
  const parsed = parseItems(text);
  if (parsed.length === 0) {
    showToast("Didn't catch any items — try again");
    return false;
  }
  const { added, undo } = addItems(parsed);
  if (added.length === 0) return false;
  showToast(`Added ${names(added)}`, { action: { label: "Undo", onClick: undo }, durationMs: 5000 });
  return true;
}

export default function ListPage() {
  const { items, ready } = useItems();
  const [text, setText] = useState("");
  const [chosenShop, setShopFilter] = useState(ALL);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [showAllUsuals, setShowAllUsuals] = useState(false);

  const onHeard = useCallback((transcript: string) => {
    addAndConfirm(transcript);
  }, []);
  const voice = useVoice(onHeard);
  const canTalk = voiceSupported();

  // The home-screen shortcut opens ?voice=1: go straight to listening where
  // the browser allows it without a tap (it may not; then the button is there).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("voice") === "1" && canTalk) {
      window.history.replaceState(null, "", window.location.pathname);
      voice.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (voice.error) showToast(voice.error, { durationMs: 5000 });
  }, [voice.error]);

  const needed = useMemo(() => items.filter((i) => i.status === "needed").sort((a, b) => a.name.localeCompare(b.name)), [items]);
  const got = useMemo(() => items.filter((i) => i.status === "got").sort((a, b) => (b.gotAt ?? "").localeCompare(a.gotAt ?? "")), [items]);
  const shops = useMemo(() => Array.from(new Set(items.map((i) => i.shop).filter((s): s is string => Boolean(s)))).sort(), [items]);
  const neededShops = useMemo(() => Array.from(new Set(needed.map((i) => i.shop).filter((s): s is string => Boolean(s)))).sort(), [needed]);

  // Once the last thing from a shop is ticked off, go back to everything.
  const shopFilter = neededShops.includes(chosenShop) ? chosenShop : ALL;
  // Items with no shop show under every shop: "eggs" can come from anywhere.
  const visible = shopFilter === ALL ? needed : needed.filter((i) => !i.shop || i.shop === shopFilter);

  const typed = fold(text);
  const usuals = useMemo(
    () =>
      items
        .filter((i) => i.status === "off")
        .sort((a, b) => (b.timesAdded ?? 0) - (a.timesAdded ?? 0) || b.updatedAt.localeCompare(a.updatedAt)),
    [items],
  );
  const usualsShown = typed ? usuals.filter((i) => fold(i.name).includes(typed)) : usuals;
  const usualsLimit = showAllUsuals || typed ? usualsShown.length : 18;

  function submitTyped(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    if (addAndConfirm(text)) setText("");
  }

  async function share() {
    const body = listAsText(visible);
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

  function clearBasket() {
    const ids = clearGot();
    showToast(`Cleared ${ids.length} from the basket`, {
      action: { label: "Undo", onClick: () => ids.forEach((id) => setStatus(id, "got")) },
      durationMs: 5000,
    });
  }

  if (!ready) return <div className="app-loading">Loading your list…</div>;

  return (
    <div className="list-page">
      <header className="top">
        <h1>
          Shopping <span className="count">{needed.length > 0 ? needed.length : ""}</span>
        </h1>
        {needed.length > 0 && (
          <button type="button" className="ghost small" onClick={() => void share()}>
            Share
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
            {canTalk ? "Tap the mic and say what's run out, like" : "Type what's run out, like"} <em>"eggs, white onions and protein bread from Aldi"</em>.
          </p>
        </div>
      )}

      {AISLES.map((aisle) => {
        const inAisle = visible.filter((i) => i.aisle === aisle);
        if (inAisle.length === 0) return null;
        return (
          <section key={aisle} className="aisle" aria-label={aisle}>
            <h2>{aisle}</h2>
            <ul>
              {inAisle.map((item) => (
                <ItemRow key={item.id} item={item} onToggle={() => toggleGot(item.id)} onEdit={() => setEditing(item)} />
              ))}
            </ul>
          </section>
        );
      })}

      {got.length > 0 && (
        <section className="aisle basket" aria-label="In the basket">
          <div className="section-head">
            <h2>In the basket ({got.length})</h2>
            <button type="button" className="ghost small" onClick={clearBasket}>
              Clear
            </button>
          </div>
          <ul>
            {got.map((item) => (
              <ItemRow key={item.id} item={item} onToggle={() => toggleGot(item.id)} onEdit={() => setEditing(item)} />
            ))}
          </ul>
        </section>
      )}

      {usualsShown.length > 0 && (
        <section className="usuals" aria-label="Buy again">
          <h2>{typed ? "Matching items you've bought before" : "Buy again"}</h2>
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
            <span className="pulse" aria-hidden="true" /> Listening…
          </p>
          <p className="live-text">{voice.transcript || "Say what's run out — pause or tap Done when you've finished."}</p>
          {voice.transcript && (
            <div className="chips wrap preview">
              {parseItems(voice.transcript).map((p, i) => (
                <span key={i} className="chip on">
                  {p.name}
                  {p.shop ? ` · ${p.shop}` : ""}
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
          placeholder={canTalk ? "Type, or tap the mic…" : "Add items…"}
          aria-label="Add items"
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
              aria-label={voice.listening ? "Stop listening" : "Speak items"}
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
            showToast(`Forgot ${editing.name}`, { action: { label: "Undo", onClick: () => unforget(id) }, durationMs: 5000 });
          }}
        />
      )}
    </div>
  );
}

function ItemRow({ item, onToggle, onEdit }: { item: ShoppingItem; onToggle: () => void; onEdit: () => void }) {
  const done = item.status === "got";
  return (
    <li className={`item ${done ? "done" : ""}`}>
      <button type="button" className="item-main" role="checkbox" aria-checked={done} aria-label={item.name} onClick={onToggle}>
        <span className="tick" aria-hidden="true">
          {done ? "✓" : ""}
        </span>
        <span className="item-text">
          <span className="item-name">{item.name}</span>
          {(item.shop || item.note) && <span className="item-meta">{[item.shop, item.note].filter(Boolean).join(" · ")}</span>}
        </span>
      </button>
      <button type="button" className="edit" aria-label={`Edit ${item.name}`} onClick={onEdit}>
        ⋯
      </button>
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
