import type { Circle, CompanyStatus, CompanyType, NoteType } from "../types";

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
