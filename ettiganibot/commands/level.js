import fs from "fs";
import { readJson, dataPath } from "../src/dataPaths.js";

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
    name: "level",
    description: "あなたのレベルを表示します"
};

export async function execute(interaction) {

    const userId = interaction.user.id;

    const levels = readJson("levels.json", {});

    // 累計えっちがに数
    const total = getTotalCount();

    // レベル計算
    const level = getLevel(total);

    // levels.json に保存されているレベル（なければ0）
    const savedLevel = levels[userId] || 0;

   await interaction.reply(
    `👤 <@${userId}> の現在のレベルは **Lv.${savedLevel}** です！\n（累計えっちがに数：${total} 回）`
)};