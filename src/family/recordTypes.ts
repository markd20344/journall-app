import type { RecordType } from "../types/family";

export const RECORD_TYPE_OPTIONS: Array<{ value: RecordType; label: string }> = [
  { value: "birth_certificate", label: "Birth certificate" },
  { value: "death_certificate", label: "Death certificate" },
  { value: "marriage_certificate", label: "Marriage certificate" },
  { value: "census", label: "Census" },
  { value: "immigration", label: "Immigration" },
  { value: "military", label: "Military" },
  { value: "other", label: "Other" },
];

export function recordTypeLabel(type: RecordType): string {
  return RECORD_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}
