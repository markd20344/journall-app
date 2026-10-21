import { Link } from "react-router";
import { useStore } from "../data/store";
import { formatOccurrence, relativeDays, type Upcoming } from "../lib/dates";
import { personName } from "../lib/format";
import { dateIcon, dateTitle } from "../lib/labels";
import type { ImportantDate } from "../types";

interface Props {
  entry: Upcoming<ImportantDate>;
  /** On a person's own page the name is redundant; link to the edit form instead. */
  onPersonPage?: boolean;
}

export default function DateRow({ entry, onPersonPage }: Props) {
  const person = useStore().people.byId.get(entry.item.personId);
  const title = dateTitle(entry.item);
  const turning = entry.years ? (entry.item.kind === "birthday" ? ` · turns ${entry.years}` : ` · ${entry.years} years`) : "";
  const soon = entry.daysAway <= 3;
  return (
    <Link to={onPersonPage ? `/dates/${entry.item.id}/edit` : `/people/${entry.item.personId}`} className="row" aria-label={`${onPersonPage ? "Edit " : ""}${person ? personName(person) + "'s " : ""}${title.toLowerCase()}, ${relativeDays(entry.daysAway)}`}>
      <span className="avatar" aria-hidden="true">
        {dateIcon(entry.item.kind)}
      </span>
      <span className="row-main">
        <span className="row-title">{onPersonPage ? title : person ? personName(person) : "?"}</span>
        <span className="row-sub">
          {!onPersonPage && `${title} · `}
          {formatOccurrence(entry.date)}
          {turning}
        </span>
      </span>
      <span className={`badge${soon ? " gold" : ""}`}>{relativeDays(entry.daysAway)}</span>
    </Link>
  );
}
