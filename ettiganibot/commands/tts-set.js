import { MessageFlags } from "discord.js";
import { setUserTTSSettings } from "../src/voiceManager.js";

export const data = {
    name: "tts-set",
    description: "自分の読み上げ速度とピッチを設定します",
    options: [
        {
            name: "speed",
            description: "読み上げ速度 (0.5〜2.0)",
            type: 10,
            required: true,
            min_value: 0.5,
            max_value: 2
        },
        {
            name: "pitch",
            description: "声の高さ (0.5〜2.0)",
            type: 10,
            required: true,
            min_value: 0.5,
            max_value: 2
        }
    ]
};

export async function execute(interaction) {
    const speed = interaction.options.getNumber("speed", true);
    const pitch = interaction.options.getNumber("pitch", true);
    setUserTTSSettings(interaction.user.id, { speed, pitch });

    await interaction.reply({
        content: `読み上げ設定を保存しました。\n速度: **${speed.toFixed(2)}**\nピッチ: **${pitch.toFixed(2)}**`,
        flags: MessageFlags.Ephemeral
    });
}
