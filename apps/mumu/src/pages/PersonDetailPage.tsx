import { Link, useParams } from "react-router";
import BackLink from "../components/BackLink";
import NotesSection, { GoBackFor } from "../components/NotesSection";
import { useRecord, useStore, useStoreReady } from "../data/store";
import { initials, mailHref, mapsHref, personName, smsHref, telHref } from "../lib/format";
import { CIRCLES, labelFor } from "../lib/labels";
import NotFound from "./NotFound";

export default function PersonDetailPage() {
  const { id } = useParams();
  const person = useRecord("people", id);
  const companies = useStore().companies.byId;
  const ready = useStoreReady();

  if (!person || person.deleted) return ready ? <NotFound what="person" /> : null;

  const name = personName(person);
  const phones = person.phones.filter((p) => p.number.trim());
  const emails = person.emails.filter((e) => e.address.trim());
  const map = mapsHref(person.address);
  const links = person.companyLinks.filter((l) => companies.get(l.companyId) && !companies.get(l.companyId)!.deleted);

  return (
    <div className="page">
      <div className="page-head">
        <BackLink fallback="/people" label="People" />
        <Link className="btn" to={`/people/${person.id}/edit`}>
          Edit
        </Link>
      </div>
      <div className="hero">
        <span className="avatar lg">{initials(name)}</span>
        <div>
          <h1>{name}</h1>
          <div className="sub">
            {[person.nickname && `“${person.nickname}”`, person.relationship, labelFor(CIRCLES, person.circle)].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      <GoBackFor personId={person.id} />

      {(phones.length > 0 || emails.length > 0) && (
        <div className="card contact-list">
          {phones.map((p) => (
            <div key={p.id} className="contact-line">
              <div className="value">
                <small>{p.label}</small>
                <a href={telHref(p.number)}>{p.number}</a>
              </div>
              <a className="btn icon-btn" href={smsHref(p.number)} aria-label={`Text ${p.number}`}>
                💬
              </a>
              <a className="btn icon-btn primary" href={telHref(p.number)} aria-label={`Call ${p.number}`}>
                📞
              </a>
            </div>
          ))}
          {emails.map((e) => (
            <div key={e.id} className="contact-line">
              <div className="value">
                <small>{e.label}</small>
                <a href={mailHref(e.address)}>{e.address}</a>
              </div>
              <a className="btn icon-btn primary" href={mailHref(e.address)} aria-label={`Email ${e.address}`}>
                ✉️
              </a>
            </div>
          ))}
        </div>
      )}

      {links.length > 0 && (
        <section className="section">
          <h2>Companies</h2>
          <div className="list">
            {links.map((l) => {
              const c = companies.get(l.companyId)!;
              return (
                <Link key={l.companyId} to={`/companies/${c.id}`} className="row">
                  <span className="avatar square">{initials(c.name)}</span>
                  <span className="row-main">
                    <span className="row-title">{c.name}</span>
                    <span className="row-sub">
                      {l.role || "No role set"}
                      {!l.current && " · former"}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {(person.summary || person.address || person.tags.length > 0) && (
        <div className="card fields">
          {person.summary && (
            <div className="field-view">
              <small>About</small>
              <div>{person.summary}</div>
            </div>
          )}
          {person.address && (
            <div className="field-view">
              <small>Address</small>
              <div>
                {person.address}
                {map && (
                  <>
                    {" "}
                    <a href={map} target="_blank" rel="noopener noreferrer">
                      Map
                    </a>
                  </>
                )}
              </div>
            </div>
          )}
          {person.tags.length > 0 && (
            <div className="chips">
              {person.tags.map((t) => (
                <span key={t} className="tag">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <NotesSection personId={person.id} />
    </div>
  );
}
