import { useMemo } from "react";
import { Link } from "react-router";
import FilterChips from "../components/FilterChips";
import { useCollection } from "../data/store";
import { initials } from "../lib/format";
import { COMPANY_STATUSES, COMPANY_TYPES, labelFor } from "../lib/labels";
import { byText, matches } from "../lib/search";
import { useParamState } from "../lib/useParamState";

export default function CompaniesPage() {
  const companies = useCollection("companies");
  const people = useCollection("people");
  const [q, setQ] = useParamState("q");
  const [type, setType] = useParamState("type");
  const [status, setStatus] = useParamState("status");

  const peopleCount = useMemo(() => {
    const m = new Map<string, number>();
    people.forEach((p) => p.companyIds.forEach((id) => m.set(id, (m.get(id) ?? 0) + 1)));
    return m;
  }, [people]);

  const shown = companies
    .filter((c) => (!type || c.type === type) && (!status || c.status === status))
    .filter((c) => matches(q, c.name, c.address, c.postcode, c.summary, c.website, c.tags.join(" ")))
    .sort(byText((c) => c.name));

  return (
    <div className="page">
      <div className="page-head">
        <h1>Companies</h1>
        <Link className="btn primary" to="/companies/new">
          ＋ Add
        </Link>
      </div>
      <input className="search" type="search" placeholder="Search companies" value={q} onChange={(e) => setQ(e.target.value)} />
      <FilterChips label="Type" options={COMPANY_TYPES} value={type} onChange={setType} allLabel="All types" />
      <FilterChips label="Status" options={COMPANY_STATUSES} value={status} onChange={setStatus} allLabel="Any status" />
      {shown.length === 0 ? (
        <p className="empty">{companies.length === 0 ? "No companies yet. Add the first one." : "Nothing matches."}</p>
      ) : (
        <div className="list">
          {shown.map((c) => {
            const count = peopleCount.get(c.id) ?? 0;
            return (
              <Link key={c.id} to={`/companies/${c.id}`} className="row">
                <span className="avatar square">{initials(c.name)}</span>
                <span className="row-main">
                  <span className="row-title">{c.name || "(unnamed)"}</span>
                  <span className="row-sub">
                    {labelFor(COMPANY_TYPES, c.type)} · {labelFor(COMPANY_STATUSES, c.status)}
                    {count > 0 && ` · ${count} ${count === 1 ? "person" : "people"}`}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
