import { loadSettings } from "../setting.js";
import { readJson } from "./dataPaths.js";

export async function sendCasinoRanking(client) {
    try {
        const settings = loadSettings();
        const casinoData = readJson("casino.json", {});
        const ranked = Object.entries(casinoData)
            .filter(([, account]) => Number.isFinite(account?.balance))
            .sort(([, left], [, right]) => right.balance - left.balance)
            .slice(0, 5);

        for (const guild of client.guilds.cache.values()) {
            const guildId = guild.id;
            const channelId = settings[guildId]?.rank_channel;
            let channel = channelId
                ? await client.channels.fetch(channelId).catch(() => null)
                : null;

            if (!channelId) {
                const botMember = guild.members.me;
                channel = botMember
                    ? guild.channels.cache.find(candidate =>
                        candidate.isTextBased() &&
                        candidate.permissionsFor(botMember)?.has("SendMessages")
                    )
                    : null;
            }

            if (!channel?.isTextBased() || channel.guild?.id !== guildId) {
                console.log(`ettigani$ランキング：${guildId} の送信先が見つからない`);
                continue;
            }

            if (ranked.length === 0) {
                await channel.send("累計ettigani$ランキングはデータがありませんでした。");
                continue;
            }

            let text = "# 累計ettigani$ランキング\n\n";
            for (let index = 0; index < ranked.length; index++) {
                const [userId, account] = ranked[index];
                const user = await client.users.fetch(userId).catch(() => null);
                const name = user?.username || "不明なユーザー";

                const formatted = account.balance.toLocaleString();

                text += `${index + 1}位 ${name}（${formatted} ettigani$）\n`;
            }

            await channel.send(text);
        }
    } catch (error) {
        console.error("今日のettigani$ランキングエラー:", error);
    }
}
