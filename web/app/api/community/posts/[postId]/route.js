import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { rejectCrossOriginRequest } from "@/lib/csrf";
import {
  canViewPost,
  getCommunityPost,
  serializeCommunityPost,
  sanitizeCommunityText,
  updateCommunityStore,
} from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { postId } = await params;
  const post = getCommunityPost(postId);
  const viewer = await getSession();
  if (!post || !(await canViewPost(post, viewer))) {
    return NextResponse.json({ error: "投稿が見つかりません。" }, { status: 404 });
  }
  return NextResponse.json({ post: serializeCommunityPost(post, viewer) });
}

export async function PATCH(request, { params }) {
  const rejected = rejectCrossOriginRequest(request);
  if (rejected) return rejected;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

  let input;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON形式のリクエストが必要です。" }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "入力内容を確認してください。" }, { status: 400 });
  }

  const { postId } = await params;
  try {
    const result = await updateCommunityStore((store) => {
      const post = store.posts.find((item) => item.id === postId);
      if (!post) return { status: "not_found" };
      if (post.author?.id !== session.id && !isAdmin(session)) return { status: "forbidden" };

      const next = { ...post };
      if (Object.hasOwn(input, "title")) {
        if (typeof input.title !== "string") return { status: "invalid" };
        next.title = sanitizeCommunityText(input.title);
      }
      if (Object.hasOwn(input, "body")) {
        if (typeof input.body !== "string") return { status: "invalid" };
        next.body = sanitizeCommunityText(input.body);
      }
      if (Object.hasOwn(input, "category")) {
        if (typeof input.category !== "string") return { status: "invalid" };
        next.category = sanitizeCommunityText(input.category) || "未分類";
      }
      next.category =
        typeof next.category === "string"
          ? sanitizeCommunityText(next.category) || "未分類"
          : "未分類";
      if (
        next.title.length < 1 ||
        next.title.length > 120 ||
        next.body.length < 1 ||
        next.body.length > 20_000 ||
        next.category.length > 50
      ) {
        return { status: "invalid" };
      }
      next.updatedAt = new Date().toISOString();
      Object.assign(post, next);
      return { status: "ok", post };
    });

    if (result.status === "not_found") {
      return NextResponse.json({ error: "投稿が見つかりません。" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "この投稿を編集する権限がありません。" }, { status: 403 });
    }
    if (result.status !== "ok") {
      return NextResponse.json(
        { error: "タイトル、本文、カテゴリー（50文字以内）を確認してください。" },
        { status: 400 },
      );
    }
    return NextResponse.json({ post: serializeCommunityPost(result.post, session) });
  } catch (error) {
    console.error("Community post update failed:", error);
    return NextResponse.json({ error: "投稿を保存できませんでした。" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const rejected = rejectCrossOriginRequest(request);
  if (rejected) return rejected;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  const { postId } = await params;

  let reason = "";
  if (request.body) {
    try {
      const input = await request.json();
      if (typeof input?.reason === "string") reason = input.reason.trim().slice(0, 500);
    } catch {
      return NextResponse.json({ error: "JSON形式のリクエストが必要です。" }, { status: 400 });
    }
  }

  try {
    const result = await updateCommunityStore((store) => {
      const postIndex = store.posts.findIndex((item) => item.id === postId);
      if (postIndex < 0) return { status: "not_found" };
      const post = store.posts[postIndex];
      const adminAction = isAdmin(session);
      if (post.author?.id !== session.id && !adminAction) return { status: "forbidden" };
      store.posts.splice(postIndex, 1);
      if (adminAction) {
        store.auditLogs.push({
          action: "community_post_deleted",
          actorId: session.id,
          postId: post.id,
          postAuthorId: post.author.id,
          executedAt: new Date().toISOString(),
          ...(reason ? { reason } : {}),
        });
      }
      return { status: "ok" };
    });

    if (result.status === "not_found") {
      return NextResponse.json({ error: "投稿が見つかりません。" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "この投稿を削除する権限がありません。" }, { status: 403 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Community post deletion failed:", error);
    return NextResponse.json({ error: "投稿を削除できませんでした。" }, { status: 500 });
  }
}
