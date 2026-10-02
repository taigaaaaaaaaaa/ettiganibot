import fs from "fs";
import { formatDate } from "./xpSystem.js";
import { logsPath } from "./dataPaths.js";

function clean(value) {
    return String(value ?? "不明").replace(/\r?\n/g, "\\n");
}

function formatOptions(options = []) {
    return options.map(option => {
        if (option.options) {
            const nestedOptions = formatOptions(option.options);
            return nestedOptions ? `${option.name} ${nestedOptions}` : option.name;
        }

        const value = option.value ?? option.user?.id ?? option.channel?.id ?? option.role?.id ?? option.attachment?.id;
        return `${option.name}=${clean(value)}`;
    }).join(" ");
}

export function logSlashCommand(interaction, { result, durationMs, error } = {}) {
    const now = new Date();
    const fileName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.log`;
    const lines = [
        "--- スラッシュコマンドログ ---",
        `日時: ${formatDate()}`,
        `コマンド: /${clean(interaction.commandName)}`,
        `引数: ${formatOptions(interaction.options?.data) || "なし"}`,
        `ユーザー: ${clean(interaction.user?.tag ?? interaction.user?.username)} (${clean(interaction.user?.id)})`,
        `サーバー: ${clean(interaction.guild?.name)} (${clean(interaction.guildId)})`,
        `チャンネル: ${clean(interaction.channel?.name)} (${clean(interaction.channelId)})`,
        `結果: ${clean(result)}`,
        `実行時間: ${Number.isFinite(durationMs) ? `${durationMs}ms` : "不明"}`,
        ...(error ? [`エラー: ${clean(error)}`] : []),
        ""
    ];

    console.log(lines.join("\n"));
    fs.appendFileSync(logsPath(fileName), `${lines.join("\n")}\n`, "utf8");
}