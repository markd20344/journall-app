import { useEffect, useState } from "react";
import type { FamilyInvite, FamilyRole } from "../../types/family";
import { useAllFamilyMembers } from "../../hooks/useFamilyData";
import { changeMemberRole, inviteMember, listInvites, removeMember, revokeInvite } from "../../family/repo";
import { showToast } from "../../lib/toast";

interface Props {
  uid: string;
}

const ROLE_OPTIONS: Array<{ value: FamilyRole; label: string }> = [
  { value: "viewer", label: "Viewer — can browse the tree, photos and records" },
  { value: "contributor", label: "Contributor — can also add photos and facts" },
  { value: "owner", label: "Owner — full control, including the tree structure" },
];

export default function MembersPanel({ uid }: Props) {
  const members = useAllFamilyMembers();
  const [invites, setInvites] = useState<FamilyInvite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<FamilyRole>("viewer");
  const [sending, setSending] = useState(false);

  function refreshInvites() {
    void listInvites().then(setInvites);
  }

  useEffect(refreshInvites, []);

  async function handleInvite() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await inviteMember(trimmed, role, uid);
      setEmail("");
      showToast(`Invited ${trimmed}`);
      refreshInvites();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't send invite");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="family-members-panel">
      <h2 className="page-title">People with access</h2>
      <p className="settings-hint">
        Invited people sign in with their own Google account (whichever one uses this exact email address), and get
        access the moment they do — even if they sign in before you finish typing this.
      </p>

      <div className="family-editor-grid">
        <label className="field">
          <span className="field-label">Invite by email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="relative@example.com" />
        </label>
        <label className="field">
          <span className="field-label">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as FamilyRole)}>
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="button" className="primary" disabled={sending || !email.trim()} onClick={() => void handleInvite()}>
        Send invite
      </button>

      <h3>Members</h3>
      <div className="family-member-list">
        {members.map((m) => (
          <div key={m.uid} className="family-member-row">
            <div>
              <strong>{m.displayName}</strong>
              <span className="family-member-email">{m.email}</span>
            </div>
            {m.uid === uid ? (
              <span className="family-relationship-subtype">{m.role} (you)</span>
            ) : (
              <div className="family-member-actions">
                <select value={m.role} onChange={(e) => void changeMemberRole(m.uid, e.target.value as FamilyRole)}>
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.value}
                    </option>
                  ))}
                </select>
                <button type="button" className="ghost small" onClick={() => void removeMember(m.uid).then(() => showToast("Access removed"))}>
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {invites.length > 0 && (
        <>
          <h3>Pending invites</h3>
          <div className="family-member-list">
            {invites.map((inv) => (
              <div key={inv.email} className="family-member-row">
                <div>
                  <strong>{inv.email}</strong>
                  <span className="family-member-email">not signed in yet</span>
                </div>
                <div className="family-member-actions">
                  <span className="family-relationship-subtype">{inv.role}</span>
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => void revokeInvite(inv.email).then(refreshInvites).then(() => showToast("Invite revoked"))}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
