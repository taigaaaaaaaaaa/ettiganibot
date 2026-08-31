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
    name: "next_level",
    description: "次のレベルまであと何回かを表示します"
};

export async function execute(interaction) {

    const userId = interaction.user.id;

    // 累計えっちがに数
    const total = getTotalCount();

    // 現在のレベル
    const level = getLevel(total);

    // 次のレベルに必要な total
    const nextLevelTotal = (level + 1) ** 2;

    // あと何回必要か
    const remaining = nextLevelTotal - total;

    await interaction.reply({
        content:
            `👤 <@${userId}> の現在のレベルは **Lv.${level}** です！\n` +
            `次のレベル（Lv.${level + 1}）までに必要なえっちがに数は **あと ${remaining} 回** です！\n` +
            `（現在の累計：${total} 回 / 次のレベル必要値：${nextLevelTotal} 回）`,
        ephemeral: true
    });
}