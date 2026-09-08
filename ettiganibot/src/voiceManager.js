import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import {
    AudioPlayerStatus,
    NoSubscriberBehavior,
    StreamType,
    createAudioPlayer,
    createAudioResource,
    entersState,
    joinVoiceChannel,
    VoiceConnectionStatus
} from "@discordjs/voice";
import { logVoiceEvent } from "./voiceLogger.js";

const voiceStates = new Map();
const joinCooldowns = new Map();
const JOIN_COOLDOWN_MS = 60_000;
const MAX_READ_LENGTH = 30;
const OMITTED_TEXT = "以下略";

function getState(guildId) {
    return voiceStates.get(guildId);
}

async function createVoiceFile(text) {
    const apiKey = process.env.FISH_AUDIO_API_KEY;
    const referenceId = process.env.FISH_AUDIO_REFERENCE_ID;
    const model = process.env.FISH_AUDIO_MODEL || "s2.1-pro-free";
    if (!apiKey) throw new Error("FISH_AUDIO_API_KEY が設定されていません");
    if (!referenceId) throw new Error("FISH_AUDIO_REFERENCE_ID が設定されていません");

    const response = await fetch("https://api.fish.audio/v1/tts", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "model": model
        },
        body: JSON.stringify({
            text,
            reference_id: referenceId,
            format: "wav"
        })
    });

    if (!response.ok) {
        const detail = await response.text();
        if (response.status === 402) {
            throw new Error("Fish AudioのAPIクレジットが不足しています。Fish Audioの開発者ページで残高を確認してください。");
        }
        throw new Error(`Fish Audio TTS failed: ${response.status} ${detail}`);
    }

    const filePath = path.join(os.tmpdir(), `ettiganibot-${crypto.randomUUID()}.wav`);
    fs.writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
    return filePath;
}

export async function joinGuildVoice(interaction) {
    const channel = interaction.member?.voice?.channel;
    if (!channel) throw new Error("先にボイスチャンネルへ参加してください。");

    const botMember = interaction.guild.members.me;
    const permissions = botMember ? channel.permissionsFor(botMember) : null;
    if (!permissions?.has("Connect")) {
        throw new Error("このボイスチャンネルに接続する権限がありません。");
    }
    if (!permissions.has("Speak")) {
        throw new Error("このボイスチャンネルで発言する権限がありません。");
    }

    const guildId = interaction.guild.id;
    const remainingCooldown = (joinCooldowns.get(guildId) || 0) + JOIN_COOLDOWN_MS - Date.now();
    if (remainingCooldown > 0) {
        const remainingSeconds = Math.ceil(remainingCooldown / 1000);
        throw new Error(`再接続のクールタイム中です。あと${remainingSeconds}秒待ってください。`);
    }
    if (voiceStates.has(guildId)) {
        throw new Error("すでにボイスチャンネルへ接続しています。");
    }

    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: true
    });
    connection.on("stateChange", (oldState, newState) => {
        console.log(`VC接続状態: guild=${guildId} ${oldState.status} -> ${newState.status}`);
    });
    connection.on("error", error => {
        console.error(`VC接続エラー: guild=${guildId}`, error);
    });
    const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Stop }
    });
    connection.subscribe(player);

    const state = {
        connection,
        player,
        guildName: interaction.guild.name,
        channelId: channel.id,
        channelName: channel.name,
        queue: [],
        processing: false,
        disconnectWhenIdle: false
    };
    voiceStates.set(guildId, state);

    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    } catch (error) {
        const status = connection.state.status;
        leaveGuildVoice(guildId);
        throw new Error(`VCへの接続に失敗しました（状態: ${status}）: ${error.message}`);
    }

    joinCooldowns.set(guildId, Date.now());
    logVoiceEvent("VC接続", {
        サーバーID: guildId,
        サーバー名: interaction.guild.name,
        チャンネルID: channel.id,
        チャンネル名: channel.name,
        実行者: interaction.user ? `${interaction.user.tag} (${interaction.user.id})` : "CLI"
    });
    return channel;
}

export function leaveGuildVoice(guildId) {
    const state = voiceStates.get(guildId);
    if (!state) return false;

    state.player.stop();
    state.connection.destroy();
    voiceStates.delete(guildId);
    logVoiceEvent("VC退出", {
        サーバーID: guildId,
        サーバー名: state.guildName,
        チャンネルID: state.channelId,
        チャンネル名: state.channelName
    });
    return true;
}

export function enqueueVoiceText(guildId, text) {
    const state = getState(guildId);
    if (!state) return false;

    const content = cleanText(text).slice(0, MAX_READ_LENGTH);
    if (!content) return false;

    state.queue.push(content);
    if (!state.processing) processQueue(guildId);
    return true;
}

export function handleVoiceStateUpdate(oldState, newState) {
    const state = getState(newState.guild.id);
    if (!state) return;

    const wasInTarget = oldState.channelId === state.channelId;
    const isInTarget = newState.channelId === state.channelId;
    const member = newState.member || oldState.member;
    const isBot = member?.user?.bot;

    if (!isBot && !wasInTarget && isInTarget) {
        enqueueVoiceText(newState.guild.id, `${getMemberName(member)}が参加しました`);
    } else if (!isBot && wasInTarget && !isInTarget) {
        enqueueVoiceText(newState.guild.id, `${getMemberName(member)}が退出しました`);
    }

    const targetChannel = newState.guild.channels.cache.get(state.channelId);
    const humanMembers = targetChannel?.members.filter(channelMember => !channelMember.user.bot) ?? [];
    if (humanMembers.size === 0) {
        state.disconnectWhenIdle = true;
        if (!state.processing && state.queue.length === 0) leaveGuildVoice(newState.guild.id);
    } else {
        state.disconnectWhenIdle = false;
    }
}

function getMemberName(member) {
    const name = cleanText(member?.displayName || member?.user?.username || "ユーザー");
    return name.slice(0, MAX_READ_LENGTH - "が参加しました".length);
}

function cleanText(text) {
    return text
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function enqueueMessage(message) {
    const state = getState(message.guild?.id);
    if (!state || state.channelId !== message.member?.voice?.channelId) return;

    const normalizedContent = cleanText(message.content);
    const shortenedContent = normalizedContent.length > MAX_READ_LENGTH
        ? `${normalizedContent.slice(0, MAX_READ_LENGTH - OMITTED_TEXT.length)}${OMITTED_TEXT}`
        : normalizedContent;
    if (!shortenedContent) return;

    enqueueVoiceText(message.guild.id, shortenedContent);
}

async function processQueue(guildId) {
    const state = getState(guildId);
    if (!state || state.processing) return;

    state.processing = true;
    try {
        while (state.queue.length > 0) {
            const text = state.queue.shift();
            logVoiceEvent("読み上げ開始", {
                サーバーID: guildId,
                サーバー名: state.guildName,
                チャンネルID: state.channelId,
                チャンネル名: state.channelName,
                読み上げ内容: text
            });
            const filePath = await createVoiceFile(text);
            try {
                const resource = createAudioResource(fs.createReadStream(filePath), {
                    inputType: StreamType.Arbitrary
                });
                state.player.play(resource);
                await entersState(state.player, AudioPlayerStatus.Idle, 120_000);
            } finally {
                fs.rmSync(filePath, { force: true });
            }
        }
    } catch (error) {
        console.error("読み上げエラー:", error.message);
    } finally {
        const latestState = getState(guildId);
        if (latestState) latestState.processing = false;
        if (latestState?.disconnectWhenIdle && latestState.queue.length === 0) {
            leaveGuildVoice(guildId);
        }
    }
}