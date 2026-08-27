// Membership/role lookups for the shared family tree. A user can be signed
// into the app (Firebase Auth) without yet being a tree member — the tree
// itself is invite-gated on top of that, so this also drives the
// invite-claim flow: on first sign-in, if you're not a member yet but an
// owner invited your email, this turns that invite into membership.
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { User } from "firebase/auth";
import { db } from "../db/db";
import { firestore } from "../firebase/config";
import { watchAuthState } from "../firebase/auth";
import { FAMILY_TREE_ID } from "./config";
import { nowIso } from "../lib/id";
import type { FamilyMember, FamilyRole } from "../types/family";

function treeDoc(...segments: string[]) {
  return doc(firestore!, "trees", FAMILY_TREE_ID, ...segments);
}

/**
 * Called once per sign-in (see AuthGate). If this account isn't a tree
 * member yet, checks for a pending invite matching their exact sign-in
 * email and, if found, claims it by creating their membership doc — which
 * Firestore rules only allow when the claimed role matches the invite.
 */
export async function claimInviteIfAny(user: User): Promise<void> {
  if (!firestore || !user.email) return;
  const memberRef = treeDoc("members", user.uid);
  const existing = await getDoc(memberRef);
  if (existing.exists()) return;

  const inviteRef = treeDoc("invites", user.email);
  const invite = await getDoc(inviteRef);
  if (!invite.exists()) return;

  const role = invite.data().role as FamilyRole;
  const member: FamilyMember = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName ?? user.email,
    role,
    invitedBy: (invite.data().invitedBy as string) ?? "",
    joinedAt: nowIso(),
    updatedAt: nowIso(),
  };
  await setDoc(memberRef, member as unknown as Record<string, unknown>);
}

function useCurrentUser(): User | null {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => watchAuthState(setUser), []);
  return user;
}

export interface FamilyMembership {
  loading: boolean;
  uid: string | null;
  role: FamilyRole | null;
  member: FamilyMember | null;
}

/** Live-updating role for the signed-in user, sourced from the local Dexie mirror of trees/family/members. */
export function useFamilyMembership(): FamilyMembership {
  const user = useCurrentUser();
  const member = useLiveQuery(async () => (user ? db.familyMembers.get(user.uid) : undefined), [user?.uid]);

  return { loading: member === undefined && !!user, uid: user?.uid ?? null, role: member?.role ?? null, member: member ?? null };
}

export function canEditFacts(role: FamilyRole | null): boolean {
  return role === "owner" || role === "contributor";
}

export function canEditStructure(role: FamilyRole | null): boolean {
  return role === "owner";
}

export function canManageMembers(role: FamilyRole | null): boolean {
  return role === "owner";
}
