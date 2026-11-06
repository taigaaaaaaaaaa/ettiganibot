import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { getSession, isAdmin } from "@/lib/auth";
import {
  getCommunityCategories,
  getVisiblePosts,
  readCommunityStore,
  serializeCommunityPost,
  sortPosts,
} from "@/lib/community";
import ClientGetForm from "@/components/client-get-form";
import CommunityPostList from "@/components/community-post-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "コミュニティ" };

export default async function CommunityPage({ searchParams }) {
  const params = await searchParams;
  const viewer = await getSession();
  const category = params.category || "";
  const tag = params.tag || "";
  const sort = params.sort === "popular" ? "popular" : "latest";
  const allPosts = readCommunityStore().posts;
  const visiblePosts = await getVisiblePosts(allPosts, viewer);
  const categories = getCommunityCategories(visiblePosts);
  let posts = visiblePosts.filter((post) => {
    if (category && post.category !== category) return false;
    if (tag && !post.tags?.some((value) => value.toLowerCase() === tag.toLowerCase())) return false;
    return true;
  });
  posts = sortPosts(posts, sort);
  posts = posts.map((post) => serializeCommunityPost(post, viewer));

  return (
    <>
      <div className="community-heading">
        <div>
          <p className="eyebrow">COMMUNITY</p>
          <h1 className="page-heading">コミュニティ</h1>
          <p className="page-lead">開発の話も、ちょっとした雑談も。みんなの投稿を見つけよう。</p>
        </div>
        {viewer ? (
          <Link className="action-link primary" href="/community/new">
            <MessageSquarePlus size={17} /> 投稿を作成
          </Link>
        ) : (
          <Link className="action-link primary" href="/api/auth/discord">
            Discordでログイン
          </Link>
        )}
      </div>
      {params.authError === "not_configured" ? (
        <section aria-live="polite" className="auth-setup-notice" role="alert">
          <h2>Discordログインは現在設定されていません</h2>
          <p>
            サイト管理者がDiscord Developer PortalのOAuth2設定と、サーバー環境変数
            DISCORD_CLIENT_ID・DISCORD_CLIENT_SECRET・SESSION_SECRETを設定する必要があります。
            設定後、Webサーバーを再起動してください。
          </p>
        </section>
      ) : params.authError ? (
        <section aria-live="polite" className="auth-setup-notice" role="alert">
          <h2>Discordログインを完了できませんでした</h2>
          <p>
            認証情報またはRedirect URIの設定を確認してください。Discord Developer Portalに
            <code>/api/auth/discord/callback</code>で終わる、このサイトのURLが登録されているかも
            ご確認ください。
          </p>
        </section>
      ) : null}
      <div className="community-layout">
        <section>
          <div className="community-toolbar">
            <div className="period-tabs">
              <Link
                className={`period-tab ${sort === "latest" ? "is-active" : ""}`}
                href={
                  category ? `/community?category=${encodeURIComponent(category)}` : "/community"
                }
              >
                新着
              </Link>
              <Link
                className={`period-tab ${sort === "popular" ? "is-active" : ""}`}
                href={`?sort=popular${category ? `&category=${encodeURIComponent(category)}` : ""}`}
              >
                人気
              </Link>
            </div>
            <ClientGetForm action="/community" className="filter-form">
              {tag ? <input name="tag" type="hidden" value={tag} /> : null}
              <select aria-label="カテゴリー" defaultValue={category} name="category">
                <option value="">すべてのカテゴリー</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button className="select-button" type="submit">
                絞り込む
              </button>
            </ClientGetForm>
          </div>
          {tag ? (
            <p className="active-filter">
              タグ: #{tag} <Link href="/community">解除</Link>
            </p>
          ) : null}
          <div className="post-list">
            <CommunityPostList admin={isAdmin(viewer)} initialPosts={posts} viewer={viewer} />
          </div>
        </section>
        <aside className="community-sidebar">
          <section className="panel-card">
            <h2>カテゴリー</h2>
            <ul className="category-list">
              {categories.map((item) => (
                <li key={item}>
                  <Link href={`/community?category=${encodeURIComponent(item)}`}>{item}</Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel-card">
            <h2>コミュニティ</h2>
            <p className="muted-copy">Discordログインで投稿、コメント、いいね、保存を使えます。</p>
            <Link className="text-link" href="/community/rankings">
              ランキングを見る →
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
