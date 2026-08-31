import fs from "fs";
import { dataPath } from "../src/dataPaths.js";

export const data = {
    name: "my_monthly",
    description: "今月の自分のえっちがに数を表示します"
};

export async function execute(interaction) {

    const userId = interaction.user.id;
    let total = 0;

    // monthly.json（今月の累計）を読む
    const monthlyPath = dataPath("monthly.json");

    if (fs.existsSync(monthlyPath)) {
        const monthly = JSON.parse(fs.readFileSync(monthlyPath, "utf8"));
        total = monthly[userId] || 0;
    }

    await interaction.reply({
        content: `👤📙 **今月のあなたのえっちがに数は ${total} 回です！**`,
        ephemeral: true
    });
}