// File-folder sync: reads/writes plain JSON files inside a folder the user
// picks (e.g. a Syncthing, Google Drive, or iCloud Drive folder mounted on
// this device). The browser's File System Access API only ships in
// Chromium-based desktop browsers today, so this is a "when available"
// enhancement layered on top of manual JSON export/import, which works
// everywhere (including iOS Safari).
//
// Folder layout written/read here:
//   <folder>/categories.json
//   <folder>/topics.json
//   <folder>/entries/<date>__<id>.json
//   <folder>/items/<date>__<id>.json
//   <folder>/books/<dateAdded>__<id>.json
//
// Each entries/*.json, items/*.json and books/*.json file is fully
// self-describing (includes category/topic names, linked-item ids, or the
// resized cover image inline, not just internal ids) so it stays
// human-readable and useful even without this app.
import { db } from "../db/db";
import type { Book, Category, Entry, Item, Topic } from "../types";
import { importDump, type JournalDump } from "./exportImport";

const SETTINGS_KEY = "syncDirectoryHandle";

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const record = await db.settings.get(SETTINGS_KEY);
  return (record?.value as FileSystemDirectoryHandle | undefined) ?? null;
}

async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await db.settings.put({ key: SETTINGS_KEY, value: handle });
}

export async function forgetDirectoryHandle(): Promise<void> {
  await db.settings.delete(SETTINGS_KEY);
}

export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  mode: "read" | "readwrite" = "readwrite",
): Promise<boolean> {
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  if ((await handle.requestPermission(opts)) === "granted") return true;
  return false;
}

export async function pickSyncFolder(): Promise<FileSystemDirectoryHandle> {
  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  await saveDirectoryHandle(handle);
  return handle;
}

async function readJsonFile<T>(dir: FileSystemDirectoryHandle, name: string): Promise<T | null> {
  try {
    const fileHandle = await dir.getFileHandle(name);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(dir: FileSystemDirectoryHandle, name: string, data: unknown): Promise<void> {
  const fileHandle = await dir.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

function entryFileName(entry: Entry): string {
  return `${entry.date}__${entry.id}.json`;
}

function itemFileName(item: Item): string {
  return `${item.date}__${item.id}.json`;
}

function bookFileName(book: Book): string {
  return `${book.dateAdded}__${book.id}.json`;
}

/** Pull: read the folder's contents and merge them into the local database. */
export async function pullFromFolder(root: FileSystemDirectoryHandle): Promise<{ added: number; updated: number }> {
  const categories = (await readJsonFile<Category[]>(root, "categories.json")) ?? [];
  const topics = (await readJsonFile<Topic[]>(root, "topics.json")) ?? [];

  const entries: Entry[] = [];
  try {
    const entriesDir = await root.getDirectoryHandle("entries");
    for await (const [name, handle] of entriesDir.entries()) {
      if (handle.kind !== "file" || !name.endsWith(".json")) continue;
      const file = await handle.getFile();
      try {
        entries.push(JSON.parse(await file.text()) as Entry);
      } catch {
        // Skip unreadable/corrupt files rather than aborting the whole sync.
      }
    }
  } catch {
    // No entries/ subdirectory yet — nothing to pull.
  }

  const items: Item[] = [];
  try {
    const itemsDir = await root.getDirectoryHandle("items");
    for await (const [name, handle] of itemsDir.entries()) {
      if (handle.kind !== "file" || !name.endsWith(".json")) continue;
      const file = await handle.getFile();
      try {
        items.push(JSON.parse(await file.text()) as Item);
      } catch {
        // Skip unreadable/corrupt files rather than aborting the whole sync.
      }
    }
  } catch {
    // No items/ subdirectory yet — nothing to pull.
  }

  const books: Book[] = [];
  try {
    const booksDir = await root.getDirectoryHandle("books");
    for await (const [name, handle] of booksDir.entries()) {
      if (handle.kind !== "file" || !name.endsWith(".json")) continue;
      const file = await handle.getFile();
      try {
        books.push(JSON.parse(await file.text()) as Book);
      } catch {
        // Skip unreadable/corrupt files rather than aborting the whole sync.
      }
    }
  } catch {
    // No books/ subdirectory yet — nothing to pull.
  }

  const dump: JournalDump = { exportedAt: new Date().toISOString(), categories, topics, entries, items, books };
  return importDump(dump);
}

/** Push: write the full local database out to the folder as individual files. */
export async function pushToFolder(root: FileSystemDirectoryHandle): Promise<void> {
  const [categories, topics, entries, items, books] = await Promise.all([
    db.categories.toArray(),
    db.topics.toArray(),
    db.entries.toArray(),
    db.items.toArray(),
    db.books.toArray(),
  ]);

  await writeJsonFile(root, "categories.json", categories);
  await writeJsonFile(root, "topics.json", topics);

  const entriesDir = await root.getDirectoryHandle("entries", { create: true });
  for (const entry of entries) {
    const fileHandle = await entriesDir.getFileHandle(entryFileName(entry), { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(entry, null, 2));
    await writable.close();
  }

  const itemsDir = await root.getDirectoryHandle("items", { create: true });
  for (const item of items) {
    const fileHandle = await itemsDir.getFileHandle(itemFileName(item), { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(item, null, 2));
    await writable.close();
  }

  const booksDir = await root.getDirectoryHandle("books", { create: true });
  for (const book of books) {
    const fileHandle = await booksDir.getFileHandle(bookFileName(book), { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(book, null, 2));
    await writable.close();
  }
}

/**
 * Two-way sync: pull first so newer changes made on another device aren't
 * clobbered, then push the (now-merged) local state back out.
 *
 * Note: this is last-write-wins per record with no deletion tombstones —
 * deleting an entry on one device won't remove it from the folder or other
 * devices automatically. Delete from the folder too (or re-export) if you
 * need that.
 */
export async function syncWithFolder(
  root: FileSystemDirectoryHandle,
): Promise<{ added: number; updated: number }> {
  const result = await pullFromFolder(root);
  await pushToFolder(root);
  return result;
}
