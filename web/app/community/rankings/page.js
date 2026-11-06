import Link from "next/link";
import { readCommunityStore } from "@/lib/community";
import { getGuilds } from "@/lib/data";
import { resolveGuilds } from "@/lib/rankings";

export const dynamic = "force-dynamic";
export const metadata = { title: "コミュニティランキング" };

export default async function CommunityRankingsPage({ searchParams }) {
  const params = await searchParams;
  const metric = ["likes", "popular"].includes(params.metric) ? params.metric : "posts";
  const store = readCommunityStore();
  const publicPosts = store.posts.filter((post) => post.visibility === "public");
  const userStats = new Map();
  for (const post of publicPosts) {
    const stats = userStats.get(post.author.id) || {
      user: post.author,
      posts: 0,
      likes: 0,
      popularPosts: 0,
    };
    stats.posts += 1;
    stats.likes += post.likes?.length || 0;
    if (post.likes?.length) stats.popularPosts += 1;
    userStats.set(post.author.id, stats);
  }
  const users = [...userStats.values()].sort((a, b) =>
    metric === "likes"
      ? b.likes - a.likes || b.posts - a.posts
      : metric === "popular"
      ? b.popularPosts - a.popularPosts || b.likes - a.likes
        : b.posts - a.posts || b.likes - a.likes,
  );

  const guilds = await resolveGuilds(getGuilds());
  const serverStats = Object.entries(guilds).map(([id, guild]) => {
    const posts = store.posts.filter((post) => post.visibility === "server" && post.guildId === id);
    return {
      id,
      name: guild.name,
      posts: posts.length,
      likes: posts.reduce((total, post) => total + (post.likes?.length || 0), 0),
      active: new Set(posts.flatMap((post) => [
        post.author.id,
        ...(post.likes || []),
        ...(post.comments || []).map((comment) => comment.author.id),
      ])).size,
    };
  }).sort((a, b) => b.posts - a.posts || b.likes - a.likes);

  return (
    <>
      <p className="eyebrow">COMMUNITY</p>
      <h1 className="page-heading">コミュニティランキング</h1>
      <p className="page-lead">コミュニティへの投稿やリアクションを集計しています。</p>
      <div className="ranking-switch">
        <nav className="period-tabs" aria-label="ユーザーランキング指標">
          <Link className={`period-tab ${metric === "posts" ? "is-active" : ""}`} href="?metric=posts">投稿数</Link>
          <Link className={`period-tab ${metric === "likes" ? "is-active" : ""}`} href="?metric=likes">獲得いいね</Link>
          <Link className={`period-tab ${metric === "popular" ? "is-active" : ""}`} href="?metric=popular">人気投稿</Link>
        </nav>
      </div>
      <div className="ranking-columns">
        <section className="panel-card">
          <h2>ユーザー</h2>
          {users.length ? <ol className="leaderboard">{users.slice(0, 20).map((item, index) => (
            <li key={item.user.id}>
              <span className="leader-rank">{index + 1}</span>
              <Link href={`/users/${item.user.id}`}>{item.user.globalName || item.user.username}</Link>
              <strong>
                {metric === "posts"
                  ? `${item.posts} 投稿`
                  : metric === "popular"
                    ? `${item.popularPosts} 人気投稿`
                    : `${item.likes} いいね`}
              </strong>
            </li>
          ))}</ol> : <p className="muted-copy">ランキング対象の投稿はまだありません。</p>}
        </section>
        <section className="panel-card">
          <h2>サーバー</h2>
          {serverStats.length ? <ol className="leaderboard">{serverStats.slice(0, 20).map((item, index) => (
            <li key={item.id}>
              <span className="leader-rank">{index + 1}</span>
              <Link href={`/servers/${item.id}`}>{item.name}</Link>
              <strong>{item.posts} 投稿 · {item.active} 人 · {item.likes} いいね</strong>
            </li>
          ))}</ol> : <p className="muted-copy">サーバーデータがありません。</p>}
        </section>
      </div>
    </>
  );
}
