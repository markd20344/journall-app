import { Link } from "react-router";
import { auth, firebaseEnabled, usingEmulators } from "@journall/shared/firebase/config";
import { signOutUser } from "@journall/shared/firebase/auth";
import { useStore } from "../data/store";

export default function MorePage() {
  const s = useStore();
  const trashCount = s.companies.all.length - s.companies.live.length + s.people.all.length - s.people.live.length + s.notes.all.length - s.notes.live.length;
  const email = auth?.currentUser?.email;

  return (
    <div className="page">
      <h1>More</h1>

      <div className="list">
        <Link className="row" to="/trash">
          <span className="row-main">
            <span className="row-title">🗑️ Trash</span>
            <span className="row-sub">{trashCount === 0 ? "Empty" : `${trashCount} deleted ${trashCount === 1 ? "item" : "items"} you can restore`}</span>
          </span>
        </Link>
      </div>

      <div className="card fields">
        <div className="field-view">
          <small>Signed in as</small>
          <div>{firebaseEnabled ? (email ?? "—") : "Not connected to Firebase"}</div>
        </div>
        <div className="field-view">
          <small>Records</small>
          <div>
            {s.people.live.length} people · {s.companies.live.length} companies · {s.notes.live.length} notes
          </div>
        </div>
        {usingEmulators && <p className="hint">Running against local emulators — test data only.</p>}
        {firebaseEnabled && (
          <div>
            <button type="button" onClick={() => void signOutUser()}>
              Sign out
            </button>
          </div>
        )}
      </div>

      <p className="hint">
        Mumu — after <em>Mumu</em>, the old name for Munster. Version {__APP_VERSION__}.
      </p>
    </div>
  );
}
