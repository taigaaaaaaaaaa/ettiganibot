import fs from "fs";
import { guildDataPath } from "../src/dataPaths.js";

export const data = {
  name: "deletedmessage",
  description: "このサーバーで削除された直近5件を表示します"
};

export async function execute(interaction) {
  const guildId = interaction.guildId || "DM";
  const file = guildDataPath(guildId, "DeletedMessage.json");

  if (!fs.existsSync(file)) {
    return interaction.reply({
      content: "このサーバーではまだ削除されたメッセージはありません。",
      ephemeral: true
    });
  }

  const logs = JSON.parse(fs.readFileSync(file, 'utf8'));

  if (!Array.isArray(logs) || logs.length === 0) {
    return interaction.reply({
      content: "このサーバーではまだ削除されたメッセージはありません。",
      ephemeral: true
    });
  }

  const text = logs
    .map((log, i) => `**${i + 1}. ${log.username}**\n${log.content}\n(${log.time})`)
    .join('\n\n');

  await interaction.reply({
    content: text,
    ephemeral: true
  });
}
