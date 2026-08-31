import { loadSettings, saveSettings } from "../setting.js";

export const data = {
    name: "setting",
    description: "ランキング送信チャンネルを設定します",
    default_member_permissions: "0x00000008",
    options: [
        {
            name: "channel",
            description: "ランキングを送信するチャンネルを選択してください",
            type: 7,
            required: true
        }
    ]
};

export async function execute(interaction) {
    const channel = interaction.options.getChannel("channel");

    if (!channel.isTextBased()) {
        return interaction.reply({
            content: "テキストチャンネルを選択してください。",
            ephemeral: true
        });
    }

    const settings = loadSettings();
    const guildId = interaction.guild.id;

    if (!settings[guildId]) settings[guildId] = {};

    settings[guildId].rank_channel = channel.id;

    saveSettings(settings);

    await interaction.reply({
        content: `✔ ランキング送信チャンネルを **#${channel.name}** に設定しました`,
        ephemeral: true
    });
}
