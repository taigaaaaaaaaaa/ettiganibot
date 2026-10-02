import { MessageFlags } from "discord.js";
import { claimDaily } from "../src/casinoStore.js";
import { logCasinoEvent } from "../src/casinoLogger.js";

function getToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export const data = {
    name: "daily",
    description: "1日1回、1000 ettigani$を受け取ります"
};

export async function execute(interaction) {
    const balance = claimDaily(interaction.guildId, interaction.user.id, getToday());

    if (balance === null) {
        logCasinoEvent(interaction, "daily", { 結果: "受取済み" });
        await interaction.reply({
            content: "今日はもう受け取っているよ。明日また来てね。",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    logCasinoEvent(interaction, "daily", { 配布: "1000 ettigani$", 残高: `${balance} ettigani$` });
    await interaction.reply(`🎁 デイリーボーナス **1000 ettigani$** を受け取ったよ！\n残高: **${balance} ettigani$**`);
}
