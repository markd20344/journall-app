import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export interface DropdownOption {
  value: string;
  label: ReactNode;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  className?: string;
  triggerClassName?: string;
  style?: CSSProperties;
  triggerStyle?: CSSProperties;
  "aria-label"?: string;
}

/**
 * Drop-in replacement for a native <select> that opens its option list on
 * mouse hover (desktop) in addition to click (which still works everywhere,
 * including touch — hover has no touchscreen equivalent, so phones keep the
 * familiar tap-to-open-then-tap-to-select flow). Once open, choosing an
 * option is always a single click/tap.
 */
export default function Dropdown({ value, onChange, options, className, triggerClassName, style, triggerStyle, ...aria }: Props) {
  const [open, setOpen] = useState(false);
  // Opens upward instead of down when there isn't enough room below the
  // trigger (e.g. a field near the bottom of a long form) — otherwise the
  // list opens off the bottom of the screen with no way to scroll it into
  // view, since the overflow is on the viewport, not inside the menu.
  const [openUpward, setOpenUpward] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against two distinct replay hazards right after picking an
  // option: (1) removing the option list out from under a still-hovering
  // cursor can make the browser replay a mouseenter on the wrapper
  // (relatedTarget points at a now-detached node); (2) if this component
  // ends up nested in a native <label> alongside other buttons, clicking
  // a non-canonical labelable descendant can make the browser also
  // synthesize a click on the first one (the trigger). Both would
  // otherwise pop the menu straight back open right after selecting.
  const suppressUntil = useRef(0);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  function suppressed(): boolean {
    return Date.now() < suppressUntil.current;
  }

  function decidePlacement() {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setOpenUpward(spaceBelow < 260 && spaceAbove > spaceBelow);
  }

  function openNow() {
    if (suppressed()) return;
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    decidePlacement();
    setOpen(true);
  }

  function scheduleClose() {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }

  function selectOption(v: string) {
    onChange(v);
    setOpen(false);
    suppressUntil.current = Date.now() + 400;
  }

  return (
    <div
      ref={rootRef}
      className={`dropdown ${className ?? ""}`}
      style={style}
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={`dropdown-trigger ${triggerClassName ?? ""}`}
        style={triggerStyle}
        onClick={() => {
          if (suppressed()) return;
          if (!open) decidePlacement();
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={aria["aria-label"]}
      >
        <span className="dropdown-trigger-label">{selected?.label}</span>
        <span className="dropdown-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className={`dropdown-menu ${openUpward ? "dropdown-menu-up" : ""}`} role="listbox">
          {options.map((opt) => (
            <li key={opt.value} role="option" aria-selected={opt.value === value}>
              <button
                type="button"
                className={`dropdown-option ${opt.value === value ? "selected" : ""}`}
                onClick={() => selectOption(opt.value)}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
