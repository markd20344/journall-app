# Journall

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
These all share one `Item` shape (`kind`, `title`, `body`, `date`, `time`,
`done`, `sourceEntryId`) — fields that don't apply to a given kind are just
left blank (e.g. `done` only matters for Actions, `time` only for Bookings).
Calendar Bookings and Action due-dates also surface on the **Calendar**
page itself (a second dot on the day, and a "Scheduled" section in the day
panel) so the calendar functions as a real day-planner, not just a journal
index. This is intentionally a local record, not a Google Calendar
integration — that would need an OAuth connection to Google's servers,
which is a reasonable phase-2 addition but a separate piece of work from
the local-first core.

## Project structure

```
src/
  types/            Domain types (Entry, Category, Topic)
  db/
    db.ts           Dexie schema + first-run category seeding
    repo.ts         CRUD helpers (createEntry, findOrCreateTopic, ...)
  hooks/
    useJournalData.ts   Live-query React hooks (Dexie reactive queries)
  lib/
    id.ts               uuid / date helpers
    speech.ts           Web Speech API wrapper (voice dictation)
    exportImport.ts      JSON/Markdown export, JSON import, merge logic
    fileSync.ts          File System Access API folder sync
    itemKinds.ts          Spin-off item kind metadata (labels/colors)
    theme.ts               Accent color presets + runtime CSS var application
  components/
    CategorySelect.tsx, TopicTagInput.tsx, VoiceButton.tsx,
    EntryEditor.tsx, EntryCard.tsx, CalendarView.tsx,
    ItemEditor.tsx, ItemCard.tsx, ItemKindBadge.tsx, SpinOffPanel.tsx
  pages/
    WritePage.tsx        Default landing view — fastest path to writing
    CalendarPage.tsx      Month calendar + per-day entries and scheduled items
    LogPage.tsx             Browse/filter spin-off items by kind
    BrowsePage.tsx           Chronological list + search + category/topic filter
    SettingsPage.tsx          Appearance, categories, backup, folder sync
  App.tsx             Nav shell / view switcher
scripts/
  generate-icons.cjs  Generates the PWA app icons (no image lib needed)
```

## Running it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build      # production build to dist/
npm run lint
```

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
