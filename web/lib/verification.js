import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const VERIFY_ROLE_NAME = "✅認証済み！";
const VERIFY_ROLE_COLOR = 0x57f287;
const SESSION_TTL_MS = 10 * 60 * 1000;
const PROCESSING_LEASE_MS = 60 * 1000;
let lastRateLimitCleanupAt = 0;

function databasePath() {
  return (
    process.env.VERIFY_DATABASE_PATH ||
    path.join(
      process.env.COMMUNITY_DATA_DIR || path.join(process.cwd(), "data"),
      "verification.sqlite",
    )
  );
}

export function getVerificationDatabase() {
  if (globalThis.verificationDatabase) return globalThis.verificationDatabase;

  const filePath = databasePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const database = new Database(filePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.exec(`
    CREATE TABLE IF NOT EXISTS verified_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      verified_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      revoked_at TEXT,
      UNIQUE (guild_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      log_channel_id TEXT NOT NULL,
      panel_channel_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS verification_sessions (
      state_hash TEXT PRIMARY KEY,
      session_hash TEXT UNIQUE,
      guild_id TEXT NOT NULL,
      turnstile_verified_at TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      stage TEXT NOT NULL,
      completion_status TEXT NOT NULL DEFAULT 'pending',
      processing_started_at INTEGER,
      processing_token TEXT,
      user_id TEXT,
      username TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS verification_rate_limits (
      rate_key TEXT PRIMARY KEY,
      window_started_at INTEGER NOT NULL,
      request_count INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS verification_sessions_expiry
      ON verification_sessions (expires_at);
    CREATE INDEX IF NOT EXISTS verified_users_guild
      ON verified_users (guild_id);
    CREATE INDEX IF NOT EXISTS verification_rate_limits_window
      ON verification_rate_limits (window_started_at);
  `);
  const verifiedUserColumns = new Set(
    database.pragma("table_info(verified_users)").map((column) => column.name),
  );
  if (!verifiedUserColumns.has("revoked")) {
    database.exec("ALTER TABLE verified_users ADD COLUMN revoked INTEGER NOT NULL DEFAULT 0");
  }
  if (!verifiedUserColumns.has("revoked_at")) {
    database.exec("ALTER TABLE verified_users ADD COLUMN revoked_at TEXT");
  }
  const sessionColumns = new Set(
    database.pragma("table_info(verification_sessions)").map((column) => column.name),
  );
  if (!sessionColumns.has("completion_status")) {
    database.exec(
      "ALTER TABLE verification_sessions ADD COLUMN completion_status TEXT NOT NULL DEFAULT 'pending'",
    );
  }
  if (!sessionColumns.has("processing_started_at")) {
    database.exec("ALTER TABLE verification_sessions ADD COLUMN processing_started_at INTEGER");
  }
  if (!sessionColumns.has("processing_token")) {
    database.exec("ALTER TABLE verification_sessions ADD COLUMN processing_token TEXT");
  }
  globalThis.verificationDatabase = database;
  return database;
}

export function hashVerificationToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function createOAuthState(guildId) {
  const database = getVerificationDatabase();
  const state = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  database.prepare("DELETE FROM verification_sessions WHERE expires_at <= ?").run(Date.now());
  database
    .prepare(
      `INSERT INTO verification_sessions
       (state_hash, guild_id, turnstile_verified_at, expires_at, stage, created_at)
       VALUES (?, ?, ?, ?, 'oauth', ?)`,
    )
    .run(hashVerificationToken(state), guildId, now, Date.now() + SESSION_TTL_MS, now);
  return state;
}

export function getOAuthSession(state) {
  return getVerificationDatabase()
    .prepare(
      `SELECT state_hash, guild_id, expires_at, stage
       FROM verification_sessions WHERE state_hash = ?`,
    )
    .get(hashVerificationToken(state));
}

export function attachOAuthUser(state, user, sessionToken) {
  return getVerificationDatabase()
    .prepare(
      `UPDATE verification_sessions
       SET stage = 'terms', session_hash = ?, user_id = ?, username = ?
       WHERE state_hash = ? AND stage = 'oauth' AND expires_at > ?`,
    )
    .run(
      hashVerificationToken(sessionToken),
      user.id,
      user.username,
      hashVerificationToken(state),
      Date.now(),
    ).changes;
}

export function getTermsSession(sessionToken) {
  if (!sessionToken) return null;
  return (
    getVerificationDatabase()
      .prepare(
        `SELECT state_hash, guild_id, user_id, username, stage, completion_status,
                processing_started_at, expires_at
         FROM verification_sessions
         WHERE session_hash = ? AND stage = 'terms' AND expires_at > ?`,
      )
      .get(hashVerificationToken(sessionToken), Date.now()) || null
  );
}

export function claimVerificationSession(sessionToken) {
  const database = getVerificationDatabase();
  const now = Date.now();
  const sessionHash = hashVerificationToken(sessionToken);
  const processingToken = randomBytes(16).toString("base64url");
  const result = database
    .prepare(
      `UPDATE verification_sessions
       SET completion_status = 'processing', processing_started_at = ?, processing_token = ?
       WHERE session_hash = ? AND stage = 'terms' AND expires_at > ?
         AND (
           completion_status = 'pending'
           OR (
             completion_status = 'processing'
             AND (processing_started_at IS NULL OR processing_started_at <= ?)
           )
         )`,
    )
    .run(now, processingToken, sessionHash, now, now - PROCESSING_LEASE_MS);
  if (result.changes === 1) return { status: "claimed", processingToken };
  const session = database
    .prepare(
      `SELECT completion_status FROM verification_sessions
       WHERE session_hash = ? AND stage = 'terms' AND expires_at > ?`,
    )
    .get(sessionHash, now);
  return { status: session?.completion_status || null };
}

export function releaseVerificationSession(sessionToken, processingToken) {
  if (!sessionToken || !processingToken) return;
  getVerificationDatabase()
    .prepare(
      `UPDATE verification_sessions
       SET completion_status = 'pending', processing_started_at = NULL, processing_token = NULL
       WHERE session_hash = ? AND completion_status = 'processing' AND processing_token = ?`,
    )
    .run(hashVerificationToken(sessionToken), processingToken);
}

export function markVerificationSessionCompleted(sessionToken, processingToken, guildId, userId) {
  return getVerificationDatabase()
    .prepare(
      `UPDATE verification_sessions
       SET completion_status = 'completed', processing_started_at = NULL, processing_token = NULL
       WHERE session_hash = ? AND stage = 'terms' AND completion_status = 'processing'
         AND processing_token = ? AND expires_at > ? AND guild_id = ? AND user_id = ?`,
    )
    .run(hashVerificationToken(sessionToken), processingToken, Date.now(), guildId, userId).changes;
}

export function completeVerificationSession(
  sessionToken,
  processingToken,
  guildId,
  userId,
  username,
  verifiedAt,
) {
  const database = getVerificationDatabase();
  const complete = database.transaction(() => {
    const updatedSession = database
      .prepare(
        `UPDATE verification_sessions
         SET completion_status = 'completed', processing_started_at = NULL, processing_token = NULL
         WHERE session_hash = ? AND stage = 'terms' AND completion_status = 'processing'
           AND processing_token = ? AND expires_at > ? AND guild_id = ? AND user_id = ?`,
      )
      .run(hashVerificationToken(sessionToken), processingToken, Date.now(), guildId, userId);
    if (updatedSession.changes !== 1) {
      throw new Error("Verification session was not in the processing state.");
    }
    database
      .prepare(
        `INSERT INTO verified_users (guild_id, user_id, username, verified_at, revoked, revoked_at)
         VALUES (?, ?, ?, ?, 0, NULL)
         ON CONFLICT(guild_id, user_id) DO UPDATE SET
           username = excluded.username,
           verified_at = excluded.verified_at,
           revoked = 0,
           revoked_at = NULL`,
      )
      .run(guildId, userId, username, verifiedAt);
  });
  complete();
}

export function deleteVerificationSession(sessionToken) {
  if (!sessionToken) return;
  getVerificationDatabase()
    .prepare("DELETE FROM verification_sessions WHERE session_hash = ?")
    .run(hashVerificationToken(sessionToken));
}

export function getGuildVerificationSettings(guildId) {
  return (
    getVerificationDatabase()
      .prepare(
        `SELECT guild_id, log_channel_id, panel_channel_id, role_id, created_at, updated_at
         FROM guild_settings WHERE guild_id = ?`,
      )
      .get(guildId) || null
  );
}

export function saveGuildVerificationSettings(settings) {
  const database = getVerificationDatabase();
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO guild_settings
       (guild_id, log_channel_id, panel_channel_id, role_id, created_at, updated_at)
       VALUES (@guild_id, @log_channel_id, @panel_channel_id, @role_id, @now, @now)
       ON CONFLICT(guild_id) DO UPDATE SET
         log_channel_id = excluded.log_channel_id,
         panel_channel_id = excluded.panel_channel_id,
         role_id = excluded.role_id,
         updated_at = excluded.updated_at`,
    )
    .run({ ...settings, now });
}

export function countVerifiedUsers(guildId) {
  return getVerificationDatabase()
    .prepare("SELECT COUNT(*) AS count FROM verified_users WHERE guild_id = ? AND revoked = 0")
    .get(guildId).count;
}

export function getVerifiedUser(guildId, userId) {
  return (
    getVerificationDatabase()
      .prepare(
        `SELECT guild_id, user_id, username, verified_at, revoked, revoked_at
         FROM verified_users WHERE guild_id = ? AND user_id = ?`,
      )
      .get(guildId, userId) || null
  );
}

export function isUserVerified(guildId, userId) {
  return Boolean(
    getVerificationDatabase()
      .prepare("SELECT 1 FROM verified_users WHERE guild_id = ? AND user_id = ? AND revoked = 0")
      .get(guildId, userId),
  );
}

export function revokeVerifiedUser(guildId, userId, revokedAt) {
  return getVerificationDatabase()
    .prepare(
      `UPDATE verified_users SET revoked = 1, revoked_at = ?
       WHERE guild_id = ? AND user_id = ? AND revoked = 0`,
    )
    .run(revokedAt, guildId, userId);
}

export function consumeVerificationRateLimit(key, limit, windowMs, now = Date.now()) {
  const database = getVerificationDatabase();
  const rateKey = hashVerificationToken(key);
  const update = database.prepare(
    `INSERT INTO verification_rate_limits (rate_key, window_started_at, request_count)
     VALUES (?, ?, 1)
     ON CONFLICT(rate_key) DO UPDATE SET
       request_count = CASE
         WHEN ? < window_started_at OR ? >= window_started_at + ? THEN 1
         ELSE request_count + 1
       END,
       window_started_at = CASE
         WHEN ? < window_started_at OR ? >= window_started_at + ? THEN ?
         ELSE window_started_at
       END`,
  );
  const read = database.prepare(
    "SELECT window_started_at, request_count FROM verification_rate_limits WHERE rate_key = ?",
  );
  const consume = database.transaction(() => {
    update.run(rateKey, now, now, now, windowMs, now, now, windowMs, now);
    return read.get(rateKey);
  });
  const entry = consume();
  if (now - lastRateLimitCleanupAt >= 60_000) {
    database
      .prepare("DELETE FROM verification_rate_limits WHERE window_started_at < ?")
      .run(now - 24 * 60 * 60 * 1000);
    lastRateLimitCleanupAt = now;
  }
  const retryAfter = Math.max(1, Math.ceil((entry.window_started_at + windowMs - now) / 1000));
  return {
    allowed: entry.request_count <= limit,
    retryAfter,
  };
}

export async function discordBotRequest(endpoint, options = {}) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured.");

  const response = await fetch(`https://discord.com/api/v10${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    const error = new Error(`Discord API returned ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

export async function getGuildMember(guildId, userId) {
  try {
    return await discordBotRequest(
      `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`,
    );
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

export async function isGuildAdministrator(guildId, member) {
  const roles = await discordBotRequest(`/guilds/${encodeURIComponent(guildId)}/roles`);
  const memberRoleIds = new Set([guildId, ...(member.roles || [])]);
  return roles.some((role) => memberRoleIds.has(role.id) && (BigInt(role.permissions) & 8n) === 8n);
}

export async function assignVerificationRole(guildId, userId, roleId) {
  return discordBotRequest(
    `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`,
    { method: "PUT" },
  );
}

export async function sendVerificationLog(settings, username, userId, verifiedAt) {
  const date = new Date(verifiedAt).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });
  return discordBotRequest(`/channels/${encodeURIComponent(settings.log_channel_id)}/messages`, {
    method: "POST",
    body: JSON.stringify({
      embeds: [
        {
          title: "✅ 認証完了",
          color: VERIFY_ROLE_COLOR,
          fields: [
            { name: "ユーザー名", value: username, inline: true },
            { name: "ユーザーID", value: userId, inline: true },
            {
              name: "認証方式",
              value: "Cloudflare Turnstile + Discord OAuth2",
            },
            { name: "認証日時", value: date },
          ],
        },
      ],
      allowed_mentions: { parse: [] },
    }),
  });
}

export { VERIFY_ROLE_COLOR, VERIFY_ROLE_NAME };
