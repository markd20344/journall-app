import { Fragment } from "react";
import { Link } from "react-router";
import FilterChips from "../components/FilterChips";
import { useCollection, useStore } from "../data/store";
import { initials, personName, telHref } from "../lib/format";
import { byText, fold, matches } from "../lib/search";
import { useParamState } from "../lib/useParamState";
import type { Person } from "../types";

const CIRCLE_FILTERS = [
  { value: "work", label: "Work" },
  { value: "personal", label: "Personal" },
];

export default function PeoplePage() {
  const people = useCollection("people");
  const companies = useStore().companies.byId;
  const [q, setQ] = useParamState("q");
  const [circle, setCircle] = useParamState("circle");

  const companyNames = (p: Person) =>
    p.companyLinks
      .map((l) => companies.get(l.companyId))
      .filter((c) => c && !c.deleted)
      .map((c) => c!.name)
      .join(", ");

  const shown = people
    .filter((p) => !circle || p.circle === circle || p.circle === "both")
    .filter((p) =>
      matches(
        q,
        personName(p),
        p.nickname,
        p.relationship,
        companyNames(p),
        p.companyLinks.map((l) => l.role).join(" "),
        p.phones.map((x) => x.number).join(" "),
        p.emails.map((x) => x.address).join(" "),
        p.tags.join(" "),
      ),
    )
    .sort(byText(personName));

  let lastLetter = "";

  return (
    <div className="page">
      <div className="page-head">
        <h1>People</h1>
        <Link className="btn primary" to="/people/new">
          ＋ Add
        </Link>
      </div>
      <input className="search" type="search" placeholder="Search people, companies, numbers" value={q} onChange={(e) => setQ(e.target.value)} />
      <FilterChips label="Circle" options={CIRCLE_FILTERS} value={circle} onChange={setCircle} allLabel="Everyone" />
      {shown.length === 0 ? (
        <p className="empty">{people.length === 0 ? "No one here yet. Add the first person." : "Nothing matches."}</p>
      ) : (
        <div className="list">
          {shown.map((p) => {
            const name = personName(p);
            const letter = fold(name).charAt(0).toUpperCase();
            const showLetter = !q && letter !== lastLetter;
            lastLetter = letter;
            const primaryRole = p.companyLinks.find((l) => l.current) ?? p.companyLinks[0];
            const sub = primaryRole
              ? [primaryRole.role, companies.get(primaryRole.companyId)?.name].filter(Boolean).join(" · ")
              : p.relationship;
            const phone = p.phones.find((x) => x.number.trim());
            return (
              <Fragment key={p.id}>
                {showLetter && <div className="row-letter">{letter}</div>}
                <div className="row">
                  <Link to={`/people/${p.id}`} className="row-link">
                    <span className="avatar">{initials(name)}</span>
                    <span className="row-main">
                      <span className="row-title">{name}</span>
                      {sub && <span className="row-sub">{sub}</span>}
                    </span>
                  </Link>
                  {phone && (
                    <a className="btn icon-btn" href={telHref(phone.number)} aria-label={`Call ${name}`}>
                      📞
                    </a>
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
