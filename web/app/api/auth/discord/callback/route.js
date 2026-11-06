import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  clearStateCookie,
  createSessionToken,
  getPublicOrigin,
  SESSION_COOKIE,
  sessionCookieOptions,
  STATE_COOKIE,
} from "@/lib/auth";
import { saveCommunityUser } from "@/lib/community";

export const runtime = "nodejs";

function redirectWithError(request, code) {
  const response = NextResponse.redirect(
    new URL(`/community?authError=${code}`, getPublicOrigin(request)),
    303,
  );
  return clearStateCookie(response);
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const response = NextResponse.redirect(new URL("/me", getPublicOrigin(request)), 303);
  clearStateCookie(response);

  const stateMatches = Boolean(returnedState && expectedState && returnedState === expectedState);
  const failureReasons = [];
  if (!code) failureReasons.push("code_missing");
  if (!expectedState) failureReasons.push("expected_state_missing");
  if (!returnedState) failureReasons.push("returned_state_missing");
  if (returnedState && expectedState && returnedState !== expectedState) {
    failureReasons.push("state_mismatch");
  }
  if (!code || !expectedState || returnedState !== expectedState) {
    console.error("OAuth callback diagnostic", {
      codePresent: Boolean(code),
      returnedStatePresent: Boolean(returnedState),
      expectedStatePresent: Boolean(expectedState),
      returnedStateLength: returnedState?.length ?? 0,
      expectedStateLength: expectedState?.length ?? 0,
      returnedStateFingerprint: returnedState
        ? createHash("sha256").update(returnedState).digest("hex").slice(0, 16)
        : null,
      expectedStateFingerprint: expectedState
        ? createHash("sha256").update(expectedState).digest("hex").slice(0, 16)
        : null,
      stateMatches,
      failureReasons,
      cookies: request.cookies.getAll().map((cookie) => ({
        name: cookie.name,
        valueLength: cookie.value.length,
      })),
      url: `${getPublicOrigin(request)}${url.pathname}`,
      headers: {
        host: request.headers.get("host"),
        "x-forwarded-host": request.headers.get("x-forwarded-host"),
        "x-forwarded-proto": request.headers.get("x-forwarded-proto"),
        "sec-fetch-site": request.headers.get("sec-fetch-site"),
        cookieHeaderPresent: request.headers.has("cookie"),
      },
    });
    return redirectWithError(request, "invalid_state");
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) return redirectWithError(request, "not_configured");
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    return redirectWithError(request, "not_configured");
  }

  const redirectUri =
    process.env.DISCORD_REDIRECT_URI ||
    new URL("/api/auth/discord/callback", getPublicOrigin(request)).toString();
  const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!tokenResponse.ok) return redirectWithError(request, "token_exchange_failed");

  const tokenData = await tokenResponse.json();
  const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!userResponse.ok) return redirectWithError(request, "user_lookup_failed");

  const discordUser = await userResponse.json();
  const user = {
    id: discordUser.id,
    username: discordUser.username,
    globalName: discordUser.global_name || discordUser.username,
    avatar: discordUser.avatar,
  };
  try {
    await saveCommunityUser(user);
    response.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions());
    return response;
  } catch (error) {
    console.error("Discord OAuth session setup failed:", error);
    return redirectWithError(request, "session_setup_failed");
  }
}
