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
    case "ban":
      console.log(await api("ban", { userId, guildId }));
      break;

    case "kick":
      console.log(await api("kick", { userId, guildId }));
      break;

    default:
      console.log("使えるコマンド: ban, kick");
  }
}

main();
