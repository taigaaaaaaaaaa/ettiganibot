import { readJson, writeJson } from "./dataPaths.js";

const INITIAL_BALANCE = 1000;
const CASINO_FILE = "casino.json";

function loadCasinoData() {
    return readJson(CASINO_FILE, {});
}

function saveCasinoData(data) {
    writeJson(CASINO_FILE, data);
}

function getGuildData(data, guildId) {
    if (!data[guildId] || typeof data[guildId] !== "object") {
        data[guildId] = {};
    }
    return data[guildId];
}

export function getAccount(guildId, userId) {
    const data = loadCasinoData();
    const guildData = getGuildData(data, guildId);

    if (!guildData[userId] || typeof guildData[userId] !== "object") {
        guildData[userId] = { balance: INITIAL_BALANCE };
        saveCasinoData(data);
    }

    return guildData[userId];
}

export function getBalance(guildId, userId) {
    return getAccount(guildId, userId).balance;
}

export function placeBet(guildId, userId, amount) {
    const data = loadCasinoData();
    const guildData = getGuildData(data, guildId);
    const account = guildData[userId] || { balance: INITIAL_BALANCE };

    if (account.balance < amount) return false;

    account.balance -= amount;
    guildData[userId] = account;
    saveCasinoData(data);
    return true;
}

export function addCoins(guildId, userId, amount) {
    const data = loadCasinoData();
    const guildData = getGuildData(data, guildId);
    const account = guildData[userId] || { balance: INITIAL_BALANCE };

    account.balance += amount;
    guildData[userId] = account;
    saveCasinoData(data);
    return account.balance;
}

export function claimDaily(guildId, userId, today) {
    const data = loadCasinoData();
    const guildData = getGuildData(data, guildId);
    const account = guildData[userId] || { balance: INITIAL_BALANCE };

    if (account.lastDaily === today) return null;

    account.balance += 1000;
    account.lastDaily = today;
    guildData[userId] = account;
    saveCasinoData(data);
    return account.balance;
}

export function getInitialBalance() {
    return INITIAL_BALANCE;
}
