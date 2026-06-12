const crypto = require('crypto');
const { getSql } = require('./db');

// Session lifecycle:
//
//   login(password ok) ──► createSession ──► token in admin_sessions
//   admin request ──► requireAuth ──► validateSession (token + not expired)
//   logout ──► destroySession (revokes exactly one session)
//   expiry ──► validateSession returns false; row cleaned up lazily
//
// Stored sessions (vs stateless HMAC) were chosen for per-session
// revocation: delete one row, one leaked session dies.

const SESSION_TTL_HOURS = parseInt(process.env.SESSION_TTL_HOURS || '24', 10);

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  const s = getSql();
  await s`CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
  )`;
  tableReady = true;
}

async function createSession() {
  await ensureTable();
  const s = getSql();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await s`INSERT INTO admin_sessions (token, expires_at) VALUES (${token}, ${expiresAt})`;
  // opportunistic cleanup of expired rows; failure is irrelevant
  s`DELETE FROM admin_sessions WHERE expires_at < now()`.then(function () {}, function () {});
  return token;
}

async function validateSession(token) {
  if (!token) return false;
  const s = getSql();
  const rows = await s`SELECT token FROM admin_sessions WHERE token = ${token} AND expires_at > now() LIMIT 1`;
  return rows.length > 0;
}

async function destroySession(token) {
  if (!token) return;
  const s = getSql();
  await s`DELETE FROM admin_sessions WHERE token = ${token}`;
}

module.exports = { createSession, validateSession, destroySession, SESSION_TTL_HOURS };
