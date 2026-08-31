import fs from "fs";
import { dataPath, readJson, writeJson } from "./dataPaths.js";

// 同じメッセージに対する重複反応を防ぐセット
export const reactedMessages = new Set();

// 累計値の読み書き
export function loadTotal() {
    return readJson("total.json", {});
}

export function saveTotal(data) {
    writeJson("total.json", data);
}

export function loadCounts() {
    return readJson("counts.json", {});
}

export function saveCounts(counts) {
    writeJson("counts.json", counts);
}

export function getLevel(total) {
    return Math.floor(Math.sqrt(total));
}

export function formatDate() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hour = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const sec = String(d.getSeconds()).padStart(2, "0");
    return `${year}/${month}/${day} ${hour}:${min}:${sec}`;
}

// 1ユーザーのメッセージ数とレベル進行を管理する
export async function processUserProgress(message) {
    const counts = loadCounts();
    counts[message.author.id] = (counts[message.author.id] || 0) + 1;
    saveCounts(counts);

    const totalData = loadTotal();
    totalData[message.author.id] = (totalData[message.author.id] || 0) + 1;
    saveTotal(totalData);

    const userTotal = totalData[message.author.id];
    const newLevel = getLevel(userTotal);

    let levels = readJson("levels.json", {});

    const oldLevel = levels[message.author.id] || 0;

    if (newLevel > oldLevel) {
        levels[message.author.id] = newLevel;
        writeJson("levels.json", levels);

        message.channel.send(
            `🎉 <@${message.author.id}> が **Lv.${newLevel}** にレベルアップしました！`
        );

        const levelRoles = {
            10: "えっちがにLv.10✨",
            30: "えっちがにLv.30✨",
            50: "えっちがにLv.50✨",
            100: "えっちがにLv.100✨"
        };

        if (levelRoles[newLevel]) {
            const roleName = levelRoles[newLevel];
            const role = message.guild.roles.cache.find(r => r.name === roleName);

            if (role) {
                const member = await message.guild.members.fetch(message.author.id);
                await member.roles.add(role);

                message.channel.send(
                    `🏅 <@${message.author.id}> に **${roleName}** ロールを付与しました！`
                );
            }
        }
    }
}
