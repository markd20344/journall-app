import { Link } from "react-router";
import { useStore } from "../data/store";
import { engagementPeriod } from "../lib/dates";
import type { Engagement } from "../types";

export default function EngagementRow({ engagement, showCompany = true }: { engagement: Engagement; showCompany?: boolean }) {
  const company = useStore().companies.byId.get(engagement.companyId);
  const title = engagement.title || engagement.myRole || "(untitled)";
  return (
    <Link to={`/engagements/${engagement.id}`} className="row">
      <span className="avatar square" aria-hidden="true">
        {engagement.endDate ? "💼" : "🟢"}
      </span>
      <span className="row-main">
        <span className="row-title">
          {showCompany && company ? `${company.name} · ` : ""}
          {title}
        </span>
        <span className="row-sub">
          {engagement.endDate === null && <span className="badge active">Ongoing</span>} {engagementPeriod(engagement)}
        </span>
      </span>
    </Link>
  );
}
