import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  canViewPost,
  getCommunityPost,
  getPostEditedLabel,
  getUserAvatarUrl,
  serializeCommunityPost,
} from "@/lib/community";
import CommunityInteractions from "@/components/community-interactions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { postId } = await params;
  const post = getCommunityPost(postId);
  if (!post || !(await canViewPost(post, await getSession()))) return { title: "投稿" };
  return { title: post.title || "投稿" };
}

export default async function CommunityPostPage({ params }) {
  const { postId } = await params;
  const post = getCommunityPost(postId);
  const viewer = await getSession();
  if (!post || !(await canViewPost(post, viewer))) notFound();

  return (
    <article className="article-layout">
      <p className="eyebrow">
        <Link href="/community">コミュニティ</Link> · {post.category || "未分類"}
      </p>
      <div className="article-header">
        <h1>{post.title}</h1>
        <div className="article-byline">
          <Link href={`/users/${post.author.id}`}>
            <Image
              alt=""
              height={42}
              src={getUserAvatarUrl(post.author, 96)}
              unoptimized
              width={42}
            />
            <span>
              {post.author.globalName || post.author.username}
              <small>{new Date(post.createdAt).toLocaleDateString("ja-JP")}</small>
            </span>
          </Link>
          {getPostEditedLabel(post) ? <span>{getPostEditedLabel(post)}</span> : null}
          {post.visibility === "server" ? (
            <span className="category-chip">サーバー限定</span>
          ) : null}
        </div>
      </div>
      {post.thumbnail ? (
        <Image
          alt=""
          className="article-cover"
          height={520}
          src={post.thumbnail}
          unoptimized
          width={1040}
        />
      ) : null}
      <div className="article-body">{post.body}</div>
      <div className="tag-list article-tags">
        <Link href={`/community?category=${encodeURIComponent(post.category || "未分類")}`}>
          カテゴリー: {post.category || "未分類"}
        </Link>
        {post.tags?.map((tag) => (
          <Link href={`/community?tag=${encodeURIComponent(tag)}`} key={tag}>
            #{tag}
          </Link>
        ))}
      </div>
      <CommunityInteractions post={serializeCommunityPost(post, viewer)} viewer={viewer} />
    </article>
  );
}
