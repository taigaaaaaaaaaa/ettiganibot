import {
  createVerificationPanel,
  denyNonAdministrator,
  ephemeral,
  hasBotPermissions,
  describeMissingPermissions,
  isSupportedTextChannel,
  verificationApi,
  verificationErrorMessage,
} from "./common.js";

export const data = {
  name: "verify-panel",
  description: "設定済みの認証パネルを再送信します",
};

export async function execute(interaction) {
  if (await denyNonAdministrator(interaction)) return;
  if (!interaction.inGuild() || !interaction.guild) {
    return interaction.reply(
      ephemeral("❌ このコマンドはサーバー内で実行してください。"),
    );
  }
  await interaction.deferReply({ ephemeral: true });
  try {
    const { settings } = await verificationApi(interaction.guildId);
    if (!settings?.panel_channel_id) {
      return interaction.editReply(
        "❌ 認証設定がありません。先に `/verify-setup` を実行してください。",
      );
    }
    const channel =
      interaction.guild.channels.cache.get(settings.panel_channel_id) ||
      (await interaction.guild.channels.fetch(settings.panel_channel_id));
    if (!isSupportedTextChannel(channel)) {
      return interaction.editReply(
        "❌ 設定済みの認証パネルチャンネルが見つからないか、テキストチャンネルではありません。",
      );
    }
    const missing = describeMissingPermissions(
      hasBotPermissions(channel, interaction.guild.members.me),
    );
    if (missing.length) {
      return interaction.editReply(
        `❌ Botに必要な権限がありません: ${missing.join("、")}`,
      );
    }
    await channel.send(createVerificationPanel());
    await interaction.editReply(
      `✅ 認証パネルを <#${channel.id}> に再送信しました。`,
    );
  } catch (error) {
    console.error("verify-panel failed:", error);
    await interaction.editReply(verificationErrorMessage(error));
  }
}
