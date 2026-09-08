import { getBalance } from "../src/casinoStore.js";
import { logCasinoEvent } from "../src/casinoLogger.js";

export const data = {
    name: "balance",
    description: "ettigani$の残高を表示します"
};

export async function execute(interaction) {
    const balance = getBalance(interaction.guildId, interaction.user.id);
    logCasinoEvent(interaction, "balance", { 残高: `${balance} ettigani$` });

    await interaction.reply({
        content: `💰 あなたの残高は **${balance} ettigani$** です。`,
        ephemeral: true
    });
}
