import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { getUserAvatarUrl } from "@/lib/community";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      ...user,
      avatarUrl: getUserAvatarUrl(user),
      isAdmin: isAdmin(user),
    },
  });
}
