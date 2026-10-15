# CLAUDE.md

Guidance for working in this repo. It's a monorepo of personal PWAs that
share one Firebase project:

| App | Path | Hosting | Store |
| --- | --- | --- | --- |
| **Mumu** (personal CRM + journal; the active project) | `apps/mumu` | Firebase Hosting (`<project>.web.app`) | Firestore + its offline cache |
| Journall OS (being retired into Mumu, Phase 5) | `apps/journal` | GitHub Pages `/journall-app/` | Dexie, synced to Firestore |
| Kit Runs | `apps/kit-runs` | GitHub Pages `/journall-app/kit-runs/` | Dexie, synced to Firestore |
| Family Tree (shared with relatives) | `apps/family-tree` | GitHub Pages `/journall-app/family-tree/` | Dexie, synced to `trees/family` |

`packages/shared` holds auth (`AuthGate`), Firebase config, toast, update
prompt, error boundary, voice dictation and small helpers. Changes there must
stay backwards-compatible for all four apps; Mumu-only behaviour goes behind an
env flag (see `apps/mumu/.env`).

The rest of this file is about **Mumu**. The README covers the other apps.

## Stack

- React 19, TypeScript, Vite 8, `vite-plugin-pwa` (`registerType: 'prompt'`)
- `react-router` (library mode, `BrowserRouter`); every record has a URL
- Firebase: Auth (Google sign-in, single owner), Firestore with
  `persistentLocalCache` + multi-tab manager (the offline store, no Dexie)
- Firebase Hosting, deployed by `.github/workflows/deploy-mumu.yml`
- Tests: Vitest (unit, `apps/mumu/src/**/*.test.ts`), rules tests
  (`tests/rules`, Firestore emulator), Playwright e2e (`apps/mumu/e2e`,
  Auth + Firestore emulators)
- Lint: oxlint (root `.oxlintrc.json`)

## Commands

```bash
npm run dev:mumu:emulator   # app against local emulators (run `npm run emulators` first)
npm run dev:mumu            # app against the real project (needs apps/mumu/.env.local)
npm run test:mumu           # unit tests
npm run test:rules          # security rules tests (starts the Firestore emulator)
npm run test:e2e:mumu       # Playwright e2e (starts Auth + Firestore emulators)
npm run build:mumu          # typecheck + production build
npm run lint
```

In a cloud session, Playwright's own browser download is unavailable; use
`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e:mumu`.
In emulator mode, `window.__mumuTestSignIn()` signs in without the fake Google
popup (emulator builds only).

### Running locally against the real project

Create `apps/mumu/.env.local` (gitignored) with the `VITE_FIREBASE_*` values
from Firebase console → Project settings → Your apps, and optionally
`VITE_OWNER_UID`.

## Architecture

```
apps/mumu/src/
  types.ts            domain types, one per collection
  data/store.ts       one onSnapshot listener per collection -> in-memory state -> useSyncExternalStore hooks
  data/repo.ts        the ONLY module that writes to Firestore
  data/selectors.ts   derived views (notes for a record, people at a company, tags, picker options)
  data/syncStatus.ts  offline / pending / error state for the header badge
  lib/                pure helpers (format, search, labels, blanks, dates) + small hooks
  components/         Layout (tab bar / sidebar), NoteCard, GoBackCard, pickers...
  pages/              one file per route
```

- **Reads**: screens read from the in-memory store via hooks
  (`useCollection`, `useRecord`). Lists, filters and search are computed
  client-side. That's fine for a single user with thousands of records; don't
  add Firestore queries or indexes unless the data outgrows it.
- **Writes**: `createRecord` / `updateRecord` / `softDelete` / `restore` in
  `data/repo.ts`. They are fire-and-forget. A Firestore write promise only
  resolves when the server acknowledges it, which never happens offline, but
  the local cache and the UI update immediately. **Never `await` a write in
  UI code.**
- `updateRecord` merges (`setDoc(..., { merge: true })`), so fields Mumu
  doesn't know about survive an edit. This matters for the Journall
  collections Mumu will adopt.
- **Deletes are soft** (`deleted: true`). Every list shows `live` records;
  Trash (More tab) shows the rest. Nothing is purged automatically.
  Journall-style tombstones (`{ id, deleted: true, updatedAt }`) are
  compatible.
- **Timestamps** are ISO strings (`createdAt`, `updatedAt`, `occurredAt`),
  matching Journall. Calendar-type dates are stored as plain `YYYY-MM-DD` or
  month/day, never as timestamps (see the data model). All date maths goes
  through `lib/dates.ts`, which works in UTC on `YYYY-MM-DD` strings, with
  "today" from `todayLocal()`. A 29 February date falls on 28 February in
  non-leap years. The Phase 4 digest must reuse these functions.

## Data model

All data is at `users/{uid}/{collection}/{id}`. Every doc has `id`,
`createdAt`, `updatedAt` and `deleted?`.

| Collection | Fields | Phase |
| --- | --- | --- |
| `companies` | `name`, `type` (employer, client, agency, supplier, other), `status` (active, prospect, past, dormant), `address`, `postcode`, `website`, `summary`, `tags[]` | 1 |
| `people` | `firstName`, `lastName`, `nickname`, `circle` (work, personal, both), `relationship`, `companyLinks[{companyId, role, current}]`, `companyIds[]` (derived from `companyLinks` on every save), `phones[{id, label, number}]`, `emails[{id, label, address}]`, `address`, `summary`, `tags[]` | 1 |
| `notes` | `body`, `type` (general, if-i-go-back, call, meeting, email, idea), `companyIds[]`, `personIds[]`, `engagementIds[]`, `tags[]`, `pinned`, `occurredAt` | 1 |
| `engagements` | `companyId`, `title`, `myRole`, `startDate`, `endDate \| null`, `whatIDid`, `howIGotIt`, `viaCompanyId?`, `viaPersonId?`, `keyContactIds[]`, `rate?`, `tags[]` | 2 |
| `importantDates` | `personId`, `kind` (birthday, anniversary, other), `label`, `month`, `day`, `year \| null`, `warnDays[]` (default `[14, 3, 0]`) | 2 |
| `entries`, `categories`, `topics` | Journall's existing docs, read where they are (no migration). Entries gain optional `personIds[]`, `companyIds[]` | 3 |
| `items`, `books`, `quickCaptures`, `itemAttachments` | Journall's existing docs, read where they are | 5 |
| `settings/recent` | `refs[{kind: person \| company \| engagement, id, at}]`, newest first, max 12 (`trackView` in `repo.ts`) | 2 |
| `settings/reminders` | `email`, `enabled`, `hour` | 4 |

Rules for the model:
- A note can link to any mix of companies, people and engagements, and shows
  on each one's page.
- `if-i-go-back` notes show in the gold card at the top of every linked
  company or person page, not in the page's notes list.
- Tags are lower-case, trimmed, single-spaced (`normaliseTag`).
- New fields need a default in `lib/blanks.ts`. Forms spread the blank under
  the stored record, so older docs that lack the field don't crash.

## Security

- `firestore.rules` / `storage.rules`: `users/{uid}/**` is readable and
  writable only by `ownerUid()`. While that's still the `SET_OWNER_UID`
  placeholder, the rules fall back to "each user reaches only their own uid".
  Family Tree's `trees/**` rules are separate and must keep working for
  invited relatives. `tests/rules` covers both.
- The repo is **public**: never commit emails, API secrets or service-account
  keys. A Firebase UID is fine to commit. Firebase web config (`VITE_FIREBASE_*`)
  is public by design but is kept in GitHub secrets anyway.
- Client lock: `VITE_OWNER_UID` (GitHub secret `MUMU_OWNER_UID`) makes
  `AuthGate` sign any other account straight back out. The rules are the real
  enforcement.

## Conventions

- Mobile first. Base font is 18px, tap targets are at least 48px
  (`--tap`), inputs are at least 16px (so iOS doesn't zoom), and respect
  `env(safe-area-inset-*)`. Bottom tab bar under 900px, sidebar above.
- Colours come only from the CSS custom properties in `styles.css`, with a
  dark-mode override for each.
- List filters live in the URL (`useParamState`), so Back restores them.
- Search uses `lib/search.ts` (`matches`, `fold`), which ignores accents and
  apostrophes, so "sean oriordan" finds "Seán O'Riordan".
- Interactive elements need unambiguous accessible names; e2e tests select by
  role and name. e2e tests share one emulator and reset it in `beforeEach`,
  so they run with `workers: 1`. Wait for a saved record to show on screen
  before a full page load (`page.goto`), or the local write can be lost.
- UK English in the UI, `en-GB` date formats, Europe/London.
- Comments explain *why*, matching the existing code's density.
- Commit after each working step. Run `npm run lint`, `npx tsc -b apps/mumu`
  and the relevant tests before committing.

## Build phases

1. Auth, companies, people, notes. **Done.**
2. Engagements, important dates, Home dashboard (upcoming 30 days, pinned,
   current work, recently viewed). **Done.**
3. Calendar (month + agenda), journal on the existing Journall entries,
   global search.
4. Daily email digest (scheduled Cloud Function, Blaze plan, Gmail app
   password in Secret Manager), JSON export/import, vCard (iCloud) and CSV
   contact import, polish.
5. Retire Journall OS: port Log items, Books, Markets and Quick Capture;
   per-device "everything is in the cloud" check; redirect `/journall-app/`.

Firebase console setup is in `docs/FIREBASE_SETUP.md`.
