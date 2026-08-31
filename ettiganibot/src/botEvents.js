import fs from "fs";
import { processUserProgress, reactedMessages, formatDate } from "./xpSystem.js";
import { logsPath, guildDataPath } from "./dataPaths.js";

const SPECIAL_GUILD_ID = "1515227043367882932";
const ignoreUsers = [
    "1347757854005792818",
    "1444297892993962045"
];

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
        guildName: data.guildName || data.guild?.name || "不明サーバー"
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
    client.on("messageReactionAdd", async (reaction, user) => {
        if (ignoreUsers.includes(user.id)) return;

        try {
            if (reaction.partial) await reaction.fetch();
            if (reaction.message.partial) await reaction.message.fetch();
            if (reaction.emoji.name !== "🦀") return;

            const message = reaction.message;
            console.log(`🦀 リアクション検知: ${user.tag} → ${message.author?.tag ?? "不明"} / 内容: ${message.content}`);

            const today = new Date();
            const fileName = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}.json`;
            const logPath = logsPath(fileName);

            fs.appendFileSync(logPath, JSON.stringify({
                timestamp: formatDate(),
                action: "reaction",
                reactionEmoji: "🦀",
                reactor: { username: user.tag, id: user.id },
                messageAuthor: { username: message.author.tag, id: message.author.id },
                location: {
                    guildName: message.guild?.name ?? "DM",
                    guildId: message.guild?.id ?? "DM",
                    channelName: message.channel?.name ?? "DM",
                    channelId: message.channel.id,
                    messageId: message.id,
                    messageURL: `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`
                },
                messageContent: message.content
            }) + "\n");

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
            timestamp: Date.now()
        });
    });

    client.on("messageCreate", async (message) => {
        if (ignoreUsers.includes(message.author.id)) return;
        if (message.author.bot) return;

        const lower = message.content.toLowerCase();
        const xpKeywords = ["えっち", "エッチ"];
        if (xpKeywords.some(word => lower.includes(word.toLowerCase()))) {
            console.log(`🔍 キーワード検知: ${message.author.tag} / 内容: ${message.content}`);
            await message.reply("えっちがに！！！");
            await processUserProgress(message);
            return;
        }

        if (message.guild.id !== SPECIAL_GUILD_ID) {
            return;
        }

        const noXPKeywords = ["テルマニア"];
        if (noXPKeywords.some(word => lower.includes(word.toLowerCase()))) {
            console.log(`🔍 キーワード検知（返信のみ）: ${message.author.tag} / 内容: ${message.content}`);
            await message.reply("えっちだに...");
            return;
        }

        const secondnoXPKeywords = ["あまのじゃむ", "リア充"];
        if (secondnoXPKeywords.some(word => lower.includes(word.toLowerCase()))) {
            console.log(`🔍 キーワード検知（返信のみ）: ${message.author.tag} / 内容: ${message.content}`);
            await message.reply("リア充はタンスの角に足の小指ぶつけろ！！\n-# 僕らの分まで幸せになれよ;;");
            return;
        }

        const chocoKeywords = ["チョコch", "チョコさん"];
        if (chocoKeywords.some(word => lower.includes(word.toLowerCase()))) {
            console.log(`🔍 キーワード検知（返信のみ）: ${message.author.tag} / 内容: ${message.content}`);

            const chocoReplies = [
                "チョコchって変態カカオ豆だよね（？）",
                "チョコさんってロリコンだよね",
            ];

            const rareReply =
                "変態カカオ豆とロリコン両立させてるのってすごいよねチョコch\n-# 排出率1%のメッセージです。おめでとう！！";

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
                    guildName: message.guild.name,
                    channelName: message.channel.name
                },
                timestamp: Date.now()
            });
        }
    });

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (ignoreUsers.includes(interaction.user.id)) {
            return interaction.reply({
                content: "あなたはこのbotを使用する資格はありません。",
                ephemeral: true
            });
        }

        const command = commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: "エラーが発生しました。",
                ephemeral: true
            });
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
