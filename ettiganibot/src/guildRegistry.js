import { writeJson } from "./dataPaths.js";

export function syncGuildRegistry(guilds) {
    const registry = Object.fromEntries(
        [...guilds].map(guild => [guild.id, { name: guild.name }])
    );
    writeJson("guilds.json", registry);
}