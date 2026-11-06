import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { rejectCrossOriginRequest } from "@/lib/csrf";

export async function POST(request) {
  const rejected = rejectCrossOriginRequest(request);
  if (rejected) return rejected;
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
