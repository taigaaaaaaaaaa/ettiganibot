import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getGuildMember } from "./discord.js";

const EMPTY_STORE = {
  users: {},
  posts: [],
  auditLogs: [],
  notificationRateLimits: {},
  pendingNotifications: [],
  pendingLikeNotifications: [],
  pendingAggregatedNotifications: [],
  likeNotificationDedupe: {},
  notificationCooldowns: {},
};
let writeQueue = Promise.resolve();
let lastRateLimitCleanupAt = 0;

export function getCommunityCategories(posts) {
  return [
    ...new Set(
      posts
        .map((post) => (typeof post.category === "string" ? post.category.trim() : ""))
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "ja"));
}

export function getCommunityUploadDirectory() {
  const dataDirectory =
    process.env.COMMUNITY_DATA_DIR ||
    (process.env.NODE_ENV === "production"
      ? "/app/community-data"
      : path.join(process.cwd(), "data"));
  return path.join(dataDirectory, "uploads");
}

function getStorePath() {
  const dataDirectory =
    process.env.COMMUNITY_DATA_DIR ||
    (process.env.NODE_ENV === "production"
      ? "/app/community-data"
      : path.join(process.cwd(), "data"));
  return path.join(dataDirectory, "community.json");
}

export function readCommunityStore() {
  try {
    const value = JSON.parse(fs.readFileSync(getStorePath(), "utf8"));
    return {
      users: value?.users && typeof value.users === "object" ? value.users : {},
      posts: Array.isArray(value?.posts) ? value.posts : [],
      auditLogs: Array.isArray(value?.auditLogs) ? value.auditLogs : [],
      notificationRateLimits:
        value?.notificationRateLimits && typeof value.notificationRateLimits === "object"
          ? value.notificationRateLimits
          : {},
      pendingNotifications: Array.isArray(value?.pendingNotifications)
        ? value.pendingNotifications
        : [],
      pendingLikeNotifications: Array.isArray(value?.pendingLikeNotifications)
        ? value.pendingLikeNotifications
        : [],
      pendingAggregatedNotifications: Array.isArray(value?.pendingAggregatedNotifications)
        ? value.pendingAggregatedNotifications
        : [],
      likeNotificationDedupe:
        value?.likeNotificationDedupe && typeof value.likeNotificationDedupe === "object"
          ? value.likeNotificationDedupe
          : {},
      notificationCooldowns:
        value?.notificationCooldowns && typeof value.notificationCooldowns === "object"
          ? value.notificationCooldowns
          : {},
    };
  } catch (error) {
    if (error.code === "ENOENT") return structuredClone(EMPTY_STORE);
    throw new Error(`Unable to read community data: ${error.message}`);
  }
}

export function updateCommunityStore(update) {
  const operation = writeQueue.then(async () => {
    const store = readCommunityStore();
    const result = await update(store);
    const filePath = getStorePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(temporaryPath, filePath);
    return result;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

export function consumeCommunityRateLimit(store, userId, action, now = Date.now()) {
  const limits = { like: 20, comment: 5, reply: 5 };
  const limit = limits[action];
  if (!limit) return { allowed: true };

  store.notificationRateLimits ||= {};
  const key = `${action}:${userId}`;
  let window = store.notificationRateLimits[key];
  if (!window || now - window.startedAt >= 60_000 || now < window.startedAt) {
    window = { startedAt: now, count: 0 };
    store.notificationRateLimits[key] = window;
  }
  if (window.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((window.startedAt + 60_000 - now) / 1000)),
    };
  }

  window.count += 1;
  if (now - lastRateLimitCleanupAt >= 60_000) {
    for (const [entryKey, entry] of Object.entries(store.notificationRateLimits)) {
      if (
        !Number.isFinite(entry?.startedAt) ||
        now - entry.startedAt >= 60_000 ||
        now < entry.startedAt
      ) {
        delete store.notificationRateLimits[entryKey];
      }
    }
    lastRateLimitCleanupAt = now;
  }
  return { allowed: true };
}

export function saveCommunityUser(user) {
  return updateCommunityStore((store) => {
    const previous = store.users[user.id];
    store.users[user.id] = {
      ...user,
      registeredAt: previous?.registeredAt || new Date().toISOString(),
    };
  });
}

export function getCommunityPost(postId) {
  return readCommunityStore().posts.find((post) => post.id === postId) || null;
}

export function serializeCommunityPost(post, viewer) {
  const likes = Array.isArray(post.likes) ? post.likes : [];
  const saves = Array.isArray(post.saves) ? post.saves : [];
  const comments = Array.isArray(post.comments) ? post.comments : [];

  return {
    id: post.id,
    title: post.title,
    body: post.body,
    category: post.category,
    tags: Array.isArray(post.tags) ? post.tags : [],
    thumbnail: post.thumbnail || null,
    visibility: post.visibility,
    author: {
      id: post.author?.id,
      username: post.author?.username,
      globalName: post.author?.globalName,
      avatar: post.author?.avatar,
    },
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    likeCount: likes.length,
    saveCount: saves.length,
    liked: Boolean(viewer && likes.includes(viewer.id)),
    saved: Boolean(viewer && saves.includes(viewer.id)),
    comments: comments.map((comment) => ({
      id: comment.id,
      ...(comment.parentCommentId ? { parentCommentId: comment.parentCommentId } : {}),
      body: comment.body,
      author: {
        id: comment.author?.id,
        username: comment.author?.username,
        globalName: comment.author?.globalName,
        avatar: comment.author?.avatar,
      },
      createdAt: comment.createdAt,
      ...(comment.editedAt ? { editedAt: comment.editedAt } : {}),
      ...(comment.deletedAt ? { deletedAt: comment.deletedAt } : {}),
    })),
  };
}

export function getPostEditedLabel(post) {
  if (!post.updatedAt || new Date(post.updatedAt) <= new Date(post.createdAt)) return null;
  const days = Math.floor((Date.now() - new Date(post.updatedAt).getTime()) / 86_400_000);
  return `${Math.max(0, days)}日前に編集済み`;
}

export function sanitizeCommunityText(value) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

export async function canViewPost(post, viewer) {
  if (post.visibility !== "server") return true;
  if (!viewer || !post.guildId) return false;
  return Boolean(await getGuildMember(post.guildId, viewer.id));
}

export async function getVisiblePosts(posts, viewer) {
  const visible = [];
  for (const post of posts) {
    if (await canViewPost(post, viewer)) visible.push(post);
  }
  return visible;
}

export function sortPosts(posts, sort = "latest") {
  return [...posts].sort((a, b) => {
    if (sort === "popular") {
      const score =
        (b.likes?.length || 0) +
        (b.comments?.length || 0) * 2 -
        ((a.likes?.length || 0) + (a.comments?.length || 0) * 2);
      if (score) return score;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function getUserAvatarUrl(user, size = 96) {
  if (user?.avatar) {
    const extension = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=${size}`;
  }
  const discriminator = Number((BigInt(user?.id || "0") >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${discriminator}.png`;
}
