import { NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/auth";

export function rejectCrossOriginRequest(request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return NextResponse.json({ error: "リクエスト元を確認できません。" }, { status: 403 });
  }

  try {
    if (new URL(origin).origin === getPublicOrigin(request)) return null;
  } catch {
    // Treat malformed origins or origin configuration as untrusted.
  }
  return NextResponse.json({ error: "許可されていないリクエスト元です。" }, { status: 403 });
}
