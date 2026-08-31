import fs from "fs";
import { dataPath } from "../src/dataPaths.js";

export const data = {
    name: "my_today",
    description: "今日の自分のえっちがに数を表示します"
};

export async function execute(interaction) {

    const userId = interaction.user.id;
    let count = 0;

    const countsPath = dataPath("counts.json");

    if (fs.existsSync(countsPath)) {
        const todayCounts = JSON.parse(fs.readFileSync(countsPath, "utf8"));
        count = todayCounts[userId] || 0;
    }

    await interaction.reply({
        content: `👤 **今日のあなたのえっちがに数は ${count} 回です！**`,
        ephemeral: true
    });
}