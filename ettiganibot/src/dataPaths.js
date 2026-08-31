import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JSON とログの保存先を統一して、ルート直下の散在を防ぐ
export const DATA_DIR = path.join(__dirname, "..", "data");

export function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    return DATA_DIR;
}

export function dataPath(fileName) {
    ensureDataDir();
    return path.join(DATA_DIR, fileName);
}

export function logsPath(fileName) {
    const logsDir = path.join(DATA_DIR, "logs");
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
    return path.join(logsDir, fileName);
}

// guild ごとのデータを分けて管理するためのディレクトリ
export function guildDataDir(guildId) {
    const safeGuildId = String(guildId || "DM");
    const dir = path.join(DATA_DIR, "guilds", safeGuildId);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

export function guildDataPath(guildId, fileName = "DeletedMessage.json") {
    return path.join(guildDataDir(guildId), fileName);
}

export function readJson(fileName, fallback = {}) {
    const file = dataPath(fileName);
    if (!fs.existsSync(file)) {
        return typeof fallback === "function" ? fallback() : fallback;
    }

    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return typeof fallback === "function" ? fallback() : fallback;
    }
}

export function writeJson(fileName, value) {
    ensureDataDir();
    fs.writeFileSync(dataPath(fileName), JSON.stringify(value, null, 2));
}
