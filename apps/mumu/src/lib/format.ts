import type { Person } from "../types";

export function personName(p: Pick<Person, "firstName" | "lastName" | "nickname">): string {
  const full = [p.firstName, p.lastName].map((s) => s.trim()).filter(Boolean).join(" ");
  return full || p.nickname.trim() || "(no name)";
}

export function initials(name: string): string {
  const parts = name.replace(/[()]/g, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** tel: href — keeps a leading + and digits only, so "07700 900 123" dials. */
export function telHref(number: string): string {
  const trimmed = number.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

export function smsHref(number: string): string {
  return telHref(number).replace(/^tel:/, "sms:");
}

export function mailHref(address: string): string {
  return `mailto:${address.trim()}`;
}

/** Accepts "acme.co.uk" as well as a full URL. Empty string if unusable. */
export function websiteHref(website: string): string {
  const w = website.trim();
  if (!w) return "";
  return /^https?:\/\//i.test(w) ? w : `https://${w}`;
}

export function websiteLabel(website: string): string {
  return website.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

/** Google Maps search link for an address, opens Apple/Google Maps on phone. */
export function mapsHref(address: string, postcode = ""): string {
  const q = [address, postcode].map((s) => s.trim()).filter(Boolean).join(", ").replace(/\n+/g, ", ");
  return q ? `https://maps.google.com/?q=${encodeURIComponent(q)}` : "";
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dateFmt.format(d);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${dateFmt.format(d)}, ${timeFmt.format(d)}`;
}

/** ISO timestamp -> value for <input type="datetime-local"> in local time. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Normalises a tag: trimmed, lower-case, single spaces. */
export function normaliseTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, " ");
}
