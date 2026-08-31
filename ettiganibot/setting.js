import { dataPath, readJson, writeJson } from "./src/dataPaths.js";

export function loadSettings() {
    return readJson("setting.json", {});
}

export function saveSettings(settings) {
    writeJson("setting.json", settings);
}
