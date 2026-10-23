import fs from "node:fs";
import path from "node:path";

const DATA_FILES = new Set([
  "counts.json",
  "weekly.json",
  "monthly.json",
  "total.json",
  "levels.json",
  "setting.json",
  "guilds.json",
  "guild-rankings.json",
  "casino.json",
]);

const dataCache = new Map();

export function readData(fileName, fallback = {}) {
  if (!DATA_FILES.has(fileName)) return fallback;

  const dataDirectory =
    process.env.BOT_DATA_DIR || path.resolve(process.cwd(), "../ettiganibot/data");
  const filePath = path.join(dataDirectory, fileName);

  try {
    const stats = fs.statSync(filePath, { bigint: true });
    const cached = dataCache.get(filePath);
    if (
      cached &&
      cached.modifiedAt === stats.mtimeNs &&
      cached.changedAt === stats.ctimeNs &&
      cached.size === stats.size
    ) {
      return cached.value;
    }

    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    dataCache.set(filePath, {
      modifiedAt: stats.mtimeNs,
      changedAt: stats.ctimeNs,
      size: stats.size,
      value,
    });
    return value;
  } catch {
    return fallback;
  }
}

export function getGuilds() {
  const registry = readData("guilds.json", {});
  if (Object.keys(registry).length) return registry;

  return Object.fromEntries(
    Object.entries(readData("setting.json", {})).map(([id, settings]) => [
      id,
      { name: null, rankChannelConfigured: Boolean(settings?.rank_channel) },
    ]),
  );
}

export function getGuildScoreData(guildId, period) {
  const guildData = readData("guild-rankings.json", {})[guildId];
  const scores = guildData?.[period];
  return scores && typeof scores === "object" && !Array.isArray(scores) ? scores : {};
}

export function hasGuildRegistry() {
  return Object.keys(readData("guilds.json", {})).length > 0;
}

export function getScoreData(period) {
  const sourceFile = {
    today: "counts.json",
    weekly: "weekly.json",
    monthly: "monthly.json",
    total: "total.json",
  }[period];

  if (!sourceFile) return {};
  return readData(sourceFile, {});
}

export function getCasinoScores(period = "total") {
  const storedData = readData("casino.json", {});
  const scores = {};

  function getScore(account) {
    if (Number.isFinite(account?.periods?.[period])) return account.periods[period];
    return period === "total" && Number.isFinite(account?.balance) ? account.balance : 0;
  }

  for (const [key, value] of Object.entries(storedData)) {
    if (Number.isFinite(value?.balance)) {
      scores[key] = Math.max(scores[key] ?? -Infinity, getScore(value));
      continue;
    }

    if (!value || typeof value !== "object") continue;
    for (const [userId, account] of Object.entries(value)) {
      if (!Number.isFinite(account?.balance)) continue;
      scores[userId] = Math.max(scores[userId] ?? -Infinity, getScore(account));
    }
  }

  return scores;
}

export function getCasinoMetrics(userId) {
  const storedData = readData("casino.json", {});
  const metrics = { today: 0, weekly: 0, monthly: 0, total: 0 };

  function mergeAccount(account) {
    if (!Number.isFinite(account?.balance)) return;
    for (const period of Object.keys(metrics)) {
      const score = Number.isFinite(account.periods?.[period])
        ? account.periods[period]
        : period === "total"
          ? account.balance
          : 0;
      metrics[period] = Math.max(metrics[period], score);
    }
  }

  for (const [key, value] of Object.entries(storedData)) {
    if (key === userId && Number.isFinite(value?.balance)) {
      mergeAccount(value);
      continue;
    }
    if (value && typeof value === "object" && Number.isFinite(value[userId]?.balance)) {
      mergeAccount(value[userId]);
    }
  }

  return metrics;
}

export function getLevel(total) {
  return Math.floor(Math.sqrt(Math.max(0, Number(total) || 0)));
}
