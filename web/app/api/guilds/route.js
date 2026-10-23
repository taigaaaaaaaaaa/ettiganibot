import { NextResponse } from "next/server";
import { getGuilds } from "@/lib/data";
import { resolveGuilds } from "@/lib/rankings";

export const dynamic = "force-dynamic";

export async function GET() {
  const guilds = await resolveGuilds(getGuilds());
  return NextResponse.json(Object.entries(guilds).map(([id, guild]) => ({ id, name: guild.name })));
}
