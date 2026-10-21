interface Props<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}

// A row of big tappable chips — friendlier than a <select> for 3–6 choices.
export default function ChoiceChips<T extends string>({ options, value, onChange, label }: Props<T>) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`chip${value === o.value ? " on" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
