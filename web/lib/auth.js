import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "ettigani_session";
export const STATE_COOKIE = "ettigani_oauth_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function getAdminIds() {
  return new Set(
    (process.env.ADMIN_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^\d{17,20}$/.test(id)),
  );
}

export function isAdmin(user) {
  return Boolean(user?.id && getAdminIds().has(user.id));
}

export function devNotesEnabled() {
  return process.env.DEV_NOTES_ENABLED !== "false";
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function sign(value) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

export function createSessionToken(user) {
  const payload = Buffer.from(
    JSON.stringify({ user, expiresAt: Date.now() + SESSION_MAX_AGE * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.user?.id || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) {
      return null;
    }
    return data.user;
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export function stateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  };
}

export function expireLegacyStateCookie(response) {
  const { secure } = stateCookieOptions();
  response.headers.append(
    "Set-Cookie",
    `${STATE_COOKIE}=; Path=/api/auth/discord; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
  );
  return response;
}

export function clearStateCookie(response) {
  const options = stateCookieOptions();
  response.cookies.set(STATE_COOKIE, "", { ...options, maxAge: 0 });
  return expireLegacyStateCookie(response);
}

export function getPublicOrigin(request) {
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (redirectUri) return new URL(redirectUri).origin;

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  if (forwardedHost && ["http", "https"].includes(forwardedProto)) {
    return new URL(`${forwardedProto}://${forwardedHost}`).origin;
  }

  return new URL(request.url).origin;
}
