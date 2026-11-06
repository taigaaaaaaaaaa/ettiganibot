const API_BASE = "https://discord.com/api/v10";
const CACHE_TTL = 90_000;
const MAX_DISCORD_429_RETRIES = 2;
const MAX_DISCORD_RETRY_AFTER_SECONDS = 30;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function discordRequest(url, options) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, options);
    if (response.status !== 429) return response;

    const body = await response.json().catch(() => null);
    const headerValue = response.headers.get("retry-after");
    const headerSeconds = headerValue ? Number(headerValue) : Number.NaN;
    const headerDate = headerValue ? Date.parse(headerValue) : Number.NaN;
    const retryAfter = Number.isFinite(headerSeconds)
      ? headerSeconds
      : Number.isFinite(headerDate)
        ? Math.max(0, (headerDate - Date.now()) / 1000)
        : Number(body?.retry_after);
    if (
      attempt >= MAX_DISCORD_429_RETRIES ||
      !Number.isFinite(retryAfter) ||
      retryAfter < 0 ||
      retryAfter > MAX_DISCORD_RETRY_AFTER_SECONDS
    ) {
      throw new Error(
        `Discord rate limit exceeded; retry budget exhausted (retry_after=${Number.isFinite(retryAfter) ? retryAfter : "unknown"}).`,
      );
    }

    await wait(retryAfter * 1000);
  }
}

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

async function discordFetch(endpoint) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;

  let response;
  try {
    response = await discordRequest(`${API_BASE}${endpoint}`, {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (response.status === 404) return null;
  if (!response.ok) return null;
  return response.json();
}

export function getDiscordUser(userId) {
  return cached(`user:${userId}`, () => discordFetch(`/users/${encodeURIComponent(userId)}`));
}

export async function sendDiscordDirectMessage(userId, content) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured.");

  const headers = {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  };
  const createChannelResponse = await discordRequest(`${API_BASE}/users/@me/channels`, {
    method: "POST",
    headers,
    body: JSON.stringify({ recipient_id: userId }),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!createChannelResponse.ok) {
    throw new Error(
      `Discord DM channel creation failed with status ${createChannelResponse.status}.`,
    );
  }

  const channel = await createChannelResponse.json();
  const messageResponse = await discordRequest(
    `${API_BASE}/channels/${encodeURIComponent(channel.id)}/messages`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    },
  );
  if (!messageResponse.ok) {
    throw new Error(`Discord DM delivery failed with status ${messageResponse.status}.`);
  }
}

export function getGuildMember(guildId, userId) {
  return cached(`member:${guildId}:${userId}`, () =>
    discordFetch(`/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`),
  );
}

export function getDiscordGuild(guildId) {
  return cached(`guild:${guildId}`, () =>
    discordFetch(`/guilds/${encodeURIComponent(guildId)}?with_counts=true`),
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
