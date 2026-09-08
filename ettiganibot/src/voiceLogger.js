import fs from "fs";
import { logsPath } from "./dataPaths.js";

function clean(value) {
    return String(value ?? "不明").replace(/\r?\n/g, "\\n");
}

function getLogPath() {
    const now = new Date();
    const fileName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.log`;
    return logsPath(fileName);
}

export function logVoiceEvent(event, details = {}) {
    const now = new Date();
    const timestamp = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    const lines = [
        "--- VC・読み上げログ ---",
        `日時: ${timestamp}`,
        `イベント: ${clean(event)}`,
        ...Object.entries(details).map(([key, value]) => `${key}: ${clean(value)}`),
        ""
    ];

    fs.appendFileSync(getLogPath(), `${lines.join("\n")}\n`, "utf8");
}
