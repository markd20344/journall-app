// Single-owner lock. The UID comes from the build environment (a GitHub
// secret), not the repo. Firestore rules are the real enforcement; this just
// signs a stranger straight back out instead of showing them an empty app.
export const OWNER_UID: string = import.meta.env.VITE_OWNER_UID ?? "";
