const API_BASE = "https://discord.com/api/v10";
const CACHE_TTL = 90_000;

function getCache() {
  if (!globalThis.discordPortalCache) globalThis.discordPortalCache = new Map();
  return globalThis.discordPortalCache;
}

async function cached(key, loader) {
  const cache = getCache();
  const existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value;

  const pending = loader().catch(() => null);
  cache.set(key, { value: pending, expiresAt: Date.now() + CACHE_TTL });
  const value = await pending;
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
  return value;
}

async function discordFetch(endpoint, retries = 1) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { Authorization: `Bot ${token}` },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (response.status === 429 && retries > 0) {
    const retryAfter = Number(response.headers.get("retry-after") || 1);
    await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter * 1000, 5000)));
    return discordFetch(endpoint, retries - 1);
  }
  if (!response.ok) return null;
  return response.json();
}

export function getDiscordUser(userId) {
  return cached(`user:${userId}`, () => discordFetch(`/users/${encodeURIComponent(userId)}`));
}

export function getGuildMember(guildId, userId) {
  return cached(`member:${guildId}:${userId}`, () =>
    discordFetch(`/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`),
  );
}

export function getDiscordGuild(guildId) {
  return cached(`guild:${guildId}`, () =>
    discordFetch(`/guilds/${encodeURIComponent(guildId)}?with_counts=false`),
  );
}

export function getGuildMembers(guildId) {
  return cached(`members:${guildId}`, async () => {
    const members = [];
    let after = "0";

    while (true) {
      const page = await discordFetch(
        `/guilds/${encodeURIComponent(guildId)}/members?limit=1000&after=${after}`,
      );
      if (!Array.isArray(page)) return null;
      members.push(...page);
      if (page.length < 1000) return members;
      after = page.at(-1)?.user?.id;
      if (!after) return members;
    }
  });
}

export async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        results[index] = await mapper(items[index], index);
      }
    }),
  );
  return results;
}

export function getDefaultAvatar(userId) {
  try {
    const index = Number((BigInt(userId) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
}

export function getAvatarUrl(user, userId) {
  if (!user?.avatar) return getDefaultAvatar(userId);
  const extension = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=96`;
}
