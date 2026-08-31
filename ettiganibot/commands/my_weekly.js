import fs from "fs";
import { dataPath } from "../src/dataPaths.js";

export const data = {
    name: "my_weekly",
    description: "今週の自分のえっちがに数を表示します"
};

export async function execute(interaction) {

    const userId = interaction.user.id;
    let total = 0;

    // weekly.json（今週の累計）を読む
    const weeklyPath = dataPath("weekly.json");

    if (fs.existsSync(weeklyPath)) {
        const weekly = JSON.parse(fs.readFileSync(weeklyPath, "utf8"));
        total = weekly[userId] || 0;
    }

    await interaction.reply({
        content: `👤📘 **今週のあなたのえっちがに数は ${total} 回です！**`,
        ephemeral: true
    });
}