import { MessageFlags } from "discord.js";
import { enqueueVoiceText, joinGuildVoice } from "../src/voiceManager.js";

export const data = {
    name: "ettigani_join",
    description: "現在いるボイスチャンネルで読み上げを開始します"
};

export async function execute(interaction) {
    if (!interaction.guild) {
        await interaction.reply({ content: "サーバー内で使用してください。", flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply();

    try {
        const channel = await joinGuildVoice(interaction);
        enqueueVoiceText(interaction.guild.id, "接続しました");
        await interaction.editReply(`🔊 **${channel.name}** で読み上げを開始しました。`);
    } catch (error) {
        await interaction.editReply(`読み上げを開始できませんでした: ${error.message}`);
    }
}