import { getGuilds } from "@/lib/data";
import { getRankings, resolveGuilds } from "@/lib/rankings";
import RankingTable from "@/components/ranking-table";
import RankingDataLoader from "@/components/ranking-data-loader";

export const dynamic = "force-dynamic";

export const metadata = { title: "ランキング" };

export default async function RankingPage({ searchParams }) {
  const params = await searchParams;
  const period = ["today", "weekly", "monthly", "total"].includes(params.period)
    ? params.period
    : "total";
  const mode = params.mode === "casino" ? "casino" : "count";
  const guildId = params.guildId || "";
  const data = await getRankings({
    mode,
    period,
    guildId,
    offset: params.offset,
    includeAffiliations: false,
  });
  const guilds = Object.entries(await resolveGuilds(getGuilds())).map(([id, guild]) => ({
    id,
    name: guild.name,
  }));

  return (
    <>
      <RankingDataLoader />
      <p className="eyebrow">メンバーランキング</p>
      <h1 className="page-heading">ランキング</h1>
      <p className="page-lead">
        {mode === "casino"
          ? "日・週・月は期間中のettigani$純増減、累計は現在の所持残高です。"
          : "今日・週間・月間・累計のえっちがに数と、累計から算出したレベルを表示します。"}
      </p>
      {guildId && data.guild ? <p className="section-title">{data.guild.name}</p> : null}
      <RankingTable
        data={data}
        guilds={guilds}
        selectedGuildId={guildId}
        selectedMode={mode}
        selectedPeriod={period}
      />
    </>
  );
}
