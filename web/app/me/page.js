import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getPostEditedLabel,
  getUserAvatarUrl,
  getVisiblePosts,
  readCommunityStore,
  sortPosts,
} from "@/lib/community";
import { getUserMetrics } from "@/lib/rankings";
import AccountActions from "@/components/account-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "マイページ" };

export default async function MyPage({ searchParams }) {
  const user = await getSession();
  if (!user) redirect("/api/auth/discord");
  const params = await searchParams;
  const tab = ["profile", "stats", "achievements", "posts", "settings"].includes(params.tab)
    ? params.tab
    : "profile";
  const store = readCommunityStore();
  const ownPosts = sortPosts(
    await getVisiblePosts(
      store.posts.filter((post) => post.author.id === user.id),
      user,
    ),
  );
  const publicStats = store.posts.filter((post) => post.visibility === "public");
  const likes = publicStats.reduce(
    (total, post) => total + (post.author.id === user.id ? post.likes?.length || 0 : 0),
    0,
  );
  const botStats = getUserMetrics(user.id);
  const tabs = [
    ["profile", "プロフィール"],
    ["stats", "統計"],
    ["achievements", "実績"],
    ["posts", "投稿履歴"],
    ["settings", "設定"],
  ];

  return (
    <>
      <p className="eyebrow">MY PAGE</p>
      <section className="profile-head">
        <Image
          alt=""
          className="profile-avatar"
          height={88}
          src={getUserAvatarUrl(user, 256)}
          unoptimized
          width={88}
        />
        <div className="profile-name">
          <h1>{user.globalName || user.username}</h1>
          <p>
            @{user.username} · Discord ID: {user.id}
          </p>
        </div>
        <div className="profile-level">Lv.{botStats.level}</div>
      </section>
      <nav aria-label="マイページ" className="profile-tabs">
        {tabs.map(([key, label]) => (
          <Link
            aria-current={tab === key ? "page" : undefined}
            className={tab === key ? "is-active" : ""}
            href={`/me?tab=${key}`}
            key={key}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "profile" ? (
        <section className="panel-card my-profile-panel">
          <h2>プロフィール</h2>
          <dl className="detail-list">
            <div>
              <dt>Discordユーザー名</dt>
              <dd>{user.username}</dd>
            </div>
            <div>
              <dt>Discord ID</dt>
              <dd>{user.id}</dd>
            </div>
            <div>
              <dt>登録日</dt>
              <dd>
                {store.users[user.id]?.registeredAt
                  ? new Date(store.users[user.id].registeredAt).toLocaleDateString("ja-JP")
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
      {tab === "stats" ? (
        <section className="profile-stats">
          <article className="profile-stat">
            <span>Botレベル</span>
            <strong>Lv.{botStats.level}</strong>
          </article>
          <article className="profile-stat">
            <span>経験値（累計）</span>
            <strong>{botStats.total.toLocaleString("ja-JP")}</strong>
          </article>
          <article className="profile-stat">
            <span>総えっちがに</span>
            <strong>{botStats.total.toLocaleString("ja-JP")}</strong>
          </article>
          <article className="profile-stat">
            <span>投稿数</span>
            <strong>{ownPosts.length.toLocaleString("ja-JP")}</strong>
          </article>
          <article className="profile-stat">
            <span>獲得いいね数</span>
            <strong>{likes.toLocaleString("ja-JP")}</strong>
          </article>
        </section>
      ) : null}
      {tab === "achievements" ? (
        <section className="panel-card my-profile-panel">
          <h2>実績</h2>
          <p className="muted-copy">
            Botの実績データ連携は準備中です。現在のレベルはプロフィールに表示しています。
          </p>
        </section>
      ) : null}
      {tab === "posts" ? (
        <section className="post-list">
          {ownPosts.length ? (
            ownPosts.map((post) => (
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
                  <p className="post-excerpt">{post.body.slice(0, 150)}</p>
                </div>
              </article>
            ))
          ) : (
            <p className="empty-state">まだ投稿がありません。</p>
          )}
        </section>
      ) : null}
      {tab === "settings" ? (
        <section className="panel-card my-profile-panel">
          <h2>アカウント設定</h2>
          <p className="muted-copy">ログアウトして、この端末のログイン状態を終了します。</p>
          <AccountActions />
        </section>
      ) : null}
    </>
  );
}
