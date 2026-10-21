// Small inline stroke icons for navigation, so there's no icon-font download.
const PATHS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  people: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.2a3.25 3.25 0 0 1 0 6.1",
  companies: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M2 21h20M8 8h3M8 12h3M8 16h3",
  notes: "M6 3h9l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v6h6M8.5 13h7M8.5 17h5",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};

export default function Icon({ name }: { name: keyof typeof PATHS | string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === "more" ? 3.2 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
