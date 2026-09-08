// Combines the three apps' independent Vite builds into one dist/ folder
// for a single GitHub Pages deploy — the journal app at the site root (it
// keeps the URL the whole site has always used), Kit Runs and Family Tree
// as subpaths (matching the `base` each app's vite.config.ts builds with).
// Each app's own Dexie database name and PWA scope keep them fully
// independent even though they share an origin.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const siteDir = path.join(rootDir, "dist");

const apps = [
  { name: "journal", subpath: "" },
  { name: "kit-runs", subpath: "kit-runs" },
  { name: "family-tree", subpath: "family-tree" },
];

rmSync(siteDir, { recursive: true, force: true });
mkdirSync(siteDir, { recursive: true });

for (const app of apps) {
  const builtDir = path.join(rootDir, "apps", app.name, "dist");
  if (!existsSync(builtDir)) {
    throw new Error(`${app.name}: no dist/ found at ${builtDir} — did its build step run and succeed?`);
  }
  const destDir = app.subpath ? path.join(siteDir, app.subpath) : siteDir;
  mkdirSync(destDir, { recursive: true });
  cpSync(builtDir, destDir, { recursive: true });
  console.log(`assembled ${app.name} -> dist/${app.subpath}`);
}
