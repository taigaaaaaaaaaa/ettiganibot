import { NextResponse } from "next/server";
import { getUserProfile } from "@/lib/rankings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { userId } = await params;
  if (!/^\d{17,20}$/.test(userId)) {
    return NextResponse.json({ error: "Invalid Discord user ID" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const profile = await getUserProfile(userId, searchParams.get("guildId"));
  return NextResponse.json(profile, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
