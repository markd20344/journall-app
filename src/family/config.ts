// This app manages a single shared family tree (one Firebase project, one
// tree, shared by invite) rather than being multi-tenant — so a fixed tree
// id keeps the Firestore paths and security rules simple: everything lives
// under `trees/family/...`.
export const FAMILY_TREE_ID = "family";
