import { Link, useParams } from "react-router";
import BackLink from "../components/BackLink";
import GoBackCard from "../components/GoBackCard";
import NoteCard from "../components/NoteCard";
import { useNotesFor } from "../data/selectors";
import { useRecord, useStore, useStoreReady } from "../data/store";
import { engagementPeriod } from "../lib/dates";
import { initials, personName, telHref } from "../lib/format";
import { useTrackView } from "../lib/useTrackView";
import NotFound from "./NotFound";

export default function EngagementDetailPage() {
  const { id } = useParams();
  const engagement = useRecord("engagements", id);
  const { companies, people } = useStore();
  const ready = useStoreReady();
  const notes = useNotesFor({ engagementId: id });
  useTrackView("engagement", id, Boolean(engagement && !engagement.deleted));

  if (!engagement || engagement.deleted) return ready ? <NotFound what="engagement" /> : null;

  const company = companies.byId.get(engagement.companyId);
  const viaCompany = engagement.viaCompanyId ? companies.byId.get(engagement.viaCompanyId) : undefined;
  const viaPerson = engagement.viaPersonId ? people.byId.get(engagement.viaPersonId) : undefined;
  const contacts = engagement.keyContactIds.map((pid) => people.byId.get(pid)).filter((p) => p && !p.deleted);
  const goBack = notes.filter((n) => n.type === "if-i-go-back");
  const otherNotes = notes.filter((n) => n.type !== "if-i-go-back");

  return (
    <div className="page">
      <div className="page-head">
        <BackLink fallback={company ? `/companies/${company.id}` : "/engagements"} />
        <Link className="btn" to={`/engagements/${engagement.id}/edit`} aria-label="Edit engagement">
          Edit
        </Link>
      </div>
      <div>
        {company && (
          <Link to={`/companies/${company.id}`} className="hint" style={{ fontSize: "1rem", fontWeight: 600 }}>
            🏢 {company.name}
          </Link>
        )}
        <h1 style={{ marginTop: 4 }}>{engagement.title || engagement.myRole || "(untitled)"}</h1>
        <div className="sub hint" style={{ marginTop: 6, fontSize: "1rem" }}>
          {engagement.endDate === null && <span className="badge active">Ongoing</span>} {engagementPeriod(engagement)}
        </div>
      </div>

      <GoBackCard notes={goBack} />

      <div className="card fields">
        {engagement.myRole && (
          <div className="field-view">
            <small>My role</small>
            <div>{engagement.myRole}</div>
          </div>
        )}
        {engagement.whatIDid && (
          <div className="field-view">
            <small>What I did</small>
            <div>{engagement.whatIDid}</div>
          </div>
        )}
        {(engagement.howIGotIt || viaCompany || viaPerson) && (
          <div className="field-view">
            <small>How I got it</small>
            <div>
              {engagement.howIGotIt}
              {(viaCompany || viaPerson) && (
                <div className="chips" style={{ marginTop: 6 }}>
                  {viaCompany && !viaCompany.deleted && (
                    <Link className="chip" to={`/companies/${viaCompany.id}`}>
                      via 🏢 {viaCompany.name}
                    </Link>
                  )}
                  {viaPerson && !viaPerson.deleted && (
                    <Link className="chip" to={`/people/${viaPerson.id}`}>
                      via 👤 {personName(viaPerson)}
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {engagement.rate && (
          <div className="field-view">
            <small>Rate</small>
            <div>{engagement.rate}</div>
          </div>
        )}
        {engagement.tags.length > 0 && (
          <div className="chips">
            {engagement.tags.map((t) => (
              <span key={t} className="tag">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      <section className="section">
        <h2>Key contacts</h2>
        {contacts.length === 0 ? (
          <p className="empty">None added. Edit to add the people you dealt with.</p>
        ) : (
          <div className="list">
            {contacts.map((p) => {
              const phone = p!.phones.find((x) => x.number.trim());
              const role = p!.companyLinks.find((l) => l.companyId === engagement.companyId)?.role;
              return (
                <div key={p!.id} className="row">
                  <Link to={`/people/${p!.id}`} className="row-link">
                    <span className="avatar">{initials(personName(p!))}</span>
                    <span className="row-main">
                      <span className="row-title">{personName(p!)}</span>
                      {role && <span className="row-sub">{role}</span>}
                    </span>
                  </Link>
                  {phone && (
                    <a className="btn icon-btn" href={telHref(phone.number)} aria-label={`Call ${personName(p!)}`}>
                      📞
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Notes</h2>
          <Link className="btn small" to={`/notes/new?engagement=${engagement.id}${company ? `&company=${company.id}` : ""}`}>
            ＋ Note
          </Link>
        </div>
        {otherNotes.length === 0 ? <p className="empty">No notes yet.</p> : otherNotes.map((n) => <NoteCard key={n.id} note={n} context={{ engagementId: engagement.id }} />)}
      </section>
    </div>
  );
}
