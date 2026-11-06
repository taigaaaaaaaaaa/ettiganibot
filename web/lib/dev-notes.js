import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

let writeQueue = Promise.resolve();

function getNotesPath() {
  return process.env.DEV_NOTES_FILE || path.resolve(process.cwd(), "app/data/dev-notes.json");
}

function getBundledNotesPath() {
  return path.resolve(process.cwd(), "app/data/dev-notes.json");
}

function readNotesFile(filePath) {
  const contents = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  if (!contents.trim()) throw new Error("Developer notes file is empty.");
  const notes = JSON.parse(contents);
  if (!Array.isArray(notes)) throw new Error("Developer notes data must be a JSON array.");
  return notes;
}

export function getDevNotes({ includeUnpublished = false } = {}) {
  const notesPath = getNotesPath();
  let notes = null;
  try {
    notes = readNotesFile(notesPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Developer notes could not be read; trying the bundled notes file.", {
        filePath: notesPath,
        error: error.message,
      });
    }
    if (path.resolve(notesPath) !== getBundledNotesPath()) {
      try {
        notes = readNotesFile(getBundledNotesPath());
      } catch (fallbackError) {
        if (fallbackError.code !== "ENOENT") {
          console.error("Bundled developer notes could not be read.", {
            filePath: getBundledNotesPath(),
            error: fallbackError.message,
          });
        }
      }
    }
  }
  if (!notes) return [];

  const validNotes = notes.filter((note) => {
    const valid =
      note &&
      typeof note === "object" &&
      typeof note.slug === "string" &&
      typeof note.title === "string" &&
      typeof note.category === "string" &&
      typeof note.body === "string";
    if (!valid) console.error("Skipping an invalid developer note entry.");
    return valid;
  });
  return validNotes
    .filter(
      (note) =>
        includeUnpublished ||
        (note.isPublished !== false &&
          (!note.publishedAt || new Date(note.publishedAt).getTime() <= Date.now())),
    )
    .sort(
      (a, b) =>
        new Date(b.publishedAt || b.date).getTime() - new Date(a.publishedAt || a.date).getTime(),
    );
}

export function getDevNote(slug, options) {
  return getDevNotes(options).find((note) => note.slug === slug) || null;
}

export function updateDevNotes(update) {
  const operation = writeQueue.then(async () => {
    const notes = getDevNotes({ includeUnpublished: true });
    const result = await update(notes);
    const filePath = getNotesPath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(notes, null, 2), "utf8");
    fs.renameSync(temporaryPath, filePath);
    return result;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

export function createDevNoteSlug(title) {
  const slug = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return slug || `note-${randomUUID().slice(0, 8)}`;
}

export function sanitizeMarkdown(value) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}
