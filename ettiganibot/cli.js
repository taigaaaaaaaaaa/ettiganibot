import dotenv from "dotenv";
dotenv.config();

const command = process.argv[2];
const userId = process.argv[3];
const guildId = process.argv[4];

async function api(path, body) {
  const res = await fetch(`http://localhost:3000/api/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cli-key": process.env.CLI_KEY
    },
    body: JSON.stringify(body)
  });

  return await res.json();
}

async function main() {
  switch (command) {
    case "servers": {
      const result = await api("guilds", {});
      if (!result.ok) {
        console.error(`サーバー一覧の取得に失敗しました: ${result.error}`);
        process.exitCode = 1;
        break;
      }

      console.log(`Bot導入サーバー一覧 (${result.guilds.length}件)`);
      if (result.guilds.length === 0) {
        console.log("Botが参加しているサーバーはありません。");
        break;
      }

      for (const guild of result.guilds) {
        console.log(`- ${guild.name} (${guild.id})`);
      }
      break;
    }

    case "ban":
      console.log(await api("ban", { userId, guildId }));
      break;

    case "kick":
      console.log(await api("kick", { userId, guildId }));
      break;

    default:
      console.log("使えるコマンド: servers, ban, kick");
  }
}

main().catch(error => {
  console.error(`CLI APIへの接続に失敗しました: ${error.message}`);
  process.exitCode = 1;
});
