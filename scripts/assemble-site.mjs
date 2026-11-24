// Combines the apps' independent Vite builds into one dist/ folder
// for a single GitHub Pages deploy — the journal app at the site root (it
// keeps the URL the whole site has always used), Kit Runs, Family Tree and Organise
// as subpaths (matching the `base` each app's vite.config.ts builds with).
// Each app's own Dexie database name and PWA scope keep them fully
// independent even though they share an origin.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const siteDir = path.join(rootDir, "dist");

const apps = [
  { name: "journal", subpath: "" },
  { name: "kit-runs", subpath: "kit-runs" },
  { name: "family-tree", subpath: "family-tree" },
  { name: "organise", subpath: "organise" },
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

// Organise was first published as "Shopping List" at /shopping/. Forward that
// address, and replace its service worker with one that removes itself, so a
// phone that opened the old address doesn't keep serving the old app from cache.
const oldShoppingDir = path.join(siteDir, "shopping");
mkdirSync(oldShoppingDir, { recursive: true });
writeFileSync(
  path.join(oldShoppingDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Organise</title>
<meta http-equiv="refresh" content="0; url=../organise/">
<script>location.replace("../organise/" + location.search)</script>
<p>Moved to <a href="../organise/">Organise</a>.</p>
`,
);
writeFileSync(
  path.join(oldShoppingDir, "sw.js"),
  `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => self.clients.matchAll()).then((clients) => clients.forEach((c) => c.navigate(c.url))),
  );
});
`,
);
console.log("assembled redirect dist/shopping -> dist/organise");
