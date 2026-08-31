import fs from "fs";
import { dataPath } from "../src/dataPaths.js";

export const data = {
    name: "total",
    description: "累計のえっちがに数を表示します"
};

export async function execute(interaction) {
    let total = 0;

    // total.json（ユーザーごとの累計XP）を読む
    const totalPath = dataPath("total.json");
    if (fs.existsSync(totalPath)) {
        const totalData = JSON.parse(fs.readFileSync(totalPath, "utf8"));
        // 全ユーザー分を合計
        total = Object.values(totalData).reduce((a, b) => a + b, 0);
    }

    await interaction.reply({
        content: `📊 **累計えっちがに数は ${total} 回です！**`,
        ephemeral: true
    });
}