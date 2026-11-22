import { NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/auth";
import {
  createOAuthState,
  getGuildVerificationSettings,
  getOAuthSession,
} from "@/lib/verification";
import {
  createVerificationRequestId,
  getVerificationCallbackUrl,
  logVerificationEvent,
  validDiscordId,
  verificationStateFingerprint,
  verificationRateLimitResponse,
} from "@/lib/verification-internal";

export const runtime = "nodejs";

export async function POST(request) {
  const requestId = createVerificationRequestId();
  const ipRateLimit = verificationRateLimitResponse(request, "verify-start-ip", 10, 60_000);
  if (ipRateLimit) return ipRateLimit;
  if (request.headers.get("origin") !== getPublicOrigin(request)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    logVerificationEvent("error", "start.invalid_json", { requestId });
    return NextResponse.json({ error: "turnstile_failed" }, { status: 400 });
  }

  const { guildId, token } = body || {};
  if (!validDiscordId(guildId) || typeof token !== "string" || token.length < 1) {
    logVerificationEvent("error", "start.invalid_request", {
      requestId,
      guildId: validDiscordId(guildId) ? guildId : null,
      guildIdValid: validDiscordId(guildId),
      turnstileTokenPresent: typeof token === "string" && token.length > 0,
    });
    return NextResponse.json({ error: "turnstile_failed" }, { status: 400 });
  }
  const guildRateLimit = verificationRateLimitResponse(
    request,
    `verify-start-guild:${guildId}`,
    30,
    60_000,
  );
  if (guildRateLimit) return guildRateLimit;

  const secret = process.env.TURNSTILE_SECRET_KEY;
  const clientId = process.env.DISCORD_CLIENT_ID;
  let callbackUrl;
  try {
    callbackUrl = getVerificationCallbackUrl(request);
  } catch (error) {
    logVerificationEvent("error", "start.invalid_callback_url", {
      requestId,
      configuredCallbackUrl: process.env.VERIFY_DISCORD_REDIRECT_URI || null,
      error: error.message,
    });
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!secret || !clientId || !callbackUrl) {
    logVerificationEvent("error", "start.not_configured", {
      requestId,
      turnstileSecretConfigured: Boolean(secret),
      discordClientIdConfigured: Boolean(clientId),
      callbackUrl,
    });
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  try {
    if (!getGuildVerificationSettings(guildId)) {
      logVerificationEvent("error", "start.guild_not_configured", {
        requestId,
        guildId,
      });
      return NextResponse.json({ error: "not_configured" }, { status: 404 });
    }
    const verificationBody = new URLSearchParams({
      secret,
      response: token,
    });
    const remoteIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
    if (remoteIp) verificationBody.set("remoteip", remoteIp);

    let verificationResponse;
    try {
      verificationResponse = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: verificationBody,
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch (error) {
      logVerificationEvent("error", "start.turnstile_request_failed", {
        requestId,
        error: error.message,
      });
      return NextResponse.json({ error: "turnstile_unavailable" }, { status: 502 });
    }
    if (!verificationResponse.ok) {
      logVerificationEvent("error", "start.turnstile_http_error", {
        requestId,
        status: verificationResponse.status,
      });
      return NextResponse.json({ error: "turnstile_unavailable" }, { status: 502 });
    }
    let result;
    try {
      result = await verificationResponse.json();
    } catch (error) {
      logVerificationEvent("error", "start.turnstile_invalid_response", {
        requestId,
        error: error.message,
      });
      return NextResponse.json({ error: "turnstile_unavailable" }, { status: 502 });
    }
    const expectedHost = new URL(getPublicOrigin(request)).hostname;
    if (result.success !== true || result.hostname !== expectedHost || result.action !== "verify") {
      logVerificationEvent("error", "start.turnstile_rejected", {
        requestId,
        success: result.success === true,
        hostnameMatches: result.hostname === expectedHost,
        actionMatches: result.action === "verify",
        errorCodes: Array.isArray(result["error-codes"]) ? result["error-codes"] : [],
      });
      return NextResponse.json({ error: "turnstile_failed" }, { status: 400 });
    }

    const state = createOAuthState(guildId);
    const storedSession = getOAuthSession(state);
    if (!storedSession || storedSession.stage !== "oauth") {
      throw new Error("OAuth state was not persisted to verification_sessions.");
    }
    const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "identify");
    authorizeUrl.searchParams.set("state", state);
    logVerificationEvent("info", "start.oauth_redirect_created", {
      requestId,
      guildId,
      callbackUrl,
      callbackPath: new URL(callbackUrl).pathname,
      stateFingerprint: verificationStateFingerprint(state),
      stateStored: storedSession?.stage === "oauth",
      sessionExpiry: storedSession?.expires_at ?? null,
    });
    return NextResponse.json({ authorizeUrl: authorizeUrl.toString() });
  } catch (error) {
    logVerificationEvent("error", "start.failed", {
      requestId,
      error: error.message,
      errorCode: error.code || null,
    });
    return NextResponse.json({ error: "database_error" }, { status: 500 });
  }
}
