import { NextResponse } from "next/server";
import { getRankings } from "@/lib/rankings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const data = await getRankings({
    mode: searchParams.get("mode"),
    period: searchParams.get("period"),
    guildId: searchParams.get("guildId"),
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"),
    includeAffiliations: searchParams.get("includeAffiliations") !== "false",
  });

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
