import type { Circle, CompanyStatus, CompanyType, DateKind, ImportantDate, NoteType } from "../types";

export const COMPANY_TYPES: Array<{ value: CompanyType; label: string }> = [
  { value: "employer", label: "Employer" },
  { value: "client", label: "Client" },
  { value: "agency", label: "Agency" },
  { value: "supplier", label: "Supplier" },
  { value: "other", label: "Other" },
];

export const COMPANY_STATUSES: Array<{ value: CompanyStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "prospect", label: "Prospect" },
  { value: "past", label: "Past" },
  { value: "dormant", label: "Dormant" },
];

export const CIRCLES: Array<{ value: Circle; label: string }> = [
  { value: "work", label: "Work" },
  { value: "personal", label: "Personal" },
  { value: "both", label: "Both" },
];

export const NOTE_TYPES: Array<{ value: NoteType; label: string; icon: string }> = [
  { value: "general", label: "Note", icon: "📝" },
  { value: "if-i-go-back", label: "If I go back", icon: "↩️" },
  { value: "call", label: "Call", icon: "📞" },
  { value: "meeting", label: "Meeting", icon: "🤝" },
  { value: "email", label: "Email", icon: "✉️" },
  { value: "idea", label: "Idea", icon: "💡" },
];

export const PHONE_LABELS = ["mobile", "work", "home", "other"];
export const EMAIL_LABELS = ["personal", "work", "other"];

export function labelFor<T extends string>(options: Array<{ value: T; label: string }>, value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function noteTypeMeta(type: NoteType) {
  return NOTE_TYPES.find((t) => t.value === type) ?? NOTE_TYPES[0];
}

export const DATE_KINDS: Array<{ value: DateKind; label: string; icon: string }> = [
  { value: "birthday", label: "Birthday", icon: "🎂" },
  { value: "anniversary", label: "Anniversary", icon: "💍" },
  { value: "other", label: "Other", icon: "📅" },
];

export const WARN_DAY_OPTIONS = [
  { value: 0, label: "On the day" },
  { value: 1, label: "1 day before" },
  { value: 3, label: "3 days before" },
  { value: 7, label: "1 week before" },
  { value: 14, label: "2 weeks before" },
  { value: 30, label: "1 month before" },
];

/** "Birthday", "Wedding anniversary"... */
export function dateTitle(d: Pick<ImportantDate, "kind" | "label">): string {
  if (d.label.trim()) return d.label.trim();
  return DATE_KINDS.find((k) => k.value === d.kind)?.label ?? "Date";
}

export function dateIcon(kind: DateKind): string {
  return DATE_KINDS.find((k) => k.value === kind)?.icon ?? "📅";
}
