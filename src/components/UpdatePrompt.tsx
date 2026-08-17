import { useRegisterSW } from "virtual:pwa-register/react";

// registerType is 'prompt' (see vite.config.ts) specifically so a new deploy
// doesn't reload the app out from under an unsaved draft — this banner lets
// the user pick the moment instead.
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="update-prompt" role="status">
      <span>A new version of Journall OS is ready.</span>
      <div className="update-prompt-actions">
        <button type="button" className="primary" onClick={() => void updateServiceWorker(true)}>
          Refresh now
        </button>
        <button type="button" className="ghost" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
      </div>
    </div>
  );
}
