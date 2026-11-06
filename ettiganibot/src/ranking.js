import fs from "fs";
import { loadSettings } from "../setting.js";
import { dataPath, readJson, writeJson } from "./dataPaths.js";
import { resetCasinoMonthly, resetCasinoWeekly } from "./casinoStore.js";
import { createCommunityPostEmbeds, createRankingEmbed } from "./rankingEmbed.js";
import { resetGuildRankingPeriod, rolloverGuildRankingDay } from "./guildRankingStore.js";
import { getRankingChannel } from "./rankingChannel.js";
import { getTodaysCommunityPosts } from "./communityPosts.js";

// 毎日 23:59:59 に当日の総合ランキングを投稿する
export async function sendDailyRanking(client) {
    try {
        const settings = loadSettings();
        const counts = readJson("counts.json", {});
        let communityPosts = null;
        try {
            communityPosts = getTodaysCommunityPosts();
        } catch (error) {
            console.error("今日のコミュニティ投稿取得エラー:", error);
        }

        for (const guild of client.guilds.cache.values()) {
            const guildId = guild.id;
            const channel = await getRankingChannel(client, guild, settings);
            if (!channel) {
                console.log(`デイリー：${guildId} の送信先が見つからない`);
                continue;
            }

            const filtered = Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            let rankingEmbed;
            if (filtered.length === 0) {
                rankingEmbed = createRankingEmbed(
                    "今日のえっちがにランキング(全サーバ)",
                    ["ランキングデータはありませんでした。"]
                );
            } else {
                const lines = [];
                for (let i = 0; i < filtered.length; i++) {
                    const [userId, xp] = filtered[i];
                    const user = await client.users.fetch(userId);
                    lines.push(`${i + 1}位 ${user.username}（${xp}回）`);
                }
                rankingEmbed = createRankingEmbed("今日のえっちがにランキング(全サーバ)", lines);
            }

            const communityEmbeds =
                communityPosts === null ? [] : createCommunityPostEmbeds(communityPosts);
            await channel.send({ embeds: [rankingEmbed, ...communityEmbeds.slice(0, 1)] });

            for (const embed of communityEmbeds.slice(1)) {
                await channel.send({ embeds: [embed] });
            }
        }
    } catch (err) {
        console.error("デイリーランキングエラー:", err);
    }
}

// 毎日 0:00 に前日分を週間・月間へ加算してリセットする
export function rolloverDailyRanking() {
    try {
        const weekly = readJson("weekly.json", {});
        const monthly = readJson("monthly.json", {});
        const counts = readJson("counts.json", {});

        for (const userId in counts) {
            weekly[userId] = (weekly[userId] || 0) + counts[userId];
            monthly[userId] = (monthly[userId] || 0) + counts[userId];
        }

        writeJson("weekly.json", weekly);
        writeJson("monthly.json", monthly);
        writeJson("counts.json", {});
        rolloverGuildRankingDay();
    } catch (err) {
        console.error("デイリー集計リセットエラー:", err);
    }
}

// 毎週 0:00 に週間ランキングを投稿する
export async function sendWeeklyRanking(client) {
    try {
        const settings = loadSettings();

        for (const guild of client.guilds.cache.values()) {
            const guildId = guild.id;
            const channel = await getRankingChannel(client, guild, settings);
            if (!channel) {
                console.log(`週間：${guildId} の送信先が見つからない`);
                continue;
            }

            let weekly = readJson("weekly.json", {});

            const filtered = Object.entries(weekly)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            if (filtered.length === 0) {
                await channel.send({
                    embeds: [createRankingEmbed("今週のえっちがにランキング(全サーバ)", ["ランキングデータはありませんでした。"])]
                });
                continue;
            }

            const lines = [];
            for (let i = 0; i < filtered.length; i++) {
                const [userId, xp] = filtered[i];
                const user = await client.users.fetch(userId);
                lines.push(`${i + 1}位 ${user.username}（${xp}回）`);
            }

            await channel.send({ embeds: [createRankingEmbed("今週のえっちがにランキング(全サーバ) ", lines)] });
        }

        writeJson("weekly.json", {});
        resetGuildRankingPeriod("weekly");
        resetCasinoWeekly();
    } catch (err) {
        console.error("週間ランキングエラー:", err);
    }
}

// 毎月 1日 0:00 に月間ランキングを投稿する
export async function sendMonthlyRanking(client) {
    try {
        const settings = loadSettings();

        for (const guild of client.guilds.cache.values()) {
            const guildId = guild.id;
            const channel = await getRankingChannel(client, guild, settings);
            if (!channel) {
                console.log(`月間：${guildId} の送信先が見つからない`);
                continue;
            }

            let monthly = readJson("monthly.json", {});

            const filtered = Object.entries(monthly)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            if (filtered.length === 0) {
                await channel.send({
                    embeds: [createRankingEmbed("今月のえっちがにランキング(全サーバ)", ["ランキングデータはありませんでした。"])]
                });
                continue;
            }

            const lines = [];
            for (let i = 0; i < filtered.length; i++) {
                const [userId, xp] = filtered[i];
                const user = await client.users.fetch(userId);
                lines.push(`${i + 1}位 ${user.username}（${xp}回）`);
            }

            await channel.send({ embeds: [createRankingEmbed("今月のえっちがにランキング(全サーバ)", lines)] });
        }

        writeJson("monthly.json", {});
        resetGuildRankingPeriod("monthly");
        resetCasinoMonthly();
    } catch (err) {
        console.error("月間ランキングエラー:", err);
    }
}
