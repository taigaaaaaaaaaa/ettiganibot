import fs from "fs";
import { loadSettings } from "../setting.js";
import { dataPath, readJson, writeJson } from "./dataPaths.js";

// 毎日 0:00 に総合ランキングを投稿する
export async function sendDailyRanking(client) {
    try {
        const settings = loadSettings();

        for (const guildId of Object.keys(settings)) {
            const RANK_CHANNEL = settings[guildId]?.rank_channel;
            if (!RANK_CHANNEL) {
                console.log(`デイリー：${guildId} はチャンネル未設定`);
                continue;
            }

            const channel = await client.channels.fetch(RANK_CHANNEL).catch(() => null);
            if (!channel) {
                console.log(`デイリー：${guildId} のチャンネルが見つからない`);
                continue;
            }

            let counts = readJson("counts.json", {});

            const guildMembers = channel.guild.members.cache;
            const filtered = Object.entries(counts)
                .filter(([userId]) => guildMembers.has(userId))
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            if (filtered.length === 0) {
                channel.send("今日のランキングはデータがありませんでした。");
                continue;
            }

            let text = "# 今日のえっちがにランキング\n\n";
            for (let i = 0; i < filtered.length; i++) {
                const [userId, xp] = filtered[i];
                const user = await client.users.fetch(userId);
                text += `${i + 1}位 ${user.username}（${xp}回）\n`;
            }

            channel.send(text);
        }

        let weekly = readJson("weekly.json", {});
        let monthly = readJson("monthly.json", {});
        let counts = readJson("counts.json", {});

        for (const userId in counts) {
            weekly[userId] = (weekly[userId] || 0) + counts[userId];
            monthly[userId] = (monthly[userId] || 0) + counts[userId];
        }

        writeJson("weekly.json", weekly);
        writeJson("monthly.json", monthly);
        writeJson("counts.json", {});
    } catch (err) {
        console.error("デイリーランキングエラー:", err);
    }
}

// 毎週 0:00 に週間ランキングを投稿する
export async function sendWeeklyRanking(client) {
    try {
        const settings = loadSettings();

        for (const guildId of Object.keys(settings)) {
            const RANK_CHANNEL = settings[guildId]?.rank_channel;
            if (!RANK_CHANNEL) continue;

            const channel = await client.channels.fetch(RANK_CHANNEL).catch(() => null);
            if (!channel) continue;

            let weekly = readJson("weekly.json", {});

            const guildMembers = channel.guild.members.cache;
            const filtered = Object.entries(weekly)
                .filter(([userId]) => guildMembers.has(userId))
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            if (filtered.length === 0) {
                channel.send("今週のランキングはデータがありませんでした。");
                continue;
            }

            let text = "# 今週のえっちがにランキング\n\n";
            for (let i = 0; i < filtered.length; i++) {
                const [userId, xp] = filtered[i];
                const user = await client.users.fetch(userId);
                text += `${i + 1}位 ${user.username}（${xp}回）\n`;
            }

            channel.send(text);
        }

        writeJson("weekly.json", {});
    } catch (err) {
        console.error("週間ランキングエラー:", err);
    }
}

// 毎月 1日 0:00 に月間ランキングを投稿する
export async function sendMonthlyRanking(client) {
    try {
        const settings = loadSettings();

        for (const guildId of Object.keys(settings)) {
            const RANK_CHANNEL = settings[guildId]?.rank_channel;
            if (!RANK_CHANNEL) continue;

            const channel = await client.channels.fetch(RANK_CHANNEL).catch(() => null);
            if (!channel) continue;

            let monthly = readJson("monthly.json", {});

            const guildMembers = channel.guild.members.cache;
            const filtered = Object.entries(monthly)
                .filter(([userId]) => guildMembers.has(userId))
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            if (filtered.length === 0) {
                channel.send("今月のランキングはデータがありませんでした。");
                continue;
            }

            let text = "# 今月のえっちがにランキング\n\n";
            for (let i = 0; i < filtered.length; i++) {
                const [userId, xp] = filtered[i];
                const user = await client.users.fetch(userId);
                text += `${i + 1}位 ${user.username}（${xp}回）\n`;
            }

            channel.send(text);
        }

        writeJson("monthly.json", {});
    } catch (err) {
        console.error("月間ランキングエラー:", err);
    }
}
