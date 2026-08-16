import { db } from "../db/db";
import type { Category, Entry, Topic } from "../types";

export interface JournalDump {
  exportedAt: string;
  categories: Category[];
  topics: Topic[];
  entries: Entry[];
}

export async function buildDump(): Promise<JournalDump> {
  const [categories, topics, entries] = await Promise.all([
    db.categories.toArray(),
    db.topics.toArray(),
    db.entries.toArray(),
  ]);
  return { exportedAt: new Date().toISOString(), categories, topics, entries };
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportAsJson(): Promise<void> {
  const dump = await buildDump();
  const stamp = new Date().toISOString().slice(0, 10);
  download(`journal-export-${stamp}.json`, JSON.stringify(dump, null, 2), "application/json");
}

export async function exportAsMarkdown(): Promise<void> {
  const dump = await buildDump();
  const categoryById = new Map(dump.categories.map((c) => [c.id, c]));
  const topicById = new Map(dump.topics.map((t) => [t.id, t]));

  const sorted = [...dump.entries].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  const lines: string[] = [`# Journal export`, "", `_Exported ${dump.exportedAt}_`, ""];
  let currentDate = "";
  for (const entry of sorted) {
    if (entry.date !== currentDate) {
      currentDate = entry.date;
      lines.push(`## ${currentDate}`, "");
    }
    const category = categoryById.get(entry.categoryId);
    const topicNames = entry.topicIds.map((id) => topicById.get(id)?.name).filter(Boolean);
    const metaParts = [category?.name, ...topicNames].filter(Boolean);
    lines.push(`### ${metaParts.join(" · ") || "Untitled"}`, "");
    lines.push(entry.body, "");
  }

  const stamp = new Date().toISOString().slice(0, 10);
  download(`journal-export-${stamp}.md`, lines.join("\n"), "text/markdown");
}

/**
 * Merge a dump into the local database. Uses last-write-wins on `updatedAt`
 * per record, keyed by id (categories/topics also dedupe by name so re-imports
 * from a synced folder don't create duplicates).
 */
export async function importDump(dump: JournalDump): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;

  await db.transaction("rw", db.categories, db.topics, db.entries, async () => {
    for (const category of dump.categories) {
      const existing = await db.categories.get(category.id);
      if (!existing) {
        await db.categories.put(category);
        added++;
      } else if (category.updatedAt > existing.updatedAt) {
        await db.categories.put(category);
        updated++;
      }
    }
    for (const topic of dump.topics) {
      const existing = await db.topics.get(topic.id);
      if (!existing) {
        await db.topics.put(topic);
        added++;
      } else if (topic.updatedAt > existing.updatedAt) {
        await db.topics.put(topic);
        updated++;
      }
    }
    for (const entry of dump.entries) {
      const existing = await db.entries.get(entry.id);
      if (!existing) {
        await db.entries.put(entry);
        added++;
      } else if (entry.updatedAt > existing.updatedAt) {
        await db.entries.put(entry);
        updated++;
      }
    }
  });

  return { added, updated };
}

export function readFileAsJson(file: File): Promise<JournalDump> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
