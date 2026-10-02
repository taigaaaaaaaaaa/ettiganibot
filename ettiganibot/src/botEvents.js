import { MessageFlags } from "discord.js";
import fs from "fs";
import { processUserProgress, reactedMessages, formatDate } from "./xpSystem.js";
import { logsPath, guildDataPath } from "./dataPaths.js";
import { logSlashCommand } from "./commandLogger.js";
import { enqueueMessage, handleVoiceStateUpdate } from "./voiceManager.js";

const SPECIAL_GUILD_ID = "1515227043367882932";
const ignoreUsers = [
  "1347757854005792818",
  "1444297892993962045",
];

// susuru用
const susuruCooldown = new Map();

function writeKeywordLog(message, keyword) {
  const today = new Date();
  const fileName = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}.log`;
  const logPath = logsPath(fileName);
  const content = message.content.replace(/\r?\n/g, "\\n");

  fs.appendFileSync(
    logPath,
    [
      "--- キーワード検知ログ ---",
      `日時: ${formatDate()}`,
      `キーワード: ${keyword}`,
      `ユーザー: ${message.author.tag} (${message.author.id})`,
      `サーバー: ${message.guild?.name ?? "DM"} (${message.guild?.id ?? "DM"})`,
      `チャンネル: ${message.channel?.name ?? "不明"} (${message.channel?.id ?? "不明"})`,
      `メッセージ: ${content}`,
      `URL: https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`,
      "",
    ].join("\n"),
    "utf8"
  );
}

// 削除メッセージを guild 単位で保存する
export function saveDeletedMessage(data) {
  const guildId = data?.guildId || data?.guild?.id || "DM";
  const file = guildDataPath(guildId, "DeletedMessage.json");

  let logs = [];
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf8").trim();
      if (raw !== "") {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) logs = parsed;
      }
    }
  } catch (err) {
    console.error("DeletedMessage.json 読み込みエラー:", err);
    logs = [];
  }

  logs.push({
    ...data,
    guildId,
    guildName: data.guildName || data.guild?.name || "不明サーバー",
  });
  if (logs.length > 5) logs.shift();

  try {
    fs.writeFileSync(file, JSON.stringify(logs, null, 2), "utf8");
  } catch (err) {
    console.error("DeletedMessage.json 書き込みエラー:", err);
  }
}

// bot のイベント固有処理をまとめて登録する
export function registerBotEvents(client, { sendLogToAPI, commands }) {
  client.on("voiceStateUpdate", (oldState, newState) => {
    handleVoiceStateUpdate(oldState, newState);
  });

  client.on("messageReactionAdd", async (reaction, user) => {
    if (ignoreUsers.includes(user.id)) return;

    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
      if (reaction.emoji.name !== "🦀") return;

      const message = reaction.message;
      console.log(`🦀 リアクション検知: ${user.tag} → ${message.author?.tag ?? "不明"} / 内容: ${message.content}`);

      const today = new Date();
      const fileName = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}.log`;
      const logPath = logsPath(fileName);

      fs.appendFileSync(
        logPath,
        [
          "--- リアクションログ ---",
          `日時: ${formatDate()}`,
          "種類: 🦀リアクション",
          `リアクションしたユーザー: ${user.tag} (${user.id})`,
          `メッセージ投稿者: ${message.author.tag} (${message.author.id})`,
          `サーバー: ${message.guild?.name ?? "DM"} (${message.guild?.id ?? "DM"})`,
          `チャンネル: ${message.channel?.name ?? "不明"} (${message.channel?.id ?? "不明"})`,
          `メッセージ: ${message.content.replace(/\r?\n/g, "\\n")}`,
          `URL: https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`,
          "",
        ].join("\n"),
        "utf8"
      );

      if (reactedMessages.has(message.id)) return;

      await message.reply("えっちがに！！！");
      await processUserProgress(message);
      reactedMessages.add(message.id);
    } catch (err) {
      console.error("エラー:", err);
    }
  });

  client.on("messageReactionAdd", async (reaction, user) => {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
    if (reaction.emoji.name !== "🦀") return;

    const msg = reaction.message;
    sendLogToAPI({
      type: "reaction",
      payload: {
        reactor_name: user.tag,
        author_name: msg.author.tag,
        content: msg.content,
        guildName: msg.guild.name,
        channelName: msg.channel.name,
      },
      timestamp: Date.now(),
    });
  });

  const susuruCooldown = new Map();

  client.on("messageCreate", async (message) => {
    if (ignoreUsers.includes(message.author.id)) return;
    if (message.author.bot) return;

    enqueueMessage(message);

    const lower = message.content.toLowerCase();
    const xpKeywords = ["えっち", "エッチ"];
    if (xpKeywords.some((word) => lower.includes(word.toLowerCase()))) {
      console.log(`🔍 キーワード検知: ${message.author.tag} / 内容: ${message.content}`);
      writeKeywordLog(message, "えっち");
      await message.reply("えっちがに！！！");
      await processUserProgress(message);
      return;
    }

    // ユーザーごとのクールタイム管理

const susuruKeywords = ["susuru", "すする", "ラーメン"];
if (susuruKeywords.some((word) => lower.includes(word.toLowerCase()))) {

  const userId = message.author.id;
  const now = Date.now();
  const cooldownTime = 10000; // ← 10秒クールタイム

  // クールタイム中なら反応しない
  if (susuruCooldown.has(userId)) {
    const lastUsed = susuruCooldown.get(userId);
    if (now - lastUsed < cooldownTime) {
      return;
    }
  }

  // クールタイム更新
  susuruCooldown.set(userId, now);

  console.log(`🔍 キーワード検知（返信のみ）: ${message.author.tag} / 内容: ${message.content}`);
  writeKeywordLog(message, "susuru / すする / ラーメン");

  const susuruReply =
"こちらが 濃厚とんこつ豚無双さんの\n濃厚無双ラーメン 海苔トッピングです\n# うっひょ～～～～～～！\n着席時 コップに水垢が付いていたのを見て\n大きな声を出したら 店主さんからの誠意で\nチャーシューをサービスしてもらいました\n俺の動画次第でこの店潰す事だってできるんだぞって事で\n## いただきま～～～～す！まずはスープから\n# コラ～！\nこれでもかって位ドロドロの濃厚スープの中には\n虫が入っており 怒りのあまり\n卓上調味料を全部倒してしまいました～！\nすっかり店側も立場を弁え 誠意のチャーシュー丼を貰った所で\nお次に 圧倒的存在感の極太麺を\n# 啜る～！\n# 殺すぞ～！\nワシワシとした食感の麺の中には、髪の毛が入っており\nさすがのSUSURUも 厨房に入って行ってしまいました～！\nちなみに、店主さんが土下座している様子は ぜひサブチャンネルをご覧ください";

  // ① 返信メッセージを送る
  const sentMessage = await message.reply(susuruReply);

  // ② 一定時間後に編集（3秒後）
  setTimeout(async () => {
    try {
      await sentMessage.edit("本家見てね！\nhttps://youtu.be/13eeEmRpWMI?si=c3G7JZJifoYrMYDL");
    } catch (err) {
      console.error("❌ SUSURU返信の編集に失敗:", err);
      return;
    }

    // ③ 編集したメッセージをさらに一定時間後に削除（5秒後）
    setTimeout(async () => {
      try {
        await sentMessage.delete();
      } catch (err) {
        console.error("❌ SUSURU返信の削除に失敗:", err);
      }
    }, 5000); // ← 編集後5秒で削除

  }, 3000); // ← 3秒後に編集

  return;
}


    const noXPKeywords = ["テルマニア"];
    if (noXPKeywords.some((word) => lower.includes(word.toLowerCase()))) {
      console.log(`🔍 キーワード検知（返信のみ）: ${message.author.tag} / 内容: ${message.content}`);
      writeKeywordLog(message, "テルマニア");
      await message.reply("えっちだに...");
      return;
    }

    const secondnoXPKeywords = ["あまのじゃむ", "リア充"];
    if (secondnoXPKeywords.some((word) => lower.includes(word.toLowerCase()))) {
      console.log(`🔍 キーワード検知（返信のみ）: ${message.author.tag} / 内容: ${message.content}`);
      writeKeywordLog(message, "あまのじゃむ / リア充");
      await message.reply("リア充はタンスの角に足の小指ぶつけろ！！\n-# 僕らの分まで幸せになれよ;;");
      return;
    }

    const chocoKeywords = ["チョコch", "チョコさん"];
    if (chocoKeywords.some((word) => lower.includes(word.toLowerCase()))) {
      console.log(`🔍 キーワード検知（返信のみ）: ${message.author.tag} / 内容: ${message.content}`);
      writeKeywordLog(message, "チョコch / チョコさん");

      const chocoReplies = [
        "チョコchって変態カカオ豆だよね（？）",
        "チョコさんってロリコンだよね",
      ];

      const rareReply = "変態カカオ豆とロリコン両立させてるのってすごいよねチョコch\n-# 排出率1%のメッセージです。おめでとう！！";

      const rareChance = 0.01;
      const pick = Math.random() < rareChance ? rareReply : chocoReplies[Math.floor(Math.random() * chocoReplies.length)];
      await message.reply(pick);
      return;
    }

  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (message.content.includes("えっち")) {
      sendLogToAPI({
        type: "keyword",
        payload: {
          username: message.author.tag,
          content: message.content,
          guildName: message.guild?.name ?? "DM",
          channelName: message.channel?.name ?? "DM",
        },
        timestamp: Date.now(),
      });
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const startedAt = Date.now();
    let result = "成功";
    let errorMessage;
    try {
      if (ignoreUsers.includes(interaction.user.id)) {
        result = "拒否";
        await interaction.reply({
          content: "あなたはこのbotを使用する資格はありません。",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const command = commands.get(interaction.commandName);
      if (!command) {
        result = "コマンド未登録";
        return;
      }

      await command.execute(interaction);
    } catch (err) {
      result = "エラー";
      errorMessage = err?.message ?? String(err);
      console.error(err);
      const response = { content: "エラーが発生しました。", flags: MessageFlags.Ephemeral };
      try {
        if (interaction.deferred) {
          await interaction.editReply(response.content);
        } else if (interaction.replied) {
          await interaction.followUp(response);
        } else {
          await interaction.reply(response);
        }
      } catch (responseError) {
        console.error("スラッシュコマンドのエラー応答に失敗:", responseError);
      }
    } finally {
      try {
        logSlashCommand(interaction, {
          result,
          durationMs: Date.now() - startedAt,
          error: errorMessage
        });
      } catch (logError) {
        console.error("スラッシュコマンドログの記録に失敗:", logError);
      }
    }
  });

  client.on("messageDelete", async (message) => {
    if (!message) return;

    const guildId = message.guild?.id || "DM";
    const deletedData = {
      guildId,
      guildName: message.guild?.name || "DM",
      username: message.author?.username || "不明ユーザー",
      content: message.content || "(内容なし / 埋め込みのみ)",
      time: new Date().toLocaleString(),
    };

    saveDeletedMessage(deletedData);
  });
}
