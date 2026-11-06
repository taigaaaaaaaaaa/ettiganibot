import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getPostEditedLabel,
  getVisiblePosts,
  readCommunityStore,
  sortPosts,
} from "@/lib/community";
import { getGuilds } from "@/lib/data";
import { getDiscordGuild } from "@/lib/discord";
import { resolveGuildName } from "@/lib/rankings";

export const dynamic = "force-dynamic";

export default async function ServerCommunityPage({ params }) {
  const { guildId } = await params;
  if (!/^\d{17,20}$/.test(guildId) || !Object.hasOwn(getGuilds(), guildId)) notFound();
  const guild = await getDiscordGuild(guildId);
  const name = await resolveGuildName(guildId);
  const icon = guild?.icon
    ? `https://cdn.discordapp.com/icons/${guildId}/${guild.icon}.png?size=256`
    : null;
  const viewer = await getSession();
  const source = readCommunityStore().posts.filter(
    (post) => post.visibility === "public" || post.guildId === guildId,
  );
  const posts = sortPosts(await getVisiblePosts(source, viewer));
  const privatePosts = posts.filter((post) => post.visibility === "server");
  const activeUsers = new Set(
    privatePosts.flatMap((post) => [
      post.author.id,
      ...(post.likes || []),
      ...(post.comments || []).map((comment) => comment.author.id),
    ]),
  ).size;
  const popularPosts = sortPosts(posts, "popular").slice(0, 5);

  return (
    <>
      <p className="eyebrow">
        <Link href="/servers">サーバーコミュニティ</Link>
      </p>
      <section className="server-hero panel-card">
        {icon ? (
          <Image alt="" height={82} src={icon} unoptimized width={82} />
        ) : (
          <span className="server-placeholder large">♧</span>
        )}
        <div>
          <h1>{name}</h1>
          <p>Discordサーバーごとの投稿とコミュニティ情報</p>
        </div>
      </section>
      <section className="profile-stats server-stats">
        <article className="profile-stat">
          <span>メンバー数</span>
          <strong>{guild?.approximate_member_count?.toLocaleString("ja-JP") || "—"}</strong>
        </article>
        <article className="profile-stat">
          <span>Bot導入日</span>
          <strong>—</strong>
        </article>
        <article className="profile-stat">
          <span>投稿数</span>
          <strong>{privatePosts.length.toLocaleString("ja-JP")}</strong>
        </article>
        <article className="profile-stat">
          <span>投稿者数</span>
          <strong>{activeUsers.toLocaleString("ja-JP")}</strong>
        </article>
      </section>
      <div className="section-row">
        <h2 className="section-title">新着投稿</h2>
        <Link className="text-link" href="/community">
          コミュニティ全体 →
        </Link>
      </div>
      <div className="post-list">
        {posts.length ? (
          posts.slice(0, 30).map((post) => (
            <article className="post-card compact-post" key={post.id}>
              <div className="post-card-content">
                <div className="post-meta">
                  <span className="category-chip">{post.category || "未分類"}</span>
                  <time>{new Date(post.createdAt).toLocaleDateString("ja-JP")}</time>
                  {getPostEditedLabel(post) ? <span>{getPostEditedLabel(post)}</span> : null}
                </div>
                <h2>
                  <Link href={`/community/${post.id}`}>{post.title}</Link>
                </h2>
                <p className="post-excerpt">{post.body.slice(0, 160)}</p>
                <div className="post-card-footer">
                  <Link href={`/users/${post.author.id}`}>
                    {post.author.globalName || post.author.username}
                  </Link>
                  <span>♥ {post.likes?.length || 0}</span>
                </div>
              </div>
            </article>
          ))
        ) : (
          <p className="empty-state">このサーバーの投稿はまだありません。</p>
        )}
      </div>
      <div className="section-row" style={{ marginTop: 32 }}>
        <h2 className="section-title">人気投稿</h2>
      </div>
      <div className="post-list">
        {popularPosts.map((post) => (
          <article className="post-card compact-post" key={`popular-${post.id}`}>
            <div className="post-card-content">
              <h2>
                <Link href={`/community/${post.id}`}>{post.title}</Link>
              </h2>
              <div className="post-card-footer">
                <span>{post.author.globalName || post.author.username}</span>
                <span>♥ {post.likes?.length || 0}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
