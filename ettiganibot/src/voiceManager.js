import { Readable } from "stream";
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
import { readJson, writeJson } from "./dataPaths.js";
import { logVoiceEvent } from "./voiceLogger.js";

const voiceStates = new Map();
const storedTTSSettings = readJson("tts-settings.json", {});
const savedTTSSettings = storedTTSSettings && typeof storedTTSSettings === "object" && !Array.isArray(storedTTSSettings)
    ? storedTTSSettings
    : {};
export const userTTSSettings = new Map(
    Object.entries(savedTTSSettings).filter(([, settings]) =>
        Number.isFinite(settings?.speed) && settings.speed >= 0.5 && settings.speed <= 2 &&
        Number.isFinite(settings?.pitch) && settings.pitch >= 0.5 && settings.pitch <= 2
    )
);
const connectionStates = new WeakMap();
const monitoredConnections = new WeakSet();
const joinCooldowns = new Map();
const JOIN_COOLDOWN_MS = 60_000;
const MAX_CONNECT_ATTEMPTS = 3;
const CONNECT_RETRY_DELAY_MS = 1_000;
const MAX_READ_LENGTH = 30;
const OMITTED_TEXT = "以下略";
const DEFAULT_FISH_AUDIO_MODEL = "s2.1-pro-free";

function getState(guildId) {
    return voiceStates.get(guildId);
}

function getRandomValue(min, max) {
    return Number((min + Math.random() * (max - min)).toFixed(2));
}

export function getUserTTSSettings(userId, guildId = null) {
    const savedSettings = userTTSSettings.get(userId);
    if (savedSettings) return savedSettings;

    const sessionSettings = guildId ? getState(guildId)?.sessionTTSSettings : null;
    if (sessionSettings?.has(userId)) return sessionSettings.get(userId);

    const randomSettings = {
        speed: getRandomValue(0.9, 1.3),
        pitch: getRandomValue(0.8, 1.2)
    };
    if (guildId && userId) getState(guildId)?.sessionTTSSettings.set(userId, randomSettings);
    return randomSettings;
}

export function setUserTTSSettings(userId, settings) {
    const { speed, pitch } = settings;
    if (!Number.isFinite(speed) || speed < 0.5 || speed > 2) {
        throw new RangeError("読み上げ速度は0.5〜2.0の範囲で指定してください。");
    }
    if (!Number.isFinite(pitch) || pitch < 0.5 || pitch > 2) {
        throw new RangeError("ピッチは0.5〜2.0の範囲で指定してください。");
    }

    const nextSettings = new Map(userTTSSettings);
    nextSettings.set(userId, { speed, pitch });
    writeJson("tts-settings.json", Object.fromEntries(nextSettings));
    userTTSSettings.set(userId, { speed, pitch });
}

export async function generateTTS(userId, text, guildId = null, settings = null) {
    if (typeof text !== "string" || !text.trim()) {
        throw new TypeError("読み上げるテキストを指定してください。");
    }

    const apiKey = process.env.FISH_API_KEY || process.env.FISH_AUDIO_API_KEY;
    const referenceId = process.env.FISH_AUDIO_REFERENCE_ID;
    const model = process.env.FISH_AUDIO_MODEL || DEFAULT_FISH_AUDIO_MODEL;
    if (!apiKey) throw new Error("FISH_API_KEY が設定されていません");
    if (!referenceId) throw new Error("FISH_AUDIO_REFERENCE_ID が設定されていません");

    const { speed, pitch } = settings ?? getUserTTSSettings(userId, guildId);
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
            format: "mp3",
            prosody: { speed, pitch }
        })
    }).catch(error => {
        console.error(`Fish Audio API 通信エラー: user=${userId}`, error);
        throw error;
    });

    if (!response.ok) {
        const detail = await response.text();
        console.error(`Fish Audio API エラー: user=${userId}, status=${response.status}, detail=${detail}`);
        if (response.status === 402) {
            throw new Error("Fish AudioのAPIクレジットが不足しています。Fish Audioの開発者ページで残高を確認してください。");
        }
        throw new Error(`Fish Audio TTS failed: ${response.status} ${detail}`);
    }

    return Buffer.from(await response.arrayBuffer());
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
        const remainingSeconds = Math.ceil(remainingCooldown / 500);
        throw new Error(`再接続のクールタイム中です。あと${remainingSeconds}秒待ってください。`);
    }
    if (voiceStates.has(guildId)) {
        throw new Error("すでにボイスチャンネルへ接続しています。");
    }

    const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Stop }
    });

    const state = {
        guild: interaction.guild,
        guildId,
        connection: null,
        player,
        guildName: interaction.guild.name,
        channelId: channel.id,
        channelName: channel.name,
        queue: [],
        processing: false,
        disconnectWhenIdle: false,
        cleaned: false,
        connecting: false,
        reconnectPromise: null,
        interruptPlayback: null,
        sessionTTSSettings: new Map()
    };
    voiceStates.set(guildId, state);

    player.on("error", error => {
        console.error(`AudioPlayer エラー: guild=${guildId}`, error);
    });
    player.on("stateChange", (oldState, newState) => {
        if (oldState.status !== AudioPlayerStatus.Idle && newState.status === AudioPlayerStatus.Idle) {
            console.log(`音声再生終了: guild=${guildId}`);
        }
    });

    try {
        await connectToVC(guildId, channel.id);
    } catch (error) {
        state.cleaned = true;
        voiceStates.delete(guildId);
        throw error;
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

export async function connectToVC(guildId, channelId) {
    const state = getState(guildId);
    if (!state || state.cleaned) {
        throw new Error(`VC接続の状態が見つかりません: guild=${guildId}`);
    }

    state.connecting = true;
    let lastError;
    for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
        let connection;
        try {
            connection = joinVoiceChannel({
                channelId,
                guildId,
                adapterCreator: state.guild.voiceAdapterCreator,
                selfDeaf: true
            });
            state.connection = connection;
            connectionStates.set(connection, state);
            connection.subscribe(state.player);
            monitorConnection(connection);
            await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
            state.connecting = false;
            console.log(`VC 接続成功: guild=${guildId}, channel=${channelId}`);
            return connection;
        } catch (error) {
            lastError = error;
            console.error(`VC 接続失敗 (${attempt}/${MAX_CONNECT_ATTEMPTS}): guild=${guildId}, channel=${channelId}`, error);
            if (connection) {
                connection.destroy();
                if (state.connection === connection) state.connection = null;
            }
            if (attempt < MAX_CONNECT_ATTEMPTS) {
                await new Promise(resolve => setTimeout(resolve, CONNECT_RETRY_DELAY_MS * attempt));
            }
        }
    }

    state.connecting = false;
    throw new Error(`VCへの接続に${MAX_CONNECT_ATTEMPTS}回失敗しました: ${lastError?.message || "不明なエラー"}`);
}

export function monitorConnection(connection) {
    const state = connectionStates.get(connection);
    if (!state || monitoredConnections.has(connection)) return;

    monitoredConnections.add(connection);
    connection.on("stateChange", (oldState, newState) => {
        console.log(`VC接続状態: guild=${state.guildId} ${oldState.status} -> ${newState.status}`);
        if (newState.status === VoiceConnectionStatus.Disconnected && !state.cleaned) {
            console.warn(`VC 再接続: guild=${state.guildId}`);
            state.interruptPlayback?.();
            if (!state.connecting && !state.reconnectPromise) {
                state.reconnectPromise = reconnectConnection(state)
                    .finally(() => {
                        state.reconnectPromise = null;
                    });
                state.reconnectPromise.catch(error => {
                    console.error(`VC 再接続失敗: guild=${state.guildId}`, error);
                });
            }
        }
    });
    connection.on("error", error => {
        console.error(`VC接続エラー: guild=${state.guildId}`, error);
    });
}

async function reconnectConnection(state) {
    const connection = state.connection;
    if (connection && !state.cleaned) {
        for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
            try {
                connection.rejoin();
                await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
                console.log(`VC 再接続成功: guild=${state.guildId}`);
                return connection;
            } catch (error) {
                console.error(`VC 再接続失敗 (${attempt}/${MAX_CONNECT_ATTEMPTS}): guild=${state.guildId}`, error);
                if (attempt < MAX_CONNECT_ATTEMPTS) {
                    await new Promise(resolve => setTimeout(resolve, CONNECT_RETRY_DELAY_MS * attempt));
                }
            }
        }
        connection.destroy();
        if (state.connection === connection) state.connection = null;
    }

    if (state.cleaned) throw new Error(`VCはすでに切断されています: guild=${state.guildId}`);
    return connectToVC(state.guildId, state.channelId);
}

async function waitForConnection(state) {
    if (state.cleaned) throw new Error(`VCはすでに切断されています: guild=${state.guildId}`);
    if (state.reconnectPromise) return state.reconnectPromise;

    const connection = state.connection;
    if (connection?.state.status === VoiceConnectionStatus.Ready) return connection;
    if (!state.reconnectPromise) {
        state.reconnectPromise = reconnectConnection(state)
            .finally(() => {
                state.reconnectPromise = null;
            });
        state.reconnectPromise.catch(error => {
            console.error(`VC 再接続失敗: guild=${state.guildId}`, error);
        });
    }
    return state.reconnectPromise;
}

export async function playAudio(connection, buffer) {
    const state = connectionStates.get(connection);
    if (!state || state.cleaned) throw new Error("再生可能なVC接続がありません。");
    if (!Buffer.isBuffer(buffer)) throw new TypeError("playAudioにはBufferを指定してください。");

    while (!state.cleaned) {
        await waitForConnection(state);
        let resource;
        try {
            resource = createAudioResource(Readable.from([buffer]), {
                inputType: StreamType.Arbitrary
            });
        } catch (error) {
            console.error(`音声リソースの作成に失敗: guild=${state.guildId}`, error);
            throw error;
        }

        const activeConnection = state.connection;
        let interrupted;
        let wasInterrupted = false;
        const interruption = new Promise(resolve => {
            interrupted = () => {
                wasInterrupted = true;
                resolve();
            };
            state.interruptPlayback = interrupted;
        });

        try {
            state.player.play(resource);
            console.log(`音声再生開始: guild=${state.guildId}`);
            const playback = entersState(state.player, AudioPlayerStatus.Idle, 120_000)
                .then(() => "finished");
            const result = await Promise.race([playback, interruption.then(() => "interrupted")]);
            if (state.cleaned) return;
            if (result === "interrupted" || wasInterrupted || activeConnection !== state.connection ||
                state.connection?.state.status !== VoiceConnectionStatus.Ready) {
                await waitForConnection(state);
                continue;
            }
            if (!resource.ended) {
                throw new Error(`音声再生が完了前に停止しました: guild=${state.guildId}`);
            }
            return;
        } finally {
            if (state.interruptPlayback === interrupted) state.interruptPlayback = null;
        }
    }
}

export function cleanup(connection) {
    const state = connectionStates.get(connection);
    return state ? cleanupState(state) : false;
}

function cleanupState(state) {
    if (state.cleaned) return false;
    state.cleaned = true;
    state.interruptPlayback?.();
    state.player.stop();
    state.connection?.destroy();
    state.connection = null;
    voiceStates.delete(state.guildId);
    logVoiceEvent("VC退出", {
        サーバーID: state.guildId,
        サーバー名: state.guildName,
        チャンネルID: state.channelId,
        チャンネル名: state.channelName
    });
    return true;
}

export function leaveGuildVoice(guildId) {
    const state = voiceStates.get(guildId);
    if (!state) return false;

    return cleanupState(state);
}

export function enqueueVoiceText(guildId, text, userId = null, accountName = "不明") {
    const state = getState(guildId);
    if (!state) return false;

    const content = cleanText(text).slice(0, MAX_READ_LENGTH);
    if (!content) return false;

    const ttsSettings = getUserTTSSettings(userId, guildId);
    state.queue.push({ text: content, userId, accountName, ttsSettings });
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
        enqueueVoiceText(
            newState.guild.id,
            `${getMemberName(member)}さんが参加しました`,
            member?.user?.id,
            member?.user?.username || "不明"
        );
    } else if (!isBot && wasInTarget && !isInTarget) {
        enqueueVoiceText(
            newState.guild.id,
            `${getMemberName(member)}さんが退出しました`,
            member?.user?.id,
            member?.user?.username || "不明"
        );
        if (member?.user?.id) state.sessionTTSSettings.delete(member.user.id);
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
    return name.slice(0, MAX_READ_LENGTH - "さんが参加しました".length);
}

function cleanText(text) {
    return text
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function enqueueMessage(message) {
    const state = getState(message.guild?.id);
    const voiceChannel = message.guild?.channels.cache.get(state?.channelId);
    if (!state || !voiceChannel?.parentId || voiceChannel.parentId !== message.channel?.parentId) return;

    const normalizedContent = cleanText(message.content);
    const shortenedContent = normalizedContent.length > MAX_READ_LENGTH
        ? `${normalizedContent.slice(0, MAX_READ_LENGTH - OMITTED_TEXT.length)}${OMITTED_TEXT}`
        : normalizedContent;
    if (!shortenedContent) return;

    enqueueVoiceText(message.guild.id, shortenedContent, message.author.id, message.author.username);
}

async function processQueue(guildId) {
    const state = getState(guildId);
    if (!state || state.processing) return;

    state.processing = true;
    try {
        while (state.queue.length > 0 && voiceStates.get(guildId) === state && !state.cleaned) {
            const { text, userId, accountName, ttsSettings } = state.queue.shift();
            const logDetails = {
                サーバー名: state.guildName,
                読み上げ対象アカウント: accountName,
                アカウントID: userId,
                読み上げ内容: text
            };
            const timestamp = logVoiceEvent("読み上げ開始", logDetails);
            console.log([
                "--- VC・読み上げログ ---",
                `日時: ${timestamp}`,
                "イベント: 読み上げ開始",
                ...Object.entries(logDetails).map(([key, value]) => `${key}: ${value ?? "不明"}`)
            ].join("\n"));
            const buffer = await generateTTS(userId, text, guildId, ttsSettings);
            if (state.connection) await playAudio(state.connection, buffer);
        }
    } catch (error) {
        console.error(`読み上げエラー: guild=${guildId}`, error);
    } finally {
        const latestState = getState(guildId);
        if (latestState) latestState.processing = false;
        if (latestState?.disconnectWhenIdle && latestState.queue.length === 0) {
            leaveGuildVoice(guildId);
        }
    }
}