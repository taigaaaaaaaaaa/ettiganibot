import fs from "fs";
import { dataPath } from "../src/dataPaths.js";

export const data = {
    name: "today",
    description: "今日の総えっちがに数を表示します"
};

export async function execute(interaction) {

    let total = 0;

    const countsPath = dataPath("counts.json");

    if (fs.existsSync(countsPath)) {
        const todayCounts = JSON.parse(fs.readFileSync(countsPath, "utf8"));
        total = Object.values(todayCounts).reduce((a, b) => a + b, 0);
    }

    await interaction.reply({
        content: `📅 **今日の総えっちがに数は ${total} 回です！**`,
        ephemeral: true
    });
}