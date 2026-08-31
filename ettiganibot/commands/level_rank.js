import fs from "fs";
import { readJson } from "../src/dataPaths.js";

function getLevel(total) {
    return Math.floor(Math.sqrt(total));
}

function getTotalCount() {
    let total = 0;
    const today = readJson("counts.json", {});
    total += Object.values(today).reduce((a, b) => a + b, 0);
    return total;
}

export const data = {
    name: "level_rank",
    description: "レベルランキングを表示します"
};

export async function execute(interaction) {

    const levels = readJson("levels.json", {});

    // レベルが存在しない場合
    if (Object.keys(levels).length === 0) {
        return interaction.reply({
            content: "まだ誰もlevelない！えっちがにしろ！",
            ephemeral: true
        });
    }

    // このサーバーにいるユーザーだけ抽出
    const guildMembers = interaction.guild.members.cache;

    const filtered = Object.entries(levels)
        .filter(([userId, level]) => guildMembers.has(userId)) // ← ここが重要
        .sort((a, b) => b[1] - a[1]) // レベル順
        .slice(0, 5); // 上位5人

    // サーバー内に該当者がいない場合
    if (filtered.length === 0) {
        return interaction.reply({
            content: "このサーバーにはまだレベル持ちがいないよ！",
            ephemeral: true
        });
    }

    // 表示用テキスト
    let text = "🏆 **レベルランキング TOP5（このサーバー）** 🏆\n\n";

    filtered.forEach(([userId, level], i) => {
        text += `${i + 1}位 <@${userId}> — **Lv.${level}**\n`;
    });

    // 自分にしか見えないメッセージで返信
    await interaction.reply({
        content: text,
        ephemeral: true
    });
}
