import { EmbedBuilder } from "discord.js";

const DASHBOARD_URL = "https://ettiganibot-dashboard.com/";

export function createRankingEmbed(title, rankingLines) {
    return new EmbedBuilder()
        .setColor(0x7289DA)
        .setTitle(title)
        .setDescription([
            ...rankingLines,
            "",
            "週間・月間・累計のランキングは、こちらのサイトで確認できます！",
            DASHBOARD_URL,
        ].join("\n"));
}