import { useEffect, useState } from "react";
import { subscribeToast, type ToastState } from "../lib/toast";

export default function ToastHost() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => subscribeToast(setToast), []);

  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span>✓ {toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.action?.onClick();
            setToast(null);
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
