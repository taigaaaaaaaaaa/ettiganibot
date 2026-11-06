import { randomUUID } from "node:crypto";
import { readCommunityStore, updateCommunityStore } from "./community.js";
import { sendDiscordDirectMessage } from "./discord.js";

const LIKE_AGGREGATION_MS = 5 * 60_000;
const ACTIVITY_AGGREGATION_MS = 3 * 60_000;
const NOTIFICATION_COOLDOWN_MS = 30_000;
const MAX_PENDING_NOTIFICATIONS = 1_000;
const DM_SEND_INTERVAL_MS = 1_000;

let flushTimer;
let scheduledAt = Number.POSITIVE_INFINITY;
let flushInProgress = false;
let nextDispatchAt = 0;
let lastLikeDedupeCleanupAt = 0;

function truncate(value, limit) {
  const text = typeof value === "string" ? value : "";
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function getActor(actor) {
  return {
    id: actor?.id,
    name: truncate(actor?.globalName || actor?.username || "ユーザー", 80),
    count: 1,
  };
}

function getAggregateKey(type, recipientId, scopeId) {
  return `${type}:${recipientId}:${scopeId}`;
}

function addToAggregate(
  store,
  { type, recipient, actor, scopeId, postTitle, commentBody, postUrl },
  now,
) {
  if (!recipient?.id || !actor?.id || recipient.id === actor.id) return false;

  store.pendingAggregatedNotifications ||= [];
  let batch = store.pendingAggregatedNotifications.find(
    (item) => item.key === getAggregateKey(type, recipient.id, scopeId),
  );
  if (!batch) {
    const queuedCount =
      store.pendingNotifications.length +
      store.pendingLikeNotifications.length +
      store.pendingAggregatedNotifications.length;
    if (queuedCount >= MAX_PENDING_NOTIFICATIONS) {
      console.error("Discord notification queue is full; notification was dropped.", {
        type,
        recipientId: recipient.id,
      });
      return false;
    }

    batch = {
      id: randomUUID(),
      key: getAggregateKey(type, recipient.id, scopeId),
      type,
      recipientId: recipient.id,
      scopeId,
      postTitle: truncate(postTitle, 140),
      commentBody: truncate(commentBody, 700),
      postUrl: typeof postUrl === "string" ? postUrl : "",
      actors: [],
      createdAt: now,
      dueAt: now + ACTIVITY_AGGREGATION_MS,
    };
    store.pendingAggregatedNotifications.push(batch);
  }

  const currentActor = batch.actors.find((item) => item.id === actor.id);
  if (currentActor) {
    currentActor.count += 1;
    currentActor.name = truncate(actor.globalName || actor.username || currentActor.name, 80);
  } else {
    batch.actors.push(getActor(actor));
  }
  return true;
}

function migrateLegacyActivityNotifications(store, now) {
  const legacyTypes = new Set(["community_post_comment", "community_comment_reply"]);
  const remaining = [];
  for (const notification of store.pendingNotifications) {
    if (!legacyTypes.has(notification.type)) {
      remaining.push(notification);
      continue;
    }

    addToAggregate(
      store,
      {
        type: notification.type,
        recipient: { id: notification.recipientId },
        actor: {
          id: notification.actorId || notification.id,
          username: notification.actorName,
        },
        scopeId: notification.id,
        postTitle: notification.postTitle,
        commentBody: notification.commentBody,
        postUrl: notification.postUrl,
      },
      now,
    );
  }
  store.pendingNotifications = remaining;
}

function makeQueuedNotification({
  recipient,
  actor,
  type,
  content,
  post,
  comment,
  reply,
  postUrl,
}) {
  if (!recipient?.id || !actor?.id || recipient.id === actor.id) return null;
  return {
    id: randomUUID(),
    type,
    recipientId: recipient.id,
    actorId: actor.id,
    actorName: truncate(actor.globalName || actor.username || "ユーザー", 80),
    content: truncate(content, 1_800),
    postTitle: truncate(post?.title, 140),
    commentBody: truncate(comment?.body, 700),
    replyBody: truncate(reply?.body, 700),
    postUrl: typeof postUrl === "string" ? postUrl : "",
    dueAt: Date.now(),
  };
}

export function enqueueUserNotification(store, notification, postUrl) {
  const type = notification.type;
  if (type === "community_post_comment") {
    return addToAggregate(
      store,
      {
        type,
        recipient: notification.recipient,
        actor: notification.actor,
        scopeId: notification.post?.id,
        postTitle: notification.post?.title,
        postUrl,
      },
      Date.now(),
    );
  }
  if (type === "community_comment_reply") {
    return addToAggregate(
      store,
      {
        type,
        recipient: notification.recipient,
        actor: notification.actor,
        scopeId: notification.comment?.id,
        commentBody: notification.comment?.body,
        postUrl,
      },
      Date.now(),
    );
  }

  return enqueuePriorityNotification(store, notification, postUrl);
}

export function enqueuePriorityNotification(store, notification, postUrl) {
  if (!["mention", "admin"].includes(notification.type)) {
    console.error("Unsupported immediate notification type:", notification.type);
    return false;
  }
  const queued = makeQueuedNotification({ ...notification, postUrl });
  if (!queued) return false;

  store.pendingNotifications ||= [];
  const queuedCount =
    store.pendingNotifications.length +
    store.pendingLikeNotifications.length +
    (store.pendingAggregatedNotifications || []).length;
  if (queuedCount >= MAX_PENDING_NOTIFICATIONS) {
    console.error("Discord notification queue is full; notification was dropped.", {
      type: queued.type,
      recipientId: queued.recipientId,
    });
    return false;
  }
  store.pendingNotifications.push(queued);
  return true;
}

export function enqueueLikeNotification(
  store,
  { recipient, actor, post, postUrl },
  now = Date.now(),
) {
  if (!recipient?.id || recipient.id === actor?.id) return false;

  store.pendingLikeNotifications ||= [];
  store.likeNotificationDedupe ||= {};
  if (now - lastLikeDedupeCleanupAt >= 60_000) {
    for (const [key, expiresAt] of Object.entries(store.likeNotificationDedupe)) {
      if (!Number.isFinite(expiresAt) || expiresAt <= now) {
        delete store.likeNotificationDedupe[key];
      }
    }
    lastLikeDedupeCleanupAt = now;
  }

  const dedupeKey = `${post.id}:${actor.id}`;
  if (store.likeNotificationDedupe[dedupeKey] > now) return false;

  let batch = store.pendingLikeNotifications.find(
    (item) => item.postId === post.id && item.dueAt > now,
  );
  if (!batch) {
    const queuedCount =
      store.pendingNotifications.length +
      store.pendingLikeNotifications.length +
      (store.pendingAggregatedNotifications || []).length;
    if (queuedCount >= MAX_PENDING_NOTIFICATIONS) {
      console.error("Discord like notification queue is full; notification was dropped.", {
        postId: post.id,
        recipientId: recipient.id,
      });
      return false;
    }
    batch = {
      id: randomUUID(),
      type: "community_post_like",
      postId: post.id,
      recipientId: recipient.id,
      postTitle: truncate(post.title, 140),
      postUrl: typeof postUrl === "string" ? postUrl : "",
      actors: [],
      createdAt: now,
      dueAt: now + LIKE_AGGREGATION_MS,
    };
    store.pendingLikeNotifications.push(batch);
  }

  store.likeNotificationDedupe[dedupeKey] = now + LIKE_AGGREGATION_MS;
  batch.actors.push(getActor(actor));
  return true;
}

function summarizeActors(actors) {
  const names = actors.slice(0, 3).map((actor) => {
    const count = actor.count > 1 ? `(${actor.count}件)` : "";
    return `${actor.name}さん${count}`;
  });
  const others = actors.length - names.length;
  return `${names.join("、")}${others > 0 ? `他${others}人` : ""}`;
}

export function formatAggregatedNotification(batch) {
  const postLink = batch.postUrl ? `\n\n投稿URL:\n${batch.postUrl}` : "";
  if (batch.type === "community_post_like") {
    return [
      "👍 投稿にいいねが付きました！",
      "",
      "投稿:",
      `「${batch.postTitle || "投稿"}」`,
      "",
      `${summarizeActors(batch.actors)}があなたの投稿にいいねしました${postLink}`,
    ].join("\n");
  }
  if (batch.type === "community_post_comment") {
    return [
      "💬 新しいコメントが付きました！",
      "",
      "投稿:",
      `「${batch.postTitle || "投稿"}」`,
      "",
      `${summarizeActors(batch.actors)}があなたの投稿に${batch.actors.reduce((sum, actor) => sum + actor.count, 0)}件コメントしました${postLink}`,
    ].join("\n");
  }
  if (batch.type === "community_comment_reply") {
    return [
      "↩️ コメントに返信が付きました！",
      "",
      "コメント:",
      `「${batch.commentBody || ""}」`,
      "",
      `${summarizeActors(batch.actors)}があなたのコメントに${batch.actors.reduce((sum, actor) => sum + actor.count, 0)}件返信しました${postLink}`,
    ].join("\n");
  }
  return null;
}

function getImmediateMessage(notification) {
  const postLink = notification.postUrl ? `\n\n投稿URL:\n${notification.postUrl}` : "";
  if (notification.type === "mention") {
    return `📣 ${notification.actorName}さんがあなたにメンションしました。\n${notification.content}${postLink}`;
  }
  if (notification.type === "admin") {
    return `🔔 管理者からのお知らせ\n${notification.content}${postLink}`;
  }
  return null;
}

async function claimDueNotification(now) {
  return updateCommunityStore((store) => {
    store.pendingNotifications ||= [];
    store.pendingLikeNotifications ||= [];
    store.pendingAggregatedNotifications ||= [];
    store.likeNotificationDedupe ||= {};
    store.notificationCooldowns ||= {};
    migrateLegacyActivityNotifications(store, now);

    for (const [key, expiresAt] of Object.entries(store.notificationCooldowns)) {
      if (!Number.isFinite(expiresAt) || expiresAt <= now) delete store.notificationCooldowns[key];
    }

    const immediateIndex = store.pendingNotifications.findIndex((item) => item.dueAt <= now);
    if (immediateIndex >= 0) {
      const [notification] = store.pendingNotifications.splice(immediateIndex, 1);
      const cooldownKey = `${notification.actorId}:${notification.recipientId}`;
      if (store.notificationCooldowns[cooldownKey] > now) return { type: "suppressed" };
      store.notificationCooldowns[cooldownKey] = now + NOTIFICATION_COOLDOWN_MS;
      return { type: "immediate", notification };
    }

    const batches = [
      ...store.pendingLikeNotifications
        .filter((item) => item.dueAt <= now)
        .map((item) => ({ queue: "likes", item })),
      ...store.pendingAggregatedNotifications
        .filter((item) => item.dueAt <= now)
        .map((item) => ({ queue: "aggregate", item })),
    ].sort((a, b) => a.item.dueAt - b.item.dueAt);
    const due = batches[0];
    if (!due) return null;

    const queue =
      due.queue === "likes" ? store.pendingLikeNotifications : store.pendingAggregatedNotifications;
    const index = queue.findIndex((item) => item.id === due.item.id);
    if (index < 0) return null;
    const [batch] = queue.splice(index, 1);
    const eligibleActors = [];
    for (const actor of batch.actors) {
      const cooldownKey = `${actor.id}:${batch.recipientId}`;
      if (store.notificationCooldowns[cooldownKey] > now) continue;
      store.notificationCooldowns[cooldownKey] = now + NOTIFICATION_COOLDOWN_MS;
      eligibleActors.push(actor);
    }
    if (!eligibleActors.length) return { type: "suppressed" };
    batch.actors = eligibleActors;

    if (due.queue === "likes") {
      for (const actor of batch.actors) {
        const key = `${batch.postId}:${actor.id}`;
        store.likeNotificationDedupe[key] = Math.max(
          store.likeNotificationDedupe[key] || 0,
          now + LIKE_AGGREGATION_MS,
        );
      }
    }
    return { type: "aggregated", batch };
  });
}

async function extendNotificationCooldown(claimed, now) {
  const actors =
    claimed.type === "immediate" ? [{ id: claimed.notification.actorId }] : claimed.batch.actors;
  const recipientId =
    claimed.type === "immediate" ? claimed.notification.recipientId : claimed.batch.recipientId;

  await updateCommunityStore((store) => {
    store.notificationCooldowns ||= {};
    for (const actor of actors) {
      store.notificationCooldowns[`${actor.id}:${recipientId}`] = now + NOTIFICATION_COOLDOWN_MS;
    }
  });
}

function getNextDueAt(store) {
  const dueTimes = [
    ...(store.pendingNotifications || []).map((item) => item.dueAt),
    ...(store.pendingLikeNotifications || []).map((item) => item.dueAt),
    ...(store.pendingAggregatedNotifications || []).map((item) => item.dueAt),
  ].filter(Number.isFinite);
  return dueTimes.length ? Math.min(...dueTimes) : Number.POSITIVE_INFINITY;
}

export function schedulePendingNotifications() {
  try {
    const nextDueAt = getNextDueAt(readCommunityStore());
    if (!Number.isFinite(nextDueAt)) {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = undefined;
      scheduledAt = Number.POSITIVE_INFINITY;
      return;
    }

    const targetAt = Math.max(nextDueAt, nextDispatchAt);
    if (flushTimer && scheduledAt <= targetAt) return;
    if (flushTimer) clearTimeout(flushTimer);
    scheduledAt = targetAt;
    flushTimer = setTimeout(
      () => {
        flushTimer = undefined;
        scheduledAt = Number.POSITIVE_INFINITY;
        void flushNextNotification();
      },
      Math.max(0, targetAt - Date.now()),
    );
    flushTimer.unref?.();
  } catch (error) {
    console.error("Unable to schedule Discord DM notifications:", error);
  }
}

async function flushNextNotification() {
  if (flushInProgress) return;
  flushInProgress = true;
  try {
    const claimed = await claimDueNotification(Date.now());
    if (!claimed) return;
    if (claimed.type === "suppressed") return;

    nextDispatchAt = Date.now() + DM_SEND_INTERVAL_MS;
    try {
      const message =
        claimed.type === "immediate"
          ? getImmediateMessage(claimed.notification)
          : formatAggregatedNotification(claimed.batch);
      if (!message) {
        throw new Error(
          `Unsupported notification type: ${claimed.notification?.type || claimed.batch?.type}`,
        );
      }
      const recipientId =
        claimed.type === "immediate" ? claimed.notification.recipientId : claimed.batch.recipientId;
      await sendDiscordDirectMessage(recipientId, message);
      try {
        await extendNotificationCooldown(claimed, Date.now());
      } catch (error) {
        console.error("Unable to persist Discord notification cooldown:", {
          recipientId,
          error,
        });
      }
    } catch (error) {
      console.error("Discord DM notification failed:", {
        type: claimed.notification?.type || claimed.batch?.type,
        recipientId: claimed.notification?.recipientId || claimed.batch?.recipientId,
        error,
      });
    }
  } catch (error) {
    console.error("Unable to process Discord DM notification:", error);
  } finally {
    flushInProgress = false;
    schedulePendingNotifications();
  }
}

schedulePendingNotifications();
