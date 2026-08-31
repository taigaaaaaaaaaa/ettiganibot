import fs from "fs";
import { dataPath } from "../src/dataPaths.js";

export const data = {
    name: "weekly",
    description: "今週の総えっちがに数を表示します"
};

export async function execute(interaction) {

    let total = 0;

    // weekly.json（今週の累計）を読む
    const weeklyPath = dataPath("weekly.json");

    if (fs.existsSync(weeklyPath)) {
        const weekly = JSON.parse(fs.readFileSync(weeklyPath, "utf8"));
        total = Object.values(weekly).reduce((a, b) => a + b, 0);
    }

    await interaction.reply({
        content: `📘 **今週の総えっちがに数は ${total} 回です！**`,
        ephemeral: true
    });
}