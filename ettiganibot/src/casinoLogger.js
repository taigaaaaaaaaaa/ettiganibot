import fs from "fs";
import { formatDate } from "./xpSystem.js";
import { logsPath } from "./dataPaths.js";

function clean(value) {
    return String(value ?? "不明").replace(/\r?\n/g, "\\n");
}

export function logCasinoEvent(interaction, command, details = {}) {
    const now = new Date();
    const fileName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.log`;
    const logPath = logsPath(fileName);
    const lines = [
        "--- カジノログ ---",
        `日時: ${formatDate()}`,
        `コマンド: /${clean(command)}`,
        `ユーザー: ${clean(interaction.user?.tag ?? interaction.user?.username)} (${clean(interaction.user?.id)})`,
        `サーバー: ${clean(interaction.guild?.name)} (${clean(interaction.guildId)})`,
        `チャンネル: ${clean(interaction.channel?.name)} (${clean(interaction.channelId)})`,
        ...Object.entries(details).map(([key, value]) => `${key}: ${clean(value)}`),
        ""
    ];

    fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf8");
}
