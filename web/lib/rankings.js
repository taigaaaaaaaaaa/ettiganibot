import {
  getDiscordGuild,
  getDiscordUser,
  getGuildMember,
  getGuildMembers,
  mapWithConcurrency,
} from "./discord.js";
import {
  getCasinoMetrics,
  getCasinoScores,
  getGuildScoreData,
  getGuilds,
  getLevel,
  getScoreData,
} from "./data.js";

const PERIODS = new Set(["today", "weekly", "monthly", "total"]);

function createRankingRows(period, guildId) {
  const scores = guildId ? getGuildScoreData(guildId, period) : getScoreData(period);
  const totals =
    period === "total"
      ? scores
      : guildId
        ? getGuildScoreData(guildId, "total")
        : getScoreData("total");

  return Object.entries(scores)
    .map(([userId, score]) => ({
      userId,
      score: Number(score) || 0,
      total: Number(totals[userId]) || 0,
    }))
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score || left.userId.localeCompare(right.userId))
    .map((row, index) => ({ ...row, rank: index + 1, level: getLevel(row.total) }));
}

export async function resolveGuildName(guildId, guild = {}) {
  if (typeof guild?.name === "string" && guild.name.trim()) return guild.name;
  const discordGuild = await getDiscordGuild(guildId);
  return discordGuild?.name || "サーバー名を取得できません";
}

export async function resolveGuilds(guilds = getGuilds()) {
  const entries = Object.entries(guilds);
  const names = await mapWithConcurrency(entries, 4, async ([id, guild]) => [
    id,
    await resolveGuildName(id, guild),
  ]);
  return Object.fromEntries(names.map(([id, name]) => [id, { ...guilds[id], name }]));
}

function createCasinoRankingRows(period) {
  return Object.entries(getCasinoScores(period))
    .map(([userId, balance]) => ({ userId, score: balance, total: 0 }))
    .filter((row) => row.score !== 0)
    .sort((left, right) => right.score - left.score || left.userId.localeCompare(right.userId))
    .map((row, index) => ({ ...row, rank: index + 1, level: 0 }));
}

async function enrichUsers(rows, guildId) {
  return mapWithConcurrency(rows, 8, async (row) => {
    const [discordUser, member] = await Promise.all([
      getDiscordUser(row.userId),
      guildId ? getGuildMember(guildId, row.userId) : Promise.resolve(null),
    ]);

    const user = discordUser || member?.user;
    return {
      ...row,
      username: user?.username || row.userId,
      displayName: member?.nick || user?.global_name || user?.username || row.userId,
      avatarUrl: user?.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith("a_") ? "gif" : "png"}?size=96`
        : null,
      guildMember: Boolean(member),
    };
  });
}

async function attachAffiliations(rows) {
  const guilds = getGuilds();
  const guildEntries = Object.entries(guilds);
  if (!process.env.DISCORD_BOT_TOKEN || !guildEntries.length || !rows.length) {
    return rows.map((row) => ({ ...row, guilds: [] }));
  }

  const userGuilds = new Map(rows.map((row) => [row.userId, []]));
  await mapWithConcurrency(guildEntries, 3, async ([guildId, guild]) => {
    const members = await getGuildMembers(guildId);
    for (const member of members || []) {
      const affiliations = userGuilds.get(member.user?.id);
      if (!affiliations) continue;
      affiliations.push({ id: guildId, name: await resolveGuildName(guildId, guild) });
    }
  });

  return rows.map((row) => ({ ...row, guilds: userGuilds.get(row.userId) || [] }));
}

export async function getRankings({
  mode = "count",
  period = "total",
  guildId,
  limit = 50,
  offset = 0,
  includeAffiliations = true,
} = {}) {
  if (mode !== "casino") mode = "count";
  if (!PERIODS.has(period)) period = "total";
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
  const safeOffset = Math.max(0, Math.min(Number(offset) || 0, 1_000_000));
  const allRows = mode === "casino" ? createCasinoRankingRows(period) : createRankingRows(period);
  let selectedRows = allRows;
  let guild = null;

  if (guildId) {
    guild = getGuilds()[guildId] || null;
    if (!guild) {
      return { mode, period, scope: "guild", guild: null, rows: [], total: 0, configured: false };
    }

    if (mode === "casino" && !process.env.DISCORD_BOT_TOKEN) {
      return { mode, period, scope: "guild", guild, rows: [], total: 0, configured: false };
    }

    guild = { ...guild, name: await resolveGuildName(guildId, guild) };
    if (mode === "casino") {
      const members = await getGuildMembers(guildId);
      if (!members) {
        return {
          mode,
          period,
          scope: "guild",
          guild,
          rows: [],
          total: 0,
          configured: true,
          available: false,
        };
      }
      const memberIds = new Set(members.map((member) => member.user?.id));
      selectedRows = allRows
        .filter((row) => memberIds.has(row.userId))
        .map((row, index) => ({ ...row, rank: index + 1 }));
    } else {
      selectedRows = createRankingRows(period, guildId);
    }
  }

  const rows = await enrichUsers(selectedRows.slice(safeOffset, safeOffset + safeLimit), guildId);
  const enriched = guildId || !includeAffiliations ? rows : await attachAffiliations(rows);

  return {
    mode,
    period,
    scope: guildId ? "guild" : "global",
    guild,
    rows: enriched,
    total: selectedRows.length,
    offset: safeOffset,
    limit: safeLimit,
    configured: Boolean(process.env.DISCORD_BOT_TOKEN),
    scoreScope: guildId && mode === "count" ? "guild" : "global",
  };
}

export function getUserMetrics(userId, period = "total") {
  const rows = createRankingRows(period);
  const userIndex = rows.findIndex((row) => row.userId === userId);
  const totalData = getScoreData("total");

  return {
    today: Number(getScoreData("today")[userId]) || 0,
    weekly: Number(getScoreData("weekly")[userId]) || 0,
    monthly: Number(getScoreData("monthly")[userId]) || 0,
    total: Number(totalData[userId]) || 0,
    level: getLevel(totalData[userId]),
    globalRank: userIndex === -1 ? null : userIndex + 1,
  };
}

export async function getUserProfile(userId, guildId) {
  const guildRegistry = getGuilds();
  const selectedGuildId = guildId && Object.hasOwn(guildRegistry, guildId) ? guildId : null;
  const [discordUser, guildMember] = await Promise.all([
    getDiscordUser(userId),
    selectedGuildId ? getGuildMember(selectedGuildId, userId) : Promise.resolve(null),
  ]);
  const metrics = getUserMetrics(userId);
  let guildRank = null;

  if (selectedGuildId) {
    const guildRows = createRankingRows("total", selectedGuildId);
    const index = guildRows.findIndex((row) => row.userId === userId);
    guildRank = index === -1 ? null : index + 1;
  }

  const user = discordUser || guildMember?.user;
  return {
    ...metrics,
    casino: getCasinoMetrics(userId),
    userId,
    username: user?.username || userId,
    displayName: guildMember?.nick || user?.global_name || user?.username || userId,
    avatarUrl: user?.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith("a_") ? "gif" : "png"}?size=256`
      : null,
    guildId: selectedGuildId,
    guildName: selectedGuildId
      ? await resolveGuildName(selectedGuildId, guildRegistry[selectedGuildId])
      : null,
    guildRank,
  };
}
