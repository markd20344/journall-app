import { db } from "../db/db";

const SETTINGS_KEY = "accentColor";

export const DEFAULT_ACCENT = "#2563eb"; // professional blue

export interface AccentPreset {
  name: string;
  hex: string;
}

// A small curated set of "professional" accent options — not a full color
// wheel, since this is meant to stay simple for a personal app.
export const ACCENT_PRESETS: AccentPreset[] = [
  { name: "Blue", hex: "#2563eb" },
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Slate", hex: "#475569" },
  { name: "Teal", hex: "#0d9488" },
  { name: "Emerald", hex: "#059669" },
  { name: "Graphite", hex: "#374151" },
];

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** Applies an accent color as CSS custom properties on the document root. */
export function applyAccentColor(hex: string): void {
  const rgb = hexToRgb(hex);
  const contrast = relativeLuminance(rgb) > 0.45 ? "#0b0b0f" : "#ffffff";
  const isDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const bgAlpha = isDark ? 0.2 : 0.1;

  const root = document.documentElement.style;
  root.setProperty("--accent", hex);
  root.setProperty("--accent-contrast", contrast);
  root.setProperty("--accent-bg", `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${bgAlpha})`);
}

export async function getStoredAccentColor(): Promise<string> {
  const record = await db.settings.get(SETTINGS_KEY);
  return (record?.value as string | undefined) ?? DEFAULT_ACCENT;
}

export async function setStoredAccentColor(hex: string): Promise<void> {
  await db.settings.put({ key: SETTINGS_KEY, value: hex });
  applyAccentColor(hex);
}

/** Call once on app startup to apply the saved (or default) accent color. */
export async function applyStoredAccentColor(): Promise<void> {
  const hex = await getStoredAccentColor();
  applyAccentColor(hex);
}
