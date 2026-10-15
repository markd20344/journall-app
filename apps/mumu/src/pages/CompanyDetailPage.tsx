import { Link, useParams } from "react-router";
import BackLink from "../components/BackLink";
import NotesSection, { GoBackFor } from "../components/NotesSection";
import { usePeopleAtCompany } from "../data/selectors";
import { useRecord, useStoreReady } from "../data/store";
import { initials, mapsHref, personName, websiteHref, websiteLabel } from "../lib/format";
import { COMPANY_STATUSES, COMPANY_TYPES, labelFor } from "../lib/labels";
import NotFound from "./NotFound";

export default function CompanyDetailPage() {
  const { id } = useParams();
  const company = useRecord("companies", id);
  const people = usePeopleAtCompany(id);
  const ready = useStoreReady();

  if (!company || company.deleted) return ready ? <NotFound what="company" /> : null;

  const site = websiteHref(company.website);
  const map = mapsHref(company.address, company.postcode);

  return (
    <div className="page">
      <div className="page-head">
        <BackLink fallback="/companies" label="Companies" />
        <Link className="btn" to={`/companies/${company.id}/edit`} aria-label="Edit company">
          Edit
        </Link>
      </div>
      <div className="hero">
        <span className="avatar lg square">{initials(company.name)}</span>
        <div>
          <h1>{company.name || "(unnamed)"}</h1>
          <div className="chips" style={{ marginTop: 6 }}>
            <span className="badge">{labelFor(COMPANY_TYPES, company.type)}</span>
            <span className={`badge ${company.status}`}>{labelFor(COMPANY_STATUSES, company.status)}</span>
          </div>
        </div>
      </div>

      <GoBackFor companyId={company.id} />

      {(site || map) && (
        <div className="chips">
          {site && (
            <a className="btn" href={site} target="_blank" rel="noopener noreferrer">
              🌐 {websiteLabel(company.website)}
            </a>
          )}
          {map && (
            <a className="btn" href={map} target="_blank" rel="noopener noreferrer">
              📍 Map
            </a>
          )}
        </div>
      )}

      {(company.summary || company.address || company.tags.length > 0) && (
        <div className="card fields">
          {company.summary && (
            <div className="field-view">
              <small>Summary</small>
              <div>{company.summary}</div>
            </div>
          )}
          {(company.address || company.postcode) && (
            <div className="field-view">
              <small>Address</small>
              <div>{[company.address, company.postcode].filter(Boolean).join("\n")}</div>
            </div>
          )}
          {company.tags.length > 0 && (
            <div className="chips">
              {company.tags.map((t) => (
                <span key={t} className="tag">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <section className="section">
        <div className="section-head">
          <h2>People</h2>
          <Link className="btn small" to={`/people/new?company=${company.id}`}>
            ＋ Person
          </Link>
        </div>
        {people.length === 0 ? (
          <p className="empty">No one linked yet.</p>
        ) : (
          <div className="list">
            {people.map((p) => {
              const link = p.companyLinks.find((l) => l.companyId === company.id);
              return (
                <Link key={p.id} to={`/people/${p.id}`} className="row">
                  <span className="avatar">{initials(personName(p))}</span>
                  <span className="row-main">
                    <span className="row-title">{personName(p)}</span>
                    <span className="row-sub">
                      {link?.role || "No role set"}
                      {link && !link.current && " · former"}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <NotesSection companyId={company.id} />
    </div>
  );
}
