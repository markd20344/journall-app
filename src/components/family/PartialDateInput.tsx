import { DATE_PRECISION_OPTIONS, buildPartialDate, splitPartialDate } from "../../family/dates";
import type { PartialDate } from "../../types/family";

interface Props {
  label: string;
  value: PartialDate;
  onChange: (date: PartialDate) => void;
}

export default function PartialDateInput({ label, value, onChange }: Props) {
  const { year, month, day } = splitPartialDate(value);

  function update(next: { year?: string; month?: string; day?: string; precision?: PartialDate["precision"] }) {
    onChange(
      buildPartialDate(
        next.precision ?? value.precision,
        next.year ?? year,
        next.month ?? month,
        next.day ?? day,
      ),
    );
  }

  return (
    <div className="partial-date-input">
      <span className="field-label">{label}</span>
      <div className="partial-date-row">
        <select value={value.precision} onChange={(e) => update({ precision: e.target.value as PartialDate["precision"] })}>
          {DATE_PRECISION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input type="number" placeholder="Day" min={1} max={31} value={day} onChange={(e) => update({ day: e.target.value })} className="partial-date-day" />
        <input type="number" placeholder="Month" min={1} max={12} value={month} onChange={(e) => update({ month: e.target.value })} className="partial-date-month" />
        <input type="number" placeholder="Year" min={1} max={9999} value={year} onChange={(e) => update({ year: e.target.value })} className="partial-date-year" />
      </div>
      {value.display && <span className="partial-date-preview">{value.display}</span>}
    </div>
  );
}
