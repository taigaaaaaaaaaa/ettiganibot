import { loadSettings } from "../setting.js";
import { readJson } from "./dataPaths.js";
import { createRankingEmbed } from "./rankingEmbed.js";
import { getRankingChannel } from "./rankingChannel.js";

export async function sendCasinoRanking(client) {
    try {
        const settings = loadSettings();
        const casinoData = readJson("casino.json", {});
        const ranked = Object.entries(casinoData)
            .filter(([, account]) => Number.isFinite(account?.periods?.today) && account.periods.today !== 0)
            .sort(([, left], [, right]) => right.periods.today - left.periods.today)
            .slice(0, 5);

        for (const guild of client.guilds.cache.values()) {
            const guildId = guild.id;
            const channel = await getRankingChannel(client, guild, settings);
            if (!channel) {
                console.log(`ettigani$ランキング：${guildId} の送信先が見つからない`);
                continue;
            }

            if (ranked.length === 0) {
                await channel.send({
                    embeds: [createRankingEmbed("今日のettigani$ランキング", ["ランキングデータはありませんでした。"])]
                });
                continue;
            }

            const lines = [];
            for (let index = 0; index < ranked.length; index++) {
                const [userId, account] = ranked[index];
                const user = await client.users.fetch(userId).catch(() => null);
                const name = user?.username || "不明なユーザー";

                const formatted = account.periods.today.toLocaleString();

                lines.push(`${index + 1}位 ${name}（${formatted} ettigani$）`);
            }

            await channel.send({ embeds: [createRankingEmbed("今日のettigani$ランキング", lines)] });
        }
    } catch (error) {
        console.error("今日のettigani$ランキングエラー:", error);
    }
}
