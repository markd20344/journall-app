// Security rules tests, run against the Firestore emulator:
//   npm run test:rules
// The rules file's owner UID placeholder is swapped for a test UID, so these
// check the locked-down behaviour regardless of what UID is committed.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const OWNER = "owner-uid";
const STRANGER = "stranger-uid";
const rulesPath = fileURLToPath(new URL("../../firestore.rules", import.meta.url));
const rawRules = readFileSync(rulesPath, "utf8");
const committedUid = rawRules.match(/function ownerUid\(\) \{\s*return '([^']+)';/)?.[1];

function rulesWithOwner(uid: string): string {
  return rawRules.replace(`return '${committedUid}';`, `return '${uid}';`);
}

let env: RulesTestEnvironment;

async function useRules(rules: string) {
  if (env) await env.cleanup();
  env = await initializeTestEnvironment({ projectId: "demo-mumu", firestore: { rules } });
}

afterAll(async () => {
  await env?.cleanup();
});

describe("locked to the owner", () => {
  beforeAll(() => useRules(rulesWithOwner(OWNER)));
  beforeEach(() => env.clearFirestore());

  it("the owner can write and read their own records", async () => {
    const db = env.authenticatedContext(OWNER).firestore();
    await assertSucceeds(setDoc(doc(db, "users", OWNER, "people", "p1"), { id: "p1" }));
    await assertSucceeds(getDoc(doc(db, "users", OWNER, "people", "p1")));
  });

  it("a stranger can't read the owner's records", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "users", OWNER, "people", "p1"), { id: "p1" }));
    await assertFails(getDoc(doc(env.authenticatedContext(STRANGER).firestore(), "users", OWNER, "people", "p1")));
  });

  it("a stranger can't write to the owner's records", async () => {
    await assertFails(setDoc(doc(env.authenticatedContext(STRANGER).firestore(), "users", OWNER, "people", "p1"), { id: "p1" }));
  });

  it("a stranger can't even use their own space", async () => {
    const db = env.authenticatedContext(STRANGER).firestore();
    await assertFails(setDoc(doc(db, "users", STRANGER, "people", "p1"), { id: "p1" }));
    await assertFails(getDoc(doc(db, "users", STRANGER, "people", "p1")));
  });

  it("signed-out requests are refused", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "users", OWNER, "people", "p1")));
    await assertFails(setDoc(doc(db, "users", OWNER, "people", "p1"), { id: "p1" }));
  });

  it("Family Tree members keep their access", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "trees", "family", "members", STRANGER), { uid: STRANGER, role: "viewer" });
      await setDoc(doc(ctx.firestore(), "trees", "family", "people", "x"), { id: "x" });
    });
    await assertSucceeds(getDoc(doc(env.authenticatedContext(STRANGER).firestore(), "trees", "family", "people", "x")));
  });
});

describe("before the owner UID is filled in", () => {
  beforeAll(() => useRules(rulesWithOwner("SET_OWNER_UID")));
  beforeEach(() => env.clearFirestore());

  it("each user can use only their own space, as before", async () => {
    const db = env.authenticatedContext(STRANGER).firestore();
    await assertSucceeds(setDoc(doc(db, "users", STRANGER, "notes", "n1"), { id: "n1" }));
    await assertFails(getDoc(doc(db, "users", OWNER, "notes", "n1")));
  });
});
