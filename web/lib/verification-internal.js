import { isIP } from "node:net";
import { timingSafeEqual } from "node:crypto";
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/auth";
import { consumeVerificationRateLimit } from "@/lib/verification";

export function createVerificationRequestId() {
  return randomUUID();
}

export function verificationStateFingerprint(state) {
  if (!state) return null;
  return createHash("sha256").update(state).digest("hex").slice(0, 16);
}

export function logVerificationEvent(level, event, details = {}) {
  const entry = JSON.stringify({
    component: "verification",
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });
  if (level === "error") {
    console.error("[verification]", entry);
  } else {
    console.info("[verification]", entry);
  }
}

export function isInternalVerificationRequest(request) {
  const expected = process.env.VERIFY_INTERNAL_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || expected.length < 32 || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

export function verificationRateLimitResponse(request, scope, limit, windowMs, identity) {
  const forwardedIp = request.headers.get("x-real-ip")?.trim();
  const clientIp = forwardedIp && isIP(forwardedIp) ? forwardedIp : "unknown";
  const key = `${scope}:${identity ?? clientIp}`;
  try {
    const result = consumeVerificationRateLimit(key, limit, windowMs);
    if (result.allowed) return null;
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(result.retryAfter) } },
    );
  } catch (error) {
    console.error("Verification rate limiter unavailable:", error);
    return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
  }
}

export function validDiscordId(value) {
  return typeof value === "string" && /^\d{17,20}$/.test(value);
}

export function getVerificationCallbackUrl(request) {
  const expectedOrigin = getPublicOrigin(request);
  const configured =
    process.env.VERIFY_DISCORD_REDIRECT_URI ||
    new URL("/api/verify/callback", expectedOrigin).toString();
  const callbackUrl = new URL(configured);
  if (
    callbackUrl.origin !== expectedOrigin ||
    callbackUrl.pathname !== "/api/verify/callback" ||
    callbackUrl.search ||
    callbackUrl.hash
  ) {
    throw new Error(
      "VERIFY_DISCORD_REDIRECT_URI must point to this host's /api/verify/callback route.",
    );
  }
  return callbackUrl.toString();
}
