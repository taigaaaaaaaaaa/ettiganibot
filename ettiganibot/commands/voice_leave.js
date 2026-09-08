import { leaveGuildVoice } from "../src/voiceManager.js";

export const data = {
    name: "ettigani_leave",
    description: "読み上げを終了してボイスチャンネルから退出します"
};

export async function execute(interaction) {
    if (!interaction.guild) {
        await interaction.reply({ content: "サーバー内で使用してください。", ephemeral: true });
        return;
    }

    const left = leaveGuildVoice(interaction.guild.id);
    await interaction.reply(left ? "🔇 読み上げを終了しました。" : "読み上げは開始されていません。");
}