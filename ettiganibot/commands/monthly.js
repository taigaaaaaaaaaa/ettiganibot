import fs from "fs";
import { dataPath } from "../src/dataPaths.js";

export const data = {
    name: "monthly",
    description: "今月の総えっちがに数を表示します"
};

export async function execute(interaction) {

    let total = 0;

    // monthly.json（今月の累計）を読む
    const monthlyPath = dataPath("monthly.json");

    if (fs.existsSync(monthlyPath)) {
        const monthly = JSON.parse(fs.readFileSync(monthlyPath, "utf8"));
        total = Object.values(monthly).reduce((a, b) => a + b, 0);
    }

    await interaction.reply({
        content: `📙 **今月の総えっちがに数は ${total} 回です！**`,
        ephemeral: true
    });
}