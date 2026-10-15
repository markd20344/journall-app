import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth, usingEmulators } from "@journall/shared/firebase/config";
import App from "./App";
import "./styles.css";

// Emulator-only: lets the e2e tests (and a quick manual poke) sign in
// without the emulator's fake Google popup. The Auth emulator accepts an
// unsigned credential; production auth never would.
if (usingEmulators && auth) {
  const emulatorAuth = auth;
  (window as unknown as { __mumuTestSignIn: (uid?: string) => Promise<unknown> }).__mumuTestSignIn = (uid = "owner-uid") =>
    signInWithCredential(emulatorAuth, GoogleAuthProvider.credential(JSON.stringify({ sub: uid, email: `${uid}@example.com`, email_verified: true })));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
