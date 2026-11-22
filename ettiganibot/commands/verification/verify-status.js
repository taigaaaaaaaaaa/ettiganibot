import { PermissionFlagsBits } from "discord.js";
import {
  denyNonAdministrator,
  ephemeral,
  verificationApi,
  verificationErrorMessage,
} from "./common.js";

export const data = {
  name: "verify-status",
  description: "サーバー認証の設定と認証者数を表示します",
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
    const result = await verificationApi(interaction.guildId);
    const settings = result.settings;
    if (!settings) {
      return interaction.editReply(
        "❌ 認証設定がありません。先に `/verify-setup` を実行してください。",
      );
    }

    const members = await interaction.guild.members.fetch();
    const eligibleMembers = members.filter(
      (member) =>
        !member.user.bot &&
        !member.permissions.has(PermissionFlagsBits.Administrator),
    ).size;
    const unverifiedCount = Math.max(0, eligibleMembers - result.verifiedCount);
    const role =
      interaction.guild.roles.cache.get(settings.role_id) ||
      (await interaction.guild.roles.fetch(settings.role_id).catch(() => null));
    const logChannel =
      interaction.guild.channels.cache.get(settings.log_channel_id) ||
      (await interaction.guild.channels
        .fetch(settings.log_channel_id)
        .catch(() => null));

    await interaction.editReply(
      [
        "🔐 **サーバー認証ステータス**",
        `認証済み人数: ${result.verifiedCount}`,
        `未認証人数: ${unverifiedCount}`,
        `Turnstile状態: ${result.turnstile ? "✅ 設定済み" : "❌ 未設定"}`,
        `OAuth状態: ${result.oauth ? "✅ 設定済み" : "❌ 未設定"}`,
        `DB状態: ${result.database === "ok" ? "✅ 正常" : "❌ 異常"}`,
        `ロール状態: ${role ? `✅ ${role.name}` : "❌ ロールなし"}`,
        `認証ログチャンネル: ${logChannel ? `<#${logChannel.id}>` : "❌ チャンネルなし"}`,
      ].join("\n"),
    );
  } catch (error) {
    console.error("verify-status failed:", error);
    await interaction.editReply(verificationErrorMessage(error));
  }
}
