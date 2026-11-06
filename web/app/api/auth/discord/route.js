import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  expireLegacyStateCookie,
  getPublicOrigin,
  STATE_COOKIE,
  stateCookieOptions,
} from "@/lib/auth";

export const runtime = "nodejs";

function redactCookieHeader(header) {
  const separator = header.indexOf("=");
  return `${header.slice(0, separator)}=<redacted>${header.slice(header.indexOf(";"))}`;
}

export async function GET(request) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!clientId || !clientSecret || !sessionSecret || sessionSecret.length < 32) {
    return NextResponse.redirect(
      new URL("/community?authError=not_configured", getPublicOrigin(request)),
      303,
    );
  }

  const state = randomBytes(32).toString("base64url");
  const stateFingerprint = createHash("sha256").update(state).digest("hex").slice(0, 16);
  const callbackUrl =
    process.env.DISCORD_REDIRECT_URI ||
    new URL("/api/auth/discord/callback", getPublicOrigin(request)).toString();
  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, stateCookieOptions());
  expireLegacyStateCookie(response);

  const responseHeaders = Object.fromEntries(
    [...response.headers]
      .filter(([name]) => name !== "set-cookie" && name !== "x-middleware-set-cookie")
      .map(([name, value]) => {
        if (name === "location") {
          const location = new URL(value);
          return [name, `${location.origin}${location.pathname}`];
        }
        return [name, value];
      }),
  );
  responseHeaders["set-cookie"] = response.headers.getSetCookie().map(redactCookieHeader);
  if (response.headers.has("x-middleware-set-cookie")) {
    responseHeaders["x-middleware-set-cookie"] = "<redacted>";
  }
  console.log("OAuth state generated", {
    stateFingerprint,
    cookieOptions: stateCookieOptions(),
    callbackUrl,
    authorizeUrl: authorizeUrl.toString().replace(state, "<redacted>"),
    stateParameterPresent: authorizeUrl.searchParams.has("state"),
    responseStatus: response.status,
    responseHeaders,
  });
  return response;
}
