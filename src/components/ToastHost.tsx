import { useEffect, useState } from "react";
import { subscribeToast } from "../lib/toast";

export default function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => subscribeToast(setMessage), []);

  if (!message) return null;
  return (
    <div className="toast" role="status">
      ✓ {message}
    </div>
  );
}
