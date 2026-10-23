import { readJson, writeJson } from "./dataPaths.js";

const INITIAL_BALANCE = 1000;
const CASINO_FILE = "casino.json";

function loadCasinoData() {
    const storedData = readJson(CASINO_FILE, {});
    const casinoData = {};

    for (const [key, value] of Object.entries(storedData)) {
        if (isAccount(value)) {
                mergeAccount(casinoData, key, withPeriods(value));
            continue;
        }

        if (!value || typeof value !== "object") continue;
        for (const [userId, account] of Object.entries(value)) {
            if (isAccount(account)) mergeAccount(casinoData, userId, withPeriods(account));
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

function withPeriods(account) {
    const periods = account.periods || {};
    return {
        ...account,
        periods: {
            today: Number.isFinite(periods.today) ? periods.today : 0,
            weekly: Number.isFinite(periods.weekly) ? periods.weekly : 0,
            monthly: Number.isFinite(periods.monthly) ? periods.monthly : 0,
            total: Number.isFinite(periods.total) ? periods.total : account.balance,
        },
    };
}

function createAccount() {
    return withPeriods({ balance: INITIAL_BALANCE });
}

function changeBalance(account, amount) {
    account.balance += amount;
    for (const period of ["today", "weekly", "monthly", "total"]) {
        account.periods[period] += amount;
    }
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
        data[userId] = createAccount();
        saveCasinoData(data);
    }

    return data[userId];
}

export function getBalance(guildId, userId) {
    return getAccount(guildId, userId).balance;
}

export function placeBet(_guildId, userId, amount) {
    const data = loadCasinoData();
    const account = data[userId] || createAccount();

    if (account.balance < amount) return false;

    changeBalance(account, -amount);
    data[userId] = account;
    saveCasinoData(data);
    return true;
}

export function addCoins(_guildId, userId, amount) {
    const data = loadCasinoData();
    const account = data[userId] || createAccount();

    changeBalance(account, amount);
    data[userId] = account;
    saveCasinoData(data);
    return account.balance;
}

export function claimDaily(_guildId, userId, today) {
    const data = loadCasinoData();
    const account = data[userId] || createAccount();

    if (account.lastDaily === today) return null;

    changeBalance(account, 1000);
    account.lastDaily = today;
    data[userId] = account;
    saveCasinoData(data);
    return account.balance;
}

export function rolloverCasinoDaily() {
    const data = loadCasinoData();
    for (const account of Object.values(data)) {
        account.periods.weekly += account.periods.today;
        account.periods.monthly += account.periods.today;
        account.periods.today = 0;
    }
    saveCasinoData(data);
}

export function resetCasinoWeekly() {
    resetPeriod("weekly");
}

export function resetCasinoMonthly() {
    resetPeriod("monthly");
}

function resetPeriod(period) {
    const data = loadCasinoData();
    for (const account of Object.values(data)) account.periods[period] = 0;
    saveCasinoData(data);
}

export function getInitialBalance() {
    return INITIAL_BALANCE;
}
