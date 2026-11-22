import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/auth";
import {
  attachOAuthUser,
  getGuildMember,
  getGuildVerificationSettings,
  getOAuthSession,
  isGuildAdministrator,
  isUserVerified,
} from "@/lib/verification";
import {
  createVerificationRequestId,
  getVerificationCallbackUrl,
  logVerificationEvent,
  verificationStateFingerprint,
} from "@/lib/verification-internal";

export const runtime = "nodejs";

function redirectToError(request, reason) {
  return NextResponse.redirect(
    new URL(`/verify/error?reason=${encodeURIComponent(reason)}`, getPublicOrigin(request)),
    303,
  );
}

export async function GET(request) {
  const requestId = createVerificationRequestId();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error")?.slice(0, 64) || null;
  logVerificationEvent("info", "callback.received", {
    requestId,
    callbackPath: url.pathname,
    codePresent: Boolean(code),
    statePresent: Boolean(state),
    stateFingerprint: verificationStateFingerprint(state),
    oauthError: oauthError || null,
  });
  if (!code || !state || oauthError) {
    logVerificationEvent("error", "callback.missing_parameters", {
      requestId,
      callbackPath: url.pathname,
      codePresent: Boolean(code),
      statePresent: Boolean(state),
      oauthError: oauthError || null,
    });
    return redirectToError(request, "oauth_failed");
  }

  try {
    let expectedCallbackUrl;
    try {
      expectedCallbackUrl = getVerificationCallbackUrl(request);
    } catch (error) {
      logVerificationEvent("error", "callback.invalid_configured_url", {
        requestId,
        callbackPath: url.pathname,
        configuredCallbackUrl: process.env.VERIFY_DISCORD_REDIRECT_URI || null,
        error: error.message,
      });
      return redirectToError(request, "not_configured");
    }
    if (url.pathname !== new URL(expectedCallbackUrl).pathname) {
      logVerificationEvent("error", "callback.unexpected_path", {
        requestId,
        callbackPath: url.pathname,
        expectedPath: new URL(expectedCallbackUrl).pathname,
      });
      return redirectToError(request, "invalid_state");
    }

    const oauthSession = getOAuthSession(state);
    if (!oauthSession || oauthSession.stage !== "oauth" || oauthSession.expires_at <= Date.now()) {
      logVerificationEvent("error", "callback.state_rejected", {
        requestId,
        callbackPath: url.pathname,
        stateFingerprint: verificationStateFingerprint(state),
        sessionFound: Boolean(oauthSession),
        sessionStage: oauthSession?.stage || null,
        sessionExpired: Boolean(oauthSession && oauthSession.expires_at <= Date.now()),
        sessionExpiresAt: oauthSession?.expires_at ?? null,
      });
      return redirectToError(request, "invalid_state");
    }
    logVerificationEvent("info", "callback.state_validated", {
      requestId,
      callbackPath: url.pathname,
      guildId: oauthSession.guild_id,
      stateFingerprint: verificationStateFingerprint(state),
      sessionStage: oauthSession.stage,
      sessionExpiresAt: oauthSession.expires_at,
    });

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = expectedCallbackUrl;
    if (!clientId || !clientSecret) {
      logVerificationEvent("error", "callback.oauth_not_configured", {
        requestId,
        clientIdConfigured: Boolean(clientId),
        clientSecretConfigured: Boolean(clientSecret),
        redirectUri,
      });
      return redirectToError(request, "not_configured");
    }

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
    if (!tokenResponse.ok) {
      logVerificationEvent("error", "callback.token_exchange_failed", {
        requestId,
        status: tokenResponse.status,
        redirectUri,
      });
      return redirectToError(request, "oauth_failed");
    }

    const tokenData = await tokenResponse.json();
    const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!userResponse.ok) {
      logVerificationEvent("error", "callback.user_lookup_failed", {
        requestId,
        status: userResponse.status,
      });
      return redirectToError(request, "oauth_failed");
    }

    const discordUser = await userResponse.json();
    const user = { id: discordUser.id, username: discordUser.username };
    let member;
    let isAdministrator;
    try {
      member = await getGuildMember(oauthSession.guild_id, user.id);
      isAdministrator = member ? await isGuildAdministrator(oauthSession.guild_id, member) : false;
    } catch (error) {
      logVerificationEvent("error", "callback.membership_check_failed", {
        requestId,
        guildId: oauthSession.guild_id,
        error: error.message,
        status: error.status || null,
      });
      return redirectToError(request, "guild_check_failed");
    }
    if (!member) {
      logVerificationEvent("error", "callback.guild_not_joined", {
        requestId,
        guildId: oauthSession.guild_id,
      });
      return redirectToError(request, "guild_not_joined");
    }
    if (isAdministrator) {
      logVerificationEvent("info", "callback.administrator_bypassed", {
        requestId,
        guildId: oauthSession.guild_id,
      });
      return NextResponse.redirect(
        new URL(
          `/verify/admin?guild=${encodeURIComponent(oauthSession.guild_id)}`,
          getPublicOrigin(request),
        ),
        303,
      );
    }
    if (isUserVerified(oauthSession.guild_id, user.id)) {
      const settings = getGuildVerificationSettings(oauthSession.guild_id);
      if (!settings) {
        logVerificationEvent("error", "callback.verified_settings_missing", {
          requestId,
          guildId: oauthSession.guild_id,
          userId: user.id,
        });
        return redirectToError(request, "not_configured");
      }

      if (member.roles?.includes(settings.role_id)) {
        logVerificationEvent("info", "callback.already_verified", {
          requestId,
          guildId: oauthSession.guild_id,
          userId: user.id,
        });
        return NextResponse.redirect(
          new URL(
            `/verify/already?guild=${encodeURIComponent(oauthSession.guild_id)}`,
            getPublicOrigin(request),
          ),
          303,
        );
      }

      logVerificationEvent("info", "callback.reverification_required", {
        requestId,
        guildId: oauthSession.guild_id,
        userId: user.id,
      });
    }

    const sessionToken = randomBytes(32).toString("base64url");
    if (attachOAuthUser(state, user, sessionToken) !== 1) {
      logVerificationEvent("error", "callback.session_attach_failed", {
        requestId,
        guildId: oauthSession.guild_id,
        userId: user.id,
        stateFingerprint: verificationStateFingerprint(state),
      });
      return redirectToError(request, "invalid_state");
    }
    const response = NextResponse.redirect(new URL("/verify/terms", getPublicOrigin(request)), 303);
    response.cookies.set("ettigani_verify_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    response.headers.set("Cache-Control", "no-store");
    logVerificationEvent("info", "callback.terms_session_created", {
      requestId,
      callbackPath: url.pathname,
      guildId: oauthSession.guild_id,
      userId: user.id,
      stateFingerprint: verificationStateFingerprint(state),
    });
    return response;
  } catch (error) {
    logVerificationEvent("error", "callback.failed", {
      requestId,
      callbackPath: url.pathname,
      stateFingerprint: verificationStateFingerprint(state),
      error: error.message,
      errorCode: error.code || null,
    });
    return redirectToError(request, "oauth_failed");
  }
}
