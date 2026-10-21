import { useNavigate } from "react-router";

// Goes back in history when there is some (so filters/scroll are kept),
// otherwise to a sensible parent — e.g. when opened from a deep link.
export default function BackLink({ fallback, label = "Back" }: { fallback: string; label?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="back-link"
      onClick={() => {
        if (window.history.state && window.history.state.idx > 0) navigate(-1);
        else navigate(fallback);
      }}
    >
      ‹ {label}
    </button>
  );
}
