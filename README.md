# Journall OS

A private, local-first journaling app. All entries are stored on your own
device — nothing is sent to a third-party cloud service.

## Tech stack & sync approach

- **React + TypeScript + Vite**, built as an installable **PWA** (works
  offline, add-to-home-screen on phone, launches instantly on desktop).
- **Dexie.js over IndexedDB** as the primary local database. Fast, works
  offline, and is the natural fit for "local-first" on the web.
- **File-folder sync**, not a proprietary cloud backend. In Settings you can
  connect a folder on your filesystem (via the browser's File System Access
  API — Chrome/Edge on desktop and Android). The app writes each entry as a
  self-describing JSON file under `<folder>/entries/*.json`, plus
  `categories.json` and `topics.json`. Point that folder at a directory
  synced by a service you already control — Syncthing, Google Drive, iCloud
  Drive, or a WebDAV/Nextcloud mount — and "Sync now" merges changes between
  devices (last-write-wins per record, by `updatedAt`).
- **Manual JSON/Markdown export & import** as the universal fallback — this
  works on every browser, including iOS Safari, which doesn't support the
  File System Access API yet. Export a JSON file, drop it in your synced
  folder from the phone's Files/Drive app, and import it on the other device.

**Why not a self-hosted server + SQLite?** That would give smoother
real-time sync, but it means running and maintaining a server, and the app
stops working offline unless you build a separate local cache anyway (at
which point you're back to needing a sync/merge layer, just talking to your
own server instead of a folder). The file-sync approach was what the brief
asked for and keeps the whole system to "a browser + a folder you already
sync" — no server to run, patch, or expose. If you later want closer to
real-time multi-device sync, a small self-hosted Node/SQLite server with the
same JSON-file wire format is a natural phase 2 and wouldn't require
changing the data model.

## Data model

```
Category        Topic                Entry
--------        --------------       ------------------------
id              id                   id
name            name                 date (YYYY-MM-DD)
color           categoryId  ───┐     categoryId ───────────┐
createdAt       createdAt      │     topicIds: string[] ───┼──┐
updatedAt       updatedAt      │     body                  │  │
                                │     createdAt             │  │
                                │     updatedAt             │  │
                                └─────────────────────────────┘
                                      (a Topic belongs to one Category;
                                       an Entry references one Category
                                       and zero or more Topics, which
                                       must belong to that Category)
```

- A **Category** is user-editable (Work, Trading, Health, General, or
  whatever you rename/add) and just a name + color.
- A **Topic** ("Diet", "Sleep", "Setups") belongs to exactly one Category and
  is reused across entries — the app suggests existing topics as you type,
  and creates new ones on the fly (`findOrCreateTopic`).
- An **Entry** has a date (which can be any date, not just today), one
  Category, any number of Topics, and free-text body content. Multiple
  entries per day are fully supported since `date` isn't a unique key.
  `createdAt` also stamps the exact time an entry was logged, so same-day
  entries show a chronological time progression in the UI.

### Spin-off items

Beyond free-text entries, you can spin off structured records from a saved
journal entry (or create them standalone from the **Log** page): Lessons
Learned, Actions, Risks, Assumptions, Decisions, and Calendar Bookings.
These all share one `Item` shape (`kind`, `code`, `title`, `body`, `date`,
`time`, `status`, `dependsOnItemId`, `sourceEntryId`) — fields that don't
apply to a given kind are just left blank (e.g. `time` only matters for
Bookings).

Each item gets an auto-assigned sequential code per kind (e.g. `R001`,
`D002`, `AC003`), and a status lifecycle that varies by kind:

| Kind | Statuses |
| --- | --- |
| Lesson Learned | none — just logged |
| Action | Open, On hold, Blocked, Closed |
| Risk | Open, Closed |
| Assumption | Open, Closed |
| Decision | Open, Closed, Blocked |
| Calendar Booking | none — just a booking |

Any item can also be linked to any other item, any kind, any direction
(`linkedItemIds`) — pick one by its code and it's always bidirectional:
link an Action to a Risk from the Action's editor, and the Risk's own card
immediately shows "Linked: AC001 — ..." too, no need to repeat the link
from the other side. Deleting an item cleans up its references on whatever
it was linked to. The Log page filters by kind and status together, with
open/blocked items sorted before closed ones.

Items with a status lifecycle also carry a **status-update log**
(`statusUpdates`) — a running, dated trail of free-text progress notes you
add over time, each stamped with when it was written, shown newest-first
wherever the item appears. When status is set to Closed, a **closure
note** field appears; the closure timestamp (`closedAt`) is set
automatically the moment status becomes Closed (and cleared if reopened),
not something you type in yourself.

The **Calendar** page shows and creates Calendar Bookings and Action
due-dates — no journal entries, which live in Write/Browse instead. This
keeps the calendar a clean "what's scheduled" view rather than a second
index of everything. Bookings are intentionally a local record, not a
Google Calendar integration — that
would need an OAuth connection to Google's servers, which is a reasonable
phase-2 addition but a separate piece of work from the local-first core.

## Kit Runs

A separate module (nav item "Kit Runs") for tracking a daily kit-collection
round: each day a company email lists people to visit and collect kit back
from, and this module takes it from "paste the email" through to "kit
dropped off at BCA Corby."

- **Import** — paste the raw email into the Jobs tab. `lib/kitEmailParser.ts`
  heuristically splits it into one draft per job (preferring "Job Number:" /
  "Ref:" markers as block boundaries where present, falling back to
  postcode-based grouping otherwise) and extracts name/address/postcode/phone
  numbers. Every draft is shown in an editable review step — nothing is
  saved until you confirm — so an imperfect split is a quick fix, not a bad
  record.
- **Route** — the Route tab orders a day's jobs by nearest-neighbor from a
  chosen start point (your current GPS location, a typed postcode, or one of
  the day's own jobs), geocoding postcodes via the free
  [postcodes.io](https://postcodes.io) API. Cards can also be dragged to
  reorder by hand.
- **Per-job tracking** (`KitJobEditor`) — a dated log of contact attempts
  (per phone number: no response / disconnected / delivered no reply /
  replied) and door visits (answered / no answer, with an optional
  compressed evidence photo), a kit-collected form (rucksack, and counts for
  tablets/phones/fuel cards/ID cards/number plates, since any of those can
  come back in varying quantities), and toggles for "included in tonight's
  office email" and "dropped off at BCA Corby." A job's life-cycle stage
  (New → Contacted → Visited → Kit collected → Office emailed → Dropped off)
  is always derived from these fields (`lib/kitStage.ts`), never stored
  separately, so it can't drift out of sync with what's actually logged.
- Data lives in its own `kitJobs` Dexie table and syncs through the same
  Firestore layer as journal entries — see `types/kit.ts`, `db/kitRepo.ts`.

## Family Tree

A shared, invite-only genealogy tree — a separate module from the rest of
this app, which is otherwise entirely private per-account data. The tree
lives in this same Firebase project (one Firestore database, one Storage
bucket), but under its own collections (`trees/family/...`) with its own
security rules, so relatives can be invited to view or contribute without
getting access to your journal, kit runs, or anything else in the app.

### Data model

```
Person                Relationship              FamilyEvent
------                ------------              -----------
id                     id                        id
firstName/middleName   type: parent-child|spouse  personId ──┐
  /lastName/maidenName personA, personB ──┐       type          │
gender                 subtype                    label          │
birth, birthPlace      startDate/Place            date, place    │
death, deathPlace      endDate, endReason         note            │
notes                  (spouse only)                              │
profileMediaId ──┐                                                 │
                  │     FamilyMedia          FamilyRecord           │
                  │     ----------            -----------           │
                  │     id                    id                    │
                  └───▶ storagePath/downloadUrl storagePath/downloadUrl
                        caption, date          recordType, sourceCitation
                        attachedTo: person|event  attachedTo: person|event
```

- **Siblings are never stored** — they're derived on the fly from shared
  `parent-child` links (two people sharing a parent are full siblings if
  they share *all* their listed parents, half-siblings otherwise). This
  keeps the model from ever going out of sync with itself.
- **Photos and records live in Firebase Storage**, not as base64 blobs in
  Firestore — a Firestore document caps out at 1MB, and syncing a few
  thousand photos as inline strings would be both slower and far more
  expensive than a small metadata doc pointing at a Storage file. Every
  photo is resized/re-compressed client-side before upload (`family/storage.ts`)
  to keep storage costs low at family scale; a scanned PDF record uploads
  unmodified since a browser can't cheaply shrink those.
- **Dates are almost always approximate** in genealogy ("c. 1890", "bef.
  1920"), so every date is a `PartialDate` — a best-effort sortable
  `YYYY[-MM[-DD]]`, a precision qualifier (exact/about/before/after/
  estimated), and a human-readable display string — rather than a plain
  ISO date.
- Offline behaviour matches the rest of the app: Dexie is the local
  source of truth (`people`, `relationships`, `familyEvents`,
  `familyMedia`, `familyRecords`, `familyMembers` tables), and
  `firebase/familySync.ts` mirrors it to/from `trees/family/...` in
  Firestore — same last-write-wins-by-`updatedAt`, tombstone-for-deletes
  approach as the rest of the app's Firestore sync (`firebase/sync.ts`),
  just against a shared tree instead of your own private data.

### Roles & sharing

Three roles, stored in `trees/family/members/{uid}`:

- **Viewer** — browse the tree, photos, and records.
- **Contributor** — can also add photos/records/events and edit facts on
  *existing* people, but can't create new people, edit or delete
  relationships (the tree's structure), or delete anything.
- **Owner** — full control: edit relationships, delete people, and manage
  who has access. That's you.

Invite a relative by email (Settings tab inside Family Tree → "People with
access"). They sign in with their own Google account — whichever one uses
that exact email address — and the moment they do, the app turns the
pending invite into membership automatically (`family/role.ts`,
`claimInviteIfAny`). Firestore security rules (`firestore.rules`) are the
real enforcement of all of the above, not just the UI — a contributor
account calling the API directly still can't touch relationships or
delete anything.

**One manual step before anyone can use it**: there's no owner yet the
first time you deploy, and the security rules deliberately don't let
anyone bootstrap themselves into that role (that would be a way to hijack
the tree). Sign into the app once, find your Firebase Auth UID (Firebase
Console → Authentication → Users, or `firebase auth:export`), then create
one document by hand:

```
trees/family/members/{your-uid}
  { uid: "<your-uid>", email: "<your sign-in email>", displayName: "...",
    role: "owner", invitedBy: "", joinedAt: "<ISO timestamp>", updatedAt: "<ISO timestamp>" }
```

(Firebase Console → Firestore → "Start collection" works fine for this —
it's a one-time step, not something the app needs to do again.)

### Tree view

Rendered with [`relatives-tree`](https://github.com/SanichKotikov/relatives-tree),
a small layout-only library purpose-built for genealogy trees — it
computes card positions for a focal person plus their ancestors,
descendants, spouses and siblings (handling remarriages and half-siblings
correctly), and leaves rendering entirely to the caller. That's a better
fit here than a generic D3 hierarchy/tree-diagram library, which typically
assumes a single-parent tree and has no native concept of a couple or a
shared-parent sibling group. `family/treeLayout.ts` converts our
People/Relationships into the node shape it expects (deriving siblings as
above); `components/family/FamilyTreeCanvas.tsx` renders the result as
absolutely-positioned cards with basic pan (scroll) and zoom. Click a card
to view them, double-click to re-center the tree there.

### GEDCOM import

Ancestry (and most other genealogy tools) can export a tree as a standard
GEDCOM `.ged` file: Ancestry → Tree Settings → Export Tree. `family/gedcomImport.ts`
parses it with [`read-gedcom`](https://github.com/arbre-app/read-gedcom)
(a zero-dependency, actively-maintained GEDCOM parser) and maps GEDCOM's
`INDI`/`FAM` records onto People/Relationships — names, sex, birth/death
dates (including `ABT`/`BEF`/`AFT` qualifiers) and places, spouse links
with marriage/divorce dates, and parent-child links for every child in
each family record.

**Photos and scanned documents never come through GEDCOM** — Ancestry's
export deliberately excludes media, so importing only ever produces
people/relationships/dates/places. Add photos and records by hand
afterward (Family Tree → a person → Photos/Records tab) for the people who
matter most; there's no way around this from Ancestry's side.

## Project structure

```
src/
  types/            Domain types (Entry, Category, Topic; kit.ts — KitJob; family.ts — Person, Relationship, ...)
  db/
    db.ts           Dexie schema + first-run category seeding
    repo.ts         CRUD helpers (createEntry, findOrCreateTopic, ...)
    kitRepo.ts      CRUD helpers for the Kit Runs module
  firebase/
    config.ts           Firebase app/auth/firestore/storage init
    auth.ts              Google sign-in
    sync.ts               Per-account private-data sync (users/{uid}/...)
    familySync.ts          Shared family-tree sync (trees/family/...)
  family/
    config.ts            The shared tree's id
    repo.ts               CRUD helpers for people/relationships/events/media/records/members
    role.ts                Membership/role lookups + invite-claim flow
    storage.ts              Photo/record compression + Firebase Storage upload
    treeLayout.ts            Builds relatives-tree nodes, derives siblings
    gedcomImport.ts           GEDCOM → People/Relationships mapping
    gedcomDates.ts             read-gedcom date → PartialDate conversion
    dates.ts                    PartialDate build/format helpers
    personDisplay.ts             Name/lifespan/search-text formatting
    recordTypes.ts                 Record-type dropdown options
  hooks/
    useJournalData.ts   Live-query React hooks (Dexie reactive queries)
    useKitData.ts       Live-query hooks for kit jobs
    useFamilyData.ts     Live-query hooks for the family tree
  lib/
    id.ts               uuid / date helpers
    speech.ts           Web Speech API wrapper (voice dictation)
    exportImport.ts      JSON/Markdown export, JSON import, merge logic
    fileSync.ts          File System Access API folder sync
    itemKinds.ts          Spin-off item kind metadata (labels/colors)
    theme.ts               Accent color presets + runtime CSS var application
    kitEmailParser.ts       Splits a pasted job email into draft jobs
    kitRoute.ts             postcodes.io geocoding + nearest-neighbor ordering
    kitStage.ts             Kit job life-cycle stage + outcome metadata
    photo.ts                Downscale/compress a photo to a small data URL
  components/
    CategorySelect.tsx, TopicTagInput.tsx, VoiceButton.tsx,
    EntryEditor.tsx, EntryCard.tsx, CalendarView.tsx,
    ItemEditor.tsx, ItemCard.tsx, ItemKindBadge.tsx, SpinOffPanel.tsx,
    KitJobCard.tsx, KitImportPanel.tsx, KitJobEditor.tsx, KitRouteView.tsx
    family/
      FamilyTreeCanvas.tsx, PersonDetailPanel.tsx, PersonEditor.tsx,
      RelationshipEditor.tsx, PersonPicker.tsx, PartialDateInput.tsx,
      EventTimeline.tsx, EventEditor.tsx, MediaGallery.tsx, RecordList.tsx,
      MembersPanel.tsx, GedcomImportPanel.tsx, FamilySearchPanel.tsx
  pages/
    WritePage.tsx        Default landing view — fastest path to writing
    CalendarPage.tsx      Month calendar + per-day bookings only
    LogPage.tsx             Browse/filter spin-off items by kind
    BrowsePage.tsx           Chronological list + search + category/topic filter
    KitRunsPage.tsx           Kit-collection round: Jobs + Route tabs
    FamilyTreePage.tsx         Family tree: Tree/Search/Import/Members tabs
    SettingsPage.tsx          Appearance, categories, backup, folder sync
  App.tsx             Nav shell / view switcher
scripts/
  generate-icons.cjs  Generates the PWA app icons (no image lib needed)
firestore.rules        Security rules for both users/{uid}/... and trees/family/...
storage.rules           Security rules for Firebase Storage (Family Tree media)
```

## Running it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build      # production build to dist/
npm run lint
```

### Firebase setup

1. Create a Firebase project, enable Google sign-in (Authentication),
   Firestore, and Storage.
2. Copy your web app config into `.env.local` as `VITE_FIREBASE_*`
   variables (see `src/firebase/config.ts` for the exact names) — this
   file is gitignored (`*.local`), so secrets never get committed.
3. Deploy the security rules: `firebase deploy --only firestore:rules,storage`
   (or paste `firestore.rules`/`storage.rules` into the Firebase Console).
4. If you want the Family Tree module: sign into the app once, then do the
   one-time owner bootstrap described in "Family Tree" → "Roles & sharing"
   above.

## Voice input

Dictation uses the browser's built-in Web Speech API
(`SpeechRecognition` / `webkitSpeechRecognition`) — no custom speech
pipeline. Works well on Chrome/Edge (desktop and Android). Safari/iOS
support is inconsistent (may be unavailable or require a fresh permission
prompt each time); the Dictate button detects this and disables itself with
an explanatory tooltip rather than failing silently. A more robust
cross-browser dictation pipeline is a reasonable phase 2 if this becomes a
pain point.

## Known limitations (v1)

- Folder sync is last-write-wins per record and has no deletion tombstones:
  deleting an entry removes it locally, but a later sync against a folder
  that still has the old file will bring it back. Delete the file from the
  folder too if you need it gone everywhere.
- The File System Access API is Chromium-only today; other browsers fall
  back to manual JSON export/import through your synced folder.
- Invite-by-email (Family Tree) matches the sign-in email exactly as
  Firebase Auth reports it — Firestore security rules have no case-folding
  function to lean on, so an invite has to be typed in the same case the
  person's Google account actually uses (in practice this is essentially
  always already-lowercase, since that's what Google's own sign-in issues).
- The tree view renders every person connected (by any path) to whoever's
  currently centered, all at once — there's no generation-limit/collapse
  yet. Fine well into the hundreds of people; a very large single connected
  tree (several thousand) would be a reasonable place to add a
  generation-limited "load more" mode later.
- GEDCOM export (sending the tree back out) and richer source/citation
  management are intentionally out of scope for now — see the design notes
  in the original brief for what's deferred to a phase 2.
