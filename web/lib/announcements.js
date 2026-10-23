import fs from "node:fs";
import path from "node:path";

export function getAnnouncements() {
  const filePath =
    process.env.ANNOUNCEMENTS_FILE || path.resolve(process.cwd(), "app/data/announcements.json");

  try {
    const notices = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!Array.isArray(notices)) return [];

    return notices.filter(
      (notice) =>
        notice &&
        typeof notice.title === "string" &&
        notice.title.trim() &&
        typeof notice.body === "string" &&
        notice.body.trim(),
    );
  } catch {
    return [];
  }
}

export function getAnnouncementLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
