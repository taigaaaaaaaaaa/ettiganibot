import { PermissionFlagsBits } from "discord.js";
import {
  denyNonAdministrator,
  describeMissingPermissions,
  ephemeral,
  hasBotPermissions,
  isSupportedTextChannel,
  createVerificationPanel,
  verificationApi,
  verificationErrorMessage,
} from "./common.js";

export const data = {
  name: "verify-setup",
  description: "サーバー認証を設定し、認証パネルを送信します",
  options: [
    {
      name: "log_channel",
      description: "認証ログの送信先チャンネル",
      type: 7,
      required: true,
      channel_types: [0, 5],
    },
  ],
};

export async function execute(interaction) {
  if (await denyNonAdministrator(interaction)) return;
  if (!interaction.inGuild() || !interaction.guild) {
    return interaction.reply(
      ephemeral("❌ このコマンドはサーバー内で実行してください。"),
    );
  }

  const logChannel = interaction.options.getChannel("log_channel");
  const panelChannel = interaction.channel;
  const botMember = interaction.guild.members.me;
  if (!botMember) {
    return interaction.reply(ephemeral("❌ Botメンバー情報を取得できません。"));
  }
  if (
    !isSupportedTextChannel(logChannel) ||
    !isSupportedTextChannel(panelChannel)
  ) {
    return interaction.reply(
      ephemeral(
        "❌ ログ送信先とパネル送信先にはテキストチャンネルを指定してください。",
      ),
    );
  }

  const missing = [];
  const logPermissions = hasBotPermissions(logChannel, botMember);
  const panelPermissions = hasBotPermissions(panelChannel, botMember);
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    missing.push("サーバー権限: Manage Roles");
  }
  for (const [label, permissions] of [
    ["認証ログチャンネル", logPermissions],
    ["パネル送信チャンネル", panelPermissions],
  ]) {
    for (const permission of describeMissingPermissions(permissions).filter(
      (item) => item !== "Manage Roles",
    )) {
      missing.push(`${label}: ${permission}`);
    }
  }
  if (missing.length) {
    return interaction.reply(
      ephemeral(
        `❌ Botに必要な権限がありません。\n不足している権限: ${[...new Set(missing)].join("、")}`,
      ),
    );
  }

  await interaction.deferReply({ ephemeral: true });
  try {
    let role = interaction.guild.roles.cache.find(
      (existingRole) => existingRole.name === "✅認証済み！",
    );
    if (!role) {
      role = await interaction.guild.roles.create({
        name: "✅認証済み！",
        color: 0x57f287,
        permissions: [],
        hoist: false,
        mentionable: false,
        reason: "サーバー認証システムの設定",
      });
    } else if (
      !botMember.permissions.has(PermissionFlagsBits.ManageRoles) ||
      role.position >= botMember.roles.highest.position
    ) {
      return interaction.editReply(
        "❌ 認証ロールを管理できません。BotにManage Roles権限を付与し、Botロールを認証ロールより上に移動してください。",
      );
    }
    if (role.permissions.bitfield !== 0n || role.color !== 0x57f287) {
      role = await role.edit({
        color: 0x57f287,
        permissions: [],
        reason: "認証ロールの権限なし・指定色を設定",
      });
    }

    await verificationApi(interaction.guildId, "PUT", {
      logChannelId: logChannel.id,
      panelChannelId: panelChannel.id,
      roleId: role.id,
    });
    try {
      await panelChannel.send(createVerificationPanel());
    } catch (error) {
      console.error("verify-setup panel delivery failed:", error);
      return interaction.editReply(
        `⚠️ 認証設定は保存しましたが、パネルを送信できませんでした。\n${error.message}\n権限を確認し、\`/verify-panel\` で再送信してください。`,
      );
    }
    await interaction.editReply(
      `✅ 認証設定が完了しました。\n認証ログ: <#${logChannel.id}>\n認証パネル: <#${panelChannel.id}>\n認証ロール: <@&${role.id}>`,
    );
  } catch (error) {
    console.error("verify-setup failed:", error);
    await interaction.editReply(verificationErrorMessage(error));
  }
}
