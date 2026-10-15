import { Link } from "react-router";
import EngagementRow from "../components/EngagementRow";
import { sortEngagements } from "../data/selectors";
import { useCollection, useStore } from "../data/store";
import { matches } from "../lib/search";
import { useParamState } from "../lib/useParamState";

export default function EngagementsPage() {
  const engagements = useCollection("engagements");
  const companies = useStore().companies.byId;
  const [q, setQ] = useParamState("q");

  const shown = sortEngagements(
    engagements.filter((e) =>
      matches(q, companies.get(e.companyId)?.name, e.title, e.myRole, e.whatIDid, e.howIGotIt, e.tags.join(" "), companies.get(e.viaCompanyId ?? "")?.name),
    ),
  );
  const ongoing = shown.filter((e) => e.endDate === null);
  const past = shown.filter((e) => e.endDate !== null);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Work history</h1>
        <Link className="btn primary" to="/engagements/new">
          ＋ Add
        </Link>
      </div>
      <input className="search" type="search" placeholder="Search work history" value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.length === 0 && (
        <p className="empty">{engagements.length === 0 ? "No engagements yet. Add each stint of work so you can pick it up again if you go back." : "Nothing matches."}</p>
      )}
      {ongoing.length > 0 && (
        <section className="section">
          <h2>Now</h2>
          <div className="list">
            {ongoing.map((e) => (
              <EngagementRow key={e.id} engagement={e} />
            ))}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section className="section">
          <h2>Before</h2>
          <div className="list">
            {past.map((e) => (
              <EngagementRow key={e.id} engagement={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
