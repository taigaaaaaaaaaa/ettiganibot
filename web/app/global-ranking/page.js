import { getRankings } from "@/lib/rankings";
import RankingTable from "@/components/ranking-table";
import RankingDataLoader from "@/components/ranking-data-loader";

export const dynamic = "force-dynamic";

export const metadata = { title: "グローバルランキング" };

export default async function GlobalRankingPage({ searchParams }) {
  const params = await searchParams;
  const period = ["today", "weekly", "monthly", "total"].includes(params.period)
    ? params.period
    : "total";
  const mode = params.mode === "casino" ? "casino" : "count";
  const data = await getRankings({ mode, period, offset: params.offset });

  return (
    <>
      <RankingDataLoader />
      <p className="eyebrow">導入サーバー横断</p>
      <h1 className="page-heading">グローバルランキング</h1>
      <p className="page-lead">
        {mode === "casino"
          ? "全サーバー共通の日・週・月のettigani$純増減と、累計所持残高ランキングです。"
          : "Botが記録している全サーバー横断のランキングです。"}
      </p>
      <RankingTable data={data} selectedMode={mode} selectedPeriod={period} showGuilds />
    </>
  );
}
