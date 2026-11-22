import { NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/auth";
import {
  assignVerificationRole,
  claimVerificationSession,
  completeVerificationSession,
  deleteVerificationSession,
  discordBotRequest,
  getGuildMember,
  getGuildVerificationSettings,
  getTermsSession,
  isGuildAdministrator,
  isUserVerified,
  markVerificationSessionCompleted,
  releaseVerificationSession,
  sendVerificationLog,
} from "@/lib/verification";
import {
  createVerificationRequestId,
  logVerificationEvent,
  verificationRateLimitResponse,
} from "@/lib/verification-internal";

export const runtime = "nodejs";

function fail(reason, status = 400) {
  return NextResponse.json({ error: reason }, { status });
}

function complete(data) {
  const response = NextResponse.json(data);
  response.cookies.set("ettigani_verify_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function POST(request) {
  const requestId = createVerificationRequestId();
  const ipRateLimit = verificationRateLimitResponse(request, "verify-complete-ip", 30, 60_000);
  if (ipRateLimit) return ipRateLimit;
  if (request.headers.get("origin") !== getPublicOrigin(request)) {
    logVerificationEvent("error", "complete.origin_rejected", {
      requestId,
      requestOrigin: request.headers.get("origin"),
      expectedOrigin: getPublicOrigin(request),
    });
    return fail("invalid_state", 403);
  }

  const token = request.cookies.get("ettigani_verify_session")?.value;
  if (token) {
    const sessionRateLimit = verificationRateLimitResponse(
      request,
      "verify-complete-session",
      5,
      60_000,
      token,
    );
    if (sessionRateLimit) return sessionRateLimit;
  }
  let session;
  try {
    session = getTermsSession(token);
  } catch (error) {
    logVerificationEvent("error", "complete.session_lookup_failed", {
      requestId,
      sessionCookiePresent: Boolean(token),
      error: error.message,
      errorCode: error.code || null,
    });
    return fail("database_error", 500);
  }
  if (!session) {
    logVerificationEvent("error", "complete.session_missing_or_expired", {
      requestId,
      sessionCookiePresent: Boolean(token),
    });
    return fail("invalid_state", 401);
  }
  if (session.completion_status === "completed") {
    return complete({ ok: true, alreadyVerified: true });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return fail("terms_required");
  }
  if (body?.agreed !== true) {
    logVerificationEvent("error", "complete.terms_not_accepted", {
      requestId,
      guildId: session.guild_id,
      userId: session.user_id,
    });
    return fail("terms_required");
  }

  let processingToken;
  try {
    const settings = getGuildVerificationSettings(session.guild_id);
    if (!settings) {
      logVerificationEvent("error", "complete.guild_not_configured", {
        requestId,
        guildId: session.guild_id,
      });
      return fail("not_configured", 503);
    }

    let member;
    let isAdministrator;
    try {
      member = await getGuildMember(session.guild_id, session.user_id);
      isAdministrator = member ? await isGuildAdministrator(session.guild_id, member) : false;
    } catch (error) {
      logVerificationEvent("error", "complete.membership_check_failed", {
        requestId,
        guildId: session.guild_id,
        userId: session.user_id,
        status: error.status || null,
        error: error.message,
      });
      return fail("guild_check_failed", 502);
    }
    if (!member) {
      logVerificationEvent("error", "complete.guild_not_joined", {
        requestId,
        guildId: session.guild_id,
        userId: session.user_id,
      });
      deleteVerificationSession(token);
      return fail("guild_not_joined", 403);
    }
    if (isAdministrator) {
      deleteVerificationSession(token);
      return complete({ ok: true, admin: true });
    }
    let roles;
    try {
      roles = await discordBotRequest(`/guilds/${encodeURIComponent(session.guild_id)}/roles`);
    } catch (error) {
      console.error("Verification role lookup failed:", error);
      return fail("role_failed", 502);
    }
    const role = roles.find((item) => item.id === settings.role_id);
    if (!role) return fail("role_failed", 503);

    const claim = claimVerificationSession(token);
    if (claim.status === "completed") {
      return complete({ ok: true, alreadyVerified: true });
    }
    if (claim.status !== "claimed") {
      return fail(
        claim.status === "processing" ? "verification_in_progress" : "invalid_state",
        claim.status === "processing" ? 409 : 401,
      );
    }
    processingToken = claim.processingToken;

    const alreadyVerified = isUserVerified(session.guild_id, session.user_id);
    if (alreadyVerified && member.roles?.includes(settings.role_id)) {
      if (
        markVerificationSessionCompleted(
          token,
          processingToken,
          session.guild_id,
          session.user_id,
        ) !== 1
      ) {
        releaseVerificationSession(token, processingToken);
        return fail("invalid_state", 409);
      }
      return complete({ ok: true, alreadyVerified: true });
    }

    try {
      await assignVerificationRole(session.guild_id, session.user_id, settings.role_id);
    } catch (error) {
      releaseVerificationSession(token, processingToken);
      console.error("Verification role assignment failed:", error);
      logVerificationEvent("error", "complete.role_assignment_failed", {
        requestId,
        guildId: session.guild_id,
        userId: session.user_id,
        roleId: settings.role_id,
        status: error.status || null,
        error: error.message,
      });
      return fail("role_failed", 502);
    }

    const verifiedAt = new Date().toISOString();
    let logWarning = false;
    try {
      if (alreadyVerified) {
        if (
          markVerificationSessionCompleted(
            token,
            processingToken,
            session.guild_id,
            session.user_id,
          ) !== 1
        ) {
          throw new Error("Verification session could not be completed.");
        }
      } else {
        completeVerificationSession(
          token,
          processingToken,
          session.guild_id,
          session.user_id,
          session.username,
          verifiedAt,
        );
      }
    } catch (error) {
      releaseVerificationSession(token, processingToken);
      throw error;
    }
    try {
      await sendVerificationLog(settings, session.username, session.user_id, verifiedAt);
    } catch (error) {
      logWarning = true;
      console.error("Verification log delivery failed:", error);
    }
    logVerificationEvent("info", "complete.verified", {
      requestId,
      guildId: session.guild_id,
      userId: session.user_id,
      logWarning,
    });
    return complete({
      ok: true,
      guildId: session.guild_id,
      logWarning,
    });
  } catch (error) {
    try {
      releaseVerificationSession(token, processingToken);
    } catch (releaseError) {
      console.error("Verification session release failed:", releaseError);
    }
    logVerificationEvent("error", "complete.failed", {
      requestId,
      guildId: session.guild_id,
      userId: session.user_id,
      error: error.message,
      errorCode: error.code || null,
    });
    return fail("database_error", 500);
  }
}
