import { NextResponse } from "next/server";
import { getGuilds, getLevel, getScoreData, hasGuildRegistry } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const totals = getScoreData("total");
  const levelBands = [
    { label: "Lv.0", min: 0, max: 0 },
    { label: "Lv.1-4", min: 1, max: 4 },
    { label: "Lv.5-9", min: 5, max: 9 },
    { label: "Lv.10-19", min: 10, max: 19 },
    { label: "Lv.20-49", min: 20, max: 49 },
    { label: "Lv.50+", min: 50, max: Infinity },
  ];
  const distribution = levelBands.map((band) => ({
    label: band.label,
    users: Object.values(totals).filter((value) => {
      const level = getLevel(value);
      return level >= band.min && level <= band.max;
    }).length,
  }));

  return NextResponse.json({
    totalCount: Object.values(totals).reduce((sum, count) => sum + (Number(count) || 0), 0),
    registeredUsers: Object.keys(totals).length,
    registeredGuilds: Object.keys(getGuilds()).length,
    guildRegistryReady: hasGuildRegistry(),
    levelDistribution: distribution,
  });
}
