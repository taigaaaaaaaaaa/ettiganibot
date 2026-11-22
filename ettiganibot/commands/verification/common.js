import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const botEnvironment = dotenv.config({
  quiet: true,
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
});

function getVerificationSecret() {
  const secret =
    process.env.VERIFY_INTERNAL_SECRET?.trim() ||
    botEnvironment.parsed?.VERIFY_INTERNAL_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "VERIFY_INTERNAL_SECRET がBotの環境変数または ettiganibot/.env に設定されていません。",
    );
  }
  if (secret.length < 32) {
    throw new Error("VERIFY_INTERNAL_SECRET は32文字以上にしてください。");
  }
  return secret;
}

export function isServerAdministrator(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ===
    true
  );
}

export async function denyNonAdministrator(interaction) {
  if (isServerAdministrator(interaction)) return false;
  await interaction.reply({
    content: "❌ このコマンドはサーバー管理者のみ実行できます。",
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

export function getWebBaseUrl() {
  return (
    process.env.VERIFY_WEB_URL || "https://ettiganibot-dashboard.com"
  ).replace(/\/+$/, "");
}

export async function verificationApi(guildId, method = "GET", body, userId) {
  const secret = getVerificationSecret();
  const url = new URL(
    `${getWebBaseUrl()}/api/internal/verification/guilds/${encodeURIComponent(guildId)}`,
  );
  if (userId) url.searchParams.set("userId", userId);
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      result?.error === "database_error"
        ? "Web側の認証データベースを利用できません。"
        : `認証Web APIとの通信に失敗しました (HTTP ${response.status})。`,
    );
    error.status = response.status;
    error.retryAfter = Number(response.headers.get("Retry-After")) || null;
    throw error;
  }
  return result;
}

export function hasBotPermissions(channel, botMember) {
  const permissions = channel.permissionsFor(botMember);
  return {
    manageRoles: botMember.permissions.has(PermissionFlagsBits.ManageRoles),
    viewChannel: permissions?.has(PermissionFlagsBits.ViewChannel) === true,
    sendMessages: permissions?.has(PermissionFlagsBits.SendMessages) === true,
    embedLinks: permissions?.has(PermissionFlagsBits.EmbedLinks) === true,
  };
}

export function describeMissingPermissions(permissions) {
  const missing = [];
  if (!permissions.manageRoles) missing.push("Manage Roles");
  if (!permissions.viewChannel) missing.push("View Channel");
  if (!permissions.sendMessages) missing.push("Send Messages");
  if (!permissions.embedLinks) missing.push("Embed Links");
  return missing;
}

export function isSupportedTextChannel(channel) {
  return (
    channel &&
    [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(
      channel.type,
    )
  );
}

export function createVerificationPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🔐 サーバー認証")
    .setDescription(
      "このサーバーを利用するには認証が必要です。\n\n下のボタンを押して認証を開始してください。",
    );
  const button = new ButtonBuilder()
    .setCustomId("verify:start")
    .setLabel("認証を開始")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("🔐");
  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(button)],
  };
}

export function verificationErrorMessage(error) {
  return `❌ 認証設定に失敗しました。\n${error?.message || "不明なエラー"}`;
}

export function ephemeral(content) {
  return { content, flags: MessageFlags.Ephemeral };
}
