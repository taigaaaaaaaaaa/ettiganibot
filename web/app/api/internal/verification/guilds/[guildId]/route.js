import { NextResponse } from "next/server";
import {
  countVerifiedUsers,
  getGuildVerificationSettings,
  getVerificationDatabase,
  isUserVerified,
  revokeVerifiedUser,
  saveGuildVerificationSettings,
} from "@/lib/verification";
import {
  isInternalVerificationRequest,
  validDiscordId,
  verificationRateLimitResponse,
} from "@/lib/verification-internal";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function authenticate(request) {
  const authorized = isInternalVerificationRequest(request);
  const limited = verificationRateLimitResponse(
    request,
    authorized ? "verification-internal-authenticated-ip" : "verification-internal-invalid-auth-ip",
    authorized ? 600 : 10,
    60_000,
  );
  if (limited) return limited;
  return authorized ? null : unauthorized();
}

export async function GET(request, { params }) {
  const authResponse = authenticate(request);
  if (authResponse) return authResponse;
  const { guildId } = await params;
  if (!validDiscordId(guildId)) {
    return NextResponse.json({ error: "invalid_guild_id" }, { status: 400 });
  }
  const guildRateLimit = verificationRateLimitResponse(
    request,
    `verification-internal-get:${guildId}`,
    120,
    60_000,
  );
  if (guildRateLimit) return guildRateLimit;
  try {
    const settings = getGuildVerificationSettings(guildId);
    const userId = new URL(request.url).searchParams.get("userId");
    if (userId && !validDiscordId(userId)) {
      return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
    }
    return NextResponse.json({
      settings,
      verifiedCount: countVerifiedUsers(guildId),
      ...(userId ? { isVerified: isUserVerified(guildId, userId) } : {}),
      database: "ok",
      turnstile: Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY),
      oauth: Boolean(
        process.env.DISCORD_CLIENT_ID &&
        process.env.DISCORD_CLIENT_SECRET &&
        process.env.VERIFY_DISCORD_REDIRECT_URI,
      ),
    });
  } catch (error) {
    console.error("Internal verification settings lookup failed:", error);
    return NextResponse.json({ error: "database_error" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const authResponse = authenticate(request);
  if (authResponse) return authResponse;
  const { guildId } = await params;
  if (!validDiscordId(guildId)) {
    return NextResponse.json({ error: "invalid_guild_id" }, { status: 400 });
  }
  const guildRateLimit = verificationRateLimitResponse(
    request,
    `verification-internal-put:${guildId}`,
    30,
    60_000,
  );
  if (guildRateLimit) return guildRateLimit;
  try {
    const body = await request.json();
    const { logChannelId, panelChannelId, roleId } = body || {};
    if (![logChannelId, panelChannelId, roleId].every(validDiscordId)) {
      return NextResponse.json({ error: "invalid_settings" }, { status: 400 });
    }
    getVerificationDatabase();
    saveGuildVerificationSettings({
      guild_id: guildId,
      log_channel_id: logChannelId,
      panel_channel_id: panelChannelId,
      role_id: roleId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Internal verification settings save failed:", error);
    return NextResponse.json({ error: "database_error" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const authResponse = authenticate(request);
  if (authResponse) return authResponse;
  const { guildId } = await params;
  if (!validDiscordId(guildId)) {
    return NextResponse.json({ error: "invalid_guild_id" }, { status: 400 });
  }
  const guildRateLimit = verificationRateLimitResponse(
    request,
    `verification-internal-revoke:${guildId}`,
    300,
    60_000,
  );
  if (guildRateLimit) return guildRateLimit;

  try {
    const body = await request.json();
    const { userId, removedRoleIds } = body || {};
    if (
      !validDiscordId(userId) ||
      !Array.isArray(removedRoleIds) ||
      removedRoleIds.length === 0 ||
      removedRoleIds.length > 250 ||
      !removedRoleIds.every(validDiscordId)
    ) {
      return NextResponse.json({ error: "invalid_revoke_request" }, { status: 400 });
    }
    const settings = getGuildVerificationSettings(guildId);
    if (!settings || !removedRoleIds.includes(settings.role_id)) {
      return NextResponse.json({ ok: true, revoked: false });
    }
    const result = revokeVerifiedUser(guildId, userId, new Date().toISOString());
    return NextResponse.json({ ok: true, revoked: result.changes === 1 });
  } catch (error) {
    console.error("Internal verification revocation failed:", error);
    return NextResponse.json({ error: "database_error" }, { status: 500 });
  }
}
