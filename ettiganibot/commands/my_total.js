import fs from "fs";
import { dataPath } from "../src/dataPaths.js";

export const data = {
    name: "my_total",
    description: "あなたの累計えっちがに数を表示します"
};

export async function execute(interaction) {

    const userId = interaction.user.id;
    let total = 0;

    // total.json（累計XP）を読む
    const totalPath = dataPath("total.json");

    if (fs.existsSync(totalPath)) {
        const totalData = JSON.parse(fs.readFileSync(totalPath, "utf8"));
        total = totalData[userId] || 0;
    }

    await interaction.reply({
        content: `👤📊 **あなたの累計えっちがに数は ${total} 回です！**`,
        ephemeral: true
    });
}