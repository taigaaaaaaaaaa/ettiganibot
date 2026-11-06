import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { rejectCrossOriginRequest } from "@/lib/csrf";
import {
  getCommunityCategories,
  getVisiblePosts,
  readCommunityStore,
  serializeCommunityPost,
  sanitizeCommunityText,
  sortPosts,
  updateCommunityStore,
} from "@/lib/community";
import { getGuilds } from "@/lib/data";
import { getGuildMember } from "@/lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || "";
  const tag = searchParams.get("tag")?.toLowerCase() || "";
  const authorId = searchParams.get("authorId") || "";
  const guildId = searchParams.get("guildId") || "";
  const sort = searchParams.get("sort") === "popular" ? "popular" : "latest";
  const viewer = await getSession();

  const store = readCommunityStore();
  const visiblePosts = await getVisiblePosts(store.posts, viewer);
  let posts = visiblePosts.filter((post) => {
    if (category && post.category !== category) return false;
    if (tag && !post.tags?.some((value) => value.toLowerCase() === tag)) return false;
    if (authorId && post.author?.id !== authorId) return false;
    if (guildId && post.guildId !== guildId && post.visibility !== "public") return false;
    return true;
  });
  posts = sortPosts(posts, sort).slice(0, 100);
  return NextResponse.json({
    posts: posts.map((post) => serializeCommunityPost(post, viewer)),
    categories: getCommunityCategories(visiblePosts),
  });
}

export async function POST(request) {
  const rejected = rejectCrossOriginRequest(request);
  if (rejected) return rejected;
  const author = await getSession();
  if (!author) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

  let input;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON形式のリクエストが必要です。" }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "入力内容を確認してください。" }, { status: 400 });
  }

  const title = typeof input.title === "string" ? sanitizeCommunityText(input.title) : "";
  const body = typeof input.body === "string" ? sanitizeCommunityText(input.body) : "";
  const category =
    (typeof input.category === "string" ? sanitizeCommunityText(input.category) : "") || "未分類";
  if (title.length < 1 || title.length > 120 || body.length < 1 || body.length > 20_000) {
    return NextResponse.json(
      { error: "タイトル（1〜120文字）と本文（1〜20,000文字）を入力してください。" },
      { status: 400 },
    );
  }
  if (category.length > 50) {
    return NextResponse.json(
      { error: "カテゴリーは50文字以内で入力してください。" },
      { status: 400 },
    );
  }

  const visibility = input.visibility === "server" ? "server" : "public";
  const guildId = typeof input.guildId === "string" ? input.guildId : "";
  if (visibility === "server") {
    if (!/^\d{17,20}$/.test(guildId) || !Object.hasOwn(getGuilds(), guildId)) {
      return NextResponse.json(
        { error: "Bot導入済みのサーバーを選択してください。" },
        { status: 400 },
      );
    }
    if (!(await getGuildMember(guildId, author.id))) {
      return NextResponse.json(
        { error: "選択したサーバーのメンバーのみ投稿できます。" },
        { status: 403 },
      );
    }
  }

  const thumbnail = typeof input.thumbnail === "string" ? input.thumbnail.trim() : "";
  if (
    thumbnail &&
    !/^\/api\/community\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i.test(
      thumbnail,
    )
  ) {
    return NextResponse.json(
      { error: "画像を選択してアップロードしてください。" },
      { status: 400 },
    );
  }
  const tags = Array.isArray(input.tags)
    ? [
        ...new Set(
          input.tags
            .map((value) => String(value).trim().replace(/^#/, ""))
            .filter((value) => /^[\p{L}\p{N}_-]{1,30}$/u.test(value))
            .slice(0, 8),
        ),
      ]
    : [];
  const createdAt = new Date().toISOString();
  const post = {
    id: randomUUID(),
    title,
    body,
    category,
    tags,
    thumbnail: thumbnail || null,
    visibility,
    guildId: visibility === "server" ? guildId : null,
    author: {
      id: author.id,
      username: author.username,
      globalName: author.globalName,
      avatar: author.avatar,
    },
    createdAt,
    updatedAt: createdAt,
    likes: [],
    saves: [],
    comments: [],
  };

  try {
    await updateCommunityStore((store) => store.posts.unshift(post));
    return NextResponse.json({ post: serializeCommunityPost(post, author) }, { status: 201 });
  } catch (error) {
    console.error("Community post creation failed:", error);
    return NextResponse.json({ error: "投稿を保存できませんでした。" }, { status: 500 });
  }
}
