import { readJson, writeJson } from "./dataPaths.js";

const FILE_NAME = "guild-rankings.json";

function loadGuildRankings() {
    return readJson(FILE_NAME, {});
}

export function incrementGuildCount(guildId, userId) {
    if (!guildId) return;

    const rankings = loadGuildRankings();
    const guild = rankings[guildId] || {};
    guild.today ||= {};
    guild.total ||= {};
    guild.today[userId] = (Number(guild.today[userId]) || 0) + 1;
    guild.total[userId] = (Number(guild.total[userId]) || 0) + 1;
    rankings[guildId] = guild;
    writeJson(FILE_NAME, rankings);
}

export function rolloverGuildRankingDay() {
    const rankings = loadGuildRankings();
    for (const guild of Object.values(rankings)) {
        guild.weekly ||= {};
        guild.monthly ||= {};
        for (const [userId, count] of Object.entries(guild.today || {})) {
            guild.weekly[userId] = (Number(guild.weekly[userId]) || 0) + count;
            guild.monthly[userId] = (Number(guild.monthly[userId]) || 0) + count;
        }
        guild.today = {};
    }
    writeJson(FILE_NAME, rankings);
}

export function resetGuildRankingPeriod(period) {
    const rankings = loadGuildRankings();
    for (const guild of Object.values(rankings)) {
        guild[period] = {};
    }
    writeJson(FILE_NAME, rankings);
}
