import { readJson, writeJson } from "./dataPaths.js";

const INITIAL_BALANCE = 1000;
const CASINO_FILE = "casino.json";

function loadCasinoData() {
    const storedData = readJson(CASINO_FILE, {});
    const casinoData = {};

    for (const [key, value] of Object.entries(storedData)) {
        if (isAccount(value)) {
            mergeAccount(casinoData, key, value);
            continue;
        }

        if (!value || typeof value !== "object") continue;
        for (const [userId, account] of Object.entries(value)) {
            if (isAccount(account)) mergeAccount(casinoData, userId, account);
        }
    }

    if (JSON.stringify(storedData) !== JSON.stringify(casinoData)) {
        saveCasinoData(casinoData);
    }

    return casinoData;
}

function saveCasinoData(data) {
    writeJson(CASINO_FILE, data);
}

function isAccount(value) {
    return value && typeof value === "object" && Number.isFinite(value.balance);
}

function mergeAccount(data, userId, account) {
    const current = data[userId];
    if (!current || account.balance > current.balance) {
        data[userId] = { ...account };
    } else if (account.lastDaily && (!current.lastDaily || account.lastDaily > current.lastDaily)) {
        current.lastDaily = account.lastDaily;
    }
}

export function getAccount(_guildId, userId) {
    const data = loadCasinoData();

    if (!data[userId]) {
        data[userId] = { balance: INITIAL_BALANCE };
        saveCasinoData(data);
    }

    return data[userId];
}

export function getBalance(guildId, userId) {
    return getAccount(guildId, userId).balance;
}

export function placeBet(_guildId, userId, amount) {
    const data = loadCasinoData();
    const account = data[userId] || { balance: INITIAL_BALANCE };

    if (account.balance < amount) return false;

    account.balance -= amount;
    data[userId] = account;
    saveCasinoData(data);
    return true;
}

export function addCoins(_guildId, userId, amount) {
    const data = loadCasinoData();
    const account = data[userId] || { balance: INITIAL_BALANCE };

    account.balance += amount;
    data[userId] = account;
    saveCasinoData(data);
    return account.balance;
}

export function claimDaily(_guildId, userId, today) {
    const data = loadCasinoData();
    const account = data[userId] || { balance: INITIAL_BALANCE };

    if (account.lastDaily === today) return null;

    account.balance += 1000;
    account.lastDaily = today;
    data[userId] = account;
    saveCasinoData(data);
    return account.balance;
}

export function getInitialBalance() {
    return INITIAL_BALANCE;
}
