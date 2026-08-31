import { Client, GatewayIntentBits, Partials } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import cron from "node-cron";
import { joinVoiceChannel } from "@discordjs/voice";
import readline from "readline";
import express from "express";
import api from "./api.js";
import { commands, loadCommands, registerGuildCommands } from "./src/commandLoader.js";
import { handleGuildCreate } from "./src/guildSetup.js";
import { registerBotEvents } from "./src/botEvents.js";
import { sendDailyRanking, sendWeeklyRanking, sendMonthlyRanking } from "./src/ranking.js";
import { sendLogToAPI } from "./src/externalApi.js";

// .env を読み込んで、起動前に環境変数を準備する
dotenv.config({ path: "./.env" });

// Discord クライアントを作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.User]
});

// 新しいサーバーに入ったときは、welcome メッセージと guild コマンド登録を行う
client.on("guildCreate", async (guild) => {
    await handleGuildCreate(guild);
});

// VC 接続用の保持変数
let vcConnection = null;

function connectVC(client, guildId, channelId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
        console.log(`Guild が見つからない: ${guildId}`);
        return;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
        console.log(`VC が見つからない: ${channelId}`);
        return;
    }

    vcConnection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
    });

    console.log(`VC に接続しました: guild=${guildId}, channel=${channelId}`);
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.on("line", (input) => {
    const args = input.split(" ");

    if (args[0] === "join") {
        const guildId = args[1];
        const channelId = args[2];

        if (!guildId || !channelId) {
            console.log("使い方: join <guildId> <channelId>");
            return;
        }

        connectVC(client, guildId, channelId);
    }

    if (args[0] === "leave") {
        if (vcConnection) {
            vcConnection.destroy();
            vcConnection = null;
            console.log("VC から切断しました");
        } else {
            console.log("VC に接続していません");
        }
    }
});


// Bot が ready になったら、コマンドを読み込みして既存 guild にも登録する
client.once("ready", async () => {
    console.log("✔ Bot 起動完了！");
    await loadCommands();
    console.log("✔ コマンド読み込み完了（commands フォルダ）");

    for (const guild of client.guilds.cache.values()) {
        await registerGuildCommands(guild);
    }
});


// API サーバーを起動して、外部 CLI から bot を制御できるようにする
const app = express();
app.use(express.json());
app.use('/api', api(client));

app.listen(3000, () => {
    console.log('CLI API Server 起動: http://localhost:3000');
});

// 毎日 / 毎週 / 毎月のランキングを自動投稿
cron.schedule("0 0 * * *", async () => {
    await sendDailyRanking(client);
});

cron.schedule("0 0 * * 1", async () => {
    await sendWeeklyRanking(client);
});

cron.schedule("0 0 1 * *", async () => {
    await sendMonthlyRanking(client);
});

// テスト用の高速メッセージ送信用
function sendToChannel(channelId, message) {
    const channel = client.channels.cache.get(channelId);

    if (!channel) {
        console.log(`チャンネルが見つからない: ${channelId}`);
        return;
    }

    if (!channel.isTextBased()) {
        console.log(`テキストチャンネルではない: ${channelId}`);
        return;
    }

    channel.send(message)
        .then(() => console.log(`送信完了 → ${channel.name}`))
        .catch(err => console.error("送信エラー:", err));
}

const TARGET_BOT_ID = process.env.TARGET_BOT_ID;
process.stdin.resume();
process.stdin.setEncoding("utf8");

process.stdin.on("data", (data) => {
    const input = data.toString().trim();
    if (!input) return;

    const [channelId, ...msgParts] = input.split(" ");
    const message = msgParts.join(" ");

    if (!channelId || !message) {
        console.log("使い方: <チャンネルID> <メッセージ>");
        return;
    }

    sendToChannel(channelId, message);
});

registerBotEvents(client, { sendLogToAPI, commands });

client.login(process.env.TOKEN);
