import { getGuilds, getLevel, getScoreData, hasGuildRegistry } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "統計" };

const levelBands = [
  { label: "Lv.0", min: 0, max: 0 },
  { label: "Lv.1-4", min: 1, max: 4 },
  { label: "Lv.5-9", min: 5, max: 9 },
  { label: "Lv.10-19", min: 10, max: 19 },
  { label: "Lv.20-49", min: 20, max: 49 },
  { label: "Lv.50+", min: 50, max: Infinity },
];

export default function StatisticsPage() {
  const totals = getScoreData("total");
  const totalCount = Object.values(totals).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const users = Object.values(totals);
  const distribution = levelBands.map((band) => ({
    ...band,
    count: users.filter((value) => {
      const level = getLevel(value);
      return level >= band.min && level <= band.max;
    }).length,
  }));
  const maximum = Math.max(1, ...distribution.map((band) => band.count));
  const guildCount = Object.keys(getGuilds()).length;

  return (
    <>
      <p className="eyebrow">累計データから集計</p>
      <h1 className="page-heading">統計</h1>
      <p className="page-lead">
        ここではBot全体の回数とレベルを集計しています。サーバー別ランキングは導入後にサーバーごとに記録されたスコアを表示します。
      </p>
      <section aria-label="全体統計" className="stats-grid">
        <article className="stat-block">
          <p className="stat-label">総えっちがに数</p>
          <p className="stat-number">{totalCount.toLocaleString("ja-JP")}</p>
        </article>
        <article className="stat-block">
          <p className="stat-label">登録ユーザー数</p>
          <p className="stat-number">{users.length.toLocaleString("ja-JP")}</p>
        </article>
        <article className="stat-block">
          <p className="stat-label">Bot登録Guild数</p>
          <p className="stat-number">{guildCount.toLocaleString("ja-JP")}</p>
        </article>
      </section>
      {!hasGuildRegistry() ? (
        <p className="rank-note">
          Guild数は現在ランキング投稿先が設定されたGuild数です。Bot再起動後、全Guild一覧が同期されます。
        </p>
      ) : null}
      <section>
        <h2 className="section-title">レベル分布</h2>
        <div aria-label="レベル分布" className="distribution">
          {distribution.map((band) => (
            <div className="distribution-row" key={band.label}>
              <span>{band.label}</span>
              <div
                aria-label={`${band.label} ${band.count}人`}
                className="distribution-bar"
                role="img"
              >
                <div
                  className="distribution-fill"
                  style={{ width: `${(band.count / maximum) * 100}%` }}
                />
              </div>
              <span className="distribution-count">{band.count.toLocaleString("ja-JP")}人</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
