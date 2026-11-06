import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getPublicOrigin, getSession } from "@/lib/auth";
import { rejectCrossOriginRequest } from "@/lib/csrf";
import {
  canViewPost,
  consumeCommunityRateLimit,
  serializeCommunityPost,
  updateCommunityStore,
} from "@/lib/community";
import {
  enqueueLikeNotification,
  enqueueUserNotification,
  schedulePendingNotifications,
} from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  schedulePendingNotifications();
  const rejected = rejectCrossOriginRequest(request);
  if (rejected) return rejected;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

  const { postId } = await params;
  let input;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON形式のリクエストが必要です。" }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "入力内容を確認してください。" }, { status: 400 });
  }
  const actions = [
    "like",
    "save",
    "comment",
    "reply",
    "edit-comment",
    "edit-reply",
    "delete-comment",
    "delete-reply",
  ];
  if (!actions.includes(input.action)) {
    return NextResponse.json({ error: "操作を指定してください。" }, { status: 400 });
  }
  const comment = typeof input.comment === "string" ? input.comment.trim() : "";
  if (
    ["comment", "reply", "edit-comment", "edit-reply"].includes(input.action) &&
    (!comment || comment.length > 2_000)
  ) {
    return NextResponse.json(
      { error: "コメントは1〜2,000文字で入力してください。" },
      { status: 400 },
    );
  }
  if (
    ["reply", "edit-reply", "delete-reply"].includes(input.action) &&
    (typeof input.parentCommentId !== "string" || !input.parentCommentId)
  ) {
    return NextResponse.json({ error: "返信先コメントを指定してください。" }, { status: 400 });
  }
  if (
    ["edit-comment", "edit-reply", "delete-comment", "delete-reply"].includes(input.action) &&
    (typeof input.commentId !== "string" || !input.commentId)
  ) {
    return NextResponse.json({ error: "コメントを指定してください。" }, { status: 400 });
  }

  let postUrl = "";
  if (["like", "comment", "reply"].includes(input.action)) {
    try {
      postUrl = new URL(`/community/${encodeURIComponent(postId)}`, getPublicOrigin(request)).href;
    } catch (error) {
      console.error("Community notification URL generation failed:", error);
    }
  }

  try {
    const result = await updateCommunityStore(async (store) => {
      const post = store.posts.find((item) => item.id === postId);
      if (!post || !(await canViewPost(post, user))) return null;
      post.likes ||= [];
      post.saves ||= [];
      post.comments ||= [];

      if (input.action === "like") {
        const rateLimit = consumeCommunityRateLimit(store, user.id, "like");
        if (!rateLimit.allowed) return { status: "rate_limited", retryAfter: rateLimit.retryAfter };
        const index = post.likes.indexOf(user.id);
        if (index >= 0) post.likes.splice(index, 1);
        else {
          post.likes.push(user.id);
          enqueueLikeNotification(store, { recipient: post.author, actor: user, post, postUrl });
        }
      } else if (input.action === "save") {
        const index = post.saves.indexOf(user.id);
        if (index >= 0) post.saves.splice(index, 1);
        else post.saves.push(user.id);
      } else if (input.action === "comment") {
        const rateLimit = consumeCommunityRateLimit(store, user.id, "comment");
        if (!rateLimit.allowed) return { status: "rate_limited", retryAfter: rateLimit.retryAfter };
        const newComment = {
          id: randomUUID(),
          body: comment,
          author: {
            id: user.id,
            username: user.username,
            globalName: user.globalName,
            avatar: user.avatar,
          },
          createdAt: new Date().toISOString(),
        };
        post.comments.push(newComment);
        enqueueUserNotification(
          store,
          {
            type: "community_post_comment",
            recipient: post.author,
            actor: user,
            post,
            comment: newComment,
          },
          postUrl,
        );
      } else if (input.action === "reply") {
        let parent = post.comments.find((item) => item.id === input.parentCommentId);
        if (!parent) return { status: "invalid_parent" };

        const visited = new Set();
        while (parent.parentCommentId) {
          if (visited.has(parent.id)) return { status: "invalid_parent" };
          visited.add(parent.id);
          parent = post.comments.find((item) => item.id === parent.parentCommentId);
          if (!parent) return { status: "invalid_parent" };
        }

        const rateLimit = consumeCommunityRateLimit(store, user.id, "reply");
        if (!rateLimit.allowed) return { status: "rate_limited", retryAfter: rateLimit.retryAfter };
        const newReply = {
          id: randomUUID(),
          parentCommentId: parent.id,
          body: comment,
          author: {
            id: user.id,
            username: user.username,
            globalName: user.globalName,
            avatar: user.avatar,
          },
          createdAt: new Date().toISOString(),
        };
        post.comments.push(newReply);
        enqueueUserNotification(
          store,
          {
            type: "community_comment_reply",
            recipient: parent.author,
            actor: user,
            comment: parent,
            reply: newReply,
          },
          postUrl,
        );
      } else if (input.action === "edit-comment" || input.action === "edit-reply") {
        const target = post.comments.find((item) => item.id === input.commentId);
        if (
          !target ||
          (input.action === "edit-comment" && target.parentCommentId) ||
          (input.action === "edit-reply" && target.parentCommentId !== input.parentCommentId)
        ) {
          return { status: "not_found" };
        }
        if (target.author?.id !== user.id) return { status: "forbidden" };
        if (target.deletedAt) return { status: "deleted" };
        target.body = comment;
        target.editedAt = new Date().toISOString();
      } else if (input.action === "delete-comment") {
        const commentIndex = post.comments.findIndex(
          (item) => item.id === input.commentId && !item.parentCommentId,
        );
        if (commentIndex < 0) return { status: "not_found" };
        const target = post.comments[commentIndex];
        if (target.author?.id !== user.id) return { status: "forbidden" };
        if (post.comments.some((item) => item.parentCommentId === target.id)) {
          target.body = "";
          target.deletedAt = new Date().toISOString();
        } else {
          post.comments.splice(commentIndex, 1);
        }
      } else {
        const replyIndex = post.comments.findIndex(
          (item) => item.id === input.commentId && item.parentCommentId === input.parentCommentId,
        );
        if (replyIndex < 0) return { status: "not_found" };
        if (post.comments[replyIndex].author?.id !== user.id) return { status: "forbidden" };
        if (post.comments[replyIndex].deletedAt) return { status: "deleted" };
        post.comments.splice(replyIndex, 1);
      }
      return {
        status: "ok",
        liked: post.likes.includes(user.id),
        saved: post.saves.includes(user.id),
        likeCount: post.likes.length,
        saveCount: post.saves.length,
        comments: serializeCommunityPost(post, user).comments,
      };
    });
    if (!result) return NextResponse.json({ error: "投稿が見つかりません。" }, { status: 404 });
    if (result.status === "invalid_parent") {
      return NextResponse.json({ error: "返信先コメントが見つかりません。" }, { status: 404 });
    }
    if (result.status === "not_found") {
      return NextResponse.json({ error: "返信が見つかりません。" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "自分のコメントのみ操作できます。" }, { status: 403 });
    }
    if (result.status === "deleted") {
      return NextResponse.json({ error: "削除されたコメントは編集できません。" }, { status: 400 });
    }
    if (result.status === "rate_limited") {
      return NextResponse.json(
        { error: "操作が多すぎます。しばらくしてからもう一度お試しください。" },
        { status: 429, headers: { "Retry-After": String(result.retryAfter) } },
      );
    }
    schedulePendingNotifications();
    const { status, ...response } = result;
    return NextResponse.json(response);
  } catch (error) {
    console.error("Community interaction failed:", error);
    return NextResponse.json({ error: "操作を保存できませんでした。" }, { status: 500 });
  }
}
