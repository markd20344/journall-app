interface Props {
  options: Array<{ value: string; label: string }>;
  value: string; // "" = all
  onChange: (value: string) => void;
  allLabel?: string;
  label: string;
}

export default function FilterChips({ options, value, onChange, allLabel = "All", label }: Props) {
  return (
    <div className="chips" role="group" aria-label={label}>
      <button type="button" className={`chip${value === "" ? " on" : ""}`} onClick={() => onChange("")}>
        {allLabel}
      </button>
      {options.map((o) => (
        <button key={o.value} type="button" className={`chip${value === o.value ? " on" : ""}`} onClick={() => onChange(value === o.value ? "" : o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
